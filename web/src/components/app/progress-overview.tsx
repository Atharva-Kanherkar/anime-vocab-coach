"use client";

import { useMemo, type ReactNode } from "react";
import { useCloudSnapshot } from "@/lib/cloud-snapshot-store";
import { computeProgressStats, type ActivityDay, type ShowCount, type StageBucket, type StateSplit } from "@/lib/progress-stats";
import { SRS_INTERVALS } from "@/lib/web-review";

// The stats half of Progress (F7). Everything is drawn with plain elements:
// the numbers are small and fixed-shape, so a chart library would add weight
// without adding anything a learner could read.
export function ProgressOverview({ onGo }: { onGo: (section: string) => void }) {
  const snapshot = useCloudSnapshot();
  const stats = useMemo(() => computeProgressStats(snapshot, new Date()), [snapshot]);
  const { tiles } = stats;

  if (tiles.collected === 0) {
    return (
      <section aria-label="Progress overview">
        <p className="av-eyebrow">Progress · 進歩</p>
        <h1 className="mt-2 font-jpround text-[clamp(28px,4vw,40px)] font-black leading-tight">Your progress</h1>
        <p className="mt-2 max-w-[560px] text-[15px] text-ink2">
          Once the extension syncs your first words, this page fills in with your reviews, streak, and the shows you learn
          from.
        </p>
        <button type="button" className="av-btn av-btn-primary mt-6" onClick={() => onGo("today")}>
          Get started
        </button>
      </section>
    );
  }

  return (
    <section aria-label="Progress overview">
      <p className="av-eyebrow">Progress · 進歩</p>
      <h1 className="mt-2 font-jpround text-[clamp(28px,4vw,40px)] font-black leading-tight">
        {tiles.known.toLocaleString()} known · {tiles.learning.toLocaleString()} learning
      </h1>
      <p className="mt-2 text-[15px] text-ink2">Everything you have synced, across every device.</p>

      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Tile label="Collected" value={tiles.collected.toLocaleString()} />
        <Tile label="Known" value={tiles.known.toLocaleString()} />
        <Tile label="Learning" value={tiles.learning.toLocaleString()} />
        <Tile
          label="Due now"
          value={tiles.dueNow.toLocaleString()}
          highlight={tiles.dueNow > 0}
          action={tiles.dueNow > 0 ? { label: "Review", onClick: () => onGo("review") } : undefined}
        />
        <Tile label="Streak" value={String(tiles.streak)} unit={tiles.streak === 1 ? "day" : "days"} />
        <Tile label="Watched" {...formatMinutes(tiles.minutesWatched)} />
      </div>

      <ActivityChart days={stats.activity} />

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Pipeline stages={stats.stages} />
        <Split split={stats.split} />
      </div>

      {stats.shows.length > 0 && <TopShows shows={stats.shows} />}
    </section>
  );
}

function Tile({
  label,
  value,
  unit,
  highlight = false,
  action,
}: {
  label: string;
  value: string;
  unit?: string;
  highlight?: boolean;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className={"av-card flex flex-col justify-between p-4 sm:p-5 " + (highlight ? "border-accent" : "")}>
      <p className="av-eyebrow">{label}</p>
      <div className="mt-3 flex items-end justify-between gap-2">
        <p className="font-jpround text-[30px] font-black leading-none tabular-nums sm:text-[34px]">
          {value}
          {unit && <span className="ml-1.5 text-[14px] font-bold text-ink3">{unit}</span>}
        </p>
        {action && (
          <button type="button" className="av-btn av-btn-primary av-btn-sm" onClick={action.onClick}>
            {action.label}
          </button>
        )}
      </div>
    </div>
  );
}

function Panel({ title, meta, children }: { title: string; meta?: ReactNode; children: ReactNode }) {
  return (
    <div className="av-card p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-[15px] font-extrabold">{title}</h2>
        {meta && <div className="text-[12.5px] text-ink3">{meta}</div>}
      </div>
      {children}
    </div>
  );
}

