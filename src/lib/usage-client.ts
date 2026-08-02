// "How much have I got left?" for the popup and the in-player copilot.
//
// Two meters live in two places: AI messages are counted by the web Worker
// (/api/me/usage) and Listening minutes by the transcription Worker
// (/v1/usage). This module fetches both and hands back one shape, so callers
// don't care which backend owns which number.
//
// Runs in the background service worker — a content script's fetch is subject
// to the *page's* CORS, not the extension's host permissions (same reason
// tts-client splits fetch from playback).

import { BACKEND_URL, WEB_URL } from "../config";
import { getSyncToken } from "./storage";

export type Plan = "free" | "pro" | "max";

export interface Meter {
  used: number;
  limit: number;
  left: number;
}

export interface TierOffer {
  name: string;
  priceLabel: string;
  aiCallsPerMonth: number;
  listeningMinutes: number;
  checkoutUrl: string | null;
}

export interface UsageSnapshot {
  plan: Plan;
  /** Owner accounts / effectively-uncapped plans: render "unlimited", not a bar. */
  unlimited: boolean;
  /** null when that half of the fetch failed — NOT zero. A fabricated 0/0 reads
   * as a real meter and makes the limit sheet claim the learner burned through
   * "0" messages. Callers must treat null as "unknown" and omit the bar. */
  ai: Meter | null;
  auto: Meter | null;
  listening: Meter | null;
  tiers: { pro: TierOffer; max: TierOffer } | null;
}

/** Build a meter only from numbers the server actually sent. */
function meter(used: unknown, limit: unknown): Meter | null {
  const u = Number(used);
  const l = Number(limit);
  if (!Number.isFinite(u) || !Number.isFinite(l)) return null;
  const usedN = Math.max(0, Math.floor(u));
  const limitN = Math.max(0, Math.floor(l));
  return { used: usedN, limit: limitN, left: Math.max(0, limitN - usedN) };
}

/** Fetch both meters. Either half may be missing (offline, cold Worker); the
 * caller renders what it has rather than showing nothing at all. */
export async function fetchUsage(): Promise<UsageSnapshot | null> {
  const token = await getSyncToken();
  if (!token) return null;
  const headers = { Authorization: "Bearer " + token };

  const [aiRes, listenRes] = await Promise.allSettled([
    fetch(WEB_URL + "/api/me/usage", { headers }).then((r) => (r.ok ? r.json() : null)),
    fetch(BACKEND_URL + "/v1/usage", { headers }).then((r) => (r.ok ? r.json() : null)),
  ]);

  const aiData = aiRes.status === "fulfilled" ? (aiRes.value as Record<string, never> | null) : null;
  const listenData =
    listenRes.status === "fulfilled" ? (listenRes.value as Record<string, never> | null) : null;
  if (!aiData && !listenData) return null;

  const raw = (aiData || {}) as {
    plan?: Plan;
    unlimited?: boolean;
    ai?: { used?: number; limit?: number };
    auto?: { used?: number; limit?: number };
    tiers?: UsageSnapshot["tiers"];
  };
  const listen = (listenData || {}) as {
    plan?: Plan;
    usedMinutes?: number;
    capMinutes?: number;
  };

  return {
    plan: raw.plan || listen.plan || "free",
    unlimited: !!raw.unlimited,
    // Each half is independent: the AI endpoint can fail while the listening
    // one answers (and vice versa). Whatever is missing stays null.
    ai: aiData ? meter(raw.ai?.used, raw.ai?.limit) : null,
    auto: aiData ? meter(raw.auto?.used, raw.auto?.limit) : null,
    listening: listenData ? meter(listen.usedMinutes, listen.capMinutes) : null,
    tiers: raw.tiers || null,
  };
}
