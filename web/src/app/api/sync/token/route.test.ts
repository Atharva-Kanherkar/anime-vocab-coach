import { beforeEach, describe, expect, it, vi } from "vitest";

// The two identities the verify endpoint compares: the browser's Clerk cookie
// session and the account a sync token was minted for.
const state = vi.hoisted(() => ({
  user: null as null | { id: string; email: string },
  tokens: new Map<string, { id: string; email: string | null; name: string | null; plan?: string }>(),
}));
vi.mock("@clerk/nextjs/server", () => ({
  currentUser: async () =>
    state.user
      ? { id: state.user.id, primaryEmailAddress: { emailAddress: state.user.email }, firstName: "Me", publicMetadata: {} }
      : null,
}));
vi.mock("@/lib/sync-store", () => ({
  getSyncTokenProfile: async (t: string) => state.tokens.get(t) ?? null,
  getOrCreateSyncToken: async () => "avc_st_minted",
}));

const { GET } = await import("./route");

const verify = (token?: string) =>
  GET(
    new Request("https://animevocab.com/api/sync/token", {
      headers: token ? { authorization: `Bearer ${token}` } : {},
    })
  );

beforeEach(() => {
  state.user = null;
  state.tokens.clear();
  state.tokens.set("avc_st_mine", { id: "user_me", email: "me@example.com", name: "Me" });
  state.tokens.set("avc_st_attacker", { id: "user_attacker", email: "attacker@evil.example", name: "x", plan: "max" });
});

describe("GET /api/sync/token (verify a page-supplied token)", () => {
  it("accepts a token minted for the signed-in browser's own account", async () => {
    state.user = { id: "user_me", email: "me@example.com" };
    const res = await verify("avc_st_mine");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, profile: { email: "me@example.com", name: "Me", plan: "free" } });
  });

  it("refuses a valid token that belongs to another account (the planted-token attack)", async () => {
    state.user = { id: "user_me", email: "me@example.com" };
    const res = await verify("avc_st_attacker");
    expect(res.status).toBe(403);
  });

  it("refuses unknown tokens", async () => {
    state.user = { id: "user_me", email: "me@example.com" };
    expect((await verify("avc_st_unknown")).status).toBe(403);
  });

  it("401s without a cookie session, so a token alone proves nothing", async () => {
    expect((await verify("avc_st_mine")).status).toBe(401);
  });

  it("400s without a well-formed bearer", async () => {
    state.user = { id: "user_me", email: "me@example.com" };
    expect((await verify()).status).toBe(400);
    expect((await verify("not-a-token")).status).toBe(400);
  });
});
