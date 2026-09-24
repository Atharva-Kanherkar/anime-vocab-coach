// Preloaded into `next dev` (NODE_OPTIONS=--import …) for web/e2e/observability.mjs
// and web/e2e/pro-entry.mjs.
//
// /owner reads Cloudflare's Analytics Engine SQL API over HTTPS with an
// account token. A local test has neither, and without rows the page renders
// its "not configured" state — which proves nothing about the panels. So this
// intercepts that one endpoint at the undici layer and answers with fixed
// rows, shaped exactly as the SQL API's JSON is: `{ data: [ … ] }` with every
// aggregate as a STRING, which is how AE actually returns them and is the
// reason telemetry-query.ts has a num() helper at all.
//
// Nothing else is intercepted; every other request (including the dev server's
// own localhost traffic) passes through untouched.
import { MockAgent, setGlobalDispatcher } from "undici";

const SQL_ORIGIN = "https://api.cloudflare.com";
const SQL_PATH = /\/client\/v4\/accounts\/[^/]+\/analytics_engine\/sql/;

/** Rows per query, chosen by a distinctive fragment of the SQL. */
function rowsFor(sql) {
  // #160: failed API calls by route, status, auth kind and reason. First,
  // because it also matches the distinct-user check below. The anime-context
  // rows are the shape of the real problem: 401s from the extension's token,
  // written before the reason existed, plus a 502 that is KV, not OpenAI.
  // 250 + 45 = 295, the route's 4xx/5xx cell in the routes query below.
  if (sql.includes("AS authKind")) {
    return [
      {
        route: "/api/anime/context", status: "401", authKind: "sync_token", errorCode: "",
        events: "250", users: "1", anonEvents: "250",
        firstSeen: "2026-08-07 10:00:00", lastSeen: "2026-09-22 18:00:00",
      },
      {
        route: "/api/anime/context", status: "502", authKind: "sync_token",
        errorCode: "kv_get_failed:_429_too_many_requests",
        events: "45", users: "3", anonEvents: "0",
        firstSeen: "2026-09-01 09:00:00", lastSeen: "2026-09-21 23:00:00",
      },
      {
        route: "/api/ai/pick-word", status: "429", authKind: "sync_token",
        errorCode: "auto_quota_exhausted",
        events: "12", users: "1", anonEvents: "0",
        firstSeen: "2026-08-24 20:00:00", lastSeen: "2026-08-25 21:00:00",
      },
    ];
  }
  // #162: Pro prompts by surface and step. Matched on the event name, since
  // the LLM facet query also has a column called surface.
  if (sql.includes("'pro_prompt_shown'")) {
    return [
      { surface: "app_unlock", name: "pro_prompt_shown", events: "6", users: "5", anonEvents: "0" },
      { surface: "app_unlock", name: "pro_prompt_clicked", events: "2", users: "2", anonEvents: "0" },
      { surface: "app_unlock", name: "pro_checkout_started", events: "1", users: "1", anonEvents: "0" },
      { surface: "ext_milestone", name: "pro_prompt_shown", events: "40", users: "13", anonEvents: "3" },
      { surface: "ext_milestone", name: "pro_prompt_clicked", events: "4", users: "4", anonEvents: "0" },
      { surface: "app_billing", name: "pro_checkout_started", events: "1", users: "1", anonEvents: "0" },
    ];
  }
  if (sql.includes("= 'api'") && sql.includes("AS label")) {
    return [
      { label: "/api/anime/context", events: "4338", latencySum: "13881600", errors: "295" },
      { label: "/api/ai/pick-word", events: "2071", latencySum: "2071000", errors: "12" },
    ];
  }

  // #113 — the anime-context cache, which previously had no telemetry at all.
  // 17 hits / 83 misses is the real-world hit rate quoted in the issue.
  if (sql.includes("'anime_context'")) return [{ hits: "17", misses: "83" }];

  // #111 — the learning loop. `anonEvents` exists so the dashboard can discount
  // AE's single shared "anon" bucket from COUNT(DISTINCT userId).
  if (sql.includes("= 'feature'") && sql.includes("GROUP BY label")) {
    return [
      { label: "card_shown", events: "412", users: "9", anonEvents: "140" },
      { label: "card_learn", events: "96", users: "8", anonEvents: "21" },
      { label: "word_saved", events: "88", users: "8", anonEvents: "19" },
      { label: "card_known", events: "77", users: "7", anonEvents: "12" },
      { label: "review_done", events: "54", users: "6", anonEvents: "0" },
      { label: "streak_day", events: "23", users: "6", anonEvents: "0" },
      { label: "card_unlocked", events: "4", users: "3", anonEvents: "0" },
      { label: "install_first_run", events: "31", users: "1", anonEvents: "31" },
      { label: "extension_linked", events: "11", users: "11", anonEvents: "0" },
    ];
  }

  // The distinct-user counts (ungrouped, one row each).
  if (sql.includes("COUNT(DISTINCT") && sql.includes("avc_llm")) return [{ users: "10" }];
  if (sql.includes("COUNT(DISTINCT") && sql.includes("avc_events")) return [{ users: "12" }];

  // The faceted LLM query behind the totals row. cachedInputTokens over
  // inputTokens is what the "LLM prompt cache" panel divides; status 'cached'
  // is what the separate "Coach response cache" panel counts.
  if (sql.includes("avc_llm") && sql.includes("GROUP BY model")) {
    return [
      {
        model: "gpt-5-mini", operation: "explain", surface: "extension", effort: "low", status: "ok",
        calls: "300", cost: "1.2345", inputTokens: "1000000", outputTokens: "120000",
        reasoningTokens: "40000", cachedInputTokens: "400000", latencySum: "600000",
      },
      {
        model: "gpt-5-mini", operation: "explain", surface: "web", effort: "low", status: "cached",
        calls: "100", cost: "0", inputTokens: "0", outputTokens: "0",
        reasoningTokens: "0", cachedInputTokens: "0", latencySum: "0",
      },
      {
        model: "gpt-5-mini", operation: "chat", surface: "web", effort: "low", status: "error",
        calls: "8", cost: "0", inputTokens: "0", outputTokens: "0",
        reasoningTokens: "0", cachedInputTokens: "0", latencySum: "0",
      },
    ];
  }

  // Every other panel renders its empty state, which is not what this tests.
  return [];
}

const agent = new MockAgent();
// Everything that is not the SQL API — the dev server's own localhost traffic
// included — goes to the real network untouched.
agent.enableNetConnect();
agent
  .get(SQL_ORIGIN)
  .intercept({ path: SQL_PATH, method: "POST" })
  .reply(200, (opts) => ({ data: rowsFor(String(opts.body ?? "")) }), {
    headers: { "content-type": "application/json" },
  })
  .persist();

setGlobalDispatcher(agent);
console.log("[e2e] Cloudflare SQL API is mocked in this dev server");
