# AnimeVocab Cloud Sync

Issue #11 is implemented as an opt-in account sync path. The extension still
works locally without login. A user exports local extension data, signs into the
hosted Cloud app, imports that JSON, and syncs the normalized snapshot to their
account.

## Data Model

- `CloudUserProfile` stores the Clerk user id plus display email/name.
- `CloudSyncSnapshot` is the versioned cloud shape for extension settings,
  vocabulary/progress, and daily stats.
- `CloudSyncEnvelope` wraps the snapshot with account profile, `revision`, and
  `lastSyncedAt`.
- `ExtensionSyncStatus` defines the extension-visible states: `local-only`,
  `connected-synced`, `sync-error`, and `disconnected`.

## Persistence

`/api/sync/snapshot` stores one sync envelope per Clerk user:

- `GET /api/sync/snapshot` returns the current envelope for the signed-in user.
- `PUT /api/sync/snapshot` saves a snapshot only when `expectedRevision` matches
  the stored revision.

Production persistence uses the `AVC_SYNC_KV` Cloudflare KV binding configured in
`web/wrangler.jsonc`. It reuses the existing AnimeVocab KV namespace with a
`sync:user:` key prefix. Local Next development falls back to process-local
memory so the route can be exercised before a Cloudflare binding is available.

## Conflict Rule

Sync never silently overwrites newer cloud progress. If the browser tries to save
with a stale `expectedRevision`, the API returns `409 revision-conflict` with the
current cloud envelope. The user must load cloud first, export local JSON if they
need a backup, and retry intentionally.

## Manual Round Trip

1. In the extension, export progress JSON from Settings.
2. In the web app, sign in and open `/app`.
3. Click `Import extension JSON`.
4. Click `Sync to cloud`.
5. Reload `/app`, click `Load cloud`, then click `Export cloud snapshot`.
6. The exported cloud snapshot maps back to extension export format through
   `cloudSnapshotToAnimeVocabExport`; unit tests cover a vocabulary item
   round-trip.

## Required Production Setup

Set these web app environment values:

- `NEXT_PUBLIC_CLERK_ENABLED=true`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/app`
- `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/app`

The web Worker must keep the `AVC_SYNC_KV` binding in `web/wrangler.jsonc`.
