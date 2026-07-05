import * as storage from "../lib/storage";
import { toRomaji } from "../lib/romaji";
import { getDueWords } from "../lib/review";
import type { DailyStats, Stats, VocabMap } from "../types";

const SVGNS = "http://www.w3.org/2000/svg";
const C = (name: string): string => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const COL = {
  known: C("--known"), learning: C("--learning"), new: C("--new"), ignored: C("--ignored"),
  accent: C("--accent"), muted: C("--muted"), grid: C("--grid"), axis: C("--axis"),
  seq: ["--seq-1", "--seq-2", "--seq-3", "--seq-4", "--seq-5", "--seq-6"].map(C)
};

const tip = document.getElementById("tooltip") as HTMLDivElement;
function showTip(html: string, ev: MouseEvent): void {
  tip.innerHTML = html;
  tip.hidden = false;
  const pad = 14, w = tip.offsetWidth, h = tip.offsetHeight;
  let x = ev.clientX + pad, y = ev.clientY + pad;
  if (x + w > innerWidth) x = ev.clientX - w - pad;
  if (y + h > innerHeight) y = ev.clientY - h - pad;
  tip.style.left = x + "px"; tip.style.top = y + "px";
}
const hideTip = (): void => { tip.hidden = true; };

function el(tag: string, attrs?: Record<string, string | number>, kids?: Element[]): SVGElement {
  const n = document.createElementNS(SVGNS, tag) as SVGElement;
  for (const k in (attrs || {})) n.setAttribute(k, String(attrs![k]));
  (kids || []).forEach((c) => n.appendChild(c));
  return n;
}
function svg(w: number, h: number): SVGElement {
  return el("svg", { viewBox: `0 0 ${w} ${h}`, width: w, height: h, role: "img" });
}
function txt(x: number, y: number, s: string, cls?: string, anchor?: string): SVGElement {
  const t = el("text", { x, y, class: cls || "ax", "text-anchor": anchor || "start" });
  t.textContent = s;
  return t;
}
const todayKey = (): string => new Date().toLocaleDateString("sv");
const nf = (n: number): string => n.toLocaleString();

// ---------- data ----------
function computeStreak(daily: Record<string, DailyStats>): number {
  const days = Object.keys(daily || {}).filter((d) => daily[d].judged >= 1).sort().reverse();
  if (!days.length) return 0;
  const today = todayKey();
  const yest = new Date(Date.now() - 864e5).toLocaleDateString("sv");
  if (days[0] !== today && days[0] !== yest) return 0;
  let streak = 0, expect = days[0];
  for (const d of days) {
    if (d !== expect) break;
    streak++;
    expect = new Date(new Date(expect + "T12:00:00").getTime() - 864e5).toLocaleDateString("sv");
  }
  return streak;
}

// ---------- charts ----------
function renderTiles(vocab: VocabMap, stats: Stats): void {
  const v = Object.values(vocab);
  const known = v.filter((r) => r.state === "known").length;
  const learning = v.filter((r) => r.state === "learning").length;
  const seen = v.filter((r) => r.state === "new").length;
  const reviews = Object.values(stats.daily || {}).reduce((a, d) => a + (d.reviews || 0), 0);
  const mins = Object.values(stats.daily || {}).reduce((a, d) => a + (d.watchMin || 0), 0);
  const streak = computeStreak(stats.daily);
  const tiles = [
    { val: nf(known), lab: "Words known", cls: "known" },
    { val: nf(learning), lab: "Learning", cls: "learning" },
    { val: nf(seen), lab: "Seen (not yet judged)", cls: "" },
    { val: nf(reviews), lab: "Reviews done", cls: "accent" },
    { val: streak + "d", lab: "Current streak", cls: "" },
    { val: (mins / 60).toFixed(1) + "h", lab: "Watched", cls: "" }
  ];
  document.getElementById("tiles")!.innerHTML = tiles.map((t) =>
    `<div class="tile"><div class="val ${t.cls}">${t.val}</div><div class="lab">${t.lab}</div></div>`).join("");
}

