# Deploy AnimeVocab (Cloudflare)

Two things live on Cloudflare: the **marketing site** (Pages) and the **Pro API** (Worker).
Both are free at your scale.

## Live URLs

| Service | URL |
| --- | --- |
| Marketing site | https://animevocab.pages.dev |
| Pro API (after Worker deploy) | `https://avc-api.<your-subdomain>.workers.dev` |

After buying **animevocab.com**: Cloudflare dashboard → Pages → animevocab → Custom domains → add the domain.

1. Buy **animevocab.com** (Cloudflare Registrar is easiest — domain is on Cloudflare automatically).
2. Create a [Cloudflare account](https://dash.cloudflare.com/sign-up) if you don't have one.
3. If you bought the domain elsewhere, add the site in Cloudflare and point your registrar's nameservers to Cloudflare.

## One-time: log in from your machine

```bash
npx wrangler login
```

This opens a browser; approve access. After that, an agent (or you) can deploy from this repo.

---

## 1. Marketing site → Cloudflare Pages

From the repo root:

```bash
npm run deploy:site
```

First run creates the Pages project `animevocab`. You'll get a URL like `https://animevocab.pages.dev`.

**Custom domain:** Cloudflare dashboard → Workers & Pages → animevocab → Custom domains → add `animevocab.com` and `www.animevocab.com`. Cloudflare creates DNS records automatically if the zone is on Cloudflare.

---

## 2. Pro API → Cloudflare Worker

```bash
cd backend
npm install
npx wrangler kv namespace create AVC_KV    # paste id into backend/wrangler.toml
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put DODO_API_KEY
npm run deploy
```

Copy the printed URL (e.g. `https://avc-api.<subdomain>.workers.dev`) into `src/config.ts` as `BACKEND_URL`, then `npm run build` and reload the extension.

Optional: add a custom route in Cloudflare (e.g. `api.animevocab.com`) → Worker `avc-api`.

---

## GitHub auto-deploy (recommended)

Pushes to `master` run [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml), which deploys:

| Job | Target | Command |
| --- | --- | --- |
| **Deploy marketing site** | Cloudflare Pages project `animevocab` | `wrangler pages deploy` from `site/` |
| **Deploy Pro API** | Cloudflare Worker `avc-api` | `wrangler deploy` from `backend/` |

### One-time GitHub setup

1. Create a Cloudflare API token: [dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens) → **Create Token** → **Edit Cloudflare Workers** template (or custom token with **Account → Workers Scripts → Edit**, **Workers KV Storage → Edit**, **Cloudflare Pages → Edit**).
2. Add it to GitHub: repo **Settings → Secrets and variables → Actions → New repository secret**
   - Name: `CLOUDFLARE_API_TOKEN`
   - Value: your token
3. **Disable duplicate Cloudflare Git builds** (they cause the red “Workers Builds: avc-api” check and wrong root directory):
   - Cloudflare dashboard → **Workers & Pages** → **avc-api** → **Settings** → **Builds** → disconnect Git / disable automatic builds
   - If Pages is also connected to Git separately, disconnect that too — the GitHub Action handles both deploys.

After the secret is set, merge to `master` and watch **Actions → Deploy**.

### Manual deploy (fallback)

```bash
npm run deploy:site   # marketing site → Pages
npm run deploy:api    # Pro API → Worker avc-api
```

---

## GitHub auto-deploy (legacy Cloudflare dashboard)

<details>
<summary>Cloudflare Pages Git integration only (site)</summary>

Connect the repo in Cloudflare Pages (Workers & Pages → Create → Connect to Git). Settings:

| Setting | Value |
| --- | --- |
| Build command | *(empty)* |
| Build output directory | `site` |
| Root directory | `/` |

Prefer the GitHub Action above so the API deploys on the same merge.
</details>

---

## Checklist after domain is live

- [ ] `https://animevocab.com` loads the landing page
- [ ] `https://animevocab.com/privacy.html` loads (Chrome Web Store needs this URL in the listing)
- [ ] Worker deployed; `BACKEND_URL` in `src/config.ts` updated
- [ ] Add `og.png` (1200×630) to `site/` for social previews
