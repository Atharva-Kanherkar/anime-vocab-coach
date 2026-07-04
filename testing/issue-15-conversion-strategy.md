# issue-15-conversion-strategy - Test Contract

Issue #15 is a business/design deliverable, not a runtime feature. The artifact is a
strategy document plus one copy change. "Tests" here are review checks against the
acceptance criteria and a build check for the copy change.

## Deliverable Checks

- `docs/conversion-strategy.md` exists and answers all four acceptance criteria:
  - AC1: five upgrade prompts each mapped to a real UI location (file/component + trigger + copy).
  - AC2: Free vs Pro (vs possible Cloud) feature table with an explicit bundle-vs-separate recommendation.
  - AC3: a first pricing experiment with success metrics and a config-only rollback plan.
  - AC4: local-ownership framing copy, both existing strings and the one added here.
- Every pricing/cost claim is backed by a cited source (July 2026), listed in a Sources section.
- The four pricing questions from the issue are answered explicitly.

## Grounding Accuracy

- Competitor prices match cited sources: Language Reactor $5/mo, Migaku $9/mo·$87/yr·$399 lifetime.
- Transcription cost matches OpenAI pricing: gpt-4o-mini-transcribe $0.003/min.
- Dodo fee correction (6% + $0.40 international) matches dodopayments.com/pricing and is
  flagged as a recommendation under #16, not silently applied.
- Margin table math is internally consistent with `docs/unit-economics.md`.

## Copy Change (AC4)

- `web/src/components/site-chrome.tsx` Pro pricing card gains one local-ownership
  reassurance line beside the checkout CTA.
- Framing does not remove or paywall any capability the free tier has today.

## Build / Lint

- `cd web && npm run build` compiles with the copy change.
- `cd web && npx eslint src` passes.

## Manual Verification

- Visit `/#pricing`: Pro card shows the local-ownership reassurance line beside "Get Pro".
- No free-tier capability is reworded to sound paid.
