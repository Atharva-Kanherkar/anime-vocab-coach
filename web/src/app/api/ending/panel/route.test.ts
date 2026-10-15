import { describe, expect, it, vi } from "vitest";

// Real ending-store (in-process Map, no Cloudflare binding) and the real
// atomic lock's in-process stand-in. Only the image generator is faked, with a
// delay long enough for every request to arrive while the first one draws.
vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: async () => {
    throw new Error("no cf in tests");
  },
}));
vi.mock("@/lib/ai-store", () => ({ getOpenAiKey: async () => "sk-test" }));
const draws = vi.hoisted(() => ({ count: 0 }));
vi.mock("@/lib/ending-openai", () => ({
  generateEndingPanelImage: async () => {
    draws.count += 1;
    await new Promise((r) => setTimeout(r, 50));
    return "iVBORw0KGgo=";
  },
}));

const { POST } = await import("./route");
const { putEndingCreation } = await import("@/lib/ending-store");

const draw = (id: string, i: number) =>
  POST(
    new Request("https://animevocab.com/api/ending/panel", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, i }),
    })
  );

describe("/api/ending/panel draw lock (ISO 25010 security: resistance)", () => {
  it("pays for one image when 10 requests for the same uncached panel arrive at once", async () => {
    await putEndingCreation({
      id: "e2e-lock-1",
      createdAt: new Date().toISOString(),
      source: "custom",
      seriesTitle: "Frieren",
      seriesSub: "",
      endingTitle: "After",
      tone: "Heartfelt",
      styleKey: "spirit",
      accent: "#000",
      language: "en",
      done: 0,
      title: { en: "t", ja: "t" },
      cast: [],
      panels: Array.from({ length: 5 }, () => ({ scene: "s", lines: [] })),
    } as never);

    const statuses = (await Promise.all(Array.from({ length: 10 }, () => draw("e2e-lock-1", 0)))).map((r) => r.status);
    expect(draws.count).toBe(1);
    expect(statuses.filter((s) => s === 200)).toHaveLength(1);
    expect(statuses.filter((s) => s === 409)).toHaveLength(9);

    // The waiting tabs' next poll is served from the stored image.
    const again = await draw("e2e-lock-1", 0);
    expect(again.status).toBe(200);
    expect(await again.json()).toMatchObject({ cached: true });
    expect(draws.count).toBe(1);
  });
});
