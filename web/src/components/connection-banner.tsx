"use client";

import Link from "next/link";
import { useCloudSnapshot } from "@/lib/cloud-snapshot-store";
import { summarizeSyncSnapshot } from "@/lib/sync";
import { connectionView } from "@/lib/extension-link-status";
import { useExtensionLink } from "@/lib/use-extension-link";

const DOT: Record<"ok" | "warn" | "off", string> = {
  ok: "bg-ok",
  warn: "bg-danger",
  off: "bg-ink3",
};

export function ConnectionStatus() {
  const snapshot = useCloudSnapshot();
  const summary = summarizeSyncSnapshot(snapshot);
  const { state, tokenState, tokenError, extensionLinked, retry } = useExtensionLink();

  // Presence and token health are separate facts; the view decides what that
  // combination actually means for the learner (issue #133).
  const view = connectionView({
    presence: state === "error" ? "checking" : state,
    tokenState,
    tokenError,
    extensionLinked,
    syncedWords: summary.totalWords,
  });

  return (
    <span className="inline-flex flex-wrap items-center gap-2 text-[13px] text-ink2" aria-live="polite">
      <span className={`h-1.5 w-1.5 rounded-full ${DOT[view.tone]}`} aria-hidden />
      {view.label}
      {view.detail && <span className="text-ink3">{view.detail}</span>}
      {view.showInstallHelp && (
        <Link href="/app#help" className="font-bold text-indigo underline hover:text-ink">
          Install help
        </Link>
      )}
      {view.canRetry && (
        <button type="button" onClick={retry} className="text-ink3 underline hover:text-ink">
          retry
        </button>
      )}
    </span>
  );
}