function renderTime(stats: Stats): void {
  const host = document.getElementById("chart-time")!;
  const daily = stats.daily || {};
  const keys = Object.keys(daily).sort();
  const W = 640, H = 220, ml = 40, mr = 12, mt = 12, mb = 26;
  if (keys.length < 2) { host.innerHTML = '<p class="cap-note">Not enough days yet — come back after a few sessions.</p>'; return; }
  let cum = 0;
  const pts = keys.map((k) => { cum += daily[k].met || 0; return { k, y: cum }; });
  const maxY = Math.max(1, cum);
  const x = (i: number) => ml + (i / (pts.length - 1)) * (W - ml - mr);
  const y = (val: number) => mt + (1 - val / maxY) * (H - mt - mb);
  const s = svg(W, H);

  // gridlines + y ticks
  const ticks = 4;
  for (let i = 0; i <= ticks; i++) {
    const val = Math.round((maxY / ticks) * i);
    const yy = y(val);
    s.appendChild(el("line", { x1: ml, y1: yy, x2: W - mr, y2: yy, class: "gridline" }));
    s.appendChild(txt(ml - 6, yy + 3, nf(val), "ax-val", "end"));
  }
  // area + line
  let d = `M ${x(0)} ${y(pts[0].y)}`;
  pts.forEach((p, i) => { if (i) d += ` L ${x(i)} ${y(p.y)}`; });
  const area = d + ` L ${x(pts.length - 1)} ${y(0)} L ${x(0)} ${y(0)} Z`;
  const grad = el("linearGradient", { id: "areaGrad", x1: 0, y1: 0, x2: 0, y2: 1 }, [
    el("stop", { offset: "0%", "stop-color": COL.accent, "stop-opacity": ".35" }),
    el("stop", { offset: "100%", "stop-color": COL.accent, "stop-opacity": "0" })
  ]);
  s.appendChild(el("defs", {}, [grad]));
  s.appendChild(el("path", { d: area, fill: "url(#areaGrad)" }));
  s.appendChild(el("path", { d, fill: "none", stroke: COL.accent, "stroke-width": 2, "stroke-linejoin": "round" }));

  // x labels (first, mid, last)
  [0, Math.floor(pts.length / 2), pts.length - 1].forEach((i) => {
    const lab = pts[i].k.slice(5); // MM-DD
    s.appendChild(txt(x(i), H - 8, lab, "ax", i === 0 ? "start" : i === pts.length - 1 ? "end" : "middle"));
  });

  // hover crosshair
  const hoverLine = el("line", { y1: mt, y2: H - mb, class: "baseline", opacity: 0 });
  const hoverDot = el("circle", { r: 4, fill: COL.accent, stroke: COL.grid, "stroke-width": 2, opacity: 0 });
  s.appendChild(hoverLine); s.appendChild(hoverDot);
  const hit = el("rect", { x: ml, y: mt, width: W - ml - mr, height: H - mt - mb, fill: "transparent" });
  s.appendChild(hit);
  hit.addEventListener("mousemove", (ev) => {
    const r = s.getBoundingClientRect();
    const px = ((ev as MouseEvent).clientX - r.left) / r.width * W;
    let i = Math.round((px - ml) / (W - ml - mr) * (pts.length - 1));
    i = Math.max(0, Math.min(pts.length - 1, i));
    hoverLine.setAttribute("x1", String(x(i))); hoverLine.setAttribute("x2", String(x(i))); hoverLine.setAttribute("opacity", "1");
    hoverDot.setAttribute("cx", String(x(i))); hoverDot.setAttribute("cy", String(y(pts[i].y))); hoverDot.setAttribute("opacity", "1");
    showTip(`<b>${nf(pts[i].y)}</b> words by ${pts[i].k}`, ev as MouseEvent);
  });
  hit.addEventListener("mouseleave", () => { hideTip(); hoverLine.setAttribute("opacity", "0"); hoverDot.setAttribute("opacity", "0"); });
  host.innerHTML = ""; host.appendChild(s);
}

