"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useCloudSnapshot } from "@/components/cloud-sync-panel";
import { getPromoState } from "@/lib/site";
import { pickRecentWords } from "@/lib/sync";
import type { CoachMode, CoachResult } from "@/lib/ai-coach";

const promo = getPromoState();

type Usage = { used: number; limit: number; plan: "free" | "pro" | "launch" };

export function AiCoach() {
  const snapshot = useCloudSnapshot();
  const recent = useMemo(() => pickRecentWords(snapshot, 8), [snapshot]);

  const [word, setWord] = useState("");
  const [reading, setReading] = useState("");
  const [gloss, setGloss] = useState("");
  const [line, setLine] = useState("");
  const [busy, setBusy] = useState<CoachMode | null>(null);
  const [result, setResult] = useState<CoachResult | null>(null);
  const [cached, setCached] = useState(false);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [error, setError] = useState<string | null>(null);

  const quickFill = (base: string) => {
    const match = recent.find((w) => w.base === base);
    setWord(base);
    setReading(match?.reading ?? "");
    setGloss(match?.gloss ?? "");
    setResult(null);
    setError(null);
  };

  const ask = async (mode: CoachMode) => {
    if (!word.trim() || !line.trim()) {
      setError("Enter a word and the line it appeared in.");
      return;
    }
    setBusy(mode);
    setError(null);
    try {
      const res = await fetch("/api/ai/coach", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode, word, reading, gloss, line }),
      });
      const data = (await res.json()) as {
        result?: CoachResult;
        cached?: boolean;
        usage?: Usage;
        error?: string;
      };
      if (data.usage) setUsage(data.usage);
      if (!res.ok || !data.result) {
        setError(errorCopy(data.error, res.status));
        setResult(null);
        return;
      }
      setResult(data.result);
      setCached(Boolean(data.cached));
    } catch {
      setError("Could not reach the AI coach. Try again.");
    } finally {
      setBusy(null);
    }
  };

  const quotaLeft = usage ? Math.max(0, usage.limit - usage.used) : null;

  return (
    <section className="ai-coach" aria-label="AI anime coach">
      <div className="panel-head">
        <div>
          <p className="eyebrow">AI coach · anime-native</p>
          <h2>Explain a word from the exact scene it appeared in.</h2>
        </div>
        {usage && (
          <span className="status-pill">
            {quotaLeft} / {usage.limit} {tierLabel(usage.plan)} left
          </span>
        )}
      </div>

      {recent.length > 0 && (
        <div className="ai-recent">
          <span>Recent:</span>
          {recent.map((w) => (
            <button key={w.base} type="button" className="ai-chip" onClick={() => quickFill(w.base)}>
              {w.base}
            </button>
          ))}
        </div>
      )}

      <div className="ai-fields">
        <input
          className="ai-input"
          placeholder="Word (e.g. 見る)"
          value={word}
          onChange={(e) => setWord(e.target.value)}
        />
        <input
          className="ai-input"
          placeholder="Reading (optional)"
          value={reading}
          onChange={(e) => setReading(e.target.value)}
        />
        <textarea
          className="ai-input ai-line"
          placeholder="Paste the line from the scene it appeared in"
          value={line}
          onChange={(e) => setLine(e.target.value)}
          rows={2}
        />
      </div>

      <div className="ai-actions">
        <button className="btn btn-accent" type="button" disabled={busy !== null} onClick={() => ask("explain")}>
          {busy === "explain" ? "Thinking…" : "Explain in scene"}
        </button>
        <button className="btn btn-line" type="button" disabled={busy !== null} onClick={() => ask("hooks")}>
          {busy === "hooks" ? "Thinking…" : "3 memory hooks"}
        </button>
      </div>

      {error && (
        <p className="ai-error">
          {error}{" "}
          {usage && quotaLeft === 0 && usage.plan !== "launch" && (
            <a href={promo.checkoutUrl} rel="noopener noreferrer">
              Upgrade to Pro
            </a>
          )}
        </p>
      )}

      {result && result.mode === "explain" && (
        <div className="ai-result">
          <h3>Meaning</h3>
          <p>{result.meaning}</p>
          {result.nuance && (
            <>
              <h3>Why said this way</h3>
              <p>{result.nuance}</p>
            </>
          )}
          {cached && <p className="ai-note">Served from cache · no quota used.</p>}
        </div>
      )}

      {result && result.mode === "hooks" && (
        <div className="ai-result">
          <h3>Memory hooks</h3>
          <ul className="ai-hooks">
            {result.hooks.map((h, i) => (
              <li key={i}>{h}</li>
            ))}
          </ul>
          {cached && <p className="ai-note">Served from cache · no quota used.</p>}
        </div>
      )}

      <p className="ai-foot">
        {usage?.plan === "launch" ? (
          <>All AI features are free during launch, capped per account. Your saved words stay local and exportable.</>
        ) : (
          <>
            Free accounts get a taste. <Link href="/#pricing">Pro</Link> raises the monthly cap. Your saved words
            stay local and exportable.
          </>
        )}
      </p>
    </section>
  );
}

function tierLabel(plan: "free" | "pro" | "launch"): string {
  if (plan === "launch") return "free launch";
  if (plan === "pro") return "Pro";
  return "free";
}

function errorCopy(code: string | undefined, status: number): string {
  switch (code) {
    case "ai_quota_exhausted":
      return "You've used your AI coach calls for this month.";
    case "ai_not_configured":
      return "AI coach isn't configured on this deployment yet.";
    case "unauthorized":
      return "Sign in to use the AI coach.";
    case "missing_word":
    case "missing_line":
      return "Enter a word and the line it appeared in.";
    default:
      return status === 502 ? "The AI coach had trouble. Try again." : "Something went wrong. Try again.";
  }
}
