"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useCloudSnapshot } from "@/components/cloud-sync-panel";
import { getPromoState } from "@/lib/site";
import { pickRecentWords } from "@/lib/sync";
import type { CoachMode, CoachResult } from "@/lib/ai-coach";

const promo = getPromoState();

type Usage = { used: number; limit: number; plan: "free" | "pro" | "max" };

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
    <section className="av-card p-6 sm:p-8" aria-label="AI anime coach">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">AI coach</p>
          <h2 className="mt-1.5 font-serif text-2xl font-medium">Ask about a word from its scene</h2>
          <p className="mt-1.5 max-w-[54ch] text-sm text-ink2">
            Paste the subtitle line and get a scene-native explanation or memory hooks.
          </p>
        </div>
        {usage && (
          <span className="av-pill">
            {quotaLeft} / {usage.limit} {tierLabel(usage.plan)} left
          </span>
        )}
      </div>

      {recent.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-ink2">
          <span className="text-ink3">Recent:</span>
          {recent.map((w) => (
            <button
              key={w.base}
              type="button"
              onClick={() => quickFill(w.base)}
              className="rounded-full border border-line px-3 py-1 font-jp text-sm transition hover:border-accent"
            >
              {w.base}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2.5">
        <input className="av-input font-jp" placeholder="Word (e.g. 見る)" value={word} onChange={(e) => setWord(e.target.value)} />
        <input className="av-input" placeholder="Reading (optional)" value={reading} onChange={(e) => setReading(e.target.value)} />
        <textarea
          className="av-input min-h-[52px] resize-y"
          placeholder="Paste the line from the scene it appeared in"
          value={line}
          onChange={(e) => setLine(e.target.value)}
          rows={2}
        />
      </div>

      <div className="mt-3.5 flex flex-wrap gap-2.5">
        <button className="av-btn av-btn-primary" type="button" disabled={busy !== null} onClick={() => ask("explain")}>
          {busy === "explain" ? "Thinking…" : "Explain in scene"}
        </button>
        <button className="av-btn av-btn-ghost" type="button" disabled={busy !== null} onClick={() => ask("hooks")}>
          {busy === "hooks" ? "Thinking…" : "3 memory hooks"}
        </button>
      </div>

      {error && (
        <p className="mt-3 text-sm text-danger">
          {error}{" "}
          {usage && quotaLeft === 0 && usage.plan === "free" && promo.checkoutConfigured && (
            <a href={promo.checkoutUrl} rel="noopener noreferrer" className="underline">
              Upgrade to Pro
            </a>
          )}
        </p>
      )}

      {result && result.mode === "explain" && (
        <div className="mt-4 border-t border-line pt-4">
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-[0.08em] text-accent">Meaning</h3>
          <p className="mb-3">{result.meaning}</p>
          {result.nuance && (
            <>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-[0.08em] text-accent">Why said this way</h3>
              <p className="mb-3">{result.nuance}</p>
            </>
          )}
          {cached && <p className="text-xs text-ink2">Served from cache · no quota used.</p>}
        </div>
      )}

      {result && result.mode === "hooks" && (
        <div className="mt-4 border-t border-line pt-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-accent">Memory hooks</h3>
          <ul className="ml-4 list-disc space-y-2">
            {result.hooks.map((h, i) => (
              <li key={i}>{h}</li>
            ))}
          </ul>
          {cached && <p className="mt-2 text-xs text-ink2">Served from cache · no quota used.</p>}
        </div>
      )}

      <p className="mt-4 text-[13px] text-ink2">
        {usage?.plan === "max" ? (
          <>You&apos;re on Max — higher AI + Listening caps. Reply to Atharva anytime with feedback.</>
        ) : usage?.plan === "pro" ? (
          <>
            Pro monthly AI cap.{" "}
            <Link href="/#pricing" className="underline">
              Max
            </Link>{" "}
            raises it further. Your saved words stay local and exportable.
          </>
        ) : (
          <>
            Free accounts get a taste.{" "}
            <Link href="/#pricing" className="underline">
              Pro
            </Link>{" "}
            raises the monthly cap. Your saved words stay local and exportable.
          </>
        )}
      </p>
    </section>
  );
}

function tierLabel(plan: "free" | "pro" | "max"): string {
  if (plan === "max") return "Max";
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
