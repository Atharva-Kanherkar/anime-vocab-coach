import { describe, expect, it } from "vitest";
import { storeSegments, bumpTranscribeHit } from "../backend/src/cache";
import { recordLookupHit, recordTranscribeHit } from "../backend/src/metrics";
import { recordProviderSuccess, getProviderMetrics } from "../backend/src/transcribe/providers";
import type { Env } from "../backend/src/index";

/** In-memory KV that counts puts — used to prove warm-path metrics stay put-free. */
function mockKv() {
  const map = new Map<string, string>();
  let puts = 0;
  const kv = {
    async get(key: string): Promise<string | null> {
      return map.has(key) ? map.get(key)! : null;
    },
    async put(key: string, value: string): Promise<void> {
      puts += 1;
      map.set(key, value);
    },
    async delete(key: string): Promise<void> {
      map.delete(key);
    },
    putCount: () => puts,
    resetPuts: () => {
      puts = 0;
    },
    raw: map,
  };
  return kv;
}

function envWith(kv: ReturnType<typeof mockKv>): Env {
  return {
    AVC_KV: kv as unknown as KVNamespace,
    TRANSCRIPT_MODEL_VERSION: "v1",
  } as Env;
}

describe("KV hot-path metrics budget", () => {
  it("recordLookupHit / recordTranscribeHit write zero KV puts", async () => {
    const kv = mockKv();
    const env = envWith(kv);
    await recordLookupHit(env);
    await recordTranscribeHit(env);
    await bumpTranscribeHit(env, "ep:1:ja");
    expect(kv.putCount()).toBe(0);
  });

  it("storeSegments writes exactly body+meta and increments missCount", async () => {
    const kv = mockKv();
    const env = envWith(kv);
    const key = "ep:test:ja";
    await storeSegments(
      env,
      key,
      [{ start: 0, end: 2, text: "こんにちは" }],
      "whisper",
      "v1"
    );
    expect(kv.putCount()).toBe(2);
    const meta = JSON.parse((await kv.get("txmeta:" + key))!);
    expect(meta.missCount).toBe(1);
    expect(meta.segmentCount).toBe(1);

    kv.resetPuts();
    await storeSegments(
      env,
      key,
      [{ start: 2, end: 4, text: "世界" }],
      "whisper",
      "v1"
    );
    expect(kv.putCount()).toBe(2);
    const meta2 = JSON.parse((await kv.get("txmeta:" + key))!);
    expect(meta2.missCount).toBe(2);
    expect(meta2.segmentCount).toBe(2);
  });

  it("recordProviderSuccess uses a single v2 blob put", async () => {
    const kv = mockKv();
    const env = envWith(kv);
    await recordProviderSuccess(env, "openai", 0.1, 0.0006);
    expect(kv.putCount()).toBe(1);
    expect(kv.raw.has("txprovider:openai:v2")).toBe(true);
    expect(kv.raw.has("txprovider:openai:ok")).toBe(false);

    const metrics = await getProviderMetrics(env);
    expect(metrics.openai.ok).toBe(1);
    expect(metrics.openai.minutes).toBeCloseTo(0.1);
    expect(metrics.openai.costUsd).toBeCloseTo(0.0006);
  });

  it("getProviderMetrics still reads legacy v1 keys", async () => {
    const kv = mockKv();
    const env = envWith(kv);
    await kv.put("txprovider:groq:ok", "3");
    await kv.put("txprovider:groq:errors", "1");
    await kv.put("txprovider:groq:minutes", "1.5");
    await kv.put("txprovider:groq:cost_usd", "0.003");
    kv.resetPuts();

    const metrics = await getProviderMetrics(env);
    expect(kv.putCount()).toBe(0);
    expect(metrics.groq).toEqual({
      ok: 3,
      errors: 1,
      minutes: 1.5,
      costUsd: 0.003,
      errorRate: 0.25,
    });
  });
});
