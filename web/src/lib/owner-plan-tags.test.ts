import { afterEach, describe, expect, it, vi } from "vitest";
import { MAX_PLAN_ACCOUNTS, foldPlanTags, loadPlanTags, planTagsSql } from "./owner-plan-tags";
import { planBucket, type ClerkUserRow } from "./owner-history";
import { sqlString } from "./telemetry-query";
import { llmColumn, transcribeColumn } from "./telemetry-schema";

/**
 * Issue #163: Clerk showed 5 Max and 2 Pro while every call read free. These
 * pin the check that says whether that is a tagging bug or expired gifts.
 */

const DAY = 86_400_000;
const account = (id: string, meta: Record<string, unknown>): ClerkUserRow => ({
  id,
  createdAt: 0,
  lastActiveAt: null,
  plan: planBucket(meta),
  email: `${id}@x.io`,
});
const paid = account("user_paid", { plan: "pro", billingInterval: "monthly" });
const gift = account("user_gift", { plan: "max", planExpiresAt: new Date(Date.now() + 9 * DAY).toISOString() });
const expired = account("user_expired", { plan: "max", planExpiresAt: new Date(Date.now() - 9 * DAY).toISOString() });
const quiet = account("user_quiet", { plan: "pro", billingInterval: "yearly" });

describe("planTagsSql", () => {
  it("reads userId and plan by schema position, for the named accounts only", () => {
    const sql = planTagsSql("llm", 24, ["user_a", "user_'b"])!;
    expect(sql).toContain("FROM avc_llm");
    expect(sql).toContain(`${llmColumn("userId")} AS userId`);
    expect(sql).toContain(`${llmColumn("plan")} AS plan`);
    expect(sql).toContain(`(${llmColumn("userId")} = 'user_a' OR ${llmColumn("userId")} = ${sqlString("user_'b")})`);
    expect(sql).toContain("GROUP BY userId, plan");
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

describe("foldPlanTags", () => {
  it("says ok, mismatch or no calls, mismatches first", () => {
    const rows = foldPlanTags(
      [paid, gift, expired, quiet],
      [
        { source: "llm", row: { userId: "user_paid", plan: "pro", calls: 40 } },
        { source: "transcribe", row: { userId: "user_paid", plan: "pro", calls: 3 } },
        // A live gift whose calls still say free: a stale sync-token profile.
        { source: "llm", row: { userId: "user_gift", plan: "free", calls: 12 } },
        // An expired gift tagged free is correct.
        { source: "transcribe", row: { userId: "user_expired", plan: "free", calls: 7 } },
      ]
    );
    expect(rows.map((r) => [r.userId, r.verdict])).toEqual([
      ["user_gift", "mismatch"],
      ["user_paid", "ok"],
      ["user_expired", "ok"],
      ["user_quiet", "no calls"],
    ]);
    expect(rows[0]).toMatchObject({ bucket: "max · gift", effective: "max" });
    expect(rows[1]!.tags).toEqual([
      { source: "llm", plan: "pro", calls: 40 },
      { source: "transcribe", plan: "pro", calls: 3 },
    ]);
    expect(rows[2]).toMatchObject({ bucket: "gift expired", effective: "free" });
  });

  it("never calls the owner tag a mismatch, and coerces AE's string numbers", () => {
    const [r] = foldPlanTags([paid], [
      { source: "llm", row: { userId: "user_paid", plan: "owner", calls: "9" as unknown as number } },
    ]);
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
          : Response.json({ data: [{ userId: "user_paid", plan: "pro", calls: "5" }] })
      )
    );
    const out = await loadPlanTags(24, [paid], creds);
    expect(out.failed).toEqual(["plan tags (transcribe)"]);
    expect(out.rows[0]).toMatchObject({ verdict: "ok", tags: [{ source: "llm", plan: "pro", calls: 5 }] });
  });
});
