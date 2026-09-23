import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The route's two identity sources, stubbed: the sync-token lookup (what the
// extension relies on) and Clerk (what the website relies on).
const identity = vi.hoisted(() => ({ userId: null as string | null }));
vi.mock("@/lib/request-identity", () => ({
  requestIdentity: async () => ({ userId: identity.userId, plan: null }),
}));
vi.mock("@clerk/nextjs/server", () => ({ auth: async () => ({ userId: null }) }));
vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: async () => ({ env: {} }),
}));

const { POST } = await import("./route");
const { setTelemetrySinksForTests } = await import("@/lib/telemetry");
const { EVENT_BLOBS } = await import("@/lib/telemetry-schema");

const writes: { blobs?: string[] }[] = [];
const blob = (i: number, field: string) => writes[i]!.blobs![EVENT_BLOBS.indexOf(field as never)];

const post = (body: unknown) =>
  POST(
    new Request("https://animevocab.com/api/track", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer avc_st_abc123" },
      body: JSON.stringify(body),
    })
  );

beforeEach(() => {
  writes.length = 0;
  identity.userId = null;
  setTelemetrySinksForTests(null, { writeDataPoint: (p) => void writes.push(p) });
});

afterEach(() => setTelemetrySinksForTests(null, null));

/**
 * #159: a linked learner saving a word must land under THEIR id, stamped with
 * the build that sent it — that pair is what /owner's Learning loop and
 * Extension builds panels read.
 */
describe("POST /api/track (extension learning loop)", () => {
  it("records a linked install's word_saved under the learner, with its build", async () => {
    identity.userId = "user_42";
    const res = await post({ kind: "feature", name: "word_saved", v: "0.5.7" });
    expect(res.status).toBe(204);
    expect(writes).toHaveLength(1);
    expect(blob(0, "kind")).toBe("feature");
    expect(blob(0, "name")).toBe("word_saved");
    expect(blob(0, "userId")).toBe("user_42");
    expect(blob(0, "authKind")).toBe("sync_token");
    expect(blob(0, "clientVersion")).toBe("0.5.7");
  });

  it("still records the event when the version is hostile, just unstamped", async () => {
    await post({ kind: "feature", name: "review_done", v: "<script>alert(1)</script>" });
    expect(blob(0, "name")).toBe("review_done");
    expect(blob(0, "clientVersion")).toBe("");
  });

  it("leaves website pageviews unstamped", async () => {
    await post({ kind: "pageview", name: "/pricing" });
    expect(blob(0, "clientVersion")).toBe("");
  });

  it("still drops a name that is not on the allowlist", async () => {
    const res = await post({ kind: "feature", name: "made_up", v: "0.5.7" });
    expect(res.status).toBe(204);
    expect(writes).toHaveLength(0);
  });
});
