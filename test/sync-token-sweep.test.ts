import { describe, expect, it } from "vitest";
// @ts-expect-error — plain .mjs helper, no types to import.
import { planSweep, parseLimit, SYNC_TOKEN_TTL_SECONDS } from "../scripts/purge-immortal-sync-tokens.mjs";

/**
 * The sweep's whole risk is unlinking somebody (#114).
 *
 * The reverse pointer `synctoken:user:<id>:v1` was introduced BY the TTL fix,
 * so every key in the backlog predates it and none of them has a pointer —
 * including the credential an extension that linked before the fix is still
 * holding. "No pointer" therefore proves nothing, and nothing is deleted.
 */

const LIVE = "avc_st_aaaa1111";
const OLD = "avc_st_bbbb2222";

const key = (name: string, expiration?: number) => ({ name, expiration });

describe("planSweep", () => {
  it("gives an immortal token a TTL instead of deleting it", () => {
    const plan = planSweep([key(`synctoken:${LIVE}:v1`)]);
    expect(plan.expire).toEqual([{ name: `synctoken:${LIVE}:v1`, token: LIVE, kind: "token" }]);
  });

  it("never deletes anything, pointer or not — there is no delete list", () => {
    const plan = planSweep([key(`synctoken:${LIVE}:v1`), key(`synctoken:${OLD}:v1`)]);
    expect(plan).not.toHaveProperty("delete");
    expect(plan.expire).toHaveLength(2);
  });

  it("leaves keys that already expire completely alone, so re-runs are no-ops", () => {
    const plan = planSweep([key(`synctoken:${OLD}:v1`, 1800000000)]);
    expect(plan.expire).toEqual([]);
    expect(plan.alreadyExpiring).toBe(1);
  });

  it("gives an immortal pointer a TTL too, and marks it as a pointer", () => {
    const plan = planSweep([key("synctoken:user:user_abc123:v1")]);
    expect(plan.expire).toEqual([
      { name: "synctoken:user:user_abc123:v1", token: null, kind: "pointer" },
    ]);
  });

  it("ignores key shapes it does not recognise rather than guessing", () => {
    const plan = planSweep([key("synctoken:legacy"), key("sync:user:user_abc:snapshot:v1")]);
    expect(plan.expire).toEqual([]);
    expect(plan.other).toBe(2);
  });

  it("matches the TTL a fresh mint would get", () => {
    expect(SYNC_TOKEN_TTL_SECONDS).toBe(60 * 60 * 24 * 30);
  });
});

describe("parseLimit", () => {
  it("defaults to no limit when the flag is absent", () => {
    expect(parseLimit(undefined)).toEqual({ ok: true, limit: Infinity });
  });

  it("accepts a positive integer", () => {
    expect(parseLimit("500")).toEqual({ ok: true, limit: 500 });
  });

  /**
   * Every one of these used to become Infinity or a negative slice under
   * `Number(raw) || Infinity` — so a cautious operator asking for a 100-key
   * first slice would have written the whole namespace.
   */
  it.each(["abc", "0", "-5", "1.5", "", " ", "1e9999"])("refuses %j", (raw) => {
    expect(parseLimit(raw).ok).toBe(false);
  });

  it("refuses a flag written with no value at all", () => {
    // `arg()` maps `--limit` with nothing after it (or another flag after it)
    // to "", which parseLimit rejects — rather than to undefined, which means
    // "no limit requested".
    expect(parseLimit("").ok).toBe(false);
  });
});
