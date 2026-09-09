import { describe, it, expect } from "vitest";
import {
  ACCOUNT_COPY,
  AUTO_LINK_COOLDOWN_MS,
  SIGN_OUT_SUPPRESSION_MS,
  interpretMintResponse,
  planLabel,
  shouldAttemptAutoLink,
  type AutoLinkGateInput,
} from "../src/lib/account-link";
import { mergeSyncProfile, normalizeSyncPlan, type SyncProfile } from "../src/lib/storage";
import { readFileSync } from "node:fs";

const NOW = 1_800_000_000_000;

function gate(partial: Partial<AutoLinkGateInput> = {}): AutoLinkGateInput {
  return {
    hasToken: false,
    now: NOW,
    lastAttemptAt: null,
    suppressedUntil: null,
    force: false,
    ...partial,
  };
}

describe("shouldAttemptAutoLink", () => {
  it("never mints while a token is already stored", () => {
    expect(shouldAttemptAutoLink(gate({ hasToken: true }))).toBe(false);
    expect(shouldAttemptAutoLink(gate({ hasToken: true, force: true }))).toBe(false);
  });

  it("attempts when nothing has been tried yet", () => {
    expect(shouldAttemptAutoLink(gate())).toBe(true);
  });

  it("throttles background attempts to one per cooldown window", () => {
    expect(shouldAttemptAutoLink(gate({ lastAttemptAt: NOW - AUTO_LINK_COOLDOWN_MS + 1 }))).toBe(false);
    expect(shouldAttemptAutoLink(gate({ lastAttemptAt: NOW - AUTO_LINK_COOLDOWN_MS }))).toBe(true);
  });

  it("lets a user-initiated attempt skip the cooldown", () => {
    const justTried = gate({ lastAttemptAt: NOW - 1000 });
    expect(shouldAttemptAutoLink(justTried)).toBe(false);
    expect(shouldAttemptAutoLink({ ...justTried, force: true })).toBe(true);
  });

  it("stays away from the mint endpoint right after a site sign-out, even on force", () => {
    const suppressed = gate({ suppressedUntil: NOW + 60_000 });
    expect(shouldAttemptAutoLink(suppressed)).toBe(false);
    expect(shouldAttemptAutoLink({ ...suppressed, force: true })).toBe(false);
  });

  it("resumes once the sign-out suppression window has passed", () => {
    expect(shouldAttemptAutoLink(gate({ suppressedUntil: NOW }))).toBe(true);
  });

  it("does not lock the user out when the clock moves backwards", () => {
    // A restored profile / NTP correction can leave a stamp in the future.
    expect(shouldAttemptAutoLink(gate({ lastAttemptAt: NOW + 86_400_000 }))).toBe(true);
  });
});

describe("interpretMintResponse", () => {
  it("links on a 200 carrying a token, keeping email, name and plan", () => {
    const outcome = interpretMintResponse(200, {
      token: "avc_st_abc",
      profile: { email: "a@b.com", name: "Ai", plan: "pro" },
    });
    expect(outcome).toEqual({
      status: "linked",
      token: "avc_st_abc",
      profile: { email: "a@b.com", name: "Ai", plan: "pro" },
    });
  });

  it("treats 401 and 403 as simply not signed in on this browser", () => {
    expect(interpretMintResponse(401, { error: "unauthorized" })).toEqual({ status: "signed-out" });
    expect(interpretMintResponse(403, null)).toEqual({ status: "signed-out" });
  });

  it("refuses to store an empty credential from a 200", () => {
    expect(interpretMintResponse(200, { profile: { email: "a@b.com" } }).status).toBe("error");
    expect(interpretMintResponse(200, { token: "" }).status).toBe("error");
    expect(interpretMintResponse(200, null).status).toBe("error");
  });

  it("reports other statuses as errors rather than sign-outs", () => {
    expect(interpretMintResponse(503, { error: "sync_store_unavailable" })).toEqual({
      status: "error",
      detail: "HTTP 503",
    });
    expect(interpretMintResponse(500, {}).status).toBe("error");
  });

  it("drops a plan value it does not recognise instead of storing it", () => {
    const outcome = interpretMintResponse(200, {
      token: "avc_st_abc",
      profile: { email: null, name: null, plan: "enterprise" },
    });
    expect(outcome).toMatchObject({ status: "linked", profile: { plan: null } });
  });

  it("links even when the endpoint sends no profile at all", () => {
    expect(interpretMintResponse(200, { token: "avc_st_abc" })).toEqual({
      status: "linked",
      token: "avc_st_abc",
      profile: { email: null, name: null, plan: null },
    });
  });
});

