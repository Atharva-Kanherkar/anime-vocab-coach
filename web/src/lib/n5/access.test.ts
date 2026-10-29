import { afterEach, expect, it, vi } from "vitest";
const boundary = vi.hoisted(() => ({
  get: vi.fn(),
  put: vi.fn(),
  profile: vi.fn(),
  auth: vi.fn(),
}));
vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: async () => ({
    env: {
      N5_WEB_PREVIEW_ENABLED: "1",
      N5_PREVIEW_USERS: "invited-user",
      AVC_SYNC_KV: boundary,
    },
  }),
}));
vi.mock("@clerk/nextjs/server", () => ({ auth: boundary.auth }));
vi.mock("@/lib/auth", () => ({ resolveProfile: boundary.profile }));
import { n5AvailableFor, gateway } from "./server";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
it("dashboard membership checks cause zero KV reads/writes or network calls for users without tokens", async () => {
  boundary.get.mockResolvedValue(null);
  boundary.profile.mockResolvedValue({
    id: "new-web-only-user",
    email: null,
    name: null,
  });
  const network = vi.fn().mockResolvedValue(Response.json({ tracks: [] }));
  vi.stubGlobal("fetch", network);
  expect(await n5AvailableFor("new-web-only-user")).toBe(false);
  expect(await n5AvailableFor("invited-user")).toBe(true);
  expect(boundary.put).not.toHaveBeenCalled();
  expect(boundary.get).not.toHaveBeenCalled();
  expect(network).not.toHaveBeenCalled();
  expect(boundary.profile).not.toHaveBeenCalled();
});
it("a direct request by a non-member cannot mint a sync token either", async () => {
  boundary.auth.mockResolvedValue({ userId: "new-web-only-user" });
  const network = vi.fn();
  vi.stubGlobal("fetch", network);
  expect(
    (
      await gateway(new Request("https://animevocab.com/api/n5/catalog"), [
        "catalog",
      ])
    ).status,
  ).toBe(404);
  expect(boundary.put).not.toHaveBeenCalled();
  expect(boundary.get).not.toHaveBeenCalled();
  expect(network).not.toHaveBeenCalled();
  expect(boundary.profile).not.toHaveBeenCalled();
});
