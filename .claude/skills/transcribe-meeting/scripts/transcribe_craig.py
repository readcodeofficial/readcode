"""Transcribe a Craig (Discord recorder) zip into one speaker-labelled transcript.

Craig gives one audio track per speaker ("1-alice.aac", "2-bob.aac", ...), all
starting at the same moment and padded to the same length, so segment
timestamps from different tracks line up. We transcribe each track with
faster-whisper (VAD skips the long silences) and merge the segments by time.

    python transcribe_craig.py RECORDING.zip OUT.md [--model small] [--language en]

A single audio or video file (one mixed track, e.g. a phone or OBS recording) also works,
but then nobody is labelled: every line is "speaker?" and the speakers have to be worked
out from what is said.
"""

import argparse
import re
import sys
import tempfile
import time
import zipfile
from pathlib import Path

AUDIO_EXT = {".aac", ".flac", ".ogg", ".opus", ".m4a", ".mp3", ".wav"}
MIXED = "speaker?"


def speaker_name(path: Path) -> str:
    # "2-_david_hong_.aac" -> "david_hong"
    return re.sub(r"^\d+-", "", path.stem).strip("_") or path.stem


def stamp(seconds: float) -> str:
    s = int(seconds)
    return f"{s // 3600:02d}:{s % 3600 // 60:02d}:{s % 60:02d}"


PAUSE = 1.5  # seconds of silence inside one Whisper segment that start a new piece


def split_at_pauses(seg):
    """Split a segment where its words are PAUSE apart, each piece with its own start time.

    VAD glues one speaker's speech chunks together before Whisper sees them, so a single
    segment can span a long silence in which someone else spoke. Unsplit, the merged turn
    would sort before the other speaker's reply and the transcript would be out of order.
    """
    words = [w for w in (seg.words or []) if w.word.strip()]
    if not words:
        return [(seg.start, seg.text.strip())]
    pieces, current = [], [words[0]]
    for prev, w in zip(words, words[1:]):
        if w.start - prev.end > PAUSE:
            pieces.append(current)
            current = []
        current.append(w)
    pieces.append(current)
    return [(p[0].start, "".join(w.word for w in p).strip()) for p in pieces]


def decode(path: Path):
    # Our own decode: faster-whisper's decode_audio passes an argument newer PyAV rejects.
    import av
    import numpy as np

    resampler = av.AudioResampler(format="flt", layout="mono", rate=16000)
    chunks = []
    with av.open(str(path)) as container:
        for frame in container.decode(audio=0):
            for out in resampler.resample(frame):
                chunks.append(out.to_ndarray().reshape(-1))
    for out in resampler.resample(None):
        chunks.append(out.to_ndarray().reshape(-1))
    return np.concatenate(chunks).astype(np.float32)


def add_cuda_dlls() -> None:
    # pip's nvidia-cublas-cu12 / nvidia-cudnn-cu12 put their DLLs in site-packages/nvidia/*/bin.
    import os
    import site

    for sp in site.getsitepackages():
        for bin_dir in Path(sp).glob("nvidia/*/bin"):
            os.add_dll_directory(str(bin_dir))
            os.environ["PATH"] = f"{bin_dir}{os.pathsep}{os.environ['PATH']}"


def load_model(name: str, device: str):
    if sys.platform == "win32":
        add_cuda_dlls()
    from faster_whisper import WhisperModel

    if device in ("auto", "cuda"):
        try:
            model = WhisperModel(name, device="cuda", compute_type="int8_float16")
            # Missing cuBLAS/cuDNN DLLs only show up on first use, so probe now.
            import numpy as np

            list(model.transcribe(np.zeros(16000, dtype=np.float32))[0])
            return model, "cuda"
        except Exception as e:  # noqa: BLE001
            if device == "cuda":
                raise
            print(f"GPU unavailable ({e.__class__.__name__}: {e}); using CPU", file=sys.stderr)
    return WhisperModel(name, device="cpu", compute_type="int8"), "cpu"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("zip", type=Path, help="Craig zip, or one mixed audio/video file")
    ap.add_argument("out", type=Path)
    ap.add_argument("--model", default="small", help="tiny/base/small/medium/large-v3/turbo")
    ap.add_argument("--language", default=None, help="e.g. en; default: auto-detect per track")
    ap.add_argument("--device", default="auto", choices=["auto", "cuda", "cpu"])
    args = ap.parse_args()

    model, device = load_model(args.model, args.device)
    print(f"model {args.model} on {device}", file=sys.stderr)

    segments = []
    info_txt = ""
    mixed = not zipfile.is_zipfile(args.zip)
    with tempfile.TemporaryDirectory() as tmp:
        if mixed:  # any format PyAV can decode, whatever its extension
            tracks = [args.zip]
        else:
            with zipfile.ZipFile(args.zip) as z:
                for member in z.namelist():
                    name = Path(member).name
                    if name.lower() == "info.txt":
                        info_txt = z.read(member).decode("utf-8", "replace")
                    elif name and Path(name).suffix.lower() in AUDIO_EXT:
                        (Path(tmp) / name).write_bytes(z.read(member))
            tracks = sorted(p for p in Path(tmp).iterdir() if p.suffix.lower() in AUDIO_EXT)
        if not tracks:
            print("no audio tracks in the zip", file=sys.stderr)
            return 1
        for track in tracks:
            who = MIXED if mixed else speaker_name(track)
            t0 = time.time()
            parts, info = model.transcribe(
                decode(track),
                language=args.language,
                vad_filter=True,
                vad_parameters={"min_silence_duration_ms": 700},
                condition_on_previous_text=False,  # stops one hallucination repeating
                word_timestamps=True,
            )
            n = 0
            for seg in parts:
                # Whisper invents text ("Thank you.") on noise; drop what it isn't sure was speech.
                if not seg.text.strip() or (seg.no_speech_prob > 0.6 and seg.avg_logprob < -1.0):
                    continue
                for start, text in split_at_pauses(seg):
                    segments.append((start, who, text))
                    n += 1
            print(f"{who}: {n} segments, language {info.language}, {time.time() - t0:.0f}s", file=sys.stderr)

    segments.sort()
    # Merge consecutive segments from the same speaker into one turn.
    turns = []
    for start, who, text in segments:
        if turns and turns[-1][1] == who and not mixed:  # mixed: every line is "speaker?"
            turns[-1][2].append(text)
        else:
            turns.append((start, who, [text]))

    lines = [f"# Meeting transcript ({args.zip.stem})", ""]
    if info_txt:
        lines += ["```", info_txt.strip(), "```", ""]
    lines += [
        f"Transcribed automatically with Whisper `{args.model}`; "
        + ("one mixed track, so speakers are not separated (`speaker?`). " if mixed
           else "names are Discord handles. ")
        + "Expect misheard words, especially names and jargon.",
        "",
    ]
    for start, who, texts in turns:
        lines += [f"**[{stamp(start)}] {who}:** {' '.join(texts)}", ""]
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text("\n".join(lines), encoding="utf-8")
    print(f"wrote {args.out} ({len(turns)} turns)", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
