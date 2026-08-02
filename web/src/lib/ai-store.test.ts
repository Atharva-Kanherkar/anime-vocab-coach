import { beforeEach, describe, expect, it, vi } from "vitest";
import { TIERS } from "./site";

// No Cloudflare binding under vitest, so ai-store falls back to its in-process
// Map — which is exactly the code path these assertions need.
vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: async () => {
    throw new Error("no cloudflare context in tests");
  },
}));

const { currentMonth, getUsage, incrementUsage, quotaFor, refundUsage, reserveUsage } =
  await import("./ai-store");

const MONTH = "2026-08";

describe("usage buckets", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  // The bug this pins: pronunciation audio and smart word picking were metered
  // against the same counter as the coach, so a learner could exhaust the
  // advertised "AI messages" allowance without ever opening the coach.
  it("meters auto calls separately from coach calls", async () => {
    const user = "user-separate";
    await incrementUsage(user, MONTH, "auto");
    await incrementUsage(user, MONTH, "auto");
    await incrementUsage(user, MONTH, "auto");

    expect(await getUsage(user, MONTH, "auto")).toBe(3);
    expect(await getUsage(user, MONTH, "ai")).toBe(0);
  });

  it("spending the coach bucket leaves the auto bucket untouched", async () => {
    const user = "user-reverse";
    await incrementUsage(user, MONTH, "ai");
    expect(await getUsage(user, MONTH, "ai")).toBe(1);
    expect(await getUsage(user, MONTH, "auto")).toBe(0);
  });

  it("defaults to the coach bucket so existing counters keep their meaning", async () => {
    const user = "user-default";
    await incrementUsage(user, MONTH);
    expect(await getUsage(user, MONTH)).toBe(1);
    expect(await getUsage(user, MONTH, "ai")).toBe(1);
    expect(await getUsage(user, MONTH, "auto")).toBe(0);
  });

  it("keeps months apart", async () => {
    const user = "user-months";
    await incrementUsage(user, "2026-08", "ai");
    expect(await getUsage(user, "2026-09", "ai")).toBe(0);
  });
});

describe("quotaFor", () => {
  it("resolves each plan to its advertised coach allowance", async () => {
    expect(await quotaFor("free", "ai")).toBe(TIERS.free.aiCallsPerMonth);
    expect(await quotaFor("pro", "ai")).toBe(TIERS.pro.aiCallsPerMonth);
    expect(await quotaFor("max", "ai")).toBe(TIERS.max.aiCallsPerMonth);
  });

  it("resolves the auto allowance from the same tier table", async () => {
    expect(await quotaFor("free", "auto")).toBe(TIERS.free.autoCallsPerMonth);
    expect(await quotaFor("pro", "auto")).toBe(TIERS.pro.autoCallsPerMonth);
    expect(await quotaFor("max", "auto")).toBe(TIERS.max.autoCallsPerMonth);
  });

  it("gives owners an effectively unlimited cap on both meters", async () => {
    expect(await quotaFor("free", "ai", true)).toBeGreaterThan(100_000);
    expect(await quotaFor("free", "auto", true)).toBeGreaterThan(100_000);
  });
});

describe("reserveUsage", () => {
  it("claims a slot and reports the post-claim count", async () => {
    const user = "res-basic";
    const r = await reserveUsage(user, MONTH, "ai", 3);
    expect(r.ok).toBe(true);
    expect(r.used).toBe(1);
    expect(await getUsage(user, MONTH, "ai")).toBe(1);
  });

  it("refuses once the cap is spent, without incrementing further", async () => {
    const user = "res-full";
    await reserveUsage(user, MONTH, "ai", 2);
    await reserveUsage(user, MONTH, "ai", 2);
    const third = await reserveUsage(user, MONTH, "ai", 2);
    expect(third.ok).toBe(false);
    expect(third.used).toBe(2);
    // A refusal must not consume the slot it just denied.
    expect(await getUsage(user, MONTH, "ai")).toBe(2);
  });

  // The bug: check-then-call-then-increment let every request that arrived
  // while one was in flight read the same pre-spend count and pass the cap.
  // Reserving under a per-key lock means only `limit` callers ever proceed.
  it("never hands out more slots than the cap under concurrency", async () => {
    const user = "res-race";
    const limit = 5;
    const results = await Promise.all(
      Array.from({ length: 25 }, () => reserveUsage(user, MONTH, "auto", limit))
    );
    expect(results.filter((r) => r.ok)).toHaveLength(limit);
    expect(await getUsage(user, MONTH, "auto")).toBe(limit);
  });

  it("counts every concurrent reservation exactly once", async () => {
    const user = "res-lost-update";
    await Promise.all(
      Array.from({ length: 12 }, () => reserveUsage(user, MONTH, "auto", 1000))
    );
    expect(await getUsage(user, MONTH, "auto")).toBe(12);
  });

  it("gives the slot back when the provider never ran", async () => {
    const user = "res-refund";
    const r = await reserveUsage(user, MONTH, "ai", 5);
    expect(await getUsage(user, MONTH, "ai")).toBe(1);
    await r.refund();
    expect(await getUsage(user, MONTH, "ai")).toBe(0);
  });

  it("refunding a refused reservation is a no-op", async () => {
    const user = "res-refund-refused";
    await reserveUsage(user, MONTH, "ai", 1);
    const refused = await reserveUsage(user, MONTH, "ai", 1);
    await refused.refund();
    expect(await getUsage(user, MONTH, "ai")).toBe(1);
  });

  it("keeps the two buckets independent when reserving", async () => {
    const user = "res-buckets";
    await reserveUsage(user, MONTH, "auto", 5);
    expect(await getUsage(user, MONTH, "auto")).toBe(1);
    expect(await getUsage(user, MONTH, "ai")).toBe(0);
  });
});

describe("refundUsage", () => {
  it("never drives a counter below zero", async () => {
    const user = "refund-floor";
    await refundUsage(user, MONTH, "ai");
    await refundUsage(user, MONTH, "ai");
    expect(await getUsage(user, MONTH, "ai")).toBe(0);
  });
});

describe("currentMonth", () => {
  it("formats as YYYY-MM in UTC", () => {
    expect(currentMonth(new Date("2026-01-09T23:30:00Z"))).toBe("2026-01");
    expect(currentMonth(new Date("2026-12-31T23:59:59Z"))).toBe("2026-12");
  });
});
