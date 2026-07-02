# animevocab.com — marketing site

Dependency-free static site (HTML/CSS only, no build step).

## Deploy (Cloudflare Pages, free)

1. Cloudflare dashboard → Workers & Pages → Create → Pages → connect this repo.
2. Build settings: no build command, output directory `site`.
3. Add the custom domain once purchased.

If the final domain differs from `animevocab.com`, update the `canonical`,
`og:url` URLs (index.html, privacy.html), `robots.txt`, and `sitemap.xml`.

An `og.png` (1200×630 social preview image) should be added before launch.
