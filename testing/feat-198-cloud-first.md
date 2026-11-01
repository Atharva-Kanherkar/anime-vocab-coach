# feat/198-cloud-first - Test Contract

## Functional Behavior
- animevocab.com owns per-user words, append-only review history, notebooks, notebook items, settings and daily progress in D1. Existing KV snapshots and notebooks migrate without loss on first use.
- Authenticated clients submit ordered, idempotent operations with op_id, kind, payload and client_ts to POST /api/learn/ops. Identity comes from authentication, never a supplied user_id. Retrying an acknowledged operation changes nothing. Invalid batches fail without partial writes.
- GET /api/learn/changes?since=cursor returns ordered changes scoped to the caller, with a durable server cursor and pagination. Reviews from interleaved clients both survive, including two reviews of the same card. No snapshot upload overwrites a review.
- The extension reads its local cache without network latency. Each learner-data mutation atomically persists an operation in a durable outbox with the cache update. Online saves start syncing immediately and reach the site within five seconds; offline writes retry on reconnect/startup/alarm.
- First link imports a legacy local deck once, deduplicated by word. Retries and relinking preserve cloud reviews and settings and do not duplicate words or progress. Incoming changes update the cache while pending local operations retain their intent.
- Signed-out learners can watch dual subtitles. The first deliberate word save prompts account sign-in and remains durable until linking. Outboxes and cursors are isolated across sign-out/account switches.
- Popup Settings, install and legacy welcome/options/dashboard URLs lead to animevocab.com. Delete the extension dashboard UI and move JSON/Anki export to the site.
- All non-secret options exist on the site: pause mode, cooldown, cards/hour, target level, auto-resume, script, learning direction, auto-speak, Lens/dual subtitles, peek pause, transcription model and site toggles. Site changes reach the extension within a sync; the BYO key remains device-only.
- Account export includes all learner tables and review history. Account deletion removes all learner records and prevents legacy KV data from resurrecting.

## Unit Tests
- Operation validation rejects malformed kinds, IDs, timestamps, payloads, oversized batches and unsupported settings.
- Cache/outbox tests cover atomic enqueue, failed requests, retry identity, ack without losing writes queued in flight, remote changes with pending local work, unsigned save prompts, sign-out and account switching.
- Settings normalization covers all public fields and excludes secrets.

## Integration / Functional Tests
- Real local D1: migrate legacy data once; duplicate ops are no-ops; two clients interleave reviews without loss; stale imports cannot undo reviews; cursor pagination and tenant isolation hold.
- Real local D1: notebook create/edit/item/delete, settings, export and deletion round trips; invalid batches roll back.
- Route tests verify bearer/session auth, 401, request limits, error responses and per-user data isolation.
- Existing extension, web and backend unit suites and typechecks pass; web lint passes.

## Smoke Tests
- Extension builds with committed bundles matching source; production web/Worker bundles build.
- Fresh-profile browser opens local /app and settings; legacy extension options/welcome redirect and popup links target the site.

## E2E Tests
- Two real clients against local D1: extension saves while online, offline save/reconnect, phone review interleaved with extension review, settings round trip, link/import/relink, and account export/delete.
- Exercise the settings form at desktop and phone sizes and verify controls persist. Browser checks must use a fresh profile and no production credentials.

## Manual / cURL Tests
- Run the committed local learner-store integration/E2E harness; it creates disposable D1, authenticates two fixture users, and asserts ops/changes/export/delete results.
- Run npm run typecheck, npm run test:unit, npm run build; in web run npx tsc --noEmit, npm run test:unit, npx eslint and the production build; in backend run npm run typecheck and npm test.
- Load the built extension unpacked: Settings opens /app#settings; Extension options redirects there; installation opens /start; no dashboard UI remains.
