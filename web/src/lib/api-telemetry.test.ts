import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The sync-token lookup behind resolveProfile is the one input that decides
// which kind of 401 a request was, so it is the one thing stubbed. The auth
// resolver, the identity memo and the wrapper are the real modules.
const getSyncTokenProfile = vi.fn();
vi.mock("./sync-store", () => ({ getSyncTokenProfile }));
vi.mock("@clerk/nextjs/server", () => ({ currentUser: async () => null }));
vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: async () => ({ env: {} }),
}));

const { apiErrorCode, normalizeErrorCode, withApiTelemetry } = await import("./api-telemetry");
const { resolveProfile } = await import("./auth");
const { rememberAuthFailure, resetIdentityLookupBudgetForTests } = await import(
  "./request-identity"
);
const { setTelemetrySinksForTests } = await import("./telemetry");
const { EVENT_BLOBS } = await import("./telemetry-schema");

/**
 * Issue #160. /api/anime/context failed 295 times in 90 days and the only
 * record of it was a status code. These pin the reason that now rides along
 * with every failed row, because each reason is a different fix.
 */

const writes: { blobs?: string[] }[] = [];
const field = (name: (typeof EVENT_BLOBS)[number], i = 0) =>
  writes[i]!.blobs![EVENT_BLOBS.indexOf(name)];

const extensionRequest = () =>
  new Request("https://animevocab.com/api/anime/context?title=Frieren", {
    headers: { authorization: "Bearer avc_st_abc123", "cf-connecting-ip": "203.0.113.7" },
  });

/** The anime-context route's own auth step, in miniature. */
const contextRoute = withApiTelemetry("/api/anime/context", async (req) => {
  const profile = await resolveProfile(req);
  if (!profile) return Response.json({ error: "unauthorized" }, { status: 401 });
  return Response.json({ title: "Frieren", context: "…", cached: true });
});

const answering = (res: Response) => withApiTelemetry("/api/x", async () => res);

beforeEach(() => {
  writes.length = 0;
  getSyncTokenProfile.mockReset();
  resetIdentityLookupBudgetForTests();
  setTelemetrySinksForTests(null, { writeDataPoint: (p) => void writes.push(p) });
});

afterEach(() => {
  setTelemetrySinksForTests(null, null);
  vi.restoreAllMocks();
});

describe("why a 401 happened", () => {
  it("a link that is gone reads token_unknown, not just unauthorized", async () => {
    getSyncTokenProfile.mockResolvedValue(null);
    const res = await contextRoute(extensionRequest());
    expect(res.status).toBe(401);
    expect(field("status")).toBe("401");
    expect(field("authKind")).toBe("sync_token");
    expect(field("userId")).toBe("anon");
    expect(field("errorCode")).toBe("token_unknown");
  });

  it("our own KV failing under the token reads token_lookup_failed", async () => {
    getSyncTokenProfile.mockRejectedValue(new Error("KV GET failed: 503"));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const res = await contextRoute(extensionRequest());
    expect(res.status).toBe(401);
    expect(field("errorCode")).toBe("token_lookup_failed");
  });

  it("no credentials at all keeps the route's own reason", async () => {
    const res = await contextRoute(new Request("https://animevocab.com/api/anime/context?title=x"));
    expect(res.status).toBe(401);
    expect(field("authKind")).toBe("none");
    expect(field("errorCode")).toBe("unauthorized");
    expect(getSyncTokenProfile).not.toHaveBeenCalled();
  });

  it("a linked learner succeeds with no reason and their own id", async () => {
    getSyncTokenProfile.mockResolvedValue({ id: "user_42", plan: "free" });
    const res = await contextRoute(extensionRequest());
    expect(res.status).toBe(200);
    expect(field("userId")).toBe("user_42");
    expect(field("errorCode")).toBe("");
  });

  it("an auth failure only ever explains a 401", async () => {
    const req = extensionRequest();
    rememberAuthFailure(req, "token_unknown");
    const res = Response.json({ error: "openai_502" }, { status: 502 });
    expect(await apiErrorCode(req, 502, res)).toBe("openai_502");
  });
});

