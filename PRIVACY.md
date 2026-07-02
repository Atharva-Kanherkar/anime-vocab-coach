# Privacy Policy — Anime Vocab Coach

_Last updated: 2026-07-03_

Anime Vocab Coach is a browser extension that helps you learn Japanese vocabulary
from videos you watch. This policy explains exactly what it does with data.

## What stays on your device

- **Your vocabulary progress, settings, and statistics** are stored locally in your
  browser (`chrome.storage.local`). They are never uploaded anywhere by this extension.
- **Your OpenAI API key** (only if you choose to use Listening Mode) is stored locally
  in your browser and is sent only to OpenAI's API (`api.openai.com`) to transcribe
  audio. It is never sent to the extension author or any other party.

## What leaves your device (only in Listening Mode, only if you enable it)

- When you press **Start Listening Mode**, the extension captures the audio of the
  current browser tab, splits it into short clips, and sends those clips to
  **OpenAI's transcription API** using your own API key, solely to convert the
  Japanese speech into text for vocabulary detection.
- Audio is sent to OpenAI only while Listening Mode is active. It is not recorded,
  stored, or sent anywhere else. Nothing is captured when Listening Mode is off.
- Your use of the OpenAI API is governed by OpenAI's own privacy policy and terms.

## What it never does

- No analytics, no tracking, no advertising, no third-party servers operated by the
  author. The extension has no backend.
- It does not read pages other than the video sites it supports, and only to find
  subtitle text and the video element.

## Permissions and why

- **storage** — save your progress and settings locally.
- **tabCapture** + **offscreen** — capture tab audio for Listening Mode (only when you start it).
- **host access to youtube.com / netflix.com / crunchyroll.com** — detect subtitles and the video player.
- **host access to api.openai.com** — send audio for transcription in Listening Mode.

## Contact

Questions: open an issue at https://github.com/Atharva-Kanherkar/anime-vocab-coach
