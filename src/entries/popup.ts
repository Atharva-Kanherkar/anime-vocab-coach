import { ownedWebUrl } from "../config";
import * as storage from "../lib/storage";
import { dueCount } from "../lib/review";
import { mountReviewPrompt } from "../lib/review-prompt-ui";
import { mountOnboarding } from "../lib/onboarding-ui";
import { ACCOUNT_COPY, planLabel } from "../lib/account-link";
import { trackExtensionEvent } from "../lib/extension-events";
import { trackPro, type ProSurface } from "../lib/feature-events";
import {
  MILESTONE_SEEN_KEY,
  keptWordCount,
  milestoneReached,
  proPromptEligible,
} from "../lib/pro-moment";
import type { DailyStats, PauseMode } from "../types";

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

  let current: Theme;
  try {
    const saved = localStorage.getItem("av-theme");
    current = saved === "light" || saved === "dark"
      ? saved
      : window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  } catch {
    current = "dark";
  }
  apply(current);

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

/** Ask the background worker to link this browser to its signed-in
 * animevocab.com session. It owns the host permission; the popup's own fetch
 * would be bound by page CORS. Resolves false when there is nothing to link. */
async function requestAccountLink(force: boolean): Promise<boolean> {
  try {
    const res = (await chrome.runtime.sendMessage({
      type: "avc-account-link",
      trigger: "popup",
      force,
    })) as { linked?: boolean } | undefined;
    return res?.linked === true;
  } catch {
    return false; // worker asleep or mid-restart — the row just stays unlinked
  }
}

// Account status. The extension never has its own login: it borrows the
// browser's animevocab.com session, either from the signed-in page or by
// minting a token itself (lib/account-link). This section is what tells the
// user which account it landed on, on which plan — and when it hasn't.
async function renderAccount(): Promise<void> {
  const el = byId("account");
  const token = await storage.getSyncToken();

  if (!token) {
    // Distinguish "never linked" from "was linked but repeated 401s signed us
    // out" so an expired session reads as recoverable, not a fresh setup.
    const relink = await storage.getRelinkNeeded();
    const title = relink ? ACCOUNT_COPY.popupExpired : ACCOUNT_COPY.popupNotSignedIn;
    const sub = relink ? ACCOUNT_COPY.popupExpiredNote : ACCOUNT_COPY.popupNotSignedInNote;
    const cta = relink ? ACCOUNT_COPY.reconnect : ACCOUNT_COPY.connect;
    const dot = relink ? "av-dot av-dot-warn" : "av-dot av-dot-off";
    el.innerHTML =
      `<div class="av-account-row"><span class="${dot}"></span>` +
      `<div><b>${title}</b><span class="av-account-sub">${sub}</span></div></div>` +
      `<button id="signin-btn" class="av-btn av-btn-primary av-btn-block" type="button">${cta}</button>`;
    byId("signin-btn").addEventListener("click", () => {
      void (async () => {
        // Borrow this browser's session first. Only send the user to the site
        // when there is genuinely no session here to borrow — that trip is the
        // step people were never completing (#123).
        const btn = byId<HTMLButtonElement>("signin-btn");
        btn.disabled = true;
        btn.textContent = ACCOUNT_COPY.connecting;
        if (await requestAccountLink(true)) {
          await renderAccount();
          void renderUsage();
          return;
        }
        chrome.tabs.create({ url: ownedWebUrl("/app", "popup_account") });
        btn.disabled = false;
        btn.textContent = cta;
      })();
    });
    return;
  }

  const profile = await storage.getSyncProfile();
  const sync = await storage.getSyncStatus();
  const who = profile?.email || profile?.name || ACCOUNT_COPY.unnamedAccount;
  // Only name a tier the account actually reported. Guessing "Free" at someone
  // paying for Max is worse than saying nothing.
  const plan = planLabel(profile?.plan);
  const staleSync = sync.state === "syncing" && !!sync.lastAttemptAt && Date.now() - sync.lastAttemptAt > 2 * 60_000;
  const lastGood = sync.lastSuccessAt ? relativeTime(sync.lastSuccessAt) : "not backed up yet";
  const title = staleSync || sync.state === "error"
    ? "Cloud sync issue"
    : sync.state === "syncing"
      ? "Syncing now…"
      : "Cloud sync on";
  const sub = staleSync
    ? `Previous sync was interrupted · last good sync ${lastGood}`
    : sync.state === "error"
      ? `${sync.error || "Couldn't reach cloud."} · last good sync ${lastGood}`
      : sync.state === "ok"
        ? `Synced as ${who} · ${lastGood}`
        : `Connected as ${who} · waiting for first backup`;
  const dot = staleSync || sync.state === "error" ? "av-dot av-dot-warn" : "av-dot";
  el.innerHTML =
    `<div class="av-account-row"><span class="${dot}"></span>` +
    `<div><b>${title}</b><span class="av-account-sub">${esc(sub)}</span></div>` +
    (plan ? `<span class="av-account-plan">${esc(plan)}</span>` : "") +
    `</div>` +
    (staleSync || sync.state === "error"
      ? `<button id="sync-retry" class="av-btn av-btn-ghost av-btn-block" type="button">Retry cloud sync</button>`
      : "");
  document.getElementById("sync-retry")?.addEventListener("click", () => {
    void chrome.runtime.sendMessage({ type: "avc-sync-now" });
  });
}

