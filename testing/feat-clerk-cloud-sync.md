# feat/clerk-cloud-sync-pr - Test Contract

## Functional Behavior
- The web app uses Clerk's current Next.js App Router integration:
  - `@clerk/nextjs` is installed.
  - `ClerkProvider` wraps the app.
  - `clerkMiddleware()` is exported from `web/src/proxy.ts` because the app uses Next 16.
  - Cloud app routes are protected while marketing routes stay public.
- Free/local-first remains the default. Users can still install/use the extension without an account.
- A hosted Cloud/app surface exists for signed-in users.
- The hosted surface includes a local-first sync foundation:
  - accepts AnimeVocab extension JSON exports,
  - normalizes them into a cloud sync snapshot,
  - reports counts and sync state,
  - exports the normalized snapshot back to JSON.
- The hosted app persists the sync snapshot per account through
  `/api/sync/snapshot` and the `AVC_SYNC_KV` binding.
- Sync writes use revision checks and return a conflict instead of silently
  overwriting newer cloud progress.
- Extension-facing sync states are represented as `local-only`,
  `connected-synced`, `sync-error`, and `disconnected`.
- The implementation documents why Clerk was chosen over WorkOS and custom auth.

## Unit Tests
- `normalizeAnimeVocabExport` handles missing settings/vocab/stats without throwing.
- `normalizeAnimeVocabExport` maps existing `VocabMap` and daily stats into a versioned snapshot.
- `summarizeSyncSnapshot` counts words by state and reviews due.
- A local vocabulary item round-trips from extension export to cloud snapshot
  and back to extension export shape.
- Stale sync writes produce a revision conflict.

## Integration / Functional Tests
- `npm run build` in `web/` compiles Clerk provider, proxy, and app routes.
- Protected app routes use Clerk middleware instead of hand-rolled auth checks.
- Public marketing routes remain accessible without auth.

## Smoke Tests
- `/cloud` renders as public marketing for AnimeVocab Cloud.
- `/app` is protected by Clerk.
- Signed-in app shell shows account controls, sync import/export, and local-first copy.

## E2E Tests
- N/A - no browser automation exists for auth flows yet. Manual Clerk sign-in is required with real Clerk keys.

## Manual / cURL Tests
- `cd web && npm run build`
- `cd web && npm run lint`
- Set Clerk env vars in `web/.env.local`:
  - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
  - `CLERK_SECRET_KEY`
  - `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/app`
  - `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/app`
- `cd web && npm run dev`, then visit `/cloud` and `/app`.
