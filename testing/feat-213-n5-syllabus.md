# feat/213-n5-syllabus: Test Contract

Source of truth for #213. Written before implementation; locked for the life of the branch.

## Functional Behavior

- `backend/src/n5/syllabus/words.json` holds the N5 vocabulary pool.
  - 750-850 entries.
  - Entry shape: `{ id, src, meaning, pos, band, tags }`, `band` 1-4, `tags` a non-empty string array.
  - `src` uses the `text.ts` notation (kana with `_` between words, `^` only for names, a leading `'` for a lexical word that looks like a particle, katakana for loanwords) and must pass `render()`.
  - `id` is `slug(render(src).romaji)`.
  - Existing curriculum vocabulary keeps its current id. The real count is 230 unique ids, not 242 (242 counted repeated vocabulary rows inside units).
  - Seeded words take their part of speech from the reviewed `seed-pos.json`, not from a topic keyword.
  - Entries that share a reading merge their senses instead of dropping all but the first.
  - Two source glosses are corrected explicitly: はんぶん = half, せっけん = soap.
- `backend/src/n5/syllabus/grammar.json` holds the N5 grammar pool.
  - 70-90 entries.
  - Entry shape: `{ id, title, pattern, explanation, prerequisites, band }`.
  - All 48 existing grammar ids (`u01-g1` ... `u24-g2`) are preserved byte-for-byte.
  - Every prerequisite id exists and has a strictly lower band.
- Course envelope: 24 units. Each unit targets 25 new words (20-25 allowed) and 3-4 grammar points.
  - 24 x 25 = 600 words can be taught. The pool is larger than that, so the tail is marked `reserve: true` and is not assigned. Reserve is a documented pool for a future longer course, not silently dropped content.
  - Every non-reserve word is assigned to exactly one unit.
  - Every grammar point is assigned to exactly one unit.
- `backend/src/n5/syllabus/plan.ts` exports:
  - `UNIT_COUNT = 24`.
  - `unitTargets(unit)` returning `{ words: WordId[25], grammar: GrammarId[3..4] }`, deterministic for a given unit.
  - `syllabusBlock()` returning one byte-stable string: role + notation rules + the full glossary, no dates, versions, user ids or unit numbers. This is the prompt-cache prefix.
- The reviewed Your Lie in April units are not re-planned. The planner exists for generated tracks.

## Unit Tests

- `words.test.ts`
  - `renders both scripts`: every `src` passes `render()`.
  - `ids are unique`: `Set(ids).size === words.length`.
  - `id matches src`: every id equals `slug(render(src).romaji)`.
  - `bands and tags are valid`: band 1-4, tags non-empty.
  - `keeps the seeded ids`: the 230 current ids are all present with their current `src`.
- `grammar.test.ts`
  - `ids are unique`.
  - `prerequisites exist and come from an earlier band`.
  - `keeps the seeded ids`: the 48 current ids are present with unchanged titles and unchanged explanations, including `...` patterns.
- `plan.test.ts`
  - `covers every course word exactly once`: 600 assignments, no repeats.
  - `every unit has 25 words`.
  - `covers every grammar point exactly once`, 3-4 per unit.
  - `grammar bands never regress across units`.
  - `is deterministic`: two calls return deep-equal results.
  - `reserve words are never assigned`.
  - `syllabusBlock is stable`: same hash on two calls and across a fresh module import.
  - `syllabusBlock has no volatile values`: no ISO date, version string, user id or unit number.
- Snapshot: existing ids and `src` values are pinned in a fixture, so a regeneration cannot silently rename them.

## Integration / Functional Tests

- `npm test` in `backend/` passes, including the existing N5 curriculum suite.
- `npm run typecheck` in `backend/` passes.
- Importing `plan.ts` from a Worker context does not touch the network or D1.

## Smoke Tests

- `node -e` import of `words.json` and `grammar.json` fails on invalid JSON (CI parse).
- `unitTargets(1)` and `unitTargets(24)` return disjoint word sets.

## E2E Tests

N/A. This change adds data and a pure planner; no route or UI changes. E2E is Phase 1+.

## Manual / cURL Tests

```bash
cd backend
npx vitest run src/n5/syllabus
npx tsc --noEmit
node -e "const w=require('./src/n5/syllabus/words.json'); console.log(w.length, w.filter(x=>x.reserve).length)"
```

Expected: 750-850 words, 151 reserve, 600 assigned.

## Out of Scope

- D1 migration, generation, search, episode profiles.
- Changing the reviewed Your Lie in April units.
