import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  profile: vi.fn(),
  token: vi.fn(),
  existing: vi.fn(),
  auth: vi.fn(),
}));
vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("@/lib/auth", () => ({ resolveProfile: mocks.profile }));
vi.mock("./credential", () => ({ courseCredential: mocks.token }));
vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: async () => ({ env: {} }),
}));
import { gateway, n5Config, n5AvailableFor } from "./server";
const upstream = vi.fn();
const request = (
  path = "catalog",
  method = "GET",
  body?: string,
  headers: Record<string, string> = {},
) =>
  gateway(
    new Request(`https://animevocab.com/api/n5/${path}`, {
      method,
      headers: {
        ...(method !== "GET"
          ? {
              Origin: "https://animevocab.com",
              "Content-Type": "application/json",
            }
          : {}),
        ...headers,
      },
      ...(body !== undefined ? { body } : {}),
    }),
    path.split("?", 1)[0].split("/"),
  );
beforeEach(() => {
  vi.stubEnv("N5_WEB_PREVIEW_ENABLED", "1");
  vi.stubEnv("N5_PREVIEW_USERS", "alice,bob");
  vi.stubEnv("N5_API_ORIGIN", "https://avc-api.animevocab.workers.dev");
  mocks.auth.mockReset().mockResolvedValue({ userId: "alice" });
  mocks.profile
    .mockReset()
    .mockResolvedValue({ id: "alice", email: null, name: null });
  mocks.existing.mockReset().mockResolvedValue(null);
  mocks.token.mockReset().mockResolvedValue("private-bearer-never-in-browser");
  upstream
    .mockReset()
    .mockImplementation(async () => Response.json({ tracks: [] }));
  vi.stubGlobal("fetch", upstream);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe("authenticated N5 gateway", () => {
  it("defaults off before auth or network activity", async () => {
    vi.stubEnv("N5_WEB_PREVIEW_ENABLED", "");
    vi.stubEnv("N5_API_ORIGIN", "not-url");
    expect((await request()).status).toBe(404);
    expect(mocks.profile).not.toHaveBeenCalled();
    expect(upstream).not.toHaveBeenCalled();
  });
  it("uses only verified identity and server-owned token, without forwarding sensitive headers", async () => {
    const response = await request("enrolments", "POST", '{"userId":"bob"}');
    expect(mocks.token).toHaveBeenCalledWith("alice");
    expect(upstream).toHaveBeenCalledWith(
      "https://avc-api.animevocab.workers.dev/v1/n5/enrolments",
      expect.objectContaining({
        method: "POST",
        redirect: "error",
        cache: "no-store",
        headers: {
          Authorization: "Bearer private-bearer-never-in-browser",
          "Content-Type": "application/json",
        },
      }),
    );
    expect(await response.text()).not.toContain("private-bearer");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Vary")).toBe("Cookie");
    mocks.auth.mockResolvedValueOnce({ userId: "bob" });
    mocks.profile.mockResolvedValueOnce({ id: "bob" });
    await request();
    expect(mocks.token).toHaveBeenLastCalledWith("bob");
  });
  it("uses course credentials without extension tokens or full profile reads", async () => {
    mocks.token.mockResolvedValueOnce("avc_n5_privatecredential");
    expect((await request()).status).toBe(200);
    expect(mocks.token).toHaveBeenCalledWith("alice");
    expect(mocks.existing).not.toHaveBeenCalled();
    expect(mocks.profile).not.toHaveBeenCalled();
    expect(upstream.mock.calls[0][1].headers.Authorization).toBe("Bearer avc_n5_privatecredential");
  });
  it("requires cookie identity and exact same-origin mutation intent", async () => {
    expect(
      (
        await request("catalog", "GET", undefined, {
          Authorization: "Bearer attacker",
        })
      ).status,
    ).toBe(401);
    mocks.auth.mockResolvedValueOnce({ userId: null });
    expect((await request()).status).toBe(401);
    for (const headers of [
      { Origin: "https://evil.test" },
      { Origin: "null" },
      { Origin: "" },
      { "Sec-Fetch-Site": "cross-site" },
    ] as Record<string, string>[])
      expect((await request("events", "POST", "{}", headers)).status).toBe(403);
    expect(
      (
        await request("catalog", "GET", undefined, {
          "Sec-Fetch-Site": "cross-site",
        })
      ).status,
    ).toBe(403);
    expect(upstream).not.toHaveBeenCalled();
  });
  it("uses the browser Host when Next normalizes a local URL and ignores forwarded-host spoofing", async () => {
    const make = (origin: string) =>
      new Request("http://localhost:4000/api/n5/events", {
        method: "POST",
        headers: {
          Host: "127.0.0.1:4000",
          Origin: origin,
          "X-Forwarded-Host": "evil.test",
          "Content-Type": "application/json",
        },
        body: "{}",
      });
    expect(
      (await gateway(make("http://127.0.0.1:4000"), ["events"])).status,
    ).toBe(200);
    expect((await gateway(make("http://evil.test"), ["events"])).status).toBe(
      403,
    );
  });
  it("rejects unsupported paths, methods, mixed-script query, content types and oversized bodies", async () => {
    for (const [path, method] of [
      ["me", "DELETE"],
      ["catalog", "POST"],
      ["lessons/lesson?script=romaji-kana", "GET"],
      ["catalog?upstream=https://evil.test", "GET"],
    ])
      expect((await request(path, method)).status).toBe(404);
    expect(
      (await request("events", "POST", "{}", { "Content-Type": "text/plain" }))
        .status,
    ).toBe(415);
    expect((await request("events", "POST", "x".repeat(16385))).status).toBe(
      413,
    );
    const id = "11111111-1111-4111-8111-111111111111";
    expect((await request(`attempts/${id}`, "DELETE", "{}")).status).toBe(400);
    expect(upstream).not.toHaveBeenCalled();
    expect((await request("events", "POST", "x".repeat(16384))).status).toBe(
      200,
    );
    expect((await request(`attempts/${id}`, "DELETE", "")).status).toBe(200);
  });
  it("fails safely on network/auth-store errors, upstream redirects, invalid JSON and oversized responses", async () => {
    for (const value of [
      new Response("<secret>", { status: 500 }),
      new Response("bad", { status: 200 }),
      Response.json({ error: { message: "private-bearer" } }, { status: 503 }),
      new Response("{", { headers: { "Content-Type": "application/json" } }),
      Response.json({ value: "x".repeat(524288) }),
    ]) {
      upstream.mockResolvedValueOnce(value);
      const r = await request();
      expect(r.status).toBe(503);
      expect(await r.text()).not.toContain("private-bearer");
    }
    upstream.mockRejectedValueOnce(new DOMException("timeout", "TimeoutError"));
    expect((await request()).status).toBe(503);
    mocks.token.mockRejectedValueOnce(new Error("credential failure"));
    expect((await request()).status).toBe(503);
  });
  it("preserves typed conflict/question details without reflecting arbitrary upstream messages", async () => {
    upstream.mockResolvedValueOnce(
      Response.json(
        {
          error: {
            code: "invalid_answers",
            message: "sensitive typed text",
            details: { questionId: "write-name", answers: "private" },
          },
        },
        { status: 400 },
      ),
    );
    const response = await request();
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error.details).toEqual({ questionId: "write-name" });
    expect(JSON.stringify(data)).not.toMatch(/sensitive|private/);
  });
  it("accepts loopback development only and never follows a browser-supplied upstream", async () => {
    vi.stubEnv("N5_API_ORIGIN", "http://127.0.0.1:43111");
    expect((await n5Config()).origin).toBe("http://127.0.0.1:43111");
    for (const origin of [
      "https://evil.test",
      "http://169.254.169.254",
      "https://u:p@avc-api.animevocab.workers.dev",
      "https://avc-api.animevocab.workers.dev/path",
    ]) {
      vi.stubEnv("N5_API_ORIGIN", origin);
      await expect(n5Config()).rejects.toThrow();
    }
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("N5_API_ORIGIN", "http://localhost:43111");
    await expect(n5Config()).rejects.toThrow();
  });
});

it("normalizes trusted origins and supports explicit previews only for the same Worker", async () => {
  vi.stubEnv("NODE_ENV", "production");
  for (const origin of [
    "https://AVC-API.animevocab.workers.dev/",
    "https://feat-n5-web-preview-avc-api.animevocab.workers.dev/",
  ]) {
    vi.stubEnv("N5_API_ORIGIN", origin);
    expect((await n5Config()).origin).toBe(new URL(origin).origin);
  }
  for (const origin of [
    "https://evil-avc-api.workers.dev",
    "https://avc-api.animevocab.workers.dev.evil.test",
    "https://avc-api.animevocab.workers.dev:444",
  ]) {
    vi.stubEnv("N5_API_ORIGIN", origin);
    await expect(n5Config()).rejects.toThrow();
  }
});
it("uses only the local exact-member allowlist for navigation and layout", async () => {
  vi.stubEnv("N5_PREVIEW_USERS", " alice, bob , ,");
  expect(await n5AvailableFor(null)).toBe(false);
  expect(await n5AvailableFor("ali")).toBe(false);
  expect(await n5AvailableFor("alice")).toBe(true);
  expect(await n5AvailableFor("bob")).toBe(true);
  expect(upstream).not.toHaveBeenCalled();
  expect(mocks.existing).not.toHaveBeenCalled();
  expect(mocks.token).not.toHaveBeenCalled();
  expect(mocks.profile).not.toHaveBeenCalled();
  vi.stubEnv("N5_PREVIEW_USERS", "");
  expect(await n5AvailableFor("alice")).toBe(false);
  vi.stubEnv("N5_WEB_PREVIEW_ENABLED", "0");
  expect(await n5AvailableFor("alice")).toBe(false);
  vi.stubEnv("N5_WEB_PREVIEW_ENABLED", "1");
  vi.stubEnv("N5_API_ORIGIN", "bad");
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  expect(await n5AvailableFor("alice")).toBe(false);
  expect(warn).toHaveBeenCalled();
  warn.mockRestore();
});
it("rejects non-members at the gateway before credential lookup or mint", async () => {
  vi.stubEnv("N5_PREVIEW_USERS", "bob");
  expect((await request()).status).toBe(404);
  expect(mocks.existing).not.toHaveBeenCalled();
  expect(mocks.token).not.toHaveBeenCalled();
  expect(mocks.profile).not.toHaveBeenCalled();
  expect(upstream).not.toHaveBeenCalled();
});
it("uses the verified session owner regardless of unrelated profile metadata", async () => {
  mocks.profile.mockResolvedValueOnce({ id: "bob" });
  expect((await request()).status).toBe(200);
  expect(mocks.profile).not.toHaveBeenCalled();
  expect(mocks.token).toHaveBeenCalledWith("alice");
});
