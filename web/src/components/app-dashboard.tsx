"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { AiCoach } from "@/components/ai-coach";
import { useCloudSnapshot } from "@/components/cloud-sync-panel";
import { GITHUB_URL, getPromoState } from "@/lib/site";
import { pickDueReviews, pickRecentWords, summarizeSyncSnapshot } from "@/lib/sync";

export function AppDashboard() {
  const snapshot = useCloudSnapshot();
  const summary = useMemo(() => summarizeSyncSnapshot(snapshot), [snapshot]);
  const recentWords = useMemo(() => pickRecentWords(snapshot, 5), [snapshot]);
  const dueReviews = useMemo(() => pickDueReviews(snapshot, new Date(), 5), [snapshot]);
  const hasData = summary.totalWords > 0;

  return (
    <>
      <PlanStatusBar />

      <section className="dash-overview" aria-label="Progress overview">
        <div className="metric-grid">
          <Metric label="Words saved" value={summary.totalWords} />
          <Metric label="Learning" value={summary.learningWords} />
          <Metric label="Reviews due" value={summary.reviewsDue} />
          <Metric label="Watch minutes" value={summary.watchMinutes} />
        </div>
      </section>

      <div className="dash-split">
        <DashPanel title="Recent anime words" eyebrow="From your extension">
          {recentWords.length > 0 ? (
            <ul className="word-list">
              {recentWords.map((word) => (
                <li key={word.base}>
                  <span className="word-base">{word.base}</span>
                  <span className="word-meta">
                    {word.reading || word.gloss ? `${word.reading}${word.gloss ? ` · ${word.gloss}` : ""}` : word.state}
                    {word.source?.title ? ` · from ${word.source.title}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title="No words in Cloud yet"
              body="Install the extension and sign in — your words sync here automatically as you learn. (You can also import a JSON export manually below.)"
              primary={{ href: GITHUB_URL, label: "Install free extension", external: true }}
              secondary={{ href: "#sync", label: "Jump to sync" }}
            />
          )}
        </DashPanel>

        <DashPanel title="Reviews due" eyebrow="Spaced repetition">
          {dueReviews.length > 0 ? (
            <ul className="word-list">
              {dueReviews.map((word) => (
                <li key={word.base}>
                  <span className="word-base">{word.base}</span>
                  <span className="word-meta">
                    stage {word.review?.stage ?? 0}
                    {word.review?.dueAt ? ` · due ${formatDue(word.review.dueAt)}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title={hasData ? "You're caught up" : "Reviews live in the extension first"}
              body={
                hasData
                  ? "Great timing — review in the extension or sync again after your next watch session."
                  : "The Chrome extension runs your daily review loop locally. Import progress to preview due cards here."
              }
              primary={{ href: GITHUB_URL, label: "Review in extension", external: true }}
              secondary={{ href: "#sync", label: "Import progress" }}
            />
          )}
        </DashPanel>
      </div>

      <AiCoach />
      {/* Notebooks and the leaderboard now render as live panels on the /app
          page (NotebooksPanel, GamificationPanel) — the old "coming soon"
          placeholders were removed so the page doesn't contradict itself. */}
    </>
  );
}

function PlanStatusBar() {
  const promo = getPromoState();

  return (
    <section className="plan-bar" aria-label="Plan status">
      <div>
        <p className="eyebrow">Current plan</p>
        <h2>Free · extension-first</h2>
        <p className="plan-copy">
          Cloud sync and AI coach features will map to Pro later. Your local extension data stays yours until you import or sync.
        </p>
      </div>
      <div className="plan-actions">
        {promo.checkoutConfigured ? (
          <a className="btn btn-accent" href={promo.checkoutUrl} rel="noopener noreferrer">
            Upgrade to Pro
          </a>
        ) : (
          <span className="status-pill status-disconnected" title="Pro checkout opens soon">
            Pro coming soon
          </span>
        )}
        <Link className="btn btn-line" href="/#pricing">
          Compare plans
        </Link>
      </div>
    </section>
  );
}

function DashPanel({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow: string;
  children: ReactNode;
}) {
  return (
    <article className="dash-panel">
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      {children}
    </article>
  );
}

function EmptyState({
  title,
  body,
  primary,
  secondary,
}: {
  title: string;
  body: string;
  primary: { href: string; label: string; external?: boolean };
  secondary: { href: string; label: string };
}) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      <p>{body}</p>
      <div className="empty-actions">
        {primary.external ? (
          <a className="btn btn-accent" href={primary.href} rel="noopener noreferrer">
            {primary.label}
          </a>
        ) : (
          <Link className="btn btn-accent" href={primary.href}>
            {primary.label}
          </Link>
        )}
        <Link className="btn btn-line" href={secondary.href}>
          {secondary.label}
        </Link>
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
  if (sameDay) return "today";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
