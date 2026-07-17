import { beforeEach, describe, expect, it, vi } from "vitest";

const points: { blobs?: string[]; doubles?: number[]; indexes?: string[] }[] = [];
const kv = new Map<string, string>();

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: async () => ({ env: {} }),
}));

const {
  CWS_EXTENSION_ID,
  EXTENSION_TRACK_IP_HOURLY_LIMIT,
  allowExtensionTrack,
  isAllowedExtensionClient,
  parseExtensionId,
  setExtensionAnalyticsForTests,
  setExtensionRateKvForTests,
  trackExtensionEvent,
} = await import("./extension-store");
const { isExtensionEvent } = await import("./extension-funnel");

describe("extension funnel Analytics Engine + gate", () => {
  beforeEach(() => {
    points.length = 0;
    kv.clear();
    setExtensionAnalyticsForTests({
      writeDataPoint: (p) => {
        points.push(p);
      },
    });
    setExtensionRateKvForTests({
      get: async (key) => (kv.has(key) ? kv.get(key)! : null),
      put: async (key, value) => {
        kv.set(key, value);
      },
    });
  });

  it("allowlists only known events", () => {
    expect(isExtensionEvent("review_prompt_shown")).toBe(true);
    expect(isExtensionEvent("review_prompt_clicked")).toBe(true);
    expect(isExtensionEvent("land_reel")).toBe(false);
  });

  it("trackExtensionEvent appends an Analytics Engine data point (no KV RMW)", async () => {
    await trackExtensionEvent("review_prompt_shown");
    expect(points).toEqual([
      { blobs: ["review_prompt_shown"], doubles: [1], indexes: ["review_prompt_shown"] },
    ]);
    expect([...kv.keys()].every((k) => k.startsWith("extrate:"))).toBe(true);
  });

  it("parseExtensionId accepts Origin and raw ids", () => {
    expect(parseExtensionId(`chrome-extension://${CWS_EXTENSION_ID}`)).toBe(CWS_EXTENSION_ID);
    expect(parseExtensionId(CWS_EXTENSION_ID)).toBe(CWS_EXTENSION_ID);
    expect(parseExtensionId("https://evil.example")).toBeNull();
    expect(parseExtensionId("not-an-id")).toBeNull();
  });

  it("isAllowedExtensionClient requires the published extension id", () => {
    const ok = new Request("https://animevocab.com/api/extension/track", {
      method: "POST",
      headers: {
        origin: `chrome-extension://${CWS_EXTENSION_ID}`,
        "x-avc-extension-id": CWS_EXTENSION_ID,
      },
    });
    expect(isAllowedExtensionClient(ok)).toBe(true);

    const browser = new Request("https://animevocab.com/api/extension/track", {
      method: "POST",
      headers: { origin: "https://evil.example" },
    });
    expect(isAllowedExtensionClient(browser)).toBe(false);

    const otherId = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"; // valid shape, not our CWS id
    const otherExt = new Request("https://animevocab.com/api/extension/track", {
      method: "POST",
      headers: {
        origin: `chrome-extension://${otherId}`,
        "x-avc-extension-id": otherId,
      },
    });
    expect(isAllowedExtensionClient(otherExt)).toBe(false);
  });

  it("allowExtensionTrack enforces a per-IP hourly cap", async () => {
    for (let i = 0; i < EXTENSION_TRACK_IP_HOURLY_LIMIT; i++) {
      expect(await allowExtensionTrack("abc", "2026-07-17T09")).toBe(true);
    }
    expect(await allowExtensionTrack("abc", "2026-07-17T09")).toBe(false);
    expect(await allowExtensionTrack("abc", "2026-07-17T10")).toBe(true);
  });
});
