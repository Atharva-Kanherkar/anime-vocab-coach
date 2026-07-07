<div align="center">

<img src="extension/icons/icon128.png" width="80" alt="AnimeVocab icon">

# AnimeVocab

**Learn Japanese from the anime you already watch.**

Romaji-first vocabulary cards, spaced repetition, and Listening Mode for Netflix, Crunchyroll, and YouTube. Free, open source, local-first — with an optional cloud app and [Manga Studio](https://animevocab.com/studio) for creating your own manga.

[**Website**](https://animevocab.com) · [**Install extension**](https://animevocab.com/app) · [**Manga Studio**](https://animevocab.com/studio) · [**Cloud app**](https://animevocab.com/app)

[![License: AGPL v3](https://img.shields.io/badge/License-AGPLv3-blue.svg)](LICENSE)
[![Chrome](https://img.shields.io/badge/Chrome-Manifest%20V3-4285F4?logo=googlechrome&logoColor=white)](extension/manifest.json)

</div>

---

## Why AnimeVocab

Most anime learning tools assume you can already read Japanese subtitles. AnimeVocab meets you where most fans actually are: **watching with English subs**, hearing Japanese, and wanting to **remember useful words** without setting up Anki on day one.

| Feature | What it does |
| --- | --- |
| **Romaji-first cards** | See *yakusoku* before you can read 約束 |
| **One word per line** | No flashcard flood — one useful candidate per subtitle line |
| **Spaced repetition** | Built-in review queue; export to Anki anytime |
| **Listening Mode** | Transcribes tab audio when JP subs are missing (Crunchyroll, etc.) |
| **Local-first** | Progress in `chrome.storage.local` — no account required |
| **Manga Studio** | AI-assisted manga maker at [animevocab.com/studio](https://animevocab.com/studio) |
| **Cloud app** | Optional sync, AI coach, notebooks, streaks at [animevocab.com/app](https://animevocab.com/app) |

## Install the Chrome extension

### Chrome Web Store (when live)

One-click install from the store listing — link will appear on [animevocab.com](https://animevocab.com).

### Early access (before store approval)

1. Sign in at **[animevocab.com/app](https://animevocab.com/app)** — step-by-step install guide with download link.
2. Or download [`animevocab-chrome-extension.zip`](https://animevocab.com/downloads/animevocab-chrome-extension.zip), unzip, open `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, select the unzipped folder.

See [`extension/README-INSTALL.md`](extension/README-INSTALL.md) for screenshots-level detail.

## Supported sources

| Source | How |
| --- | --- |
| **YouTube** | Reads the Japanese caption track while you display English subs |
| **HTML5 `<track>` sites** | Native subtitle cues |
| **Netflix, Crunchyroll, others** | **Listening Mode** — real-time transcription of tab audio |

## How it works

- **Tokenization** — [kuromoji.js](https://github.com/takuyaa/kuromoji.js) + bundled [JMdict](https://www.edrdg.org/jmdict/j_jmdict.html)-derived dictionary with frequency ranks
- **Word picking** — scores by frequency, difficulty band, and exposure; one card per line with cooldowns
- **Listening Mode** — OpenAI Realtime transcription; Pro subscription or your own API key
- **Privacy** — no analytics; progress stays on-device unless you opt into cloud sync ([PRIVACY.md](PRIVACY.md))

## Pro

The core loop is **free forever**. **Pro** covers hosted Listening Mode (no OpenAI key), usage metering, and cloud features. Backend: single Cloudflare Worker ([`backend/`](backend/README.md)).

## Development

TypeScript in `src/`; built output committed under `extension/` for load-unpacked installs.

```bash
npm install
npm run typecheck   # strict tsc
npm run build       # esbuild → extension/
npm run watch       # rebuild on change
npm run pack        # zip for Chrome Web Store / download hosting
npm run test:unit
```

```
src/           extension source (TypeScript)
  entries/     content, background, popup, options, dashboard, …
  lib/         tokenizer, dictionary, SRS, site adapters
extension/     manifest, icons, built bundles
web/           Next.js site + cloud app (animevocab.com)
backend/       Cloudflare Worker (licensing, sync API)
scripts/       dictionary builder
```

Store submission: [PUBLISHING.md](PUBLISHING.md)

## Contributing

Issues and PRs welcome — especially site adapters, tokenizer edge cases, and dictionary quality. Run `npm run typecheck && npm run build` before submitting.

## License

[AGPL-3.0](LICENSE) — free to use and modify; share alike if you distribute or run as a service. Commercial licensing: open an issue.

## Links

- **Website:** https://animevocab.com  
- **Cloud app:** https://animevocab.com/app  
- **Manga Studio:** https://animevocab.com/studio  
- **Sponsor:** https://github.com/sponsors/Atharva-Kanherkar  