function relativeTime(timestamp: number): string {
  const elapsed = Math.max(0, Date.now() - timestamp);
  if (elapsed < 15_000) return "just now";
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// Monthly usage. Two meters, both fetched by the background worker (a popup
// page could fetch these itself, but the worker already owns the token + both
// base URLs). Silently stays hidden when signed out or offline — the account
// section above already explains a signed-out state.
function meterMarkup(label: string, used: number, limit: number, unit: "calls" | "minutes"): string {
  if (!limit) return "";
  const pct = Math.min(100, Math.round((used / limit) * 100));
  const cls = pct >= 100 ? "av-meter-fill av-meter-full" : pct >= 85 ? "av-meter-fill av-meter-low" : "av-meter-fill";
  const fmt = (n: number) =>
    unit === "minutes"
      ? `${Number.isInteger(n / 60) ? n / 60 : (n / 60).toFixed(1)}h`
      : n.toLocaleString();
  return (
    `<div class="av-meter">` +
    `<div class="av-meter-row"><span>${esc(label)}</span>` +
    `<span class="av-meter-val">${esc(fmt(Math.min(used, limit)))} / ${esc(fmt(limit))}</span></div>` +
    `<div class="av-meter-track"><div class="${cls}" style="width:${pct}%"></div></div>` +
    `</div>`
  );
}

/** Mirrors UsageSnapshot in lib/usage-client. Every meter is nullable: the two
 * halves come from different Workers and either can be missing. */
interface PopupMeter {
  used: number;
  limit: number;
}

interface PopupUsage {
  plan: "free" | "pro" | "max";
  unlimited?: boolean;
  ai: PopupMeter | null;
  auto: PopupMeter | null;
  listening: PopupMeter | null;
  tiers: {
    pro: { name: string; priceLabel: string; checkoutUrl: string | null };
    max: { name: string; priceLabel: string; checkoutUrl: string | null };
  } | null;
}

/** True once a meter is 80% spent. Unknown meters never trigger an upsell. */
function meterLow(m: PopupMeter | null | undefined): boolean {
  return !!m && m.limit > 0 && m.used / m.limit >= 0.8;
}

/** Pro surfaces already counted as shown during this popup open (#162).
 * renderUsage repaints on every account change; a view is one open. */
const proShown = new Set<ProSurface>();

function proShownOnce(surface: ProSurface): void {
  if (proShown.has(surface)) return;
  proShown.add(surface);
  void trackPro("pro_prompt_shown", surface);
}

/** Open /pricing so the checkout that follows is credited to `surface`. */
function openPricing(surface: ProSurface): void {
  void trackPro("pro_prompt_clicked", surface);
  chrome.tabs.create({ url: ownedWebUrl(`/pricing?from=${surface}`, `popup_${surface}`) });
}

/**
 * The milestone this popup open should celebrate, if any. Advances the stored
 * value as it answers, so each milestone is shown once per install.
 */
async function pendingMilestone(): Promise<number | null> {
  try {
    const r = await chrome.storage.local.get([MILESTONE_SEEN_KEY]);
    const raw = r[MILESTONE_SEEN_KEY];
    const seen = typeof raw === "number" ? raw : null;
    const { store, milestone } = milestoneReached(seen, keptWordCount(await storage.getVocab()));
    if (store !== seen) await chrome.storage.local.set({ [MILESTONE_SEEN_KEY]: store });
    return milestone;
  } catch {
    return null;
  }
}

/** This open's milestone, read once. A promise, not a value, because
 * renderUsage can run twice at once (account + storage change) and the second
 * read would find the milestone already consumed. */
let milestoneThisOpen: Promise<number | null> | null = null;
let milestoneDismissed = false;

async function renderUsage(): Promise<void> {
  const el = byId("usage");
  const token = await storage.getSyncToken();
  if (!token) {
    el.hidden = true;
    return;
  }

  let usage: PopupUsage | null = null;
  try {
    const res = (await chrome.runtime.sendMessage({ type: "avc-usage" })) as
      | { ok?: boolean; usage?: PopupUsage }
      | undefined;
    if (res?.ok && res.usage) usage = res.usage;
  } catch {
    /* worker asleep — leave the section hidden rather than show a broken box */
  }
  if (!usage) {
    el.hidden = true;
    return;
  }

  const planName = usage.plan === "max" ? "Max" : usage.plan === "pro" ? "Pro" : "Free";
  const bars = usage.unlimited
    ? ""
    : (usage.ai ? meterMarkup("AI messages", usage.ai.used, usage.ai.limit, "calls") : "") +
      (usage.listening
        ? meterMarkup("Listening Mode", usage.listening.used, usage.listening.limit, "minutes")
        : "");

  // A meter we couldn't fetch is unknown, not empty — say so instead of drawing
  // a bar that looks like real data.
  const meters = usage.unlimited
    ? `<p class="av-usage-note">No caps on this account.</p>`
    : bars || `<p class="av-usage-note">Usage is unavailable right now.</p>`;

  // Only offer a real step up, and only once something is actually running low —
  // a permanent upsell in the popup is noise.
  const aiLow = !usage.unlimited && meterLow(usage.ai);
  const listenLow = !usage.unlimited && meterLow(usage.listening);
  const offer =
    usage.plan === "free" ? usage.tiers?.pro : usage.plan === "pro" ? usage.tiers?.max : null;
  const cta =
    (aiLow || listenLow) && offer?.checkoutUrl
      ? `<button id="usage-upgrade" class="av-btn av-btn-primary av-btn-block av-usage-cta" type="button">` +
        `Upgrade to ${esc(offer.name)} · ${esc(offer.priceLabel)}</button>`
      : "";

  // Pro for free learners at a value moment, not only at a limit (#162). A
  // quiet link that is always there, and one card when the deck crosses a
  // milestone. Never alongside the limit CTA: one ask at a time.
  const eligible = proPromptEligible(usage);
  if (eligible && !cta && !milestoneThisOpen) milestoneThisOpen = pendingMilestone();
  const milestone =
    eligible && !cta && milestoneThisOpen && !milestoneDismissed ? await milestoneThisOpen : null;
  const proLink = eligible
    ? `<button id="usage-see-pro" class="av-usage-pro" type="button">See Pro</button>`
    : "";
  const proPrice = usage.tiers?.pro.priceLabel;
  const moment = milestone
    ? `<div class="av-pro-moment" id="pro-moment">` +
      `<b>You've kept ${milestone.toLocaleString("en-US")} words.</b>` +
      `<p>Pro helps you understand and remember the anime you watch, with more Listening Mode and coach time${
        proPrice ? ` for ${esc(proPrice)}` : ""
      }. Your words stay yours either way.</p>` +
      `<div class="av-pro-moment-actions">` +
      `<button id="pro-moment-see" class="av-btn av-btn-primary" type="button">See Pro</button>` +
      `<button id="pro-moment-dismiss" class="av-btn av-btn-quiet" type="button">Not now</button>` +
      `</div></div>`
    : "";

  el.innerHTML =
    `<div class="av-usage-head"><span class="av-usage-title">This month</span>` +
    `<span class="av-usage-plan">${esc(planName)}${proLink}</span></div>` +
    meters +
    cta +
    moment;
  el.hidden = false;

  if (cta && offer?.checkoutUrl) {
    trackExtensionEvent("upgrade_prompt_shown");
    proShownOnce("ext_popup_limit");
    byId("usage-upgrade").addEventListener("click", () => {
      trackExtensionEvent("upgrade_prompt_clicked");
      trackExtensionEvent("checkout_started");
      void trackPro("pro_prompt_clicked", "ext_popup_limit");
      void trackPro("pro_checkout_started", "ext_popup_limit");
      chrome.tabs.create({ url: offer.checkoutUrl as string });
    });
  }

  if (proLink) {
    proShownOnce("ext_popup");
    byId("usage-see-pro").addEventListener("click", () => openPricing("ext_popup"));
  }

  if (moment) {
    proShownOnce("ext_milestone");
    byId("pro-moment-see").addEventListener("click", () => openPricing("ext_milestone"));
    byId("pro-moment-dismiss").addEventListener("click", () => {
      milestoneDismissed = true;
      byId("pro-moment").remove();
    });
  }
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

  // A day-old install with no card gets the checklist here instead of a row of
  // mode toggles it has no way to interpret yet (#77). Mounted after the review
  // prompt so an ask for a rating cannot land on someone who has mined nothing.
  await mountOnboarding({ host: byId("onboarding") });
}

async function activeTabId(): Promise<number | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id ?? null;
}

