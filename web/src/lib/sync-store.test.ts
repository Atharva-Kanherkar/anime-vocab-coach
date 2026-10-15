import { afterEach, describe, expect, it, vi } from "vitest";

const data = new Map<string, string>();
const puts: { key: string; ttl?: number }[] = [];
const kv = {
  get: async (k: string) => data.get(k) ?? null,
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
  getSyncTokenProfile,
  hashSyncToken,
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

// Release 1 of 2 of moving tokens off plaintext (review of #172, findings 1-2):
// read both layouts, write only master's. These pin both halves.
async function sealForTest(token: string): Promise<string> {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode("avc-dev-only-sync-token-secret"), "HKDF", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: new TextEncoder().encode("avc-sync-token-pointer"), info: new Uint8Array() },
    material, { name: "AES-GCM", length: 256 }, false, ["encrypt"]
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(token)));
  return `${btoa(String.fromCharCode(...iv))}.${btoa(String.fromCharCode(...ct))}`;
}

describe("staged token storage, release 1", () => {
  it("mints in exactly master's layout: plaintext record and a token-string pointer", async () => {
    const token = await getOrCreateSyncToken("user_1", profile);
    expect([...data.keys()].sort()).toEqual([`synctoken:${token}:v1`, "synctoken:user:user_1:v1"]);
    expect(data.get("synctoken:user:user_1:v1")).toBe(token);
  });

  it("reads a hashed record (release 2's layout) and slides it in place", async () => {
    vi.useFakeTimers();
    const hashedKey = `synctoken:h:${await hashSyncToken("avc_st_r2")}:v1`;
    data.set(hashedKey, JSON.stringify({ ...profile, touchedAt: Date.now() }));
    expect(await getSyncTokenProfile("avc_st_r2")).toEqual(profile);
    vi.advanceTimersByTime(SYNC_TOKEN_TOUCH_INTERVAL_MS);
    await getSyncTokenProfile("avc_st_r2");
    expect(data.has("synctoken:avc_st_r2:v1")).toBe(false);
    expect(JSON.parse(data.get(hashedKey)!).touchedAt).toBe(Date.now());
  });

  it("re-mints the same token from a sealed pointer, so a rollback rotates nothing", async () => {
    data.set("synctoken:user:user_1:v1", JSON.stringify({ h: await hashSyncToken("avc_st_sealed"), e: await sealForTest("avc_st_sealed") }));
    expect(await getOrCreateSyncToken("user_1", profile)).toBe("avc_st_sealed");
  });

  it("refreshes a plan through a sealed pointer by hash", async () => {
    const h = await hashSyncToken("avc_st_sealed2");
    data.set(`synctoken:h:${h}:v1`, JSON.stringify({ ...profile, plan: "free", touchedAt: Date.now() }));
    data.set("synctoken:user:user_1:v1", JSON.stringify({ h, e: await sealForTest("avc_st_sealed2") }));
    expect(await refreshSyncTokenProfile("user_1", profile)).toBe(true);
    expect((await getSyncTokenProfile("avc_st_sealed2"))?.plan).toBe("pro");
  });
});
