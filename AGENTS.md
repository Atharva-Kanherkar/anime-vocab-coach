# Instructions for the implementing agent

You are building a Chrome MV3 extension from a finished spec. Your job is **execution, not design**. All decisions are already made.

## Rules

1. **Read order:** `README.md` → this file → `docs/00` → `docs/01` → `docs/02` → `docs/03`. Then implement milestone by milestone from `docs/03-MILESTONES.md`, consulting `docs/04`–`docs/06` when a milestone tells you to.
2. **One milestone at a time.** Each milestone in `docs/03-MILESTONES.md` ends with an **Acceptance** block. You must actually perform that test (load the unpacked extension, open the named URL, check the console/UI) and confirm it passes before touching the next milestone. If you cannot run a browser, stop and ask the user to run the acceptance test.
3. **Do not substitute.** No TypeScript, no bundlers, no React, no different tokenizer, no different storage layer. If a library version is pinned, use that version. "It would be cleaner if…" is out of scope.
4. **Do not rewrite provided code.** `scripts/build-dictionary.mjs` is complete; run it as documented. Code blocks in the docs marked `VERBATIM` must be copied character-for-character.
5. **When the spec conflicts with reality** (a selector no longer exists on YouTube, a kuromoji API changed), do the smallest fix that preserves the spec's intent, and record it in a new file `DEVIATIONS.md` (one bullet per deviation: what the spec said, what you did, why).
6. **Never guess Japanese-language behavior.** Tokenization, readings, and deinflection are handled by kuromoji + the dictionary. Do not add your own linguistic heuristics beyond what `docs/02-DATA-MODEL.md` specifies.
7. **Commit per milestone**, message format: `M<n>: <milestone title>`. No AI attribution of any kind in commits.
8. **Keep the global namespace pattern.** All content-script code hangs off a single global object `AVC` (see `docs/01-ARCHITECTURE.md` §4). Content scripts cannot use ES modules; do not try.
9. **Console logging:** every module logs through `AVC.log(...)` which prefixes `[AVC]`. Acceptance tests grep for these prefixes. Do not remove them until M9 says so.
10. **If storage schema needs a field the spec forgot**, add it, but only additively, and record it in `DEVIATIONS.md`.

## Working environment assumptions

- Node ≥ 18 available (for `scripts/build-dictionary.mjs` only — the extension itself has no build step).
- Chrome/Chromium available with `chrome://extensions` → Developer mode → "Load unpacked".
- Network available once, to download JMdict during M3.

## Directory you produce

Everything you build lives in `extension/` at the repo root, exactly matching the tree in `docs/01-ARCHITECTURE.md` §2. The repo root also gains `data/` build artifacts as described in M3. Nothing else.
