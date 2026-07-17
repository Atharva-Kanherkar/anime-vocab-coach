import * as storage from "./storage";
import { trackExtensionEvent } from "./extension-events";
import {
  CWS_REVIEWS_URL,
  applyMaybeLater,
  applyNoThanks,
  applyRate,
  applyShown,
  countMinedCards,
  shouldCountShown,
  shouldShowReviewPrompt,
} from "./review-prompt";

export interface MountReviewPromptOptions {
  /** Host element; cleared when the prompt should not show. */
  host: HTMLElement;
  /** True while a review session (or other blocking surface) is active. */
  blocked?: boolean;
  /** Optional class prefix — "av" for popup, "rp" for dashboard. */
  variant?: "popup" | "dashboard";
}

/**
 * Render the Chrome Web Store review nudge into `host` when eligible.
 * Safe to call on every popup/dashboard boot; no-ops when blocked or ineligible.
 */
export async function mountReviewPrompt(opts: MountReviewPromptOptions): Promise<boolean> {
  const { host, blocked = false, variant = "popup" } = opts;
  const [vocab, stats, prompt] = await Promise.all([
    storage.getVocab(),
    storage.getStats(),
    storage.getReviewPrompt(),
  ]);

  const now = Date.now();
  if (!shouldShowReviewPrompt({ vocab, stats, prompt, blocked, now })) {
    host.hidden = true;
    host.innerHTML = "";
    return false;
  }

  if (shouldCountShown(prompt, now)) {
    await storage.setReviewPrompt(applyShown(prompt, now));
    trackExtensionEvent("review_prompt_shown");
  }

  const rootClass = variant === "popup" ? "av-review-prompt" : "rp-card";
  const btnPrimary = variant === "popup" ? "av-btn av-btn-primary av-btn-block" : "rp-btn rp-btn-primary";
  const btnGhost = variant === "popup" ? "av-btn av-btn-ghost av-btn-block" : "rp-btn rp-btn-ghost";
  const btnQuiet = variant === "popup" ? "av-btn av-btn-quiet av-btn-block" : "rp-btn rp-btn-quiet";

  host.hidden = false;
  host.innerHTML =
    `<div class="${rootClass}" role="region" aria-label="Rate AnimeVocab">` +
    `<p class="${variant === "popup" ? "av-review-prompt-copy" : "rp-copy"}">` +
    `Enjoying AnimeVocab? A rating helps other learners find it.` +
    `</p>` +
    `<div class="${variant === "popup" ? "av-review-prompt-actions" : "rp-actions"}">` +
    `<button type="button" class="${btnPrimary}" data-rp="rate">Rate on Chrome Web Store</button>` +
    `<button type="button" class="${btnGhost}" data-rp="later">Maybe later</button>` +
    `<button type="button" class="${btnQuiet}" data-rp="no">No thanks</button>` +
    `</div></div>`;

  const hide = (): void => {
    host.hidden = true;
    host.innerHTML = "";
  };

  const mined = countMinedCards(vocab);

  host.querySelector<HTMLButtonElement>('[data-rp="rate"]')?.addEventListener("click", () => {
    void (async () => {
      const current = await storage.getReviewPrompt();
      await storage.setReviewPrompt(applyRate(current));
      trackExtensionEvent("review_prompt_clicked");
      chrome.tabs.create({ url: CWS_REVIEWS_URL });
      hide();
    })();
  });

  host.querySelector<HTMLButtonElement>('[data-rp="later"]')?.addEventListener("click", () => {
    void (async () => {
      const current = await storage.getReviewPrompt();
      await storage.setReviewPrompt(applyMaybeLater(current, mined));
      hide();
    })();
  });

  host.querySelector<HTMLButtonElement>('[data-rp="no"]')?.addEventListener("click", () => {
    void (async () => {
      const current = await storage.getReviewPrompt();
      await storage.setReviewPrompt(applyNoThanks(current));
      hide();
    })();
  });

  return true;
}
