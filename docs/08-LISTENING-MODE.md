# 08 — v2: Listening Mode & Romaji-first (for learners who can't read Japanese yet)

## Why v1 was wrong for the actual user

v1 assumed the viewer watches with **Japanese subtitles displayed** and can read kana.
The real user is a **scratch beginner**: reads only roman letters, watches anime with
**English subs**, and learns through his **ears**. v1 would see English text, detect no
Japanese, and do nothing.

v2's premise: **the Japanese doesn't have to be on screen to be captured.**
The viewer keeps English subs; the extension gets the Japanese another way, and the
card teaches in romaji, anchored to the English line they just read and the audio
they just heard.

## The three Japanese-text sources (in priority order per site)

| Source | Sites | Cost | How |
|---|---|---|---|
| **Hidden caption track** | YouTube | free | MAIN-world script (`page/youtube-main.js`) reads `movie_player.getPlayerResponse().captions…captionTracks` and posts them to the content script, which fetches the `ja` track (`baseUrl` + `&fmt=json3`) — manual preferred over `asr` — plus an `en` track for context. Cues are synced to `video.currentTime` via `timeupdate`. The viewer's own caption setting is irrelevant. |
| **Hidden `<track>`** | any native HTML5 player | free | A `ja` text track set to `mode: "hidden"` still fires `cuechange`. The generic adapter hooks all tracks and pulls English context from any `en` track's active cues. |
| **Audio transcription** | Netflix, Crunchyroll, anything | ~$0.05–0.10/episode | Neither site exposes an unselected Japanese text track (Netflix downloads only the chosen track; Crunchyroll renders subs into canvas). So: `chrome.tabCapture` → offscreen document → 12 s audio chunks → OpenAI `/v1/audio/transcriptions` (`gpt-4o-mini-transcribe`, `language=ja`) → text into the same pipeline. English context comes from whatever subtitle is visible in the DOM (`adapter.getVisibleText()`). |

DOM-scraping of displayed Japanese subs (the whole of v1) survives as a fallback for
viewers who do display them.

## Romaji-first card

- `src/romaji.js`: deterministic kana→romaji (wapuro Hepburn: そう→`sou`, っち→`tchi`,
  ー doubles the previous vowel). Unit cases: たいくつ→taikutsu, ちょっと→chotto,
  こっち→kotchi, コーヒー→koohii, いっしょ→issho.
- `settings.displayScript`: `"romaji"` (default) | `"kana"` | `"kanji"` controls the
  card's big line; the other scripts appear as the secondary line.
- 🔊 button + `settings.autoSpeak` (default on): `speechSynthesis` with a `ja-JP`
  voice speaks the word — the beginner's anchor is sound, not script.
- Green "English subtitle" box shows the English line that was on screen for that
  moment; the "In this line" box shows the full sentence in romaji with the target
  highlighted, Japanese script beneath in small type.
- Popup/options word lists lead with romaji too.

## Listening-mode message protocol

```
popup    → background : {type:"avc-listen-start"|"avc-listen-stop"|"avc-listen-status", tabId}
background→offscreen  : {type:"avc-offscreen-start", streamId, tabId, key, model} | {type:"avc-offscreen-stop", tabId}
offscreen → background: {type:"avc-transcript", tabId, text} | {type:"avc-listen-error", tabId, code, detail}
background→ tab       : {type:"avc-transcript", text}   // content script (frame that owns the video) feeds pipeline
```

State: `chrome.storage.session.listeningTabs` (the SW can be torn down between
chunks; the offscreen document persists). Badge: `REC` red while capturing.
Stop on tab close via `tabs.onRemoved`.

## Offscreen capture rules (all mandatory)

1. `getUserMedia` with `chromeMediaSource: "tab"` + the streamId from
   `chrome.tabCapture.getMediaStreamId({targetTabId})` (user gesture = popup click).
2. Route captured audio back: `AudioContext` source → destination, else the tab
   goes **silent** for the viewer.
3. Fresh `MediaRecorder` per 12 s chunk (timeslice chunks after the first lack the
   webm header and are rejected by the API).
4. Skip blobs < 4 KB (silence); drop non-Japanese transcripts (music hallucinations).
5. 401 → surface "invalid key" and stop; 429 → keep capturing, drop chunk; other
   errors → drop chunk silently.

## Known limitations (accepted)

- Transcription cards appear 2–15 s after the line is spoken (chunk + API latency).
  The card carries the sentence + English context, so the moment is recoverable.
- Chunk boundaries can split a word; that word is simply missed that time.
- Netflix "English subtitle" context is whatever is on screen when the transcript
  arrives — it can be one line off from the transcribed audio.
- The tokenizer runs on transcribed text, so transcription errors propagate; the
  dictionary filter kills most nonsense words.
- `speechSynthesis` needs a Japanese voice installed; without one, pronunciation
  falls back to the OS default voice (romaji display still works).

## v2 acceptance tests

1. **YouTube, English subs displayed, ja track exists:** cards appear with romaji big,
   English context box filled from the en track. Console: `loaded N Japanese cues`.
2. **YouTube, captions off entirely:** same as (1) — cues come from the hidden track.
3. **Options → OpenAI key set, Netflix, English subs, popup → Start Listening Mode:**
   badge `REC`, tab audio still audible, first card within ~30 s of dialogue,
   card shows `🎧 heard just now`, English context from the visible sub.
4. **Crunchyroll:** same as (3) (content script must run in the player iframe).
5. **Stop Listening Mode / close tab:** capture stops (no more OpenAI requests).
6. **No key set → Start:** inline popup error, nothing breaks.
7. **Wrong key:** badge `ERR`, capture stops, no crash loop.
8. `node --check` passes on every JS file; romaji unit cases above all pass.
