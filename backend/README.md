# AnimeVocab backend

A single Cloudflare Worker that powers hosted Listening Mode across the Free,
Pro ($8/mo), and Max ($16/mo) tiers. It does three small jobs:

1. **Auth + tiering** — authenticates callers via Clerk-linked sync tokens
   (`avc_st_*`). The caller's plan travels on the sync-token profile (the web
   app writes it from Clerk `publicMetadata.plan` when the token is minted), so
   the Worker enforces per-tier caps without calling Clerk per request. Billing
   itself (Dodo → Clerk metadata) is handled in the web app, not here.
2. **Metering** — counts listening minutes per user per calendar month in
   Workers KV and enforces the per-tier cap (`CAP_MINUTES` free = 480/8 h,
   `PRO_CAP_MINUTES` = 1200/20 h, `MAX_CAP_MINUTES` = 3600/60 h; see `plan.ts`).
3. **Shared transcript cache** — users share a per-episode transcript cache.
   Cache hits return stored segments with no audio upload; cache misses are
   transcribed server-side once via Whisper and stored in Workers KV.
4. **Token minting** — creates short-lived ephemeral OpenAI Realtime tokens for
   BYO-key users who stream audio directly to OpenAI.

## Transcription providers (cache miss path)

Batch transcription (shared cache misses) goes through a **configurable provider chain**
in `src/transcribe/`. Each provider implements the same `transcribe(audio, lang) → segments[]`
interface; responses are normalized before storage.

| Provider | Model | ~Cost/min | When to use |
|----------|-------|-----------|-------------|
| **OpenAI** (default) | `whisper-1` | ~$0.006 | **Now** — uses your OpenAI credits; no extra signup |
| Groq | `whisper-large-v3` | ~$0.002 | Optional; paid API key required |
| DeepInfra | `whisper-large-v3` | ~$0.0008 | Optional; paid API key required |

**Default:** `TRANSCRIBE_PROVIDERS=openai` in `wrangler.toml`. Only `OPENAI_API_KEY` is required.

**Later (when OpenAI credits run low):**

1. Run the quality gate: `backend/benchmarks/QUALITY_GATE.md`
2. Add secrets: `npx wrangler secret put GROQ_API_KEY` (and/or `DEEPINFRA_API_KEY`)
3. Set `TRANSCRIBE_PROVIDERS = "groq,deepinfra,openai"` — OpenAI stays as automatic fallback

Provider usage (success count, errors, estimated cost) is exposed on
`GET /v1/transcript/stats` under the `providers` field. Each provider field uses
its own KV counter key so concurrent success/error updates cannot clobber each
other. Warm cache lookups and warm transcribe hits do **not** write KV (lookup /
hit metrics were removed from those hot paths to stay under the Workers KV
free-tier put limit).

The same endpoint also
returns an `economics` field with configured plan limits, payment assumptions,
and gross-margin scenarios for light, normal, and heavy usage.

## Why this scales (and what it costs you)

- The Worker only handles a handful of tiny JSON requests per user per hour
  (one token mint per ~60 min session + one heartbeat per 5 min). Cloudflare's
  free tier (100k requests/day) covers roughly 5,000 active subscribers before
  you'd even consider the $5/mo paid plan.
- **One OpenAI API key** is all you need — scaling is handled by OpenAI's
  rate-limit tiers, not by adding keys. gpt-4o-mini-transcribe costs about
  $0.18 per hour of audio, and the shared per-episode cache means only the
  first viewer of an episode pays; everyone after hits the cache for free.
- AI feature caps are configured separately from listening caps:
  `FREE_AI_CALLS_PER_MONTH`, `PRO_AI_CALLS_PER_MONTH`,
  `MAX_AI_CALLS_PER_MONTH`, and `AI_COST_USD_PER_CALL`. Do not ship an AI
  feature without checking the model in [`docs/unit-economics.md`](../docs/unit-economics.md).
- No servers, no database, no containers. KV stores sync-token profiles,
  per-episode transcript caches, and per-month minute counters (self-expiring).

## Deploy (one time, ~15 minutes)

```bash
cd backend
npm install
npx wrangler login
npx wrangler kv namespace create AVC_KV     # paste the printed id into wrangler.toml
npx wrangler secret put OPENAI_API_KEY      # from platform.openai.com (add billing + a monthly budget cap!)
npx wrangler deploy                          # prints https://avc-api.<subdomain>.workers.dev
```

Then put the deployed URL into `src/config.ts` (extension repo root) as
`BACKEND_URL` and rebuild the extension.

## Billing / tiers

Billing lives in the **web app**, not this Worker. The Dodo checkout webhook
(`web/src/app/api/billing/dodo/webhook`) writes the buyer's plan to Clerk
`publicMetadata.plan` (`free | pro | max`). When the web app mints an extension
sync token it copies that plan onto the sync-token profile in KV, and this
Worker reads it to pick the per-tier cap (`plan.ts`). No Dodo API key or
license validation runs in the Worker.

## Endpoints

All authenticated endpoints take `Authorization: Bearer avc_st_…` (the sync
token minted by the signed-in web app).

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/v1/public/config` | none | Public plan limits + site URL |
| POST | `/v1/session` | sync token | Mint an ephemeral OpenAI token (BYO fallback); returns per-tier cap |
| POST | `/v1/usage/heartbeat` | sync token | Extension reports ≤10 listening minutes; 429 once over cap |
| GET | `/v1/transcript?key=&t=` | sync token | Lookup cached transcript segments at playback time |
| POST | `/v1/transcript/transcribe` | sync token | Server-side transcribe-on-miss `{ key, startSec, audio }` (metered) |
| GET | `/v1/transcript/stats` | sync token | Cache + per-provider transcribe metrics + economics snapshot |

## Abuse & cost controls

- Ephemeral tokens expire in 120 s if unused and are locked to a
  transcription-only session config — they can't be used for chat completions.
- Heartbeats are clamped to 10 min per report; a tampered client that skips
  heartbeats steals at most its own account's per-tier fair-use headroom.
  Sync tokens are minted by the signed-in web app and carry the user's plan.
- Set a **hard monthly budget cap on the OpenAI account** as the final
  backstop. If OpenAI rejects a mint, users see a clean error and you get no
  surprise bill.
