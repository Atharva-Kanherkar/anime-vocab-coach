# feat/p3-landing-product-seo — Test Contract

Closes #117 (product visual above the fold) and #115 (all 13 hero slides as
crawlable HTML) in one PR.

> Revision 2 (added mid-implementation, committed separately per skill rule):
> new **horizontal demo strip** section below the hero — one full-width
> animated/interactive demo panel per feature, scrolled sideways.

## Functional Behavior

### Demo strip (revision 2)
- A new section below the hero (`#demo`) renders a horizontally scrollable
  strip of feature demos: **Capture**, **Listening Mode**, **AI coach**,
  **Reviews (SRS)**, **Collect (XP/cards)** — one panel each, scroll-snap,
  swipeable/trackpad-scrollable, prev/next buttons.
- Each panel pairs feature copy (kicker + h3 + body + CTA link) with a demo
  stage built from real HTML (no screenshots), so the strip is also
  crawlable content.
- Animation is on by default; `prefers-reduced-motion: reduce` disables the
  looping/entrance animations (states stay readable).
- Interactivity:
  - Capture: replay button remounts the loop; subtitle words highlight on
    hover.
  - Listening: play/pause toggle actually pauses the waveform + transcript
    reveal (`animation-play-state`).
  - Coach: question chips swap the Q&A pair; answer streams word-by-word.
  - Reviews: click the card to flip (3D flip); Next cycles 3 cards with
    per-card next-review intervals.
  - Collect: "Collect" button replays the XP-fill → level-pop → card-reveal
    sequence.
- No new dependencies; no binary assets; all copy real text.

### #115 — Crawlable hero slides
- Fetching `/` with no JS (curl / Googlebot) shows the text of **all 13**
  `heroSlides` in the served HTML: title and body of every slide, including
  pricing and FAQ copy. Previously only slide 1's title/body shipped.
- Every slide title is a real heading: slide 1 uses `h1`, slides 2–13 use `h2`.
- Each slide body is addressable: `id="slide-{id}"` (e.g. `#slide-pricing`
  exists in the HTML, matching the `ctaHref` anchors already in slides.ts).
- Inactive slides are hidden **with CSS** (opacity/visibility/inert), not by
  not-rendering — the DOM always contains all 13.
- The interactive scroll-driven slider behavior is unchanged: scroll progress
  still selects the active slide, crossfade backgrounds still work, click
  sounds still play, slide CTAs with `#slide-*` hrefs still scroll to that
  slide.
- Keyboard/screen-reader: only the active slide is in the a11y tree
  (inert + aria-hidden on inactive ones); links inside inactive slides are not
  tabbable.
- Hydration: server and client both start with index 0 → no mismatch.

### #117 — Product visual above the fold
- The first slide shows a full-screen HTML/CSS mockup of the product in use
  (anime scene + highlighted subtitle word + floating word card + copilot
  side panel with AI coach chat), visible **without scrolling**.
- Desktop (≥769px): split layout — headline/CTA left, product shot right.
- Mobile (≤768px): headline on top, compact product shot below it — still in
  the first viewport (above the fold).
- The mockup is built from real HTML text (no screenshots), so its words
  (退屈 / taikutsu / "boredom", the subtitle line, the coach answer) are
  crawlable content that explains how the product works.
- The mockup scene uses an existing site art asset (`/public/slides/*`) — no
  new binary assets, no third-party/copyrighted imagery.

## Unit Tests
- `hero-render.test.tsx` (vitest, react-dom/server):
  - `FxSlider SSR renders all 13 slide titles` — every `heroSlides[i].title`
    appears in the static markup.
  - `FxSlider SSR renders slide bodies` — slide bodies (e.g. the Listening
    Mode line, the pricing fineprint link, FAQ questions) appear in markup.
  - `first slide title is the only h1` — exactly one `h1`, rest `h2`.
  - `slides are addressable by id` — `id="slide-pricing"` and `id="slide-faq"`
    present.
  - `only the first slide is marked active server-side` — one `is-active`
    body.
  - `product shot renders real product text` — mockup contains the demo word
    (退屈), romaji (taikutsu), gloss (boredom), and the scene `<img>` with alt.
- `demo-strip.test.tsx` (revision 2):
  - All 5 demo panels render their h3 + body copy in SSR HTML.
  - Demo words (退屈, taikutsu, mabushii) and the review card copy ship in
    HTML.
  - The section carries `id="demo"` and the play/pause + flip affordances
    exist in markup (buttons, not fake spans).
- Existing `slides.test.ts`-style invariants still hold (13 slides, unique ids).

## Integration / Functional Tests
- `npm run test:unit` (web) passes with the new test file added to the
  `src/**/*.test.{ts,tsx}` glob.
- `npx tsc --noEmit` passes in web/.
- `npx eslint` passes in web/ (no new errors).
- `next build` (or `opennextjs-cloudflare build`) succeeds.

## Smoke Tests
- `curl -s localhost:PORT/` contains all 13 slide titles and
  `id="slide-pricing"` (acceptance of #115, verbatim).
- The served HTML contains the product-shot markup (退屈, taikutsu) — #117.
- `npm run dev` homepage has no console errors (existing e2e step 5 still
  green when run manually).

## E2E Tests
- N/A — the repo's Playwright e2e (`core-loop.mjs`) requires a signed-in
  dashboard + dev Clerk bypass; not runnable in this environment. Covered by
  smoke checks above + unit tests. `homepage renders` + `no console errors`
  checks in core-loop.mjs are unaffected by construction.

## Manual / cURL Tests
- `curl -s http://localhost:3000/ | grep -c "hero__title"` → 13 headings.
- `curl -s http://localhost:3000/ | grep "Reading a word card" ` etc. — spot
  check per-slide copy.
- Browser: load `/`, scroll through all 13 slides, verify visuals, sounds,
  CTA anchors, mobile layout at 390px, no horizontal overflow.
