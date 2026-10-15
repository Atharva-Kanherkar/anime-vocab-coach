// Atomic counters and locks for the web Worker.
//
// KV has no compare-and-set, so a budget kept there (read, compare, write) can
// be overrun by firing requests in parallel: they all read the same count. The
// backend Worker defines an Atomic Durable Object (backend/src/atomic.ts) that
// serializes calls per key; this Worker binds the same class by script_name
// (wrangler.jsonc, AVC_ATOMIC). Under `next dev` there is no binding, so an
// in-process stand-in with the same per-key ordering takes over.
import { getCloudflareContext } from "@opennextjs/cloudflare";

export interface AtomicStub {
  add(delta: number, ttlSec: number, seedKvKey?: string): Promise<number>;
  get(seedKvKey?: string, ttlSec?: number): Promise<number>;
  claim(owner: string, ttlMs: number): Promise<boolean>;
  release(owner: string): Promise<void>;
  held(): Promise<boolean>;
}

interface AtomicNamespace {
  idFromName(name: string): unknown;
  get(id: unknown): AtomicStub;
}

type Slot = { v: number; owner?: string; exp: number };
const localSlots = new Map<string, Slot>();
const localQueues = new Map<string, Promise<unknown>>();

function localStub(key: string): AtomicStub {
  const serial = <T>(fn: () => T): Promise<T> => {
    const next = (localQueues.get(key) ?? Promise.resolve()).then(fn, fn);
    localQueues.set(key, next.catch(() => {}));
    return next;
  };
  const live = () => {
    const s = localSlots.get(key);
    return s && s.exp > Date.now() ? s : undefined;
  };
  return {
    add: (delta, ttlSec) =>
      serial(() => {
        const v = Math.max(0, (live()?.v ?? 0) + delta);
        localSlots.set(key, { v, exp: Date.now() + ttlSec * 1000 });
        return v;
      }),
    get: () => serial(() => live()?.v ?? 0),
    claim: (owner, ttlMs) =>
      serial(() => {
        const s = live();
        if (s?.owner && s.owner !== owner) return false;
        localSlots.set(key, { v: 0, owner, exp: Date.now() + ttlMs });
        return true;
      }),
    release: (owner) =>
      serial(() => {
        if (live()?.owner === owner) localSlots.delete(key);
      }),
    held: () => serial(() => !!live()?.owner),
  };
}

export async function atomic(key: string): Promise<AtomicStub> {
  let ns: AtomicNamespace | undefined;
  try {
    const { env } = await getCloudflareContext({ async: true });
    ns = (env as { AVC_ATOMIC?: AtomicNamespace }).AVC_ATOMIC;
  } catch {
    ns = undefined;
  }
  if (ns) return ns.get(ns.idFromName(key));
  if (process.env.NODE_ENV === "production") {
    throw new Error("AVC_ATOMIC binding is required in production.");
  }
  return localStub(key);
}

/** Test-only: forget the in-process slots. */
export function resetLocalAtomicForTests(): void {
  localSlots.clear();
  localQueues.clear();
}
