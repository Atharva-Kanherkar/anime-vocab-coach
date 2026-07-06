# Collectible card art — generation spec

The cloud app ships a collectible card system (`web/src/lib/cards.ts`): practice
earns XP → levels (1–50, rank titles 見習い → 伝説) → cards unlock. Cards render
as typographic placeholders until real art lands. This doc is the spec for
generating that art with AI.

## Set plan

- **100 cards total**: 60 N · 25 R · 10 SR · 4 SSR · 1 UR.
- Unlock pacing: ~2 cards per level through the early game, thinning out to 1
  every few levels late. The shipped 24-card manifest covers levels 1–40;
  the remaining 76 slot in between when art is ready.
- Every character is **original** (archetypes, not licensed characters) so we
  never touch anyone's IP. Names/epithets live in the manifest.

## Image spec

- **Aspect 5:7 portrait** (the card frame is `aspect-ratio: 5/7`).
  Generate at 1000×1400 or SDXL-native 832×1216 and center-crop.
- PNG, sRGB. Art fills the full frame (the UI overlays the name bar and
  epithet footer on top, so keep the top ~12% and bottom ~18% low-detail).
- One character per card, bust or 3/4 shot, facing slightly left or right
  (vary per card), flat background motif matching the character's kanji.

## Style prompt (keep constant across ALL cards for set coherence)

> flat riso print illustration of [CHARACTER DESC], anime style, limited
> palette: cream paper #f5efe0, vermillion #d84e2a, indigo #2c4a68, warm black
> ink, screen-print texture, bold clean linework, minimal shading, japanese
> graphic design poster, no gradients, no text, no logo

Rarity differentiation happens per-prompt:
- **N**: single ink + cream (mostly indigo OR vermillion).
- **R**: both inks.
- **SR**: both inks + heavier pattern work (stripes, halftone).
- **SSR**: full palette + dramatic composition (wind, motion, night sky).
- **UR**: inverted — ink-black paper, cream + vermillion character.

Consistency tips: fix one seed family per rarity tier; generate 4 candidates
per card and keep the most on-palette one; reject anything with gradients,
photo texture, or text artifacts.

## Wiring art into the app

1. Drop files in `web/public/cards/<id>.png` — `<id>` matches `CardDef.id`
   in `web/src/lib/cards.ts` (e.g. `web/public/cards/kitsune.png`).
2. Set `art: "/cards/kitsune.png"` on that card's manifest entry.
3. The card component renders the image when `art` is set and falls back to
   the typographic placeholder when it isn't — so the set can land
   incrementally.

## XP model (already live)

`xp = words×12 + judged reviews×6 + watch minutes×3 + longest streak×25`,
cumulative threshold `40·n·(n−1)` to reach level n, capped at 50.
