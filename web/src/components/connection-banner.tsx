"use client";

import { useCloudSnapshot } from "@/lib/cloud-snapshot-store";
import { summarizeSyncSnapshot } from "@/lib/sync";
import { useExtensionLink } from "@/lib/use-extension-link";

export function ConnectionStatus() {
  const snapshot = useCloudSnapshot();
  const summary = summarizeSyncSnapshot(snapshot);
  const { linked, state, retry } = useExtensionLink();

  const dot = linked ? "bg-ok" : state === "error" ? "bg-danger" : "bg-ink3";
  const label =
    linked
      ? summary.totalWords > 0
        ? `Extension connected · ${summary.totalWords.toLocaleString()} words synced`
        : "Extension connected · auto-sync on"
      : state === "error"
        ? "Extension not linked"
        : "Linking extension…";

  return (
    <span className="inline-flex items-center gap-2 text-[13px] text-ink2" aria-live="polite">
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} aria-hidden />
      {label}
      {state === "error" && (
        <button type="button" onClick={retry} className="text-ink3 underline hover:text-ink">
          retry
        </button>
      )}
    </span>
  );
}
