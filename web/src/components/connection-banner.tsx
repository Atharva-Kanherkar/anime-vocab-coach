"use client";

import { useCallback, useEffect, useState } from "react";
import { useCloudSnapshot } from "@/components/cloud-sync-panel";
import { summarizeSyncSnapshot } from "@/lib/sync";

type LinkState = "linking" | "linked" | "error";

// Slim status line. Its real job is the side effect: mint a sync token and hand
// it to the extension via postMessage (the extension has no login of its own).
export function ConnectionStatus() {
  const snapshot = useCloudSnapshot();
  const summary = summarizeSyncSnapshot(snapshot);
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

  const dot = linkState === "linked" ? "bg-ok" : linkState === "error" ? "bg-danger" : "bg-ink3";
  const label =
    linkState === "linked"
      ? summary.totalWords > 0
        ? `Connected · ${summary.totalWords.toLocaleString()} words`
        : "Extension connected"
      : linkState === "error"
        ? "Extension not linked"
        : "Linking…";

  return (
    <span className="inline-flex items-center gap-2 text-[13px] text-ink2" aria-live="polite">
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} aria-hidden />
      {label}
      {linkState === "error" && (
        <button type="button" onClick={broadcast} className="text-ink3 underline hover:text-ink">
          retry
        </button>
      )}
    </span>
  );
}
