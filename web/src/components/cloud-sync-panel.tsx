"use client";

import { useMemo, useState } from "react";
import { parseAnimeVocabExportJson } from "@/lib/sync";
import { toAnkiCsv, ankiCardCount } from "@/lib/anki-export";
import {
  formatLastSynced,
  persistCloudEnvelope,
  persistCloudSnapshot,
  refreshCloudFromServer,
  useCloudSnapshot,
  useCloudSyncMeta,
  useRefreshCloud,
} from "@/lib/cloud-snapshot-store";
import { useExtensionLink } from "@/lib/use-extension-link";

export function CloudSyncPanel() {
  const snapshot = useCloudSnapshot();
  const meta = useCloudSyncMeta();
  const { linked: extensionLinked } = useExtensionLink();
  const refresh = useRefreshCloud();
  const [message, setMessage] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const wordCount = snapshot.words.length;

  const statusLabel = useMemo(() => {
    if (meta.loading) return { label: "Updating…", cls: "border-line text-ink2" };
    if (meta.error) return { label: "Sync issue", cls: "border-danger/50 text-danger" };
    if (meta.lastSyncedAt || wordCount > 0) return { label: "Backed up", cls: "border-ok/40 text-ok" };
    return { label: "No backup yet", cls: "border-line text-ink2" };
  }, [meta.loading, meta.error, meta.lastSyncedAt, wordCount]);

  const onFile = async (file: File | null) => {
    if (!file) return;
    try {
      const next = parseAnimeVocabExportJson(await file.text());
      persistCloudSnapshot(next);
      setMessage(`Imported ${next.words.length} words — use advanced save if you need to push them to your account.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "That file doesn't look like an AnimeVocab export.");
    }
  };

  const saveImportToCloud = async () => {
    try {
      const res = await fetch("/api/sync/snapshot", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ snapshot, expectedRevision: meta.revision }),
      });
      const data = (await res.json()) as { envelope?: Parameters<typeof persistCloudEnvelope>[0]; error?: string };
      if (res.status === 409) {
        await refreshCloudFromServer({ silent: false });
        setMessage("Cloud was newer — refreshed from your account. Try saving again if you still need to upload an import.");
        return;
      }
      if (!res.ok || !data.envelope) throw new Error(data.error || `Sync failed (${res.status}).`);
      persistCloudEnvelope(data.envelope);
      setMessage(`Saved ${data.envelope.snapshot.words.length} words to your account.`);
    } catch (err) {
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

  const onRefresh = async () => {
    setMessage(null);
    try {
      await refresh();
      setMessage("Refreshed from your cloud backup.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Couldn't refresh.");
    }
  };

  return (
    <section className="av-card p-6 sm:p-8" aria-label="Backup and sync">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Backup</p>
          <h2 className="mt-1.5 font-serif text-2xl font-medium">
            {extensionLinked ? "Synced automatically" : "Cloud backup"}
          </h2>
          <p className="mt-1.5 max-w-[54ch] text-sm text-ink2">
            {extensionLinked ? (
              <>
                {wordCount > 0 ? (
                  <>
                    <b className="text-ink">{wordCount.toLocaleString()}</b> words on your account
                    {meta.lastSyncedAt ? (
                      <> · last updated {formatLastSynced(meta.lastSyncedAt)}</>
                    ) : null}
                    . The extension pushes while you watch — no manual save needed.
                  </>
                ) : (
                  "Watch with the extension connected — words appear here automatically."
                )}
              </>
            ) : wordCount > 0 ? (
              <>
                {wordCount.toLocaleString()} words loaded in this browser. Connect the extension for automatic sync,
                or use advanced options to import or export manually.
              </>
            ) : (
              "Open the app while signed in with the extension installed, or import a JSON export under advanced options."
            )}
          </p>
        </div>
        <span className={`av-pill ${statusLabel.cls}`}>{statusLabel.label}</span>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <button className="av-btn av-btn-primary" type="button" onClick={() => void onRefresh()} disabled={meta.loading}>
          {meta.loading ? "Refreshing…" : "Refresh from cloud"}
        </button>
        {!extensionLinked && wordCount > 0 && (
          <button className="av-btn av-btn-ghost" type="button" onClick={() => void saveImportToCloud()}>
            Upload import to cloud
          </button>
        )}
      </div>

      {meta.error && !message && (
        <p className="mt-3.5 text-sm font-medium text-danger">{meta.error}</p>
      )}
      {message && <p className="mt-3.5 text-sm font-medium">{message}</p>}

      <details
        className="mt-5 border-t border-line pt-4"
        open={showAdvanced}
        onToggle={(e) => setShowAdvanced((e.target as HTMLDetailsElement).open)}
      >
        <summary className="cursor-pointer select-none text-[13px] font-semibold text-ink2 hover:text-ink">
          Advanced options
        </summary>
        <div className="mt-3 flex flex-wrap gap-2.5">
          <label className="av-btn av-btn-ghost av-btn-sm cursor-pointer">
            Import JSON
            <input
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(event) => onFile(event.currentTarget.files?.[0] ?? null)}
            />
          </label>
          <button className="av-btn av-btn-ghost av-btn-sm" type="button" onClick={exportSnapshot}>
            Download JSON
          </button>
          <button
            className="av-btn av-btn-ghost av-btn-sm"
            type="button"
            onClick={exportAnki}
            disabled={ankiCardCount(snapshot) === 0}
          >
            Export for Anki ({ankiCardCount(snapshot)})
          </button>
        </div>
        {meta.revision !== null && (
          <p className="mt-3 text-[13px] text-ink3">Cloud version {meta.revision}.</p>
        )}
      </details>
    </section>
  );
}

// Re-export for existing imports during migration.
export { useCloudSnapshot } from "@/lib/cloud-snapshot-store";
