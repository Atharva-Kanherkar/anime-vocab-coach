import { beforeEach, describe, expect, it, vi } from "vitest";
import { TIERS } from "./site";

// No Cloudflare binding under vitest, so ai-store falls back to its in-process
// Map — which is exactly the code path these assertions need.
vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: async () => {
    throw new Error("no cloudflare context in tests");
  },
}));

const { currentMonth, getUsage, incrementUsage, quotaFor } = await import("./ai-store");

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

describe("currentMonth", () => {
  it("formats as YYYY-MM in UTC", () => {
    expect(currentMonth(new Date("2026-01-09T23:30:00Z"))).toBe("2026-01");
    expect(currentMonth(new Date("2026-12-31T23:59:59Z"))).toBe("2026-12");
  });
});
