// E2E for the end-of-episode quiz: real Chromium, the controller and the UI
// bundled straight out of src/, a stand-in video, and chrome.* stubbed with an
// in-memory store and a canned quiz API. Playwright's clock runs eight minutes
// of playback in a moment.
//
//   node e2e/episode-quiz.mjs
//
// Screenshots land in e2e/shots/; the exit code is non-zero on any failure.
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

const bundle = await esbuild.build({
  stdin: {
    contents: `
      import { createEpisodeQuiz } from "./src/lib/episode-quiz-controller";
      window.avcQuiz = { createEpisodeQuiz };
    `,
    resolveDir: process.cwd(),
    loader: "ts",
  },
  bundle: true,
  format: "iife",
  target: "chrome110",
  write: false,
});

const mc = (kind, i, extra = {}) => ({
  kind,
  prompt: `${kind} question ${i}?`,
  quote: kind === "story" ? undefined : `台詞${i}だ`,
  choices: ["right", "wrong 1", "wrong 2", "wrong 3"],
  answer: 0,
  explain: `because ${i}`,
  ...extra,
});
const QUESTIONS = [
  mc("meaning", 1, { word: { word: "約束", reading: "やくそく", gloss: "promise" } }),
  mc("meaning", 2, { word: { word: "仲間", reading: "なかま", gloss: "friend" } }),
  mc("meaning", 3, { word: { word: "勇者", reading: "ゆうしゃ", gloss: "hero" } }),
  mc("meaning", 4, { word: { word: "魔法", reading: "まほう", gloss: "magic" } }),
  mc("line", 5), mc("line", 6), mc("line", 7),
  mc("story", 8), mc("story", 9), mc("story", 10),
  { kind: "build", prompt: "Build: I like cats", tiles: ["猫", "が", "好き"], explain: "" },
  { kind: "build", prompt: "Build: let's go", tiles: ["行こ", "う", "よ"], explain: "" },
];

const STUBS = (questions) => `
  window.sent = [];
  window.store = {};
  const get = (keys, cb) => {
    const list = typeof keys === "string" ? [keys] : Array.isArray(keys) ? keys : Object.keys(keys || {});
    const out = {};
    for (const k of list) if (k in window.store) out[k] = JSON.parse(JSON.stringify(window.store[k]));
    if (cb) cb(out);
    return Promise.resolve(out);
  };
  const set = (obj, cb) => { Object.assign(window.store, JSON.parse(JSON.stringify(obj))); cb && cb(); return Promise.resolve(); };
  window.chrome = {
    runtime: {
      id: "test",
      lastError: undefined,
      getManifest: () => ({ version: "0.0.0" }),
      sendMessage: async (msg) => {
        window.sent.push(msg);
        if (msg.type === "avc-episode-quiz" && msg.payload.mode === "generate") return { ok: true, data: { questions: ${JSON.stringify(questions)} } };
        if (msg.type === "avc-episode-quiz" && msg.payload.mode === "haru") return window.haruReply;
        return { ok: false };
      },
    },
    storage: { local: { get, set, remove: async () => {} }, onChanged: { addListener() {} } },
  };
  window.video = {
    paused: false, ended: false, currentTime: 0, duration: 24 * 60, pauses: 0, plays: 0,
    pause() { this.paused = true; this.pauses++; },
    play() { this.paused = false; this.plays++; return Promise.resolve(); },
  };
`;

const SETUP = `
  window.state = { session: "netflix:1", active: true, course: false };
  window.quiz = window.avcQuiz.createEpisodeQuiz({
    getVideo: () => window.video,
    sessionId: () => window.state.session,
    title: () => "Frieren",
    active: () => window.state.active,
    inCourse: () => window.state.course,
    direction: () => "en-ja",
    onOpen: () => { window.agentHidden = true; },
  });
  window.feed = (n, prefix = "台詞") => { for (let i = 0; i < n; i++) window.quiz.noteLine(prefix + i + "です", "line " + i); };
`;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on("pageerror", (e) => console.log(`  [page error] ${e.message}`));
await page.clock.install();
await page.setContent(`<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Frieren</title></head>
<body style="background:#111;margin:0;height:100vh"><button data-uia="control-next" onclick="window.nextClicked=true">next</button>
<script>${STUBS(QUESTIONS)}</script><script>${bundle.outputFiles[0].text}</script><script>${SETUP}</script></body></html>`);

const nudge = page.locator("[data-avc-quiz-nudge] .nudge");
const modal = page.locator("[data-avc-episode-quiz] .card");
const tracked = (event) => page.evaluate((e) => window.sent.some((m) => m.type === "avc-track-feature" && m.event === e), event);
const pro = (event) => page.evaluate((e) => window.sent.some((m) => m.type === "avc-track-pro" && m.event === e && m.surface === "ext_episode_quiz"), event);

