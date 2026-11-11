# remove-manga-features — Test Contract

## Functional Behavior

The Manga Studio, Word Manga, and AI manga maker features (studio editor, gallery,
public share pages, ending funnel, and all their APIs) are removed from the web
site. The standalone manga saga (12-chapter reader, saga art, saga XP) stays.

- `/studio`, `/gallery`, `/m/:id`, `/wm/:id`, `/end`, `/end/:id`, `/end/custom`,
  `/e/:id`, `/from-reel`, `/ai-manga-maker`, `/ai-manga-ending-generator`,
  `/fan-ending-manga`, `/learn-japanese-manga` all return 404.
- `/api/studio/*`, `/api/word-manga/*`, `/api/ending/*` all return 404.
- The logged-in app (`/app`) no longer shows "Studio" or "Word Manga" nav tabs;
  the "Manga" saga tab remains.
- The homepage has no studio banner and no Manga Studio/Gallery footer links;
  the "Saga" hero slide remains.
- Site header/footer, blog index, article pages, sitemap, RSS feed, llms.txt,
  SEO metadata, and pricing copy no longer link to or advertise the removed
  features.
- The landing page video repo (animevocab-launch) no longer contains the
  Studio scene or Manga/Studio nav pills.
- The extension ships no manga features (verified: it never had them).
- Saga XP still works: reading a saga chapter marks progress and feeds
  `useUserLevel` (studio creation XP is gone).

## Unit Tests

- `middleware-matcher.test.ts` — updated pins: `/api/ending/track` removed from
  beacon list; `/studio` and `/gallery` removed from route expectations.
- `telemetry.test.ts` — id-collapsing asserts now use live dynamic routes
  (`/app/n5/lessons/:id`) instead of removed `/e/:id` and `/m/:id`.
- `track-events.ts` — `studio_create`, `manga_create`, `ending_create` events
  removed from `TRACKABLE_EVENTS`; type-checked by its own tests.
- `studio-xp.ts` — creations/word-check XP sources removed; chapter-read XP
  intact (used by `manga-reader.tsx` and `use-user-level.ts`).
- `vitest run` — full suite passes with no failing or skipped test.

## Integration / Functional Tests

- `next build` succeeds with no `/studio`, `/wm`, `/m`, `/end`, or ending-funnel
  routes in the build manifest.
- `e2e/core-loop.mjs` (20 checks) passes against a dev server.

## Smoke Tests

- `curl http://localhost:3400/` returns 200 and renders without console errors
  (covered by e2e check "no console errors on homepage").
- `curl` each removed route → 404: `/studio`, `/gallery`, `/wm/abc`, `/end`,
  `/m/abc`, `/ai-manga-maker`.

## E2E Tests

N/A beyond `e2e/core-loop.mjs` above — no new user journey was added.

## Manual / cURL Tests

```sh
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3400/studio        # 404
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3400/gallery       # 404
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3400/wm/abc        # 404
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3400/end           # 404
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3400/m/abc         # 404
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3400/ai-manga-maker # 404
```
