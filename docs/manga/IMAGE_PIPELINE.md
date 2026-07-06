# Manga panel generation — gpt-image-2 pipeline notes

Research for `scripts/generate-manga.mjs`. Sources: OpenAI image-generation guide,
gpt-image models prompting guide (cookbook), gpt-image-2 model docs.

## Model & params
- Model: `gpt-image-2` (as required; repo already uses it for card art).
- Sizes: `1024x1024`, `1536x1024` (landscape), `1024x1536` (portrait). Use
  **1024x1536 portrait** for tall single panels / manga pages; **1536x1024**
  for wide establishing shots.
- `quality`: `high` (shipping art with dense linework). `medium` acceptable for
  drafts to save cost.
- `output_format`: `png` from API → downscale to `webp` with cwebp (same as
  card pipeline, ~50KB/panel).
- `moderation`: `low`.

## The big decision: BAKE THE ART, OVERLAY THE TEXT
gpt-image-2 renders **Latin** text well (token-aware grounding, legible to ~24px,
understands "first line says X"). But:
- Japanese kanji/kana text baked into images is unreliable.
- Baked text CANNOT be toggled between JA / EN / romaji — and the trilingual
  toggle is the core learning feature.

So: **prompt the model to draw panels with EMPTY, well-placed speech balloons**
(and empty caption boxes), and render all dialogue as real HTML/SVG text in the
reader UI, positioned over the balloons. This gives:
- Perfect legibility in all three languages.
- Instant JA↔EN↔romaji switching (the product's whole point).
- No gpt-image Japanese-text garble.

Baked text is allowed ONLY for short dramatic **sound effects / onomatopoeia**
(e.g. ドン, バン, ゴゴゴ) as art flavor — short, stylized, no comprehension needed.

## Character consistency (avoid AI slop / drift)
Use the **image edits** endpoint (`/v1/images/edits`) with each debuting
character's existing **card art** (`web/public/cards/<id>.webp`) passed as
reference image(s). Instruct: "Same character(s), new scene + action; do NOT
redesign; preserve face, hair, outfit, palette." gpt-image supports multiple
reference images per edit — pass the 1–3 characters featured in a panel.

CONFIRMED: `/v1/images/edits` is `multipart/form-data` and accepts up to **16**
reference images for gpt-image models via repeated `image[]=@file` fields, plus
`prompt`, `model`, `size`, `quality`, `output_format`. This is how we compose a
new scene from several on-model card portraits.
Panels where a character debuts should visibly match their card.

## Prompt shape per panel (fed from STORY_BIBLE panel descriptions)
1. Constant manga style block (B&W or duotone screentone manga aesthetic,
   consistent across the saga for coherence — decide 1 look).
2. Panel beat: concrete, action-focused single moment.
3. Characters present (+ "match reference art").
4. Composition (framing, camera, mood), real-location setting cues.
5. "Leave N empty speech balloons at <positions> for text overlay; no text
   inside them" + optional baked SFX in quotes.
6. Layout: single panel per image (UI composes multi-panel pages) OR a fixed
   grid ("4 equal panels, top-to-bottom") — TBD after bible lands.

## Batching / rate limits (script requirements)
- Reuse card generator's worker-pool + retry (429/5xx exponential backoff),
  `--concurrency` (default 2), `--only`, `--force`, `--dry-run`, `--limit`.
- Read `OPENAI_API_KEY` from env ONLY — never commit the key.
- Save PNG → webp → register in a `manga-art.ts` map (id → path), like
  `cards-art.ts`.
- Log prompts to `web/public/manga/prompts.json` for reproducibility.
