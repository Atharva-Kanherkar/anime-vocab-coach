"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import {
  type AnimeVocabExport,
  type CloudSyncEnvelope,
  normalizeAnimeVocabExport,
  parseAnimeVocabExportJson,
  summarizeSyncSnapshot,
  type CloudSyncSnapshot,
  type ExtensionSyncConnectionState,
  type ExtensionSyncStatus,
} from "@/lib/sync";

const STORAGE_KEY = "animevocab.cloudSyncSnapshot.v1";
const STORAGE_EVENT = "animevocab-cloud-sync";
const EMPTY_SNAPSHOT = normalizeAnimeVocabExport({}, new Date(0));

let cachedRaw: string | null = null;
let cachedSnapshot: CloudSyncSnapshot = EMPTY_SNAPSHOT;

type CloudMessage = {
  envelope: CloudSyncEnvelope | null;
};

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

function loadSnapshot(): CloudSyncSnapshot {
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

export function CloudSyncPanel() {
  const snapshot = useSyncExternalStore(subscribeToSnapshot, loadSnapshot, () => EMPTY_SNAPSHOT);
  const [message, setMessage] = useState("Local-only Cloud sync is ready.");
  const [revision, setRevision] = useState<number | null>(null);
  const [connectionState, setConnectionState] = useState<ExtensionSyncConnectionState>("local-only");
  const summary = useMemo(() => summarizeSyncSnapshot(snapshot), [snapshot]);

  const saveSnapshot = (next: CloudSyncSnapshot) => {
    const raw = JSON.stringify(next);
    cachedRaw = raw;
    cachedSnapshot = next;
    window.localStorage.setItem(STORAGE_KEY, raw);
    window.dispatchEvent(new Event(STORAGE_EVENT));
  };

  const syncStatus: ExtensionSyncStatus = {
    state: connectionState,
    userId: null,
    lastSyncedAt: null,
    revision,
    message,
  };

  const setCloudEnvelope = (envelope: CloudSyncEnvelope | null) => {
    if (!envelope) {
      setConnectionState("disconnected");
      setRevision(null);
      setMessage("No cloud snapshot exists for this account yet.");
      return;
    }
    saveSnapshot(envelope.snapshot);
    setRevision(envelope.revision);
    setConnectionState("connected-synced");
    setMessage(`Loaded cloud revision ${envelope.revision} from ${envelope.profile.email || envelope.profile.name || "account"}.`);
  };

  const onFile = async (file: File | null) => {
    if (!file) return;
    try {
      const next = parseAnimeVocabExportJson(await file.text());
      saveSnapshot(next);
      setConnectionState(revision === null ? "local-only" : "disconnected");
      setMessage(`Imported ${next.words.length} words from extension export.`);
    } catch (err) {
      setConnectionState("sync-error");
      setMessage(err instanceof Error ? err.message : "Could not import that JSON export.");
    }
  };

  const loadCloudSnapshot = async () => {
    try {
      const res = await fetch("/api/sync/snapshot", { cache: "no-store" });
      if (!res.ok) throw new Error(`Cloud load failed with ${res.status}.`);
      const data = await res.json() as CloudMessage;
      setCloudEnvelope(data.envelope);
    } catch (err) {
      setConnectionState("sync-error");
      setMessage(err instanceof Error ? err.message : "Could not load cloud snapshot.");
    }
  };

  const saveCloudSnapshot = async () => {
    try {
      const res = await fetch("/api/sync/snapshot", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ snapshot, expectedRevision: revision }),
      });
      const data = await res.json() as CloudMessage & { error?: string };
      if (res.status === 409) {
        setConnectionState("sync-error");
        setMessage("Cloud changed since you loaded it. Load cloud first, export your local JSON if needed, then retry.");
        return;
      }
      if (!res.ok || !data.envelope) throw new Error(data.error || `Cloud save failed with ${res.status}.`);
      setCloudEnvelope(data.envelope);
      setMessage(`Synced ${data.envelope.snapshot.words.length} words to cloud revision ${data.envelope.revision}.`);
    } catch (err) {
      setConnectionState("sync-error");
      setMessage(err instanceof Error ? err.message : "Could not sync cloud snapshot.");
    }
  };

  const exportSnapshot = () => {
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `animevocab-cloud-snapshot-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="cloud-panel" aria-label="Cloud sync foundation">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Local-first sync</p>
          <h2>Back up extension progress to your AnimeVocab Cloud account.</h2>
        </div>
        <span className={`status-pill status-${syncStatus.state}`}>{syncStatus.state.replaceAll("-", " ")}</span>
      </div>

      <div className="metric-grid">
        <Metric label="Words" value={summary.totalWords} />
        <Metric label="Learning" value={summary.learningWords} />
        <Metric label="Reviews due" value={summary.reviewsDue} />
        <Metric label="Watch minutes" value={summary.watchMinutes} />
      </div>

      <div className="sync-actions">
        <label className="file-button">
          Import extension JSON
          <input
            type="file"
            accept="application/json,.json"
            onChange={(event) => onFile(event.currentTarget.files?.[0] ?? null)}
          />
        </label>
        <button className="btn btn-line" type="button" onClick={exportSnapshot}>
          Export cloud snapshot
        </button>
        <button className="btn btn-line" type="button" onClick={loadCloudSnapshot}>
          Load cloud
        </button>
        <button className="btn" type="button" onClick={saveCloudSnapshot}>
          Sync to cloud
        </button>
      </div>

      <p className="sync-message">{message}</p>
      <p className="sync-note">
        Revision {revision ?? "none"} uses explicit conflict checks. Cloud saves fail instead of overwriting
        newer account data silently.
      </p>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="metric-card">
      <strong>{value.toLocaleString()}</strong>
      <span>{label}</span>
    </div>
  );
}
