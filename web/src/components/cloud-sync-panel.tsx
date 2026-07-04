"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import {
  type AnimeVocabExport,
  normalizeAnimeVocabExport,
  parseAnimeVocabExportJson,
  summarizeSyncSnapshot,
  type CloudSyncSnapshot,
} from "@/lib/sync";

const STORAGE_KEY = "animevocab.cloudSyncSnapshot.v1";
const STORAGE_EVENT = "animevocab-cloud-sync";
const EMPTY_SNAPSHOT = normalizeAnimeVocabExport({}, new Date(0));

let cachedRaw: string | null = null;
let cachedSnapshot: CloudSyncSnapshot = EMPTY_SNAPSHOT;

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
  const [message, setMessage] = useState("Local-only Cloud foundation ready.");
  const summary = useMemo(() => summarizeSyncSnapshot(snapshot), [snapshot]);

  const saveSnapshot = (next: CloudSyncSnapshot) => {
    const raw = JSON.stringify(next);
    cachedRaw = raw;
    cachedSnapshot = next;
    window.localStorage.setItem(STORAGE_KEY, raw);
    window.dispatchEvent(new Event(STORAGE_EVENT));
  };

  const onFile = async (file: File | null) => {
    if (!file) return;
    try {
      const next = parseAnimeVocabExportJson(await file.text());
      saveSnapshot(next);
      setMessage(`Imported ${next.words.length} words from extension export.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not import that JSON export.");
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
          <h2>Back up the extension export before full cloud persistence ships.</h2>
        </div>
        <span className="status-pill">Opt-in</span>
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
      </div>

      <p className="sync-message">{message}</p>
      <p className="sync-note">
        This first version keeps the normalized snapshot in this browser while the account and schema are
        locked. The next backend step can persist this exact shape per Clerk user.
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
