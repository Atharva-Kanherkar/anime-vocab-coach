"use client";

import { useMemo } from "react";
import { useCloudSnapshot } from "@/components/cloud-sync-panel";
import { GettingStarted } from "@/components/app/getting-started";
import { pickDueReviews, pickRecentWords, summarizeSyncSnapshot } from "@/lib/sync";

export function AppDashboard({ name }: { name: string }) {
  const snapshot = useCloudSnapshot();
  const summary = useMemo(() => summarizeSyncSnapshot(snapshot), [snapshot]);
  const recentWords = useMemo(() => pickRecentWords(snapshot, 6), [snapshot]);
  const dueReviews = useMemo(() => pickDueReviews(snapshot, new Date(), 6), [snapshot]);
  const hasData = summary.totalWords > 0;

  return (
    <div className="flex flex-col gap-12">
      <header>
        <h1 className="font-serif text-[clamp(30px,5vw,44px)] font-medium leading-[1.02] tracking-[-0.02em]">
          Hey, {name}
        </h1>
        <p className="mt-2.5 text-[15px] text-ink2">
          {hasData
            ? `${summary.reviewsDue} ${summary.reviewsDue === 1 ? "review" : "reviews"} due · ${summary.totalWords.toLocaleString()} words saved`
            : "Words you pick up while watching anime — saved, reviewed, and explained here."}
        </p>
      </header>

      {!hasData && <GettingStarted />}

      {hasData && (
        <>
          <div className="grid grid-cols-2 border-y border-line sm:grid-cols-4">
            <Stat label="Words saved" value={summary.totalWords} />
            <Stat label="Learning" value={summary.learningWords} />
            <Stat label="Due today" value={summary.reviewsDue} />
            <Stat label="Watch time" value={summary.watchMinutes} unit="min" />
          </div>

          <div className="grid gap-10 sm:grid-cols-2 sm:gap-12">
            <WordColumn title="Recent words" empty="Nothing yet.">
              {recentWords.map((w) => (
                <Row key={w.base} base={w.base} meta={metaFor(w.reading, w.gloss, w.source?.title ?? null)} />
              ))}
            </WordColumn>

            <WordColumn
              title="Reviews due"
              empty="All caught up. Run a review from the extension popup."
            >
              {dueReviews.map((w) => (
                <Row
                  key={w.base}
                  base={w.base}
                  meta={metaFor(w.reading, w.gloss, w.review?.dueAt ? formatDue(w.review.dueAt) : null)}
                />
              ))}
            </WordColumn>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, unit }: { label: string; value: number; unit?: string }) {
  return (
    <div className="border-l border-line px-4 py-4 first:border-l-0 first:pl-0 sm:px-5">
      <div className="font-serif text-[28px] font-medium leading-none tabular-nums">
        {value.toLocaleString()}
        {unit && <span className="ml-1 text-sm text-ink3">{unit}</span>}
      </div>
      <div className="mt-2 text-xs text-ink3">{label}</div>
    </div>
  );
}

function WordColumn({ title, empty, children }: { title: string; empty: string; children: React.ReactNode }) {
  const arr = Array.isArray(children) ? children : [children];
  const has = arr.filter(Boolean).length > 0;
  return (
    <section>
      <h2 className="av-eyebrow mb-3">{title}</h2>
      {has ? <ul>{children}</ul> : <p className="text-sm text-ink2">{empty}</p>}
    </section>
  );
}

function Row({ base, meta }: { base: string; meta: string }) {
  return (
    <li className="flex items-baseline justify-between gap-4 border-b border-line py-2.5 last:border-0">
      <span className="font-jp text-[17px]">{base}</span>
      <span className="shrink-0 text-right text-[13px] text-ink3">{meta}</span>
    </li>
  );
}

function metaFor(reading: string, gloss: string, tail: string | null): string {
  const head = reading || gloss ? `${reading}${gloss ? ` · ${gloss}` : ""}` : "";
  return [head, tail].filter(Boolean).join(" · ") || "—";
}

function formatDue(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) return "due today";
  return `due ${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}
