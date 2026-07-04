# AnimeVocab Conversion Strategy: Free to Cloud/Pro

Issue: #15

Local-first is the trust wedge. The extension has to stay useful with zero account
and zero payment. Pro exists to pay for the costs the user cannot absorb themselves:
hosted transcription, AI compute, sync storage, and payment processing. Upgrade
prompts should appear at the moment hosted value is obvious, never as a random
paywall on something that used to be free.

This document answers the four acceptance criteria for #15 and grounds the pricing
calls in market data verified in July 2026 (sources at the bottom).

## Market Reality (verified)

| Product | Price | What Pro unlocks | Note |
| --- | ---: | --- | --- |
| Language Reactor | $5/mo | Machine translation, unlimited saves, Anki export | Closest competitor. Subtitle extension for Netflix/YouTube. No hosted transcription. |
| Migaku | $9/mo, $87/yr, $399 lifetime | Full SRS toolkit, immersion tracking | Sells a complete workflow, not just subtitles. |
| AnimeVocab | $10/mo, $84/yr (launch $7/$59) | No-key hosted Listening Mode, sync, AI coach | Wedge neither competitor bundles: transcription with no OpenAI key. |

Positioning read: $5 (Language Reactor) anchors the floor and $9 (Migaku) anchors
the ceiling for a subtitle-adjacent tool. AnimeVocab's regular $10 sits at the top of
that band, so the price has to be justified by the one thing neither competitor
gives you: watch anything on any site with hosted transcription and no API key. The
$7 launch promo lands right at Migaku's level while that story is still being proven.

## Cost Reality (verified)

- OpenAI `gpt-4o-mini-transcribe` is **$0.003/min ($0.18/hour)**. This confirms the
  assumption already in [`unit-economics.md`](./unit-economics.md). Full
  `gpt-4o-transcribe` is $0.006/min, so the mini model is the right default.
- Dodo Payments (the processor) charges **4% + $0.40 base, +0.5% for subscriptions,
  +1.5% for international cards**. An anime-learning audience is mostly outside the
  US, so the realistic effective rate on a subscription is **~6% + $0.40**, not the
  `5% + $0.30` placeholder currently in `unit-economics.md`. See "Finding" below.

### Finding: the payment-fee assumption is too optimistic

