import { clerkClient, currentUser } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { DEV_NO_CLERK } from "@/lib/dev-auth";
import { isOwnerEmail } from "@/lib/entitlements";
import {
  WINDOWS,
  fmtInt,
  fmtMs,
  fmtPct,
  fmtUsd,
  fmtWhen,
  loadOwnerDashboard,
  resolveWindow,
  type GroupRow,
  type UserRow,
} from "@/lib/owner-dashboard";
import { BarList, Chart, Panel, Stat } from "./ui";

// Always fresh: a cached observability dashboard is a lying one.
export const dynamic = "force-dynamic";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

const one = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v;

/**
 * Attach emails to the top-spender rows so the table is readable.
 *
 * One Clerk call for the whole page (getUserList takes a userId array), not
 * one per row. Failure is non-fatal — the table falls back to raw user ids.
 */
async function withEmails(rows: UserRow[]): Promise<UserRow[]> {
  const ids = rows.map((r) => r.userId).filter((id) => id && id !== "anon");
  if (!ids.length || DEV_NO_CLERK) return rows;
  try {
    const client = await clerkClient();
    const page = await client.users.getUserList({ userId: ids, limit: ids.length });
    const byId = new Map(
      page.data.map((u) => [u.id, u.primaryEmailAddress?.emailAddress ?? undefined])
    );
    return rows.map((r) => ({ ...r, email: byId.get(r.userId) }));
  } catch {
    return rows;
  }
}

