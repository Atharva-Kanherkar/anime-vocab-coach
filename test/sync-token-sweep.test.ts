import { describe, expect, it } from "vitest";
// @ts-expect-error — plain .mjs helper, no types to import.
import { planSweep, SYNC_TOKEN_TTL_SECONDS } from "../scripts/purge-immortal-sync-tokens.mjs";

/**
 * The sweep's whole risk is misclassification (#114): delete a credential an
 * extension is currently holding and the learner is silently unlinked after a
 * few 401s. So the classification is a pure function, and this is the part
 * worth pinning — the network driver around it is not.
 */

const LIVE = "avc_st_aaaa1111";
const OLD = "avc_st_bbbb2222";

const key = (name: string, expiration?: number) => ({ name, expiration });

describe("planSweep", () => {
  it("keeps the token a linked extension is holding, with a TTL", () => {
    const plan = planSweep([key(`synctoken:${LIVE}:v1`)], new Set([LIVE]));
    expect(plan.expire).toEqual([{ name: `synctoken:${LIVE}:v1`, token: LIVE }]);
    expect(plan.delete).toEqual([]);
  });

  it("deletes superseded mints nobody points at", () => {
    const plan = planSweep(
      [key(`synctoken:${LIVE}:v1`), key(`synctoken:${OLD}:v1`)],
      new Set([LIVE])
    );
    expect(plan.delete).toEqual([`synctoken:${OLD}:v1`]);
    expect(plan.expire).toHaveLength(1);
  });

  it("leaves keys that already expire completely alone, so re-runs are no-ops", () => {
    const plan = planSweep([key(`synctoken:${OLD}:v1`, 1800000000)], new Set());
    expect(plan.delete).toEqual([]);
    expect(plan.expire).toEqual([]);
    expect(plan.alreadyExpiring).toBe(1);
  });

  it("never deletes the user→token pointers it depends on", () => {
    const plan = planSweep([key("synctoken:user:user_abc123:v1", 1800000000)], new Set());
    expect(plan.delete).toEqual([]);
    expect(plan.expire).toEqual([]);
    expect(plan.pointers).toBe(1);
  });

  it("gives an immortal pointer a TTL instead of leaving it forever", () => {
    // A pointer with no expiry would keep whatever token it names alive
    // indefinitely, which is the same hole one level up.
    const plan = planSweep([key("synctoken:user:user_abc123:v1")], new Set());
    expect(plan.delete).toEqual([]);
    expect(plan.expire).toEqual([{ name: "synctoken:user:user_abc123:v1", token: null }]);
  });

  it("ignores key shapes it does not recognise rather than guessing", () => {
    const plan = planSweep(
      [key("synctoken:legacy"), key("sync:user:user_abc:snapshot:v1")],
      new Set()
    );
    expect(plan.delete).toEqual([]);
    expect(plan.other).toBe(2);
  });

  it("matches the TTL a fresh mint would get", () => {
    expect(SYNC_TOKEN_TTL_SECONDS).toBe(60 * 60 * 24 * 30);
  });
});
