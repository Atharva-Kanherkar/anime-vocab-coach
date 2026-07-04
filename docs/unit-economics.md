# AnimeVocab Unit Economics

Issue: #16

AnimeVocab should stay local-first for the free learning loop. Pro/Cloud exists for
hosted costs: no-key Listening Mode, shared transcript cache, AI explanations, sync,
notebooks, and social features.

## Current Prices

| Plan | Gross price | Normalized MRR |
| --- | ---: | ---: |
| Regular monthly | $10/mo | $10.00 |
| Regular yearly | $84/yr | $7.00 |
| Launch monthly | $7/mo | $7.00 |
| Launch yearly | $59/yr | $4.92 |

The backend assumes a configurable payment load:

- `PAYMENT_FEE_RATE=0.05`
- `PAYMENT_FIXED_FEE_USD=0.30`

These are placeholders until Dodo's live effective fee is measured from payouts.

## Current Cost Assumptions

| Cost surface | Config | Default |
| --- | --- | ---: |
| Listening cap | `CAP_MINUTES` | 2700 min / 45 h |
| Free AI quota | `FREE_AI_CALLS_PER_MONTH` | 5 calls |
| Pro AI quota | `PRO_AI_CALLS_PER_MONTH` | 300 calls |
| AI cost estimate | `AI_COST_USD_PER_CALL` | $0.002 |
| OpenAI transcription estimate | `PROVIDER_COST_USD_PER_MIN.openai` | $0.003/min |
| Groq transcription estimate | `PROVIDER_COST_USD_PER_MIN.groq` | $0.002/min |
| DeepInfra transcription estimate | `PROVIDER_COST_USD_PER_MIN.deepinfra` | $0.0008/min |

The OpenAI estimate tracks `gpt-4o-mini-transcribe` in code. If the provider or
model changes, update `backend/src/transcribe/types.ts` and this document in the
same PR.

## Gross Margin Scenarios

Approximate net revenue after placeholder payment fees:

| Price point | Net MRR |
| --- | ---: |
| Regular monthly | $9.20 |
| Regular yearly normalized | $6.35 |
| Launch monthly | $6.35 |
| Launch yearly normalized | $4.37 |

Variable cost scenarios, using OpenAI transcription at $0.003/min:

| Listening | AI calls | Cost |
| ---: | ---: | ---: |
| 5 h | 20 | $0.94 |
| 15 h | 100 | $2.90 |
| 45 h | 300 | $8.70 |

Implications:

- Regular monthly is healthy at light/normal use and barely acceptable at max use.
- Launch yearly is not healthy for heavy users at the full 45 h cap.
- If launch yearly stays available, either reduce the included listening cap for
  promo buyers or rely on cache hits and cheaper providers before scaling it.
- AI feature launches must keep quotas explicit. A cheap model can still become a
  margin leak if every episode recap triggers multiple calls.

## Kill Switches And Caps

Backend caps now live in `backend/wrangler.toml`:

```toml
CAP_MINUTES = "2700"
FREE_AI_CALLS_PER_MONTH = "5"
PRO_AI_CALLS_PER_MONTH = "300"
AI_COST_USD_PER_CALL = "0.002"
PAYMENT_FEE_RATE = "0.05"
PAYMENT_FIXED_FEE_USD = "0.30"
```

Current runtime enforcement:

- Listening Mode is enforced by `CAP_MINUTES`.
- Heartbeats are clamped to 10 minutes.
- Server-side transcript cache misses reserve minutes before transcription and
  refund on provider failure.
- Provider cost counters are exposed at `GET /v1/transcript/stats`.

Next enforcement needed before AI features ship:

- Per-license AI usage counters.
- Monthly AI cap enforcement using `FREE_AI_CALLS_PER_MONTH` and
  `PRO_AI_CALLS_PER_MONTH`.
- User-facing cap copy when a learner hits an AI or listening limit.

## Metrics To Watch Weekly

Use `GET /v1/transcript/stats` with a valid Pro license. It now returns:

- cache hit/miss counters,
- provider success/error/minute/cost counters,
- configured provider chain,
- economics assumptions,
- plan limits,
- margin scenarios.

Weekly review checklist:

1. Cache miss rate: if high, costs scale with raw listening time.
2. Provider cost: if OpenAI credits run low, run `backend/benchmarks/QUALITY_GATE.md`
   before switching to `groq,deepinfra,openai`.
3. Heavy-user tail: if a small set of users approaches 45 h monthly, consider
   lowering promo caps before broader promotion.
4. AI quota usage once shipped: if normal users burn through 300 calls, redesign
   the AI UX around cached explanations and batch summaries.

## MRR Targets

At launch pricing:

- $1K MRR at $7 monthly requires about 143 monthly subscribers.
- $1K MRR at $59 yearly normalized requires about 203 annual subscribers.
- A mixed target is roughly 80 monthly subscribers plus 90 annual subscribers.

The operating goal for the first three months is not 30% of Migaku. It is stable
positive gross margin while proving that anime-first Japanese learners convert.
