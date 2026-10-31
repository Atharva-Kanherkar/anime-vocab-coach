import { WEB_URL } from "../config";
import { cloudSnapshotToAnimeVocabExport, normalizeAnimeVocabExport, normalizeCloudSyncSnapshot } from "../../web/src/lib/sync";

export const ACCOUNT_CACHE_CLEARED = "accountCacheClearedAt";
export const SIGN_OUT_SUPPRESSION_MS = 5 * 60 * 1000;

/** Restore only after an explicit sign-out. Never overwrite a legacy local
 * deck on its first link; that deck must be uploaded with its schedules intact. */
export async function restoredAccountCache(token: string): Promise<Record<string, unknown>> {
  const before = await chrome.storage.local.get(ACCOUNT_CACHE_CLEARED);
  const clearedAt = before[ACCOUNT_CACHE_CLEARED];
  if (!clearedAt) return {};
  const res = await fetch(WEB_URL + "/api/sync/snapshot", {
    headers: { Authorization: "Bearer " + token },
  });
  if (!res.ok) throw new Error("Could not restore your words. Please try signing in again.");
  const data = await res.json() as { envelope?: { snapshot?: unknown; webReviewSeq?: number } | null };
  const after = await chrome.storage.local.get(ACCOUNT_CACHE_CLEARED);
  if (after[ACCOUNT_CACHE_CLEARED] !== clearedAt) throw new Error("Account changed while restoring your words.");
  const restored = cloudSnapshotToAnimeVocabExport(data.envelope?.snapshot
    ? normalizeCloudSyncSnapshot(data.envelope.snapshot) : normalizeAnimeVocabExport({}));
  return {
    vocab: restored.vocab, stats: restored.stats, settings: restored.settings,
    webReviewSeq: data.envelope?.webReviewSeq || 0,
    [ACCOUNT_CACHE_CLEARED]: null,
  };
}
