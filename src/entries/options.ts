import * as storage from "../lib/storage";
import { WEB_URL } from "../config";
import type { DisplayScript, PauseMode, Settings } from "../types";

type Theme = "dark" | "light";

function todayKey(): string {
  return new Date().toLocaleDateString("sv");
}

function byId<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

function showSaved(): void {
  const el = byId("saved-msg");
  el.hidden = false;
  setTimeout(() => { el.hidden = true; }, 1500);
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
    } else {
      icon.innerHTML = '<path d="M20 13.5A8 8 0 0 1 10.5 4 8 8 0 1 0 20 13.5z"></path>';
      btn.setAttribute("aria-label", "Switch to dark mode");
    }
  };

  apply(document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark");

  btn.addEventListener("click", () => {
    const next: Theme = document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light";
    apply(next);
    try { localStorage.setItem("av-theme", next); } catch { /* private mode */ }
  });
}

async function loadSettingsForm(): Promise<void> {
  const s = await storage.getSettings();

  document.querySelectorAll<HTMLInputElement>('input[name="pauseMode"]').forEach((el) => {
    el.checked = el.value === s.pauseMode;
  });
  byId<HTMLInputElement>("cooldownSec").value = String(s.cooldownSec);
  byId<HTMLInputElement>("maxCardsPerHour").value = String(s.maxCardsPerHour);
  byId<HTMLSelectElement>("targetLevel").value = String(s.targetLevel);
  byId<HTMLInputElement>("autoResumeSec").value = String(s.autoResumeSec);
  byId<HTMLInputElement>("site-youtube").checked = s.sites?.youtube !== false;
  byId<HTMLInputElement>("site-netflix").checked = s.sites?.netflix !== false;
  byId<HTMLInputElement>("site-generic").checked = s.sites?.generic !== false;
  byId<HTMLSelectElement>("displayScript").value = s.displayScript || "romaji";
  byId<HTMLInputElement>("autoSpeak").checked = s.autoSpeak !== false;
  byId<HTMLInputElement>("openaiKey").value = s.openaiKey || "";
  byId<HTMLSelectElement>("transcribeModel").value = s.transcribeModel || "gpt-4o-mini-transcribe";
}

async function savePartial(partial: Partial<Settings>): Promise<void> {
  await storage.setSettings(partial);
  showSaved();
}

document.addEventListener("DOMContentLoaded", async () => {
  const token = await storage.getSyncToken();
  if (token) {
    window.location.replace(`${WEB_URL}/app#settings`);
    return;
  }

  initTheme();
  await loadSettingsForm();

  document.querySelectorAll<HTMLInputElement>('input[name="pauseMode"]').forEach((el) => {
    el.addEventListener("change", () => savePartial({ pauseMode: el.value as PauseMode }));
  });

  byId("cooldownSec").addEventListener("change", (e) => {
    const v = Number((e.target as HTMLInputElement).value) || 20;
    savePartial({ cooldownSec: Math.max(5, Math.min(120, v)) });
  });

  byId("maxCardsPerHour").addEventListener("change", (e) => {
    const v = Number((e.target as HTMLInputElement).value) || 12;
    savePartial({ maxCardsPerHour: Math.max(1, Math.min(60, v)) });
  });

  byId("targetLevel").addEventListener("change", (e) => {
    savePartial({ targetLevel: Number((e.target as HTMLSelectElement).value) });
  });

  byId("autoResumeSec").addEventListener("change", (e) => {
    savePartial({ autoResumeSec: Math.max(0, Number((e.target as HTMLInputElement).value) || 0) });
  });

  byId("site-youtube").addEventListener("change", async (e) => {
    const s = await storage.getSettings();
    savePartial({ sites: { ...s.sites, youtube: (e.target as HTMLInputElement).checked } });
  });

  byId("site-netflix").addEventListener("change", async (e) => {
    const s = await storage.getSettings();
    savePartial({ sites: { ...s.sites, netflix: (e.target as HTMLInputElement).checked } });
  });

  byId("site-generic").addEventListener("change", async (e) => {
    const s = await storage.getSettings();
    savePartial({ sites: { ...s.sites, generic: (e.target as HTMLInputElement).checked } });
  });

  byId("displayScript").addEventListener("change", (e) => {
    savePartial({ displayScript: (e.target as HTMLSelectElement).value as DisplayScript });
  });

  byId("autoSpeak").addEventListener("change", (e) => {
    savePartial({ autoSpeak: (e.target as HTMLInputElement).checked });
  });

  byId("openaiKey").addEventListener("change", (e) => {
    savePartial({ openaiKey: (e.target as HTMLInputElement).value.trim() });
  });

  byId("transcribeModel").addEventListener("change", (e) => {
    savePartial({ transcribeModel: (e.target as HTMLSelectElement).value });
  });

  byId("export-btn").addEventListener("click", async () => {
    const data = await storage.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `animevocab-export-${todayKey()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  byId("reset-btn").addEventListener("click", async () => {
    if (!confirm("Reset all vocab and stats? Settings will be kept.")) return;
    await storage.resetProgress();
  });
});
