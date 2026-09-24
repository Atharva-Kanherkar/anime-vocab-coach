import { afterEach, describe, expect, it, vi } from "vitest";
import { MAX_PLAN_ACCOUNTS, expectedPlanOn, foldPlanTags, loadPlanTags, planTagsSql } from "./owner-plan-tags";
import { planBucket, type ClerkUserRow } from "./owner-history";
import { sqlString } from "./telemetry-query";
import { llmColumn, transcribeColumn } from "./telemetry-schema";

/**
 * Issue #163: Clerk showed 5 Max and 2 Pro while every call read free. These
 * pin the check that says whether that is a tagging bug or expired gifts.
 */

/** "Today" for every fixture, so buckets do not depend on the real clock. */
const NOW = Date.parse("2026-09-25T00:00:00Z");
const account = (id: string, meta: Record<string, unknown>): ClerkUserRow => ({
  id,
  createdAt: 0,
  lastActiveAt: null,
  plan: planBucket(meta, NOW),
  email: `${id}@x.io`,
});
const paid = account("user_paid", { plan: "pro", billingInterval: "monthly" });

describe("planTagsSql", () => {
  it("reads userId and plan by schema position, for the named accounts only", () => {
    const sql = planTagsSql("llm", 24, ["user_a", "user_'b"])!;
    expect(sql).toContain("FROM avc_llm");
    expect(sql).toContain(`${llmColumn("userId")} AS userId`);
    expect(sql).toContain(`${llmColumn("plan")} AS plan`);
    expect(sql).toContain(`(${llmColumn("userId")} = 'user_a' OR ${llmColumn("userId")} = ${sqlString("user_'b")})`);
    expect(sql).toContain("toDate(timestamp) AS day");
    expect(sql).toContain("GROUP BY userId, plan, day");
    expect(sql).toContain("INTERVAL '24' HOUR");
  });

  it("uses the transcription dataset's own columns", () => {
    const sql = planTagsSql("transcribe", 24, ["user_a"])!;
    expect(sql).toContain("FROM avc_transcribe");
    expect(sql).toContain(`${transcribeColumn("plan")} AS plan`);
  });

  it("is no query at all when there is nobody to check", () => {
    expect(planTagsSql("llm", 24, [])).toBeNull();
  });

  it("names at most MAX_PLAN_ACCOUNTS accounts", () => {
    const ids = Array.from({ length: MAX_PLAN_ACCOUNTS + 20 }, (_, i) => `user_${i}`);
    expect(planTagsSql("llm", 24, ids)!.match(/ OR /g)).toHaveLength(MAX_PLAN_ACCOUNTS - 1);
  });
});

// Fixed dates, so "before" and "after" a plan change are exact.
const at = (iso: string) => Date.parse(iso);
const dated = (
  id: string,
  meta: Record<string, unknown>,
  updatedAt: string | null
): ClerkUserRow => ({ ...account(id, meta), updatedAt: updatedAt ? at(updatedAt) : null });
const tag = (source: "llm" | "transcribe", userId: string, plan: string, day: string, calls: number) => ({
  source,
  row: { userId, plan, day, calls },
});

describe("expectedPlanOn", () => {
  const gift = dated("user_g", { plan: "max", planExpiresAt: "2026-09-10T12:00:00.000Z" }, "2026-06-10T09:00:00Z");
  it("knows nothing on or before the last Clerk write", () => {
    expect(expectedPlanOn(gift, "2026-06-01")).toBeNull();
    expect(expectedPlanOn(gift, "2026-06-10")).toBeNull();
  });
  it("is the gift before its expiry day, free after, and unknown on the day itself", () => {
    expect(expectedPlanOn(gift, "2026-08-01")).toBe("max");
    expect(expectedPlanOn(gift, "2026-09-10")).toBeNull();
    expect(expectedPlanOn(gift, "2026-09-11")).toBe("free");
  });
  it("is free throughout for a malformed expiry, as the meters apply it", () => {
    const bad = dated("user_b", { plan: "max", planExpiresAt: "garbage" }, "2026-06-10T09:00:00Z");
    expect(expectedPlanOn(bad, "2026-08-01")).toBe("free");
  });
  it("knows nothing at all without an update time", () => {
    expect(expectedPlanOn(dated("user_n", { plan: "pro" }, null), "2026-09-20")).toBeNull();
  });
});

