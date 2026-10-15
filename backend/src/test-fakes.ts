// In-memory stand-ins for the Worker bindings, shared by the unit tests.
// The fake Atomic namespace runs each key's calls one at a time, which is the
// guarantee the real Durable Object gives (input gates); the real thing is
// exercised under concurrency by e2e/atomic-concurrency.mjs against wrangler dev.
import { addToSlot, claimSlot, liveSlot } from "./atomic";
import type { Env } from "./index";

type Slot = { v: number; owner?: string; exp: number };

export function fakeKv(): KVNamespace & { store: Map<string, string> } {
  const store = new Map<string, string>();
  return {
    store,
    get: async (k: string) => store.get(k) ?? null,
    put: async (k: string, v: string) => void store.set(k, v),
    delete: async (k: string) => void store.delete(k),
    list: async ({ prefix = "" }: { prefix?: string } = {}) => ({
      keys: [...store.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })),
      list_complete: true,
    }),
  } as unknown as KVNamespace & { store: Map<string, string> };
}

export function fakeAtomic(kv: KVNamespace): Env["ATOMIC"] & { slots: Map<string, Slot> } {
  const slots = new Map<string, Slot>();
  const seeded = new Set<string>();
  const queues = new Map<string, Promise<unknown>>();
  const serial = <T>(key: string, fn: () => Promise<T>): Promise<T> => {
    const next = (queues.get(key) ?? Promise.resolve()).then(fn, fn);
    queues.set(key, next.catch(() => {}));
    return next;
  };
  const seed = async (key: string, kvKey?: string, ttlSec = 0) => {
    if (!kvKey || ttlSec <= 0 || seeded.has(key)) return;
    seeded.add(key);
    if (!slots.has(key)) {
      const v = parseFloat((await kv.get(kvKey)) || "0") || 0;
      if (v > 0) slots.set(key, { v, exp: Date.now() + ttlSec * 1000 });
    }
  };
  const stub = (key: string) => ({
    add: (delta: number, ttlSec: number, seedKvKey?: string) =>
      serial(key, async () => {
        await seed(key, seedKvKey, ttlSec);
        const next = addToSlot(slots.get(key), delta, ttlSec * 1000, Date.now());
        slots.set(key, next);
        return next.v;
      }),
    get: (seedKvKey?: string, ttlSec = 0) =>
      serial(key, async () => {
        await seed(key, seedKvKey, ttlSec);
        return liveSlot(slots.get(key), Date.now())?.v ?? 0;
      }),
    claim: (owner: string, ttlMs: number) =>
      serial(key, async () => {
        const { ok, next } = claimSlot(slots.get(key), owner, ttlMs, Date.now());
        if (next) slots.set(key, next);
        return ok;
      }),
    release: (owner: string) =>
      serial(key, async () => {
        if (liveSlot(slots.get(key), Date.now())?.owner === owner) slots.delete(key);
      }),
    held: () => serial(key, async () => !!liveSlot(slots.get(key), Date.now())?.owner),
  });
  return {
    slots,
    idFromName: (name: string) => name,
    get: (id: string) => stub(id),
  } as unknown as Env["ATOMIC"] & { slots: Map<string, Slot> };
}

export function fakeEnv(overrides: Partial<Env> = {}): Env & { AVC_KV: ReturnType<typeof fakeKv> } {
  const kv = fakeKv();
  return {
    AVC_KV: kv,
    ATOMIC: fakeAtomic(kv),
    OPENAI_API_KEY: "sk-test",
    CAP_MINUTES: "60",
    TRANSCRIBE_MODEL: "gpt-4o-mini-transcribe",
    OPENAI_WHISPER_MODEL: "",
    GROQ_WHISPER_MODEL: "x",
    DEEPINFRA_WHISPER_MODEL: "x",
    TRANSCRIBE_PROVIDERS: "openai",
    TRANSCRIPT_MODEL_VERSION: "1",
    ...overrides,
  } as Env & { AVC_KV: ReturnType<typeof fakeKv> };
}
