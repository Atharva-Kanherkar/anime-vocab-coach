let vocab = {};
let filterState = "all";
let searchQuery = "";

function todayKey() {
  return new Date().toLocaleDateString("sv");
}

function showSaved() {
  const el = document.getElementById("saved-msg");
  el.hidden = false;
  setTimeout(() => { el.hidden = true; }, 1500);
}

function relativeDue(dueAt) {
  if (!dueAt) return "—";
  const diff = dueAt - Date.now();
  if (diff <= 0) return "now";
  const hours = Math.round(diff / 3600000);
  if (hours < 24) return `in ${hours}h`;
  const days = Math.round(diff / 86400000);
  return `in ${days}d`;
}

async function loadSettingsForm() {
  const s = await AVC.storage.getSettings();

  document.querySelectorAll('input[name="pauseMode"]').forEach((el) => {
    el.checked = el.value === s.pauseMode;
  });
  document.getElementById("cooldownSec").value = s.cooldownSec;
  document.getElementById("maxCardsPerHour").value = s.maxCardsPerHour;
  document.getElementById("targetLevel").value = String(s.targetLevel);
  document.getElementById("autoResumeSec").value = s.autoResumeSec;
  document.getElementById("site-youtube").checked = s.sites?.youtube !== false;
  document.getElementById("site-netflix").checked = s.sites?.netflix !== false;
  document.getElementById("site-generic").checked = s.sites?.generic !== false;
}

async function savePartial(partial) {
  await AVC.storage.setSettings(partial);
  showSaved();
}

function renderTable() {
  const tbody = document.getElementById("word-tbody");
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

  document.getElementById("table-note").textContent =
    total > 200 ? `Showing 200 of ${total}` : `Showing ${total} of ${total}`;

  for (const [word, rec] of shown) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${word}</td>
      <td>${rec.reading || ""}</td>
      <td>${rec.gloss || ""}</td>
      <td>N${6 - rec.level}</td>
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
      const word = e.target.dataset.word;
      await AVC.storage.setWordState(word, e.target.value);
      vocab = await AVC.storage.getVocab();
      renderTable();
      showSaved();
    });
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  await loadSettingsForm();
  vocab = await AVC.storage.getVocab();
  renderTable();

  document.querySelectorAll('input[name="pauseMode"]').forEach((el) => {
    el.addEventListener("change", () => savePartial({ pauseMode: el.value }));
  });

  document.getElementById("cooldownSec").addEventListener("change", (e) => {
    savePartial({ cooldownSec: Math.max(5, Math.min(120, Number(e.target.value) || 20)) });
  });

  document.getElementById("maxCardsPerHour").addEventListener("change", (e) => {
    savePartial({ maxCardsPerHour: Math.max(1, Math.min(60, Number(e.target.value) || 12)) });
  });

  document.getElementById("targetLevel").addEventListener("change", (e) => {
    savePartial({ targetLevel: Number(e.target.value) });
  });

  document.getElementById("autoResumeSec").addEventListener("change", (e) => {
    savePartial({ autoResumeSec: Math.max(0, Number(e.target.value) || 0) });
  });

  document.getElementById("site-youtube").addEventListener("change", async (e) => {
    const s = await AVC.storage.getSettings();
    savePartial({ sites: { ...s.sites, youtube: e.target.checked } });
  });

  document.getElementById("site-netflix").addEventListener("change", async (e) => {
    const s = await AVC.storage.getSettings();
    savePartial({ sites: { ...s.sites, netflix: e.target.checked } });
  });

  document.getElementById("site-generic").addEventListener("change", async (e) => {
    const s = await AVC.storage.getSettings();
    savePartial({ sites: { ...s.sites, generic: e.target.checked } });
  });

  document.getElementById("search").addEventListener("input", (e) => {
    searchQuery = e.target.value;
    renderTable();
  });

  document.querySelectorAll("#state-chips .chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#state-chips .chip").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      filterState = btn.dataset.state;
      renderTable();
    });
  });

  document.getElementById("export-btn").addEventListener("click", async () => {
    const data = await AVC.storage.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `anime-vocab-coach-export-${todayKey()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById("reset-btn").addEventListener("click", async () => {
    if (!confirm("Reset all vocab and stats? Settings will be kept.")) return;
    await AVC.storage.resetProgress();
    vocab = {};
    renderTable();
  });
});
