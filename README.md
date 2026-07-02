# Anime Vocab Coach — Implementation Spec

A Chrome extension (Manifest V3) that turns anime watching into active vocabulary study — **built for total beginners who can't read Japanese yet**:

1. You watch exactly as you always do: **English subs on screen, Japanese audio in your ears.**
2. The extension captures the Japanese another way — a hidden caption track on YouTube, or OpenAI audio transcription of the tab on Netflix/Crunchyroll (see `docs/08-LISTENING-MODE.md`).
3. It tokenizes each Japanese line, looks words up in a bundled dictionary, and **scores** them by frequency, level, and your personal history.
4. When a word worth learning was just spoken, it **pauses the video** and shows a card: the word in **romaji** ("taikutsu"), spoken aloud, its meaning, the English subtitle you just read, and buttons — *I know it / Learn it / Ignore*.
5. It **tracks your progress** (words met, learning queue, streaks) and re-surfaces learning words *in context* when they're spoken again in whatever you're watching — spaced repetition powered by anime instead of flashcards.

This repository is **not the extension** — it is the complete build plan. Every technical decision has already been made and written down so that an implementing agent (human or AI) never has to guess.

## How to build this

Read and implement the docs **in order**. Do not skip ahead. Do not substitute technologies.

| Doc | What it locks down |
|---|---|
| [`docs/00-PRODUCT-SPEC.md`](docs/00-PRODUCT-SPEC.md) | Exact user-facing behavior, modes, defaults |
| [`docs/01-ARCHITECTURE.md`](docs/01-ARCHITECTURE.md) | File tree, module boundaries, data flow, manifest.json (verbatim) |
| [`docs/02-DATA-MODEL.md`](docs/02-DATA-MODEL.md) | Storage schemas, dictionary format, scoring formula, SRS algorithm — all exact |
| [`docs/03-MILESTONES.md`](docs/03-MILESTONES.md) | The build order: 9 milestones, each with acceptance tests you MUST pass before continuing |
| [`docs/04-SITE-ADAPTERS.md`](docs/04-SITE-ADAPTERS.md) | Per-site subtitle capture: selectors, observers, edge cases |
| [`docs/05-UI-SPEC.md`](docs/05-UI-SPEC.md) | Overlay card, popup dashboard, options page — exact DOM, CSS, copy text |
| [`docs/06-PITFALLS.md`](docs/06-PITFALLS.md) | Known traps (MV3 service-worker XHR, fullscreen overlays, Netflix SPA nav…) and their required workarounds |
| [`docs/07-QA-CHECKLIST.md`](docs/07-QA-CHECKLIST.md) | Final manual test script before calling it done |
| [`docs/08-LISTENING-MODE.md`](docs/08-LISTENING-MODE.md) | **v2:** romaji-first cards, hidden YouTube ja-track capture, OpenAI audio transcription for Netflix/Crunchyroll |
| [`scripts/build-dictionary.mjs`](scripts/build-dictionary.mjs) | **Already written.** Generates `data/dictionary.json` from JMdict. Run it; don't rewrite it. |

## Hand-off prompt (paste this into your coding agent)

> Clone this repo and read `AGENTS.md`, then `docs/00` through `docs/07` in order. Implement the Chrome extension exactly as specified, milestone by milestone per `docs/03-MILESTONES.md`. After each milestone, run its acceptance test and show me the result before starting the next milestone. Never deviate from the spec; if something is genuinely impossible as written, stop and report it instead of improvising.

## Tech stack

- Chrome extension, **Manifest V3**, **TypeScript** (strict) in `src/`, bundled per-context into `extension/` with **esbuild** (`npm run build`). No UI framework.
- Tokenizer: **kuromoji.js** (npm), dictionary files bundled into the extension.
- Dictionary: **JMdict-derived JSON** (~30k common words), generated once by `scripts/build-dictionary.mjs`.
- Storage: `chrome.storage.local`.
- Supported sites: **YouTube** (hidden ja caption track, free), any page with native HTML5 `<track>` text tracks (free), and **Netflix + Crunchyroll + anything else** via Listening Mode (OpenAI audio transcription — included with Pro, or bring your own API key).

## Pro (subscription)

The core learning loop is free and runs entirely locally. **Pro** ($10/month or
$84/year) makes Listening Mode one click: no OpenAI account or API key needed —
transcription is handled by a hosted backend, up to 45 listening-hours per month.
Payments and license keys are handled by Dodo Payments (merchant of record);
the backend is a single Cloudflare Worker in [`backend/`](backend/README.md)
that validates licenses, meters usage, and mints short-lived OpenAI tokens.
Audio streams directly from the browser to OpenAI and never touches the backend.

## Status

- [x] Spec complete
- [x] M0 Scaffold
- [x] M1 YouTube subtitle capture
- [x] M2 Tokenizer
- [x] M3 Dictionary + lookup
- [x] M4 Pause + overlay card
- [x] M5 Progress storage
- [x] M6 Popup dashboard
- [x] M7 Netflix + generic adapters
- [x] M8 Options + in-context SRS
- [x] M9 Polish + QA
- [x] v2: Romaji-first cards + TTS (`docs/08`)
- [x] v2: YouTube hidden Japanese caption track
- [x] v2: Listening Mode — OpenAI transcription for Netflix/Crunchyroll (needs live testing)
