# feat/n5-full-course — Test Contract

Finishes the learnable N5 course for epic #173 on top of PR #180: the complete Your Lie in April path, audio, typed-answer feedback, a speaking tutor, and a guided lesson UI. Everything stays behind the existing private-preview flags and allowlist.

## Functional Behavior

### Content
- One authoring notation renders every Japanese string to both scripts. Kana uses spaced phrases (`わたしは コウセイです。`). Romaji uses ASCII wapuro-style spelling with pronounced particles (`watashi wa Kousei desu.`). The two renderings can't drift apart.
- The course is 24 lessons in the Your Lie in April track. Units 1–11 map to episodes 1–11, unit 12 is a study/checkpoint unit with no episode, units 13–23 map to episodes 12–22, and unit 24 is the season final with no episode. Every episode 1–22 is used exactly once.
- Each episode lesson has: a can-do goal, 8–12 vocabulary items, 1–2 grammar points with examples, a 4–6 line original model dialogue, a "listen for" hook, an original spoiler-bounded recap, an official source URL, 8 objective questions (vocabulary, grammar, reading and listening) and 2 typed tasks. Unit 12 has 12 objective questions and 2 typed tasks. Unit 24 has 20 objective questions and 3 typed tasks.
- Every objective question has exactly one correct choice, unique choice texts and an English explanation. Every typed task has at least one reference answer. Listening questions carry an audio clip and reveal their transcript only after completion.
- Explanations, prompts and meanings are English-only: no kana or kanji. No kanji appears anywhere in learner-facing Japanese.
- Content is labelled `unreviewed_preview`. Recaps are original summaries; no dialogue or synopsis text is copied.

### API (all under the existing `/v1/n5`, flag and allowlist unchanged)
- `GET /courses/n5-foundations` returns 24 units with lesson IDs, episode numbers, titles and kinds (`episode | study | final`).
- `GET /lessons/:lessonId` works for all 24 lessons. It returns only the selected script, never answer keys or references, and includes audio clip IDs, the dialogue and speaking goals. Unknown lessons return 404.
- `POST /attempts` accepts any of the 24 lessons. Attempts pin the lesson, content version and pack hash. The five-active-attempt bound applies per lesson.
- A completed attempt includes `review[]` with the correct choice, the learner's correctness, an explanation, the listening transcript and model answers, all in the attempt's script. An active attempt never includes `review`.
- `N5Result` adds per-skill counts (vocabulary, grammar, reading, listening) and `passed` (objective ≥ 80%). `mastery` stays `false`.
- `GET /me/progress` adds per-lesson status (`not_started | in_progress | practised | passed`), best score and the recommended next lesson.
- `GET /extension/state` points at the recommended next lesson, not a hard-coded episode 1.
- `POST /events` accepts any course episode ID for watch/practice observations.
- `GET /audio/:clipId` returns `audio/mpeg` for registered clips only. Audio is cached in KV by voice, model and text hash; a cache hit makes no provider call. Unknown clips return 404. A provider failure returns 503 `audio_unavailable` and caches nothing.
- `POST /attempts/:id/feedback` works on completed attempts only; otherwise it returns 409. Typed answers matching a reference loosely (case, spacing, punctuation, macrons, long-vowel spelling, `ha`/`wo`/`he` particle spellings, Kunrei spellings, katakana/hiragana folding) are marked `correct` with no provider call. Other answers get AI feedback: verdict, a correction in the attempt's script only and an English note. Corrections that fail script validation are dropped. Feedback is stored once per attempt and replays from storage. With AI disabled, failing, or over the daily limit, it returns deterministic fallback feedback with model answers and `source: "fallback"`, without persisting it, so a later retry can still get AI feedback.
- Conversations: `POST /conversations` starts a speaking session for a lesson (idempotent per key) with a scripted tutor opener. `POST /conversations/:id/turns` accepts `{audio(base64 webm/ogg/mp4/wav ≤ 30 s / 600 KB) | text, afterSeq, idempotencyKey}`. It transcribes the audio, asks the tutor model for a structured reply, validates the reply and correction in the selected script and stores both turns atomically. Replays return the stored turns. A stale `afterSeq` returns 409. The session caps at 10 learner turns. `GET /conversations/:id` and `GET /conversations/:id/turns/:seq/audio` (tutor turns only) are owner-only. `POST /conversations/:id/finish` scores task completion, target use and interaction 0–3 from server-stored turns, with evidence quotes. It reports `demonstrated` only when every dimension is ≥ 2 and at least 3 learner turns were spoken. Typed-only sessions are `practice_only`. A provider failure leaves the conversation active and returns 503.
- Kill switch and budgets: `N5_AI_ENABLED !== "1"` disables all provider calls (503 `ai_unavailable`; audio returns 503). Daily per-user limits apply through an atomic D1 counter: conversations 6, learner turns 60, feedback 30, audio misses 400. A limit returns 429 `daily_limit`. No secret, raw audio or typed answer is logged. Raw audio is never stored.
- Account deletion cascades conversations, turns, feedback and usage rows.

