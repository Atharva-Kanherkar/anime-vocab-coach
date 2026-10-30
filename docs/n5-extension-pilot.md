# N5 course in the extension: Listening follows the lesson

The extension has one way in: **Start Listening**. When the linked account has an N5 course lesson, Listening follows it. There is no separate course page, no course-focus mode and no episode confirmation. animevocab.com is the source of truth: it owns enrolment, the script (romaji or kana), the current unit, practice and grading. The extension reads the lesson from the account and writes back what it learns while listening.

## What the learner sees

1. On animevocab.com, the lesson's **Watch** step links to the episode and says to press Start Listening.
2. In the popup, **Start Listening** starts Listening and the copilot. A card under it names the unit Listening follows. Subtitle Lens, automatic cards and separate Listening/Copilot controls are under **More options**.
3. The copilot shows the unit's words in the learner's script. When one is spoken it lights up, the line appears with **Explain this line**, and the word is saved to the account. The Watch step on the website shows the same words as heard.
4. Every copilot question (typed, Explain, Memory hooks) carries the unit, its goal, its words and the script. The tutor answers at N5 level and writes Japanese only in that script (`courseInstructions` in `web/src/lib/ai-coach.ts`).
5. **Finish episode N · practise** pauses the video, stops Listening on the tab, records the episode as watched and opens the lesson's practice step on animevocab.com.

English learners (`ja-en`) never follow a course lesson.

## How it fits together

- `GET /v1/n5/extension/state` returns the next unfinished episode lesson. Each word now carries `kana` (plain kana, whatever the script) for matching, and `heard` lists word ids already heard.
- `POST /v1/n5/heard {lessonId, wordIds}` records heard words in `n5_heard` (migration `0004_n5_heard.sql`). Only word ids are stored, never dialogue. `/me/progress` returns `heard` per lesson; `/me/export` includes it; account deletion cascades.
- `src/lib/course-listening.ts` validates the lesson and matches words against kuromoji readings: a run of whole tokens must spell the word, or a token's dictionary form must read as it (弾いて → ひく).
- `src/lib/n5-service.ts` (background) caches the lesson for 10 minutes per credential, refreshes when Listening starts or when an animevocab.com course page announces a change, and keeps an outbox for heard words and watch receipts that survives worker restarts and outages. Another account's outbox is never sent.
- `src/entries/content.ts` asks for the lesson when Listening starts, when the copilot opens and on the first line; every heard or captioned line is matched; the Lens stays off while a lesson is followed.

## Release

1. `npx wrangler d1 migrations apply avc-n5 --remote` (adds `n5_heard`), then deploy `avc-api`.
2. Deploy the web app.
3. Bump `extension/manifest.json`, `npm run pack`, upload `dist/anime-vocab-coach.zip`.

Older extension builds keep working against the new API: the new fields are optional.

## Verification

```sh
npm run typecheck && npm run test:unit && npm run test:n5:fuzz
npm run build && npm run test:e2e:n5           # real extension + real Worker/D1
cd backend && npm test && npm run test:e2e && npm run contracts:n5:check
cd web && npx vitest run && npm run test:e2e:n5 # Next gateway + Worker, Watch step shows heard words
```
