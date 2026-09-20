// Headed E2E for the generic <video> adapter's cue text.
//
// The bug this pins down only exists in a real browser: the adapter reads
// `VTTCue.text`, and it is Chrome's own WebVTT parser that decides what that
// string contains. Node can't make a VTTCue, so a unit test can only check the
// regex — this checks the thing the regex is applied to.
//
// Real Chromium, real <video>, real cues arriving on a real clock. The only
// stand-in is the media itself: a canvas capture stream, which gives a
// genuinely playing element with an advancing currentTime and no codec or
// network. The adapter source is bundled straight out of src/, so this is the
// shipped code path, not a copy of it.
//
// The expectations below fail in BOTH directions on purpose. Strip tags to ""
// and the <br> cue glues two lines together; strip them to " " and every
// Japanese cue comes back with spaces its script does not have.
//
//   node e2e/generic-cues.mjs
//
// A screenshot lands in e2e/shots/ and the exit code is non-zero on any failure.
import { chromium } from "playwright";
import * as esbuild from "esbuild";
import { mkdirSync } from "node:fs";

const SHOTS = `${process.cwd()}/e2e/shots`;
mkdirSync(SHOTS, { recursive: true });

const results = [];
const check = (n, ok, d = "") => {
  results.push({ n, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? ` — ${d}` : ""}`);
};
const eq = (n, actual, expected) =>
  check(n, actual === expected, actual === expected ? "" : `got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`);

// ------------------------------------------------- the adapter, out of src/

const bundle = await esbuild.build({
  stdin: {
    contents: `
      import { genericAdapter } from "./src/lib/adapters/generic";
      import { setAdapterDirection } from "./src/lib/adapters/util";
      window.avc = { genericAdapter, setAdapterDirection };
    `,
    resolveDir: process.cwd(),
    loader: "ts",
  },
  bundle: true,
  format: "iife",
  target: "chrome110",
  write: false,
});
const adapterJs = bundle.outputFiles[0].text;

// ----------------------------------------------------------- the watch page

/** Japanese study cues, each one a way markup shows up in a real subtitle. */
const JA_CUES = [
  { at: 0.3, raw: "もう<i>二度と</i>会えない", want: "もう二度と会えない", why: "inline <i> around a word", inlineOnly: true },
  { at: 1.5, raw: "いってきます<br>またね", want: "いってきます またね", why: "<br> standing in for a line break", inlineOnly: false },
  { at: 2.7, raw: "<v 主人公><c.yellow>お前</c>は誰だ", want: "お前は誰だ", why: "voice + colour class tags", inlineOnly: true },
  { at: 3.9, raw: "お<i>前</i>は誰だ", want: "お前は誰だ", why: "markup splitting a single word", inlineOnly: true },
];
/** One English context cue, read off the other track. */
const EN_CUE = { at: 0.3, raw: "went home<br>since then", want: "went home since then" };

const page$ = (adapterJs) => `<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8">
<title>generic adapter cue test</title></head>
<body style="background:#111;color:#eee;font:14px system-ui">
<h1 style="font-size:15px">generic &lt;video&gt; adapter — cue text</h1>
<video id="v" width="480" muted></video>
<pre id="log" style="color:#8f8"></pre>
<script>
  window.avcLines = [];
  window.avcStart = () => {
    const v = document.getElementById("v");
    const c = document.createElement("canvas");
    c.width = 480; c.height = 270;
    const g = c.getContext("2d");
    setInterval(() => { g.fillStyle = "#123"; g.fillRect(0, 0, 480, 270); }, 100);
    v.srcObject = c.captureStream(10);
    return v.play().catch(() => {});
  };
</script>
<script>${adapterJs}</script>
</body></html>`;

// --------------------------------------------------------------------- run

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on("console", (m) => { if (m.type() === "error") console.log(`  [page error] ${m.text()}`); });

try {
  await page.setContent(page$(adapterJs), { waitUntil: "domcontentloaded" });

  // Tracks and cues go on before playback so nothing has started ticking yet.
  await page.evaluate(({ ja, en }) => {
    const v = document.getElementById("v");
    const jaTrack = v.addTextTrack("subtitles", "Japanese", "ja");
    jaTrack.mode = "showing";
    for (const c of ja) jaTrack.addCue(new VTTCue(c.at, c.at + 1.0, c.raw));
    const enTrack = v.addTextTrack("subtitles", "English", "en");
    enTrack.mode = "hidden";
    enTrack.addCue(new VTTCue(en.at, en.at + 1.0, en.raw));
  }, { ja: JA_CUES, en: EN_CUE });

  // The browser parsed the markup, not us: prove the cue still holds raw tags,
  // otherwise the rest of this file would be testing nothing.
  const rawInCue = await page.evaluate(() =>
    document.getElementById("v").textTracks[0].cues[0].text);
  eq("cue text reaches the adapter with its markup intact", rawInCue, JA_CUES[0].raw);

  // start() hooks tracks on a 2s poll; let it attach before the clock runs.
  await page.evaluate(() => {
    window.avc.setAdapterDirection("en-ja");
    window.avc.genericAdapter.start((text, ctx) => window.avcLines.push({ text, en: ctx && ctx.en }));
  });
  await page.waitForTimeout(2400);
  await page.evaluate(() => window.avcStart());

  check("adapter matched the page", await page.evaluate(() => window.avc.genericAdapter.matches()));

  // Walk the cues as they go live, reading getVisibleText() inside each window.
  const seen = [];
  for (const cue of JA_CUES) {
    await page.waitForFunction(
      (at) => {
        const t = document.getElementById("v").textTracks[0];
        return !!t.activeCues && t.activeCues.length > 0 && t.activeCues[0].startTime === at;
      },
      cue.at,
      { timeout: 8000 }
    );
    seen.push(await page.evaluate(() => window.avc.genericAdapter.getVisibleText()));
  }

  JA_CUES.forEach((cue, i) => eq(`getVisibleText — ${cue.why}`, seen[i], cue.want));

  await page.screenshot({ path: `${SHOTS}/generic-cues.png` });

  // What start() actually handed the pipeline.
  const lines = await page.evaluate(() => window.avcLines);
  const texts = lines.map((l) => l.text);
  check(
    "every Japanese cue reached onLine, correctly spaced",
    JA_CUES.every((c) => texts.includes(c.want)),
    JSON.stringify(texts)
  );
  // A cue whose only markup was inline styling has no separator in it at all,
  // so its text must come back with no whitespace — Japanese does not write it,
  // and a stray space would split the word before kuromoji ever saw it.
  const inlineOnly = JA_CUES.filter((c) => c.inlineOnly);
  check(
    "inline-only cues come back with no whitespace at all",
    inlineOnly.every((c) => texts.includes(c.want) && !/\s/.test(c.want)),
    JSON.stringify(texts)
  );
  check(
    "the English context track never becomes a study line",
    !texts.some((t) => /went home/.test(t)),
    JSON.stringify(texts)
  );
  eq(
    "English context is read off the other track, correctly spaced",
    lines.find((l) => l.en)?.en ?? null,
    EN_CUE.want
  );
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
if (failed) process.exit(1);
