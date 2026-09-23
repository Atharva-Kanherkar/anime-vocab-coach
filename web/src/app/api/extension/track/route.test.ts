import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: async () => ({ env: {} }),
}));

const { POST } = await import("./route");
const { CWS_EXTENSION_ID, setExtensionAnalyticsForTests, setExtensionRateKvForTests } =
  await import("@/lib/extension-store");

const points: { blobs?: string[] }[] = [];

const post = (body: unknown) =>
  POST(
    new Request("https://animevocab.com/api/extension/track", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: `chrome-extension://${CWS_EXTENSION_ID}`,
        "x-avc-extension-id": CWS_EXTENSION_ID,
      },
      body: JSON.stringify(body),
    })
  );

beforeEach(() => {
  points.length = 0;
  setExtensionAnalyticsForTests({ writeDataPoint: (p) => void points.push(p) });
  const kv = new Map<string, string>();
  setExtensionRateKvForTests({
    get: async (k) => kv.get(k) ?? null,
    put: async (k, v) => void kv.set(k, v),
  });
});

describe("POST /api/extension/track", () => {
  it("writes the event with the sending build's version (#159)", async () => {
    expect((await post({ event: "first_card_created", v: "0.5.7" })).status).toBe(204);
    expect(points.map((p) => p.blobs)).toEqual([["first_card_created", "0.5.7"]]);
  });

  it("counts an unversioned or hostile-versioned event as unstamped, not dropped", async () => {
    await post({ event: "onboarding_shown" });
    await post({ event: "onboarding_shown", v: "9".repeat(40) });
    expect(points.map((p) => p.blobs)).toEqual([
      ["onboarding_shown", ""],
      ["onboarding_shown", ""],
    ]);
  });

  it("fits the longest event plus a version inside the body limit", async () => {
    await post({ event: "upgrade_prompt_clicked", v: "65535.65535.65535.65535" });
    expect(points).toHaveLength(1);
  });
});
