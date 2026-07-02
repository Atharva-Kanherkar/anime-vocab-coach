# DEVIATIONS.md

Spec deviations recorded during implementation:

- **`pickTarget` session Set:** The architecture table lists `pickTarget(tokens, wordStates, settings)` but `docs/02` §5 rule 6 requires the session-local targeted `Set` from `main.js`. Implemented as a fourth argument `targetedSet` passed from `main.js`.
