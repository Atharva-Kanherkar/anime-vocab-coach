"use client";

import Link from "next/link";
import { useCloudSnapshot } from "@/lib/cloud-snapshot-store";
import { summarizeSyncSnapshot } from "@/lib/sync";
import { useExtensionLink } from "@/lib/use-extension-link";

export function ConnectionStatus() {
  const snapshot = useCloudSnapshot();
  const summary = summarizeSyncSnapshot(snapshot);
  const { installed, state, retry } = useExtensionLink();

  const dot = installed ? "bg-ok" : state === "error" ? "bg-danger" : "bg-ink3";
  const label = installed
    ? summary.totalWords > 0
      ? `Extension connected · ${summary.totalWords.toLocaleString()} words synced`
      : "Extension connected · ready while you watch"
    : state === "checking"
      ? "Checking for extension…"
      : state === "error"
        ? "Could not link extension"
        : "Extension not installed yet";

  return (
    <span className="inline-flex flex-wrap items-center gap-2 text-[13px] text-ink2" aria-live="polite">
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} aria-hidden />
      {label}
      {!installed && state === "missing" && (
        <Link href="#install-extension" className="font-bold text-indigo underline hover:text-ink">
          Install steps
        </Link>
      )}
      {state === "error" && (
        <button type="button" onClick={retry} className="text-ink3 underline hover:text-ink">
          retry
        </button>
      )}
    </span>
  );
}
