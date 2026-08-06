# Privacy Policy — AnimeVocab

_Last updated: 2026-07-17_

AnimeVocab is a browser extension that helps you learn Japanese vocabulary
from videos you watch. This policy explains exactly what it does with data.
(Also published at https://animevocab.com/privacy and https://animevocab.com/privacy.html.)

## What stays on your device

- **Your vocabulary progress, settings, and statistics** are stored locally in your
  browser (`chrome.storage.local`). The extension never uploads them unless you opt
  into cloud sync.
- **Your OpenAI API key** (only if you use bring-your-own-key Listening Mode) is
  stored locally and sent only to OpenAI's API (`api.openai.com`) to transcribe audio.
- **Your Pro license key** (only if you subscribe) is stored locally and sent only to
  the AnimeVocab licensing server to verify your subscription and meter listening hours.

## What leaves your device — Listening Mode, only when you start it

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

## Anonymous product counters

When the extension shows the in-product Chrome Web Store rating prompt (or you
click Rate), it sends a tiny allowlisted event name (e.g. `review_prompt_shown`)
plus the extension id to `animevocab.com`. These are aggregate Analytics Engine
counters only — no account id, vocabulary, or browsing history.

There is no separate opt-out toggle for these counters; dismissing the prompt
("No thanks" / Rate) stops further prompts and thus further beacons. The endpoint
rate-limits by IP and only accepts requests that present as our Chrome extension
(a public id in the Origin / header, not a secret credential).

## Website and service analytics

On `animevocab.com` we record which pages are viewed and which AI features are
used, along with the approximate location (country and city) Cloudflare derives
from the connection, a coarse device type, and the referring site's domain. When
you are signed in these are associated with your account id, so we can support
you and spot abuse.

For every AI request we also record the model, the operation (explain, hooks,
chat, and so on), token counts, cost, latency, and whether it succeeded — this is
how the service is kept affordable and failures get caught. Your prompts, the
subtitle lines you look up, and the AI's replies are **not** stored in analytics.

There is no analytics cookie and no advertising identifier, raw IP addresses are
not stored in analytics, and the data is retained for about 90 days. It is
visible only to the site owner and is never sold or shared.

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
- **host access to animevocab.com** — cloud sync (opt-in) and the rating-prompt counter beacon.

## Contact

Questions: open an issue at https://github.com/Atharva-Kanherkar/anime-vocab-coach
