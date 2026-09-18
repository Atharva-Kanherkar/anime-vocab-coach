# feat/issue-77-first-run-onboarding — Test Contract

Locked before implementation. Source: [issue #77](https://github.com/Atharva-Kanherkar/anime-vocab-coach/issues/77)
("Extension: first-run onboarding (open an anime → click あ → first card) to cut uninstalls"),
sub-issue of the #108 epic.

## Scope notes (read first)

Two places where the issue text and the shipped extension disagree, resolved here
so the review has something fixed to check against:

1. **"click the あ button"** — there is no あ button in the extension. The on-player
   entry point is the AnimeVocab copilot panel and its collapsed rail
   (`src/lib/agent-panel.ts`). Onboarding copy names the real control. The
   three-step shape from the issue is preserved.
2. **`first_card_created`** — already merged in #140 (#75 funnel work), fired from
   `storage.recordCardShown`. This branch does **not** move it; moving an event
   one week after it started collecting would silently redefine the metric.
   Only `onboarding_shown` is new here.

## Functional Behavior

### Onboarding state

One `chrome.storage.local` key, `onboarding`, holding five epoch-ms stamps
(`0` = "has not happened"):

| Field | Set when | Meaning |
|---|---|---|
| `installedAt` | `runtime.onInstalled` with `reason === "install"` | the 24h clock starts |
| `shownAt` | welcome page paints | step 0 of the funnel |
| `watchedAt` | `recordSeen` first stores a word from a subtitle line | step 1 done — an anime is playing and being read |
| `cardShownAt` | `recordCardShown` first runs | step 2 done — the panel put a word on screen |
| `firstCardAt` | `judgeWord` first runs with `know` or `learn` | step 3 done — a card was actually mined |

All five are **write-once**: a later call must never overwrite a non-zero stamp,
so step ticks and the 24h clock cannot be reset by ordinary use.

An install that predates this branch has `installedAt === 0`. Such an install is
treated as already onboarded (no checklist, no nag) — the 24h rule needs a real
install timestamp and must not invent one.

### Welcome page (`extension/welcome/`)

- Opens on install only (unchanged behaviour), one tab, one screen.
- Three numbered steps, in the issue's order: open an anime → open the AnimeVocab
  panel → click a word to save your first card.
- Step 1 carries a **large primary "Open Crunchyroll" button**; Netflix and
  YouTube are secondary buttons on the same row.
- **Sign-in is deferred.** It is not a numbered step and never blocks. It renders
  below the steps as one line framed around saving the first card. The existing
  silent auto-link on install still runs.
- Steps tick live: a `chrome.storage.onChanged` listener on `onboarding` re-renders
  without a reload.
- When `firstCardAt` becomes non-zero the page swaps in a **"🎉 first card"**
  moment that points at the review dashboard.
- Firing `onboarding_shown` happens exactly once per install, via
  `trackExtensionMilestone` (persisted before send).

### Popup (`extension/popup/`)

- Shows the 3-step checklist **only** when: `installedAt > 0`, `firstCardAt === 0`,
  not dismissed, and `now - installedAt >= 24h`.
- Before 24h, or once a card is mined, or once dismissed, the section is
  `hidden` with empty markup and the popup is exactly as it is today.
- The checklist reuses the same step list as the welcome page (one source of
  truth, `ONBOARDING_STEPS`) and marks completed steps from the same stamps.
- A dismiss control writes `checklistDismissedAt` and hides it permanently.

### Events

- `onboarding_shown` added to both allowlists (`src/lib/extension-events.ts` and
  `web/src/lib/extension-funnel.ts`) — they must stay identical.
- No other event changes. No payload beyond the event name (aggregate counter only).

### Non-goals

- No change to the SRS, subtitle pipeline, copilot panel, or account-link logic.
- No new permission in `manifest.json`.
- No network call beyond the existing allowlisted counter beacon.

## Unit Tests (`test/onboarding.test.ts`, vitest)

`normalizeOnboarding`
- `normalizeOnboarding(undefined)` → all-zero state
- `normalizeOnboarding(null)` / `normalizeOnboarding("garbage")` → all-zero state
- negative, `NaN`, and string-number inputs are clamped/coerced to a sane number
- unknown extra keys are dropped

`applyStamp` (write-once helper)
- stamping an unset field sets it
- stamping an already-set field returns the **same** state (no overwrite)
- stamping does not disturb other fields

`shouldShowChecklist`
- `false` when `installedAt === 0` (pre-existing install)
- `false` when `now - installedAt < 24h`
- `true` at exactly 24h with no card mined
- `false` once `firstCardAt > 0`, even at 30 days
- `false` once `checklistDismissedAt > 0`

`shouldCelebrate`
- `false` when `firstCardAt === 0`
- `true` when `firstCardAt > 0` and `celebratedAt === 0`
- `false` after `celebratedAt` is set

`checklistSteps`
- returns exactly 3 steps in issue order
- marks each step done from its own stamp, independently
- a later step being done does not retroactively mark an earlier one

`ONBOARDING_EVENT` allowlist
- `onboarding_shown` is present in `EXTENSION_EVENTS`
- `isExtensionEvent("onboarding_shown")` is `true`

## Integration / Functional Tests

`test/extension-events.test.ts` (extend existing)
- extension and web allowlists contain the identical event list, in the same
  order — the two files are separate builds and drift silently otherwise.

`test/onboarding-wiring.test.ts`
- `recordSeen` with a new word stamps `watchedAt` once and only once across two calls
- `recordCardShown` stamps `cardShownAt`
- `judgeWord(base, "learn", …)` stamps `firstCardAt`
- `judgeWord(base, "ignore", …)` and `judgeWord(base, "dismiss", …)` do **not**
  stamp `firstCardAt` — ignoring a word is not mining it
- `judgeWord(base, "review-pass", …)` does not stamp `firstCardAt`

## Smoke Tests

- `npm run typecheck` — clean
- `npm run build` — all 10 bundles rebuild
- `npx vitest run` — full suite green, no test removed
- `extension/manifest.json` permissions unchanged vs `master`

## E2E Tests (`e2e/onboarding.mjs`, Playwright + real Chromium + loaded extension)

Screenshots for every assertion, written to `e2e/shots/onboarding-*.png`.

1. **welcome-first-run** — fresh profile, open `welcome/welcome.html`:
   - three steps render, in order
   - a primary "Open Crunchyroll" button exists and is the largest CTA in step 1
   - no sign-in wall: the account line is below the steps and there is no
     blocking/modal sign-in element
   - `onboarding.shownAt` is non-zero after paint
2. **welcome-steps-tick** — with `watchedAt` and `cardShownAt` seeded via the
   service worker, the page (already open) ticks steps 1 and 2 live without reload
3. **welcome-first-card** — seeding `firstCardAt` swaps in the 🎉 moment with a
   dashboard link, live
4. **popup-checklist-24h** — `installedAt` 25h ago, nothing mined → popup renders
   the 3-step checklist
5. **popup-no-checklist-activated** — same age but `firstCardAt` set → checklist absent
6. **popup-no-checklist-fresh** — `installedAt` 1h ago → checklist absent

Run: `node e2e/onboarding.mjs` (after `npm run build`). Exits non-zero on any failure.

Existing e2e must keep passing: `node e2e/extension-review.mjs`.

## Manual / cURL Tests

The only network surface is the existing beacon. Verify the new event is accepted
and an unknown one is not (both return 204 by design — check the counter, not the
status):

```bash
# allowlisted: accepted
curl -s -o /dev/null -w '%{http_code}\n' -X POST https://animevocab.com/api/extension/track \
  -H 'content-type: application/json' \
  -H 'x-avc-extension-id: lkjbomofgfonjjbemobacegffepbdnel' \
  -d '{"event":"onboarding_shown"}'

# not allowlisted: dropped before any write
curl -s -o /dev/null -w '%{http_code}\n' -X POST https://animevocab.com/api/extension/track \
  -H 'content-type: application/json' \
  -H 'x-avc-extension-id: lkjbomofgfonjjbemobacegffepbdnel' \
  -d '{"event":"onboarding_shown_evil"}'
```

Manual install check (the one thing no harness covers — a real `onInstalled`):
1. `npm run build`, load `extension/` unpacked in a clean Chrome profile
2. the welcome tab opens by itself, showing three steps and "Open Crunchyroll"
3. in the service worker console: `chrome.storage.local.get("onboarding")` →
   `installedAt` and `shownAt` both non-zero, the rest `0`

## Acceptance (from the issue)

- [ ] A brand-new install can reach a first card without reading any docs —
      covered by E2E 1–3 plus the manual install check.
- [ ] Uninstall rate on the new cohort measurably drops — **not verifiable in this
      PR.** Read weekly from the CWS dashboard against the `onboarding_shown` →
      `first_card_created` ratio (`npm run funnel:weekly`).
