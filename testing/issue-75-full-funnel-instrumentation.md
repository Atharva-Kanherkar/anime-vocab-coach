# Issue 75 Full Funnel Instrumentation — Test Contract

## Functional Behavior

- A first visit to any public marketing page records one `landing_view` event with only allowlisted `utm_source`, `utm_medium`, and `utm_campaign` values from the URL.
- A click from an owned marketing page to the Chrome Web Store records `store_cta_click` before navigation and preserves a stable owned-link campaign on the destination URL.
- A mobile visitor who is offered the existing mobile capture path records `mobile_capture_shown`; a successful submission records `mobile_capture_submitted`. If no mobile capture UI exists in this checkout, the event names remain reserved and tested without inventing a new lead-capture product surface.
- The extension records each of these lifecycle milestones at most once per install: `signup_completed`, `first_card_created`, and `first_srs_review`.
- The extension records `upgrade_prompt_shown`, `upgrade_prompt_clicked`, and `checkout_started` at the corresponding upgrade UI boundaries. Repeated prompt impressions and checkout attempts remain countable; lifecycle milestones remain deduplicated.
- Extension events use the existing authenticated extension beacon. Website events use the existing first-party `/api/track` beacon and Analytics Engine dataset.
- Event names and campaign fields are allowlisted, bounded, and contain no email, word text, video URL, user-entered content, or persistent visitor identifier.
- Owned Chrome Web Store links in the active Next.js marketing app, legacy static marketing pages, and extension-origin website links carry explicit `utm_source`, `utm_medium`, and `utm_campaign` values.
- A weekly report command prints counts for visits, store clicks, signups, first cards, first reviews, upgrade interest, checkout starts, and payers. Chrome Web Store installs are accepted as a manual input because the repository has no authenticated CWS reporting integration.

## Unit Tests

- `track-events.test.ts` accepts every new site-funnel event and rejects arbitrary event names.
- Attribution tests normalize valid UTM values, bound cardinality, reject malformed values, and never expose arbitrary query parameters.
- Extension funnel tests keep the browser and server allowlists identical and reject unknown events.
- Extension milestone tests prove lifecycle events are emitted once and repeatable commerce events remain repeatable.
- Weekly funnel report tests aggregate event counts, accept an optional CWS install count, and calculate step conversion rates without division errors.

## Integration / Functional Tests

- Posting an allowlisted site event to `/api/track` writes the expected event and campaign dimensions to the Analytics Engine test sink.
- Posting an allowlisted extension event through `/api/extension/track` writes it to the extension dataset; invalid event names still produce no write.
- The landing tracker emits `landing_view` once per browser visit, records a tagged store click, and does not delay navigation.
- Extension sign-in completion, first card creation, first SRS judgment, upgrade prompt display/click, and checkout initiation are wired to the event helper.
- The owner reporting query or script reads both website and extension event sources and labels CWS installs as manual/external data.

## Smoke Tests

- `npm run typecheck`, `npm run test:unit`, and `npm run build` pass at the repository root.
- `npm run test:unit`, `npm run lint`, and `npm run build` pass in `web/`.
- `npm run typecheck` and `npm test` pass in `backend/` when backend files are affected.
- The marketing homepage renders with working Chrome Web Store links.
- The extension package builds and its manifest remains valid.

## E2E Tests

- Run the existing web core-loop E2E test when its browser/runtime prerequisites are available.
- Run the existing extension review E2E test when its local browser/runtime prerequisites are available.
- If an E2E prerequisite is unavailable, document the exact limitation and retain unit/integration coverage for the affected instrumentation path.

## Manual / cURL Tests

- Open `/?utm_source=instagram&utm_medium=reel&utm_campaign=demo_format`, click an Add to Chrome CTA, and confirm requests for `landing_view` and `store_cta_click` complete without blocking navigation.
- POST `{ "kind": "feature", "name": "store_cta_click", "utm_source": "instagram", "utm_medium": "reel", "utm_campaign": "demo_format" }` to `/api/track`; expect HTTP 204 and one allowlisted Analytics Engine write.
- POST an unknown event and overlong campaign values to `/api/track`; expect HTTP 204 and no unbounded value to be stored.
- Trigger one new card and one first SRS judgment in a clean extension profile; confirm each lifecycle milestone is sent once after repeated actions.
- Run the weekly funnel report for a fixed seven-day fixture with a supplied CWS install count and compare every displayed count and conversion rate to the fixture.
