# Cloud-first learner store verification

Verified against the immutable contract in `testing/feat-198-cloud-first.md` on 2026-11-01.

| Contract section | Result | Evidence |
| --- | --- | --- |
| Functional behavior | Pass | D1 owns per-item data; append-only reviews, idempotent writes, cursor changes, cached reads, durable capture, hosted navigation and full settings are implemented. |
| Unit tests | Pass | 414 extension, 731 web and 307 backend tests. Includes outbox retries, writes arriving in flight, account isolation, migration IDs, secret exclusion, route auth/body limits and verified deletion events. |
| Integration / functional | Pass | 74 real Worker/D1 tests, including maximum batches, concurrent same-card reviews, deduplicating imports, cursor pagination, tenant isolation, notebook round trips, transaction rollback and deletion racing a write. Existing N5 tests pass. |
| Smoke tests | Pass | Extension 0.7.3 built and packaged; all 11 checks against the actual ZIP pass. Production OpenNext/Cloudflare bundle completes. All three typechecks pass. ESLint has zero errors and six pre-existing warnings in unrelated files. |
| E2E tests | Pass | 10 fresh-profile cloud-first browser checks against actual local Next routes and D1; 20 existing web core-loop checks; five hosted onboarding checks; 10 native cue checks. |
| Manual / CLI tests | Pass | Ran the contract's typecheck, unit, build and local D1/browser commands. Loaded both the unpacked extension and ZIP artifact in fresh Chromium. Inspected the settings screenshot at phone size. |

The final browser run measured an online save appearing on the site in **2465 ms**. It verified a signed-out native dual-subtitle session, an actual Lens click retained through hosted sign-in, offline capture followed by the page's reconnect event, phone/extension interleaved reviews, lost-response retry identity, site settings reaching the extension, a device-only key, all retired page URLs, complete export, and deletion preventing resurrection. The browser uses only local fixtures; no production credentials or user data are needed.

Legacy migration is covered by stable-ID migration tests, real D1 deduplicating import tests and the extension link journey. Existing cloud schedules win over later imports; available legacy review events are preserved without applying their schedules twice. Events that an old build already pruned cannot be reconstructed.

The protocol is shared from `web/src/lib/learn-protocol/` so the production web build can resolve it inside its build boundary. Generated extension bundles match source. The test harness now runs in CI and uploads browser evidence from `/tmp/animevocab-cloud-first/`.

Rollout instructions are in `docs/cloud-learning.md`: apply the new D1 migration before the web Worker, configure Clerk's `user.deleted` webhook and `CLERK_WEBHOOK_SIGNING_SECRET`, and distribute extension 0.7.3. Production migration, deployment and live Clerk webhook delivery were not performed. Billing and N5 course lifecycle are outside this vocabulary-store deletion path.
