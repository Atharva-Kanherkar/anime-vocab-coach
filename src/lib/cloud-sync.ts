// Background cloud sync: pushes the local snapshot to the hosted app using the
// sync token the web app handed us. No token → local-only, so this is a no-op.
// Conflict handling is last-write-wins: on a revision clash we refetch the
// server revision and re-push once. (v1 has no field-level merge; the extension
// is treated as the source of truth for a signed-in user's own data.)
import { WEB_URL } from "../config";
import { type Settings } from "../types";
import { exportAll, getSyncToken, setSettings, setSyncToken } from "./storage";
import { log, warn } from "./log";

const SNAPSHOT_URL = WEB_URL + "/api/sync/snapshot";

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

/** Pull extension settings from the cloud snapshot into local storage. */
export async function pullSettingsFromCloud(): Promise<void> {
  const token = await getSyncToken();
  if (!token) return;

  try {
    const res = await fetch(SNAPSHOT_URL, { headers: { Authorization: "Bearer " + token } });
    if (res.status === 401) {
      await setSyncToken("");
      return;
    }
    if (!res.ok) return;
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
  await pullSettingsFromCloud();
  await pushSnapshot();
}

export async function pushSnapshot(): Promise<void> {
  if (syncing) return;
  const token = await getSyncToken();
  if (!token) return; // not linked to an account

  syncing = true;
  try {
    const exportData = await exportAll();
    let expectedRevision = await currentRevision(token);

    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await fetch(SNAPSHOT_URL, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ export: exportData, expectedRevision })
      });

      if (res.status === 409) {
        const data = (await res.json().catch(() => ({}))) as ConflictResponse;
        expectedRevision = data.conflict?.currentRevision ?? null;
        continue; // retry once with the server's revision
      }
      if (res.status === 401) {
        // Token is invalid/expired — actually clear it so we stop retrying a
        // dead credential every change/alarm until the web app hands a new one.
        warn("cloud sync: token rejected (signed out or expired) — clearing");
        await setSyncToken("");
        return;
      }
      if (!res.ok) {
        warn("cloud sync failed: HTTP", res.status);
        return;
      }
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