interface ModeState {
  copilot: boolean;
  listening: boolean;
  /** What the page found for study-language captions, when it knows. */
  captionDetail: string | null;
  captionsMissing: boolean;
  settings: Awaited<ReturnType<typeof storage.getSettings>>;
}

function runtimeMessage<T>(message: object): Promise<T | undefined> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        resolve(undefined);
        return;
      }
      resolve(response as T | undefined);
    });
  });
}

function setModeRow(id: string, status: string | null, detail: string, state: "on" | "off" | "warn"): void {
  if (status !== null) byId(`${id}-status`).textContent = status;
  const detailEl = document.getElementById(`${id}-detail`);
  if (detailEl) detailEl.textContent = detail;
  const dot = byId(`${id}-dot`);
  dot.className = `av-mode-dot${state === "on" ? " on" : state === "warn" ? " warn" : ""}`;
}

async function initModeControls(): Promise<void> {
  const copilotBtn = byId<HTMLButtonElement>("copilot-btn");
  const listeningBtn = byId<HTMLButtonElement>("listening-btn");
  const sessionBtn = byId<HTMLButtonElement>("study-session-btn");
  const lensToggle = byId<HTMLButtonElement>("mode-lens-status");
  const cardsSelect = byId<HTMLSelectElement>("mode-cards-select");
  const errEl = byId<HTMLParagraphElement>("listen-error");
  const tabId = await activeTabId();
  if (tabId == null) {
    copilotBtn.disabled = true;
    listeningBtn.disabled = true;
    sessionBtn.disabled = true;
    sessionBtn.textContent = "No active tab";
    return;
  }

  let modeState: ModeState | null = null;

  const refresh = async (): Promise<void> => {
    const [settings, agent, listening, captions] = await Promise.all([
      storage.getSettings(),
      runtimeMessage<{ visible?: boolean }>({ type: "avc-agent-status", tabId }),
      runtimeMessage<{ listening?: boolean }>({ type: "avc-listen-status", tabId }),
      runtimeMessage<{ detail?: string | null; report?: { state?: string } }>({
        type: "avc-caption-status",
        tabId,
      }),
    ]);
    modeState = {
      settings,
      copilot: !!agent?.visible,
      listening: !!listening?.listening,
      captionDetail: captions?.detail ?? null,
      captionsMissing: captions?.report?.state === "missing",
    };

    const lensConfigured = settings.subLens !== false;
    const lensSupported = settings.learningDirection === "en-ja";
    const lensLive = lensConfigured && lensSupported;
    setModeRow(
      "mode-lens",
      lensLive ? "On" : "Off",
      !lensSupported ? "Available while learning Japanese" : lensConfigured ? "Hover or click subtitle words" : "Off — no subtitles of ours on screen",
      lensLive ? "on" : lensConfigured ? "warn" : "off"
    );
    lensToggle.setAttribute("aria-checked", String(lensLive));
    lensToggle.disabled = !lensSupported;
    const cardStatus = settings.pauseMode === "pause" ? "Focus" : settings.pauseMode === "copilot" ? "Ambient" : "Off";
    const cardDetail = settings.pauseMode === "pause"
      ? "Pauses for each automatic card"
      : settings.pauseMode === "copilot"
        ? "Shows automatic cards without pausing"
        : "Subtitle Lens can still run";
    // A video with no study-language captions is why cards stopped appearing,
    // so that fact outranks the mode description on this row.
    setModeRow(
      "mode-cards",
      null,
      modeState.captionDetail || cardDetail,
      settings.pauseMode === "off" ? "off" : modeState.captionsMissing ? "warn" : "on"
    );
    cardsSelect.value = settings.pauseMode; // legacy "notify" is normalized in storage
    cardsSelect.title = `Auto cards: ${cardStatus}`;
    setModeRow("mode-listen", modeState.listening ? "Live" : "Off", "", modeState.listening ? "on" : "off");
    setModeRow("mode-copilot", modeState.copilot ? "Open" : "Closed", "", modeState.copilot ? "on" : "off");

    listeningBtn.textContent = modeState.listening ? "Stop Listening" : "Start Listening";
    listeningBtn.classList.toggle("active", modeState.listening);
    copilotBtn.textContent = modeState.copilot ? "Close Copilot" : "Open Copilot";
    copilotBtn.classList.toggle("active", modeState.copilot);
    sessionBtn.textContent = modeState.listening && modeState.copilot
      ? "Stop Listening + Copilot"
      : "Start Listening + Copilot";
  };

  const setListening = async (active: boolean): Promise<void> => {
    errEl.hidden = true;
    const res = await runtimeMessage<{ ok?: boolean; error?: string }>({
      type: active ? "avc-listen-start" : "avc-listen-stop",
      tabId,
    });
    if (res?.ok === false && res.error) {
      errEl.textContent = res.error;
      errEl.hidden = false;
    }
  };

  const setCopilot = async (active: boolean): Promise<void> => {
    await runtimeMessage({ type: active ? "avc-agent-show" : "avc-agent-hide", tabId });
  };

  // Settings changes reach the tab through storage: the content script applies
  // them the moment they land, so the Lens leaves the screen right away.
  lensToggle.addEventListener("click", () => {
    void (async () => {
      const current = await storage.getSettings();
      await storage.setSettings({ subLens: current.subLens === false });
      await refresh();
    })();
  });

  cardsSelect.addEventListener("change", () => {
    void (async () => {
      await storage.setSettings({ pauseMode: cardsSelect.value as PauseMode });
      await refresh();
    })();
  });

  listeningBtn.addEventListener("click", () => {
    void (async () => {
      await setListening(!modeState?.listening);
      await refresh();
    })();
  });

  copilotBtn.addEventListener("click", () => {
    void (async () => {
      await setCopilot(!modeState?.copilot);
      await refresh();
    })();
  });

  sessionBtn.addEventListener("click", () => {
    void (async () => {
      const stopBoth = !!modeState?.listening && !!modeState?.copilot;
      if (stopBoth) {
        await Promise.all([setListening(false), setCopilot(false)]);
      } else {
        await setCopilot(true);
        await setListening(true);
      }
      await refresh();
    })();
  });

  await refresh();
}

document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  void render();
  void renderAccount();
  void renderUsage();
  void initModeControls();

  // Opening the popup is the moment the learner is asking "am I connected?".
  // If we aren't, try once in the background — the hourly cooldown in
  // lib/account-link keeps this from becoming a mint on every popup open, and
  // the storage listener below repaints if it works.
  void (async () => {
    if (await storage.getSyncToken()) return;
    await requestAccountLink(false);
  })();

  // If the user signs in on animevocab.com while this popup is open, the
  // token lands in storage — flip the account section live.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && (changes.syncToken || changes.syncProfile || changes.relinkNeeded || changes.syncStatus)) {
      void renderAccount();
      void renderUsage();
    }
  });

  byId("cloud-link").addEventListener("click", (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: ownedWebUrl("/app", "popup_cloud") });
  });

  byId("review-due").addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("dashboard/dashboard.html#review") });
  });

  byId("settings-link").addEventListener("click", async (e) => {
    e.preventDefault();
    // Always the extension's own settings. Signed-in learners used to be sent
    // to the web app, whose form covers only some settings (not the Subtitle
    // Lens) and whose saves the extension never pulled back down — its next
    // sync pushed the old values over them.
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
