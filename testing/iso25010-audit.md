# ISO/IEC 25010 audit: reliability, usability, security

Audit run on 2026-10-14 against master (4a4b949) and production, then fixed on
`fix/iso25010-audit`. Each finding lists what was wrong, what changed, and the
evidence: a before/after number wherever one could be measured. Every check
below runs in CI unless marked otherwise.

## Security (confidentiality, integrity, authenticity, resistance)

| Finding | Fix | Evidence |
|---|---|---|
| Any script on animevocab.com could plant a sync token in the extension (linking it to another account) | The bridge forwards the token; the worker stores it only after `GET /api/sync/token` confirms it belongs to the account this browser's cookie is signed in as | Live on prod before the fix: a planted token showed `linked: true`. `web/src/app/api/sync/token/route.test.ts` (planted token 403), `test/account-link.test.ts` |
| Signed-in Listening Mode billed only by the client's own heartbeat; skip it and transcription is free | Signed-in audio always goes through `/v1/transcript/transcribe`, which bills real audio length. Private `sess:` keys cover sessions with no episode key; English keys are accepted. Realtime socket is BYO-key only. `/v1/session` keeps a daily mint budget and an off switch for 0.6.x | `test/listening-billing.test.ts`, `backend/src/validate.test.ts`, mint budget in `backend/e2e/concurrency.mjs` |
| No CSP, HSTS, framing protection or nosniff on site or API; `x-powered-by` sent | Headers on every web route (`web/src/lib/security-headers.ts`) and every API response | 0 CSP violations on 16 pages (local prod build) and on live prod pages with the policy injected, including a Clerk sign-in round trip. Injected script, fetch exfiltration, `<base>` hijack and framing all blocked |
| Next.js 16.2.10: 3 critical, several high advisories | Next 16.3.8 (first patched release OpenNext supports), OpenNext 1.20.11; local patch dropped (fixed upstream) | `npm audit --omit=dev`: 0 in root, backend, web (was 6 in web, 1 critical). Home page still cache-intercepted (`x-opennext-cache: HIT`) |
| `/api/ending/options` called OpenAI with no account and no limit | Atomic daily budget per hashed IP / user and global | Local workerd, 20 concurrent from one IP: 15 upstream calls, 5 refused |
| N concurrent requests for an uncached manga panel each paid for an image | Per-panel draw lock (Durable Object); others get 409 and poll | Same 10-request test: old route 10 images, new route 1 |
| Billing webhooks replayable (no timestamp check, no id dedupe) | 5-minute tolerance, webhook-ids remembered 7 days, audit log line | Old handler applied a 6-minute-old event and an in-window replay; new rejects / no-ops |
| Dashboard word table rendered words and glosses as HTML | Escaped | `e2e/dashboard-escape.mjs`: master 0/3, branch 3/3 |
| Sync tokens stored in the clear as KV key names and pointer values | Records keyed by SHA-256; pointer holds the hash plus the token sealed with AES-GCM; legacy records migrate on first use | Web and backend tests: no KV key or value contains the token after mint or migration; legacy tokens keep working |
| Exported backup files contained the OpenAI key | Export leaves it out | `test/backup.test.ts`, `e2e/backup.mjs` |

## Reliability (faultlessness, availability, fault tolerance, recoverability)

| Finding | Fix | Evidence |
|---|---|---|
| Two extension contexts writing the word list at once lost a write | Every vocab/stats/settings write runs in the service worker behind one queue | `test/storage-single-writer.test.ts`: per-context writes kept 17 of 30 words, single writer 30 of 30 |
| Listening meter and transcription locks were KV read-then-write | `Atomic` Durable Object (SQLite, Free-plan safe) per key; meter mirrors to KV for /owner | `backend/e2e/concurrency.mjs` on real workerd: master 50 concurrent heartbeats read as 9 min, branch 50 |
| 19 of 22 extension fetches and 20 web upstream calls had no timeout | Every call carries an abort signal sized to the call | `test/network-timeouts.test.ts`, `web/src/lib/upstream.test.ts` (master fails it) |
| CI ran 1 of 14 extension e2e suites; extension suites posted beacons to production | `e2e/ci.mjs` runs 15 suites; `e2e/support/no-production.mjs` keeps them off prod; web e2e job runs app-link-status and the /owner suites; backend job runs the concurrency e2e | Probe before the guard: every extension suite hit prod `/api/track` and `/api/sync/token` |
| No health check, no alerting | `/api/health`, `/v1/health`; `.github/workflows/uptime.yml` every 15 min (also checks the security headers are still sent) | Run locally: healthy exit 0; API stopped exit 1 with `atomic: fail` |
| Export but no import | Import backup (validated, merges like cloud sync, never deletes) | `test/backup.test.ts` round trip restores storage exactly; `e2e/backup.mjs` 6/6 |

## Usability (interaction capability)

| Finding | Fix | Evidence |
|---|---|---|
| Site: 258 axe violations (contrast on every page, unlabeled table headers, unfocusable scroll region, missing landmarks, 404 reusing the home title) | Muted text token 0.4 to 0.58 alpha, link fallback colour, labelled tables, real 404 page, landmarks and headings on auth pages | axe WCAG 2.2 AA + best practice, 9 pages x desktop/mobile: 258 to 0 |
| Extension pages: 142 axe violations; copilot panel 8 more | Contrast tokens, a separate fill for white-on-accent, main/h1, `aria-hidden="true"`, live error region, chart names, valid resize-handle role | `e2e/a11y-extension.mjs` (4 pages x light/dark): 10/10; panel and Lens tip axe checks in `panel-layout` and `copilot-keys-lens` |
| Popup mode descriptions cut off with an ellipsis | Wrap | `e2e/a11y-extension.mjs` clipping check (fails with the old ellipsis rule) |
| No undo after judging a word | Undo in the copilot panel and the Lens tip; restores the record and day counters exactly | `test/undo-judgment.test.ts`, `e2e/undo.mjs` 12/12 |
| Audit claim "~500 small tap targets on /blog" | Corrected, not changed: the count included inline text links, which WCAG 2.5.8 exempts; axe target-size passes | axe `wcag22aa` run above |

## Not done here, and why

- **Minimum TLS version** (TLS 1.0/1.1 still accepted): a Cloudflare zone setting, not code. Dashboard: SSL/TLS, Edge Certificates, Minimum TLS Version, 1.2.
- **Japanese extension UI**: about 250 to 350 strings over seven surfaces plus the store listing. It should ship with native review, so it is a follow-up rather than machine copy in this PR.
- **Error-rate alerting** beyond uptime: Workers logs already capture errors; paging on error rates needs a monitoring account (Sentry or similar).

## Rollout notes

- Merging deploys. The API deploys first (it now defines the `Atomic` Durable Object the site binds to); `deploy.yml` orders this.
- Token migration is read-both, write-hashed, and the API (which reads both) deploys before the site (which writes hashed).
- The new extension needs the server changes, which ship on merge. Store build 0.6.x keeps working: `/v1/session` and the heartbeat stay on until `LEGACY_REALTIME_SESSIONS = "0"` is set once the new build has rolled out.
- Optional: set `SYNC_TOKEN_SECRET` on the site Worker; without it the pointer key derives from the Clerk secret.
