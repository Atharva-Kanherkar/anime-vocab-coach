import { beforeEach, describe, expect, it, vi } from "vitest";

const SECRET_BYTES = new TextEncoder().encode("test-webhook-secret-32-bytes!!!!");
const SECRET = "whsec_" + btoa(String.fromCharCode(...SECRET_BYTES));

const state = vi.hoisted(() => ({
  kv: new Map<string, string>(),
  metadataWrites: [] as unknown[],
}));
vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: async () => ({ env: { DODO_WEBHOOK_SECRET: SECRET, DODO_PRO_PRODUCT_ID: "prod_pro_m,prod_pro_y" } }),
}));
vi.mock("@/lib/sync-store", () => ({
  resolveStore: async () => ({
    get: async (k: string) => state.kv.get(k) ?? null,
    put: async (k: string, v: string) => void state.kv.set(k, v),
  }),
  refreshSyncTokenProfile: async () => true,
}));
vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: async () => ({
    users: {
      getUserList: async () => ({ data: [{ id: "user_buyer", publicMetadata: {}, primaryEmailAddress: { emailAddress: "buyer@example.com" } }] }),
      updateUserMetadata: async (_id: string, patch: unknown) => void state.metadataWrites.push(patch),
    },
  }),
}));

const { POST } = await import("./route");

async function sign(id: string, ts: number, body: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", SECRET_BYTES, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${id}.${ts}.${body}`));
  return "v1," + btoa(String.fromCharCode(...new Uint8Array(mac)));
}

async function deliver(id: string, ts: number, event: unknown) {
  const body = JSON.stringify(event);
  return POST(
    new Request("https://animevocab.com/api/billing/dodo/webhook", {
      method: "POST",
      headers: { "webhook-id": id, "webhook-timestamp": String(ts), "webhook-signature": await sign(id, ts, body) },
      body,
    })
  );
}

const active = { type: "subscription.active", data: { product_id: "prod_pro_m", customer: { email: "buyer@example.com" } } };
const now = () => Math.floor(Date.now() / 1000);

beforeEach(() => {
  state.kv.clear();
  state.metadataWrites.length = 0;
});

describe("Dodo webhook replay protection (ISO 25010 security: integrity)", () => {
  it("applies a fresh, correctly signed event", async () => {
    const res = await deliver("msg_1", now(), active);
    expect(res.status).toBe(200);
    expect(state.metadataWrites).toHaveLength(1);
  });

  it("rejects a validly signed event whose timestamp is older than the tolerance", async () => {
    const res = await deliver("msg_old", now() - 6 * 60, active);
    expect(res.status).toBe(401);
    expect(state.metadataWrites).toHaveLength(0);
  });

  it("rejects a timestamp from the future beyond the tolerance", async () => {
    expect((await deliver("msg_future", now() + 6 * 60, active)).status).toBe(401);
  });

  it("applies a delivery id once, even if replayed inside the window", async () => {
    await deliver("msg_2", now(), active);
    const replay = await deliver("msg_2", now(), active);
    expect(await replay.json()).toMatchObject({ ok: true, duplicate: true });
    expect(state.metadataWrites).toHaveLength(1);
  });

  it("still rejects a bad signature", async () => {
    const body = JSON.stringify(active);
    const res = await POST(
      new Request("https://animevocab.com/api/billing/dodo/webhook", {
        method: "POST",
        headers: { "webhook-id": "msg_3", "webhook-timestamp": String(now()), "webhook-signature": "v1,AAAA" },
        body,
      })
    );
    expect(res.status).toBe(401);
  });
});
