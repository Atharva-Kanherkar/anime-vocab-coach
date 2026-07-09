# Manga reel renderer

Turns manga panels + a narration script into a finished 9:16 Instagram reel
(1080×1920, 30fps): title card → panels with Ken Burns motion and caption
plates → branded end card, with optional AI narration timed per scene.

Built for the daily pipeline: **manga storytelling, theory explainers
(Demon Slayer etc.), Studio showcases** — anything that is "panels + a story".

## Render a reel

```bash
cd reels
npm install                       # first time
npx remotion render MangaReel out/demo.mp4                       # demo spec
npx remotion render MangaReel out/my-reel.mp4 --props=specs/my-reel.json
npm run studio                    # live preview while tweaking a spec
```

## Make a new reel (the daily loop)

1. **Panels** — drop images into `public/<slug>/`. Sources:
   - Manga Studio output (`/api/studio/<id>/panel/<n>` or exported images)
   - your card art / gallery chapters
   - existing manga pages for theory content (see legal note below)
2. **Spec** — copy `specs/demo.json`, write one caption per panel. Fields per
   scene: `image`, `text`, optional `zoom` ("in"/"out"), `focus`
   ("top"/"center"/"bottom" — where a tall page gets cropped), `seconds`.
   Top-level: `title` (hook line), `series` (chip, e.g. "DEMON SLAYER
   THEORY"), `credit`, `handle`, `accent`, optional `music`.
3. **Narration (optional but worth it)** —
   `OPENAI_API_KEY=sk-... npm run tts -- specs/my-reel.json onyx`
   generates one mp3 per scene and writes the paths into the spec; each scene
   then lasts exactly as long as its narration. Without audio, scene length
   falls back to reading speed.
4. **Render** — `npx remotion render MangaReel out/my-reel.mp4 --props=specs/my-reel.json`

Five reels ≈ five spec files and one render loop:

```bash
for s in specs/batch/*.json; do
  npx remotion render MangaReel "out/$(basename "$s" .json).mp4" --props="$s"
done
```

## Music

Prefer adding music **inside the Instagram app** from its licensed library —
tracks baked into the file are what trigger audio mutes on business accounts.
The `music` spec field exists for ambient beds you own the rights to.

## Using existing manga (theory reels)

Commentary/theory content built on a handful of panels is the established
format, but it is still copyrighted material used without a license — fair-use
adjacent, not fair-use guaranteed. Keep the risk low:

- few panels per reel, transformative framing (your theory is the content),
  always name the series/author in `credit`
- never full pages in sequence (that's redistribution, and it's what rights
  holders actually enforce on)
- expect the occasional takedown on a business account; don't build the whole
  channel on one publisher's IP. Mix in Studio-made reels — those are 100%
  yours and demo the product.

## Tweaking the look

Everything visual lives in `src/MangaReel.tsx` (paper background, panel frame
and tilt, caption plate, title/end cards) and timing constants in
`src/spec.ts`. It's plain React — change once, every future reel inherits it.