describe("mergeSyncProfile", () => {
  const stored: SyncProfile = { email: "a@b.com", name: "Ai", plan: "pro" };

  it("keeps the stored plan when the sender omits it", () => {
    // Older web builds and older extension builds send {email, name} only.
    expect(mergeSyncProfile(stored, { email: "a@b.com", name: "Ai" })).toEqual(stored);
  });

  it("clears the plan when the sender explicitly sends null", () => {
    expect(mergeSyncProfile(stored, { plan: null }).plan).toBeNull();
  });

  it("takes a new plan over the stored one", () => {
    expect(mergeSyncProfile(stored, { plan: "max" }).plan).toBe("max");
  });

  it("starts from empty when nothing was stored", () => {
    expect(mergeSyncProfile(null, { email: "c@d.com" })).toEqual({
      email: "c@d.com",
      name: null,
      plan: null,
    });
  });

  it("returns the stored profile untouched for a null payload", () => {
    expect(mergeSyncProfile(stored, null)).toEqual(stored);
  });
});

describe("normalizeSyncPlan", () => {
  it("accepts only the three billed tiers", () => {
    expect(normalizeSyncPlan("free")).toBe("free");
    expect(normalizeSyncPlan("pro")).toBe("pro");
    expect(normalizeSyncPlan("max")).toBe("max");
    expect(normalizeSyncPlan("owner")).toBeNull();
    expect(normalizeSyncPlan(undefined)).toBeNull();
    expect(normalizeSyncPlan(2)).toBeNull();
  });
});

describe("sign-out suppression mirror", () => {
  it("keeps sync-bridge's literal in step with SIGN_OUT_SUPPRESSION_MS", () => {
    // sync-bridge runs on every animevocab.com page view, so it cannot import
    // account-link (that would drag lib/storage and the scoring tables into the
    // bundle). It duplicates the window as a literal instead — this is the guard
    // that stops the two from drifting.
    const source = readFileSync(new URL("../src/entries/sync-bridge.ts", import.meta.url), "utf8");
    const match = source.match(/const SIGN_OUT_SUPPRESSION_MS = ([^;]+);/);
    expect(match, "sync-bridge must declare SIGN_OUT_SUPPRESSION_MS").not.toBeNull();
    const factors = match![1].split("*").map((part) => Number(part.trim()));
    expect(factors.every(Number.isFinite)).toBe(true);
    expect(factors.reduce((a, b) => a * b, 1)).toBe(SIGN_OUT_SUPPRESSION_MS);
    expect(source).toContain("autoLinkSuppressedUntil: Date.now() + SIGN_OUT_SUPPRESSION_MS");
  });
});

describe("planLabel", () => {
  it("names the tier the account reported", () => {
    expect(planLabel("free")).toBe("Free");
    expect(planLabel("pro")).toBe("Pro");
    expect(planLabel("max")).toBe("Max");
  });

  it("says nothing when the plan is unknown, so no badge is rendered", () => {
    expect(planLabel(null)).toBe("");
    expect(planLabel(undefined)).toBe("");
  });
});

describe("account copy house style", () => {
  // Em and en dashes read as an AI tell, so they are out of anything a person
  // reads. Pinning the shared constant is what keeps them from creeping back in
  // one string at a time.
  const LONG_DASH = /[\u2014\u2013]/;

  it("keeps every shared account string free of em and en dashes", () => {
    for (const [key, value] of Object.entries(ACCOUNT_COPY)) {
      const text = typeof value === "function" ? value("a@b.com") : value;
      expect(text, `ACCOUNT_COPY.${key}`).not.toMatch(LONG_DASH);
    }
  });

  it("keeps the onboarding page free of em and en dashes", () => {
    const html = readFileSync(new URL("../extension/welcome/welcome.html", import.meta.url), "utf8");
    expect(html).not.toMatch(LONG_DASH);
  });
});
