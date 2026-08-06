// Presentational pieces for /owner. Server components — no client JS ships.

import { fmtCompact, fmtInt, type SimpleRow } from "@/lib/owner-dashboard";

export function Stat({
  label,
  value,
  foot,
  tone,
}: {
  label: string;
  value: string;
  foot?: string;
  tone?: "good" | "warn" | "bad";
}) {
  return (
    <div className="ow-stat">
      <div className="ow-stat-label">{label}</div>
      <div className={`ow-stat-value${tone ? ` ow-${tone}` : ""}`}>{value}</div>
      {foot ? <div className="ow-stat-foot">{foot}</div> : null}
    </div>
  );
}

export function Panel({
  title,
  wide,
  empty,
  children,
}: {
  title: string;
  wide?: boolean;
  empty?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className={`ow-panel${wide ? " is-wide" : ""}`}>
      <h2>{title}</h2>
      {empty ? <p className="ow-empty">No data in this window.</p> : children}
    </section>
  );
}

/** Ranked list with the bar drawn as a background gradient stop — no chart
 * library, no client JS, and it degrades to plain text if CSS fails. */
export function BarList({ rows, unit }: { rows: SimpleRow[]; unit?: string }) {
  const max = rows.reduce((m, r) => Math.max(m, r.value), 0) || 1;
  return (
    <div className="ow-bars">
      {rows.map((r) => (
        <div className="ow-bar-row" key={r.label}>
          <div
            className="ow-bar-label"
            style={{ ["--ow-pct" as string]: `${Math.round((r.value / max) * 100)}%` }}
            title={r.label}
          >
            {r.label}
          </div>
          <div className="ow-bar-value">
            {fmtInt(r.value)}
            {unit ? ` ${unit}` : ""}
            {typeof r.secondary === "number" && r.secondary > 0
              ? ` · ${fmtCompact(r.secondary)} users`
              : ""}
          </div>
        </div>
      ))}
    </div>
  );
}

export function Chart({
  points,
  label,
}: {
  points: { bucket: string; calls: number; cost: number }[];
  label: string;
}) {
  const max = points.reduce((m, p) => Math.max(m, p.calls), 0) || 1;
  const first = points[0]?.bucket ?? "";
  const last = points[points.length - 1]?.bucket ?? "";
  return (
    <>
      <div className="ow-chart">
        {points.map((p) => (
          <div
            key={p.bucket}
            className="ow-chart-col"
            style={{ height: `${Math.max(1, (p.calls / max) * 100)}%` }}
            title={`${p.bucket} — ${fmtInt(p.calls)} ${label}`}
          />
        ))}
      </div>
      <div className="ow-chart-axis">
        <span>{first.slice(0, 16)}</span>
        <span>peak {fmtInt(max)}</span>
        <span>{last.slice(0, 16)}</span>
      </div>
    </>
  );
}
