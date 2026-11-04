"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import {
  normalizeAnimeVocabExport,
  type AnimeVocabExport,
  type CloudSyncEnvelope,
  type CloudSyncSnapshot,
} from "@/lib/sync";

export const STORAGE_KEY = "animevocab.cloudSyncSnapshot.v1";
export const STORAGE_EVENT = "animevocab-cloud-sync";

const EMPTY_SNAPSHOT = normalizeAnimeVocabExport({}, new Date(0));

let cachedRaw: string | null = null;
let cachedSnapshot: CloudSyncSnapshot = EMPTY_SNAPSHOT;

type SyncMeta = {
  revision: number | null;
  lastSyncedAt: string | null;
  loading: boolean;
  error: string | null;
  fetchedAt: number | null;
};

let syncMeta: SyncMeta = {
  revision: null,
  lastSyncedAt: null,
  loading: false,
  error: null,
  fetchedAt: null,
};

const metaListeners = new Set<() => void>();

function notifyMeta(): void {
  metaListeners.forEach((l) => l());
}

function setSyncMeta(partial: Partial<SyncMeta>): void {
  syncMeta = { ...syncMeta, ...partial };
  notifyMeta();
}

function isCloudSyncSnapshot(value: unknown): value is CloudSyncSnapshot {
  return (
    !!value &&
    typeof value === "object" &&
    (value as CloudSyncSnapshot).schemaVersion === 1 &&
    (value as CloudSyncSnapshot).source === "animevocab-extension" &&
    Array.isArray((value as CloudSyncSnapshot).words) &&
    Array.isArray((value as CloudSyncSnapshot).daily)
  );
}

function loadSnapshotFromStorage(): CloudSyncSnapshot {
  if (typeof window === "undefined") return EMPTY_SNAPSHOT;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return EMPTY_SNAPSHOT;
  if (raw === cachedRaw) return cachedSnapshot;
  try {
    const parsed = JSON.parse(raw) as unknown;
    const next = isCloudSyncSnapshot(parsed)
      ? parsed
      : normalizeAnimeVocabExport(parsed as AnimeVocabExport);
    cachedRaw = raw;
    cachedSnapshot = next;
    return next;
  } catch {
    return EMPTY_SNAPSHOT;
  }
}

function subscribeToSnapshot(onChange: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) onChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(STORAGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(STORAGE_EVENT, onChange);
  };
}

export function persistCloudSnapshot(snapshot: CloudSyncSnapshot): void {
  const raw = JSON.stringify(snapshot);
  cachedRaw = raw;
  cachedSnapshot = snapshot;
  window.localStorage.setItem(STORAGE_KEY, raw);
  window.dispatchEvent(new Event(STORAGE_EVENT));
}

export function persistCloudEnvelope(envelope: CloudSyncEnvelope): void {
  persistCloudSnapshot(envelope.snapshot);
  setSyncMeta({
    revision: envelope.revision,
    lastSyncedAt: envelope.lastSyncedAt,
    error: null,
  });
}

export function useCloudSnapshot(): CloudSyncSnapshot {
  return useSyncExternalStore(subscribeToSnapshot, loadSnapshotFromStorage, () => EMPTY_SNAPSHOT);
}

export function useCloudSyncMeta(): SyncMeta {
  return useSyncExternalStore(
    (cb) => {
      metaListeners.add(cb);
      return () => metaListeners.delete(cb);
    },
    () => syncMeta,
    () => syncMeta
  );
}

export async function fetchCloudEnvelope(): Promise<CloudSyncEnvelope | null> {
  const res = await fetch("/api/sync/snapshot", { cache: "no-store" });
  if (!res.ok) throw new Error(`Couldn't load backup (${res.status}).`);
  const data = (await res.json()) as { envelope: CloudSyncEnvelope | null };
  return data.envelope ?? null;
}

/** Pull the server snapshot into localStorage so the dashboard stays current. */
export async function refreshCloudFromServer(options?: { silent?: boolean }): Promise<CloudSyncEnvelope | null> {
  const silent = options?.silent !== false;
  setSyncMeta({ loading: true, error: null });
  try {
    const envelope = await fetchCloudEnvelope();
    if (envelope) {
      persistCloudEnvelope(envelope);
      try {
        window.postMessage({ source: "avc-web", type: "avc-sync-now" }, window.location.origin);
      } catch {
        /* ignore */
      }
    } else {
      setSyncMeta({ revision: null, lastSyncedAt: null });
    }
    setSyncMeta({ loading: false, fetchedAt: Date.now() });
    return envelope;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Couldn't load cloud backup.";
    setSyncMeta({ loading: false, error: message, fetchedAt: Date.now() });
    if (!silent) throw err;
    return null;
  }
}

/** Mount in /app — auto-loads cloud data on open, refresh on focus, periodic poll. */
export function useAutoCloudSync(): void {
  useEffect(() => {
    void refreshCloudFromServer();

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refreshCloudFromServer();
    }, 120_000);

    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      const age = syncMeta.fetchedAt ? Date.now() - syncMeta.fetchedAt : Infinity;
      if (age > 30_000) void refreshCloudFromServer();
    };

    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
}

export function useRefreshCloud(): () => Promise<void> {
  return useCallback(async () => {
    await refreshCloudFromServer({ silent: false });
  }, []);
}

export function formatLastSynced(iso: string | null): string {
  if (!iso) return "never";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "recently";
  const diff = Date.now() - date.getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3600_000) return `${Math.round(diff / 60_000)}m ago`;
  if (diff < 86400_000) return `${Math.round(diff / 3600_000)}h ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
