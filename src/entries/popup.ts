import { WEB_URL } from "../config";
import * as storage from "../lib/storage";
import { toRomaji } from "../lib/romaji";
import { dueCount } from "../lib/review";
import type { WordState } from "../types";

type Theme = "dark" | "light";

function todayKey(): string {
  return new Date().toLocaleDateString("sv");
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

function byId<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
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
    .slice(0, 5);

  const list = byId<HTMLUListElement>("recent-list");
  const empty = byId("recent-empty");
  list.innerHTML = "";

  if (!recent.length) {
    empty.hidden = false;
  } else {
    empty.hidden = true;
    for (const [word, rec] of recent) {
      const romaji = toRomaji(rec.reading || "");
      const li = document.createElement("li");
      li.innerHTML =
        `<span class="word">${esc(romaji || word)}</span>` +
        `<span class="reading">${esc(rec.gloss || rec.reading || word)}</span>` +
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
