"use client";

import { useCallback, useEffect, useState } from "react";
import { useCloudSnapshot } from "@/components/cloud-sync-panel";
import { GITHUB_URL } from "@/lib/site";
import { summarizeSyncSnapshot } from "@/lib/sync";

type LinkState = "linking" | "linked" | "error";

export function ConnectionBanner({ onOpenSync }: { onOpenSync: () => void }) {
  const snapshot = useCloudSnapshot();
  const summary = summarizeSyncSnapshot(snapshot);
  const hasWords = summary.totalWords > 0;
  const [linkState, setLinkState] = useState<LinkState>("linking");

  const broadcast = useCallback(async () => {
    try {
      const res = await fetch("/api/sync/token", { method: "POST" });
      if (!res.ok) throw new Error(`token HTTP ${res.status}`);
      const { token } = (await res.json()) as { token?: string };
      if (!token) throw new Error("no token");
      window.postMessage({ source: "avc-web", type: "avc-sync-token", token }, window.location.origin);
      setLinkState("linked");
    } catch {
      setLinkState("error");
    }
  }, []);

  useEffect(() => {
    const kick = setTimeout(broadcast, 0);

    const onMessage = (e: MessageEvent) => {
      if (e.source !== window || e.origin !== window.location.origin) return;
      const data = e.data as { source?: string; type?: string } | null;
      if (data?.source === "avc-ext" && data.type === "avc-request-token") broadcast();
    };
    window.addEventListener("message", onMessage);

    const timer = setInterval(broadcast, 20 * 60 * 1000);
    return () => {
      clearTimeout(kick);
      window.removeEventListener("message", onMessage);
      clearInterval(timer);
    };
  }, [broadcast]);

  const statusClass =
    linkState === "linked" ? "connection-banner--linked" : linkState === "error" ? "connection-banner--error" : "";

  return (
    <section className={`connection-banner ${statusClass}`} aria-live="polite">
      <div className="connection-banner__copy">
        <p className="connection-banner__title">
          {linkState === "linked"
            ? "Extension connected"
            : linkState === "error"
              ? "Extension not linked"
              : "Linking extension…"}
        </p>
        <p className="connection-banner__body">
          {linkState === "linked"
            ? hasWords
              ? `${summary.totalWords.toLocaleString()} words in your cloud backup. Watch anime with the extension — new words show up here.`
              : "Watch anime with the extension installed. Your words and reviews sync here automatically."
            : linkState === "error"
              ? "Open this page while signed in, with the extension installed, then reload."
              : "One moment while we connect your browser extension to this account."}
        </p>
      </div>
      <div className="connection-banner__actions">
        {linkState === "error" && (
          <button className="btn btn-line btn-sm" type="button" onClick={broadcast}>
            Retry
          </button>
        )}
        {!hasWords && (
          <a className="btn btn-accent btn-sm" href={GITHUB_URL} rel="noopener noreferrer">
            Install extension
          </a>
        )}
        <button className="btn btn-line btn-sm" type="button" onClick={onOpenSync}>
          {hasWords ? "Manage backup" : "Import backup"}
        </button>
      </div>
    </section>
  );
}
