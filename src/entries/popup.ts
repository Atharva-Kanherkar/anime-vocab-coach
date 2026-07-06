import { WEB_URL } from "../config";
import * as storage from "../lib/storage";
import { toRomaji } from "../lib/romaji";
import { dueCount } from "../lib/review";
import type { DailyStats, VocabMap, VocabRecord, WordState } from "../types";

type Theme = "dark" | "light";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const SAMPLE_TICKER = [
  "約束　やくそく　A PROMISE",
  "仲間　なかま　COMRADE",
  "未来　みらい　FUTURE",
  "戦う　たたかう　TO FIGHT",
];

function todayKey(): string {
  return new Date().toLocaleDateString("sv");
}

function computeStreak(daily: Record<string, DailyStats>): number {
  const days = Object.keys(daily || {})
    .filter((d) => daily[d].judged >= 1 || daily[d].reviews >= 1 || daily[d].watchMin > 0)
    .sort()
    .reverse();

  if (!days.length) return 0;

  const today = todayKey();
  const yesterday = new Date(Date.now() - 86400000).toLocaleDateString("sv");

  if (days[0] !== today && days[0] !== yesterday) return 0;

  let streak = 0;
  let expect = days[0] === today ? today : yesterday;

  for (const day of days) {
    if (day !== expect) break;
    streak += 1;
    const prev = new Date(new Date(expect + "T12:00:00").getTime() - 86400000);
    expect = prev.toLocaleDateString("sv");
  }

  return streak;
}

function countByState(vocab: VocabMap) {
  let known = 0;
  let learning = 0;
  let seen = 0;
  for (const rec of Object.values(vocab)) {
    if (rec.state === "known") known += 1;
    else if (rec.state === "learning") learning += 1;
    else if (rec.state === "new") seen += 1;
  }
  return { known, learning, seen };
}

function weekStamps(daily: Record<string, DailyStats>) {
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const byDay = new Map(Object.entries(daily || {}));

  return DAY_LABELS.map((label, i) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    const key = date.toLocaleDateString("sv");
    const stats = byDay.get(key);
    const hit = !!stats && (stats.judged > 0 || stats.reviews > 0 || stats.watchMin > 0);
    const isToday = date.toDateString() === now.toDateString();
    return { label, hit, isToday };
  });
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

function byId<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

function renderTicker(recent: [string, VocabRecord][]): void {
  const items =
    recent.length >= 3
      ? recent.slice(0, 8).map(([word, rec]) => {
          const bits = [word, rec.reading, rec.gloss ? rec.gloss.toUpperCase() : ""].filter(Boolean);
          return bits.join("　");
        })
      : SAMPLE_TICKER;
  const reel = [...items, ...items, ...items].join("　／　");
  byId("ticker-text").textContent = reel;
}

function renderHero(hero: [string, VocabRecord] | null): void {
  const section = byId("hero-section");
  const bubble = byId("hero-bubble");
  if (!hero) {
    section.hidden = true;
    return;
  }
  const [word, rec] = hero;
  const kicker = rec.source?.title ? `FROM ${rec.source.title.toUpperCase()}` : "FRESHLY CAUGHT";
  const meta = [rec.reading, rec.gloss].filter(Boolean).join(" — ");
  const line = rec.source?.line
    ? `${rec.source.line}${rec.source.en ? ` — "${rec.source.en}"` : ""}`
    : "";

  bubble.innerHTML =
    `<p class="av-bubble-kicker">${esc(kicker)}</p>` +
    `<p class="av-bubble-word">${esc(word)}</p>` +
    (meta ? `<p class="av-bubble-meta">${esc(meta)}</p>` : "") +
    (line ? `<p class="av-bubble-line">${esc(line)}</p>` : "");
  section.hidden = false;
}

