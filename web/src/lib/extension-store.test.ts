import { beforeEach, describe, expect, it, vi } from "vitest";

const store = new Map<string, string>();

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: async () => ({
    env: {
      AVC_SYNC_KV: {
        get: async (key: string) => (store.has(key) ? store.get(key)! : null),
        put: async (key: string, value: string) => {
          store.set(key, value);
        },
      },
    },
  }),
}));

const { trackExtensionEvent, getExtensionStatsTotals } = await import("./extension-store");
const { isExtensionEvent } = await import("./extension-funnel");

describe("extension funnel KV analytics", () => {
  beforeEach(() => store.clear());

  it("allowlists only known events", () => {
    expect(isExtensionEvent("review_prompt_shown")).toBe(true);
    expect(isExtensionEvent("review_prompt_clicked")).toBe(true);
    expect(isExtensionEvent("land_reel")).toBe(false);
  });

  it("trackExtensionEvent writes daily + durable all-time keys", async () => {
    await trackExtensionEvent("review_prompt_shown", "2026-07-17");
    expect(store.get("extstats:2026-07-17:review_prompt_shown")).toBe("1");
    expect(store.get("extstats:total:review_prompt_shown")).toBe("1");
  });

  it("getExtensionStatsTotals reads all-time keys", async () => {
    store.set("extstats:total:review_prompt_shown", "3");
    store.set("extstats:total:review_prompt_clicked", "1");
    const totals = await getExtensionStatsTotals();
    expect(totals.review_prompt_shown).toBe(3);
    expect(totals.review_prompt_clicked).toBe(1);
  });
});