### Web
- Hub: script choice, a "continue" card for the recommended lesson, the 24-unit path with per-lesson status/score, checkpoint and final markers, and resume links.
- Lesson: a stepper Learn → Drill → Watch → Practice → Speak. Learn has flashcards with audio (normal and slow) and grammar with examples. Drill gives instant-feedback recognition rounds built from lesson vocabulary, with no network grading needed. Watch shows the hook, the provider link and the "I watched" button, then reveals the recap. Practice keeps the existing recoverable attempt flow with one question per screen, keyboard support and listening playback. Speak is the conversation tutor.
- Results: score, per-skill breakdown, pass/practice state, per-question review with explanations and transcripts, typed feedback (loaded after finishing, retryable), and the next-lesson link.
- Speak: hold-to-talk or tap-to-toggle recording with a visible timer and auto-stop at 30 s, tutor audio with slow replay, text fallback when the mic is denied or unsupported (labelled practice only), retries after a failed turn with the same key, and finish with rubric results.
- Japanese text appears only in the selected script. English is always available as a toggle for dialogue and tutor lines.
- The gateway passes binary audio through, bounded and only for audio routes, and allows larger JSON bodies only for conversation turns.

### Extension
- The extension state parser and focus panel accept any course lesson. The panel shows the recommended lesson's unit and episode.

## Unit Tests
- `text.test.ts`: kana/romaji rendering (particles, っ, ん before vowels/y, small kana, katakana and ー, names, punctuation), loose answer matching (accepts the listed variants, rejects different words) and the kana fold.
- `curriculum.test.ts`: 24 lessons, the episode mapping, per-lesson counts, one correct choice per question, unique choices, references present, English-only explanations and prompts, both renderings valid under `validScript`, unique clip IDs, listening clips distinct from vocabulary clips, no kanji, and objective IDs present.
- `domain.test.ts`: generalized validation and grading per lesson, skill counts, the pass threshold, and review payloads only after completion.
- `feedback.test.ts`: deterministic match, AI response parsing and validation, and fallback.
- `conversation.test.ts`: tutor reply validation in each script, rubric parsing, and status rules.
- Web: `core.test.ts` gateway routes (new allowlist and per-route body limits), drill generator, recorder state reducer, lesson progress helpers.
- Extension: `n5-pilot` parser accepts any lesson ID and full-width punctuation.

## Integration / Functional Tests (workerd + D1 + KV, mocked OpenAI via outbound service)
- All 24 lessons load in both scripts and leak no references.
- A lesson 5 attempt goes create → answer → finish → review → feedback; a feedback replay makes no second provider call.
- Audio returns mpeg; a second fetch is served from cache (provider called once); unknown clips 404; a provider failure gives 503 with nothing cached.
- Conversation: start → voice turn → text turn → replay → stale `afterSeq` 409 → finish. The 11th learner turn returns 409 `turn_limit`. The daily limit returns 429. Turns from another user return 404.
- `N5_AI_ENABLED` unset returns 503 `ai_unavailable` for AI routes, while lessons and attempts still work.
- Progress and the recommended lesson advance after passing unit 1. Extension state follows.
- Migration 0003 applies on top of 0001/0002 with existing data.
- `DELETE /me` cascades the new tables.

## Smoke Tests
- `npm run dev:n5`, then `GET /catalog` 200, `GET /lessons/<unit 3>?script=kana` 200.
- Web `npm run build` succeeds; `/app/n5` renders behind the flag.

## E2E Tests
- Web Playwright (`web/e2e/n5-course.mjs`), extended: hub → lesson 1 Learn (play audio, flip card) → Drill round → Watch → Practice (keyboard answers) → Results with review and typed feedback → Speak with a text turn and finish → hub shows passed status and recommends lesson 2. Both scripts. No mixed script in the owned DOM. The existing recovery journeys still pass.
- Extension Playwright (`e2e/n5-course.mjs`): the focus panel mounts for the recommended lesson.

## Fuzzing / Mutation
- Fuzz: renderer totality (any token sequence from the kana inventory renders a valid script in both forms), loose matching never throws and is symmetric with itself, and tutor reply sanitizer totality.
- Mutation: the existing backend gate (≥ 90%) extends to `text.ts` and the matching code; the web gate covers drill and recorder reducers.

## Manual / cURL Tests
With `npm run dev:n5` (mock provider):
```sh
curl -H 'Authorization: Bearer avc_st_n5local' "$U/v1/n5/courses/n5-foundations"            # 24 units
curl -H 'Authorization: Bearer avc_st_n5local' "$U/v1/n5/lessons/your-lie-in-april-u07?script=kana"
curl -H 'Authorization: Bearer avc_st_n5local' -o /tmp/a.mp3 -w '%{content_type}\n' "$U/v1/n5/audio/<clipId>"
```
Live provider verification (real TTS, transcription and tutor) needs `OPENAI_API_KEY`. It's recorded as not verified if no key is available.
