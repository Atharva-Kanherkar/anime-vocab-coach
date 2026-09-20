"use client";

// The one client island on /owner. Everything else on this page is a server
// component (see ui.tsx) — this button is the exception because "ask the
// model, show what comes back" cannot happen at render time.

import { useState } from "react";
import type { OwnerInsights } from "@/lib/owner-insights";

export function AiInsights({
  hours,
  label,
  focusUser,
}: {
  hours: number;
  label: string;
  focusUser?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<OwnerInsights | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ask = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/owner/insights", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ hours, user: focusUser }),
      });
      const data = (await res.json()) as { insights?: OwnerInsights; error?: string };
      if (!res.ok || !data.insights) {
        setError(errorCopy(data.error, res.status));
        setResult(null);
        return;
      }
      setResult(data.insights);
    } catch {
      setError("Could not reach the AI. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ow-ai">
      <button type="button" className="ow-ai-btn" disabled={busy} onClick={ask}>
        {busy ? "Analyzing…" : result ? `Re-run for ${label}` : `Get AI insights for ${label}`}
      </button>

      {error ? <p className="ow-ai-error">{error}</p> : null}

      {result ? (
        <div className="ow-ai-result">
          {result.summary ? <p className="ow-ai-summary">{result.summary}</p> : null}
          <div className="ow-ai-cols">
            {result.insights.length > 0 ? (
              <div>
                <h3>What the data shows</h3>
                <ul>
                  {result.insights.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {result.actions.length > 0 ? (
              <div>
                <h3>Do next</h3>
                <ul>
                  {result.actions.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        <p className="ow-ai-hint">
          Reads every panel on this page for the {label} window and asks the model what to act on.
          Nothing is cached — re-run any time, and switching the window resets this.
        </p>
      )}
    </div>
  );
}

function errorCopy(code: string | undefined, status: number): string {
  switch (code) {
    case "ai_not_configured":
      return "AI isn't configured on this deployment (no OPENAI_API_KEY).";
    case "analytics_not_configured":
      return "Configure analytics reads first — there's nothing to analyze yet.";
    case "not_found":
      return "Not authorized.";
    case "openai_empty":
      return "The model returned nothing usable. Try again.";
    default:
      return status === 502 ? "The model had trouble. Try again." : "Something went wrong. Try again.";
  }
}