function Swatch({ className }: { className: string }) {
  return <span aria-hidden className={"inline-block h-2.5 w-2.5 rounded-[3px] " + className} />;
}

const CHART_HEIGHT = 132;

function ActivityChart({ days }: { days: ActivityDay[] }) {
  const totals = days.reduce((t, d) => ({ reviews: t.reviews + d.reviews, judged: t.judged + d.judged }), { reviews: 0, judged: 0 });
  const peak = Math.max(1, ...days.map((d) => Math.max(d.reviews, d.judged)));
  const activeDays = days.filter((d) => d.reviews > 0 || d.judged > 0).length;
  const label = (day: string) =>
    new Date(`${day}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });

  return (
    <div className="mt-4">
      <Panel
        title="Last 30 days"
        meta={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="flex items-center gap-1.5">
              <Swatch className="bg-indigo" /> Cards judged
            </span>
            <span className="flex items-center gap-1.5">
              <Swatch className="bg-accent" /> Reviews
            </span>
          </span>
        }
      >
        <p className="mt-1 text-[13px] text-ink2">
          <b className="text-ink">{totals.reviews.toLocaleString()}</b> reviews and{" "}
          <b className="text-ink">{totals.judged.toLocaleString()}</b> cards judged, active on{" "}
          <b className="text-ink">{activeDays}</b> of 30 days
        </p>
        <div className="relative mt-5">
          {/* one recessive baseline and a mid guide; the bars carry the rest */}
          <div aria-hidden className="absolute inset-x-0 border-t border-line" style={{ top: CHART_HEIGHT / 2 }} />
          <span aria-hidden className="absolute -top-0.5 right-0 text-[10.5px] tabular-nums text-ink3">
            {peak}
          </span>
          <ol
            className="relative flex items-end gap-[2px] border-b border-line2 sm:gap-[3px]"
            style={{ height: CHART_HEIGHT }}
            aria-label="Daily reviews and cards judged"
          >
            {days.map((d) => {
              const judgedH = (d.judged / peak) * (CHART_HEIGHT - 16);
              const reviewsH = (d.reviews / peak) * (CHART_HEIGHT - 16);
              return (
                <li
                  key={d.day}
                  className="group relative flex h-full flex-1 items-end justify-center"
                  title={`${label(d.day)}: ${d.reviews} reviews, ${d.judged} judged`}
                >
                  <span className="sr-only">
                    {label(d.day)}: {d.reviews} reviews, {d.judged} cards judged
                  </span>
                  <span
                    aria-hidden
                    className="absolute inset-y-0 left-1/2 w-full max-w-[18px] -translate-x-1/2 rounded-t-[4px] bg-field opacity-0 transition group-hover:opacity-100"
                  />
                  <span
                    aria-hidden
                    className="relative w-full max-w-[14px] rounded-t-[4px] bg-indigo"
                    style={{ height: d.judged || d.reviews ? Math.max(3, judgedH, reviewsH) : 0 }}
                  >
                    {d.reviews > 0 && (
                      <span
                        className="absolute inset-x-0 bottom-0 rounded-t-[4px] bg-accent shadow-[0_-2px_0_var(--av-panel)]"
                        style={{ height: Math.max(3, reviewsH) }}
                      />
                    )}
                  </span>
                </li>
              );
            })}
          </ol>
          <div className="mt-2 flex justify-between text-[11px] text-ink3">
            <span>{label(days[0].day)}</span>
            <span className="hidden sm:inline">{label(days[15].day)}</span>
            <span>Today</span>
          </div>
        </div>
      </Panel>
    </div>
  );
}

function stageHint(stage: number): string {
  const hours = SRS_INTERVALS[stage] / 3600e3;
  return hours < 24 ? `${hours}h` : `${hours / 24}d`;
}

function Pipeline({ stages }: { stages: StageBucket[] }) {
  const total = stages.reduce((s, b) => s + b.count, 0);
  const peak = Math.max(1, ...stages.map((s) => s.count));
  return (
    <Panel title="Review pipeline" meta={`${total.toLocaleString()} in review`}>
      <p className="mt-1 text-[13px] text-ink2">Each pass moves a word up a stage. Past stage 5 it is known.</p>
      <ul className="mt-5 grid gap-3">
        {stages.map((s) => (
          <li key={s.stage} className="grid grid-cols-[76px_1fr_36px] items-center gap-3">
            <span className="text-[12.5px] font-bold">
              Stage {s.stage}
              <span className="ml-1.5 font-semibold text-ink3">{stageHint(s.stage)}</span>
            </span>
            <span className="h-3 rounded-[4px] bg-field">
              <span
                className="block h-full rounded-[4px] bg-accent"
                style={{ width: s.count ? `${Math.max(3, (s.count / peak) * 100)}%` : 0 }}
              />
            </span>
            <span className="text-right text-[13px] font-bold tabular-nums">{s.count}</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

const SPLIT_PARTS: { key: keyof StateSplit; label: string; className: string }[] = [
  { key: "known", label: "Known", className: "bg-indigo" },
  { key: "learning", label: "Learning", className: "bg-accent" },
  { key: "new", label: "New", className: "bg-line2" },
];

function Split({ split }: { split: StateSplit }) {
  const total = split.known + split.learning + split.new;
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);
  return (
    <Panel title="Where your words are" meta={`${total.toLocaleString()} words`}>
      <p className="mt-1 text-[13px] text-ink2">Ignored words are left out.</p>
      <div className="mt-5 flex h-4 gap-[2px] overflow-hidden rounded-[5px]" role="img" aria-label={SPLIT_PARTS.map((p) => `${p.label} ${split[p.key]}`).join(", ")}>
        {SPLIT_PARTS.filter((p) => split[p.key] > 0).map((p) => (
          <span key={p.key} className={p.className} style={{ flexGrow: split[p.key], flexBasis: 0, minWidth: 4 }} />
        ))}
      </div>
      <ul className="mt-5 grid gap-2.5">
        {SPLIT_PARTS.map((p) => (
          <li key={p.key} className="flex items-center justify-between gap-3 text-[13.5px]">
            <span className="flex items-center gap-2">
              <Swatch className={p.className} />
              {p.label}
            </span>
            <span className="tabular-nums">
              <b>{split[p.key].toLocaleString()}</b>
              <span className="ml-2 inline-block w-9 text-right text-ink3">{pct(split[p.key])}%</span>
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function TopShows({ shows }: { shows: ShowCount[] }) {
  const peak = Math.max(1, ...shows.map((s) => s.count));
  return (
    <div className="mt-4">
      <Panel title="Top shows" meta="words saved from each">
        <ul className="mt-5 grid gap-x-8 gap-y-3.5 md:grid-cols-2">
          {shows.map((s, i) => (
            <li key={s.title} className="min-w-0">
              <div className="flex items-baseline justify-between gap-3 text-[13.5px]">
                <span className="flex min-w-0 items-baseline gap-2">
                  <span className="w-4 shrink-0 text-[12px] font-bold tabular-nums text-ink3">{i + 1}</span>
                  <span className="truncate font-bold">{s.title}</span>
                </span>
                <span className="shrink-0 font-bold tabular-nums">{s.count}</span>
              </div>
              <span className="mt-1.5 ml-6 block h-1.5 rounded-full bg-field">
                <span className="block h-full rounded-full bg-indigo" style={{ width: `${Math.max(3, (s.count / peak) * 100)}%` }} />
              </span>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

function formatMinutes(total: number): { value: string; unit: string } {
  if (total < 60) return { value: String(total), unit: "min" };
  const hours = total / 60;
  return { value: hours >= 100 ? Math.round(hours).toLocaleString() : hours.toFixed(1).replace(/\.0$/, ""), unit: "hours" };
}