function renderDonut(vocab: VocabMap): void {
  const host = document.getElementById("chart-donut")!;
  const v = Object.values(vocab);
  const segs = [
    { key: "known", lab: "Known", color: COL.known, n: v.filter((r) => r.state === "known").length },
    { key: "learning", lab: "Learning", color: COL.learning, n: v.filter((r) => r.state === "learning").length },
    { key: "new", lab: "Seen", color: COL.new, n: v.filter((r) => r.state === "new").length },
    { key: "ignored", lab: "Ignored", color: COL.ignored, n: v.filter((r) => r.state === "ignored").length }
  ].filter((seg) => seg.n > 0);
  const total = segs.reduce((a, seg) => a + seg.n, 0);
  const R = 74, r = 46, cx = 90, cy = 90;
  const s = svg(180, 180);
  if (!total) { host.innerHTML = '<p class="cap-note">No words yet.</p>'; return; }
  let a0 = -Math.PI / 2;
  segs.forEach((seg) => {
    const frac = seg.n / total;
    const a1 = a0 + frac * Math.PI * 2;
    const large = frac > 0.5 ? 1 : 0;
    const p = (ang: number, rad: number) => [cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad];
    const [x0, y0] = p(a0, R), [x1, y1] = p(a1, R), [x2, y2] = p(a1, r), [x3, y3] = p(a0, r);
    const path = el("path", {
      d: `M ${x0} ${y0} A ${R} ${R} 0 ${large} 1 ${x1} ${y1} L ${x2} ${y2} A ${r} ${r} 0 ${large} 0 ${x3} ${y3} Z`,
      fill: seg.color, stroke: C("--card"), "stroke-width": 2
    });
    path.addEventListener("mousemove", (ev) => showTip(`<b>${seg.lab}</b>: ${nf(seg.n)} (${Math.round(frac * 100)}%)`, ev as MouseEvent));
    path.addEventListener("mouseleave", hideTip);
    s.appendChild(path);
    a0 = a1;
  });
  s.appendChild(txt(cx, cy - 4, nf(total), "dlabel", "middle"));
  s.appendChild(txt(cx, cy + 12, "words", "ax", "middle"));
  const legend = document.createElement("ul");
  legend.className = "legend";
  legend.innerHTML = segs.map((seg) =>
    `<li><span class="sw" style="background:${seg.color}"></span>${seg.lab} <b>${nf(seg.n)}</b></li>`).join("");
  host.innerHTML = ""; host.appendChild(s); host.appendChild(legend);
}

function renderLevel(vocab: VocabMap): void {
  const host = document.getElementById("chart-level")!;
  // N5..N1  (stored level 5..1 → N = level)
  const levels = [5, 4, 3, 2, 1];
  const data = levels.map((lv) => {
    const words = Object.values(vocab).filter((r) => r.level === lv);
    return {
      n: "N" + lv,
      known: words.filter((r) => r.state === "known").length,
      learning: words.filter((r) => r.state === "learning").length
    };
  });
  const maxV = Math.max(1, ...data.map((d) => d.known + d.learning));
  const W = 320, H = 220, ml = 32, mr = 10, mt = 10, mb = 28;
  const bw = (W - ml - mr) / data.length;
  const y = (val: number) => mt + (1 - val / maxV) * (H - mt - mb);
  const s = svg(W, H);
  for (let i = 0; i <= 4; i++) {
    const val = Math.round(maxV / 4 * i), yy = y(val);
    s.appendChild(el("line", { x1: ml, y1: yy, x2: W - mr, y2: yy, class: "gridline" }));
    s.appendChild(txt(ml - 6, yy + 3, nf(val), "ax-val", "end"));
  }
  const base = H - mb;
  data.forEach((d, i) => {
    const cx = ml + i * bw + bw / 2, w = Math.min(34, bw - 12);
    let yTop = base;
    ([["learning", d.learning, COL.learning], ["known", d.known, COL.known]] as [string, number, string][]).forEach(([k, val, col]) => {
      if (!val) return;
      const h = (val / maxV) * (H - mt - mb);
      const yy = yTop - h;
      const rect = el("rect", { x: cx - w / 2, y: yy, width: w, height: Math.max(0, h - 2), rx: 3, fill: col });
      rect.addEventListener("mousemove", (ev) => showTip(`<b>${d.n}</b> ${k}: ${nf(val)}`, ev as MouseEvent));
      rect.addEventListener("mouseleave", hideTip);
      s.appendChild(rect);
      yTop = yy;
    });
    s.appendChild(txt(cx, H - 9, d.n, "ax", "middle"));
  });
  s.appendChild(el("line", { x1: ml, y1: base, x2: W - mr, y2: base, class: "baseline" }));
  const legend = document.createElement("ul");
  legend.className = "legend";
  legend.style.gridAutoFlow = "column";
  legend.style.justifyContent = "center";
  legend.style.marginTop = "8px";
  legend.innerHTML = `<li><span class="sw" style="background:${COL.known}"></span>Known</li><li><span class="sw" style="background:${COL.learning}"></span>Learning</li>`;
  host.innerHTML = ""; host.appendChild(s); host.appendChild(legend);
}

