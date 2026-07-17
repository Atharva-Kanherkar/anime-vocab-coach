import { WEB_URL } from "../config";
import * as storage from "../lib/storage";
import { dueCount } from "../lib/review";
import { mountReviewPrompt } from "../lib/review-prompt-ui";
import type { DailyStats } from "../types";

type Theme = "dark" | "light";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function todayKey(): string {
  return new Date().toLocaleDateString("sv");
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

function byId<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
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
    ? `<b>${esc(todayLabel)} is stamped.</b> Come back tomorrow.`
    : `Practice today to stamp <b>${esc(todayLabel)}</b>.`;

  byId("stamp-rally").innerHTML =
    `<div class="av-stamp-head"><span>STAMP RALLY</span><span class="av-stamp-head-jp">スタンプ</span></div>` +
    `<div class="av-stamp-grid">${grid}</div>` +
    `<p class="av-stamp-note">${note}</p>`;
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

// Account status. The extension never has its own login: signing in on
// animevocab.com/app hands a sync token to the extension. This section is
// what tells the user that — and whether it has happened.
async function renderAccount(): Promise<void> {
  const el = byId("account");
  const token = await storage.getSyncToken();

  if (!token) {
    // Distinguish "never linked" from "was linked but repeated 401s signed us
    // out" so an expired session reads as recoverable, not a fresh setup.
    const relink = await storage.getRelinkNeeded();
    const title = relink ? "Sign-in expired" : "Not signed in";
    const sub = relink ? "Re-link to resume cloud sync" : "Progress stays on this device only";
    const cta = relink ? "Re-link — animevocab.com" : "Sign in to sync — animevocab.com";
    const dot = relink ? "av-dot av-dot-warn" : "av-dot av-dot-off";
    el.innerHTML =
      `<div class="av-account-row"><span class="${dot}"></span>` +
      `<div><b>${title}</b><span class="av-account-sub">${sub}</span></div></div>` +
      `<button id="signin-btn" class="av-btn av-btn-primary av-btn-block" type="button">${cta}</button>`;
    byId("signin-btn").addEventListener("click", () => {
      chrome.tabs.create({ url: `${WEB_URL}/app` });
    });
    return;
  }

  const profile = await storage.getSyncProfile();
  const who = profile?.email || profile?.name || "your account";
  el.innerHTML =
    `<div class="av-account-row"><span class="av-dot"></span>` +
    `<div><b>Cloud sync on</b><span class="av-account-sub">Synced as ${esc(who)}</span></div></div>`;
}

async function render(): Promise<void> {
  const vocab = await storage.getVocab();
  const stats = await storage.getStats();
  const due = dueCount(vocab);

  renderStampRally(stats.daily || {});

  const reviewBtn = byId<HTMLButtonElement>("review-due");
  if (due > 0) {
    reviewBtn.hidden = false;
    reviewBtn.textContent = `Review ${due} due word${due > 1 ? "s" : ""}`;
  } else {
    reviewBtn.hidden = true;
  }

  // Idle surface only — popup never mounts on a playing video.
  await mountReviewPrompt({ host: byId("review-prompt"), variant: "popup" });
}

async function activeTabId(): Promise<number | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id ?? null;
}

// One control for both: opening the copilot also starts Listening Mode for the
// tab (background couples them), so there is no separate Listening button.
async function initCopilotToggle(): Promise<void> {
  const btn = byId<HTMLButtonElement>("copilot-btn");
  const errEl = byId<HTMLParagraphElement>("listen-error");
  const tabId = await activeTabId();
  if (tabId == null) {
    btn.disabled = true;
    btn.textContent = "Open Copilot (no active tab)";
    return;
  }

  const refresh = (): void => {
    chrome.runtime.sendMessage({ type: "avc-agent-status", tabId }, (res) => {
      const on = !!res?.visible;
      btn.textContent = on ? "Stop Copilot & Listening" : "Open Copilot on this tab";
      btn.classList.toggle("active", on);
    });
  };

  btn.addEventListener("click", () => {
    errEl.hidden = true;
    chrome.runtime.sendMessage({ type: "avc-agent-status", tabId }, (res) => {
      const type = res?.visible ? "avc-agent-hide" : "avc-agent-show";
      chrome.runtime.sendMessage({ type, tabId }, (r) => {
        if (r && r.ok === false && r.error) {
          errEl.textContent = r.error;
          errEl.hidden = false;
        }
        refresh();
      });
    });
  });

  refresh();
}

document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  void render();
  void renderAccount();
  void initCopilotToggle();

  // If the user signs in on animevocab.com while this popup is open, the
  // token lands in storage — flip the account section live.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && (changes.syncToken || changes.syncProfile || changes.relinkNeeded)) void renderAccount();
  });

  byId("cloud-link").addEventListener("click", (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: `${WEB_URL}/app` });
  });

  byId("review-due").addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("dashboard/dashboard.html#review") });
  });

  byId("settings-link").addEventListener("click", async (e) => {
    e.preventDefault();
    const token = await storage.getSyncToken();
    if (token) {
      chrome.tabs.create({ url: `${WEB_URL}/app#settings` });
    } else {
      chrome.runtime.openOptionsPage();
    }
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
