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

## Pilot delivery checkpoint (after merged audit #179)

- Deliver a usable episode-one extension pilot: explicit popup entry, authenticated course/script selection, original target vocabulary and examples in a compact video panel, explicit player binding, durable watch observations, safe hosted-practice handoff, and recovery after worker/network/account changes.
- Backend supplies a bounded, authenticated extension snapshot including its verified owner and the pinned lesson context. Cache keys/outbox are partitioned by verified owner and credential fingerprint. A token/account change invalidates active bindings before replay. A disabled/denied pilot is not treated as offline success.
- The course focus panel shows only reviewed-by-schema lesson renderings in the selected pure script. It suspends ordinary live overlays while active, restores them on exit, and does not change stored general settings or deck. Unknown anime/player identity requires explicit confirmation; SPA navigation/video replacement invalidates the binding. No automatic title guessing or proficiency award.
- Persist watch events before transmission with stable IDs; retry the same payload, preserve failures, bound the queue without silently dropping work, and never replay another owner's queue.
- Handoff succeeds only after the selected player's pause is acknowledged and any offscreen capture stop is acknowledged. Missing player/capture acknowledgements fail closed; no assessment tab opens. The hosted destination is fixed to the owned origin and IDs/script, never arbitrary message URLs.
- Unit/runtime tests cover ownership, strict messages, URL safety, queue duplicate/replay/bounds and state transitions. Fresh-profile actual-extension Playwright covers both scripts, pause and capture-stop success/failure, navigation invalidation, offline retry, worker restart and account switch. Fuzz and mutation tests cover pure course boundaries.
- Publish a separate static HTML architecture explainer on Vercel after verifying it locally with Playwright. Explain the learner journey, extension/background/web/API/D1/KV responsibilities, credential boundaries and implemented versus planned capabilities. No secrets or learner data are published. This explicit user request authorizes only the explainer deployment; production course flags remain off.
- Pilot capability tracking is not a claim that 70% of the six-track curriculum or voice assessment is complete. Voice, full reviewed content, SRS event consumption and automatic provider mapping remain explicit follow-ups.
