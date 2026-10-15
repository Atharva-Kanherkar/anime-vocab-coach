import { describe, expect, it, vi, afterEach } from "vitest";
import { getSyncTokenProfile, hashSyncToken, tokenNeedsTouch, SYNC_TOKEN_TOUCH_INTERVAL_MS } from "./sync-auth";

function fakeKV(seed: Record<string, string> = {}) {
  const data = new Map(Object.entries(seed));
  const puts: { key: string; ttl?: number }[] = [];
  const kv = {
    get: async (k: string) => data.get(k) ?? null,
    put: async (k: string, v: string, o?: { expirationTtl?: number }) => {
      data.set(k, v);
      puts.push({ key: k, ttl: o?.expirationTtl });
    },
    delete: async (k: string) => void data.delete(k),
  } as unknown as KVNamespace;
  return { kv, data, puts };
}

const TOKEN = "avc_st_abc";
const profile = { id: "user_1", email: "a@b.c", name: null, plan: "pro" as const };
const hashedKey = async (t = TOKEN) => `synctoken:h:${await hashSyncToken(t)}:v1`;

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
  it("does not write again within a day, and never leaks touchedAt", async () => {
    const { kv, puts } = fakeKV({ [await hashedKey()]: JSON.stringify({ ...profile, touchedAt: Date.now() - 1000 }) });
    expect(await getSyncTokenProfile(kv, TOKEN)).toEqual(profile);
    expect(puts).toEqual([]);
  });

  it("slides a day-old record and keeps a sealed pointer byte for byte", async () => {
    const sealed = JSON.stringify({ h: await hashSyncToken(TOKEN), e: "iv.ciphertext" });
    const { kv, data, puts } = fakeKV({
      [await hashedKey()]: JSON.stringify({ ...profile, touchedAt: Date.now() - SYNC_TOKEN_TOUCH_INTERVAL_MS }),
      "synctoken:user:user_1:v1": sealed,
    });
    expect(await getSyncTokenProfile(kv, TOKEN)).toEqual(profile);
    expect(puts.every((p) => p.ttl === 60 * 60 * 24 * 30)).toBe(true);
    expect(data.get("synctoken:user:user_1:v1")).toBe(sealed);
  });

  it("never steals the pointer from a newer token", async () => {
    const other = fakeKV({
      [await hashedKey()]: JSON.stringify(profile),
      "synctoken:user:user_1:v1": JSON.stringify({ h: "someone-else" }),
    });
    await getSyncTokenProfile(other.kv, TOKEN);
    expect(other.data.get("synctoken:user:user_1:v1")).toBe(JSON.stringify({ h: "someone-else" }));
  });
});

describe("legacy plaintext tokens (ISO 25010 security: confidentiality)", () => {
  it("still authenticate, then move under the hash and leave no plaintext behind", async () => {
    const { kv, data } = fakeKV({
      [`synctoken:${TOKEN}:v1`]: JSON.stringify(profile),
      "synctoken:user:user_1:v1": TOKEN,
    });
    expect(await getSyncTokenProfile(kv, TOKEN)).toEqual(profile);
    expect(data.has(`synctoken:${TOKEN}:v1`)).toBe(false);
    expect(data.has(await hashedKey())).toBe(true);
    for (const [k, v] of data) {
      expect(k).not.toContain(TOKEN);
      expect(v).not.toContain(TOKEN);
    }
    // And keep working afterwards.
    expect(await getSyncTokenProfile(kv, TOKEN)).toEqual(profile);
  });

  it("recreate a missing pointer as a hash only", async () => {
    const { kv, data } = fakeKV({ [`synctoken:${TOKEN}:v1`]: JSON.stringify(profile) });
    await getSyncTokenProfile(kv, TOKEN);
    expect(JSON.parse(data.get("synctoken:user:user_1:v1")!)).toEqual({ h: await hashSyncToken(TOKEN) });
  });
});
