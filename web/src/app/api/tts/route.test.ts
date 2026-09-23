import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Everything around the route is stubbed; the route and the telemetry wrapper
// are real. `reserveOk` is the auto meter's answer on a cache miss.
const state = vi.hoisted(() => ({
  profile: null as { id: string; email: string | null; plan: "free" } | null,
  reserveOk: true,
}));
vi.mock("@/lib/auth", () => ({
  resolveProfile: async () => state.profile,
  resolvePlan: () => "free",
}));
vi.mock("@/lib/ai-store", () => ({
  currentMonth: () => "2026-09",
  quotaFor: async () => 1200,
  reserveUsage: async () => ({
    ok: state.reserveOk,
    used: 1200,
    limit: 1200,
    refund: async () => {},
  }),
}));
vi.mock("@/lib/tts", () => ({
  // A cache miss: the route's onBeforeSpend claims an auto slot before paying.
  runTts: async (_text: string, opts?: { onBeforeSpend?: () => Promise<void> }) => {
    await opts?.onBeforeSpend?.();
    return { audio: new Uint8Array([73, 68, 51]).buffer, cached: false };
  },
}));
vi.mock("@/lib/request-identity", () => ({
  requestIdentity: async () => ({ userId: state.profile?.id ?? null, plan: null }),
  authFailureOf: () => null,
}));
vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: async () => ({ env: {} }),
}));

const { POST } = await import("./route");
const { setTelemetrySinksForTests } = await import("@/lib/telemetry");
const { EVENT_BLOBS } = await import("@/lib/telemetry-schema");

const writes: { blobs?: string[] }[] = [];
const field = (name: (typeof EVENT_BLOBS)[number]) =>
  writes[0]!.blobs![EVENT_BLOBS.indexOf(name)];

const speak = (text = "ありがとう") =>
  POST(
    new Request("https://animevocab.com/api/tts", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer avc_st_abc123" },
      body: JSON.stringify({ text }),
    })
  );

beforeEach(() => {
  writes.length = 0;
  state.profile = { id: "user_42", email: null, plan: "free" };
  state.reserveOk = true;
  setTelemetrySinksForTests(null, { writeDataPoint: (p) => void writes.push(p) });
});

afterEach(() => setTelemetrySinksForTests(null, null));

/**
 * #160: TTS spends the auto allowance on every card, and until this it was the
 * one auto-metered route that wrote no row, so its 429s could not be counted.
 */
describe("POST /api/tts route telemetry", () => {
  it("records a refused auto reservation as a 429 with its reason", async () => {
    state.reserveOk = false;
    const res = await speak();
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: "auto_quota_exhausted" });
    expect(writes).toHaveLength(1);
    expect(field("kind")).toBe("api");
    expect(field("name")).toBe("/api/tts");
    expect(field("status")).toBe("429");
    expect(field("userId")).toBe("user_42");
    expect(field("errorCode")).toBe("auto_quota_exhausted");
  });

  it("records an unlinked caller as a 401", async () => {
    state.profile = null;
    const res = await speak();
    expect(res.status).toBe(401);
    expect(field("status")).toBe("401");
    expect(field("errorCode")).toBe("unauthorized");
  });

  it("still returns the audio untouched, with a row and no reason", async () => {
    const res = await speak();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("audio/mpeg");
    expect([...new Uint8Array(await res.arrayBuffer())]).toEqual([73, 68, 51]);
    expect(field("status")).toBe("200");
    expect(field("errorCode")).toBe("");
  });

  it("keeps its 400 for an empty text", async () => {
    const res = await speak("   ");
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "missing_text" });
    expect(field("errorCode")).toBe("missing_text");
  });
});
