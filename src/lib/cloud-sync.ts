// Background cloud sync: pushes the local snapshot to the hosted app using the
// sync token the web app handed us. No token → local-only, so this is a no-op.
// The server merges a push into what it holds (newest-seen copy of a word
// wins). The one thing that flows back down is reviews done on the cloud app:
// each sync applies the server's review log before it exports (see
// storage.applyWebReviews). On a revision clash the whole round runs again, so
// a review taken on the web mid-sync is applied rather than pushed over.
import { WEB_URL } from "../config";
import { type Settings } from "../types";
import {
  applyWebReviews,
  replayWebReviews,
  applyRestoredAccountCache,
  acknowledgeSignoutExport,
  exportAll,
  getSyncAuthFailures,
  getSyncStatus,
  getSyncToken,
  getWebReviewSeq,
  setRelinkNeeded,
  setSettings,
  setSyncAuthFailures,
  setSyncStatus,
  setSyncToken,
  type WebReviewOp,
  type PendingSignoutExport,
} from "./storage";
import { ACCOUNT_CACHE_CLEARED, restoredAccountCache } from "./account-cache";
import { toastActiveTab } from "./notify";
import { log, warn } from "./log";

const SNAPSHOT_URL = WEB_URL + "/api/sync/snapshot";

// A single 401 must not permanently unlink the extension — a brief auth blip or
// a token race used to sign the user out forever with no notice (P1). Tolerate a
// few consecutive 401s; only then clear the token and ask the user to re-link.
const MAX_SYNC_401 = 3;

/**
 * Record a sync 401. Returns true once the failure threshold is crossed and the
 * token has been cleared (so the caller stops retrying). Below the threshold the
 * token is kept and the next sync retries the same credential.
 */
async function noteAuthFailure(): Promise<boolean> {
  const failures = (await getSyncAuthFailures()) + 1;
  await setSyncAuthFailures(failures);
  if (failures < MAX_SYNC_401) {
    warn(`cloud sync: 401 #${failures}/${MAX_SYNC_401} — tolerating (transient auth blip?)`);
    return false;
  }
  warn("cloud sync: token rejected repeatedly — unlinking, re-link needed");
  await setSyncToken(""); // clears syncProfile
  await setRelinkNeeded(true);
  await toastActiveTab("AnimeVocab sync signed out — re-link at animevocab.com to keep your progress in the cloud.", "error");
  return true;
}

/** Reset the 401 counter after any successful sync round-trip. */
async function noteSyncSuccess(): Promise<void> {
  if ((await getSyncAuthFailures()) > 0) await setSyncAuthFailures(0);
}

interface SnapshotResponse {
  envelope: {
    revision: number;
    snapshot?: { settings?: Record<string, unknown> };
    /** Reviews taken on the cloud app that devices have not all applied. */
    webReviews?: WebReviewOp[];
  } | null;
}

interface ConflictResponse {
  conflict?: { currentRevision?: number };
}

let syncing = false;
let syncQueued = false;

/** The server's revision, after applying any cloud-app reviews it logged.
 * Null when there is no snapshot yet or the read failed; the PUT then finds
 * out with a 409. */
async function pullRevision(token: string): Promise<number | null> {
  let data: SnapshotResponse;
  try {
    const res = await fetch(SNAPSHOT_URL, { headers: { Authorization: "Bearer " + token } });
    if (!res.ok) return null;
    data = (await res.json()) as SnapshotResponse;
  } catch {
    return null;
  }
  if (await getSyncToken() !== token) return null;
  const ops = data.envelope?.webReviews;
  if (Array.isArray(ops) && ops.length) {
    const { applied } = await applyWebReviews(ops, token);
    if (applied) log(`cloud sync: applied ${applied} review(s) from the cloud app`);
  }
  return data.envelope?.revision ?? null;
}

/**
 * Pull extension settings from the cloud snapshot into local storage.
 *
 * NOT part of routine sync (see syncWithCloud). Routine sync runs on every
 * vocab/stats change (debounced ~8s while watching), on startup, and every
 * 30 min — pulling settings there deterministically reverted a change the user
 * had just made in the panel (P0 #7, "it turned itself back on"). Reserved for
 * an explicit, user-initiated "restore settings from cloud" action.
 */
export async function pullSettingsFromCloud(): Promise<void> {
  const token = await getSyncToken();
  if (!token) return;

  try {
    const res = await fetch(SNAPSHOT_URL, { headers: { Authorization: "Bearer " + token } });
    if (res.status === 401) {
      await noteAuthFailure();
      return;
    }
    if (!res.ok) return;
    await noteSyncSuccess();
    const data = (await res.json()) as SnapshotResponse;
    const raw = data.envelope?.snapshot?.settings;
    if (!raw || typeof raw !== "object") return;

    const partial = { ...raw } as Partial<Settings>;
    if ((partial as { pauseMode?: string }).pauseMode === "notify") partial.pauseMode = "copilot";
    await setSettings(partial);
    log("cloud settings pulled");
  } catch (err) {
    warn("cloud settings pull error:", err);
  }
}

export async function syncWithCloud(): Promise<void> {
  // Never pulls settings. Doing that here clobbered the user's in-panel
  // changes (P0 #7) because it fires on every vocab/stats change, on startup,
  // and every 30 min. The extension is the source of truth for a signed-in
  // user's own settings; restoring from cloud is an explicit action only. The
  // only thing this pulls is the cloud app's review log (see pullRevision).
  await pushSnapshot();
}

