import { NextRequest } from "next/server";
import { beforeEach, describe, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  verify: vi.fn(),
  delete: vi.fn(),
  put: vi.fn(),
  store: vi.fn(),
}));
vi.mock("@clerk/nextjs/webhooks", () => ({ verifyWebhook: mocks.verify }));
vi.mock("./learn-server", () => ({ getLearnStore: mocks.store }));
vi.mock("./sync-store", () => ({
  resolveStore: async () => ({ put: mocks.put }),
}));
import { POST } from "../app/api/webhooks/clerk/route";
import { deleteLearnerAccount } from "./learn-lifecycle";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.store.mockResolvedValue({ delete: mocks.delete });
});
describe("learner account lifecycle", () => {
  it("tombstones D1 before revoking tokens and erasing legacy KV data", async () => {
    await deleteLearnerAccount("a");
    expect(mocks.store).toHaveBeenCalledWith("a", { skipMigration: true });
    expect(mocks.put.mock.calls).toEqual([
      ["learn:deleted:a", "1"],
      ["sync:user:a:snapshot:v1", "null"],
      ["notebooks:user:a:v1", "{}"],
    ]);
    expect(mocks.delete.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.put.mock.invocationCallOrder[0],
    );
  });
  it("ignores unsigned deletion events", async () => {
    mocks.verify.mockRejectedValue(new Error("bad signature"));
    expect(
      (await POST(new NextRequest("http://localhost/", { method: "POST" }))).status,
    ).toBe(400);
    expect(mocks.delete).not.toHaveBeenCalled();
  });
  it("handles verified Clerk deletion with an idempotent store delete", async () => {
    mocks.verify.mockResolvedValue({ type: "user.deleted", data: { id: "a" } });
    expect(
      (await POST(new NextRequest("http://localhost/", { method: "POST" }))).status,
    ).toBe(200);
    expect(mocks.delete).toHaveBeenCalledOnce();
  });
});
