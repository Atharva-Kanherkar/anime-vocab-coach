# Anime Vocab Coach Pro backend

A single Cloudflare Worker that powers the Pro subscription ($10/month or
$84/year, 45 listening-hours per month). It does three small jobs:

1. **License checks** — validates the user's license key against Dodo Payments.
   Keys are attached to the subscription, so Dodo invalidates them
   automatically when a subscription lapses.
2. **Metering** — counts listening minutes per license per calendar month in
   Workers KV and enforces the fair-use cap (`CAP_MINUTES`, default 2700 = 45 h).
3. **Token minting** — creates short-lived ephemeral OpenAI Realtime tokens so
   the extension can stream audio **directly to OpenAI**. Audio never touches
   this server, and the real OpenAI key never leaves it.

## Why this scales (and what it costs you)

- The Worker only handles a handful of tiny JSON requests per user per hour
  (one token mint per ~60 min session + one heartbeat per 5 min). Cloudflare's
  free tier (100k requests/day) covers roughly 5,000 active subscribers before
  you'd even consider the $5/mo paid plan.
- **One OpenAI API key** is all you need — scaling is handled by OpenAI's
  rate-limit tiers, not by adding keys. gpt-4o-mini-transcribe costs about
  $0.18 per hour of audio, so a worst-case subscriber (45 h) costs ~$8.10
  against $10 revenue, and a typical one (10–15 h) costs $2–3.
- No servers, no database, no containers. KV stores two kinds of keys:
  6-hour license-validity caches and per-month minute counters (self-expiring).

## Deploy (one time, ~15 minutes)

```bash
cd backend
npm install
npx wrangler login
npx wrangler kv namespace create AVC_KV     # paste the printed id into wrangler.toml
npx wrangler secret put OPENAI_API_KEY      # from platform.openai.com (add billing + a monthly budget cap!)
npx wrangler secret put DODO_API_KEY        # Dodo dashboard -> Developer -> API Keys
npx wrangler deploy                          # prints https://avc-api.<subdomain>.workers.dev
```

Then put the deployed URL into `src/config.ts` (extension repo root) as
`BACKEND_URL` and rebuild the extension.

## Dodo Payments setup

1. Sign up at dodopayments.com (Indian founders supported; KYC with PAN,
   payouts to your Indian bank as export-of-services remittance).
2. Create a **subscription product** "Anime Vocab Coach Pro":
   - $10/month, and optionally a $84/year variant.
   - Enable **license keys** on the product (auto-generated, emailed on purchase).
3. Copy the product's checkout link into `src/config.ts` as `CHECKOUT_URL`.
4. While testing, point `DODO_API_BASE` in `wrangler.toml` at
   `https://test.dodopayments.com` and use test-mode keys.

> Note: the exact request/response fields of Dodo's `/licenses/activate` and
> `/licenses/validate` endpoints should be verified against their current API
> docs before going live — `src/dodo.ts` is written to be easy to adjust.

## Endpoints

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/v1/license/activate` | body `{licenseKey}` | First-time activation from the options page |
| GET | `/v1/license/status` | `Bearer <license>` | Plan status + hours used, shown in options |
| POST | `/v1/session` | `Bearer <license>` | Mint an ephemeral OpenAI token for one listening session |
| POST | `/v1/usage/heartbeat` | `Bearer <license>` | Extension reports ≤5 listening minutes; 429 once over cap |

## Abuse & cost controls

- Ephemeral tokens expire in 120 s if unused and are locked to a
  transcription-only session config — they can't be used for chat completions.
- Heartbeats are clamped to 10 min per report; a tampered client that skips
  heartbeats steals at most its own subscription's fair-use headroom, and you
  can revoke any license from the Dodo dashboard.
- Set a **hard monthly budget cap on the OpenAI account** as the final
  backstop. If OpenAI rejects a mint, users see a clean error and you get no
  surprise bill.