describe("reading the reason from the route's response", () => {
  it("records a JSON error code", async () => {
    await answering(Response.json({ error: "auto_quota_exhausted" }, { status: 429 }))(
      new Request("https://animevocab.com/api/x")
    );
    expect(field("status")).toBe("429");
    expect(field("errorCode")).toBe("auto_quota_exhausted");
  });

  it("records a text/plain error too, which is how tts and the coach stream build theirs", async () => {
    const res = new Response(JSON.stringify({ error: "missing_text" }), { status: 400 });
    expect(res.headers.get("content-type")).toMatch(/^text\/plain/);
    await answering(res)(new Request("https://animevocab.com/api/x"));
    expect(field("errorCode")).toBe("missing_text");
  });

  it("turns a raw KV message into a bounded label", async () => {
    await answering(
      Response.json({ error: "KV GET failed: 429 Too Many Requests" }, { status: 502 })
    )(new Request("https://animevocab.com/api/x"));
    expect(field("errorCode")).toBe("kv_get_failed:_429_too_many_requests");
  });

  it("hands the route's own response back, still readable", async () => {
    const original = Response.json({ error: "auto_quota_exhausted", usage: { used: 1200 } }, { status: 429 });
    const res = await answering(original)(new Request("https://animevocab.com/api/x"));
    expect(res).toBe(original);
    expect(await res.json()).toEqual({ error: "auto_quota_exhausted", usage: { used: 1200 } });
  });

  it("never reads a successful body", async () => {
    const ok = new Response("ok", { status: 200 });
    const clone = vi.spyOn(ok, "clone");
    await answering(ok)(new Request("https://animevocab.com/api/x"));
    expect(clone).not.toHaveBeenCalled();
    expect(field("errorCode")).toBe("");
    expect(await ok.text()).toBe("ok");
  });

  it("marks a thrown handler unhandled, and still throws", async () => {
    const wrapped = withApiTelemetry("/api/x", async () => {
      throw new Error("handler_exploded");
    });
    await expect(wrapped(new Request("https://animevocab.com/api/x"))).rejects.toThrow(
      "handler_exploded"
    );
    expect(field("status")).toBe("500");
    expect(field("errorCode")).toBe("unhandled");
  });

  it("gives no reason for a body that is not an error payload", async () => {
    const bodies: Response[] = [
      new Response(new Uint8Array([1, 2, 3]), { status: 502, headers: { "content-type": "audio/mpeg" } }),
      Response.json({ message: "no error field" }, { status: 400 }),
      Response.json({ error: 42 }, { status: 400 }),
      new Response("<html>502 Bad Gateway</html>", { status: 502 }),
      new Response(null, { status: 404 }),
      new Response(JSON.stringify({ error: "x".repeat(5000) }), { status: 400 }),
      new Response(JSON.stringify({ error: "big" }), {
        status: 400,
        headers: { "content-type": "application/json", "content-length": "99999" },
      }),
    ];
    for (const res of bodies) {
      expect(await apiErrorCode(new Request("https://animevocab.com/api/x"), res.status, res)).toBe("");
    }
  });
});

describe("normalizeErrorCode", () => {
  it("keeps a route's fixed codes exactly", () => {
    for (const code of ["unauthorized", "auto_quota_exhausted", "openai_502", "missing_title"]) {
      expect(normalizeErrorCode(code)).toBe(code);
    }
  });

  it("cannot carry markup or spaces into a dashboard column", () => {
    expect(normalizeErrorCode("<script>alert(1)</script>")).toBe("script_alert_1_script");
    expect(normalizeErrorCode("  Network connection lost.  ")).toBe("network_connection_lost.");
  });

  it("caps the label at 64 chars without a dangling separator", () => {
    const out = normalizeErrorCode(`${"a".repeat(63)} tail`);
    expect(out.length).toBeLessThanOrEqual(64);
    expect(out.endsWith("_")).toBe(false);
  });

  it("gives nothing for anything that is not a string", () => {
    for (const v of [undefined, null, 42, {}, ["unauthorized"]]) expect(normalizeErrorCode(v)).toBe("");
  });
});
