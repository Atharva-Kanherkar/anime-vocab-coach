import { describe, expect, it, vi, afterEach } from "vitest";
import { getSyncTokenProfile, hashSyncToken, tokenNeedsTouch, SYNC_TOKEN_TOUCH_INTERVAL_MS } from "./sync-auth";

function fakeKV(seed: Record<string, string> = {}) {
  const data = new Map(Object.entries(seed));
  const puts: { key: string; ttl?: number }[] = [];
  const deletes: string[] = [];
  const kv = {
    get: async (k: string) => data.get(k) ?? null,
    put: async (k: string, v: string, o?: { expirationTtl?: number }) => {
      data.set(k, v);
      puts.push({ key: k, ttl: o?.expirationTtl });
    },
    delete: async (k: string) => {
      deletes.push(k);
      data.delete(k);
    },
  } as unknown as KVNamespace;
  return { kv, data, puts, deletes };
}

const TOKEN = "avc_st_abc";
const profile = { id: "user_1", email: "a@b.c", name: null, plan: "pro" as const };
const DAY = 60 * 60 * 24 * 30;

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
  it("re-puts the token and pointer with the 30-day TTL for a record that never slid", async () => {
    const { kv, data, puts } = fakeKV({
      [`synctoken:${TOKEN}:v1`]: JSON.stringify(profile),
      [`synctoken:user:user_1:v1`]: TOKEN,
    });
    expect(await getSyncTokenProfile(kv, TOKEN)).toEqual(profile);
    expect(puts.map((p) => p.key).sort()).toEqual([`synctoken:${TOKEN}:v1`, `synctoken:user:user_1:v1`]);
    expect(puts.every((p) => p.ttl === DAY)).toBe(true);
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
});

describe("staged token storage, release 1 (review of #172, findings 1-2)", () => {
  it("writes only what master writes: no hashed key, no deletes, pointer stays the token", async () => {
    const { kv, data, deletes } = fakeKV({
      [`synctoken:${TOKEN}:v1`]: JSON.stringify(profile),
      [`synctoken:user:user_1:v1`]: TOKEN,
    });
    await getSyncTokenProfile(kv, TOKEN);
    expect(deletes).toEqual([]);
    expect([...data.keys()].sort()).toEqual([`synctoken:${TOKEN}:v1`, `synctoken:user:user_1:v1`]);
    expect(data.get(`synctoken:user:user_1:v1`)).toBe(TOKEN);
  });

  it("also reads the hashed layout release 2 will write, sliding it where it lies", async () => {
    const hashedKey = `synctoken:h:${await hashSyncToken(TOKEN)}:v1`;
    const sealed = JSON.stringify({ h: await hashSyncToken(TOKEN), e: "iv.ciphertext" });
    const { kv, data, puts } = fakeKV({
      [hashedKey]: JSON.stringify(profile),
      [`synctoken:user:user_1:v1`]: sealed,
    });
    expect(await getSyncTokenProfile(kv, TOKEN)).toEqual(profile);
    expect(puts.map((p) => p.key).sort()).toEqual([hashedKey, `synctoken:user:user_1:v1`].sort());
    expect(data.get(`synctoken:user:user_1:v1`)).toBe(sealed);
    expect(data.has(`synctoken:${TOKEN}:v1`)).toBe(false);
  });
});
