# fix/n5-merged-audit — Test Contract

## Functional Behavior
- Audit the merged backend (#177) and web pilot (#178) from master; do not include unfinished extension feature work (#175).
- Course draft, enrolment, attempt and finish recovery preserve account ownership, script isolation, acknowledged revisions and retry semantics.
- Existing extension loading, popup/settings, review/deck and video cue behavior remain functional with the actual built extension.
- The default-off private pilot must not alter dashboard credentials, extension linkage, or non-member access.
- Reproduce confirmed findings before fixing them; describe remaining rollout limitations accurately.

## Unit Tests
- Run complete extension, backend and web unit suites and type checks.
- Add focused regressions for each confirmed bug, including relevant draft/state/credential boundaries.

## Integration / Functional Tests
- Run real Worker/D1 migrations, concurrency and account-isolation tests.
- Re-run seeded backend/web fuzzing and scoped mutation gates for changed logic.
- Verify committed extension bundles match the sources.

## Smoke Tests
- Build/package the extension; compile the production web and backend bundles.
- Check pilot-disabled and non-member routes, normal dashboard and gateway boundaries.

## E2E Tests
- Use Playwright with a fresh persistent profile and the actual unpacked extension.
- Run supported extension regression journeys and the web → gateway → Worker/D1 N5 course journeys in both scripts.
- Extend browser coverage to reproduce confirmed recovery bugs.

## Manual / cURL Tests
- Exercise the local gateway auth, cross-origin mutation, disabled feature and invalid-route probes in web/e2e/n5-course.mjs.
- Record browser evidence and actionable findings in testing/fix-n5-merged-audit-results.md.
- Real Clerk credentials and live streaming subscriptions are not assumed available; document any unverified signed-in/provider flow without claiming it passed.
