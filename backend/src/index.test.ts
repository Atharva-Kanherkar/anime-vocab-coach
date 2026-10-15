import { describe, expect, it, vi } from "vitest";
import worker, { SECURITY_HEADERS, type Env } from "./index";
import { hashSyncToken } from "./sync-auth";
import { fakeEnv } from "./test-fakes";

const call = (path: string, init?: RequestInit, env: Env = fakeEnv()) =>
  worker.fetch(new Request("https://api.animevocab.com" + path, init), env);

/** A signed-in extension: a sync token whose KV record is a free-plan profile. */
const TOKEN_RECORD_KEY = `synctoken:h:${await hashSyncToken("avc_st_test1")}:v1`;
function signedIn(env = fakeEnv()) {
  env.AVC_KV.store.set(
    TOKEN_RECORD_KEY,
    JSON.stringify({ id: "user_1", email: "u@example.com", name: "U", plan: "free", touchedAt: Date.now() })
  );
  return { env, auth: { Authorization: "Bearer avc_st_test1", "Content-Type": "application/json" } };
}

describe("API security headers (ISO 25010 security audit)", () => {
  it.each([
    ["GET /v1/public/config", "/v1/public/config", undefined],
    ["GET unauthenticated /v1/usage", "/v1/usage", undefined],
    ["unknown route", "/nope", undefined],
    ["CORS preflight", "/v1/session", { method: "OPTIONS" }],
  ])("%s carries every security header", async (_label, path, init) => {
    const res = await call(path, init as RequestInit | undefined);
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) expect(res.headers.get(k)).toBe(v);
  });
});

describe("listening meter is atomic (ISO 25010 reliability: faultlessness)", () => {
  it("counts every one of 40 concurrent heartbeats", async () => {
    const { env, auth } = signedIn();
    await Promise.all(
      Array.from({ length: 40 }, () =>
        call("/v1/usage/heartbeat", { method: "POST", headers: auth, body: JSON.stringify({ minutes: 1 }) }, env)
      )
    );
    const usage = await (await call("/v1/usage", { headers: auth }, env)).json();
    expect(usage).toMatchObject({ usedMinutes: 40 });
    // The /owner dashboard still reads the KV copy.
    expect([...env.AVC_KV.store.entries()].find(([k]) => k.startsWith("use:user_1:"))?.[1]).toBe("40");
  });

  it("carries a mid-month KV total over instead of restarting at zero", async () => {
    const { env, auth } = signedIn();
    const d = new Date();
    const month = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    env.AVC_KV.store.set(`use:user_1:${month}`, "12.5");
    const res = await call("/v1/usage/heartbeat", { method: "POST", headers: auth, body: JSON.stringify({ minutes: 2 }) }, env);
    expect(await res.json()).toMatchObject({ usedMinutes: 14 });
  });
});

describe("legacy realtime sessions (ISO 25010 security: resistance)", () => {
  it("are refused outright once LEGACY_REALTIME_SESSIONS is 0", async () => {
    const { env, auth } = signedIn(fakeEnv({ LEGACY_REALTIME_SESSIONS: "0" }));
    const res = await call("/v1/session", { method: "POST", headers: auth, body: "{}" }, env);
    expect(res.status).toBe(410);
  });

  it("stop minting after the daily budget, without calling OpenAI", async () => {
    const { env, auth } = signedIn(fakeEnv({ REALTIME_MINTS_PER_DAY: "3" }));
    const openai = vi.fn(async () => new Response(JSON.stringify({ value: "ek_x", expires_at: 1 }), { status: 200 }));
    vi.stubGlobal("fetch", openai);
    try {
      const statuses = [];
      for (let i = 0; i < 5; i++) {
        statuses.push((await call("/v1/session", { method: "POST", headers: auth, body: "{}" }, env)).status);
      }
      expect(statuses).toEqual([200, 200, 200, 429, 429]);
      expect(openai).toHaveBeenCalledTimes(3);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("/v1/health (ISO 25010 reliability: availability)", () => {
  it("answers 200 when KV and the Atomic object respond", async () => {
    const res = await call("/v1/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, checks: { kv: "ok", atomic: "ok" } });
  });

  it("answers 503 and names the dependency when one fails", async () => {
    const env = fakeEnv();
    (env.AVC_KV as unknown as { get: () => Promise<never> }).get = async () => {
      throw new Error("kv down");
    };
    const res = await call("/v1/health", undefined, env);
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ ok: false, checks: { kv: "fail", atomic: "ok" } });
  });
});
