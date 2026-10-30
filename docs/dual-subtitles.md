# Dual subtitles

The Subtitle Lens is now **dual subtitles**: the current line in romaji (or kana, or as written) with English under it, floated above the player. Everything the Lens did still works: hover a word to look it up, click or press Q/K/X to save it, English words link back to the word they translate.

Why: Netflix in Japan has no English track for most anime, and the Lens showed the Japanese line in kanji, which a beginner can't read.

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