function GroupTable({ rows, showCost = true }: { rows: GroupRow[]; showCost?: boolean }) {
  return (
    <div className="ow-scroll">
      <table className="ow-table">
        <thead>
          <tr>
            <th>Name</th>
            <th className="ow-num">Calls</th>
            {showCost ? <th className="ow-num">Cost</th> : null}
            <th className="ow-num">Out tok</th>
            <th className="ow-num">Reasoning</th>
            <th className="ow-num">Avg latency</th>
            <th className="ow-num">Errors</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <td className="ow-label">
                <span className="ow-mono">{r.label}</span>
                {r.unpricedModel ? (
                  <>
                    {" "}
                    <span className="ow-tag ow-warn" title="No rate in MODEL_RATES — cost shows as $0">
                      unpriced
                    </span>
                  </>
                ) : null}
              </td>
              <td className="ow-num">{fmtInt(r.calls)}</td>
              {showCost ? <td className="ow-num">{fmtUsd(r.cost)}</td> : null}
              <td className="ow-num">{fmtInt(r.outputTokens)}</td>
              <td className="ow-num">{fmtInt(r.reasoningTokens)}</td>
              <td className="ow-num">{fmtMs(r.avgLatencyMs)}</td>
              <td className={`ow-num${r.errors > 0 ? " ow-bad" : ""}`}>{fmtInt(r.errors)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function OwnerPage({ searchParams }: { searchParams: SearchParams }) {
  // Gate first, before any query runs. notFound() rather than a 403 so the
  // route's existence is not confirmed to anyone who is not the owner.
  if (!DEV_NO_CLERK) {
    const user = await currentUser().catch(() => null);
    if (!isOwnerEmail(user?.primaryEmailAddress?.emailAddress)) notFound();
  }

  const params = await searchParams;
  const win = resolveWindow(one(params.h));
  const focusUser = one(params.user)?.trim() || undefined;

  const data = await loadOwnerDashboard(win.hours, focusUser);
  const t = data.totals;
  const topUsers = await withEmails(data.topUsers);

  const href = (h: number) =>
    focusUser ? `/owner?h=${h}&user=${encodeURIComponent(focusUser)}` : `/owner?h=${h}`;

  return (
    <>
      {focusUser ? (
        <Link className="ow-back" href={`/owner?h=${win.hours}`}>
          ← All users
        </Link>
      ) : null}

      <div className="ow-top">
        <h1>{focusUser ? "User telemetry" : "Owner dashboard"}</h1>
        <nav className="ow-windows">
          {WINDOWS.map((w) => (
            <Link key={w.hours} href={href(w.hours)} className={w.hours === win.hours ? "is-on" : ""}>
              {w.label}
            </Link>
          ))}
        </nav>
      </div>
      <p className="ow-sub">
        {focusUser ? (
          <>
            <span className="ow-mono">{focusUser}</span> · last {win.label} ·{" "}
          </>
        ) : (
          <>Last {win.label} · </>
        )}
        all times UTC · counts are sample-weighted
      </p>

      {!data.configured ? (
        <div className="ow-note">
          <strong>Analytics reads are not configured.</strong> Events are still being written to
          Analytics Engine — this page just cannot query them back yet. To enable:
          <ol>
            <li>
              At <code>dash.cloudflare.com/profile/api-tokens</code> → Create Token → Custom
              token, add the permission <code>Account · Account Analytics · Read</code> and
              scope it to this account.
            </li>
            <li>
              <code>npx wrangler secret put CF_ANALYTICS_API_TOKEN</code> from{" "}
              <code>web/</code>, then paste the token.
            </li>
          </ol>
          <code>CF_ACCOUNT_ID</code> is already set as a var in{" "}
          <code>web/wrangler.jsonc</code>.
        </div>
      ) : null}

      {data.authFailed ? (
        <div className="ow-note is-bad">
          <strong>Cloudflare rejected the analytics token (401).</strong> The secret is set, so
          this is the token itself, not a missing config. Check, in order:
          <ol>
            <li>
              The token has <code>Account · Account Analytics · Read</code>. A Global API Key
              will not work here — it must be a scoped API token.
            </li>
            <li>
              Its <b>Account Resources</b> include the account this Worker runs in
              (<code>68b4f7e6…90b5f</code>).
            </li>
            <li>
              The value stored is the token itself, not its ID, and has no stray newline. Verify
              it independently:
              <br />
              <code>
                curl -X POST
                &quot;https://api.cloudflare.com/client/v4/accounts/$ACCOUNT/analytics_engine/sql&quot;
                -H &quot;Authorization: Bearer $TOKEN&quot; --data &quot;SHOW TABLES&quot;
              </code>
            </li>
          </ol>
        </div>
      ) : null}

      {data.rateLimited && !data.authFailed ? (
        <div className="ow-note is-bad">
          <strong>Rate limited by the Analytics SQL API.</strong> Queries are already throttled
          and retried with backoff; if this persists, widen the window or reload in a minute.
        </div>
      ) : null}

      {data.queryError && !data.authFailed && !data.rateLimited ? (
        <div className="ow-note is-bad">
          <strong>Some panels failed to load.</strong> A dataset that has never been written to
          does not exist yet, which is expected right after deploy.
          <br />
          <code>{data.queryError}</code>
        </div>
      ) : null}

      <div className="ow-stats">
        <Stat label="LLM calls" value={fmtInt(t.calls)} foot={`${fmtInt(t.users)} distinct users`} />
        <Stat
          label="Spend"
          value={fmtUsd(t.cost)}
          foot={t.calls > 0 ? `${fmtUsd(t.cost / t.calls)} / call` : undefined}
        />
        <Stat
          label="Cache hits"
          value={fmtPct(t.cacheHitRate)}
          foot={`${fmtInt(t.cachedHits)} served free`}
          tone={t.cacheHitRate >= 0.3 ? "good" : undefined}
        />
        <Stat
          label="Errors"
          value={fmtPct(t.errorRate)}
          foot={`${fmtInt(t.errors)} failed`}
          tone={t.errorRate > 0.05 ? "bad" : t.errorRate > 0.01 ? "warn" : "good"}
        />
        <Stat label="Avg latency" value={fmtMs(t.avgLatencyMs)} foot="provider calls only" />
        <Stat
          label="Reasoning tokens"
          value={fmtInt(t.reasoningTokens)}
          foot={
            t.outputTokens > 0
              ? `${fmtPct(t.reasoningTokens / t.outputTokens)} of output`
              : undefined
          }
          tone={t.outputTokens > 0 && t.reasoningTokens / t.outputTokens > 0.8 ? "warn" : undefined}
        />
        <Stat
          label="Input tokens"
          value={fmtInt(t.inputTokens)}
          foot={
            t.inputTokens > 0
              ? `${fmtPct(t.cachedInputTokens / t.inputTokens)} cached`
              : undefined
          }
        />
        <Stat label="Output tokens" value={fmtInt(t.outputTokens)} />
      </div>

      <div className="ow-grid">
        <Panel title="Calls over time" wide empty={data.series.length === 0}>
          <Chart points={data.series} label="calls" />
        </Panel>
      </div>

      <div className="ow-grid">
        <Panel title="By model" wide empty={data.byModel.length === 0}>
          <GroupTable rows={data.byModel} />
        </Panel>
      </div>

      <div className="ow-grid">
        <Panel title="By operation" wide empty={data.byOperation.length === 0}>
          <GroupTable rows={data.byOperation} />
        </Panel>
      </div>

      <div className="ow-grid">
        <Panel title="By surface" empty={data.bySurface.length === 0}>
          <BarList rows={data.bySurface.map((r) => ({ label: r.label, value: r.calls }))} unit="calls" />
        </Panel>
        <Panel title="By reasoning effort" empty={data.byEffort.length === 0}>
          <BarList rows={data.byEffort.map((r) => ({ label: r.label, value: r.calls }))} unit="calls" />
        </Panel>
        <Panel title="Errors" empty={data.errors.length === 0}>
          <div className="ow-scroll">
            <table className="ow-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Operation</th>
                  <th className="ow-num">Calls</th>
                </tr>
              </thead>
              <tbody>
                {data.errors.map((e) => (
                  <tr key={`${e.errorCode}:${e.model}:${e.operation}`}>
                    <td className="ow-label ow-mono ow-bad">{e.errorCode}</td>
                    <td className="ow-label ow-mono">{e.operation}</td>
                    <td className="ow-num">{fmtInt(e.calls)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      {!focusUser ? (
        <div className="ow-grid">
          <Panel title="Top users by spend" wide empty={topUsers.length === 0}>
            <div className="ow-scroll">
              <table className="ow-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Plan</th>
                    <th className="ow-num">Calls</th>
                    <th className="ow-num">Cost</th>
                    <th className="ow-num">Out tok</th>
                    <th className="ow-num">Reasoning</th>
                    <th className="ow-num">Errors</th>
                    <th className="ow-num">Last seen</th>
                  </tr>
                </thead>
                <tbody>
                  {topUsers.map((u) => (
                    <tr key={u.userId}>
                      <td className="ow-label">
                        <Link href={`/owner?h=${win.hours}&user=${encodeURIComponent(u.userId)}`}>
                          {u.email || u.userId}
                        </Link>
                      </td>
                      <td>
                        <span className="ow-tag">{u.plan}</span>
                      </td>
                      <td className="ow-num">{fmtInt(u.calls)}</td>
                      <td className="ow-num">{fmtUsd(u.cost)}</td>
                      <td className="ow-num">{fmtInt(u.outputTokens)}</td>
                      <td className="ow-num">{fmtInt(u.reasoningTokens)}</td>
                      <td className={`ow-num${u.errors > 0 ? " ow-bad" : ""}`}>{fmtInt(u.errors)}</td>
                      <td className="ow-num">{fmtWhen(u.lastSeen)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      ) : null}

      <div className="ow-grid">
        <Panel title="Top pages" empty={data.pages.length === 0}>
          <BarList rows={data.pages} unit="views" />
        </Panel>
        <Panel title="Countries" empty={data.countries.length === 0}>
          <BarList rows={data.countries} unit="events" />
        </Panel>
        <Panel title="Referrers" empty={data.referrers.length === 0}>
          <BarList rows={data.referrers} unit="views" />
        </Panel>
        <Panel title="Devices" empty={data.devices.length === 0}>
          <BarList rows={data.devices} unit="events" />
        </Panel>
      </div>

      {!focusUser ? (
        <div className="ow-grid">
          <Panel title="Most active users (events)" empty={data.eventUsers.length === 0}>
            <div className="ow-scroll">
              <table className="ow-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th className="ow-num">Events</th>
                    <th>From</th>
                    <th className="ow-num">Last seen</th>
                  </tr>
                </thead>
                <tbody>
                  {data.eventUsers.map((u) => (
                    <tr key={u.userId}>
                      <td className="ow-label">
                        {u.userId === "anon" ? (
                          <span className="ow-tag">anonymous</span>
                        ) : (
                          <Link href={`/owner?h=${win.hours}&user=${encodeURIComponent(u.userId)}`}>
                            {u.userId}
                          </Link>
                        )}
                      </td>
                      <td className="ow-num">{fmtInt(u.events)}</td>
                      <td>
                        {u.country || "—"} · {u.device || "—"}
                      </td>
                      <td className="ow-num">{fmtWhen(u.lastSeen)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
          <Panel title="Extension funnel" empty={data.extensionFunnel.length === 0}>
            <BarList rows={data.extensionFunnel} unit="events" />
          </Panel>
        </div>
      ) : null}

      <div className="ow-grid">
        <Panel title="API routes" wide empty={data.apiRoutes.length === 0}>
          <div className="ow-scroll">
            <table className="ow-table">
              <thead>
                <tr>
                  <th>Route</th>
                  <th className="ow-num">Calls</th>
                  <th className="ow-num">Avg latency</th>
                  <th className="ow-num">4xx/5xx</th>
                </tr>
              </thead>
              <tbody>
                {data.apiRoutes.map((r) => (
                  <tr key={r.label}>
                    <td className="ow-label ow-mono">{r.label}</td>
                    <td className="ow-num">{fmtInt(r.events)}</td>
                    <td className="ow-num">{fmtMs(r.avgLatencyMs)}</td>
                    <td className={`ow-num${r.errors > 0 ? " ow-bad" : ""}`}>{fmtInt(r.errors)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </>
  );
}
