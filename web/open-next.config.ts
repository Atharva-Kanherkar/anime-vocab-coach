import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

// Serve prerendered pages from Workers static assets and intercept cache hits
// before the Next server boots. Without this, every marketing-page request
// cold-loaded the full Next bundle (~400-800ms CPU measured via wrangler
// tail), which tripped Cloudflare 1102 "exceeded resource limits" under
// traffic bursts. The site has no ISR/PPR — content changes always redeploy —
// so the deploy-time snapshot in static assets is exactly the site.
export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
  enableCacheInterception: true,
});
