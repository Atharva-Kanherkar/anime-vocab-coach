// First-run page, opened once by the background worker on a real install.
//
// A fresh Web Store install used to land with no window at all, so the only
// signal that anything happened was a new toolbar icon — and the account link
// never happened unless the learner independently opened animevocab.com/app
// (#123). This page states the three things that have to happen and resolves
// the third one itself where it can.
import { WEB_URL } from "../config";
import * as storage from "../lib/storage";
import type { SyncPlan } from "../types";

function byId<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

function planLabel(plan: SyncPlan | null): string {
  return plan === "max" ? "Max" : plan === "pro" ? "Pro" : plan === "free" ? "Free" : "";
}

/** Ask the background worker to mint a token from this browser's animevocab.com
 * session. It owns the host permission; a page fetch would fail preflight. */
async function requestLink(force: boolean): Promise<boolean> {
  try {
    const res = (await chrome.runtime.sendMessage({
      type: "avc-account-link",
      trigger: "welcome",
      force,
    })) as { linked?: boolean } | undefined;
    return res?.linked === true;
  } catch {
    return false;
  }
}

function renderChecking(): void {
  byId("account").innerHTML =
    `<div class="status"><span class="dot warn"></span>` +
    `<div><b>Checking this browser…</b><span class="note">Looking for a signed-in animevocab.com session.</span></div></div>`;
}

async function renderAccount(): Promise<void> {
  const el = byId("account");
  const token = await storage.getSyncToken();

  if (!token) {
    el.innerHTML =
      `<div class="status"><span class="dot off"></span>` +
      `<div><b>Not connected</b><span class="note">Your words stay on this device only.</span></div></div>` +
      `<div class="row"><button type="button" class="btn btn-primary" id="connect">Connect account</button></div>`;
    byId("connect").addEventListener("click", () => {
      void (async () => {
        const button = byId<HTMLButtonElement>("connect");
        button.disabled = true;
        button.textContent = "Connecting…";
        // Try the silent link once more first — the learner may have signed in
        // on another tab since the page loaded. Only send them to the site when
        // this browser genuinely has no session to borrow.
        if (await requestLink(true)) {
          await renderAccount();
          return;
        }
        await chrome.tabs.create({ url: `${WEB_URL}/app` });
        button.disabled = false;
        button.textContent = "Connect account";
      })();
    });
    return;
  }

  const profile = await storage.getSyncProfile();
  const who = profile?.email || profile?.name || "your account";
  const plan = planLabel(profile?.plan ?? null);
  el.innerHTML =
    `<div class="status"><span class="dot"></span>` +
    `<div><b>Connected${plan ? ` · ${esc(plan)}` : ""}</b>` +
    `<span class="note">Signed in as ${esc(who)}. Your words sync automatically.</span></div></div>` +
    `<div class="row"><button type="button" class="btn" id="open-app">Open your cloud app</button></div>`;
  byId("open-app").addEventListener("click", () => {
    void chrome.tabs.create({ url: `${WEB_URL}/app` });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  for (const el of document.querySelectorAll<HTMLElement>("[data-open]")) {
    el.addEventListener("click", () => {
      const url = el.dataset.open;
      if (url) void chrome.tabs.create({ url });
    });
  }

  byId("open-dashboard").addEventListener("click", () => {
    void chrome.tabs.create({ url: chrome.runtime.getURL("dashboard/dashboard.html") });
  });

  byId("open-settings").addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });

  byId("open-privacy").addEventListener("click", () => {
    void chrome.tabs.create({ url: `${WEB_URL}/privacy` });
  });

  // Signing in on another tab lands the token in storage — flip step 3 live
  // rather than making the learner reload a page that says "not connected".
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && (changes.syncToken || changes.syncProfile)) void renderAccount();
  });

  void (async () => {
    const token = await storage.getSyncToken();
    if (token) {
      await renderAccount();
      return;
    }
    // The install handler already fired one attempt; this shares that in-flight
    // request rather than minting a second token.
    renderChecking();
    await requestLink(false);
    await renderAccount();
  })();
});