export async function pushSnapshot(): Promise<void> {
  if (syncing) {
    // Do not drop a save that arrives while a request is running. The active
    // pass may already have captured its snapshot, so queue one fresh pass.
    syncQueued = true;
    return;
  }

  syncing = true;
  try {
    do {
      syncQueued = false;
      await pushSnapshotOnce();
    } while (syncQueued);
  } finally {
    syncing = false;
  }
}

async function pushSnapshotOnce(): Promise<void> {
  await syncPendingSignouts();
  const token = await getSyncToken();
  if (!token) return;

  const startedAt = Date.now();
  const previousStatus = await getSyncStatus();
  const lastSuccessAt = previousStatus.lastSuccessAt;
  await setSyncStatus({ state: "syncing", lastAttemptAt: startedAt, lastSuccessAt, error: null });
  try {
    const cache = await chrome.storage.local.get(ACCOUNT_CACHE_CLEARED);
    if (cache[ACCOUNT_CACHE_CLEARED]) {
      const patch = await restoredAccountCache(token);
      await applyRestoredAccountCache(token, cache[ACCOUNT_CACHE_CLEARED], patch);
      if (await getSyncToken() !== token) return;
    }
    // The revision a 409 reported, for when the read that follows it fails.
    let conflictRevision: number | null = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      // Pull, then export: the export has to include the web's reviews, or the
      // push would carry the pre-review copies of those words.
      const expectedRevision = (await pullRevision(token)) ?? conflictRevision;
      if (await getSyncToken() !== token) return;
      const exportData = await exportAll();
      // Never upload the user's BYO OpenAI key. The web side strips it too, but
      // stripping here means the plaintext key never leaves the device.
      const settingsNoKey: Record<string, unknown> = { ...exportData.settings };
      delete settingsNoKey.openaiKey;
      const safeExport = { ...exportData, settings: settingsNoKey };
      const appliedWebReviewSeq = await getWebReviewSeq();
      if (await getSyncToken() !== token) return;
      const res = await fetch(SNAPSHOT_URL, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ export: safeExport, expectedRevision, appliedWebReviewSeq })
      });

      if (await getSyncToken() !== token) return;

      if (res.status === 409) {
        // Something wrote in between, perhaps a review on the web. Run the
        // whole round again rather than re-sending this export.
        const data = (await res.json().catch(() => ({}))) as ConflictResponse;
        conflictRevision = data.conflict?.currentRevision ?? null;
        continue;
      }
      if (res.status === 401) {
        // Don't clear on the first 401 — tolerate a few in a row so a transient
        // auth blip can't permanently unlink the extension (P1). noteAuthFailure
        // clears the token + flags re-link once the threshold is crossed.
        await noteAuthFailure();
        await setSyncStatus({
          state: "error",
          lastAttemptAt: startedAt,
          lastSuccessAt,
          error: "Account link was rejected. Open animevocab.com/app to reconnect.",
        });
        return;
      }
      if (!res.ok) {
        warn("cloud sync failed: HTTP", res.status);
        await setSyncStatus({
          state: "error",
          lastAttemptAt: startedAt,
          lastSuccessAt,
          error: `Cloud returned HTTP ${res.status}.`,
        });
        return;
      }
      await noteSyncSuccess();
      await setSyncStatus({ state: "ok", lastAttemptAt: startedAt, lastSuccessAt: Date.now(), error: null });
      log("cloud sync ok");
      return;
    }
    warn("cloud sync: gave up after revision conflict");
    await setSyncStatus({
      state: "error",
      lastAttemptAt: startedAt,
      lastSuccessAt,
      error: "Cloud changed during sync. Retry to save the newest local snapshot.",
    });
  } catch (err) {
    if (await getSyncToken() !== token) return;
    warn("cloud sync error:", err);
    await setSyncStatus({
      state: "error",
      lastAttemptAt: startedAt,
      lastSuccessAt,
      error: err instanceof Error ? err.message : "Network error while syncing.",
    });
  }
}

/** Flush snapshots with their outgoing credential, even after sign-out. Keep
 * every failed snapshot durable; never send it with the next account's token. */
export async function syncPendingSignouts(): Promise<void> {
  const r = await chrome.storage.local.get("pendingSignoutExports");
  for (const pending of (r.pendingSignoutExports || []) as PendingSignoutExport[]) {
    try {
      for (let attempt = 0; attempt < 2; attempt++) {
        const headers = { Authorization: "Bearer " + pending.token, "Content-Type": "application/json" };
        const current = await fetch(SNAPSHOT_URL, { headers, signal: AbortSignal.timeout(10000) });
        if (!current.ok) break;
        const data = await current.json() as SnapshotResponse;
        const outgoing = structuredClone(pending.export);
        const { seq } = replayWebReviews(outgoing.vocab, outgoing.stats,
          pending.appliedWebReviewSeq, data.envelope?.webReviews || []);
        const response = await fetch(SNAPSHOT_URL, {
          method: "PUT", headers, signal: AbortSignal.timeout(10000),
          body: JSON.stringify({ export: outgoing, expectedRevision: data.envelope?.revision ?? null, appliedWebReviewSeq: seq }),
        });
        if (response.status === 409) continue;
        if (response.ok) await acknowledgeSignoutExport(pending);
        break;
      }
    } catch {
      // Offline or rejected: retain the pending export for the next sync.
    }
  }
}
