# DEVIATIONS.md

Spec deviations recorded during implementation:

- **`pickTarget` session Set:** The architecture table lists `pickTarget(tokens, wordStates, settings)` but `docs/02` §5 rule 6 requires the session-local targeted `Set` from `main.js`. Implemented as a fourth argument `targetedSet` passed from `main.js`.
- **TypeScript migration (v0.4):** The original spec mandated plain JS with no build step. The project has since outgrown the spec (listening mode, dashboard, planned multi-language support), so sources now live in `src/` as TypeScript ES modules and are bundled per-context into `extension/` with esbuild. The `AVC` global namespace is gone (module imports instead); the runtime file layout, manifest shape, and all behavior are unchanged. `window.__avcMainLoaded` is kept as the injection guard.
