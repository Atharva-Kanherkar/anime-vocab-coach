"use client";

import { useMemo, useState } from "react";
import {
  normalizeAnimeVocabExport,
  parseAnimeVocabExportJson,
  summarizeSyncSnapshot,
  type CloudSyncSnapshot,
} from "@/lib/sync";

const STORAGE_KEY = "animevocab.cloudSyncSnapshot.v1";

function loadSnapshot(): CloudSyncSnapshot {
  if (typeof window === "undefined") return normalizeAnimeVocabExport({});
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return normalizeAnimeVocabExport({});
  try {
    return JSON.parse(raw) as CloudSyncSnapshot;
  } catch {
    return normalizeAnimeVocabExport({});
  }
}

export function CloudSyncPanel() {
  const [snapshot, setSnapshot] = useState<CloudSyncSnapshot>(() => loadSnapshot());
  const [message, setMessage] = useState("Local-only Cloud foundation ready.");
  const summary = useMemo(() => summarizeSyncSnapshot(snapshot), [snapshot]);

  const saveSnapshot = (next: CloudSyncSnapshot) => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setSnapshot(next);
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
