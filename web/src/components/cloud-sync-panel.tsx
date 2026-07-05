"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import {
  type AnimeVocabExport,
  type CloudSyncEnvelope,
  normalizeAnimeVocabExport,
  parseAnimeVocabExportJson,
  type CloudSyncSnapshot,
  type ExtensionSyncConnectionState,
  type ExtensionSyncStatus,
} from "@/lib/sync";
import { toAnkiCsv, ankiCardCount } from "@/lib/anki-export";

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

export function useCloudSnapshot(): CloudSyncSnapshot {
  return useSyncExternalStore(subscribeToSnapshot, loadSnapshot, () => EMPTY_SNAPSHOT);
}

export function CloudSyncPanel() {
  const snapshot = useCloudSnapshot();
  const [message, setMessage] = useState<string | null>(null);
  const [revision, setRevision] = useState<number | null>(null);
  const [connectionState, setConnectionState] = useState<ExtensionSyncConnectionState>("local-only");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const wordCount = snapshot.words.length;

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
    message: message ?? "",
  };

  const setCloudEnvelope = (envelope: CloudSyncEnvelope | null) => {
    if (!envelope) {
      setConnectionState("disconnected");
      setRevision(null);
      setMessage("No backup on this account yet.");
      return;
    }
    saveSnapshot(envelope.snapshot);
    setRevision(envelope.revision);
    setConnectionState("connected-synced");
    setMessage(`Loaded ${envelope.snapshot.words.length} words from your cloud backup.`);
  };

  const onFile = async (file: File | null) => {
    if (!file) return;
    try {
      const next = parseAnimeVocabExportJson(await file.text());
      saveSnapshot(next);
      setConnectionState(revision === null ? "local-only" : "disconnected");
      setMessage(`Imported ${next.words.length} words from your extension export.`);
    } catch (err) {
      setConnectionState("sync-error");
      setMessage(err instanceof Error ? err.message : "That file doesn't look like an AnimeVocab export.");
    }
  };

  const loadCloudSnapshot = async () => {
    try {
      const res = await fetch("/api/sync/snapshot", { cache: "no-store" });
      if (!res.ok) throw new Error(`Couldn't load backup (${res.status}).`);
      const data = (await res.json()) as CloudMessage;
      setCloudEnvelope(data.envelope);
    } catch (err) {
      setConnectionState("sync-error");
      setMessage(err instanceof Error ? err.message : "Couldn't load your cloud backup.");
    }
  };

  const saveCloudSnapshot = async () => {
    try {
      const res = await fetch("/api/sync/snapshot", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ snapshot, expectedRevision: revision }),
      });
      const data = (await res.json()) as CloudMessage & { error?: string };
      if (res.status === 409) {
        setConnectionState("sync-error");
        setMessage("Your cloud backup changed on another device. Load from cloud first, then try again.");
        return;
      }
      if (!res.ok || !data.envelope) throw new Error(data.error || `Sync failed (${res.status}).`);
      setCloudEnvelope(data.envelope);
      setMessage(`Saved ${data.envelope.snapshot.words.length} words to your account.`);
    } catch (err) {
      setConnectionState("sync-error");
      setMessage(err instanceof Error ? err.message : "Couldn't save to cloud.");
    }
  };

  const exportSnapshot = () => {
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `animevocab-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMessage("Downloaded a JSON backup to your computer.");
  };

  const exportAnki = () => {
    const blob = new Blob([toAnkiCsv(snapshot)], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `animevocab-anki-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setMessage(`Downloaded ${ankiCardCount(snapshot)} cards for Anki.`);
  };

  const statusLabel = useMemo(() => {
    switch (syncStatus.state) {
      case "connected-synced":
        return "Backed up";
      case "sync-error":
        return "Sync issue";
      case "disconnected":
        return "Not synced";
      default:
        return "Local only";
    }
  }, [syncStatus.state]);

  return (
    <section className="cloud-panel cloud-panel--sync" aria-label="Backup and sync">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Backup</p>
          <h2>Keep your words safe in the cloud</h2>
          <p className="panel-lede">
            {wordCount > 0
              ? `${wordCount.toLocaleString()} words on this device. Hit save to copy them to your account.`
              : "Import an extension export, or watch with the extension connected — words sync automatically."}
          </p>
        </div>
        <span className={`status-pill status-${syncStatus.state}`}>{statusLabel}</span>
      </div>

      <div className="sync-actions sync-actions--primary">
        <button className="btn btn-accent" type="button" onClick={saveCloudSnapshot}>
          Save to cloud
        </button>
        <label className="file-button">
          Import from extension
          <input
            type="file"
            accept="application/json,.json"
            onChange={(event) => onFile(event.currentTarget.files?.[0] ?? null)}
          />
        </label>
        <button className="btn btn-line" type="button" onClick={loadCloudSnapshot}>
          Load from cloud
        </button>
      </div>

      {message && <p className="sync-message">{message}</p>}

      <details
        className="sync-advanced"
        open={showAdvanced}
        onToggle={(e) => setShowAdvanced((e.target as HTMLDetailsElement).open)}
      >
        <summary>Advanced options</summary>
        <div className="sync-actions sync-actions--secondary">
          <button className="btn btn-line btn-sm" type="button" onClick={exportSnapshot}>
            Download JSON backup
          </button>
          <button
            className="btn btn-line btn-sm"
            type="button"
            onClick={exportAnki}
            disabled={ankiCardCount(snapshot) === 0}
          >
            Export for Anki ({ankiCardCount(snapshot)})
          </button>
        </div>
        {revision !== null && (
          <p className="sync-note">Cloud version {revision}. If you use multiple devices, load before you save.</p>
        )}
      </details>
    </section>
  );
}
