import { describe, expect, it, vi } from "vitest";

const kvDown = vi.hoisted(() => ({ value: false }));
vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: async () => {
    throw new Error("no cf in tests");
  },
}));
vi.mock("@/lib/sync-store", () => ({
  resolveStore: async () => ({
    get: async () => {
      if (kvDown.value) throw new Error("kv down");
      return null;
    },
  }),
}));

const { GET } = await import("./route");

describe("/api/health (ISO 25010 reliability: availability)", () => {
  it("is 200 when KV and the atomic store answer", async () => {
    kvDown.value = false;
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, checks: { kv: "ok", atomic: "ok" } });
  });

  it("is 503 and names what failed", async () => {
    kvDown.value = true;
    const res = await GET();
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ ok: false, checks: { kv: "fail" } });
  });
});