function renderSRS(vocab: VocabMap): void {
  const host = document.getElementById("chart-srs")!;
  const now = Date.now();
  const learning = Object.values(vocab).filter((r) => r.state === "learning" && r.srs);
  const stages = [1, 2, 3, 4, 5].map((st) => ({
    st, label: "Stage " + st,
    n: learning.filter((r) => r.srs!.stage === st).length,
    due: learning.filter((r) => r.srs!.stage === st && r.srs!.dueAt <= now).length
  }));
  const maxV = Math.max(1, ...stages.map((st) => st.n));
  const W = 320, H = 220, ml = 32, mr = 10, mt = 10, mb = 28;
  const bw = (W - ml - mr) / stages.length;
  const y = (val: number) => mt + (1 - val / maxV) * (H - mt - mb);
  const base = H - mb;
  const s = svg(W, H);
  for (let i = 0; i <= 4; i++) {
    const val = Math.round(maxV / 4 * i), yy = y(val);
    s.appendChild(el("line", { x1: ml, y1: yy, x2: W - mr, y2: yy, class: "gridline" }));
    s.appendChild(txt(ml - 6, yy + 3, nf(val), "ax-val", "end"));
  }
  stages.forEach((st, i) => {
    const cx = ml + i * bw + bw / 2, w = Math.min(34, bw - 12);
    const h = (st.n / maxV) * (H - mt - mb);
    const col = COL.seq[Math.min(5, st.st)]; // deeper = later stage
    const rect = el("rect", { x: cx - w / 2, y: base - h, width: w, height: Math.max(0, h), rx: 3, fill: col });
    rect.addEventListener("mousemove", (ev) => showTip(`<b>Stage ${st.st}</b>: ${nf(st.n)} words${st.due ? ` · ${st.due} due now` : ""}`, ev as MouseEvent));
    rect.addEventListener("mouseleave", hideTip);
    s.appendChild(rect);
    if (st.n) s.appendChild(txt(cx, base - h - 5, nf(st.n), "dlabel", "middle"));
    s.appendChild(txt(cx, H - 9, String(st.st), "ax", "middle"));
  });
  s.appendChild(el("line", { x1: ml, y1: base, x2: W - mr, y2: base, class: "baseline" }));
  const dueTotal = stages.reduce((a, st) => a + st.due, 0);
  host.innerHTML = "";
  if (!learning.length) { host.innerHTML = '<p class="cap-note">Mark words "Learn it" to build your review pipeline.</p>'; return; }
  host.appendChild(s);
  const note = document.createElement("p");
  note.className = "cap-note";
  note.style.textAlign = "center";
  note.textContent = dueTotal ? `${dueTotal} word${dueTotal > 1 ? "s" : ""} due for review — use Review above, or they'll also surface as you watch.` : "Nothing due right now.";
  host.appendChild(note);
}

