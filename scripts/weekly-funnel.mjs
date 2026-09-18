import { buildFunnelCounts, conversion, FUNNEL_STEPS } from "./funnel-report.mjs";

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const days = Math.max(1, Math.min(90, Number(arg("days") || 7)));
const external = {
  installs: arg("installs") === undefined ? null : Number(arg("installs")),
  payers: arg("payers") === undefined ? null : Number(arg("payers")),
};
const accountId = process.env.CF_ACCOUNT_ID;
const apiToken = process.env.CF_ANALYTICS_API_TOKEN;
if (!accountId || !apiToken) {
  console.error("Set CF_ACCOUNT_ID and CF_ANALYTICS_API_TOKEN (Analytics Read), then rerun.");
  process.exit(1);
}

async function runSql(sql, label) {
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/analytics_engine/sql`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiToken}` },
    body: sql,
  });
  if (!res.ok) throw new Error(`${label}: HTTP ${res.status} ${(await res.text()).slice(0, 160)}`);
  const json = await res.json();
  return Object.fromEntries((json.data || []).map((row) => [String(row.label), Number(row.events) || 0]));
}

const since = `timestamp > NOW() - INTERVAL '${days * 24}' HOUR`;
const [site, extension] = await Promise.all([
  runSql(
    `SELECT blob2 AS label, SUM(_sample_interval) AS events FROM avc_events WHERE ${since} AND blob1 = 'feature' GROUP BY label`,
    "avc_events"
  ),
  runSql(
    `SELECT blob1 AS label, SUM(_sample_interval) AS events FROM extension_funnel WHERE ${since} GROUP BY label`,
    "extension_funnel"
  ),
]);
const counts = buildFunnelCounts(site, extension, external);

console.log(`AnimeVocab funnel · last ${days} days`);
console.log("step\tcount\tfrom previous");
let previous = null;
for (const step of FUNNEL_STEPS) {
  const value = counts[step];
  const rate = conversion(previous, value);
  console.log(`${step}\t${value == null ? "external input required" : value}\t${rate == null ? "—" : `${(rate * 100).toFixed(1)}%`}`);
  previous = value;
}
