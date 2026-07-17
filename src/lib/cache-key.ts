/** Derive a shared transcript cache key for the current page. */

export type PlatformId = "youtube" | "netflix" | "crunchyroll" | "generic";

export interface CacheKeyResult {
  key: string;
  platform: PlatformId;
  contentId: string;
  audioLang: string;
}

const ALLOWED_AUDIO_LANGS = new Set(["ja", "en"]);

export function cacheKey(platform: PlatformId, contentId: string, audioLang: string): string {
  const lang = ALLOWED_AUDIO_LANGS.has(audioLang) ? audioLang : "ja";
  if (platform === "generic") {
    return `fp:${contentId}:${lang}`;
  }
  return `${platform}:${contentId}:${lang}`;
}

/** Prefer an explicit study language; fall back to media track detection. */
export function detectAudioLang(
  video?: HTMLVideoElement | null,
  preferred?: "ja" | "en" | null
): string {
  if (preferred === "ja" || preferred === "en") return preferred;
  const v = video || document.querySelector<HTMLVideoElement>("video");
  const tracks =
    v &&
    (
      v as HTMLVideoElement & {
        audioTracks?: { length: number; [i: number]: { enabled?: boolean; language?: string } };
      }
    ).audioTracks;
  if (tracks && tracks.length) {
    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i];
      if (track.enabled && track.language) {
        const code = track.language.slice(0, 2).toLowerCase();
        if (ALLOWED_AUDIO_LANGS.has(code)) return code;
      }
    }
  }
  return "ja";
}

export function deriveContentId(platform: PlatformId): string | null {
  switch (platform) {
    case "youtube": {
      const m = location.search.match(/[?&]v=([^&]+)/);
      if (m) return m[1];
      const pathMatch = location.pathname.match(/^\/(?:shorts|live)\/([^/?]+)/);
      return pathMatch ? pathMatch[1] : null;
    }
    case "netflix": {
      const watch = location.pathname.match(/\/watch\/(\d+)/);
      if (watch) return watch[1];
      const id = (window as Window & { __avcNetflixVideoId?: string }).__avcNetflixVideoId;
      return id || null;
    }
    case "crunchyroll": {
      const parts = location.pathname.split("/").filter(Boolean);
      const watchIdx = parts.indexOf("watch");
      if (watchIdx >= 0) {
        for (let i = watchIdx + 1; i < parts.length; i++) {
          if (/^[A-Z0-9]{8,}$/.test(parts[i])) return parts[i];
        }
      }
      return null;
    }
    default:
      return null;
  }
}

export function deriveCacheKey(
  platform: PlatformId,
  video?: HTMLVideoElement | null,
  preferredLang?: "ja" | "en" | null
): CacheKeyResult | null {
  const contentId = deriveContentId(platform);
  if (!contentId) return null;
  const lang = detectAudioLang(video, preferredLang);
  return { key: cacheKey(platform, contentId, lang), platform, contentId, audioLang: lang };
}

/** Session identity for detecting SPA navigations (YouTube ?v= changes without pathname change). */
export function sessionIdentity(
  platform: PlatformId,
  preferredLang?: "ja" | "en" | null
): string {
  const id = deriveContentId(platform);
  const lang = detectAudioLang(undefined, preferredLang);
  return id ? `${platform}:${id}:${lang}` : location.pathname;
}
