import { describe, expect, it, vi, afterEach } from "vitest";
import { getSyncTokenProfile, tokenNeedsTouch, SYNC_TOKEN_TOUCH_INTERVAL_MS } from "./sync-auth";

function fakeKV(seed: Record<string, string> = {}) {
  const data = new Map(Object.entries(seed));
  const puts: { key: string; ttl?: number }[] = [];
  const kv = {
    get: async (k: string) => data.get(k) ?? null,
    put: async (k: string, v: string, o?: { expirationTtl?: number }) => {
      data.set(k, v);
      puts.push({ key: k, ttl: o?.expirationTtl });
    },
  } as unknown as KVNamespace;
  return { kv, data, puts };
}

const TOKEN = "avc_st_abc";
const profile = { id: "user_1", email: "a@b.c", name: null, plan: "pro" as const };

afterEach(() => vi.useRealTimers());

describe("tokenNeedsTouch", () => {
  it("touches records that never slid, are a day old, or are from the future", () => {
    const now = 10 * SYNC_TOKEN_TOUCH_INTERVAL_MS;
    expect(tokenNeedsTouch({}, now)).toBe(true);
    expect(tokenNeedsTouch({ touchedAt: now - SYNC_TOKEN_TOUCH_INTERVAL_MS }, now)).toBe(true);
    expect(tokenNeedsTouch({ touchedAt: now + 1 }, now)).toBe(true);
    expect(tokenNeedsTouch({ touchedAt: now - 1000 }, now)).toBe(false);
  });
});

describe("getSyncTokenProfile slides the TTL on use", () => {
  it("re-puts the token and pointer with the 30-day TTL for a legacy record", async () => {
    const { kv, data, puts } = fakeKV({
      [`synctoken:${TOKEN}:v1`]: JSON.stringify(profile),
      [`synctoken:user:user_1:v1`]: TOKEN,
    });
    expect(await getSyncTokenProfile(kv, TOKEN)).toEqual(profile);
    expect(puts.map((p) => p.key).sort()).toEqual([`synctoken:${TOKEN}:v1`, `synctoken:user:user_1:v1`]);
    expect(puts.every((p) => p.ttl === 60 * 60 * 24 * 30)).toBe(true);
    expect(JSON.parse(data.get(`synctoken:${TOKEN}:v1`)!).touchedAt).toEqual(expect.any(Number));
  });

  it("does not write again within a day, and never leaks touchedAt", async () => {
    const { kv, puts } = fakeKV({
      [`synctoken:${TOKEN}:v1`]: JSON.stringify({ ...profile, touchedAt: Date.now() - 1000 }),
    });
    expect(await getSyncTokenProfile(kv, TOKEN)).toEqual(profile);
    expect(puts).toEqual([]);
  });

  it("re-creates a missing pointer but never steals one from a newer token", async () => {
    const missing = fakeKV({ [`synctoken:${TOKEN}:v1`]: JSON.stringify(profile) });
    await getSyncTokenProfile(missing.kv, TOKEN);
    expect(missing.data.get("synctoken:user:user_1:v1")).toBe(TOKEN);

    const other = fakeKV({
      [`synctoken:${TOKEN}:v1`]: JSON.stringify(profile),
      [`synctoken:user:user_1:v1`]: "avc_st_newer",
    });
    await getSyncTokenProfile(other.kv, TOKEN);
    expect(other.data.get("synctoken:user:user_1:v1")).toBe("avc_st_newer");
  });

  it("still authenticates when the slide write fails", async () => {
    const { kv } = fakeKV({ [`synctoken:${TOKEN}:v1`]: JSON.stringify(profile) });
    (kv as unknown as { put: () => Promise<void> }).put = async () => {
      throw new Error("kv down");
    };
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await getSyncTokenProfile(kv, TOKEN)).toEqual(profile);
  });
});
