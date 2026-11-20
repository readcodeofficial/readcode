# /transcribe-meeting: how to use it

Turns a Craig recording of a Discord meeting into a transcript (who said what, with
timestamps), meeting notes (decisions, action items, open questions), and optionally a
post in our Discord channel. Transcription runs on your own computer with Whisper:
free, no API key, and the audio never leaves your machine.

## You need

- Claude Code, opened in your `readcode` checkout (pull `main` first; the skill lives in
  `.claude/skills/`, so Claude Code picks it up by itself).
- Python 3.10 or newer (`python --version`, or `python3 --version` on a Mac).
- About 2 GB of free disk for the speech model. Windows, macOS and Linux all work.

## Do it

1. **Record** with Craig in the voice channel, then download the **multi-track** zip from
   the link Craig sends (one audio file per speaker, e.g. `craig-xxxx.aac.zip`). Keep it
   outside the repo.
   Only have one audio or video file (a phone or OBS recording, or Craig's single-track
   download)? That works too, but the transcript can't tell speakers apart.
2. In Claude Code, type:
   ```
   /transcribe-meeting C:\Users\you\Downloads\craig-xxxx.aac.zip
   ```
   (Or drag the zip into the chat.) The first time, it installs Whisper into a separate
   Python environment and downloads the model: about 5 minutes. Allow the commands it asks
   to run.
3. **Wait.** It transcribes in the background. On a laptop CPU, an hour of meeting takes
   very roughly an hour; with an NVIDIA GPU, much less.
4. **Check** what it wrote in `docs/meetings/<date>-transcript.md` and `<date>-notes.md`.
   Names of people and tools are often misheard, and decisions are its reading of the
   conversation, so correct anything wrong before sharing.
5. **Post to Discord** (optional). Without any setup, it gives you the message to
   copy-paste, plus the notes and transcript files to attach (small text files, unlike the
   audio). To have it post for you, it shows the message first and sends only when you
   say yes. That needs the channel's webhook URL: ask Danny for it privately (never paste it
   in a channel or commit it), then set it once and restart Claude Code:
   - Windows (PowerShell): `setx READCODE_DISCORD_WEBHOOK "<url>"`
   - Mac/Linux: add `export READCODE_DISCORD_WEBHOOK="<url>"` to `~/.zshrc` or `~/.bashrc`

## If something goes wrong

- **A speaker's lines are in another language or gibberish:** ask it to rerun with
  `--language en`.
- **Words are badly wrong:** ask it to rerun with `--model medium` (slower, better).
- **"GPU unavailable … using CPU":** normal without an NVIDIA GPU; it just takes longer.