try {
  // ── Free learner, subtitle Learn: lines + 9 minutes of playback, mid-episode.
  await page.evaluate(() => window.feed(30));
  await page.clock.runFor(9 * 60 * 1000);
  check("no nudge mid-episode", (await nudge.count()) === 0);

  await page.evaluate(() => { window.video.currentTime = 24 * 60 - 100; });
  await page.clock.runFor(2000);
  check("nudge appears in the credits", await nudge.isVisible());
  check("the nudge does not pause the video", !(await page.evaluate(() => window.video.paused)));
  check("quiz_offered is counted", await tracked("quiz_offered"));
  check("the offer is remembered for this episode", await page.evaluate(() => (window.store.avcEpisodeQuizAsked || []).includes("netflix:1")));
  await page.screenshot({ path: `${SHOTS}/episode-quiz-nudge.png` });

  await nudge.getByRole("button", { name: "Start quiz" }).click();
  check("start pauses the video", await page.evaluate(() => window.video.paused));
  check("start hides the word card", await page.evaluate(() => window.agentHidden === true));
  await modal.locator(".prompt").waitFor();
  const sentGen = await page.evaluate(() => window.sent.find((m) => m.type === "avc-episode-quiz"));
  check("generate gets the episode's lines", sentGen?.payload.lines.length === 30 && sentGen.payload.lines[0].en === "line 0");
  check("progress shows 1 / 12", (await modal.locator(".top").innerText()).includes("1 / 12"));
  check("free learners get no read-aloud", (await modal.getByRole("button", { name: "Haru reads it aloud" }).count()) === 0);
  await page.screenshot({ path: `${SHOTS}/episode-quiz-question.png` });

  // Miss the first two meaning questions, get the rest right.
  for (let i = 0; i < 10; i++) {
    await modal.getByRole("button", { name: i < 2 ? "wrong 1" : "right", exact: true }).click();
    if (i === 0) check("a miss shows the explanation", (await modal.locator(".feedback").innerText()).includes("because 1"));
    await modal.getByRole("button", { name: "Next" }).click();
  }
  // Build: right order, then wrong order.
  for (const t of ["猫", "が", "好き"]) await modal.locator(".tiles button", { hasText: new RegExp(`^${t}$`) }).click();
  await modal.getByRole("button", { name: "Check" }).click();
  check("a right build is marked right", (await modal.locator(".feedback b").innerText()) === "Right!");
  await modal.getByRole("button", { name: "Next" }).click();
  await page.screenshot({ path: `${SHOTS}/episode-quiz-build.png` });
  for (const t of ["う", "行こ", "よ"]) await modal.locator(".tiles button", { hasText: new RegExp(`^${t}$`) }).click();
  await modal.getByRole("button", { name: "Undo" }).click();
  await modal.getByRole("button", { name: "Undo" }).click();
  await modal.locator(".tiles button", { hasText: /^よ$/ }).click();
  await modal.locator(".tiles button", { hasText: /^行こ$/ }).click();
  await modal.getByRole("button", { name: "Check" }).click();
  check("a wrong build shows the sentence", (await modal.locator(".feedback").innerText()).includes("行こうよ"));
  await modal.getByRole("button", { name: "See my score" }).click();

  check("score is judged", (await modal.locator(".score").innerText()).replace(/\s+/g, " ").includes("9 / 12 Solid"));
  check("quiz_completed is counted", await tracked("quiz_completed"));
  const addBtn = modal.getByRole("button", { name: /Add 2 missed words/ });
  await addBtn.waitFor();
  await addBtn.click();
  await page.waitForFunction(() => window.store.vocab && window.store.vocab["仲間"]);
  const vocab = await page.evaluate(() => window.store.vocab);
  check("missed words become review cards", vocab["約束"]?.state === "learning" && vocab["仲間"]?.state === "learning" && !vocab["勇者"]);
  check("cards keep the episode as their source", vocab["約束"]?.source?.title === "Frieren" || JSON.stringify(vocab["約束"]).includes("Frieren"));
  check("Haru is locked for free with a Pro link", (await modal.locator(".pill").innerText()) === "Pro" && (await modal.getByRole("button", { name: "See Pro" }).count()) === 1);
  check("the Pro prompt is counted on its surface", await pro("pro_prompt_shown"));
  await page.screenshot({ path: `${SHOTS}/episode-quiz-results-free.png`, fullPage: true });

  await modal.getByRole("button", { name: "Next episode" }).click();
  check("next episode closes the quiz", (await modal.count()) === 0);
  check("next episode clicks the player's next button", await page.evaluate(() => window.nextClicked === true));

  await page.clock.runFor(5000);
  check("never offered twice for one episode", (await nudge.count()) === 0);

  // ── N5 course and signed out: never.
  await page.evaluate(() => { window.state.session = "netflix:2"; window.state.course = true; window.video.currentTime = 0; window.video.paused = false; window.feed(30, "二話"); });
  await page.clock.runFor(9 * 60 * 1000);
  await page.evaluate(() => { window.video.currentTime = 24 * 60 - 60; });
  await page.clock.runFor(3000);
  check("not offered while following the N5 course", (await nudge.count()) === 0);
  await page.evaluate(() => { window.state.course = false; window.state.active = false; });
  await page.clock.runFor(3000);
  check("not offered while signed out", (await nudge.count()) === 0);

  // ── Autoplay into the next episode removes an unanswered nudge.
  await page.evaluate(() => { window.state.active = true; });
  await page.clock.runFor(2000);
  check("offered for episode 2 once the course is off", await nudge.isVisible());
  await page.evaluate(() => { window.state.session = "netflix:3"; });
  await page.clock.runFor(2000);
  check("autoplay to the next episode hides the nudge", (await nudge.count()) === 0);

  // ── Pro learner (Listening Mode lines): read-aloud and Haru.
  await page.evaluate(() => {
    window.store.syncProfile = { email: null, name: null, plan: "pro" };
    window.haruReply = { ok: true, data: { haru: { ok: true, verdict: "Natural and clear.", corrected: "猫が大好きです", note: "Add です for polite speech.", say: "いいね！" } } };
    window.state.session = "youtube:4"; window.video.currentTime = 0; window.video.paused = false; window.feed(25, "聞いた");
  });
  await page.clock.runFor(9 * 60 * 1000);
  await page.evaluate(() => { window.video.ended = true; });
  await page.clock.runFor(2000);
  check("offered when the video ends", await nudge.isVisible());
  await nudge.getByRole("button", { name: "Start quiz" }).click();
  await modal.locator(".prompt").waitFor();
  check("Pro gets read-aloud", (await modal.getByRole("button", { name: "Haru reads it aloud" }).count()) === 1);
  for (let i = 0; i < 10; i++) {
    await modal.getByRole("button", { name: "right", exact: true }).click();
    await modal.getByRole("button", { name: "Next" }).click();
  }
  for (const order of [["猫", "が", "好き"], ["行こ", "う", "よ"]]) {
    for (const t of order) await modal.locator(".tiles button", { hasText: new RegExp(`^${t}$`) }).click();
    await modal.getByRole("button", { name: "Check" }).click();
    await modal.getByRole("button", { name: /Next|See my score/ }).click();
  }
  check("a perfect run is Sharp", (await modal.locator(".score").innerText()).includes("12 / 12"));
  check("no flashcard button when nothing was missed", (await modal.getByRole("button", { name: /missed word/ }).count()) === 0);
  await modal.locator("textarea").fill("猫が好き");
  await modal.getByRole("button", { name: "Ask Haru" }).click();
  await modal.locator(".feedback b").last().waitFor();
  const haruText = await modal.locator(".section").last().innerText();
  check("Haru judges the sentence", haruText.includes("Natural and clear.") && haruText.includes("猫が大好きです") && haruText.includes("いいね"));
  const haruMsg = await page.evaluate(() => window.sent.find((m) => m.type === "avc-episode-quiz" && m.payload.mode === "haru"));
  check("Haru gets the sentence, score and words", haruMsg?.payload.sentence === "猫が好き" && haruMsg.payload.score === 12 && haruMsg.payload.words.length === 2);
  check("Haru speaks", await page.evaluate(() => window.sent.some((m) => m.type === "avc-tts" && m.text === "いいね！")));
  await page.screenshot({ path: `${SHOTS}/episode-quiz-results-pro.png`, fullPage: true });

  await page.keyboard.press("Escape");
  check("Escape closes the quiz", (await modal.count()) === 0);

  // ── Opt out.
  await page.evaluate(() => { window.state.session = "youtube:5"; window.video.ended = false; window.video.currentTime = 0; window.video.paused = false; window.feed(25, "五話"); });
  await page.clock.runFor(9 * 60 * 1000);
  await page.evaluate(() => { window.video.ended = true; });
  await page.clock.runFor(2000);
  await nudge.getByRole("button", { name: "Don't ask after episodes" }).click();
  check("opting out is stored", await page.evaluate(() => window.store.avcEpisodeQuizOff === true));
  await page.evaluate(() => { window.state.session = "youtube:6"; window.video.ended = false; window.feed(25, "六話"); });
  await page.clock.runFor(9 * 60 * 1000);
  await page.evaluate(() => { window.video.ended = true; });
  await page.clock.runFor(2000);
  check("never offered after opting out", (await nudge.count()) === 0);
} catch (err) {
  check("run finished", false, err.message.split("\n")[0]);
  await page.screenshot({ path: `${SHOTS}/episode-quiz-failure.png` }).catch(() => {});
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
