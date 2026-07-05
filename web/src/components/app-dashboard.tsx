"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { useCloudSnapshot } from "@/components/cloud-sync-panel";
import { GITHUB_URL } from "@/lib/site";
import { pickDueReviews, pickRecentWords, summarizeSyncSnapshot } from "@/lib/sync";

export function AppDashboard() {
  const snapshot = useCloudSnapshot();
  const summary = useMemo(() => summarizeSyncSnapshot(snapshot), [snapshot]);
  const recentWords = useMemo(() => pickRecentWords(snapshot, 5), [snapshot]);
  const dueReviews = useMemo(() => pickDueReviews(snapshot, new Date(), 5), [snapshot]);
  const hasData = summary.totalWords > 0;

  return (
    <>
      <section className="dash-overview" aria-label="Your progress">
        <div className="metric-grid metric-grid--home">
          <Metric label="Words saved" value={summary.totalWords} />
          <Metric label="Learning" value={summary.learningWords} />
          <Metric label="Due today" value={summary.reviewsDue} />
          <Metric label="Watch time (min)" value={summary.watchMinutes} />
        </div>
      </section>

      <div className="dash-split">
        <DashPanel title="Recent words">
          {recentWords.length > 0 ? (
            <ul className="word-list">
              {recentWords.map((word) => (
                <li key={word.base}>
                  <span className="word-base">{word.base}</span>
                  <span className="word-meta">
                    {word.reading || word.gloss
                      ? `${word.reading}${word.gloss ? ` · ${word.gloss}` : ""}`
                      : word.state}
                    {word.source?.title ? ` · ${word.source.title}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title="No words yet"
              body="Install the extension and watch something with subtitles. Tap Know or Learn on words as they appear — they'll show up here."
              primary={{ href: GITHUB_URL, label: "Get the extension", external: true }}
            />
          )}
        </DashPanel>

        <DashPanel title="Reviews due">
          {dueReviews.length > 0 ? (
            <ul className="word-list">
              {dueReviews.map((word) => (
                <li key={word.base}>
                  <span className="word-base">{word.base}</span>
                  <span className="word-meta">
                    {word.reading || word.gloss || "review"}
                    {word.review?.dueAt ? ` · ${formatDue(word.review.dueAt)}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title={hasData ? "All caught up" : "Reviews run in the extension"}
              body={
                hasData
                  ? "Open the extension popup to run your review session."
                  : "Once you save words while watching, spaced repetition keeps them fresh."
              }
              primary={{ href: GITHUB_URL, label: "Open extension", external: true }}
            />
          )}
        </DashPanel>
      </div>

      <section className="app-quick-links" aria-label="Quick links">
        <p className="app-quick-links__label">Go to</p>
        <div className="app-quick-links__grid">
          <QuickLink emoji="🤖" title="AI coach" body="Explain a word from the exact line it appeared in." tab="coach" />
          <QuickLink emoji="📓" title="Notebooks" body="Collect words and scenes by show or topic." tab="notebooks" />
          <QuickLink emoji="🔥" title="Progress" body="Streaks, weekly challenges, and the leaderboard." tab="progress" />
        </div>
      </section>
    </>
  );
}

function QuickLink({
  emoji,
  title,
  body,
  tab,
}: {
  emoji: string;
  title: string;
  body: string;
  tab: string;
}) {
  return (
    <a className="quick-link-card" href={`#${tab}`} onClick={(e) => {
      e.preventDefault();
      document.getElementById(`tab-${tab}`)?.click();
    }}>
      <span className="quick-link-card__emoji" aria-hidden>{emoji}</span>
      <strong>{title}</strong>
      <span>{body}</span>
    </a>
  );
}

function DashPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <article className="dash-panel">
      <h2>{title}</h2>
      {children}
    </article>
  );
}

function EmptyState({
  title,
  body,
  primary,
}: {
  title: string;
  body: string;
  primary: { href: string; label: string; external?: boolean };
}) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      <p>{body}</p>
      <div className="empty-actions">
        {primary.external ? (
          <a className="btn btn-accent btn-sm" href={primary.href} rel="noopener noreferrer">
            {primary.label}
          </a>
        ) : (
          <Link className="btn btn-accent btn-sm" href={primary.href}>
            {primary.label}
          </Link>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="metric-card">
      <strong>{value.toLocaleString()}</strong>
      <span>{label}</span>
    </div>
  );
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