function renderStampRally(daily: Record<string, DailyStats>): void {
  const week = weekStamps(daily);
  const today = week.find((d) => d.isToday);
  const todayHit = today?.hit;
  const todayLabel = today?.label ?? "today";

  const grid = week
    .map(
      (d) =>
        `<div class="${d.hit ? "av-stamp av-stamp-hit" : "av-stamp"}">${d.hit ? "済" : esc(d.label)}</div>`
    )
    .join("");

  const note = todayHit
    ? `<b>${esc(todayLabel)} is stamped.</b> Come back tomorrow to keep the rally alive.`
    : `Practice today to stamp <b>${esc(todayLabel)}</b>. A full card is a new personal best.`;

  byId("stamp-rally").innerHTML =
    `<div class="av-stamp-head"><span>STAMP RALLY</span><span class="av-stamp-head-jp">スタンプラリー</span></div>` +
    `<div class="av-stamp-grid">${grid}</div>` +
    `<p class="av-stamp-note">${note}</p>`;
}

function renderWelcome(totalWords: number, due: number, streak: number): void {
  const sub = byId("welcome-sub");
  if (totalWords <= 0) {
    sub.textContent = "Your words from last night's episode will land here.";
    return;
  }
  sub.innerHTML =
    `<b>${due}</b> ${due === 1 ? "word is" : "words are"} waiting for review · day ` +
    `<b>${Math.max(streak, 0)}</b> of your rally · ${totalWords.toLocaleString()} collected`;
}

function initTheme(): void {
  const btn = byId<HTMLButtonElement>("theme-toggle");
  const icon = document.getElementById("theme-icon");

  const apply = (theme: Theme): void => {
    document.documentElement.setAttribute("data-theme", theme);
    if (!icon) return;
    if (theme === "dark") {
      icon.innerHTML =
        '<circle cx="12" cy="12" r="4"></circle>' +
        '<path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4"></path>';
      btn.setAttribute("aria-label", "Switch to light mode");
      btn.title = "Switch to light mode";
    } else {
      icon.innerHTML = '<path d="M20 13.5A8 8 0 0 1 10.5 4 8 8 0 1 0 20 13.5z"></path>';
      btn.setAttribute("aria-label", "Switch to dark mode");
      btn.title = "Switch to dark mode";
    }
  };

  const current = document.documentElement.getAttribute("data-theme");
  apply(current === "light" ? "light" : "dark");

  btn.addEventListener("click", () => {
    const next: Theme = document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light";
    apply(next);
    try {
      localStorage.setItem("av-theme", next);
    } catch {
      /* private mode */
    }
  });
}

async function render(): Promise<void> {
  const vocab = await storage.getVocab();
  const stats = await storage.getStats();
  const day = todayKey();
  const daily = stats.daily?.[day] || { met: 0, judged: 0, reviews: 0, watchMin: 0 };

  byId("stat-met").textContent = String(daily.met);
  byId("stat-judged").textContent = String(daily.judged);
  byId("stat-reviews").textContent = String(daily.reviews);
  byId("stat-watch").textContent = String(daily.watchMin);

  const totals = countByState(vocab);
  const totalWords = Object.keys(vocab).length;
  byId("totals-row").innerHTML =
    `<span><span class="t-known">${totals.known}</span> known</span>` +
    `<span><span class="t-learning">${totals.learning}</span> learning</span>` +
    `<span><span class="t-num">${totals.seen}</span> seen</span>`;

  const streak = computeStreak(stats.daily);
  byId("streak").innerHTML = streak > 0 ? `<b>${streak}-day</b> streak` : "No streak yet";

  const due = dueCount(vocab);
  renderWelcome(totalWords, due, streak);
  renderStampRally(stats.daily || {});

  const reviewBtn = byId<HTMLButtonElement>("review-due");
  if (due > 0) {
    reviewBtn.hidden = false;
    reviewBtn.textContent = `Review ${due} due word${due > 1 ? "s" : ""}`;
  } else {
    reviewBtn.hidden = true;
  }

  const recent = Object.entries(vocab)
    .sort((a, b) => (b[1].lastSeenAt || 0) - (a[1].lastSeenAt || 0))
    .slice(0, 10);

  renderTicker(recent);
  renderHero(recent[0] ?? null);

  const list = byId<HTMLUListElement>("recent-list");
  const empty = byId("recent-empty");
  list.innerHTML = "";

  if (!recent.length) {
    empty.hidden = false;
  } else {
    empty.hidden = true;
    for (const [word, rec] of recent.slice(0, 8)) {
      const romaji = toRomaji(rec.reading || "");
      const li = document.createElement("li");
      li.innerHTML =
        `<span class="word">${esc(romaji || word)}</span>` +
        `<span class="reading">${esc(word)} · ${esc(rec.gloss || rec.reading || "")}</span>` +
        `<select data-word="${esc(word)}">` +
        `<option value="new" ${rec.state === "new" ? "selected" : ""}>new</option>` +
        `<option value="learning" ${rec.state === "learning" ? "selected" : ""}>learning</option>` +
        `<option value="known" ${rec.state === "known" ? "selected" : ""}>known</option>` +
        `<option value="ignored" ${rec.state === "ignored" ? "selected" : ""}>ignored</option>` +
        `</select>`;
      list.appendChild(li);
    }
  }

  list.querySelectorAll("select").forEach((sel) => {
    sel.addEventListener("change", async (e) => {
      const target = e.target as HTMLSelectElement;
      await storage.setWordState(target.dataset.word!, target.value as WordState);
      void render();
    });
  });

  byId("mode-note").textContent = "This tab";
}

