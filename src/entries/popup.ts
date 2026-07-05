import * as storage from "../lib/storage";
import { toRomaji } from "../lib/romaji";
import { dueCount } from "../lib/review";
import type { DailyStats, VocabMap, WordState } from "../types";

function todayKey(): string {
  return new Date().toLocaleDateString("sv");
}

function computeStreak(daily: Record<string, DailyStats>): number {
  const days = Object.keys(daily || {})
    .filter((d) => daily[d].judged >= 1)
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

function byId<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
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
  byId("totals-row").innerHTML =
    `<span><span class="t-known">${totals.known}</span> known</span>` +
    `<span><span class="t-learning">${totals.learning}</span> learning</span>` +
    `<span><span class="t-num">${totals.seen}</span> seen</span>`;

  const streak = computeStreak(stats.daily);
  byId("streak").innerHTML = streak > 0 ? `<b>${streak}-day</b> streak` : "No streak yet";

  // Surface due reviews with a one-click path into the review session.
  const due = dueCount(vocab);
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

  const list = byId<HTMLUListElement>("recent-list");
  list.innerHTML = "";

  for (const [word, rec] of recent) {
    const romaji = toRomaji(rec.reading || "");
    const li = document.createElement("li");
    li.innerHTML = `
      <span class="word">${romaji || word}</span>
      <span class="reading">${word} · ${rec.gloss || rec.reading || ""}</span>
      <select data-word="${word}">
        <option value="new" ${rec.state === "new" ? "selected" : ""}>new</option>
        <option value="learning" ${rec.state === "learning" ? "selected" : ""}>learning</option>
        <option value="known" ${rec.state === "known" ? "selected" : ""}>known</option>
        <option value="ignored" ${rec.state === "ignored" ? "selected" : ""}>ignored</option>
      </select>
    `;
    list.appendChild(li);
  }

  list.querySelectorAll("select").forEach((sel) => {
    sel.addEventListener("change", async (e) => {
      const target = e.target as HTMLSelectElement;
      await storage.setWordState(target.dataset.word!, target.value as WordState);
    });
  });

  byId("mode-note").textContent = "This tab only";
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
  render();
  initListening();
  void initCopilotToggle();

  byId("dashboard-link").addEventListener("click", (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: chrome.runtime.getURL("dashboard/dashboard.html") });
  });

  byId("review-due").addEventListener("click", () => {
    // The review session lives on the dashboard; the #review hash makes
    // renderReview start the session immediately on load.
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
