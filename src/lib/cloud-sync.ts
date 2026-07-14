// Background cloud sync: pushes the local snapshot to the hosted app using the
// sync token the web app handed us. No token → local-only, so this is a no-op.
// Conflict handling is last-write-wins: on a revision clash we refetch the
// server revision and re-push once. (v1 has no field-level merge; the extension
// is treated as the source of truth for a signed-in user's own data.)
import { WEB_URL } from "../config";
import { type Settings } from "../types";
import {
  exportAll,
  getSyncAuthFailures,
  getSyncToken,
  setRelinkNeeded,
  setSettings,
  setSyncAuthFailures,
  setSyncToken,
} from "./storage";
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
  envelope: { revision: number; snapshot?: { settings?: Record<string, unknown> } } | null;
}

interface ConflictResponse {
  conflict?: { currentRevision?: number };
}

let syncing = false;

async function currentRevision(token: string): Promise<number | null> {
  try {
    const res = await fetch(SNAPSHOT_URL, { headers: { Authorization: "Bearer " + token } });
    if (!res.ok) return null;
    const data = (await res.json()) as SnapshotResponse;
    return data.envelope?.revision ?? null;
  } catch {
    return null;
  }
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
  // Push-only. Pulling settings on this path clobbered the user's in-panel
  // changes (P0 #7) because it fires on every vocab/stats change, on startup,
  // and every 30 min. The extension is the source of truth for a signed-in
  // user's own settings; restoring from cloud is an explicit action only.
  await pushSnapshot();
}

export async function pushSnapshot(): Promise<void> {
  if (syncing) return;
  const token = await getSyncToken();
  if (!token) return; // not linked to an account

  syncing = true;
  try {
    const exportData = await exportAll();
    // Never upload the user's BYO OpenAI key. The web side strips it too, but
    // stripping here means the plaintext key never leaves the device.
    const settingsNoKey: Record<string, unknown> = { ...exportData.settings };
    delete settingsNoKey.openaiKey;
    const safeExport = { ...exportData, settings: settingsNoKey };
    let expectedRevision = await currentRevision(token);

    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await fetch(SNAPSHOT_URL, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ export: safeExport, expectedRevision })
      });

      if (res.status === 409) {
        const data = (await res.json().catch(() => ({}))) as ConflictResponse;
        expectedRevision = data.conflict?.currentRevision ?? null;
        continue; // retry once with the server's revision
      }
      if (res.status === 401) {
        // Don't clear on the first 401 — tolerate a few in a row so a transient
        // auth blip can't permanently unlink the extension (P1). noteAuthFailure
        // clears the token + flags re-link once the threshold is crossed.
        await noteAuthFailure();
        return;
      }
      if (!res.ok) {
        warn("cloud sync failed: HTTP", res.status);
        return;
      }
      await noteSyncSuccess();
      log("cloud sync ok");
      return;
    }
    warn("cloud sync: gave up after revision conflict");
  } catch (err) {
    warn("cloud sync error:", err);
  } finally {
    syncing = false;
  }
}
