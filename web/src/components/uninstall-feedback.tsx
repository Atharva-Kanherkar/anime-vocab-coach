"use client";

import { useState } from "react";

/**
 * Sends one of the two allowlisted `uninstall_*` events to /api/track (see
 * web/src/lib/track-events.ts) and swaps in a thank-you message. No page
 * reload, no required field beyond the single click — the visitor already
 * uninstalled, so this must be as low-friction as possible or it collects
 * nothing.
 */
export function UninstallFeedback() {
  const [answered, setAnswered] = useState<"before" | "after" | null>(null);

  function send(choice: "before" | "after") {
    setAnswered(choice);
    const body = JSON.stringify({
      kind: "feature",
      name: choice === "before" ? "uninstall_before_use" : "uninstall_after_use",
    });
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/track", new Blob([body], { type: "application/json" }));
        return;
      }
    } catch {
      // fall through
    }
    void fetch("/api/track", {
      method: "POST",
      body,
      headers: { "content-type": "application/json" },
      keepalive: true,
    }).catch(() => {});
  }

  if (answered) {
    return (
      <p style={{ marginTop: 28, color: "var(--ink-3)" }}>
        Thanks — that&apos;s noted.
      </p>
    );
  }

  return (
    <div className="hero-cta" style={{ marginTop: 28 }}>
      <button type="button" className="btn btn-line" onClick={() => send("before")}>
        I uninstalled before really trying it
      </button>
      <button type="button" className="btn btn-line" onClick={() => send("after")}>
        I gave it a real try first
      </button>
    </div>
  );
}
