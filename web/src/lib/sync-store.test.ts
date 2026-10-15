import { afterEach, describe, expect, it, vi } from "vitest";

const data = new Map<string, string>();
const puts: { key: string; ttl?: number }[] = [];
const kv = {
  get: async (k: string) => data.get(k) ?? null,
  put: async (k: string, v: string, o?: { expirationTtl?: number }) => {
    data.set(k, v);
    puts.push({ key: k, ttl: o?.expirationTtl });
  },
  delete: async (k: string) => void data.delete(k),
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

const recordKey = async (token: string) => `synctoken:h:${await hashSyncToken(token)}:v1`;

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
      { key: await recordKey(token), ttl: THIRTY_DAYS },
      { key: "synctoken:user:user_1:v1", ttl: THIRTY_DAYS },
    ]);
  });

  it("does not let a stale token steal the pointer from the current one", async () => {
    const current = await getOrCreateSyncToken("user_1", profile);
    const pointer = data.get("synctoken:user:user_1:v1");
    data.set("synctoken:avc_st_old:v1", JSON.stringify(profile));
    await getSyncTokenProfile("avc_st_old");
    expect(data.get("synctoken:user:user_1:v1")).toBe(pointer);
    expect(await getOrCreateSyncToken("user_1", profile)).toBe(current);
  });

  it("plan refreshes still reach the live token and keep it alive", async () => {
    const token = await getOrCreateSyncToken("user_1", { ...profile, plan: "free" });
    expect(await refreshSyncTokenProfile("user_1", profile)).toBe(true);
    expect((await getSyncTokenProfile(token))?.plan).toBe("pro");
  });
});

describe("sync tokens are never stored in the clear (ISO 25010 security: confidentiality)", () => {
  it("keeps the token out of every KV key and value", async () => {
    const token = await getOrCreateSyncToken("user_1", profile);
    for (const [k, v] of data) {
      expect(k).not.toContain(token);
      expect(v).not.toContain(token);
    }
    expect(data.has(await recordKey(token))).toBe(true);
  });

  it("re-mints the same token (idempotent per user) from the sealed pointer", async () => {
    const a = await getOrCreateSyncToken("user_1", profile);
    const b = await getOrCreateSyncToken("user_1", profile);
    expect(b).toBe(a);
  });

  it("mints a fresh token when the pointer holds only a hash (written by the API Worker)", async () => {
    const a = await getOrCreateSyncToken("user_1", profile);
    data.set("synctoken:user:user_1:v1", JSON.stringify({ h: await hashSyncToken(a) }));
    const b = await getOrCreateSyncToken("user_1", profile);
    expect(b).not.toBe(a);
    expect(await getSyncTokenProfile(a)).toEqual(profile); // the old one still works
  });

  it("migrates a legacy plaintext record and pointer on first use, without signing anyone out", async () => {
    data.set("synctoken:avc_st_legacy:v1", JSON.stringify({ ...profile, touchedAt: Date.now() }));
    data.set("synctoken:user:user_1:v1", "avc_st_legacy");

    expect(await getSyncTokenProfile("avc_st_legacy")).toEqual(profile);
    expect(data.has("synctoken:avc_st_legacy:v1")).toBe(false);
    expect(data.has(await recordKey("avc_st_legacy"))).toBe(true);
    expect(data.get("synctoken:user:user_1:v1")).not.toContain("avc_st_legacy");
    // Still the same credential for the extension and for the next mint.
    expect(await getSyncTokenProfile("avc_st_legacy")).toEqual(profile);
    expect(await getOrCreateSyncToken("user_1", profile)).toBe("avc_st_legacy");
  });

  it("refreshes a plan through a legacy pointer and seals it", async () => {
    data.set("synctoken:avc_st_legacy2:v1", JSON.stringify({ ...profile, plan: "free", touchedAt: Date.now() }));
    data.set("synctoken:user:user_1:v1", "avc_st_legacy2");
    expect(await refreshSyncTokenProfile("user_1", profile)).toBe(true);
    expect((await getSyncTokenProfile("avc_st_legacy2"))?.plan).toBe("pro");
    expect(data.has("synctoken:avc_st_legacy2:v1")).toBe(false);
  });
});
