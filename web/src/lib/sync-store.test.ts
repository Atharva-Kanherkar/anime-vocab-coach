import { afterEach, describe, expect, it, vi } from "vitest";

const data = new Map<string, string>();
const puts: { key: string; ttl?: number }[] = [];
const reads: string[] = [];
const kv = {
  get: async (k: string) => { reads.push(k); return data.get(k) ?? null; },
  put: async (k: string, v: string, o?: { expirationTtl?: number }) => {
    data.set(k, v);
    puts.push({ key: k, ttl: o?.expirationTtl });
  },
};
vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: async () => ({ env: { AVC_SYNC_KV: kv } }),
}));

import {
  getOrCreateSyncToken,
  getExistingSyncToken,
  getSyncTokenProfile,
  refreshSyncTokenProfile,
  SYNC_TOKEN_TOUCH_INTERVAL_MS,
} from "./sync-store";

const profile = {
  id: "user_1",
  email: "a@b.c",
  name: null,
  plan: "pro" as const,
  billingInterval: null,
  planExpiresAt: "2027-03-08T17:28:56.235Z",
};
const THIRTY_DAYS = 60 * 60 * 24 * 30;

afterEach(() => {
  data.clear();
  puts.length = 0;
  reads.length = 0;
  vi.useRealTimers();
});

describe("sync token TTL", () => {
  it("slides on use once a day, so an extension-only user is never silently signed out", async () => {
    vi.useFakeTimers();
    const token = await getOrCreateSyncToken("user_1", profile);
    puts.length = 0;

    expect(await getSyncTokenProfile(token)).toEqual(profile);
    expect(puts).toEqual([]); // just minted: no extra writes

    vi.advanceTimersByTime(SYNC_TOKEN_TOUCH_INTERVAL_MS);
    expect(await getSyncTokenProfile(token)).toEqual(profile);
    expect(puts).toEqual([
      { key: `synctoken:${token}:v1`, ttl: THIRTY_DAYS },
      { key: "synctoken:user:user_1:v1", ttl: THIRTY_DAYS },
    ]);
  });

  it("slides legacy records that predate touchedAt, and recreates a lost pointer", async () => {
    data.set("synctoken:avc_st_old:v1", JSON.stringify(profile));
    expect(await getSyncTokenProfile("avc_st_old")).toEqual(profile);
    expect(data.get("synctoken:user:user_1:v1")).toBe("avc_st_old");
  });

  it("does not let a stale token steal the pointer from the current one", async () => {
    data.set("synctoken:avc_st_old:v1", JSON.stringify(profile));
    data.set("synctoken:user:user_1:v1", "avc_st_new");
    await getSyncTokenProfile("avc_st_old");
    expect(data.get("synctoken:user:user_1:v1")).toBe("avc_st_new");
  });

  it("plan refreshes still reach the live token and keep it alive", async () => {
    const token = await getOrCreateSyncToken("user_1", { ...profile, plan: "free" });
    expect(await refreshSyncTokenProfile("user_1", profile)).toBe(true);
    expect((await getSyncTokenProfile(token))?.plan).toBe("pro");
  });
});


describe("server-side credential reuse", () => {
  it("returns an owned live token without repeated KV writes", async () => {
    expect(await getExistingSyncToken("user_1")).toBeNull();
    const token = await getOrCreateSyncToken("user_1", profile);
    puts.length = 0;
    expect(await Promise.all(Array.from({ length: 5 }, () => getExistingSyncToken("user_1")))).toEqual(Array(5).fill(token));
    expect(puts).toEqual([]);
  });
  it("rejects dangling and cross-account reverse pointers without touching another account", async () => {
    data.set("synctoken:user:user_1:v1", "avc_st_other");
    expect(await getExistingSyncToken("user_1")).toBeNull();
    data.set("synctoken:avc_st_other:v1", JSON.stringify({ ...profile, id: "other" }));
    expect(await getExistingSyncToken("user_1")).toBeNull();
    expect(puts).toEqual([]);
  });
  it("preserves the existing daily TTL refresh behavior", async () => {
    vi.useFakeTimers();
    const token = await getOrCreateSyncToken("user_1", profile);
    puts.length = 0; vi.advanceTimersByTime(SYNC_TOKEN_TOUCH_INTERVAL_MS);
    expect(await getExistingSyncToken("user_1")).toBe(token);
    expect(puts).toHaveLength(2);
  });
});

it("reuses credentials with exactly two reads and rejects malformed records", async () => {
  const token = await getOrCreateSyncToken("user_1", profile); reads.length = 0;
  expect(await getExistingSyncToken("user_1")).toBe(token);
  expect(reads).toEqual(["synctoken:user:user_1:v1", `synctoken:${token}:v1`]);
  for (const raw of ["{", "null", "[]", "{}", '\"bad\"']) {
    data.set(`synctoken:${token}:v1`, raw); expect(await getExistingSyncToken("user_1")).toBeNull();
  }
});