describe("foldPlanTags", () => {
  const paid = dated("user_paid", { plan: "pro", billingInterval: "monthly" }, "2026-07-01T00:00:00Z");
  const quiet = dated("user_quiet", { plan: "pro", billingInterval: "yearly" }, "2026-07-01T00:00:00Z");

  it("#169 review: calls on both sides of a gift expiry are both correct", () => {
    const expired = dated("user_exp", { plan: "max", planExpiresAt: "2026-09-10T12:00:00.000Z" }, "2026-06-10T09:00:00Z");
    const [r] = foldPlanTags([expired], [
      tag("llm", "user_exp", "max", "2026-08-20", 30), // during the gift
      tag("llm", "user_exp", "free", "2026-09-15", 12), // after it ran out
    ]);
    expect(r).toMatchObject({ bucket: "gift expired", verdict: "ok", wrong: [], unjudgedCalls: 0 });
  });

  it("a paid tag after the gift ran out is a real mismatch", () => {
    const expired = dated("user_exp", { plan: "max", planExpiresAt: "2026-09-10T12:00:00.000Z" }, "2026-06-10T09:00:00Z");
    const [r] = foldPlanTags([expired], [tag("transcribe", "user_exp", "max", "2026-09-20", 4)]);
    expect(r).toMatchObject({
      verdict: "mismatch",
      wrong: [{ source: "transcribe", plan: "max", expected: "free", calls: 4 }],
    });
  });

  it("#169 review: free calls before a recent upgrade are not judged, not a bug", () => {
    const upgraded = dated("user_up", { plan: "pro", billingInterval: "monthly" }, "2026-09-18T15:00:00Z");
    const [r] = foldPlanTags([upgraded], [
      tag("llm", "user_up", "free", "2026-09-02", 50),
      tag("llm", "user_up", "free", "2026-09-18", 5), // the upgrade day itself
    ]);
    expect(r).toMatchObject({ verdict: "unclear", unjudgedCalls: 55, wrong: [] });

    const [after] = foldPlanTags([upgraded], [
      tag("llm", "user_up", "free", "2026-09-02", 50),
      tag("llm", "user_up", "pro", "2026-09-20", 8),
    ]);
    expect(after).toMatchObject({ verdict: "ok", unjudgedCalls: 50 });
  });

  it("a free call after the upgrade was written is the stale-profile bug", () => {
    const upgraded = dated("user_up", { plan: "pro", billingInterval: "monthly" }, "2026-09-18T15:00:00Z");
    const [r] = foldPlanTags([upgraded], [tag("llm", "user_up", "free", "2026-09-22", 7)]);
    expect(r).toMatchObject({ verdict: "mismatch", wrong: [{ plan: "free", expected: "pro", calls: 7 }] });
  });

  it("orders mismatch, ok, unclear, no calls, and merges llm and transcribe", () => {
    const stale = dated("user_stale", { plan: "max", planExpiresAt: "2026-12-01T00:00:00.000Z" }, "2026-09-01T00:00:00Z");
    const unknown = dated("user_unknown", { plan: "pro" }, null);
    const rows = foldPlanTags(
      [quiet, unknown, paid, stale],
      [
        tag("llm", "user_paid", "pro", "2026-09-20", 40),
        tag("transcribe", "user_paid", "pro", "2026-09-21", 3),
        tag("llm", "user_stale", "free", "2026-09-10", 12),
        tag("llm", "user_unknown", "free", "2026-09-10", 2),
      ]
    );
    expect(rows.map((r) => [r.userId, r.verdict])).toEqual([
      ["user_stale", "mismatch"],
      ["user_paid", "ok"],
      ["user_unknown", "unclear"],
      ["user_quiet", "no calls"],
    ]);
    expect(rows[1]!.tags).toEqual([
      { source: "llm", plan: "pro", calls: 40 },
      { source: "transcribe", plan: "pro", calls: 3 },
    ]);
  });

  it("never calls the owner tag wrong, and coerces AE's string numbers", () => {
    const [r] = foldPlanTags([paid], [tag("llm", "user_paid", "owner", "2026-06-01", "9" as unknown as number)]);
    expect(r).toMatchObject({ verdict: "ok", tags: [{ source: "llm", plan: "owner", calls: 9 }] });
  });
});

describe("loadPlanTags", () => {
  afterEach(() => vi.unstubAllGlobals());
  const creds = { accountId: "acct", apiToken: "tok" };

  it("runs no query when nobody holds a paid plan", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    expect(await loadPlanTags(24, [], creds)).toEqual({ rows: [], failed: [], skipped: 0 });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("asks both datasets and names a failing one", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) =>
        String(init.body).includes("avc_transcribe")
          ? new Response("no such table", { status: 400 })
          : Response.json({ data: [{ userId: "user_paid", plan: "pro", day: "2026-09-20", calls: "5" }] })
      )
    );
    const out = await loadPlanTags(24, [{ ...paid, updatedAt: Date.parse("2026-07-01") }], creds);
    expect(out.failed).toEqual(["plan tags (transcribe)"]);
    expect(out.rows[0]).toMatchObject({ verdict: "ok", tags: [{ source: "llm", plan: "pro", calls: 5 }] });
  });
});
