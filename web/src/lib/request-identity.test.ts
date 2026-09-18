import { beforeEach, describe, expect, it, vi } from "vitest";

const getSyncTokenProfile = vi.fn();
vi.mock("./sync-store", () => ({ getSyncTokenProfile }));

const { ANONYMOUS, rememberRequestIdentity, requestIdentity, resetIdentityLookupBudgetForTests } =
  await import("./request-identity");

/**
 * Issue #112. An extension request authenticates with a sync-token bearer, and
 * the api-event row it produced used to say userId "anon" — so events-only
 * retention analysis could not see extension activity at all and reported an
 * active-days figure that was simply too low.
 */

const extensionRequest = (token = "avc_st_abc123", ip = "203.0.113.7") =>
  new Request("https://animevocab.com/api/sync/snapshot", {
    method: "PUT",
    headers: { authorization: `Bearer ${token}`, "cf-connecting-ip": ip },
  });

beforeEach(() => {
  getSyncTokenProfile.mockReset();
  resetIdentityLookupBudgetForTests();
});

describe("requestIdentity", () => {
  it("resolves the user behind a sync token", async () => {
    getSyncTokenProfile.mockResolvedValue({ id: "user_42", plan: "pro" });
    expect(await requestIdentity(extensionRequest())).toEqual({ userId: "user_42", plan: "pro" });
    expect(getSyncTokenProfile).toHaveBeenCalledWith("avc_st_abc123");
  });

  it("does not read KV for a request that presented no token", async () => {
    const web = new Request("https://animevocab.com/api/ai/coach", {
      headers: { cookie: "__session=abc" },
    });
    expect(await requestIdentity(web)).toEqual(ANONYMOUS);
    expect(getSyncTokenProfile).not.toHaveBeenCalled();
  });

  it("reuses what a route already resolved instead of paying for a second lookup", async () => {
    const req = extensionRequest();
    rememberRequestIdentity(req, { userId: "user_7", plan: "max" });
    expect(await requestIdentity(req)).toEqual({ userId: "user_7", plan: "max" });
    expect(getSyncTokenProfile).not.toHaveBeenCalled();
  });

  it("memoises its own lookup so the wrapper does not repeat it", async () => {
    getSyncTokenProfile.mockResolvedValue({ id: "user_42", plan: "free" });
    const req = extensionRequest();
    await requestIdentity(req);
    await requestIdentity(req);
    expect(getSyncTokenProfile).toHaveBeenCalledTimes(1);
  });

  it("degrades to anonymous when KV throws, rather than failing the request", async () => {
    getSyncTokenProfile.mockRejectedValue(new Error("kv down"));
    expect(await requestIdentity(extensionRequest())).toEqual(ANONYMOUS);
  });

  it("treats an unknown token as anonymous, not as a user", async () => {
    getSyncTokenProfile.mockResolvedValue(null);
    expect(await requestIdentity(extensionRequest())).toEqual(ANONYMOUS);
  });

  it("ignores a bearer that is not one of ours", async () => {
    const req = new Request("https://animevocab.com/api/sync/snapshot", {
      headers: { authorization: "Bearer sk-not-a-sync-token" },
    });
    expect(await requestIdentity(req)).toEqual(ANONYMOUS);
    expect(getSyncTokenProfile).not.toHaveBeenCalled();
  });

  /**
   * /api/track is public and unauthenticated, and the only thing that decides
   * whether it does a KV read is whether the caller sent something shaped like
   * a sync token. Anyone can send that, so the uncached lookup is bounded per
   * IP — and going over it costs attribution, never the event itself.
   */
  it("stops doing KV reads for one IP that floods forged tokens", async () => {
    getSyncTokenProfile.mockResolvedValue(null);
    for (let i = 0; i < 400; i++) {
      await requestIdentity(extensionRequest(`avc_st_forged${i}`, "198.51.100.9"));
    }
    expect(getSyncTokenProfile.mock.calls.length).toBeLessThanOrEqual(120);
  });

  it("and still resolves a different caller, because the budget is per IP", async () => {
    getSyncTokenProfile.mockResolvedValue(null);
    for (let i = 0; i < 400; i++) {
      await requestIdentity(extensionRequest(`avc_st_forged${i}`, "198.51.100.9"));
    }
    getSyncTokenProfile.mockResolvedValue({ id: "user_42", plan: "pro" });
    expect(await requestIdentity(extensionRequest("avc_st_real", "203.0.113.55"))).toEqual({
      userId: "user_42",
      plan: "pro",
    });
  });

  it("records a failed auth as anonymous so a later lookup is not retried", async () => {
    const req = extensionRequest();
    rememberRequestIdentity(req, null);
    expect(await requestIdentity(req)).toEqual(ANONYMOUS);
    expect(getSyncTokenProfile).not.toHaveBeenCalled();
  });
});
