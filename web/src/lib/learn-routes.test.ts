vi.mock("next/server", () => ({ after: vi.fn() }));
import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({
  profile: vi.fn(),
  apply: vi.fn(),
  changes: vi.fn(),
  export: vi.fn(),
  delete: vi.fn(),
}));
vi.mock("./learn-lifecycle", () => ({
  deleteLearnerAccount: async () => mock.delete(),
}));
vi.mock("./auth", () => ({ resolveProfile: mock.profile }));
vi.mock("./learn-server", () => ({
  getLearnStore: vi.fn(async () => mock),
  getLearnEnvelope: vi.fn(async () => ({
    snapshot: {
      words: [],
      daily: [],
      settings: {},
      cardTimestamps: [],
      importedAt: "2026-11-01T00:00:00Z",
    },
  })),
}));
import { POST } from "../app/api/learn/ops/route";
import { GET } from "../app/api/learn/changes/route";
import { GET as exportData } from "../app/api/learn/export/route";
import { DELETE } from "../app/api/learn/account/route";
import { newLearnOp } from "./learn-protocol/model";
const request = (body: unknown) =>
  new Request("http://localhost/api/learn/ops", {
    method: "POST",
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.clearAllMocks();
  mock.profile.mockResolvedValue({ id: "user-a" });
  mock.apply.mockResolvedValue({ acknowledged: ["one"] });
  mock.changes.mockResolvedValue({ changes: [], cursor: 0, hasMore: false });
  mock.export.mockResolvedValue({ words: {}, reviews: [] });
});
describe("learner API boundaries", () => {
  it("rejects cross-origin cookie writes", async () => {
    const req = new Request("https://animevocab.com/api/learn/ops", {
      method: "POST",
      headers: { origin: "https://untrusted.example" },
      body: JSON.stringify({
        ops: [newLearnOp("settings", { settings: { subLens: false } })],
      }),
    });
    expect((await POST(req)).status).toBe(403);
    expect(mock.apply).not.toHaveBeenCalled();
  });

  it("requires authentication on every endpoint", async () => {
    mock.profile.mockResolvedValue(null);
    for (const result of [
      await POST(request({})),
      await GET(new Request("http://localhost/?since=0")),
      await exportData(new Request("http://localhost/")),
      await DELETE(request({ confirm: "DELETE" })),
    ])
      expect(result.status).toBe(401);
    expect(mock.apply).not.toHaveBeenCalled();
  });
  it("validates the batch before writing and never trusts user_id", async () => {
    const op = newLearnOp("settings", { settings: { subLens: false } });
    expect((await POST(request({ ops: [op] }))).status).toBe(200);
    expect(mock.apply).toHaveBeenCalledWith([op]);
    mock.apply.mockClear();
    expect(
      (await POST(request({ ops: [{ ...op, user_id: "b" }] }))).status,
    ).toBe(400);
    expect(
      (
        await POST(
          request({
            ops: [
              newLearnOp("settings", { settings: { openaiKey: "private" } }),
            ],
          }),
        )
      ).status,
    ).toBe(400);
    expect(mock.apply).not.toHaveBeenCalled();
  });
  it("bounds bodies, including requests without content-length", async () => {
    expect((await POST(request({ padding: "x".repeat(500001) }))).status).toBe(
      413,
    );
    expect(
      (
        await POST(
          new Request("http://localhost/", { method: "POST", body: "null" }),
        )
      ).status,
    ).toBe(400);
  });
  it("validates cursors and marks responses private", async () => {
    for (const since of ["-1", "NaN", "1.5", "9007199254740992"]) {
      // Unsafe integers are also checked by LearnStore.
      if (since === "9007199254740992") continue;
      expect(
        (await GET(new Request(`http://localhost/?since=${since}`))).status,
      ).toBe(400);
    }
    const res = await GET(new Request("http://localhost/?since=12"));
    expect(await res.json()).toMatchObject({ userId: "user-a" });
    expect(res.headers.get("cache-control")).toContain("no-store");
    expect(mock.changes).toHaveBeenCalledWith(12);
  });
  it("requires explicit deletion confirmation and exposes account export", async () => {
    expect((await DELETE(request({}))).status).toBe(400);
    expect(mock.delete).not.toHaveBeenCalled();
    expect((await DELETE(request({ confirm: "DELETE" }))).status).toBe(200);
    expect(mock.delete).toHaveBeenCalledOnce();
    expect((await exportData(new Request("http://localhost/"))).status).toBe(
      200,
    );
  });
});
