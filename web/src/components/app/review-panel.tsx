"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useCloudSnapshot, persistCloudEnvelope, refreshCloudFromServer } from "@/lib/cloud-snapshot-store";
import { GettingStarted } from "@/components/app/getting-started";
import { pickDueReviews, type CloudSyncEnvelope, type CloudWordRecord } from "@/lib/sync";
import { localDayKey } from "@/lib/progress-stats";
import { readingWithRomaji } from "@/lib/romaji";
import { SRS_INTERVALS, type WebReviewResult } from "@/lib/web-review";

// A review round, frozen when the learner first touches a card. Without the
// freeze, every answer rewrites the snapshot and re-sorts the due list, so the
// next card (and the progress bar total) would jump around mid-session.
interface Round {
  queue: CloudWordRecord[];
  index: number;
  passed: number;
  failed: number;
  skipped: number;
}

type SubmitState = { kind: "idle" } | { kind: "saving" } | { kind: "error"; result: WebReviewResult; message: string };

export function ReviewPanel({ active, onGo }: { active: boolean; onGo: (section: string) => void }) {
  const snapshot = useCloudSnapshot();
  const [round, setRound] = useState<Round | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [submit, setSubmit] = useState<SubmitState>({ kind: "idle" });
  const [notice, setNotice] = useState<string | null>(null);

  // Recomputed whenever the snapshot changes or the panel is shown again, so a
  // word that came due while the tab sat open is picked up on return.
  const liveDue = useMemo(
    () => (active ? pickDueReviews(snapshot, new Date(), Infinity) : []),
    [snapshot, active]
  );
  const queue = round?.queue ?? liveDue;
  const index = round?.index ?? 0;
  const card = queue[index] ?? null;
  const finished = !card;

  const begin = useCallback((): Round => {
    const next = round ?? { queue: liveDue, index: 0, passed: 0, failed: 0, skipped: 0 };
    if (!round) setRound(next);
    return next;
  }, [round, liveDue]);

  const reveal = useCallback(() => {
    if (!card) return;
    begin();
    setRevealed(true);
  }, [card, begin]);

  const advance = useCallback((from: Round, patch: Partial<Round>) => {
    setRound({ ...from, ...patch, index: from.index + 1 });
    setRevealed(false);
    setSubmit({ kind: "idle" });
  }, []);

  const answer = useCallback(
    async (result: WebReviewResult) => {
      if (!card || submit.kind === "saving") return;
      const current = begin();
      setSubmit({ kind: "saving" });
      setNotice(null);
      try {
        const res = await fetch("/api/sync/review", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ base: card.base, result, day: localDayKey(new Date()) }),
        });
        if (res.status === 404 || res.status === 409) {
          // The word is no longer due on the server: most often the extension
          // reviewed it a moment ago. Retrying could never succeed, so move on
          // and pull the fresh state instead of stranding the learner here.
          setNotice(`${card.base} was already reviewed on another device, so it was skipped.`);
          advance(current, { skipped: current.skipped + 1 });
          void refreshCloudFromServer();
          return;
        }
        if (!res.ok) throw new Error(`status ${res.status}`);
        const data = (await res.json()) as { envelope: CloudSyncEnvelope };
        persistCloudEnvelope(data.envelope);
        try {
          // Nudge the extension bridge on this browser to pull the op now
          // rather than on its next scheduled sync.
          window.postMessage({ source: "avc-web", type: "avc-sync-now" }, window.location.origin);
        } catch {
          /* no bridge on this page, the next sync picks it up */
        }
        advance(current, result === "pass" ? { passed: current.passed + 1 } : { failed: current.failed + 1 });
      } catch {
        setSubmit({
          kind: "error",
          result,
          message: "Couldn't save that answer. Check your connection and try again.",
        });
      }
    },
    [card, submit.kind, begin, advance]
  );

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
      const key = e.key.toLowerCase();
      // A focused button already turns Space/Enter into a click. Handling
      // them here too would answer twice.
      if ((key === " " || key === "enter") && target?.tagName === "BUTTON") return;
      if (!card) return;
      if (!revealed) {
        if (key === " ") {
          e.preventDefault();
          reveal();
        }
        return;
      }
      if (key === "1" || key === "f") {
        e.preventDefault();
        void answer("fail");
      } else if (key === "2" || key === "j" || key === "enter") {
        e.preventDefault();
        void answer("pass");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, card, revealed, reveal, answer]);

  if (snapshot.words.length === 0) {
    return (
      <section aria-label="Review">
        <ReviewHeader title="Nothing to review yet" subtitle="Save words while you watch and they come back here as reviews." />
        <div className="mt-10">
          <GettingStarted />
        </div>
      </section>
    );
  }

  if (finished) {
    const moreDue = round ? liveDue.length : 0;
    return (
      <section aria-label="Review">
        <CaughtUp
          round={round}
          nextDue={nextDueAt(snapshot.words)}
          moreDue={moreDue}
          notice={notice}
          onAgain={() => {
            setRound(null);
            setNotice(null);
          }}
          onGo={onGo}
        />
      </section>
    );
  }

  const total = queue.length;
  const done = index;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const stage = card.review?.stage ?? 1;
  const passLabel = stage + 1 > 5 ? "known" : formatInterval(SRS_INTERVALS[stage + 1]);

  return (
    <section aria-label="Review">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <ReviewHeader
          title={`${total - done} ${total - done === 1 ? "word" : "words"} to review`}
          subtitle="Recall the reading and meaning, then check yourself. Answers sync to your extension."
        />
        <div className="w-full sm:w-[220px]">
          <div className="flex justify-between text-xs font-bold text-ink3">
            <span>Progress</span>
            <span className="tabular-nums">
              {done} / {total}
            </span>
          </div>
          <div
            className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-field"
            role="progressbar"
            aria-label="Review progress"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={done}
          >
            <div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>

      <article key={card.base} className="av-card mx-auto mt-8 max-w-[640px] px-6 pb-7 pt-8 text-center sm:px-10">
        <p className="av-eyebrow truncate text-indigo">{card.source?.title ? card.source.title : "From your collection"}</p>
        <p lang="ja" className="mt-5 break-words font-jpround text-[clamp(52px,11vw,84px)] font-black leading-[1.08]">
          {card.base}
        </p>

        {revealed ? (
          <div className="av-review-answer mt-5">
            {card.reading && (
              <p lang="ja" className="font-jpround text-[18px] font-bold text-ink2">
                {readingWithRomaji(card.reading)}
              </p>
            )}
            {card.gloss && <p className="mt-2 text-[20px] font-bold leading-snug">{card.gloss}</p>}
            {(card.source?.line || card.source?.en) && (
              <div className="mx-auto mt-6 max-w-[480px] border-t border-dashed border-line pt-5 text-left">
                {card.source?.line && (
                  <p lang="ja" className="font-jp text-[15.5px] leading-relaxed">
                    {card.source.line}
                  </p>
                )}
                {card.source?.en && <p className="mt-1.5 text-[14px] leading-relaxed text-ink2">{card.source.en}</p>}
              </div>
            )}
          </div>
        ) : (
          <p className="mt-5 text-[14px] text-ink3">Say the reading and meaning in your head first.</p>
        )}

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {revealed ? (
            <>
              <button
                type="button"
                className="av-btn av-btn-ghost min-w-[140px]"
                disabled={submit.kind === "saving"}
                onClick={() => void answer("fail")}
              >
                Again <span className="av-kbd">1</span>
                <span className="text-[11px] font-bold text-ink3">4h</span>
              </button>
              <button
                type="button"
                className="av-btn av-btn-primary min-w-[140px]"
                disabled={submit.kind === "saving"}
                onClick={() => void answer("pass")}
              >
                Got it <span className="av-kbd av-kbd-on-accent">2</span>
                <span className="text-[11px] font-bold opacity-80">{passLabel}</span>
              </button>
            </>
          ) : (
            <button type="button" className="av-btn av-btn-primary min-w-[200px]" onClick={reveal}>
              Show answer <span className="av-kbd av-kbd-on-accent">Space</span>
            </button>
          )}
        </div>

        {submit.kind === "error" && (
          <div role="alert" className="mt-5 flex flex-wrap items-center justify-center gap-3 text-[13.5px] text-danger">
            <span>{submit.message}</span>
            <button type="button" className="av-btn av-btn-quiet av-btn-sm" onClick={() => void answer(submit.result)}>
              Try again
            </button>
          </div>
        )}
        {notice && <p className="mt-5 text-[13px] text-ink3">{notice}</p>}
      </article>

      <p className="mt-5 hidden text-center text-[12px] text-ink3 sm:block">
        <span className="av-kbd">Space</span> show answer · <span className="av-kbd">1</span> or <span className="av-kbd">F</span>{" "}
        again · <span className="av-kbd">2</span> <span className="av-kbd">J</span> or <span className="av-kbd">Enter</span> got it
      </p>
    </section>
  );
}

function ReviewHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <p className="av-eyebrow">Review · 復習</p>
      <h1 className="mt-2 font-jpround text-[clamp(28px,4vw,40px)] font-black leading-tight">{title}</h1>
      <p className="mt-2 max-w-[520px] text-[15px] text-ink2">{subtitle}</p>
    </div>
  );
}

function CaughtUp({
  round,
  nextDue,
  moreDue,
  notice,
  onAgain,
  onGo,
}: {
  round: Round | null;
  nextDue: Date | null;
  moreDue: number;
  notice: string | null;
  onAgain: () => void;
  onGo: (section: string) => void;
}) {
  const reviewed = round ? round.passed + round.failed : 0;
  return (
    <div className="av-card mx-auto max-w-[640px] px-6 py-10 text-center sm:px-10">
      <div className="av-stamp av-stamp-hit mx-auto w-[72px] text-[30px]" aria-hidden>
        済
      </div>
      <p className="av-eyebrow mt-6">Review · 復習</p>
      <h1 className="mt-2 font-jpround text-[clamp(26px,4vw,36px)] font-black leading-tight">All caught up</h1>
      {reviewed > 0 && (
        <p className="mt-3 text-[15px] text-ink2">
          You reviewed <b className="text-ink">{reviewed}</b> {reviewed === 1 ? "word" : "words"}:{" "}
          {round!.passed} got it, {round!.failed} again.
        </p>
      )}
      <p className="mt-3 text-[15px] text-ink2">
        {nextDue ? (
          <>
            Next review <b className="text-ink">{formatRelative(nextDue)}</b>
            <span className="text-ink3"> · {formatClock(nextDue)}</span>
          </>
        ) : (
          "No reviews are scheduled. Save words while you watch to start the next round."
        )}
      </p>
      {notice && <p className="mt-3 text-[13px] text-ink3">{notice}</p>}
      <div className="mt-8 flex flex-wrap justify-center gap-2.5">
        {moreDue > 0 && (
          <button type="button" className="av-btn av-btn-primary" onClick={onAgain}>
            Review {moreDue} more
          </button>
        )}
        <button type="button" className={moreDue > 0 ? "av-btn av-btn-ghost" : "av-btn av-btn-primary"} onClick={() => onGo("progress")}>
          See progress
        </button>
        <button type="button" className="av-btn av-btn-quiet" onClick={() => onGo("today")}>
          Back to Today
        </button>
      </div>
    </div>
  );
}

function nextDueAt(words: CloudWordRecord[]): Date | null {
  let best = Infinity;
  for (const w of words) {
    if (w.state !== "learning" || !w.review?.dueAt) continue;
    const t = Date.parse(w.review.dueAt);
    if (Number.isFinite(t) && t < best) best = t;
  }
  return Number.isFinite(best) ? new Date(best) : null;
}

function formatInterval(ms: number): string {
  const hours = Math.round(ms / 3600e3);
  return hours < 24 ? `${hours}h` : `${Math.round(hours / 24)}d`;
}

function formatRelative(date: Date): string {
  const diff = date.getTime() - Date.now();
  if (diff <= 60_000) return "now";
  const minutes = Math.round(diff / 60_000);
  if (minutes < 60) return `in ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    const rest = minutes % 60;
    return rest ? `in ${hours}h ${rest}m` : `in ${hours}h`;
  }
  const days = Math.round(hours / 24);
  return `in ${days} ${days === 1 ? "day" : "days"}`;
}

function formatClock(date: Date): string {
  const now = new Date();
  const time = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (date.toDateString() === now.toDateString()) return `today ${time}`;
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  if (date.toDateString() === tomorrow.toDateString()) return `tomorrow ${time}`;
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }) + ` ${time}`;
}
