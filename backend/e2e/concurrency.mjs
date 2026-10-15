// Concurrency check for the listening meter and the realtime mint budget,
// against the real Workers runtime (wrangler dev / workerd), not a mock.
//
//   node e2e/concurrency.mjs [backendDir] [--expect-atomic]
//
// Fires N simultaneous heartbeats of 1 minute each and reads the total back.
// With the meter in KV (read, then write) most of them are lost; with the
// Atomic Durable Object every one counts. Then fires 10 simultaneous session
// mints against a budget of 3 and counts the refusals (needs the budget code).
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const dir = resolve(process.argv[2] || new URL("..", import.meta.url).pathname);
const expectAtomic = process.argv.includes("--expect-atomic");
const N = 50;
const port = 8900 + Math.floor(Math.random() * 90);
const persist = mkdtempSync(join(tmpdir(), "avc-conc-"));
const wrangler = join(dir, "node_modules/.bin/wrangler");
const token = "avc_st_concurrency1";

execFileSync(wrangler, [
  "kv", "key", "put", "--binding", "AVC_KV", "--local", "--persist-to", persist, "--config", join(dir, "wrangler.toml"),
  `synctoken:${token}:v1`,
  JSON.stringify({ id: "user_conc", email: "c@example.com", name: "C", plan: "free", touchedAt: Date.now() }),
], { cwd: dir, stdio: "ignore" });

const dev = spawn(wrangler, ["dev", "--local", "--port", String(port), "--persist-to", persist, "--var", "REALTIME_MINTS_PER_DAY:3", "--var", "OPENAI_API_KEY:sk-invalid"], { cwd: dir, stdio: ["ignore", "pipe", "pipe"] });
let log = "";
dev.stdout.on("data", (d) => (log += d));
dev.stderr.on("data", (d) => (log += d));
const base = `http://127.0.0.1:${port}`;
const auth = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

try {
  for (let i = 0; ; i++) {
    try { if ((await fetch(base + "/v1/public/config")).ok) break; } catch {}
    if (i > 120) throw new Error("wrangler dev never came up\n" + log.slice(-2000));
    await new Promise((r) => setTimeout(r, 500));
  }

  await Promise.all(Array.from({ length: N }, () =>
    fetch(base + "/v1/usage/heartbeat", { method: "POST", headers: auth, body: JSON.stringify({ minutes: 1 }) })));
  const usage = await (await fetch(base + "/v1/usage", { headers: auth })).json();
  console.log(`heartbeats: sent ${N} x 1 min concurrently, meter reads ${usage.usedMinutes} min`);

  const mints = await Promise.all(Array.from({ length: 10 }, () =>
    fetch(base + "/v1/session", { method: "POST", headers: auth, body: "{}" }).then((r) => r.status)));
  const refused = mints.filter((s) => s === 429).length;
  console.log(`session mints: 10 concurrent against a budget of 3 -> ${refused} refused (statuses ${mints.join(",")})`);

  if (expectAtomic) {
    if (usage.usedMinutes !== N) throw new Error(`lost heartbeats: expected ${N}, got ${usage.usedMinutes}`);
    if (refused !== 7) throw new Error(`mint budget leaked: expected 7 refused, got ${refused}`);
    console.log("PASS");
  }
} finally {
  dev.kill("SIGTERM");
}
