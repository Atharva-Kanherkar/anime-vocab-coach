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
  type SimpleRow,
  type UserRow,
} from "@/lib/owner-dashboard";
import { fmtMinutes, loadOwnerHistory, type OwnerHistory } from "@/lib/owner-history";
import { AiInsights } from "./ai-insights";
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


/**
 * All-time view, from Clerk and KV rather than Analytics Engine.
 *
 * AE began on 2026-08-06 and has a retention horizon, so every panel above is
 * a window. This section is the corrective: it is the only place on the page
 * that can answer "how many users do we actually have" and "was this month
 * better than last month".
 */
function HistorySection({ history }: { history: OwnerHistory }) {
  const h = history;
  if (!h.available) {
    return (
      <>
        <h2 className="ow-section">All time</h2>
        <div className="ow-note">
          No historical source reachable. {h.notes.join(" ")}
        </div>
      </>
    );
  }

  const signupRows: SimpleRow[] = h.signupsByMonth.map((p) => ({
    label: p.month,
    value: p.signups,
  }));
  const listeningRows: SimpleRow[] = h.listeningByMonth.map((m) => ({
    label: m.month,
    value: Math.round(m.minutes),
    secondary: m.users,
  }));

  return (
    <>
      <h2 className="ow-section">All time</h2>
      <p className="ow-sub">
        From Clerk and KV, not Analytics Engine. The panels above start on 2026-08-06, when
        telemetry shipped; these do not, which is why the two disagree.
      </p>

      {h.notes.length > 0 ? <div className="ow-note">{h.notes.join(" ")}</div> : null}

      <div className="ow-stats">
        <Stat
          label="Total signups"
          value={h.totalUsers === null ? "n/a" : fmtInt(h.totalUsers)}
          foot="Clerk, all time"
        />
        <Stat
          label="Linked extension"
          value={h.linkedUsers === null ? "n/a" : fmtInt(h.linkedUsers)}
          foot="live link, 30d sliding"
        />
        <Stat
          label="Activation"
          value={h.activationRate === null ? "n/a" : fmtPct(h.activationRate)}
          foot="signups that linked"
          tone={
            h.activationRate === null
              ? undefined
              : h.activationRate >= 0.7
                ? "good"
                : h.activationRate >= 0.4
                  ? "warn"
                  : "bad"
          }
        />
        <Stat
          label="Active in 30d"
          value={h.activeLast30 === null ? "n/a" : fmtInt(h.activeLast30)}
          foot={
            h.totalUsers && h.activeLast30 !== null
              ? `${fmtPct(h.activeLast30 / h.totalUsers)} of all signups`
              : undefined
          }
        />
        <Stat
          label="Never active"
          value={h.neverActive === null ? "n/a" : fmtInt(h.neverActive)}
          foot="signed up, never used"
          tone={
            h.neverActive !== null && h.totalUsers && h.neverActive / h.totalUsers > 0.3
              ? "warn"
              : undefined
          }
        />
        <Stat
          label="Listening, all time"
          value={fmtMinutes(h.totalListeningMinutes)}
          foot="KV meter, incl. pre-telemetry"
        />
      </div>

      <div className="ow-grid">
        <Panel title="Signups by month" empty={signupRows.length === 0}>
          <BarList rows={signupRows} unit="signups" />
        </Panel>
        <Panel title="Listening minutes by month" empty={listeningRows.length === 0}>
          <BarList rows={listeningRows} unit="min" />
        </Panel>
        <Panel title="Users by plan" empty={h.usersByPlan.length === 0}>
          <BarList rows={h.usersByPlan} unit="users" />
        </Panel>
        <Panel title="Listening leaders (all time)" empty={h.topListeners.length === 0}>
          <div className="ow-scroll">
            <table className="ow-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th className="ow-num">Audio</th>
                  <th className="ow-num">Months</th>
                </tr>
              </thead>
              <tbody>
                {h.topListeners.map((u) => (
                  <tr key={u.userId}>
                    <td className="ow-label">{u.email || u.userId}</td>
                    <td className="ow-num">{fmtMinutes(u.minutes)}</td>
                    {/* Months active is the retention signal the AE window cannot show. */}
                    <td className="ow-num">{fmtInt(u.months)}</td>
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

  // History reads Clerk + KV, not Analytics Engine, so it is independent of the
  // window and of the SQL API being reachable. Loaded in parallel; the panel
  // degrades on its own if either source is unavailable.
  const [data, history] = await Promise.all([
    loadOwnerDashboard(win.hours, focusUser),
    focusUser ? Promise.resolve(null) : loadOwnerHistory(),
  ]);
  const t = data.totals;
  const tx = data.transcribe;
  const ctx = data.animeContextCache;
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

      {data.configured ? (
        <div className="ow-grid">
          <Panel title="AI insights" wide empty={false}>
            <AiInsights
              key={`${win.hours}:${focusUser ?? ""}`}
              hours={win.hours}
              label={win.label}
              focusUser={focusUser}
            />
          </Panel>
        </div>
      ) : null}

      <div className="ow-stats">
        <Stat
          label="LLM calls"
          value={fmtInt(t.calls)}
          foot={`${fmtInt(t.users)} distinct users${
            data.eventUserCount > 0 ? ` · ${fmtInt(data.eventUserCount)} seen on site` : ""
          }`}
        />
        <Stat
          label="Spend"
          value={fmtUsd(t.cost)}
          foot={t.calls > 0 ? `${fmtUsd(t.cost / t.calls)} / call` : undefined}
        />
        {/* Three caches, three panels (#113). One number used to stand in for
            all of them under a label that named the wrong one, so whichever
            cache you were reasoning about, the figure was not it. */}
        <Stat
          label="Coach response cache"
          value={fmtPct(t.cacheHitRate)}
          foot={`${fmtInt(t.cachedHits)} replies served free`}
          tone={t.cacheHitRate >= 0.3 ? "good" : undefined}
        />
        <Stat
          label="LLM prompt cache"
          value={t.inputTokens > 0 ? fmtPct(t.cachedInputTokens / t.inputTokens) : "—"}
          foot={
            t.inputTokens > 0
              ? `${fmtInt(t.cachedInputTokens)} of ${fmtInt(t.inputTokens)} input tokens`
              : "no input tokens yet"
          }
          tone={t.inputTokens > 0 && t.cachedInputTokens / t.inputTokens >= 0.3 ? "good" : undefined}
        />
        <Stat
          label="Anime-context cache"
          value={ctx.present ? fmtPct(ctx.hitRate) : "—"}
          foot={
            ctx.present
              ? `${fmtInt(ctx.hits)} hits · ${fmtInt(ctx.misses)} paid lookups`
              : "no lookups in this window"
          }
          tone={ctx.present && ctx.hitRate >= 0.3 ? "good" : undefined}
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
        <Stat label="Input tokens" value={fmtInt(t.inputTokens)} foot="cached share above" />
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

      {/* The learning loop (#111). Until these events existed the dashboard
          could describe traffic and spend in detail and could not say whether
          anyone had accepted a single card. */}
      <div className="ow-grid">
        <Panel title="Learning loop" wide empty={data.learningLoop.length === 0}>
          <div className="ow-scroll">
            <table className="ow-table">
              <thead>
                <tr>
                  <th>Event</th>
                  <th className="ow-num">Count</th>
                  <th className="ow-num">Learners</th>
                  {/* Identified events over identified learners. Dividing the
                      total would charge anonymous installs to linked users. */}
                  <th className="ow-num">Per learner</th>
                  <th className="ow-num">Anonymous</th>
                </tr>
              </thead>
              <tbody>
                {data.learningLoop.map((r) => (
                  <tr key={r.label}>
                    <td className="ow-label">
                      <span className="ow-mono">{r.label}</span>
                    </td>
                    <td className="ow-num">{fmtInt(r.events)}</td>
                    <td className="ow-num">{fmtInt(r.users)}</td>
                    <td className="ow-num">
                      {r.users > 0 ? (r.identifiedEvents / r.users).toFixed(1) : "—"}
                    </td>
                    <td className="ow-num">{fmtInt(r.anonEvents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
        {/* #159: the store shipped a build that predated all of the above for
            two months, and the panel above just read zero. This says which
            package the rows are coming from. */}
        <Panel title="Extension builds" empty={data.extensionBuilds.length === 0}>
          <div className="ow-scroll">
            <table className="ow-table">
              <thead>
                <tr>
                  <th>Build</th>
                  <th className="ow-num">Events</th>
                  <th className="ow-num">Learners</th>
                </tr>
              </thead>
              <tbody>
                {data.extensionBuilds.map((r) => (
                  <tr key={r.label}>
                    <td className="ow-label ow-mono">{r.label}</td>
                    <td className="ow-num">{fmtInt(r.events)}</td>
                    <td className="ow-num">{fmtInt(r.users)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

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

      <h2 className="ow-section">Listening Mode (transcription)</h2>
      <p className="ow-sub">
        Written by the avc-api Worker, which is a separate deploy from this app. Cache hits are
        recorded too, so the hit rate has a real denominator.
      </p>

      {!tx.present ? (
        <div className="ow-note">
          No transcription recorded in this window. The <code>avc_transcribe</code> dataset is
          created on first write, so this stays empty until avc-api has been deployed with the
          <code> TRANSCRIBE_AE</code> binding and someone has run a Listening session.
        </div>
      ) : (
        <>
          <div className="ow-stats">
            <Stat
              label="Audio transcribed"
              value={fmtMinutes(tx.minutes)}
              foot={`${fmtInt(tx.calls)} chunks · ${fmtInt(tx.users)} users`}
            />
            <Stat
              label="Billable audio"
              value={fmtMinutes(tx.providerMinutes)}
              foot={`${fmtInt(tx.providerCalls)} provider calls`}
            />
            <Stat
              label="Transcription spend"
              value={fmtUsd(tx.cost)}
              foot={
                tx.providerMinutes > 0
                  ? `${fmtUsd(tx.cost / tx.providerMinutes)} / min`
                  : undefined
              }
            />
            <Stat
              label="Cache hit rate"
              value={fmtPct(tx.hitRate)}
              foot={`${fmtInt(tx.hits)} chunks served free`}
              tone={tx.hitRate >= 0.5 ? "good" : tx.hitRate >= 0.2 ? "warn" : "bad"}
            />
            <Stat label="Avg latency" value={fmtMs(tx.avgLatencyMs)} foot="per chunk" />
            <Stat
              label="Cap rejections"
              value={fmtInt(tx.capHits)}
              foot="hit their monthly limit"
              tone={tx.capHits > 0 ? "warn" : "good"}
            />
            <Stat
              label="Errors"
              value={fmtInt(tx.errors)}
              tone={tx.errors > 0 ? "bad" : "good"}
            />
          </div>

          <div className="ow-grid">
            <Panel title="Minutes transcribed over time" wide empty={tx.series.length === 0}>
              <Chart points={tx.series} label="chunks" />
            </Panel>
          </div>

          <div className="ow-grid">
            <Panel title="By outcome" empty={tx.byOutcome.length === 0}>
              <BarList rows={tx.byOutcome} unit="chunks" />
            </Panel>
            <Panel title="By provider" empty={tx.byProvider.length === 0}>
              <BarList rows={tx.byProvider} unit="chunks" />
            </Panel>
            <Panel title="By language" empty={tx.byLanguage.length === 0}>
              <BarList rows={tx.byLanguage} unit="chunks" />
            </Panel>
            <Panel title="By plan" empty={tx.byPlan.length === 0}>
              <BarList rows={tx.byPlan} unit="chunks" />
            </Panel>
          </div>

          <div className="ow-grid">
            <Panel title="Heaviest listeners" wide empty={tx.topUsers.length === 0}>
              <div className="ow-scroll">
                <table className="ow-table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Plan</th>
                      <th className="ow-num">Audio</th>
                      <th className="ow-num">Chunks</th>
                      <th className="ow-num">Cost</th>
                      <th className="ow-num">Peak month</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tx.topUsers.map((u) => (
                      <tr key={u.userId}>
                        <td className="ow-label">
                          <Link href={`/owner?h=${win.hours}&user=${encodeURIComponent(u.userId)}`}>
                            {u.userId}
                          </Link>
                        </td>
                        <td>
                          <span className="ow-tag">{u.plan}</span>
                        </td>
                        <td className="ow-num">{fmtMinutes(u.minutes)}</td>
                        <td className="ow-num">{fmtInt(u.calls)}</td>
                        <td className="ow-num">{fmtUsd(u.cost)}</td>
                        {/* How close this user got to their monthly ceiling. */}
                        <td className="ow-num">{fmtMinutes(u.peakMonthMinutes)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>
        </>
      )}

      {history ? <HistorySection history={history} /> : null}
    </>
  );
}
