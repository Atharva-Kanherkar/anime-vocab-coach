"use strict";
(() => {
  // src/lib/n5-pilot.ts
  function isStreamingUrl(raw) {
    try {
      const u = new URL(raw);
      return u.protocol === "https:" && !u.port && !u.username && !u.password && ["youtube.com", "netflix.com", "crunchyroll.com"].some((h) => u.hostname === h || u.hostname.endsWith("." + h));
    } catch {
      return false;
    }
  }

  // src/entries/course.ts
  var el = (id) => document.getElementById(id);
  var busy = false;
  var epoch = 0;
  var state = null;
  var players = [];
  function updateControls() {
    for (const button of Array.from(document.querySelectorAll("button"))) button.disabled = busy;
    el("scripts").disabled = busy;
    el("attach").disabled = busy || !state?.context;
    el("practise").disabled = busy || !players.includes(Number(el("player").value));
  }
  function render(next, pending, offline, active) {
    state = next;
    players = active;
    el("lesson").hidden = !next.lesson;
    for (const radio of Array.from(document.querySelectorAll('input[name="script"]'))) radio.checked = radio.value === next.context?.script;
    el("status").textContent = offline ? `Offline lesson. ${pending} observation(s) pending sync; no proficiency credit.` : pending ? `${pending} observation(s) pending sync.` : "Course connected. Saved progress belongs to your account.";
    el("progress").textContent = `${next.completedAttempts} objective practice attempt(s) complete. ${next.watched ? "Episode marked watched." : "Episode not yet recorded as watched."} Speak with Haru on the hosted lesson page.`;
    el("words").replaceChildren();
    el("grammar").replaceChildren();
    el("attempts").replaceChildren();
    if (next.lesson) {
      el("goal").textContent = next.lesson.canDo;
      el("unit").textContent = [next.lesson.unit ? `Unit ${next.lesson.unit}${next.lesson.title ? `: ${next.lesson.title}` : ""}` : "", next.lesson.episode ? `Your Lie in April, episode ${next.lesson.episode.number}: ${next.lesson.episode.title}` : ""].filter(Boolean).join(" \xB7 ");
      for (const v of next.lesson.vocabulary) {
        const item = document.createElement("li"), word = document.createElement("strong"), meaning = document.createElement("span");
        word.textContent = v.reading;
        word.dataset.n5Japanese = "";
        meaning.textContent = v.meaning;
        item.append(word, meaning);
        el("words").append(item);
      }
      for (const g of next.lesson.grammar) {
        const example = document.createElement("p");
        example.dataset.n5Japanese = "";
        example.textContent = g.example;
        el("grammar").append(example);
      }
      for (const attempt of next.activeAttempts) {
        const p = document.createElement("p"), a = document.createElement("a");
        a.href = `https://animevocab.com/app/n5/attempts/${attempt.id}`;
        a.target = "_blank";
        a.rel = "noopener";
        a.textContent = `Resume unfinished ${attempt.script} practice`;
        p.append(a);
        el("attempts").append(p);
      }
    }
    updateControls();
  }
  async function act(message) {
    if (busy) return;
    busy = true;
    const started = epoch;
    updateControls();
    el("error").hidden = true;
    try {
      const response = await chrome.runtime.sendMessage(message);
      if (started !== epoch) return;
      if (!response?.ok) {
        if (["not_linked", "unavailable", "account_changed"].includes(response?.code)) {
          state = null;
          players = [];
          el("lesson").hidden = true;
          el("words").replaceChildren();
          el("grammar").replaceChildren();
          el("attempts").replaceChildren();
          el("progress").textContent = "";
          el("status").textContent = "Course access requires an authenticated refresh.";
        }
        throw new Error(response?.error || "Course action could not finish. Please retry.");
      }
      if (response.state) render(response.state, response.pending || 0, response.offline === true, response.players || []);
      if (response.warning) {
        el("error").textContent = response.warning;
        el("error").hidden = false;
      }
      if (message.type === "avc-n5-attach") el("status").textContent = "Lesson focus is ready beside your confirmed video.";
      if (message.type === "avc-n5-detach") {
        players = [];
        el("status").textContent = "Course focus ended. Your normal watching settings are unchanged.";
      }
    } catch (error) {
      if (started === epoch) {
        el("error").textContent = error instanceof Error ? error.message : "Please retry.";
        el("error").hidden = false;
      }
    } finally {
      busy = false;
      updateControls();
    }
  }
  async function loadTabs() {
    const select = el("player"), previous = select.value;
    const tabs = await chrome.tabs.query({});
    select.replaceChildren(new Option("Choose a video tab", ""));
    for (const tab of tabs) if (tab.id !== void 0 && tab.url && isStreamingUrl(tab.url)) select.append(new Option(tab.title || new URL(tab.url).hostname, String(tab.id)));
    const requested = new URL(location.href).searchParams.get("tabId");
    select.value = previous || requested || String(players[0] || "");
    updateControls();
  }
  function selectedTab() {
    const id = Number(el("player").value);
    if (!Number.isSafeInteger(id) || id <= 0) throw new Error("Choose an open video tab first.");
    return id;
  }
  function playerAction(type, attaching = false) {
    try {
      const tabId = selectedTab();
      if (attaching && !el("confirmed").checked) throw new Error("Confirm the episode before showing course targets.");
      void act({ type, tabId, ...attaching ? { confirmJapanese: el("japanese").checked } : {} });
    } catch (e) {
      el("error").textContent = e.message;
      el("error").hidden = false;
    }
  }
  document.addEventListener("DOMContentLoaded", () => {
    el("choose").onclick = () => {
      const radio = document.querySelector('input[name="script"]:checked');
      if (radio) void act({ type: "avc-n5-enrol", script: radio.value });
      else {
        el("error").textContent = "Choose romaji or kana first.";
        el("error").hidden = false;
      }
    };
    el("retry").onclick = () => {
      void act({ type: "avc-n5-state", refresh: true });
    };
    el("attach").onclick = () => playerAction("avc-n5-attach", true);
    el("practise").onclick = () => playerAction("avc-n5-start-assessment");
    el("detach").onclick = () => playerAction("avc-n5-detach");
    el("tabs").onclick = () => {
      void loadTabs();
    };
    el("player").onchange = updateControls;
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && changes.syncToken) {
        epoch++;
        state = null;
        players = [];
        el("lesson").hidden = true;
        el("words").replaceChildren();
        el("grammar").replaceChildren();
        el("attempts").replaceChildren();
        el("progress").textContent = "";
        el("status").textContent = "Account changed. Refresh to load this account's course.";
        updateControls();
      }
    });
    void act({ type: "avc-n5-state", refresh: true }).then(loadTabs);
  });
})();
