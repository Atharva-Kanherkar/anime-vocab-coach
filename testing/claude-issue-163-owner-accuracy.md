# Issue 163 /owner Accuracy: Test Contract

Pricing decisions need numbers that are not us. The data in the issue: the owner is 45% of
all listening (2h03m of 4h35m), made 495 AI calls and 107 `/owner` views. Clerk shows 5 Max
and 2 Pro, but every AI spender and every transcription is tagged `free`. "Never active"
reads 0 while 54% never linked.

## Context (investigated before this contract)

- **Owner traffic.** Nothing on `/owner` filters anyone out. The owner's rows carry their
  Clerk userId (Clerk cookie or sync token), so they can be excluded by id. The coach and
  pick-word rows tag the owner's plan as `owner`. anime-context and the transcription
  Worker tag `profile.plan`, which is `free`, so the owner's listening is counted as free
  usage.
- **Plan tags.** Every tag comes from the effective plan: `resolvePlan` on the web,
  `effectivePlanFromProfile` in the avc-api Worker. Both apply gift expiry, and grants,
  gifts and the Dodo webhook refresh the sync-token profile. So an expired gift is
  correctly tagged `free`. "Users by plan" counts raw `publicMetadata.plan` with no expiry,
  so it reports expired gifts as Max or Pro. That mismatch is the likeliest explanation for
  "5 max + 2 pro but everything is free". It cannot be confirmed from this branch: there are
  no Clerk or Analytics credentials locally. So the page is built to confirm it.
- **"Never active"** counts Clerk users with no `lastActiveAt`, i.e. never signed in. Almost
  everyone who signs up has signed in once, so it reads 0. Linking is a live pointer
  `synctoken:user:<id>` (30-day sliding TTL). Saved words are in
  `sync:user:<id>:snapshot:v1`, which has no TTL.
- `extension_funnel` rows carry no user at all, and anonymous rows carry none either.
  Neither can be excluded, so the page has to say so.

## Functional Behavior

### Excluding us

- The excluded accounts are:
  - `OWNER_EMAILS`
  - `OWNER_EXCLUDE_EMAILS`, a comma-separated env list of test accounts
  - `OWNER_EXCLUDE_USER_IDS`, a comma-separated env list of Clerk ids
  - the dev profile, under the dev Clerk bypass
- Emails are resolved to Clerk ids with one `getUserList({ emailAddress })` call. Ids are
  validated (`user_` + alphanumerics), deduplicated, and capped at 50.
- By default every Analytics Engine query on `/owner` leaves those ids out, across
  `avc_llm`, `avc_events` and `avc_transcribe`. That includes totals, series, groups,
  top-user tables, distinct users, the learning loop, the API panels, the Pro funnel and
  transcription.
  - The exclusion is `AND userCol != '<id>'` per id, through `sqlString`.
  - Anonymous rows are kept: they cannot be attributed.
- `?all=1` includes everyone. The page states which mode it is in, how many accounts are
  excluded (by email where known), and links to the other mode. Window links keep the
  mode.
- `?user=<id>` (the drill-down) never excludes, so the owner can still inspect themselves.
- If the email lookup fails, the page still excludes the env ids and says the owner accounts
  could not be resolved, so the numbers may include them. It never silently includes them.
- All-time history (Clerk and KV) excludes the same ids: total signups, signups by month,
  active in 30d, never active, users by plan, listening by month, listening leaders, all-time
  listening, linked users and activation. `?all=1` includes them there too.
- AI insights run with the same mode as the page they were requested from.
- The Extension funnel panel notes that its rows carry no user and include us.

### Users by plan

- Uses the effective plan and where it came from, not raw metadata. The buckets are:
  - `free`
  - `pro · paid`, `max · paid`: no `planExpiresAt`
  - `pro · gift`, `max · gift`: `planExpiresAt` in the future
  - `gift expired`: `planExpiresAt` passed, now free
- A malformed `planExpiresAt` reads as free, same as `parseEntitlement`.

### Plan tags on paid and gifted calls

- A **Paid & gifted accounts** panel lists every non-excluded account whose raw plan is not
  free. For each one it shows:
  - email
  - bucket (as above) and, for gifts, the expiry date
  - effective plan
  - the plan tags on its calls in the current window, from `avc_llm` and `avc_transcribe`,
    with counts
  - a verdict:
    - `ok`: every tag is the effective plan, or `owner`
    - `mismatch`: some tag differs; the tags are listed
    - `no calls`: nothing in the window