`unit-economics.md` and `backend/wrangler.toml` use `PAYMENT_FEE_RATE=0.05` and
`PAYMENT_FIXED_FEE_USD=0.30`. Verified Dodo pricing for an international subscription
is closer to `0.06` and `0.40`. Recommended change (owner sign-off, tracked under
#16, not silently changed here):

```toml
PAYMENT_FEE_RATE = "0.06"
PAYMENT_FIXED_FEE_USD = "0.40"
```

Net revenue at the corrected international rate (fixed fee applied once per charge,
so annual plans are more fee-efficient than monthly):

| Plan | Gross | Net after ~6% + $0.40 | Net MRR |
| --- | ---: | ---: | ---: |
| Regular monthly | $10.00/mo | $9.00 | $9.00 |
| Regular yearly | $84.00/yr | $78.56 | $6.55 |
| Launch monthly | $7.00/mo | $6.18 | $6.18 |
| Launch yearly | $59.00/yr | $55.06 | $4.59 |

A heavy Pro user at the full 45h listening cap plus 300 AI calls costs about **$8.70
in variable cost** (`unit-economics.md`). Against launch yearly net of $4.59/mo that
user is **underwater**, and against regular monthly net of $9.00 the margin is about
$0.30. This is the single most important business risk in the plan and it drives the
cap decision below.

## AC1: Five upgrade prompts mapped to exact UI locations

Each prompt fires where the hosted value is already visible on screen. File paths are
the real components in `web/src/`.

| # | Upgrade moment | Exact UI location | Trigger | CTA copy |
| --- | --- | --- | --- | --- |
| 1 | Starts Listening Mode without an API key | Extension Listening Mode entry point (`entries/` popup) + mirrored on `web/src/components/site-chrome.tsx` Pro card (`#pricing`) | User clicks Listening Mode and has no OpenAI key configured | "Skip the API key. Pro runs Listening Mode for you." |
| 2 | Wants to sync progress across browsers/devices | `web/src/components/cloud-sync-panel.tsx` (the sync panel at `/app#sync`) | User opens the sync panel while signed out or on the local-only state | "Sync this progress to your account so it follows you to any browser." |
| 3 | Saves enough notebook items that search/AI becomes useful | `web/src/components/app-dashboard.tsx` Notebooks `FeatureEmpty` card | Notebook item count crosses a threshold (start at 25) | "You have enough saved to make notebooks searchable. Unlock with Cloud." |
| 4 | Wants more AI explanations / episode recaps | `web/src/components/app-dashboard.tsx` AI coach `FeatureEmpty` card (`Pro · usage-capped`) | Free AI quota (`FREE_AI_CALLS_PER_MONTH`, default 5) is exhausted | "You have used your free AI explanations this month. Pro raises the cap to 300." |
| 5 | Wants to join challenges / leaderboards | `web/src/components/app-dashboard.tsx` Leaderboard `FeatureEmpty` card (`Opt-in social`) | User clicks into the leaderboard card | "Opt into weekly anime challenges. Cloud keeps the streak in sync." |

Sixth moment from the issue (transcript cache / no-setup value) is not a separate
prompt. It is the proof line under prompt #1: "Pro reuses a shared transcript cache,
so popular episodes are instant and cost you nothing extra." Keeping it as a benefit
line rather than its own paywall avoids prompt fatigue.

Placement rule: prompts 2 to 5 all already have a home in the shipped dashboard shell
(#12). This issue does not add new surfaces; it defines the trigger logic and copy
for surfaces that exist.

## AC2: Free vs Pro vs Cloud feature table

Recommendation: **bundle Cloud into Pro. Do not create a separate Cloud tier yet.**
Rationale: three tiers before product-market fit splits attention, complicates the
pricing page, and forces users to reason about which paid thing they need. The
cost drivers (transcription, AI) are the same account, so one paid tier is cleaner.
Revisit a separate higher "Cloud/Team" tier only if a distinct high-cost persona
appears (for example, someone syncing across a class or wanting unlimited AI).

| Capability | Free (local-first) | Pro (hosted) |
| --- | --- | --- |
| Word cards + spaced repetition | Yes | Yes |
| YouTube + HTML5 subtitle sites | Yes | Yes |
| Dashboard, JSON export, local ownership | Yes | Yes |
| Listening Mode | Yes, with your own OpenAI key | Yes, no key, hosted |
| Site coverage for Listening Mode | Your key's reach | Netflix, Crunchyroll, every site |
| Hosted listening hours | n/a | 45h/mo (`CAP_MINUTES`), see experiment below |
| Shared transcript cache | No | Yes |
| Cross-device sync | Export/import JSON manually | Automatic per-account |
| AI explanations / recaps | 5/mo (`FREE_AI_CALLS_PER_MONTH`) | 300/mo (`PRO_AI_CALLS_PER_MONTH`) |
| Notebooks (search + AI summary) | Local only | Cloud persistence + search |
| Challenges / leaderboards | No | Opt-in |
| Price | $0 | $10/mo or $84/yr (launch $7/$59) |

The free tier keeps the entire core learning loop. Nothing that works locally today
moves behind the paywall. Pro only adds hosted convenience.

## AC3: First pricing experiment and rollback plan

**Experiment: hold the launch promo, protect margin with a promo-specific cap.**

The margin math shows launch *annual* buyers at heavy listening use are unprofitable.
So the experiment is not just "keep $7/$59." It is "keep the promo price but cap the
promo's most expensive input."

Design:

1. Keep launch pricing ($7/mo, $59/yr) live through the existing window
   (`promoConfig.endUtc`, currently 2026-08-03). This is the price test.
2. Set a lower listening cap for promo-cohort accounts (for example 1500 min / 25h
   via `CAP_MINUTES`) while regular Pro keeps 45h. This protects margin on the annual
   promo without touching the price.
3. Keep the free AI quota at 5/mo. It is enough to create desire (users see the AI
   coach work) without meaningful cost (5 * $0.002 = $0.01/user/mo).

Success metrics (measured on `GET /v1/transcript/stats` plus checkout events):

- Free to Pro conversion: **target 2 to 4%** (verified realistic band), stretch 5%+.
- Blended gross margin stays **positive** at the promo price (watch `grossMarginPercent`).
- Cache hit rate high enough that most listening is served from cache, not fresh
  transcription.

**Rollback plan (all config, no code deploy):**

- Price too low / margin negative: let the promo window expire, or set
  `promoConfig.endUtc` to now, which flips every CTA back to regular $10/$84 via the
  existing `getPromoState()` logic. No component changes.
- Listening cost blowing up: lower `CAP_MINUTES` (env), or switch the provider chain
  to `groq,deepinfra,openai` after running `backend/benchmarks/QUALITY_GATE.md`.
- AI cost blowing up: lower `PRO_AI_CALLS_PER_MONTH` (env). Free quota already tiny.

Every lever above is an environment variable or a single config value. That is the
point: the pricing experiment is reversible in minutes, and the guardrails from #16
are the rollback mechanism.

## AC4: Local-ownership framing copy

The rule: every upgrade CTA sits next to a sentence that reassures the user they keep
local ownership. Paid is optional convenience, not a hostage situation.

Framing copy already shipped (keep):

- Pricing header (`site-chrome.tsx`): "The core loop is free forever. Pro pays for
  transcription compute."
- App plan bar (`app-dashboard.tsx`): "Your local extension data stays yours until
  you import or sync."
- Cloud landing proof (`cloud/page.tsx`): "Local progress should remain exportable
  and user-owned."

Framing copy added in this PR:

- Pro pricing card (`site-chrome.tsx`): "Your data stays local and exportable. Pro is
  optional hosted convenience." This is the one CTA that previously had no ownership
  reassurance directly beside it.

Copy to add when the corresponding trigger ships (specified here, wired later):

- Prompt #2 sync CTA: pair with "Your local export still works. Sync is a convenience,
  not a lock-in."
- Prompt #4 AI cap CTA: pair with "Your saved words are yours. The cap is on our
  compute cost, not your data."

## Pricing questions answered

- **Keep launch promo at $7/$59?** Yes, as the price test, but pair the annual promo
  with a lower listening cap so heavy annual buyers are not sold at a loss.
- **Should promo include fewer listening hours?** Yes. This is the core margin
  protection (see AC3). Regular Pro 45h, promo 25h.
- **Bundle Cloud with Pro or separate tier?** Bundle into Pro now. Separate tier is
  premature before PMF.
- **What free AI quota creates desire without cost risk?** 5 calls/month. Enough to
  see the AI coach work, about $0.01/user/month in cost.

## Sources

- Dodo Payments pricing (fees): https://dodopayments.com/pricing
- OpenAI transcription pricing (gpt-4o-mini-transcribe $0.003/min):
  https://costgoat.com/pricing/openai-transcription and
  https://developers.openai.com/api/docs/pricing
- Migaku pricing: https://migaku.com/pricing
- Language Reactor pricing/FAQ: https://www.languagereactor.com/help/faq
- Freemium to paid conversion benchmarks:
  https://firstpagesage.com/seo-blog/saas-freemium-conversion-rates/ and
  https://chartmogul.com/reports/saas-conversion-report/
