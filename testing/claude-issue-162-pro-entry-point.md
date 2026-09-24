# Issue 162 Pro Entry Point: Test Contract

Pro is invisible: `/pricing` had 2 signed-in visitors in 90 days, 0 listening cap hits,
all 39 AI users are free. Nobody ever meets the offer.

## Context (investigated before this contract)

- Every upgrade prompt that exists today fires only at a limit: the popup CTA at 80% of a
  meter (`src/entries/popup.ts`), the copilot limit sheet at 100% (`src/lib/agent-panel.ts`).
  Nobody reaches a limit, so nobody sees Pro.
- `/app` has no Pro entry point outside the Billing tab, which is 11th in the nav.
- Those prompts write `upgrade_prompt_shown/clicked` and `checkout_started` to the
  `extension_funnel` dataset: aggregate counters with no user and no surface. The popup
  and the copilot write the same names, so the two cannot be told apart.
- `upgrade_click` and `checkout_start` are on the web `/api/track` allowlist and nothing
  has ever fired them.
- `/api/track` feature rows already carry a userId (Clerk cookie or the extension's sync
  token, #112) and the extension build (#159). Only the surface is missing.
- `card_unlocked` (32 events, 5 users) is derived by the sync route. `/app` computes the
  same level client side from the synced snapshot (`cards-panel.tsx`). The extension has
  no collectible level, so its value moment is the number of words kept.
- What Pro sells today is still more Listening Mode and coach messages. #146's Scene Card
  does not exist yet, so no copy may promise it. Copy leads with the outcome sentence from
  #146 ("Understand and remember the anime you watch"), keeps the ownership line, and
  uses no em dashes.
- Free tier stays exactly as generous (#146). Nothing here lowers a limit or gates a
  feature; every prompt is dismissible and never blocks a flow.

## Functional Behavior

### Telemetry: shown → clicked → checkout, per surface

- New feature events on the `/api/track` allowlist: `pro_prompt_shown`,
  `pro_prompt_clicked`, `pro_checkout_started`. The never-fired `upgrade_click` and
  `checkout_start` are removed.
- Surfaces (allowlisted, anything else is `""`):
  - web: `app_header`, `app_unlock`, `app_billing`, `pricing`, `home`
  - extension: `ext_popup`, `ext_milestone`, `ext_popup_limit`, `ext_limit_sheet`
- `EVENT_BLOBS` gains `surface`, appended as blob16. The first 15 positions do not move.
- `/api/track` writes the surface only on the three Pro events; every other row writes
  `""`, whatever the body says.
- A checkout is attributed to the surface that started the journey: the last Pro prompt
  the visitor clicked in this browser session, else the page's own surface. `/pricing`
  adopts an allowlisted `?from=` on arrival so an extension click that lands there keeps
  its surface.
- Surfaces that open Dodo directly (the two limit prompts, `/pricing`, `/app` billing,
  home plan cards) fire clicked and checkout on the same click.
- Persistent entry points fire `shown` once per browser session (web) or once per popup
  open (extension), not once per render.
- The extension keeps writing its old `extension_funnel` counters from the limit prompts,
  so the existing panel does not go dark.

### /app

- Free users see a quiet **Pro** entry in the header. Clicking it opens the Billing
  section. Pro, Max and gifted accounts see nothing.
- Card-unlock moment: when the synced level rises above the level this browser last saw,
  a dismissible banner names the newest unlocked card, links to it, and offers Pro.
  - The first level this browser observes is stored silently. An import is not an unlock
    (same rule as the sync route).
  - It is evaluated only after the server snapshot has been fetched without error, so the
    empty pre-fetch snapshot can never be mistaken for level 1.
  - Shown once per unlock: the stored level advances as soon as it shows.
  - Free plan only.
- The Billing panel's checkout links fire the checkout event.

### /pricing and home

- Plan cards fire `pro_prompt_shown` once per session and clicked + checkout on a paid
  plan's link, with `pricing` on /pricing and `home` on the homepage.

### Extension popup

- Signed-in free users get a quiet "See Pro" link in the usage header next to the plan
  name. It opens `/pricing?from=ext_popup`.
- Milestone moment at 10, 25, 50, 100, 250, 500 and 1000 words kept: a dismissible card
  "You've kept N words" with the outcome line and "See Pro", opening
  `/pricing?from=ext_milestone`. Each milestone shows once. The first observation is
  stored silently, so an existing learner is not greeted with a stale milestone.
- Not shown to signed-out, Pro, Max or unlimited accounts, or when usage is unavailable.
- The existing 80% CTA and the copilot limit sheet also fire the new events with
  `ext_popup_limit` and `ext_limit_sheet`.

### /owner

- A **Pro funnel** panel: one row per surface with shown, clicked and checkout (events
  and learners), click rate (clicked / shown) and checkout rate (checkout / clicked), with
  the n beside each rate. Rates with a zero denominator read "no data yet", not 0%.
- Honours `?user=`. A failing query leaves every other panel intact and is named in the
  query-error line.
- The AI-insights digest carries the Pro funnel rows.

## Unit Tests

- `web/src/lib/pro-funnel.test.ts` (new)
  - `isProFunnelEvent` / `normalizeProSurface`: allowlisted values pass, anything else
    (unknown, wrong type, long, mixed case) is `""`.
  - `proSurfaceFromSearch` reads `?from=` and ignores unknown values.
  - `rememberProSurface` / `checkoutSurface`: remembered surface wins; fallback when
    nothing remembered; storage throwing never throws.
  - `newlyUnlocked(seenLevel, level)`: null seen → store, no moment; same level → none;
    higher level → newest card in `(seen, level]`; lower level → none.
- `web/src/lib/telemetry.test.ts`
  - `EVENT_BLOBS` keeps its first 15 names in place; `surface` is blob16.
  - `recordUserEvent` writes `surface`, `""` by default.
- `web/src/app/api/track/route.test.ts`
  - A Pro event with an allowlisted surface writes it; an unknown surface writes `""`.
  - A non-Pro feature event with a surface in the body writes `""`.
  - `upgrade_click` / `checkout_start` are dropped.
- `web/src/lib/owner-pro-funnel.test.ts` (new)
  - `proFunnelSql` addresses kind, name, surface, userId by schema position, filters to
    the three events, groups by surface and name, clamps the window, escapes the focus
    user.
  - `foldProFunnel` pivots rows into one per surface, discounts the anon bucket, coerces
    strings, computes rates, leaves a rate null on a zero denominator, sorts by shown.
  - `loadOwnerDashboard`: rows land in `proFunnel`; a failing query leaves other panels
    intact and names "pro funnel" in `queryError`.
- `web/src/lib/owner-insights.test.ts`: the digest has a "Pro funnel" section.
- `test/feature-events.test.ts` (root)
  - The extension's Pro events and surfaces mirror the web allowlists.
  - The beacon body carries the surface for Pro events and never for others.
- `test/pro-moment.test.ts` (root, new)
  - `milestoneReached(seen, words)`: first observation stores silently; crossing 10 →
    10; jumping 8 → 60 → 50 (highest crossed, once); already seen → null; below 10 → null.
  - `proPromptEligible(usage)`: only signed-in free, not unlimited.

## Integration / Functional Tests

- `/api/track` route test drives the real handler into a captured AE sink (above).
- `loadOwnerDashboard` with a stubbed query runner (above).
- Typecheck both packages; lint web; `npm run build` for the extension.

## Smoke Tests

- `/pricing`, `/`, `/app`, `/owner` render in `next dev` with no console errors.

## E2E Tests

- `web/e2e/pro-entry.mjs` (new, Playwright against `next dev` with the dev Clerk bypass,
  AE SQL mocked as in `observability.mjs`, `/api/track` observed in the browser):
  - `/app` header shows the Pro entry; clicking it lands on Billing and posts
    `pro_prompt_clicked` with `app_header`.
  - With a stored seen level below the synced level, the unlock banner names a card and
    posts `pro_prompt_shown` with `app_unlock`; after dismiss and reload it stays gone.
  - `/pricing?from=ext_milestone`: clicking a Pro checkout link posts
    `pro_checkout_started` with `ext_milestone` (navigation to Dodo blocked).
  - `/owner` renders the Pro funnel panel from mocked rows.
- Extension popup: rendered with mocked usage in Playwright (as the existing extension
  e2e scripts do) if the harness supports it; otherwise covered by the unit tests above
  and stated as such in the PR.

## Manual / cURL Tests

```sh
# Allowlisted Pro event with a surface: 204, row carries surface=ext_milestone
curl -s -o /dev/null -w '%{http_code}\n' -X POST https://animevocab.com/api/track \
  -H 'content-type: application/json' \
  -d '{"kind":"feature","name":"pro_prompt_shown","surface":"ext_milestone"}'

# Unknown surface: 204, row carries surface=""
curl -s -o /dev/null -w '%{http_code}\n' -X POST https://animevocab.com/api/track \
  -H 'content-type: application/json' \
  -d '{"kind":"feature","name":"pro_prompt_clicked","surface":"evil"}'
```

- After deploy: open `/app` as a free user, see the header Pro entry; `/owner` Pro funnel
  panel shows the `app_header` row within a few minutes.
