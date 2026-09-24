import { describe, expect, it } from "vitest";
import {
  PRO_FROM_KEY,
  PRO_FUNNEL_EVENTS,
  PRO_SURFACES,
  checkoutSurface,
  isProFunnelEvent,
  normalizeProSurface,
  proSurfaceFromSearch,
  rememberProSurface,
  trackCheckoutClick,
  trackProShownOnce,
} from "./pro-funnel";
import { isTrackableEvent } from "./track-events";
import { newlyUnlocked, parseSeenLevel } from "./pro-moment";
import { CARDS } from "./cards";

describe("Pro funnel allowlists (#162)", () => {
  it("accepts exactly the three funnel events", () => {
    for (const e of PRO_FUNNEL_EVENTS) expect(isProFunnelEvent(e)).toBe(true);
    for (const e of ["upgrade_prompt_shown", "PRO_PROMPT_SHOWN", "", null, 3, {}]) {
      expect(isProFunnelEvent(e)).toBe(false);
    }
  });

  it("puts every funnel event on the /api/track allowlist", () => {
    for (const e of PRO_FUNNEL_EVENTS) expect(isTrackableEvent(e)).toBe(true);
  });

  it("keeps an allowlisted surface and blanks anything else", () => {
    for (const s of PRO_SURFACES) expect(normalizeProSurface(s)).toBe(s);
    for (const s of ["APP_HEADER", " app_header", "app_header ", "x".repeat(300), "evil", null, 1, [], undefined]) {
      expect(normalizeProSurface(s)).toBe("");
    }
  });
});

function fakeStore(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
}

const throwingStore = {
  getItem: () => {
    throw new Error("SecurityError");
  },
  setItem: () => {
    throw new Error("QuotaExceeded");
  },
};

describe("journey attribution (#162)", () => {
  it("reads an allowlisted ?from= and ignores the rest", () => {
    expect(proSurfaceFromSearch("?from=ext_milestone")).toBe("ext_milestone");
    expect(proSurfaceFromSearch("?utm_source=x&from=ext_popup")).toBe("ext_popup");
    expect(proSurfaceFromSearch("?from=evil")).toBe("");
    expect(proSurfaceFromSearch("")).toBe("");
  });

  it("credits a checkout to the prompt that started the journey", () => {
    const store = fakeStore();
    expect(checkoutSurface("pricing", store)).toBe("pricing");
    rememberProSurface("ext_milestone", store);
    expect(checkoutSurface("pricing", store)).toBe("ext_milestone");
  });

  it("ignores a tampered remembered surface", () => {
    expect(checkoutSurface("pricing", fakeStore({ [PRO_FROM_KEY]: "evil" }))).toBe("pricing");
  });

  it("never throws when storage does", () => {
    expect(() => rememberProSurface("app_header", throwingStore)).not.toThrow();
    expect(checkoutSurface("app_billing", throwingStore)).toBe("app_billing");
    expect(checkoutSurface("app_billing", null)).toBe("app_billing");
  });

  it("counts an always-on prompt once per session", () => {
    const store = fakeStore();
    const sent: [string, string][] = [];
    const send = (e: string, s: string) => void sent.push([e, s]);
    expect(trackProShownOnce("app_header", store, send)).toBe(true);
    expect(trackProShownOnce("app_header", store, send)).toBe(false);
    expect(trackProShownOnce("pricing", store, send)).toBe(true);
    expect(sent).toEqual([
      ["pro_prompt_shown", "app_header"],
      ["pro_prompt_shown", "pricing"],
    ]);
  });

  it("still counts a view when storage is off", () => {
    const sent: string[] = [];
    expect(trackProShownOnce("home", throwingStore, (e) => void sent.push(e))).toBe(true);
    expect(sent).toEqual(["pro_prompt_shown"]);
  });

  it("records a direct checkout click as clicked here, checkout for the journey", () => {
    const sent: [string, string][] = [];
    const send = (e: string, s: string) => void sent.push([e, s]);
    trackCheckoutClick("pricing", fakeStore({ [PRO_FROM_KEY]: "ext_popup" }), send);
    trackCheckoutClick("app_billing", fakeStore(), send);
    expect(sent).toEqual([
      ["pro_prompt_clicked", "pricing"],
      ["pro_checkout_started", "ext_popup"],
      ["pro_prompt_clicked", "app_billing"],
      ["pro_checkout_started", "app_billing"],
    ]);
  });
});

describe("newlyUnlocked (#162 card-unlock moment)", () => {
  const byLevel = (lvl: number) => CARDS.filter((c) => c.level === lvl);

  it("stores the first level silently", () => {
    expect(newlyUnlocked(null, 12)).toEqual({ store: 12, card: null });
  });

  it("shows nothing at the same level", () => {
    expect(newlyUnlocked(5, 5)).toEqual({ store: 5, card: null });
  });

  it("names the newest card crossed", () => {
    const { store, card } = newlyUnlocked(1, 3);
    expect(store).toBe(3);
    expect(card).not.toBeNull();
    expect(card!.level).toBeGreaterThan(1);
    expect(card!.level).toBeLessThanOrEqual(3);
    // Newest: no card between it and the new level.
    expect(CARDS.some((c) => c.level > card!.level && c.level <= 3)).toBe(false);
  });

  it("returns a card that actually unlocks at that level", () => {
    const lvl = CARDS[5]!.level;
    const { card } = newlyUnlocked(lvl - 1, lvl);
    expect(byLevel(lvl)).toContain(card);
  });

  it("never lowers the stored level on a regression", () => {
    expect(newlyUnlocked(9, 4)).toEqual({ store: 9, card: null });
  });

  it("treats a garbage stored value as never seen", () => {
    expect(parseSeenLevel(null)).toBeNull();
    expect(parseSeenLevel("abc")).toBeNull();
    expect(parseSeenLevel("-1")).toBeNull();
    expect(parseSeenLevel("2.5")).toBeNull();
    expect(parseSeenLevel("7")).toBe(7);
  });
});
