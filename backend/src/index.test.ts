import { describe, expect, it } from "vitest";
import worker, { SECURITY_HEADERS, type Env } from "./index";

function fakeEnv(): Env {
  const kv = new Map<string, string>();
  return {
    AVC_KV: {
      get: async (k: string) => kv.get(k) ?? null,
      put: async (k: string, v: string) => void kv.set(k, v),
      delete: async (k: string) => void kv.delete(k),
    } as unknown as KVNamespace,
    OPENAI_API_KEY: "sk-test",
    CAP_MINUTES: "60",
    TRANSCRIBE_MODEL: "gpt-4o-transcribe",
    OPENAI_WHISPER_MODEL: "whisper-1",
    GROQ_WHISPER_MODEL: "x",
    DEEPINFRA_WHISPER_MODEL: "x",
    TRANSCRIBE_PROVIDERS: "openai",
    TRANSCRIPT_MODEL_VERSION: "v1",
  } as Env;
}

const call = (path: string, init?: RequestInit) =>
  worker.fetch(new Request("https://api.animevocab.com" + path, init), fakeEnv());

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
