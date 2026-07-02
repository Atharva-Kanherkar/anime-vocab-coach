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

## Japanese-text sources — TESTED, with results

| Source | Sites | Status (tested 2026-07-03, real browser) |
|---|---|---|
| **Audio transcription (Realtime)** | YouTube, Netflix, Crunchyroll, anything | ✅ **PRIMARY.** `chrome.tabCapture` → offscreen document → PCM16/24k streamed over a WebSocket to OpenAI's GA Realtime transcription API (`wss://api.openai.com/v1/realtime?intent=transcription`) → `.completed` transcripts into the pipeline. Transcript arrives ~1–2 s after a line is spoken. Verified live: returned 「こんな退屈な毎日は、もう嫌だ。」 |
| **Hidden `<track>`** | native HTML5 players | ✅ Works. A `ja` track set to `mode:"hidden"` still fires `cuechange`. Verified: local page → card for 学校 rendered in-browser. |
| **DOM scrape of displayed subs** | YouTube, Netflix | ⚠️ Works only if the viewer *displays* Japanese subs (defeats the beginner use case, but kept as a fallback). |
| **Hidden YouTube caption track** | YouTube | ❌ **DEAD.** `getPlayerResponse().captions` still lists the `ja` track, but fetching its `baseUrl` (even `&fmt=json3`) now returns an **empty 200 body** — YouTube requires a Proof-of-Origin token a content script can't mint. Confirmed inside the loaded extension. The MAIN-world `page/youtube-main.js` + fetch machinery is kept but self-disables on the empty body. |

**Conclusion: audio transcription is the one mechanism that works for the target user
on every site.** On YouTube you no longer get a free ride — Listening Mode is the path
there too (or turn on Japanese captions to read them from the DOM).

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
                         (retried until the offscreen doc acks — it loads AFTER createDocument resolves)
offscreen → background: {type:"avc-transcript", tabId, text} | {type:"avc-offscreen-log", line} | {type:"avc-listen-error", tabId, code, detail}
background→ tab       : {type:"avc-transcript", text}   // content script (frame that owns the video) feeds pipeline
```

State: `chrome.storage.session.listeningTabs` (the SW can be torn down mid-session;
the offscreen document persists). Badge: `REC` red while capturing. Stop on tab close
via `tabs.onRemoved`. Every offscreen step is mirrored to the SW console as
`[AVC-audio] …` because the offscreen console is not inspectable.

## Offscreen capture rules (all mandatory) — GA Realtime streaming

1. `getUserMedia` with `chromeMediaSource: "tab"` + the streamId from
   `chrome.tabCapture.getMediaStreamId({targetTabId})` (user gesture = popup click).
2. Route captured audio back to speakers: `source → ctx.destination`, else the tab
   goes **silent** for the viewer.
3. Tap the same source through a `ScriptProcessorNode` → muted `GainNode` →
   destination (keeps it processing without doubling audio). In `onaudioprocess`,
   downsample to 24 kHz, convert Float32 → Int16, base64, and
   `input_audio_buffer.append`.
4. WebSocket: `wss://api.openai.com/v1/realtime?intent=transcription`, subprotocols
   `["realtime", "openai-insecure-api-key." + key]` (the beta subprotocol
   `openai-beta.realtime-v1` is REJECTED — GA only). On `session.created` send
   `session.update` with `session.type:"transcription"`, `audio.input.format
   {type:"audio/pcm", rate:24000}`, `transcription {model, language:"ja"}`,
   `turn_detection {type:"server_vad"}`. Gate audio sends on `session.updated`.
5. Read `conversation.item.input_audio_transcription.completed.transcript`; drop
   non-Japanese. Auth errors → `invalid-key` + stop; otherwise reconnect up to 3×.

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
