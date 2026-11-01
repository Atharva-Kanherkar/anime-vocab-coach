// The extension is a cache. Every write is durable before network I/O, and the
// cloud's ordered changes rebuild the cache underneath pending local intent.
import { WEB_URL } from "../config";
import {
  getSyncToken,
  getSyncStatus,
  setSyncStatus,
  getSyncAuthFailures,
  setSyncAuthFailures,
  setSyncToken,
  setRelinkNeeded,
  prepareLearnSync,
  applyLearnChanges,
  acknowledgeDetachedLearnOps,
  acknowledgeSignoutExport,
  type PendingSignoutExport,
} from "./storage";
import { localImportOps, type PendingLearnOp } from "./learn-cache";
import type {
  LearnChange,
  LearnOp,
} from "../../web/src/lib/learn-protocol/model";
interface Changes {
  userId: string;
  changes: LearnChange[];
  cursor: number;
  hasMore: boolean;
}
let running: Promise<void> | null = null;
let queued = false;
async function request(
  token: string,
  path: string,
  ops?: LearnOp[],
): Promise<Response> {
  return fetch(WEB_URL + "/api/learn/" + path, {
    method: ops ? "POST" : "GET",
    headers: {
      Authorization: "Bearer " + token,
      ...(ops ? { "Content-Type": "application/json" } : {}),
    },
    ...(ops ? { body: JSON.stringify({ ops }) } : {}),
    signal: AbortSignal.timeout(10000),
  });
}
async function checked(token: string, path: string, ops?: LearnOp[]) {
  const res = await request(token, path, ops);
  if (res.status === 401 && (await getSyncToken()) === token) {
    const n = (await getSyncAuthFailures()) + 1;
    await setSyncAuthFailures(n);
    if (n >= 3) {
      await setSyncToken("");
      await setRelinkNeeded(true);
    }
  }
  if (!res.ok) throw new Error(`Cloud returned HTTP ${res.status}.`);
  return res;
}
export function syncWithCloud(): Promise<void> {
  if (running) {
    queued = true;
    return running;
  }
  running = (async () => {
    try {
      do {
        queued = false;
        await syncOnce();
      } while (queued);
    } finally {
      running = null;
    }
  })();
  const foreground = running;
  return Promise.all([foreground, syncPendingSignouts()]).then(() => {});
}
// Compatibility names for callers and old diagnostic actions.
export const pushSnapshot = syncWithCloud;
export const pullSettingsFromCloud = syncWithCloud;
async function syncOnce() {
  const token = await getSyncToken();
  if (!token) return;
  const prior = await getSyncStatus();
  const at = Date.now();
  await setSyncStatus({
    state: "syncing",
    lastAttemptAt: at,
    lastSuccessAt: prior.lastSuccessAt,
    error: null,
  });
  try {
    const identity = (await (
      await checked(token, "changes?since=0")
    ).json()) as Changes;
    await prepareLearnSync(token, identity.userId);
    if ((await getSyncToken()) !== token) return;
    const captured = await chrome.storage.local.get("learnOutbox");
    const pending = ((captured.learnOutbox || []) as PendingLearnOp[]).filter(
      (p) => p.token === token,
    );
    for (let i = 0; i < pending.length; i += 50) {
      if ((await getSyncToken()) !== token) return;
      await checked(
        token,
        "ops",
        pending.slice(i, i + 50).map((p) => p.op),
      );
    }
    let more = true;
    while (more) {
      const r = await chrome.storage.local.get("learnCursor");
      const data = (await (
        await checked(token, "changes?since=" + Number(r.learnCursor || 0))
      ).json()) as Changes;
      if ((await getSyncToken()) !== token) return;
      await applyLearnChanges(token, data.changes, data.cursor);
      more = data.hasMore;
    }
    if ((await getSyncToken()) !== token) return;
    await setSyncAuthFailures(0);
    await setSyncStatus({
      state: "ok",
      lastAttemptAt: at,
      lastSuccessAt: Date.now(),
      error: null,
    });
  } catch (err) {
    if ((await getSyncToken()) !== token) return;
    await setSyncStatus({
      state: "error",
      lastAttemptAt: at,
      lastSuccessAt: prior.lastSuccessAt,
      error: err instanceof Error ? err.message : "Cloud sync failed.",
    });
  }
}
/** Detached writes always use their original credential, never the next user's. */
let detachedRunning: Promise<void> | null = null;
export function syncPendingSignouts(): Promise<void> {
  if (detachedRunning) return detachedRunning;
  detachedRunning = flushDetached().finally(() => {
    detachedRunning = null;
  });
  return detachedRunning;
}
async function flushDetached(): Promise<void> {
  const r = await chrome.storage.local.get([
    "learnOutbox",
    "syncToken",
    "pendingSignoutExports",
  ]);
  const outbox = (r.learnOutbox || []) as PendingLearnOp[];
  const tokens = [
    ...new Set(
      outbox
        .filter((p) => p.token && p.token !== r.syncToken)
        .map((p) => p.token),
    ),
  ];
  for (const token of tokens) {
    const items = outbox.filter((p) => p.token === token);
    try {
      for (let i = 0; i < items.length; i += 50) {
        const batch = items.slice(i, i + 50).map((p) => p.op);
        const res = await request(token, "ops", batch);
        if (!res.ok) break;
        await acknowledgeDetachedLearnOps(
          token,
          batch.map((o) => o.op_id),
        );
      }
    } catch {
      /* Keep offline and expired-token work until that account relinks. */
    }
  }
  for (const pending of (r.pendingSignoutExports ||
    []) as PendingSignoutExport[]) {
    try {
      // Legacy detached snapshots predate the op outbox. Imports are insert-only.
      const ops = localImportOps(pending.export);
      let ok = true;
      for (let i = 0; i < ops.length; i += 50)
        if (!(await request(pending.token, "ops", ops.slice(i, i + 50))).ok) {
          ok = false;
          break;
        }
      if (ok) await acknowledgeSignoutExport(pending);
    } catch {
      /* Retain legacy data for a later retry. */
    }
  }
}
