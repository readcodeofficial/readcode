---
name: transcribe-meeting
description: Transcribe a team meeting recorded by Craig (the Discord recording bot) into a speaker-labelled Markdown transcript plus a short summary. Use when the user gives a Craig zip (craig-*.zip with one .aac/.flac track per speaker, info.txt, raw.dat) or a single meeting audio/video file, says "transcribe the meeting", or invokes /transcribe-meeting.
---

# Transcribe a Craig meeting recording

Craig zips hold one audio track per speaker (`1-<handle>.aac`, ...), all time-aligned
from the recording start, plus `info.txt` (guild, channel, start time, tracks) and
`raw.dat` (ignored). The script transcribes each track locally with Whisper
(faster-whisper, free, no API) and merges them by timestamp, so speakers are exact
(from the track) and only the words can be wrong. Works on Windows, macOS and Linux.

A single mixed file (one track for everyone: phone, OBS, Zoom, or Craig's "single track"
download) also works, but every line comes out as `speaker?`. If the user has a Craig zip
option, prefer the multi-track one; otherwise go ahead with what they have.

## Steps

1. **Environment** (once per machine). Needs Python 3.10 or newer. Make a venv outside the
   repo (the scratchpad, or `~/.venvs/whisper`), reuse it if it already exists:
   ```bash
   python -m venv <dir>/whisper-venv          # python3 on macOS/Linux
   <venv-python> -m pip install faster-whisper
   ```
   `<venv-python>` is `<dir>/whisper-venv/Scripts/python` on Windows and
   `<dir>/whisper-venv/bin/python` on macOS/Linux. No ffmpeg needed (PyAV bundles it).
   For an NVIDIA GPU on Windows or Linux, also `pip install nvidia-cublas-cu12 nvidia-cudnn-cu12==9.*`;
   the script adds their DLL folders itself on Windows and falls back to CPU if CUDA fails.
   Macs run on CPU. The first run downloads the model (~0.5 GB for `small`, ~1.5 GB for `medium`).
2. **Read `info.txt`** from the zip for the start time (UTC; convert to the user's local
   date) and the speaker list. For a single file, ask the user the date and who attended.
3. **Run** in the background:
   ```bash
   <venv-python> -I .claude/skills/transcribe-meeting/scripts/transcribe_craig.py <zip> docs/meetings/<YYYY-MM-DD>-transcript.md
   ```
   A 2-hour, 4-speaker meeting took ~17 min with `medium` on a GTX 1660 Ti; on CPU expect
   roughly real time with `small` and several times that with `medium`.
   Options: `--model medium` (better, slower), `--language en` (skip per-track detection
   if a quiet track was detected as the wrong language), `--device cpu`.
4. **Check** the output: every speaker in `info.txt` appears; no long runs of repeated
   lines (Whisper hallucination); the detected language per track (printed) is right.
   Rerun with `--language` or a bigger model if not.
   For a mixed file, don't relabel the transcript; in the notes, attribute decisions and
   action items only where the speaker is clear from what is said (names, "I'll take that"),
   and mark those attributions as inferred.
5. **Summarize** in `docs/meetings/<YYYY-MM-DD>-notes.md`: start with a `# ` title line and a
   "Who's who" line, then `## Decided` (a table: #, decision, when, notes), `## Action items`
   (owner) and `## Open questions`. Link to the transcript; quote timestamps for each
   decision so they can be checked. Mark anything you inferred rather than heard.
   If earlier notes exist in `docs/meetings/`, read the latest for the format and the
   who's-who mapping. A decision that would change CLAUDE.md must be confirmed with the
   user before editing CLAUDE.md.
6. **Post to Discord.** Preview first (prints the message, sends nothing):
   ```bash
   <venv-python> -I .claude/skills/transcribe-meeting/scripts/post_discord.py docs/meetings/<date>-notes.md docs/meetings/<date>-transcript.md
   ```
   Show the user that preview and post only after they say yes in chat, by rerunning with
   `--send`. The whole team reads it, and the notes contain guesses (who's who, inferred
   decisions). The message is the "Decided" and "Action items" sections (max 2000 chars),
   with the notes and transcript attached; `@` mentions are disabled.
   The webhook URL is read from the `READCODE_DISCORD_WEBHOOK` environment variable. Never
   write it into the repo, a command line that gets logged, or the notes. If it's unset and
   the user just wants to post, don't block on it: give them the preview text in a code block
   to copy-paste into Discord, and the paths of the notes and transcript to attach by hand
   (both are small text files). To post directly next time, ask the user to set it themselves (they get the URL from whoever made the webhook, or make one:
   channel settings > Integrations > Webhooks > New Webhook > Copy URL), then restart Claude Code:
   - Windows: `setx READCODE_DISCORD_WEBHOOK "<url>"`. `setx` only reaches programs started
     afterwards; if the session still doesn't see it, read it for one command from
     `[Environment]::GetEnvironmentVariable('READCODE_DISCORD_WEBHOOK','User')`.
   - macOS/Linux: add `export READCODE_DISCORD_WEBHOOK="<url>"` to `~/.zshrc` or `~/.bashrc`.

## Notes

- Discord handles are not real names. The team's mapping: `chdany12` = Danny,
  `craftinpark` = John, `_david_hong_` = David, `umiclon` = Roger. Ask the user about any
  handle not listed, and put the mapping at the top of the notes file.
- Recordings are private meeting content: keep the zip out of the repo and do not upload audio anywhere.
