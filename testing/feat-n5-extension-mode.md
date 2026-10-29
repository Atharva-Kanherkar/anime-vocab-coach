# feat-n5-extension-mode: Test Contract

## Functional Behavior

- Begin #175 under epic #173 on top of the merged #177 backend foundation and #178 hosted frontend pilot. The extension consumes the stable hosted lesson/attempt/result routes and the authenticated `/v1/n5` API; it never embeds credentials, answer keys, raw summaries, audio or bearer tokens in provider-page DOM, query strings or cross-origin messages.
- Add an explicit **N5 Course** mode entry (popup/copilot) showing the active anime, unit, episode, script, due reviews and next action. Course context carries versioned course/track/unit/episode identifiers from backend payloads, not guessed tab titles. Keep free watching available independently.
- Course script is a deliberate pure-script choice (romaji or kana) that is separate from general app settings; entering/exiting course mode preserves ordinary settings and the existing deck.
- Watching is a timestamped observation, never assessment credit: “Finish episode and practise” at playback completion or explicit user action only; skip/seek/replay cannot create a pass; persist completion locally before network transmission, then reconcile via stable event IDs.
- On explicit test handoff, pause playback and stop/suspend tab-audio capture before opening the durable hosted assessment tab, so anime audio cannot contaminate the learner microphone; surface failures clearly. Resuming viewing/listening is an explicit action and reuses existing capture permissions.
- Receive validated course-state changes through the existing AnimeVocab origin bridge and authenticated API; narrow message schemas with origin/source checks; streaming content scripts cannot send trusted grade claims; on hosted completion, refresh progress and apply backend-generated review events to the existing SRS once.
- Recovery: worker restart, browser restart, lost network, expired auth, course version change and an assessment open in another tab. Do not silently discard a local outbox when switching shows; partition cache/outbox by user; sign-out/account-switch cannot attach prior-user evidence to a new account.

## Unit Tests

- Course context parse: versioned IDs, selected pure script, lesson goals, next action; malformed context rejected.
- Playback-state classification: completion vs skip/seek/replay; only completion can enqueue a watch observation.
- Observation/outbox payload: stable event IDs, bounded payloads, offline provisional status, no private answer keys or authoritative pass state cached on watch pages.

## Integration / Functional Tests

- Extension → hosted web runner handoff through the durable hosted tab; no credentials/answers cross origin except via authenticated API. Gateway, backend and hosted runner behaviour covered by #177/#178 tests; extension-side tests assert no provider-page code receives credentials or answers.

## Smoke Tests

- Extension typecheck/lint/test suite pass; existing deck, Listening Mode and sync behaviour unchanged when course flag is off.

## E2E Tests

- Fresh-profile Playwright extension tests cover N5 navigation, autoplay episode matching, offline/restart recovery, both pure scripts, handoff pause/capture stop, and hosted assessment handoff. Real provider behaviour verified with legitimate user access; no DRM bypass or sign-in shortcut.

## Manual / cURL Tests

- Document extension install/load steps and the hosted route handoff URLs used in local dev. No production activation, real credentials, model spend or production deployment is performed by this issue's tests.

## Acceptance Mapping

- A new learner selects Your Lie in April episode 1, chooses either script, watches with existing features, and opens the correct hosted assessment.
- Finishing an episode records watched state, while only server-verified assessment evidence changes course mastery.

## Dependencies

- Backend contract/sample pack (#177) first; frontend provides the stable runner route and completion signal; end-to-end validation is shared across all three issues (#174/#175/#176).
