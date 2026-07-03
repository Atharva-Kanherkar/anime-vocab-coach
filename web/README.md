# web/ — AnimeVocab marketing site (Next.js)

The public site at **animevocab.com** lives here. The legacy static HTML version is in `../site/` (deprecated).

## Develop

```bash
cd web
npm install
npm run dev
```

Open http://localhost:3000

## Preview on Cloudflare runtime (before deploy)

```bash
npm run preview
```

## Deploy

```bash
npm run deploy
```

Or from repo root: `npm run deploy:site`

Requires `wrangler login` locally, or `CLOUDFLARE_API_TOKEN` in CI.

## Stack

- **Next.js 16** (App Router)
- **@opennextjs/cloudflare** → Cloudflare Workers + Assets
- Custom FX slider hero (inspired by Framer marketplace patterns; not Framer code)

## Env

Optional in `.env.local`:

```
NEXT_PUBLIC_API_BASE=https://api.animevocab.com
```

Used for live promo pricing from the Pro API.
