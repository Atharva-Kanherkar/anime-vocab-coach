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

/**
 * #162: the Pro funnel is only readable per surface, so the surface has to
 * survive the beacon, and nothing but a Pro row may carry one.
 */
describe("POST /api/track (Pro funnel)", () => {
  it("records a Pro prompt with its surface, under the learner", async () => {
    identity.userId = "user_7";
    await post({ kind: "feature", name: "pro_prompt_shown", surface: "ext_milestone", v: "0.6.1" });
    expect(writes).toHaveLength(1);
    expect(blob(0, "name")).toBe("pro_prompt_shown");
    expect(blob(0, "surface")).toBe("ext_milestone");
    expect(blob(0, "userId")).toBe("user_7");
  });

  it("records all three steps", async () => {
    for (const name of ["pro_prompt_shown", "pro_prompt_clicked", "pro_checkout_started"]) {
      await post({ kind: "feature", name, surface: "pricing" });
    }
    expect(writes.map((_, i) => blob(i, "name"))).toEqual([
      "pro_prompt_shown",
      "pro_prompt_clicked",
      "pro_checkout_started",
    ]);
    expect(writes.map((_, i) => blob(i, "surface"))).toEqual(["pricing", "pricing", "pricing"]);
  });

  it("keeps the row but drops an unknown surface", async () => {
    await post({ kind: "feature", name: "pro_prompt_clicked", surface: "<b>evil</b>" });
    expect(writes).toHaveLength(1);
    expect(blob(0, "surface")).toBe("");
  });

  it("never lets a non-Pro row carry a surface", async () => {
    await post({ kind: "feature", name: "word_saved", surface: "app_unlock" });
    await post({ kind: "pageview", name: "/pricing", surface: "pricing" });
    expect(blob(0, "surface")).toBe("");
    expect(blob(1, "surface")).toBe("");
  });

  it("drops the retired upgrade_click / checkout_start names", async () => {
    await post({ kind: "feature", name: "upgrade_click" });
    await post({ kind: "feature", name: "checkout_start" });
    expect(writes).toHaveLength(0);
  });
});

/**
 * #206: the sign-in gate is read per surface, so its rows carry one too. The
 * allowlist is separate from the Pro one; a surface from the other funnel must
 * not leak in.
 */
describe("POST /api/track (sign-in gate)", () => {
  it("records every gate step with its surface", async () => {
    for (const name of [
      "signin_gate_shown",
      "signin_started",
      "signin_completed",
      "signin_gate_dismissed",
    ]) {
      await post({ kind: "feature", name, surface: "content_chip" });
    }
    expect(writes.map((_, i) => blob(i, "name"))).toEqual([
      "signin_gate_shown",
      "signin_started",
      "signin_completed",
      "signin_gate_dismissed",
    ]);
    expect(writes.map((_, i) => blob(i, "surface"))).toEqual([
      "content_chip",
      "content_chip",
      "content_chip",
      "content_chip",
    ]);
  });

  it("accepts the popup and start page surfaces", async () => {
    await post({ kind: "feature", name: "signin_gate_shown", surface: "popup" });
    await post({ kind: "feature", name: "signin_gate_shown", surface: "start_page" });
    expect(writes.map((_, i) => blob(i, "surface"))).toEqual(["popup", "start_page"]);
  });

  it("keeps the row but drops an unknown surface", async () => {
    await post({ kind: "feature", name: "signin_started", surface: "<b>evil</b>" });
    expect(writes).toHaveLength(1);
    expect(blob(0, "surface")).toBe("");
  });

  it("does not let a Pro surface cross into the sign-in funnel", async () => {
    await post({ kind: "feature", name: "signin_gate_shown", surface: "ext_milestone" });
    expect(blob(0, "surface")).toBe("");
  });

  it("does not let a sign-in surface cross into the Pro funnel", async () => {
    await post({ kind: "feature", name: "pro_prompt_shown", surface: "content_chip" });
    expect(blob(0, "surface")).toBe("");
  });
});
