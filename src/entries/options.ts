import * as storage from "../lib/storage";
import { toRomaji } from "../lib/romaji";
import { commonnessShort } from "../lib/levels";
import { WEB_URL } from "../config";
import type { DisplayScript, PauseMode, Settings, VocabMap, WordState } from "../types";

let vocab: VocabMap = {};
let filterState = "all";
let searchQuery = "";

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

function relativeDue(dueAt: number): string {
  if (!dueAt) return "—";
  const diff = dueAt - Date.now();
  if (diff <= 0) return "now";
  const hours = Math.round(diff / 3600000);
  if (hours < 24) return `in ${hours}h`;
  const days = Math.round(diff / 86400000);
  return `in ${days}d`;
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

async function refreshCloudStatus(): Promise<void> {
  const el = byId("cloud-status");
  const token = await storage.getSyncToken();
  if (token) {
    el.textContent = "Linked to your account — sync and cloud Listening Mode are ready.";
    el.style.color = "var(--known, #4f9e78)";
  } else {
    el.innerHTML =
      `Not linked yet. <a href="${WEB_URL}/app" target="_blank" rel="noopener">Sign in at animevocab.com</a> and keep the tab open briefly.`;
    el.style.color = "";
  }
}

function renderTable(): void {
  const tbody = byId<HTMLTableSectionElement>("word-tbody");
  tbody.innerHTML = "";

  let entries = Object.entries(vocab);

  if (filterState !== "all") {
    entries = entries.filter(([, rec]) => rec.state === filterState);
  }

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    entries = entries.filter(([word, rec]) =>
      word.toLowerCase().includes(q) ||
      (rec.reading || "").toLowerCase().includes(q) ||
      (rec.gloss || "").toLowerCase().includes(q)
    );
  }

  entries.sort((a, b) => (b[1].lastSeenAt || 0) - (a[1].lastSeenAt || 0));
  const total = entries.length;
  const shown = entries.slice(0, 200);

  byId("table-note").textContent =
    total > 200 ? `Showing 200 of ${total}` : `Showing ${total} of ${total}`;

  for (const [word, rec] of shown) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${word}</td>
      <td>${toRomaji(rec.reading || "")}<br><small>${rec.reading || ""}</small></td>
      <td>${rec.gloss || ""}</td>
      <td>${commonnessShort(rec.level)}</td>
      <td>${rec.seenCount || 0}</td>
      <td><select data-word="${word}">
        <option value="new" ${rec.state === "new" ? "selected" : ""}>new</option>
        <option value="learning" ${rec.state === "learning" ? "selected" : ""}>learning</option>
        <option value="known" ${rec.state === "known" ? "selected" : ""}>known</option>
        <option value="ignored" ${rec.state === "ignored" ? "selected" : ""}>ignored</option>
      </select></td>
      <td>${rec.state === "learning" && rec.srs ? relativeDue(rec.srs.dueAt) : "—"}</td>
    `;
    tbody.appendChild(tr);
  }

  tbody.querySelectorAll("select").forEach((sel) => {
    sel.addEventListener("change", async (e) => {
      const target = e.target as HTMLSelectElement;
      const word = target.dataset.word!;
      await storage.setWordState(word, target.value as WordState);
      vocab = await storage.getVocab();
      renderTable();
      showSaved();
    });
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  await loadSettingsForm();
  await refreshCloudStatus();
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.syncToken) void refreshCloudStatus();
  });
  vocab = await storage.getVocab();
  renderTable();

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

  byId("search").addEventListener("input", (e) => {
    searchQuery = (e.target as HTMLInputElement).value;
    renderTable();
  });

  document.querySelectorAll<HTMLButtonElement>("#state-chips .chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#state-chips .chip").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      filterState = btn.dataset.state!;
      renderTable();
    });
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
    vocab = {};
    renderTable();
  });
});
