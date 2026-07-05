"use client";

import { useCallback, useEffect, useState } from "react";

// Bridges the signed-in web session to the installed extension. Mints a sync
// token (server-side, from the Clerk session) and broadcasts it via
// postMessage; the extension's content script on this origin picks it up and
// then pushes learning data to the cloud in the background. Re-broadcasts
// periodically and on demand so the extension always holds a fresh token.
export function ExtensionConnector() {
  const [state, setState] = useState<"minting" | "sent" | "error">("minting");

  const broadcast = useCallback(async () => {
    try {
      const res = await fetch("/api/sync/token", { method: "POST" });
      if (!res.ok) throw new Error(`token HTTP ${res.status}`);
      const { token } = (await res.json()) as { token?: string };
      if (!token) throw new Error("no token");
      window.postMessage({ source: "avc-web", type: "avc-sync-token", token }, window.location.origin);
      setState("sent");
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => {
    // Deferred so the state updates land in async continuations, not
    // synchronously inside the effect body.
    const kick = setTimeout(broadcast, 0);

    // The extension can ask for a token when it loads after the page.
    const onMessage = (e: MessageEvent) => {
      if (e.source !== window || e.origin !== window.location.origin) return;
      const data = e.data as { source?: string; type?: string } | null;
      if (data?.source === "avc-ext" && data.type === "avc-request-token") broadcast();
    };
    window.addEventListener("message", onMessage);

    // Rotate the token periodically so a long-open tab keeps the extension fresh.
    const timer = setInterval(broadcast, 20 * 60 * 1000);
    return () => {
      clearTimeout(kick);
      window.removeEventListener("message", onMessage);
      clearInterval(timer);
    };
  }, [broadcast]);

  return (
    <p className="sync-message" aria-live="polite">
      {state === "sent"
        ? "Extension linked — your progress syncs automatically and Listening Mode uses your account."
        : state === "error"
          ? "Couldn't link the extension. Reload this page while signed in to retry."
          : "Linking extension to your account…"}
    </p>
  );
}