async function activeTabId(): Promise<number | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id ?? null;
}

async function initListening(): Promise<void> {
  const btn = byId<HTMLButtonElement>("listen-btn");
  const errEl = byId<HTMLParagraphElement>("listen-error");
  const tabId = await activeTabId();
  if (tabId == null) return;

  const setUi = (listening: boolean) => {
    btn.classList.toggle("active", listening);
    btn.textContent = listening ? "Stop Listening Mode" : "Start Listening Mode";
  };

  chrome.runtime.sendMessage({ type: "avc-listen-status", tabId }, (res) => {
    setUi(!!res?.listening);
  });

  btn.addEventListener("click", () => {
    errEl.hidden = true;
    const starting = !btn.classList.contains("active");
    const type = starting ? "avc-listen-start" : "avc-listen-stop";
    chrome.runtime.sendMessage({ type, tabId }, (res) => {
      if (res?.ok) {
        setUi(starting);
      } else {
        errEl.textContent = res?.error || "Failed to toggle listening mode.";
        errEl.hidden = false;
      }
    });
  });
}

async function initCopilotToggle(): Promise<void> {
  const btn = byId<HTMLButtonElement>("copilot-btn");
  const tabId = await activeTabId();
  if (tabId == null) {
    btn.disabled = true;
    btn.textContent = "Open Copilot (no active tab)";
    return;
  }

  const refresh = (): void => {
    chrome.runtime.sendMessage({ type: "avc-agent-status", tabId }, (res) => {
      const on = !!res?.visible;
      btn.textContent = on ? "Hide Copilot on this tab" : "Open Copilot on this tab";
      btn.classList.toggle("active", on);
    });
  };

  btn.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "avc-agent-status", tabId }, (res) => {
      const type = res?.visible ? "avc-agent-hide" : "avc-agent-show";
      chrome.runtime.sendMessage({ type, tabId }, () => refresh());
    });
  });

  refresh();
}

document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  void render();
  void initListening();
  void initCopilotToggle();

  byId("cloud-link").addEventListener("click", (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: `${WEB_URL}/app` });
  });

  byId("dashboard-link").addEventListener("click", (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: chrome.runtime.getURL("dashboard/dashboard.html") });
  });

  byId("review-due").addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("dashboard/dashboard.html#review") });
  });

  byId("settings-link").addEventListener("click", (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });

  byId("export-link").addEventListener("click", async (e) => {
    e.preventDefault();
    const data = await storage.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `animevocab-export-${todayKey()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });
});
