/** Derive a shared transcript cache key for the current page. */

export type PlatformId = "youtube" | "netflix" | "crunchyroll" | "generic";

export interface CacheKeyResult {
  key: string;
  platform: PlatformId;
  contentId: string;
  audioLang: string;
}

const AUDIO_LANG = "ja";

export function cacheKey(platform: PlatformId, contentId: string, audioLang = AUDIO_LANG): string {
  if (platform === "generic") {
    return `fp:${contentId}:${audioLang}`;
  }
  return `${platform}:${contentId}:${audioLang}`;
}

/** Extract a stable content ID from the current page URL / DOM. */
export function deriveContentId(platform: PlatformId): string | null {
  switch (platform) {
    case "youtube": {
      const m = location.search.match(/[?&]v=([^&]+)/);
      if (m) return m[1];
      const pathMatch = location.pathname.match(/^\/(?:shorts|live)\/([^/?]+)/);
      return pathMatch ? pathMatch[1] : null;
    }
    case "netflix": {
      // /watch/80192098 or movieId from PAGE-world message
      const watch = location.pathname.match(/\/watch\/(\d+)/);
      if (watch) return watch[1];
      const id = (window as Window & { __avcNetflixVideoId?: string }).__avcNetflixVideoId;
      return id || null;
    }
    case "crunchyroll": {
      // /watch/GY.../GY... episode GUID from URL
      const parts = location.pathname.split("/").filter(Boolean);
      const watchIdx = parts.indexOf("watch");
      if (watchIdx >= 0 && parts[watchIdx + 2]) return parts[watchIdx + 2];
      if (watchIdx >= 0 && parts[watchIdx + 1]) return parts[watchIdx + 1];
      return null;
    }
    default:
      return null;
  }
}

export function deriveCacheKey(platform: PlatformId, fingerprint?: string): CacheKeyResult | null {
  const contentId = deriveContentId(platform);
  if (contentId) {
    return { key: cacheKey(platform, contentId), platform, contentId, audioLang: AUDIO_LANG };
  }
  if (fingerprint) {
    return {
      key: cacheKey("generic", fingerprint),
      platform: "generic",
      contentId: fingerprint,
      audioLang: AUDIO_LANG
    };
  }
  return null;
}