function renderCalendar(stats: Stats): void {
  const host = document.getElementById("chart-cal")!;
  const daily = stats.daily || {};
  const WEEKS = 18, cell = 15, gap = 4, W = WEEKS * (cell + gap) + 30, H = 7 * (cell + gap) + 24;
  const s = svg(W, H);
  const end = new Date(todayKey() + "T12:00:00");
  // align to end of current week (Sat)
  const start = new Date(end.getTime() - (WEEKS * 7 - 1) * 864e5);
  start.setDate(start.getDate() - start.getDay());
  let max = 1;
  Object.values(daily).forEach((d) => { if (d.judged > max) max = d.judged; });
  const shade = (n: number): string => {
    if (!n) return C("--surface");
    const idx = Math.min(COL.seq.length - 1, 1 + Math.floor((n / max) * (COL.seq.length - 2)));
    return COL.seq[idx];
  };
  const dayLabels = ["", "Mon", "", "Wed", "", "Fri", ""];
  dayLabels.forEach((l, i) => { if (l) s.appendChild(txt(0, 24 + i * (cell + gap) + cell - 3, l, "ax", "start")); });
  const cur = new Date(start);
  let col = 0, lastMonth = -1, lastLabelX = -100;
  while (cur <= end) {
    const wx = 30 + col * (cell + gap);
    for (let dow = 0; dow < 7; dow++) {
      if (cur > end) break;
      const key = cur.toLocaleDateString("sv");
      const d = daily[key];
      const n = d ? d.judged : 0;
      const y = 24 + dow * (cell + gap);
      const rect = el("rect", { x: wx, y, width: cell, height: cell, rx: 3, fill: shade(n) });
      if (d) {
        rect.addEventListener("mousemove", (ev) => showTip(`<b>${key}</b><br>${n} judged · ${d.met || 0} new · ${d.reviews || 0} reviews`, ev as MouseEvent));
        rect.addEventListener("mouseleave", hideTip);
      }
      s.appendChild(rect);
      const m = cur.getMonth();
      if (dow === 0 && m !== lastMonth && wx - lastLabelX >= 28) {
        s.appendChild(txt(wx, 14, cur.toLocaleString("en", { month: "short" }), "ax", "start"));
        lastMonth = m; lastLabelX = wx;
      }
      cur.setDate(cur.getDate() + 1);
    }
    col++;
  }
  host.innerHTML = ""; host.appendChild(s);
}

// ---------- word list ----------
let VOCAB: VocabMap = {};
let listFilter = "active";
let listQuery = "";

function relDue(dueAt: number): string {
  if (!dueAt) return "—";
  const diff = dueAt - Date.now();
  if (diff <= 0) return "now";
  const h = Math.round(diff / 36e5);
  return h < 24 ? `in ${h}h` : `in ${Math.round(diff / 864e5)}d`;
}

function renderList(): void {
  const tbody = document.getElementById("word-tbody")!;
  let rows = Object.entries(VOCAB);
  if (listFilter === "active") rows = rows.filter(([, r]) => r.state === "known" || r.state === "learning");
  else if (listFilter !== "all") rows = rows.filter(([, r]) => r.state === listFilter);
  if (listQuery) {
    const q = listQuery.toLowerCase();
    rows = rows.filter(([w, r]) =>
      toRomaji(r.reading || "").includes(q) || w.toLowerCase().includes(q) ||
      (r.reading || "").includes(q) || (r.gloss || "").toLowerCase().includes(q));
  }
  rows.sort((a, b) => (b[1].lastSeenAt || 0) - (a[1].lastSeenAt || 0));
  const total = rows.length, shown = rows.slice(0, 300);
  document.getElementById("list-note")!.textContent =
    total > 300 ? `Showing 300 of ${total}` : `${total} word${total === 1 ? "" : "s"}`;
  tbody.innerHTML = shown.map(([w, r]) => {
    const romaji = toRomaji(r.reading || "");
    const due = r.state === "learning" && r.srs ? relDue(r.srs.dueAt) : "—";
    return `<tr>
      <td class="romaji">${romaji || w}</td>
      <td class="jp">${r.reading || ""}</td>
      <td class="jp">${w}</td>
      <td class="meaning">${r.gloss || ""}</td>
      <td>N${r.level}</td>
      <td>${r.seenCount || 0}</td>
      <td><span class="state-tag ${r.state}">${r.state}</span></td>
      <td>${due}</td></tr>`;
  }).join("");
}

// ---------- review session ----------
// A standalone review: surfaces due words directly instead of waiting for one to
// reappear on screen. Reveal the answer, then grade Got it / Missed it.

// Escape page-sourced text (subtitle lines, video titles) before it's injected
// into this privileged extension page. A caption like `<img src=evil>` must not
// render here.
function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