- One grouped query per dataset, restricted to those ids (an OR of equalities, through
  `sqlString`). No query runs when there are no such accounts. A failing query is named in
  the query-error line; the rest of the page is unaffected.
- The AI digest gets the panel's rows. Mismatches come first.

### Never active

- **Never active** is a non-excluded signup with no saved word in their cloud backup,
  split into:
  - **never linked**: no live link and no backup
  - **linked, no card**: a live link or a backup, but zero words
- Reads at most 500 backups. Past that the numbers are a lower bound and the page says so.
  A read failure leaves the stat `n/a` with a note, never 0.
- The stat's foot shows the split; the warn tone applies above 30%.

## Unit Tests

- `web/src/lib/owner-scope.test.ts` (new)
  - `userClause`: undefined → `""`; a focus string → `AND col = '<id>'`; an exclude list →
    one `!=` per id, escaped; an empty exclude list → `""`; a focus wins over excludes.
  - Every scoped builder takes the scope: `llmFacetsSql`, `llmSeriesSql`, `llmErrorsSql`,
    `llmByUserSql`, `eventGroupSql`, `eventsByUserSql`, `apiRoutesSql`, `apiErrorsSql`,
    `transcribeTotalsSql`, `transcribeGroupSql`, `transcribeSeriesSql`,
    `transcribeByUserSql`, `llmDistinctUsersSql`, `eventDistinctUsersSql`,
    `featureEventsSql`, `featureBuildsSql`, `animeContextCacheSql`, `proFunnelSql`. With an
    exclude list, each SQL contains the `!=` clause on that dataset's userId column.
  - `loadOwnerDashboard(hours, { exclude })` puts the clause on every query except the
    extension funnel.
- `web/src/lib/owner-exclusions.test.ts` (new)
  - `excludedEmailList` merges `OWNER_EMAILS` and `OWNER_EXCLUDE_EMAILS`, lowercased,
    deduplicated, junk dropped.
  - `excludedIdList` validates, dedupes and caps `OWNER_EXCLUDE_USER_IDS`.
  - `resolveExclusions` under the dev bypass → the dev profile id. A Clerk failure → env ids
    only, with a note.
- `web/src/lib/owner-history.test.ts` (new or extended)
  - `planBucket`: free, paid pro/max, gift pro/max, expired, malformed expiry.
  - `foldActivity(users, linked, backups)`: never linked vs linked-no-card vs active;
    excluded ids dropped; truncation flagged.
  - History totals drop excluded ids (Clerk and KV folds).
- `web/src/lib/owner-plan-tags.test.ts` (new)
  - `planTagsSql`: the dataset's userId and plan columns by schema position, OR of escaped
    ids, grouped by user and plan.
  - `foldPlanTags`: ok / mismatch / no calls, `owner` tolerated, llm + transcribe merged,
    mismatches sorted first.
- `web/src/lib/owner-insights.test.ts`: the digest has a "Paid & gifted accounts" section
  and says which mode it is in.

## Integration / Functional Tests

- `loadOwnerDashboard` against a stubbed SQL API (as existing tests do), with an exclude
  list.
- Typecheck, eslint, unit suites in root and web. `opennextjs-cloudflare build`.

## Smoke Tests

- `/owner`, `/owner?all=1` and `/owner?user=<id>` render in `next dev` with no console
  errors.

## E2E Tests

- Extend `web/e2e/observability.mjs`, or add a new suite, against `next dev` with the AE
  mock recording the SQL it receives:
  - `/owner` says it excludes one account (the dev profile), and every `avc_llm`,
    `avc_events` and `avc_transcribe` query it sent carries `!= '<dev id>'`.
  - `/owner?all=1` says it includes everyone, and no query carries the clause. Window links
    keep `all=1`.
  - `/owner?user=<dev id>` carries `= '<dev id>'` and no `!=`.
- The Clerk-backed panels (users by plan, paid & gifted, never active) cannot run under the
  dev bypass. They are covered by unit tests, and the PR says so.

## Manual / cURL Tests

After deploy, signed in as the owner:

- `/owner`: the header reads "Excluding N accounts". Listening, AI calls and top users drop
  by roughly the owner's share (listening about 45% lower than today).
- `/owner?all=1` matches today's numbers.
- **Users by plan** shows paid vs gift vs expired. **Paid & gifted accounts** says whether
  any paid call was tagged wrong. If every row is `ok` or `no calls`, the "all free"
  observation was expired gifts and real free users, not a tagging bug.
- **Never active** is non-zero and splits never-linked from linked-no-card.
