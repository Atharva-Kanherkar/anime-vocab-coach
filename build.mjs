// Bundles the TypeScript sources into the extension/ folder. Each entry
// becomes one classic (IIFE) script — content scripts and MV3 pages can't
// use ES modules, and one file per context keeps the manifest simple.
import * as esbuild from "esbuild";
import { readFileSync } from "fs";

// Load .env for PostHog and other build-time vars (not required in CI if
// vars are already in the environment).
try {
  for (const line of readFileSync(".env", "utf-8").split("\n")) {
    const m = line.match(/^([^#=\s][^=]*)=(.*)$/);
    if (m) process.env[m[1].trim()] ||= m[2].trim();
  }
} catch { /* .env is optional */ }

const watch = process.argv.includes("--watch");

const entries = [
  { in: "src/entries/content.ts", out: "extension/content.js" },
  { in: "src/entries/background.ts", out: "extension/background.js" },
  { in: "src/entries/offscreen.ts", out: "extension/offscreen/offscreen.js" },
  { in: "src/entries/youtube-main.ts", out: "extension/page/youtube-main.js" },
  { in: "src/entries/netflix-main.ts", out: "extension/page/netflix-main.js" },
  { in: "src/entries/popup.ts", out: "extension/popup/popup.js" },
  { in: "src/entries/options.ts", out: "extension/options/options.js" },
  { in: "src/entries/dashboard.ts", out: "extension/dashboard/dashboard.js" },
  { in: "src/entries/sync-bridge.ts", out: "extension/sync-bridge.js" }
];

const define = {
  POSTHOG_TOKEN: JSON.stringify(process.env.POSTHOG_TOKEN || ""),
  POSTHOG_HOST: JSON.stringify(process.env.POSTHOG_HOST || "https://us.i.posthog.com"),
};

const contexts = await Promise.all(entries.map((e) =>
  esbuild.context({
    entryPoints: [e.in],
    outfile: e.out,
    bundle: true,
    format: "iife",
    target: "chrome110",
    sourcemap: false,
    logLevel: "info",
    define,
  })
));

if (watch) {
  await Promise.all(contexts.map((c) => c.watch()));
  console.log("watching for changes…");
} else {
  await Promise.all(contexts.map((c) => c.rebuild()));
  await Promise.all(contexts.map((c) => c.dispose()));
  console.log(`built ${entries.length} bundles`);
}
