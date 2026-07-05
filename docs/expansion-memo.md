# Expansion memo: beyond English speakers learning Japanese (issue #19)

## Recommendation & timing

**Do not expand yet.** Hold the wedge — English speakers learning Japanese from anime — until it has paying users and a measurable install→Pro funnel (the #9 success target: credible path to $1K+ MRR). Expansion dilutes positioning and multiplies content/QA cost before the core loop has proven it converts.

**Revisit when** any of: (a) Pro MRR is growing month over month, (b) organic demand appears from a specific other pair (e.g. Japanese speakers learning English), or (c) the JP/anime niche visibly plateaus despite good conversion.

**First expansion to consider (when the time comes):** English *grammar/sentence-pattern* depth for the *same* audience (still EN→JP), not a new language pair. It reuses all infrastructure and deepens the existing wedge. A new source language (localized explanations) is second; a new target language (e.g. JP→EN) is a much larger lift and should be last.

## Code areas that assume an English-speaking learner

| Area | File | Assumption |
|---|---|---|
| Card UI label | `src/lib/overlay.ts:310` | Hardcoded `"English subtitle"` |
| AI coach prompts | `web/src/lib/ai-coach.ts` (buildPrompt) | Explanations return "beginner **English**"; anime-tutor system prompt is EN-output |
| Notebook AI summary | `web/src/lib/notebook-ai.ts` | Prompt/output English |
| Dictionary glosses | `extension/data/dictionary.json` (built by `scripts/build-dictionary.mjs`) | Glosses are English strings |
| "English context" cue capture | `src/lib/adapters/youtube.ts`, `generic.ts` | Treats the non-JP track as English for context |
| Document language | `web/src/app/layout.tsx:132` | `<html lang="en">` |
| All marketing copy | see below | English UI + "watch with English, learn Japanese" framing |

**What is NOT English-specific (reusable):** the tokenizer (kuromoji, Japanese-only by nature), SRS scheduling, scoring/eligibility, sync + notebooks + leaderboard infrastructure, and the Japanese-text detection (`hasJapanese`) + `language: "ja"` transcription param. The learner's *source language* is only assumed in three places that matter: the gloss language, the AI prompt output language, and UI copy.

## Marketing pages that would need localization

`web/src/app/page.tsx` (home), `/cloud`, `/learn-japanese-with-anime`, `/vs-migaku`, `/vs-language-reactor`, plus SEO metadata in `web/src/lib/seo.ts` and slides in `web/src/lib/slides.ts`. All are English prose selling a JP-from-anime story.

## Decision: language-direction switching now or later?

**Later.** Do not build a language-direction switcher now. Rationale:
- The tokenizer is Japanese-specific; a true JP→EN (or other-target) product needs a different morphological pipeline, not a config toggle.
- The cheapest real expansion (localized *explanations* for the same JP target) needs only: a `sourceLang` on the AI prompt + glosses per language + UI i18n — an additive change, not a direction switch.
- Building switching infrastructure now is speculative complexity against an unproven core.

**Cheapest path when we do expand explanations:** thread a `sourceLang` (default `"en"`) into the coach/summary prompts and the `"English subtitle"` label, and add localized gloss sets. The data model doesn't change. Estimated as a small, well-scoped change precisely because the assumptions are localized to the three places above.
