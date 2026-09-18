/**
 * Popup onboarding surface (issue #77). Two mutually exclusive things share one
 * host, because they are two ends of the same story:
 *
 *  - the 🎉 first-card moment, shown once, the next time the popup opens after
 *    a card is mined;
 *  - the three-step checklist, shown to an install that has had a full day and
 *    still has nothing.
 *
 * Same shape as review-prompt-ui.ts: never throws, no-ops when ineligible, and
 * safe to call on every popup boot.
 */
import { checklistSteps, shouldCelebrate, shouldShowChecklist } from "./onboarding";
import { getOnboarding, stampOnboarding } from "./onboarding-store";

export interface MountOnboardingOptions {
  /** Host element; emptied and hidden when there is nothing to say. */
  host: HTMLElement;
  now?: number;
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

export type OnboardingSurface = "celebration" | "checklist" | "none";

export async function mountOnboarding(opts: MountOnboardingOptions): Promise<OnboardingSurface> {
  try {
    return await mountInner(opts.host, opts.now ?? Date.now());
  } catch {
    hide(opts.host);
    return "none";
  }
}

function hide(host: HTMLElement): void {
  try {
    host.hidden = true;
    host.innerHTML = "";
  } catch {
    /* ignore */
  }
}

async function mountInner(host: HTMLElement, now: number): Promise<OnboardingSurface> {
  const state = await getOnboarding();

  if (shouldCelebrate(state)) {
    // Stamp before painting so two popups opening together cannot both claim
    // the moment. If the stamp was already taken, fall through to the
    // checklist check rather than showing a stale congratulation.
    if (await stampOnboarding("celebratedAt", now)) {
      renderCelebration(host);
      return "celebration";
    }
  }

  if (!shouldShowChecklist({ state, now })) {
    hide(host);
    return "none";
  }

  renderChecklist(host, state, now);
  return "checklist";
}

function renderCelebration(host: HTMLElement): void {
  host.hidden = false;
  host.innerHTML =
    `<div class="av-onboarding av-onboarding-win" role="region" aria-label="First card saved">` +
    `<p class="av-onboarding-title">🎉 First card saved</p>` +
    `<p class="av-onboarding-copy">It comes back for review on its own. The dashboard is where you will meet it again.</p>` +
    `<button type="button" class="av-btn av-btn-primary av-btn-block" data-onb="dashboard">Open review dashboard</button>` +
    `</div>`;

  host.querySelector<HTMLButtonElement>('[data-onb="dashboard"]')?.addEventListener("click", () => {
    void chrome.tabs.create({ url: chrome.runtime.getURL("dashboard/dashboard.html") });
  });
}

function renderChecklist(host: HTMLElement, state: Parameters<typeof checklistSteps>[0], now: number): void {
  const steps = checklistSteps(state);
  const rows = steps
    .map(
      (step, i) =>
        `<li class="av-onboarding-step${step.done ? " done" : ""}">` +
        `<span class="av-onboarding-num" aria-hidden>${step.done ? "✓" : i + 1}</span>` +
        `<span class="av-onboarding-step-title">${esc(step.title)}</span>` +
        `</li>`
    )
    .join("");

  host.hidden = false;
  host.innerHTML =
    `<div class="av-onboarding" role="region" aria-label="Getting started">` +
    `<p class="av-onboarding-title">Three steps to your first card</p>` +
    `<ol class="av-onboarding-steps">${rows}</ol>` +
    `<button type="button" class="av-btn av-btn-primary av-btn-block" data-onb="start">Open Crunchyroll</button>` +
    `<button type="button" class="av-btn av-btn-quiet av-btn-block" data-onb="guide">Show me the full guide</button>` +
    `<button type="button" class="av-btn av-btn-quiet av-btn-block" data-onb="dismiss">Hide this</button>` +
    `</div>`;

  host.querySelector<HTMLButtonElement>('[data-onb="start"]')?.addEventListener("click", () => {
    void chrome.tabs.create({ url: "https://www.crunchyroll.com/videos/popular" });
  });
  host.querySelector<HTMLButtonElement>('[data-onb="guide"]')?.addEventListener("click", () => {
    void chrome.tabs.create({ url: chrome.runtime.getURL("welcome/welcome.html") });
  });
  host.querySelector<HTMLButtonElement>('[data-onb="dismiss"]')?.addEventListener("click", () => {
    void (async () => {
      await stampOnboarding("checklistDismissedAt", now);
      hide(host);
    })();
  });
}
