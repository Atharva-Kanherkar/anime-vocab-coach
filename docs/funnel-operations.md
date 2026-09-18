# Funnel operations

Run the weekly report with Cloudflare Analytics Read credentials and the two external totals:

```bash
npm run funnel:weekly -- --days 7 --installs 42 --payers 3
```

Chrome Web Store installs come from the CWS weekly acquisition report; payer count comes from Dodo. They are explicit inputs because neither service is authenticated in this repository.

## Owned-link campaigns

- Chrome Web Store “Website” field: `https://animevocab.com/?utm_source=chrome_web_store&utm_medium=store_listing&utm_campaign=cws_profile`
- Instagram/TikTok link in bio, one campaign per reel format: `https://animevocab.com/?utm_source=instagram&utm_medium=reel&utm_campaign=<format_name>`
- YouTube description: `https://animevocab.com/?utm_source=youtube&utm_medium=video&utm_campaign=<series_or_format>`
- Email templates and extension links are tagged in code.
- Website install CTAs are tagged at click time using the landing page path as `utm_campaign`.

Use lowercase letters, numbers, dots, underscores, and hyphens only. Keep the same campaign name for the same creative format so weekly comparisons stay meaningful.
