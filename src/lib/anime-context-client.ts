import { WEB_URL } from "../config";
import { getSyncToken } from "./storage";

const sessionCache = new Map<string, string>();

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
