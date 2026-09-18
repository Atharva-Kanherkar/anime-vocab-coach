// First-run page, opened once by the background worker on a real install.
//
// A fresh Web Store install used to land with no window at all, so the only
// signal that anything happened was a new toolbar icon — and the account link
// never happened unless the learner independently opened animevocab.com/app
// (#123).
//
// #77 turned it into the actual path to a first card: the three steps in the
// order a learner walks them, one oversized button to start an episode, and
// sign-in demoted out of the numbered flow. Roughly a quarter of installs were
// uninstalling, and asking someone to make an account before they have seen a
// single word get mined is the cheapest way to earn that.
import { ownedWebUrl } from "../config";
import { ACCOUNT_COPY, planLabel } from "../lib/account-link";
import * as storage from "../lib/storage";
import {
  ONBOARDING_STORAGE_KEY,
  checklistSteps,
  isActivated,
  type OnboardingState,
} from "../lib/onboarding";
import { getOnboarding, recordOnboardingShown } from "../lib/onboarding-store";

function byId<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

const CRUNCHYROLL_URL = "https://www.crunchyroll.com/videos/popular";
const NETFLIX_URL = "https://www.netflix.com/browse/genre/7424";
const YOUTUBE_URL = "https://www.youtube.com/results?search_query=anime+%E6%97%A5%E6%9C%AC%E8%AA%9E%E5%AD%97%E5%B9%95";

/**
 * Per-step call to action. Only the first step gets one: until an episode is
 * playing there is nothing on this page a learner can usefully press, and a row
 * of equal-weight buttons on every step is how a three-step flow stops reading
 * as a path.
 */
const STEP_ACTIONS: Record<string, string> = {
  watch:
    `<div class="row">` +
    `<button type="button" class="btn btn-primary btn-lg" data-open="${CRUNCHYROLL_URL}">Open Crunchyroll</button>` +
    `<button type="button" class="btn" data-open="${NETFLIX_URL}">Netflix</button>` +
    `<button type="button" class="btn" data-open="${YOUTUBE_URL}">YouTube</button>` +
    `</div>`,
};

function renderSteps(state: OnboardingState): void {
  byId("steps").innerHTML = checklistSteps(state)
    .map((step, i) => {
      const done = step.done;
      return (
        `<li class="step${done ? " done" : ""}" data-step="${step.id}">` +
        `<span class="num" aria-hidden>${done ? "✓" : i + 1}</span>` +
        `<div class="body">` +
        `<h2>${esc(step.title)}</h2>` +
        `<p>${esc(step.detail)}</p>` +
        (done ? `<span class="step-done-note">Done</span>` : STEP_ACTIONS[step.id] || "") +
        `</div></li>`
      );
    })
    .join("");
}

/**
 * The 🎉 moment. Shown for as long as the page is open once a card exists —
 * this is a status surface, not the one-shot congratulation (that one lives in
 * the popup and in the on-player toast, where the learner actually is).
 */
function renderCelebration(state: OnboardingState): void {
  const el = byId("celebrate");
  if (!isActivated(state)) {
    el.hidden = true;
    el.innerHTML = "";
    return;
  }
  el.hidden = false;
  el.innerHTML =
    `<h2>🎉 First card saved</h2>` +
    `<p>It comes back for review on its own, starting in about four hours. Everything else is just more anime.</p>` +
    `<div class="row"><button type="button" class="btn btn-primary" data-act="dashboard">Open your review dashboard</button></div>`;
  byId("head-title").textContent = "You are learning Japanese from anime";
  byId("head-sub").textContent = "Your first card is saved. Keep watching — the rest mines itself.";
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
    signinLead() +
    `<div class="account"><div class="status"><span class="dot warn"></span>` +
    `<div><b>${ACCOUNT_COPY.checkingTitle}</b><span class="note">${ACCOUNT_COPY.checkingNote}</span></div></div></div>`;
}

/** One line, below the steps, framed around the card rather than the account. */
function signinLead(): string {
  return `<p class="signin-lead">When you save your first card, one tap keeps it in the cloud and on every browser you sign in to. Until then there is nothing to sign up for — your words stay on this device.</p>`;
}

async function renderAccount(): Promise<void> {
  const el = byId("account");
  const token = await storage.getSyncToken();

  if (!token) {
    el.innerHTML =
      signinLead() +
      `<div class="account"><div class="status"><span class="dot off"></span>` +
      `<div><b>${ACCOUNT_COPY.notLinkedTitle}</b><span class="note">${ACCOUNT_COPY.notLinkedNote}</span></div></div>` +
      `<div class="row"><button type="button" class="btn" id="connect">${ACCOUNT_COPY.connect}</button></div></div>`;
    byId("connect").addEventListener("click", () => {
      void (async () => {
        const button = byId<HTMLButtonElement>("connect");
        button.disabled = true;
        button.textContent = ACCOUNT_COPY.connecting;
        // Try the silent link once more first — the learner may have signed in
        // on another tab since the page loaded. Only send them to the site when
        // this browser genuinely has no session to borrow.
        if (await requestLink(true)) {
          await renderAccount();
          return;
        }
        await chrome.tabs.create({ url: ownedWebUrl("/app", "welcome_connect") });
        button.disabled = false;
        button.textContent = ACCOUNT_COPY.connect;
      })();
    });
    return;
  }

  const profile = await storage.getSyncProfile();
  const who = profile?.email || profile?.name || ACCOUNT_COPY.unnamedAccount;
  const plan = planLabel(profile?.plan ?? null);
  el.innerHTML =
    `<div class="account"><div class="status"><span class="dot"></span>` +
    `<div><b>${ACCOUNT_COPY.linkedTitle}${plan ? ` · ${esc(plan)}` : ""}</b>` +
    `<span class="note">${esc(ACCOUNT_COPY.linkedNote(who))}</span></div></div>` +
    `<div class="row"><button type="button" class="btn" id="open-app">${ACCOUNT_COPY.openApp}</button></div></div>`;
  byId("open-app").addEventListener("click", () => {
    void chrome.tabs.create({ url: ownedWebUrl("/app", "welcome_cloud") });
  });
}

async function renderOnboarding(): Promise<void> {
  const state = await getOnboarding();
  renderSteps(state);
  renderCelebration(state);
}

document.addEventListener("DOMContentLoaded", () => {
  // Delegated, because the steps and the 🎉 block are re-rendered in place
  // every time a stamp lands — listeners bound to the old nodes would be gone.
  document.addEventListener("click", (e) => {
    const el = (e.target as HTMLElement | null)?.closest<HTMLElement>("[data-open], [data-act]");
    if (!el) return;
    const url = el.dataset.open;
    if (url) {
      void chrome.tabs.create({ url });
      return;
    }
    switch (el.dataset.act) {
      case "dashboard":
        void chrome.tabs.create({ url: chrome.runtime.getURL("dashboard/dashboard.html") });
        break;
      case "settings":
        chrome.runtime.openOptionsPage();
        break;
      case "privacy":
        void chrome.tabs.create({ url: ownedWebUrl("/privacy", "welcome_privacy") });
        break;
    }
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    // Signing in on another tab lands the token in storage — flip the account
    // line live rather than making the learner reload a page that says "not
    // connected". Same for a step ticking while this tab sits in the background.
    if (changes.syncToken || changes.syncProfile) void renderAccount();
    if (changes[ONBOARDING_STORAGE_KEY]) void renderOnboarding();
  });

  // Paint the steps before anything async: an empty <ol> is the one thing this
  // page must never show.
  void renderOnboarding();
  void recordOnboardingShown();

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
