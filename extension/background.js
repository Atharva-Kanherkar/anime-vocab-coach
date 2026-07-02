const DEFAULTS = {
  pauseMode: "pause",
  cooldownSec: 20,
  maxCardsPerHour: 12,
  targetLevel: 4,
  autoResumeSec: 0,
  sites: { youtube: true, netflix: true, generic: true }
};

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(["settings"], (result) => {
    if (!result.settings) {
      chrome.storage.local.set({ settings: DEFAULTS });
    }
  });
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "avc-badge") {
    const text = msg.count > 0 ? String(msg.count) : "";
    chrome.action.setBadgeText({ text });
    chrome.action.setBadgeBackgroundColor({ color: "#8b7cf6" });
  }
});
