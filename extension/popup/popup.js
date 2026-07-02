function todayKey() {
  return new Date().toLocaleDateString("sv");
}

function computeStreak(daily) {
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

function countByState(vocab) {
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

async function render() {
  const settings = await AVC.storage.getSettings();
  const vocab = await AVC.storage.getVocab();
  const stats = await AVC.storage.getStats();
  const day = todayKey();
  const daily = stats.daily?.[day] || { met: 0, judged: 0, reviews: 0, watchMin: 0 };

  document.getElementById("stat-met").textContent = daily.met;
  document.getElementById("stat-judged").textContent = daily.judged;
  document.getElementById("stat-reviews").textContent = daily.reviews;
  document.getElementById("stat-watch").textContent = daily.watchMin;

  const totals = countByState(vocab);
  document.getElementById("totals-row").innerHTML =
    `<span class="dot-known">● ${totals.known} known</span>   ` +
    `<span class="dot-learning">● ${totals.learning} learning</span>   ` +
    `<span class="dot-seen">● ${totals.seen} seen</span>`;

  const streak = computeStreak(stats.daily);
  document.getElementById("streak").textContent = streak > 0 ? `🔥 ${streak}-day streak` : "No streak yet";

  const recent = Object.entries(vocab)
    .sort((a, b) => (b[1].lastSeenAt || 0) - (a[1].lastSeenAt || 0))
    .slice(0, 10);

  const list = document.getElementById("recent-list");
  list.innerHTML = "";

  for (const [word, rec] of recent) {
    const li = document.createElement("li");
    li.innerHTML = `
      <span class="word">${word}</span>
      <span class="reading">${rec.reading || ""}</span>
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
      await AVC.storage.setWordState(e.target.dataset.word, e.target.value);
    });
  });

  const pill = document.getElementById("mode-pill");
  pill.textContent = settings.pauseMode;
}

document.addEventListener("DOMContentLoaded", () => {
  render();

  const modes = ["pause", "notify", "off"];
  document.getElementById("mode-pill").addEventListener("click", async (e) => {
    const settings = await AVC.storage.getSettings();
    const idx = modes.indexOf(settings.pauseMode);
    const next = modes[(idx + 1) % modes.length];
    await AVC.storage.setSettings({ pauseMode: next });
    e.target.textContent = next;
  });

  document.getElementById("settings-link").addEventListener("click", (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });

  document.getElementById("export-link").addEventListener("click", async (e) => {
    e.preventDefault();
    const data = await AVC.storage.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `anime-vocab-coach-export-${todayKey()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });
});
