# Privacy Policy — AnimeVocab

_Last updated: 2026-07-03_

AnimeVocab is a browser extension that helps you learn Japanese vocabulary
from videos you watch. This policy explains exactly what it does with data.
(Also published at https://animevocab.com/privacy.html.)

## What stays on your device

- **Your vocabulary progress, settings, and statistics** are stored locally in your
  browser (`chrome.storage.local`). The extension never uploads them anywhere.
- **Your OpenAI API key** (only if you use bring-your-own-key Listening Mode) is
  stored locally and sent only to OpenAI's API (`api.openai.com`) to transcribe audio.
- **Your Pro license key** (only if you subscribe) is stored locally and sent only to
  the AnimeVocab licensing server to verify your subscription and meter listening hours.

## What leaves your device — only in Listening Mode, only when you start it

- With **bring-your-own-key** Listening Mode, the current tab's **audio** is streamed
  directly to OpenAI's transcription API. Audio never passes through AnimeVocab's servers.
- With a **Pro subscription**, the extension first checks a shared transcript cache.
  On a **cache hit**, no audio leaves your device — only a cache lookup request
  (episode ID + playback time) goes to our server. On a **cache miss**, a short
  audio chunk is sent to our server once for transcription, then stored and shared
  so future users (and your re-watches) never resend that audio.
- With Pro, the extension additionally sends your **license key and listening minute
  counts** (numbers only — never page content) to the licensing server to enforce
  the monthly fair-use cap.
- Nothing is captured when Listening Mode is off.

## Anonymous product counters (optional, non-personal)

When the extension shows or you click the in-product Chrome Web Store rating
prompt, it may send a tiny allowlisted event name (e.g. `review_prompt_shown`)
plus the extension id to `animevocab.com` so we can count how often the prompt
appears. These are aggregate Analytics Engine counters only — no account id,
vocabulary, or browsing history is included. The endpoint rejects non-extension
callers and rate-limits by IP.

## What it never does

- No advertising, no selling of data, and no profiles built from your vocab.
- Cloud sync and accounts are opt-in (sign in on animevocab.com); local-only
  use never creates an account.
- It reads only the video sites it supports, and only to find subtitle text and
  the video element.

## Payments

Pro subscriptions are processed by **Dodo Payments**, the merchant of record.
Payment details go to them, not to us; their privacy policy applies to checkout.
We receive only the license key status needed to unlock Pro features.

## Permissions and why

- **storage** — save your progress and settings locally.
- **tabCapture** + **offscreen** — capture tab audio for Listening Mode (only when you start it).
- **host access to youtube.com / netflix.com / crunchyroll.com** — detect subtitles and the video player.
- **host access to api.openai.com** — send audio for transcription in Listening Mode.

## Contact

Questions: open an issue at https://github.com/Atharva-Kanherkar/anime-vocab-coach
