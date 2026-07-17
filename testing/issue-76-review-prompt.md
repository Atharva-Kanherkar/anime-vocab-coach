# issue-76-review-prompt — Test Contract

In-product Chrome Web Store review prompt after the user has experienced value
(mined cards + completed a review). See GitHub issue #76.

## Functional Behavior

### Eligibility (all must hold to show)
- Mined cards ≥ 10, where mined = words with `state === "known" || state === "learning"`.
- At least one review completed: sum of `stats.daily[*].reviews` ≥ 1.
- Not dismissed forever (`dismissedForever === false`).
- Max two asks per install (`askCount` increments on each new display). Remounts of
  an unanswered ask stay visible; a third new ask never starts.
- Not snoozed: either no snooze, or both conditions cleared:
  - `now >= snoozeUntil` (≈ 2 weeks from "Maybe later"), **and**
  - mined cards ≥ `snoozeAfterCards` (cards at snooze + 20).
- Never shown during video playback (content script / agent panel) — only popup and dashboard idle surfaces.
- Never shown while a dashboard review session is active (`#review` deep-link mid-session or `.review-session` UI).

### Prompt UI
- Copy: "Enjoying AnimeVocab? A rating helps other learners find it."
- Actions:
  - **Rate on Chrome Web Store** → opens
    `https://chromewebstore.google.com/detail/lkjbomofgfonjjbemobacegffepbdnel/reviews`
    and records a click (counts as one ask / does not re-show after max asks).
  - **Maybe later** → snooze ≈ 14 days and require +20 mined cards (ask already counted on show).
  - **No thanks** → `dismissedForever = true`; never ask again.

### Persistence
- State key in `chrome.storage.local`: `reviewPrompt`
  `{ dismissedForever, askCount, snoozeUntil, snoozeAfterCards, lastShownAt }`
- A new ask display increments `askCount` (max 2), sets `lastShownAt`, and fires
  `review_prompt_shown` once per ask (popup remounts of the same unanswered ask
  do not re-fire or re-increment).
- Rate click fires `review_prompt_clicked` and sets `dismissedForever`.
- `resetProgress()` clears vocab/stats only — never `reviewPrompt` (opt-out and
  the two-ask cap are install-lifetime).

### Events
- Allowlisted extension funnel events: `review_prompt_shown`, `review_prompt_clicked`.
- Fire-and-forget POST to `/api/extension/track` with `X-AVC-Extension-Id`.
- Server writes append-only Analytics Engine points (`EXTENSION_AE` /
  `extension_funnel`) — not KV read-modify-write counters.
- Gate: published Chrome extension id (Origin and/or header), body ≤ 256 bytes,
  per-IP hourly rate limit; unknown/forged callers get 204 and no write.
- Analytics failures never break UI.

## Unit Tests

- `shouldShowReviewPrompt_requiresMinedAndReviews` — <10 mined or 0 reviews → false; both met → true
- `shouldShowReviewPrompt_respectsDismissedForever` — dismissed → false
- `shouldShowReviewPrompt_maxTwoAsks` — askCount ≥ 2 → false
- `shouldShowReviewPrompt_snoozeUntilAndCards` — within 2 weeks or under +20 cards → false; both cleared → true
- `applyMaybeLater_setsSnooze` — snoozeUntil ≈ now+14d, snoozeAfterCards = mined+20
- `applyNoThanks_dismissesForever` — dismissedForever true
- `applyRate_stopsAsking` — after rate click, shouldShow → false
- `applyShown_incrementsAskCount` — new display increments askCount and clears snooze
- `isExtensionEvent_allowlist` — only allowlisted names accepted

## Integration / Functional Tests

- Storage helpers `getReviewPrompt` / `setReviewPrompt` wrap `chrome.storage.local`
  (state transitions covered by pure unit tests; chrome mock not required for this PR).

## Smoke Tests

- `npm run typecheck` passes
- `npm run test:unit -- test/review-prompt.test.ts` passes (13 tests)
- `cd web && npm run test:unit -- src/lib/extension-store.test.ts` passes (3 tests)
- `npm run build` produces updated `extension/popup/popup.js` and `extension/dashboard/dashboard.js`
- Note: pre-existing failure in `test/scoring.test.ts` (お願いします boost) is unrelated to #76

## E2E Tests

- N/A for this change — prompt depends on seeded progress state; covered by unit tests + manual steps.
  (Optional follow-up: extend `e2e/extension-review.mjs` to seed eligibility and assert the card.)

## Manual / cURL Tests

1. Load unpacked extension from `extension/`.
2. In DevTools → Application → Extension storage, set:
   - 10+ known/learning vocab entries
   - `stats.daily` with `reviews: 1`
   - clear `reviewPrompt`
3. Open popup: review card appears between account and actions.
4. Click **Maybe later**: card disappears; `askCount` stays 1 (counted on show); snooze fields set.
5. Force eligibility again (clear snooze, keep askCount 1, mined ≥ snoozeAfterCards): card reappears once more (askCount → 2).
6. Click **No thanks**: never reappears.
7. Reset; show prompt; click **Rate**: CWS reviews tab opens; prompt does not return.
8. Confirm content script / while watching never shows the prompt.
9. Dashboard: prompt appears after tiles when eligible; not during active `#review` session.
10. After web deploy with `EXTENSION_AE` live: trigger a real prompt show from the
    published extension, then confirm a row via Analytics Engine SQL
    (`SELECT blob1, SUM(double1) FROM extension_funnel GROUP BY blob1`). A bare
    curl without the extension Origin/id header must 204 **without** writing.
11. Product note (intentional): an unanswered ask re-renders on every
    popup/dashboard open until the user clicks Rate / Maybe later / No thanks
    ("max 2 asks" caps counted asks, not idle remounts).
