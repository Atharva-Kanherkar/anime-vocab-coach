import { describe, expect, it } from "vitest";
import { storeSegments, bumpTranscribeHit, bumpTranscribeMiss, getMeta } from "../backend/src/cache";
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
  it("recordLookupHit / recordTranscribeHit / bumpTranscribeHit write zero KV puts", async () => {
    const kv = mockKv();
    const env = envWith(kv);
    await recordLookupHit(env);
    await recordTranscribeHit(env);
    await bumpTranscribeHit(env, "ep:1:ja");
    expect(kv.putCount()).toBe(0);
  });

  it("bumpTranscribeMiss counts attempts even when nothing is stored", async () => {
    const kv = mockKv();
    const env = envWith(kv);
    const key = "ep:empty:ja";
    await bumpTranscribeMiss(env, key);
    expect(kv.putCount()).toBe(1);
    expect((await getMeta(env, key))?.missCount).toBe(1);

    // Empty "store" path: storeSegments must preserve missCount, not only bump on body writes.
    kv.resetPuts();
    await storeSegments(env, key, [{ start: 0, end: 1, text: "はい" }], "whisper", "v1");
    expect(kv.putCount()).toBe(2);
    expect((await getMeta(env, key))?.missCount).toBe(1);
  });

  it("recordProviderSuccess writes independent per-field counters", async () => {
    const kv = mockKv();
    const env = envWith(kv);
    await recordProviderSuccess(env, "openai", 0.1, 0.0006);
    expect(kv.putCount()).toBe(3);
    expect(kv.raw.get("txprovider:openai:ok")).toBe("1");
    expect(kv.raw.get("txprovider:openai:minutes")).toBe("0.1");
    expect(kv.raw.get("txprovider:openai:cost_usd")).toBe("0.0006");
    expect(kv.raw.has("txprovider:openai:v2")).toBe(false);

    // Concurrent-style: error counter is a separate key and must not clobber ok/minutes/cost.
    await kv.put("txprovider:openai:errors", "2");
    const metrics = await getProviderMetrics(env);
    expect(metrics.openai.ok).toBe(1);
    expect(metrics.openai.errors).toBe(2);
    expect(metrics.openai.minutes).toBeCloseTo(0.1);
    expect(metrics.openai.costUsd).toBeCloseTo(0.0006);
    expect(metrics.openai.errorRate).toBeCloseTo(2 / 3);
  });
});
