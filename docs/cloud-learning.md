# Cloud-owned learning data

animevocab.com owns vocabulary, review history, daily progress, notebooks and public extension settings. The extension reads a local cache and records pending writes before using the network. The pure protocol in `web/src/lib/learn-protocol/` is shared by both builds.

## Storage and writes

The web Worker's `LEARN_DB` binding uses the existing `avc-n5` D1 database. The `learn_*` tables are separate from the course tables. Migration `backend/migrations/0005_learner_store.sql` creates per-item words, daily progress, settings, notebooks, notebook items, an operation log and a review log. Migration `0006_learner_epoch.sql` adds the account epoch used by self-serve deletion.

`POST /api/learn/ops` accepts `{ ops: [{ op_id, kind, payload, client_ts }], epoch? }`, up to 100 operations and 500 KB. With `epoch`, a batch from a device that has not seen a data reset is refused with `409 epoch_changed`. The authenticated session or extension bearer determines the owner. Client-supplied `user_id` is rejected. Cookie writes require a matching Origin when present. Device API keys are rejected by the public settings validator.

Operations apply in request order. The account revision guards the complete D1 batch. A concurrent revision causes rollback and retry; an operation ID cannot be reused with a different payload. Reviews append to a durable log and advance the current schedule, including when another client has already reviewed that card. Legacy review history imports do not apply the schedule twice.

`GET /api/learn/changes?since=0` returns `{ userId, epoch, changes, cursor, hasMore }`. Continue from the returned cursor until `hasMore` is false. `limit` (0 to 100, default 100) bounds a page; `limit=0` is the identity probe each sync starts with. Each change contains materialized per-item data, so clients need not replay old reviews to reconstruct schedules. Notebook item changes carry only the changed entry (`delta.entries`), never the whole notebook. Tombstone and migration checks read one account row, not the learner's data. The feed is scoped to the authenticated owner.

The compatibility `GET /api/sync/snapshot` now projects D1 records into the existing dashboard format. With `?known=<revision>` it answers `{ unchanged: true }` from one row when nothing changed; the site's poll uses this. Compatibility PUTs are insert-only imports; they cannot overwrite cloud schedules or settings, and only words, days and settings the cloud lacks are written, so repeated uploads from old extensions add nothing to the change log. Web settings and reviews use operations instead.

## Migration and offline behavior

On first access, the server imports the existing KV snapshot, available legacy review history, and notebooks with stable operation IDs, then marks migration complete. A legacy record that fails validation or projection is logged and skipped rather than blocking the account. Historical review events that old builds already pruned cannot be reconstructed from a final schedule.

On first link, the extension imports its pre-operation legacy cache. Existing cloud words are deduplicated by base form; cloud schedules and settings win. Capturing the pre-operation cache prevents importing an already-reviewed local schedule and then replaying that review again.

All extension learner mutations run through the service worker's storage queue. One local write persists the cache update and outbox together. A save starts a sync within 250 ms; startup, reconnect, the site bridge, and a one-minute alarm retry work. The server's changes rebuild the cache, with pending local intent applied over it. Acknowledgements remove only operation IDs present in the changes feed. Work added during a request remains queued. A batch the server refuses for good (400, 404, 413, or a reused operation ID) is retried one operation at a time; operations still refused are moved to `learnRejected` (the last 50 are kept) so they cannot block later writes or the pull. Network errors, 5xx, 401 and other conflicts keep the outbox intact.

Outbox entries retain their account identity and credential across sign-out. Detached work uses the outgoing credential, never the next account's. Relinking the same verified owner adopts pending work onto the current credential. Detached uploads run separately so an old account cannot delay a new account's save.

Signed-out learners can use native dual subtitle tracks and local dictionary lookups. The first deliberate save is retained and opens hosted sign-in. Hosted translation and Listening still require an account.

## Settings, export and deletion

All options are controlled from `/app#settings`. Public settings synchronize through D1. The optional personal OpenAI key is set through the site's extension bridge and remains in this browser's extension storage; it never enters D1, the operation outbox, telemetry or account exports.

Installation opens `/start`. Legacy welcome and options pages redirect to the site. The local dashboard is removed; Chrome navigation/error listeners redirect its old URL to `/app#progress`. Popup Settings and Export open the site.

`GET /api/learn/export` includes words, daily progress, notebooks with items, settings, review history and operations, plus the legacy `vocab`/`stats` fields for JSON import compatibility. Anki CSV export remains in the site's Backup section.

`DELETE /api/learn/account` requires `{ "confirm": "DELETE" }`. It deletes learner records and logs and erases the legacy KV blobs, but the account stays usable: it keeps the migration marker, so legacy data is never reimported, and starts a new epoch. Other devices see the new epoch on their next sync and discard their cached copy and unsent writes instead of pushing them back. The site's deletion action also clears that browser's extension cache and keeps it linked. This action concerns the vocabulary learning store; it does not cancel billing or remove N5 course records.

Configure Clerk's verified `user.deleted` webhook at `https://animevocab.com/api/webhooks/clerk` with the Worker secret `CLERK_WEBHOOK_SIGNING_SECRET`. It deletes the same learner records and also leaves a permanent tombstone: the store answers 410 and existing extension credentials are rejected. Unsigned events are rejected.

## Local verification and deployment

```sh
npm ci
npm ci --prefix web
npm ci --prefix backend
cd web
npx wrangler d1 migrations apply avc-n5 --local
NEXT_PUBLIC_AVC_DEV_NO_CLERK=1 PORT=3498 npm run dev
```

In a second terminal at the repository root:

```sh
npm run build
npm run test:e2e:cloud-first
npm run test:e2e:onboarding
npm run pack
npm run verify:package
npm run test:e2e --prefix backend -- test/learn-store.test.ts
```

The browser journey uses fresh Chromium, the built extension, actual local Next routes and local D1. Its HTTPS player and site proxy are local fixtures. It checks the five-second online requirement, offline recovery, interleaved reviews, settings, device-key isolation, redirects and deletion. It resets only the local `dev-user` fixture records. Set `LEARN_E2E_BASE` if the dev server uses another localhost port. Evidence is written to `/tmp/animevocab-cloud-first/` and uploaded by CI.

Deploy migrations before the new web Worker. The deployment workflow now runs `wrangler d1 migrations apply avc-n5 --remote` before deploying the site. Configure the Clerk deletion webhook secret and subscription as part of rollout. This PR does not perform a production migration or deployment.
