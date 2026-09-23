# Issue 160 API Error Breakdown: Test Contract

Part 1 of #160 (telemetry). The refetch fix and the auto-cap confirmation come after.

## Context (investigated before this contract)

- `/api/anime/context`: 4,338 calls and 295 4xx/5xx in 90 days, with 1 LLM error. The
  failures happen before the model, and `/owner` cannot say which.
- Every wrapped API call already writes `status` (blob10, the HTTP code as a string) and
  `authKind` (blob9) to `avc_events`. The API routes panel only sums `status >= '400'`
  into one column. The 90-day breakdown is in the data; the read side is what is missing.
- A 401 is ambiguous. `resolveProfile` returns null both when a presented sync token has
  no KV record (expired, purged, never issued) and when the KV read throws. The learner
  gets the same 401 either way, and telemetry cannot tell a dead link from our own KV.
- Response bodies already carry the reason (`{ error: "unauthorized" }`,
  `"auto_quota_exhausted"`, `"openai_502"`, a KV error message). Nothing records it.
- `/api/anime/context` never reserves usage. The auto meter is spent by
  `/api/ai/pick-word`, `/api/ai/extract-words` and `/api/tts`, and `/api/tts` writes no
  route telemetry, so an auto-cap 429 there is invisible.
- No Analytics read credentials exist locally, so the numbers cannot be pulled from this
  branch. The panel is how they get read.

## Functional Behavior

- `/owner` has an **API errors** panel under **API routes**: one row per
  route × status × auth kind × reason, with calls, identified learners, first seen and
  last seen, sorted by calls.
  - Each status carries a short meaning (401 unauthorized, 429 quota or rate limit,
    502 upstream failed, …), falling back to "client error" / "server error".
  - Rows written before the reason existed read **not recorded**.
  - It uses the same 4xx/5xx predicate as API routes, so a route's rows sum to its
    4xx/5xx cell.
- API routes and API errors both honour `?user=`. A 401 from a dead link has no user, so
  the panel says the single-user view cannot show those.
- `EVENT_BLOBS` gains `errorCode`, appended as blob15. The first 14 positions do not move.
- `withApiTelemetry` writes `errorCode` on 4xx/5xx rows only:
  - `unhandled` when the handler threw (Next turns it into a 500).
  - On a 401, the reason `resolveProfile` recorded: `token_unknown` (the bearer has no
    KV record) or `token_lookup_failed` (the KV read threw).
  - Otherwise the body's `error` string, read from a clone, only for `application/json`
    or `text/plain` bodies of at most 4 KB. Lowercased, anything outside `[a-z0-9_.:-]`
    collapsed to `_`, at most 64 chars.
  - Anything unreadable is `""`. A 2xx body is never read. The route gets back its own
    response object, still readable.
- `resolveProfile` still returns null (routes still 401); it only records why.
- `/api/tts` is wrapped. Its audio responses and error bodies are unchanged.
- The AI-insights digest carries the error breakdown (top 10 rows).
- A failing API-errors query leaves every other panel intact and is named in the
  query-error line.
- Telemetry never receives a title, a token, or a hash of a token.

## Unit Tests

- `web/src/lib/telemetry.test.ts`
  - `EVENT_BLOBS` keeps its first 14 names in place; `errorCode` is blob15.
  - `recordUserEvent` writes `errorCode`, `""` by default.
  - The AE dialect test lists `apiErrorsSql` and the focus-user variants of both API
    queries.
- `web/src/lib/api-telemetry.test.ts` (new)
  - A 401 from `resolveProfile` with an unknown token → `token_unknown`; with a KV throw
    → `token_lookup_failed`; with no token at all → the body's `unauthorized`.
  - A JSON body's `error` and a `text/plain` body's `error` are both recorded.
  - A throw → status 500, `unhandled`, and the error still propagates.
  - A 2xx → `""`, and its body is never cloned.
  - Hostile and long codes are sanitised and capped; non-JSON, oversize, audio and
    missing-`error` bodies → `""`.
  - The response returned is the handler's object and its body is still readable.
- `web/src/lib/owner-api-errors.test.ts` (new)
  - `apiErrorsSql` addresses kind, name, status, authKind, errorCode and userId by schema
    position, groups by all four labels, weights counts, clamps the window, escapes the
    focus user, bounds the limit.
  - `apiRoutesSql` and `apiErrorsSql` share one error predicate; the focus user filters
    both, and neither filters without one.
  - `foldApiErrors` discounts the anon bucket, coerces string aggregates, names the
    unrecorded reason, attaches the status meaning.
  - `statusMeaning` covers the mapped codes and falls back by class.
  - `loadOwnerDashboard`: error rows land in `apiErrors`; a failing errors query leaves
    `apiRoutes` intact and names "api errors" in `queryError`; the focus user reaches
    both API queries.
- `web/src/lib/owner-insights.test.ts`: the digest has an "API errors by status" section
  when there are rows, and none when there are not.

## Integration / Functional Tests

- `web/src/app/api/tts/route.test.ts` (new): a 401 writes an `api` row named `/api/tts`
  with status 401 and reason `unauthorized`; a refused reservation writes 429
  `auto_quota_exhausted`; a synthesis still returns `audio/mpeg` bytes, and its row has
  status 200 and no reason.

## Smoke Tests

- `web/`: `npx eslint` (0 errors), `npx tsc --noEmit`, `npm run test:unit`.
- Root: `npm run typecheck`, `npm run test:unit` (the schema mirror test is untouched).

## E2E Tests

- `node web/e2e/observability.mjs`: the SQL mock serves error rows (a
  `/api/anime/context` 401 from `sync_token` with no reason, a 502 with a KV reason, a
  `/api/ai/pick-word` 429 `auto_quota_exhausted`). The API errors panel shows all three,
  with status meanings, "not recorded", and 0 learners for the anonymous 401s.

## Manual / cURL Tests

- Before deploy, the same split straight from the SQL API (Analytics Read token):

  ```sh
  curl -s "https://api.cloudflare.com/client/v4/accounts/68b4f7e6d89fd7ac4cbf3243fe190b5f/analytics_engine/sql" \
    -H "Authorization: Bearer $CF_ANALYTICS_API_TOKEN" \
    --data "SELECT blob2 AS route, blob10 AS status, blob9 AS authKind, SUM(_sample_interval) AS calls, MIN(timestamp) AS firstSeen, MAX(timestamp) AS lastSeen FROM avc_events WHERE timestamp > NOW() - INTERVAL '2160' HOUR AND blob1 = 'api' AND blob10 >= '400' GROUP BY route, status, authKind ORDER BY calls DESC" | jq .data
  ```

- After the web deploy, `/owner?h=2160` → API errors shows the 90-day split of the 295
  `/api/anime/context` errors. **Needs the owner's session; cannot be run from here.**
- After the web deploy, a dead token:
  `curl -i "https://animevocab.com/api/anime/context?title=Frieren" -H "Authorization: Bearer avc_st_doesnotexist"`
  → 401, and `/owner?h=6` shows a `/api/anime/context` 401 `sync_token` row with reason
  `token_unknown`.
