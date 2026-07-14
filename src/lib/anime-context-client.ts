import { WEB_URL } from "../config";
import { getSyncToken } from "./storage";

const sessionCache = new Map<string, string>();

// Content-side entry: content scripts can't call the web API cross-origin (no
// CORS headers on /api/anime/context), so ask the background service worker to
// fetch, then cache the answer locally so peekAnimeContext stays synchronous.
export async function requestAnimeContext(title: string | null): Promise<string | null> {
  const clean = (title || "").trim();
  if (!clean) return null;
  const cached = sessionCache.get(clean.toLowerCase());
  if (cached) return cached;
  try {
    const res = (await chrome.runtime.sendMessage({
      type: "avc-anime-context",
      title: clean,
    })) as { ok?: boolean; context?: string } | undefined;
    const ctx = (res?.context || "").trim();
    if (ctx) sessionCache.set(clean.toLowerCase(), ctx);
    return ctx || null;
  } catch {
    return null;
  }
}

// Background-side: the actual network fetch (runs with the extension origin +
// host permission, so it isn't blocked by page CORS).
export async function fetchAnimeContext(title: string | null): Promise<string | null> {
  const clean = (title || "").trim();
  if (!clean) return null;

  const cached = sessionCache.get(clean.toLowerCase());
  if (cached) return cached;

  const token = await getSyncToken();
  if (!token) return null;

  try {
    const res = await fetch(
      WEB_URL + "/api/anime/context?title=" + encodeURIComponent(clean),
      { headers: { Authorization: "Bearer " + token } }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { context?: string };
    const ctx = (data.context || "").trim();
    if (ctx) sessionCache.set(clean.toLowerCase(), ctx);
    return ctx || null;
  } catch {
    return null;
  }
}

export function peekAnimeContext(title: string | null): string | null {
  const clean = (title || "").trim();
  if (!clean) return null;
  return sessionCache.get(clean.toLowerCase()) || null;
}