function renderReview(vocab: VocabMap): void {
  const host = document.getElementById("review") as HTMLElement;
  const due = getDueWords(vocab);
  if (!due.length) { host.hidden = true; return; }
  host.hidden = false;
  // Deep-linked from the popup's "Review N due" button — start immediately.
  if (location.hash === "#review") { runReviewSession(host, due); return; }
  host.innerHTML =
    `<div class="review-intro"><h2>Review</h2>` +
    `<p>${due.length} word${due.length > 1 ? "s" : ""} due now.</p>` +
    `<button class="review-btn review-start" id="review-start" type="button">Start review</button></div>`;

  document.getElementById("review-start")!.addEventListener("click", () => runReviewSession(host, due));
}

function runReviewSession(host: HTMLElement, due: ReturnType<typeof getDueWords>): void {
  let i = 0;
  let reviewed = 0;

  const showCard = (): void => {
    if (i >= due.length) {
      host.innerHTML = `<div class="review-intro"><h2>Review complete</h2><p>${reviewed} reviewed. Nice work.</p></div>`;
      // SRS/tiles are now stale — reload to reflect the new schedule.
      setTimeout(() => location.reload(), 900);
      return;
    }
    const { base, record } = due[i];
    const romaji = record.reading ? toRomaji(record.reading) : "";
    host.innerHTML =
      `<div class="review-session">` +
      `<p class="review-progress">${i + 1} / ${due.length}</p>` +
      `<div class="review-word">${esc(base)}</div>` +
      `<div class="review-answer" id="review-answer" hidden>` +
        `<div class="review-reading">${esc(record.reading || "")}${romaji ? ` · ${esc(romaji)}` : ""}</div>` +
        `<div class="review-gloss">${esc(record.gloss || "")}</div>` +
        (record.source?.line ? `<div class="review-source">${esc(record.source.line)}${record.source.title ? ` — ${esc(record.source.title)}` : ""}</div>` : "") +
      `</div>` +
      `<div class="review-controls">` +
        `<button class="review-btn" id="review-show" type="button">Show answer</button>` +
        `<span id="review-grade" hidden>` +
          `<button class="review-btn review-fail" id="review-miss" type="button">Missed it</button>` +
          `<button class="review-btn review-pass" id="review-got" type="button">Got it</button>` +
        `</span>` +
      `</div></div>`;

    document.getElementById("review-show")!.addEventListener("click", () => {
      document.getElementById("review-answer")!.hidden = false;
      document.getElementById("review-show")!.setAttribute("hidden", "");
      document.getElementById("review-grade")!.hidden = false;
    });

    let graded = false;
    const grade = async (judgment: "review-pass" | "review-fail"): Promise<void> => {
      if (graded) return; // guard against double-click / key-repeat double-grading
      graded = true;
      (document.getElementById("review-got") as HTMLButtonElement | null)?.setAttribute("disabled", "");
      (document.getElementById("review-miss") as HTMLButtonElement | null)?.setAttribute("disabled", "");
      await storage.judgeWord(base, judgment, {
        reading: record.reading,
        gloss: record.gloss,
        level: record.level,
        freqRank: record.freqRank
      });
      reviewed++;
      i++;
      showCard();
    };
    document.getElementById("review-got")!.addEventListener("click", () => void grade("review-pass"));
    document.getElementById("review-miss")!.addEventListener("click", () => void grade("review-fail"));
  };

  showCard();
}

// ---------- boot ----------
async function boot(): Promise<void> {
  const vocab = await storage.getVocab();
  const stats = await storage.getStats();
  VOCAB = vocab;
  if (!Object.keys(vocab).length) {
    document.getElementById("empty")!.hidden = false;
  }
  renderReview(vocab);
  renderTiles(vocab, stats);
  renderTime(stats);
  renderDonut(vocab);
  renderLevel(vocab);
  renderSRS(vocab);
  renderCalendar(stats);
  renderList();

  document.getElementById("word-search")!.addEventListener("input", (e) => {
    listQuery = (e.target as HTMLInputElement).value.trim();
    renderList();
  });
  document.querySelectorAll<HTMLButtonElement>("#list-chips .chip").forEach((c) => c.addEventListener("click", () => {
    document.querySelectorAll("#list-chips .chip").forEach((x) => x.classList.remove("active"));
    c.classList.add("active");
    listFilter = c.dataset.f!;
    renderList();
  }));
}
document.addEventListener("DOMContentLoaded", boot);
