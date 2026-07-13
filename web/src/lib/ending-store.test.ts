import { beforeEach, describe, expect, it, vi } from "vitest";

const store = new Map<string, string>();

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: async () => ({
    env: {
      AVC_SYNC_KV: {
        get: async (key: string) => (store.has(key) ? store.get(key)! : null),
        put: async (key: string, value: string) => {
          store.set(key, value);
        },
      },
    },
  }),
}));

const { trackEndingEvent, getEndingStats, currentStatsDay } = await import("./ending-store");

describe("ending funnel KV analytics", () => {
  beforeEach(() => store.clear());

  it("trackEndingEvent writes daily + durable all-time keys", async () => {
    await trackEndingEvent("generate_start", "2026-07-13");
    expect(store.get("endstats:2026-07-13:generate_start")).toBe("1");
    expect(store.get("endstats:total:generate_start")).toBe("1");
  });

  it("getEndingStats totals come from all-time keys, not only the day window", async () => {
    store.set("endstats:total:land_reel", "50");
    store.set("endstats:total:generate_start", "10");
    const today = currentStatsDay();
    await trackEndingEvent("land_reel", today);
    await trackEndingEvent("generate_start", today);

    const stats = await getEndingStats(1);
    expect(stats.totals.land_reel).toBe(51);
    expect(stats.totals.generate_start).toBe(11);
    expect(stats.days[0]?.events.land_reel).toBe(1);
  });
});
