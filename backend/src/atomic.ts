// Atomic counters and locks, one Durable Object per key.
//
// Workers KV has no compare-and-set: every counter and lock that lived there
// was a read followed by a write, so concurrent requests read the same value
// and one increment was lost (two heartbeats → one minute billed), and two
// transcriptions of the same chunk could both "acquire" the lock (ISO 25010
// reliability audit, 2026-10). A Durable Object runs one request at a time per
// key: its storage operations are guarded by input gates, so the read and the
// write in add()/claim() cannot interleave with another caller's.
//
// The web Worker binds this same class (script_name "avc-api") for its own
// counters and locks, so there is one implementation of "atomic" in the repo.

import { DurableObject } from "cloudflare:workers";
import type { Env } from "./index";

interface Slot {
  /** Counter value, or 0 for a lock. */
  v: number;
  /** Lock holder; absent for counters. */
  owner?: string;
  /** Epoch ms after which the slot reads as empty. */
  exp: number;
}

/** Pure slot transitions, exported for unit tests (the DO is a thin shell). */
export function liveSlot(slot: Slot | undefined, now: number): Slot | undefined {
  return slot && slot.exp > now ? slot : undefined;
}

export function addToSlot(slot: Slot | undefined, delta: number, ttlMs: number, now: number): Slot {
  const live = liveSlot(slot, now);
  return { v: Math.max(0, (live?.v ?? 0) + delta), exp: now + ttlMs };
}

export function claimSlot(
  slot: Slot | undefined,
  owner: string,
  ttlMs: number,
  now: number
): { ok: boolean; next?: Slot } {
  const live = liveSlot(slot, now);
  if (live?.owner && live.owner !== owner) return { ok: false };
  return { ok: true, next: { v: 0, owner, exp: now + ttlMs } };
}

const KEY = "slot";

export class Atomic extends DurableObject<Env> {
  private async read(): Promise<Slot | undefined> {
    return this.ctx.storage.get<Slot>(KEY);
  }

  private async write(slot: Slot): Promise<void> {
    await this.ctx.storage.put(KEY, slot);
    // Reclaim storage once the slot expires; nothing reads it after that.
    await this.ctx.storage.setAlarm(slot.exp + 1000);
  }

  /**
   * Add delta and return the new total. `seedKvKey` is read once, the first
   * time this key is touched, so a counter that used to live in KV carries its
   * value over instead of restarting at zero mid-month.
   */
  async add(delta: number, ttlSec: number, seedKvKey?: string): Promise<number> {
    await this.seedFromKv(seedKvKey, ttlSec);
    const next = addToSlot(await this.read(), delta, ttlSec * 1000, Date.now());
    await this.write(next);
    return next.v;
  }

  async get(seedKvKey?: string, ttlSec = 0): Promise<number> {
    await this.seedFromKv(seedKvKey, ttlSec);
    return liveSlot(await this.read(), Date.now())?.v ?? 0;
  }

  /** Take the lock for ttlMs. Re-entrant for the same owner. */
  async claim(owner: string, ttlMs: number): Promise<boolean> {
    const { ok, next } = claimSlot(await this.read(), owner, ttlMs, Date.now());
    if (next) await this.write(next);
    return ok;
  }

  async release(owner: string): Promise<void> {
    const live = liveSlot(await this.read(), Date.now());
    if (live?.owner === owner) await this.ctx.storage.delete(KEY);
  }

  /** Whether someone currently holds the lock. */
  async held(): Promise<boolean> {
    return !!liveSlot(await this.read(), Date.now())?.owner;
  }

  async alarm(): Promise<void> {
    const slot = await this.read();
    if (!slot || slot.exp <= Date.now()) await this.ctx.storage.deleteAll();
  }

  /** One-time import of a KV-held value. blockConcurrencyWhile keeps a second
   * request from also seeing "never touched" while the KV read is in flight
   * (a KV read is not a storage op, so input gates alone would let it in). */
  private async seedFromKv(kvKey: string | undefined, ttlSec: number): Promise<void> {
    if (!kvKey || ttlSec <= 0) return;
    if (await this.ctx.storage.get<boolean>("seeded")) return;
    await this.ctx.blockConcurrencyWhile(async () => {
      if (await this.ctx.storage.get<boolean>("seeded")) return;
      const existing = await this.read();
      if (!existing) {
        const raw = await this.env.AVC_KV.get(kvKey);
        const v = parseFloat(raw || "0") || 0;
        if (v > 0) await this.write({ v, exp: Date.now() + ttlSec * 1000 });
      }
      await this.ctx.storage.put("seeded", true);
    });
  }
}

/** Typed stub for one key. */
export function atomicFor(ns: DurableObjectNamespace<Atomic>, key: string): DurableObjectStub<Atomic> {
  return ns.get(ns.idFromName(key));
}
