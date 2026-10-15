// Runs every self-contained extension e2e suite, one after another, against
// the built extension (ISO 25010 audit: CI ran one of fourteen). None of them
// reaches production: YouTube/Netflix pages are routed, and animevocab.com is
// answered locally (support/no-production.mjs) or by a local TLS server.
//
//   node e2e/ci.mjs [--only name,name]
//
// app-link-status needs the web dev server and runs in the web-e2e CI job;
// verify-package needs `npm run pack` first and runs after it.
import { spawnSync } from "node:child_process";

const SUITES = [
  "generic-cues",
  "dashboard-escape",
  "a11y-extension",
  "undo",
  "backup",
  "extension-review",
  "onboarding",
  "learning-loop",
  "pro-popup",
  "panel-layout",
  "playback-hold",
  "copilot-keys-lens",
  "youtube-session",
  "youtube-lens-pot",
  "youtube-followups",
];

const onlyArg = process.argv.indexOf("--only");
const only = onlyArg > 0 ? new Set(process.argv[onlyArg + 1].split(",")) : null;
const failed = [];
for (const name of SUITES) {
  if (only && !only.has(name)) continue;
  const started = Date.now();
  console.log(`\n=== ${name}`);
  const run = spawnSync(process.execPath, [`e2e/${name}.mjs`], { stdio: "inherit", timeout: 5 * 60 * 1000 });
  const secs = ((Date.now() - started) / 1000).toFixed(0);
  if (run.status !== 0) failed.push(name);
  console.log(`=== ${name}: ${run.status === 0 ? "ok" : `FAILED (exit ${run.status ?? run.signal})`} in ${secs}s`);
}
console.log(failed.length ? `\n${failed.length} suite(s) failed: ${failed.join(", ")}` : "\nall e2e suites passed");
process.exit(failed.length ? 1 : 0);
