# Dual subtitles

The Subtitle Lens is now **dual subtitles**: the current line in romaji (or kana, or as written) with English under it, floated above the player. Everything the Lens did still works: hover a word to look it up, click or press Q/K/X to save it, English words link back to the word they translate.

Why: Netflix in Japan has no English track for most anime, and the Lens showed the Japanese line in kanji, which a beginner can't read.

## On Netflix: the player's own tracks

On Netflix, dual subtitles no longer read whatever line the player has on screen. `page/netflix-main.js` runs at `document_start` in the page and reads the player's manifest as it parses it (`JSON.parse` and `Response.json`, observed only, never changed). The manifest lists every subtitle language licensed in the learner's region. The page script downloads the **Japanese track** and, when the region has one, the **English track**, using the same request the player makes when the learner picks a language. Nothing is redistributed.

- **Timing**: `content.ts` puts up the cue the video is at, every frame (`cueAt`, 50 ms lead). It takes the line down at the cue's end. In e2e every line appears within ±8 ms of its cue, and its English appears in the same frame.
- **English track in the region**: the official English is paired with each Japanese cue by overlap (`englishFor`), and no translation runs at all.
- **No English track (Netflix in Japan)**: `EpisodeSubs` translates the whole episode ahead through `POST /api/ai/translate-batch`, 20 lines a chunk, 4 at a time. The chunk playing now goes first, then what follows, and a seek reorders the queue. Chunks are cut at fixed places in the track, so every learner watching the episode shares the cache. The batch also returns the episode's names with their readings.
- **Readings**: furigana in the track (official) and the batch's names fix the romaji of names the tokenizer misreads (宮園 → Miyazono, 公生 → Kousei), including names it splits into several tokens.
- **Course, cards, Listening**: track lines feed the same pipeline as before, so course words light up without Listening. Audio transcripts are ignored while a track is driving, because the track already has the lines, exactly timed.
- **Netflix's own subtitles** are hidden while ours show the same lines, and ours sit where they were.

### Netflix as it is now (learned from asbplayer)

- **Track URLs from the player.** Netflix no longer puts every language's URL in the manifest. A language listed without a URL is read from the player's state, the same way asbplayer does it: `netflix.appContext…getVideoPlayerBySessionId(…).getTimedTextTrackList()`, plus objects of type `timedtext` in the session state. If the player hasn't fetched that language yet, it is selected for a moment so it does, then the learner's own choice is restored. Japanese is shown as soon as it is there; English found later replaces the translation in place.
- **The player's clock.** Cues are timed on content time. The page script posts `player.getCurrentTime()` next to `video.currentTime` four times a second, and the median difference corrects the clock. That difference is non-zero when the element's timeline also counts ad breaks. While the player's clock stands still and the video keeps running (an ad), no subtitle is shown.
- **One source at a time.** While a track drives, the page's subtitle text and the audio are not used for subtitles. While the page shows its own Japanese subtitles, heard lines go only to the cards; they used to take over the same subtitle line late, which read as "not timed at all".
- **Diagnostics.** The popup's Dual subtitles row says what is driving them ("Netflix's Japanese track · English translated · matches Netflix 41/41"). When Netflix's own Japanese line is in the page, each one is checked against the track line we showed. "Copy subtitle details" (More options) copies this for a bug report.

Anywhere else, or on a title whose Japanese subtitles are images, the per-line path below still applies.

## Where each half comes from

- **Japanese line**: kuromoji, locally, in about 70 ms (`src/lib/dual-line.ts`). Words are grouped the way learners read them: "tabete imasu", "yonda", "Kaori-chan", particle は as "wa". The script follows the course while Listening follows a lesson. Otherwise it follows Settings → "Japanese is written as" (romaji by default, kana, or the original).
- **English line**: the page's own subtitle when it is in English. Otherwise `POST /api/ai/translate` on animevocab.com (`web/src/lib/subs-translate.ts`), which uses a fast model with reasoning off and sends the three previous lines as context. It returns the English plus corrected kana readings for kanji words (names especially: 公生 → こうせい, not きみお). These are painted into the line in place when they arrive.

## Latency

- Every line is translated once for everyone: a shared KV cache by show + line, kept for a year.
- Each tab remembers the last 400 lines, so a rewind is instant and makes no request.
- A Listening transcript that arrives ahead of its moment (cached episodes) is translated right away, so its English is ready when the line is due.
- With a 250 ms server, e2e measures romaji at about 70 ms and English at about 410 ms after the subtitle changes.

## Limits

The `subs` meter counts cache misses only: free 20,000 lines a month, Pro 60,000, Max 150,000 (one episode is about 300 lines). A KV hiccup fails open. When the limit is reached the romaji keeps working and the learner is told once. 

## Model and server latency

The default is `gpt-4.1-mini` (`AI_SUBS_MODEL` overrides it), not the coach model. Production telemetry for gpt-5.6-luna with reasoning off showed 1.1–2.6 s per line (median 1.5 s). With the extension hop and server writes on top, the English often arrived after Netflix had moved on, so the learner saw only a placeholder. The route now waits on nothing but the model: the quota is read in parallel, and the usage count and shared cache are written after the response (`afterResponse`, Workers `waitUntil`).

## Look

The subtitles look like the player's own: white text with a dark outline, no box, no colour marks on words, and hovering a word lights it up. There is no placeholder while the English is on its way; it fades in when it lands.

## Fixed on the way

A line heard by Listening used to take the page's visible subtitle as its "English" even when that subtitle was the same Japanese line. Now it only uses a subtitle in the other language.

## Tests

`npm run test:e2e:dual-subs` covers a Netflix-shaped player with Japanese subtitles and no English track: romaji timing, English and reading correction, hover/save, context, rewind from memory, an early Listening line, kana, and the used-up limit. The unit tests are `test/dual-line.test.ts` (real kuromoji), `test/subs-client.test.ts` and `web/src/lib/subs-translate.test.ts`.
