# N5 syllabus sources

`words.json` and `grammar.json` are built by `backend/scripts/build-n5-syllabus.mjs`.
The script is deterministic; re-running it on the pinned inputs must reproduce the
same files.

## 1. Reviewed curriculum (ids are frozen)

The 230 unique vocabulary entries and 48 grammar points in
`backend/src/n5/curriculum.ts` seed the pool. Their ids are the contract with
`n5_heard`, saved attempts and the extension's heard chips, so the builder copies
them verbatim:

- vocabulary id: `slug(render(src).romaji)`, the same rule as `course.ts`
- grammar id: `u<unit>-g<n>`, the same rule as `course.ts`

The parent issue said 242 words. That counted repeated vocabulary rows inside the
24 units; the real number of unique ids is 230. The snapshot test asserts all 230.

## 2. OpenJLPT N5 vocabulary

- Source: https://github.com/evanclan/OpenJLPT
- Pinned commit: `0d1d3410bec90bd4098a7c72de820543cb4f707c`
- File: `data/json/vocab/n5.json`
- Licence: CC BY-SA 4.0. The dataset is derived from JMdict/JMnedict and Tatoeba;
  see the repository's NOTICE and LICENSE.
- Fields used: `reading` (kana), `meanings[0]` (English), `pos` (JMdict tags).
- Transformations: katakana readings are kept as-is; hiragana readings are kept;
  readings already present in the curriculum are skipped; duplicate readings are
  collapsed; particles (`prt`) are excluded because they belong in `grammar.json`.
- 511 entries were added after deduplication.

Parts of speech are mapped from JMdict tags to:
`noun`, `verb`, `i-adjective`, `na-adjective`, `adjective`, `adverb`, `pronoun`,
`numeral`, `counter`, `conjunction`, `expression`.

## 3. Curated greetings

Ten N5 greetings absent from the external list are written by hand in the builder
(`CURATED`): おやすみ, おやすみなさい, おかえりなさい, いってきます,
いってらっしゃい, ただいま, おげんきですか, おめでとう, がんばって,
いらっしゃいませ. They are ordinary expressions, not lines from a show.

## 4. Grammar additions

32 N5 grammar points are authored in the builder (`grammarAdded`). They cover
particles, counters, existence, the て-form family, conditionals, quotation and
advice. Prerequisites only point to an earlier band, which the test enforces.

## 5. Why 600 taught and 151 reserved

The course is 24 units at 25 new words: 600 slots. The pool is 751, so 151 words
cannot be taught without raising the per-unit density. They are marked
`reserve: true` and excluded by the planner.

This is the honest resolution of a contradiction in #192: "~800 words" and
"20-25 words per unit over 24 units" cannot both be true (24 x 25 = 600). The
reserve is a documented pool for a later longer course or for SRS-only introduction,
not content that was silently dropped.

Reserve selection is deterministic and provisional: the longest specific nouns are
reserved, a short allowlist of common nouns is kept, and the rule should be revisited
when episode-frequency data exists (Phase 4). It is a placement heuristic, not a
claim that reserve words are unimportant.

## Regenerating

```bash
cd backend
node scripts/build-n5-syllabus.mjs
npx vitest run src/n5/syllabus
```

The builder needs network access to the pinned raw URL. Tests never fetch anything.
