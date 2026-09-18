import { warn } from "./log";
import { isJapaneseUiLocale, resolveStoredDirection } from "./locale-direction";
import { checkEligibility, lookupForDirection } from "./scoring";
import { DEFAULTS, SRS_INTERVALS } from "../types";
import type {
  DictEntry,
  Judgment,
  JudgmentMeta,
  Settings,
  Stats,
  SyncPlan,
  Token,
  VocabMap,
  VocabRecord,
  WordSource,
  WordState,
} from "../types";
import {
  applyShown,
  normalizeReviewPrompt,
  shouldCountShown,
  type ReviewPromptState,
} from "./review-prompt";
import { trackExtensionMilestone } from "./extension-events";
import { stampOnboarding } from "./onboarding-store";

let queue: Promise<unknown> = Promise.resolve();

export function todayKey(): string {
  return new Date().toLocaleDateString("sv");
}

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const next = queue.then(fn, fn);
  queue = next.catch((err) => warn("storage error:", err));
  return next;
}

function ensureDaily(stats: Stats, day: string) {
  if (!stats.daily) stats.daily = {};
  if (!stats.daily[day]) {
    stats.daily[day] = { met: 0, judged: 0, reviews: 0, watchMin: 0 };
  }
  return stats.daily[day];
}

function pruneTimestamps(timestamps: number[] | undefined): number[] {
  const cutoff = Date.now() - 3600e3;
  return (timestamps || []).filter((t) => t >= cutoff);
}

function emptyStats(): Stats {
  return { daily: {}, cardTimestamps: [] };
}

function sendBadge(stats: Pick<Stats, "daily">): void {
  const day = todayKey();
  const judged = stats.daily?.[day]?.judged || 0;
  chrome.runtime.sendMessage({ type: "avc-badge", count: judged }).catch(() => {});
}

// Locale-aware defaulting must be identical on every read AND write path
// (getSettings / setSettings / exportAll), or runtime, storage, and cloud
// sync disagree about learningDirection for ja-UI users with no explicit choice.
function withDefaults(stored: Partial<Settings>): Settings {
  const merged: Settings = { ...DEFAULTS, ...stored };
  if (resolveStoredDirection(stored.learningDirection) === null && isJapaneseUiLocale()) {
    merged.learningDirection = "ja-en";
  }
  return merged;
}

export function getSettings(): Promise<Settings> {
  return new Promise((resolve) => {
    chrome.storage.local.get(["settings"], (r) => {
      resolve(withDefaults((r.settings || {}) as Partial<Settings>));
    });
  });
}

export function setSettings(partial: Partial<Settings>): Promise<Settings> {
  return enqueue(async () => {
    const r = await chrome.storage.local.get(["settings"]);
    const settings: Settings = { ...withDefaults((r.settings || {}) as Partial<Settings>), ...partial };
    await chrome.storage.local.set({ settings });
    return settings;
  });
}

export function getAgentPinned(): Promise<boolean> {
  return new Promise((resolve) => {
    chrome.storage.local.get(["agentPinned"], (r) => resolve(!!r.agentPinned));
  });
}

export function setAgentPinned(pinned: boolean): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ agentPinned: pinned }, () => resolve());
  });
}

export function getAgentPanelWidth(): Promise<number> {
  return new Promise((resolve) => {
    chrome.storage.local.get(["agentPanelWidth"], (r) => {
      const w = Number(r.agentPanelWidth);
      resolve(Number.isFinite(w) && w > 0 ? w : 340);
    });
  });
}

export function setAgentPanelWidth(width: number): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ agentPanelWidth: width }, () => resolve());
  });
}

/** Whether the copilot sits collapsed to its rail. Anything unparseable reads
 * as expanded: the panel showing when it should not is recoverable, a panel
 * that will not come back is not. */
export function getAgentPanelCollapsed(): Promise<boolean> {
  return new Promise((resolve) => {
    chrome.storage.local.get(["agentPanelCollapsed"], (r) => {
      resolve(r.agentPanelCollapsed === true);
    });
  });
}

export function setAgentPanelCollapsed(collapsed: boolean): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ agentPanelCollapsed: collapsed }, () => resolve());
  });
}

export function getVocab(): Promise<VocabMap> {
  return new Promise((resolve) => {
    chrome.storage.local.get(["vocab"], (r) => resolve((r.vocab as VocabMap | undefined) || {}));
  });
}

export function getStats(): Promise<Stats> {
  return new Promise((resolve) => {
    chrome.storage.local.get(["stats"], (r) => {
      const stats: Stats = (r.stats as Stats | undefined) || emptyStats();
      stats.cardTimestamps = pruneTimestamps(stats.cardTimestamps);
      resolve(stats);
    });
  });
}

export function getWord(base: string): Promise<VocabRecord | null> {
  return getVocab().then((v) => v[base] || null);
}

export function setWordState(base: string, state: WordState): Promise<void> {
  return enqueue(async () => {
    const r = await chrome.storage.local.get(["vocab"]);
    const vocab: VocabMap = (r.vocab as VocabMap | undefined) || {};
    if (!vocab[base]) return;
    vocab[base].state = state;
    if (state === "learning") {
      vocab[base].srs = { stage: 1, dueAt: Date.now() + SRS_INTERVALS[1], lapses: 0 };
    } else {
      vocab[base].srs = null;
    }
    await chrome.storage.local.set({ vocab });
  });
}

export function recordSeen(
  tokens: Token[],
  wordStates: VocabMap,
  targetedSet: Set<string>,
  direction: Settings["learningDirection"] = "en-ja",
  overlay?: Record<string, DictEntry> | null
): Promise<void> {
  return enqueue(async () => {
    const r = await chrome.storage.local.get(["vocab", "stats"]);
    const vocab: VocabMap = { ...((r.vocab as VocabMap | undefined) || {}) };
    const stats: Stats = (r.stats as Stats | undefined) || emptyStats();
    const day = todayKey();
    const daily = ensureDaily(stats, day);
    let changed = false;

    for (const token of tokens) {
      const eligibility = checkEligibility(token, wordStates, targetedSet, Date.now(), direction, overlay);
      if (!eligibility.countSeen) continue;

      const entry = lookupForDirection(token.base, direction, overlay);
      if (!entry) continue;

      if (!vocab[token.base]) {
        vocab[token.base] = {
          state: "new",
          reading: entry.reading,
          gloss: entry.glosses[0] || "",
          level: entry.level,
          freqRank: entry.freqRank,
          seenCount: 1,
          shownCount: 0,
          firstSeenAt: Date.now(),
          lastSeenAt: Date.now(),
          srs: null
        };
        daily.met += 1;
        changed = true;
      } else {
        vocab[token.base].seenCount += 1;
        vocab[token.base].lastSeenAt = Date.now();
        changed = true;
      }
    }

    if (changed) {
      await chrome.storage.local.set({ vocab, stats });
      // Onboarding step 1: something Japanese is on screen and we can read it.
      // Write-once, so this costs one extra read per line and nothing else.
      void stampOnboarding("watchedAt");
    }
  });
}

export function judgeWord(base: string, judgment: Judgment, meta: JudgmentMeta, source?: WordSource | null): Promise<VocabRecord> {
  return enqueue(async () => {
    const r = await chrome.storage.local.get(["vocab", "stats"]);
    const vocab: VocabMap = (r.vocab as VocabMap | undefined) || {};
    const stats: Stats = (r.stats as Stats | undefined) || emptyStats();
    const day = todayKey();
    const daily = ensureDaily(stats, day);
    const now = Date.now();

    if (!vocab[base]) {
      vocab[base] = {
        state: "new",
        reading: meta.reading,
        gloss: meta.gloss,
        level: meta.level,
        freqRank: meta.freqRank,
        seenCount: 1,
        shownCount: 0,
        firstSeenAt: now,
        lastSeenAt: now,
        srs: null
      };
    }

    const rec = vocab[base];
    if (meta) {
      rec.reading = meta.reading;
      rec.gloss = meta.gloss;
      rec.level = meta.level;
      rec.freqRank = meta.freqRank;
    }
    // Capture where the word was first learned, once. Only fill if we have real
    // content and the record doesn't already carry a source.
    if (source && !rec.source && (source.title || source.line)) {
      rec.source = source;
    }

    if (judgment === "know") {
      rec.state = "known";
      rec.srs = null;
    } else if (judgment === "learn") {
      rec.state = "learning";
      rec.srs = { stage: 1, dueAt: now + SRS_INTERVALS[1], lapses: 0 };
    } else if (judgment === "ignore") {
      rec.state = "ignored";
      rec.srs = null;
    } else if (judgment === "review-pass") {
      if (rec.srs) {
        const newStage = rec.srs.stage + 1;
        if (newStage > 5) {
          rec.state = "known";
          rec.srs = null;
        } else {
          rec.srs.stage = newStage;
          rec.srs.dueAt = now + SRS_INTERVALS[newStage];
        }
      }
      daily.reviews += 1;
    } else if (judgment === "review-fail") {
      if (rec.srs) {
        rec.srs.stage = 1;
        rec.srs.lapses += 1;
        rec.srs.dueAt = now + SRS_INTERVALS[1];
      }
      daily.reviews += 1;
    }

    if (judgment !== "dismiss") {
      daily.judged += 1;
    }

    await chrome.storage.local.set({ vocab, stats });
    if (judgment === "review-pass" || judgment === "review-fail") {
      await trackExtensionMilestone("first_srs_review");
    }
    // Onboarding step 3. Only a word the learner chose to keep counts — an
    // ignore or a dismiss is the opposite of mining, and a review judgment
    // needs a card that already exists.
    if (judgment === "know" || judgment === "learn") {
      void stampOnboarding("firstCardAt");
    }
    sendBadge(stats);
    return vocab[base];
  });
}

export function recordCardShown(base: string): Promise<void> {
  return enqueue(async () => {
    const r = await chrome.storage.local.get(["vocab", "stats"]);
    const vocab: VocabMap = (r.vocab as VocabMap | undefined) || {};
    const stats: Stats = (r.stats as Stats | undefined) || emptyStats();
    const now = Date.now();

    stats.cardTimestamps = pruneTimestamps(stats.cardTimestamps);
    stats.cardTimestamps.push(now);

    if (vocab[base]) {
      vocab[base].shownCount = (vocab[base].shownCount || 0) + 1;
    }

    await chrome.storage.local.set({ vocab, stats });
    await trackExtensionMilestone("first_card_created");
    // Onboarding step 2: the panel is up and showing a word.
    void stampOnboarding("cardShownAt");
  });
}

export function recordWatchTick(): Promise<void> {
  return enqueue(async () => {
    const r = await chrome.storage.local.get(["stats"]);
    const stats: Stats = (r.stats as Stats | undefined) || emptyStats();
    const day = todayKey();
    const daily = ensureDaily(stats, day);
    daily.watchMin += 1;
    await chrome.storage.local.set({ stats });
  });
}

export interface ExportData {
  settings: Settings;
  vocab: VocabMap;
  stats: Stats;
  exportedAt: string;
}

export function exportAll(): Promise<ExportData> {
  return new Promise((resolve) => {
    chrome.storage.local.get(["settings", "vocab", "stats"], (r) => {
      resolve({
        settings: withDefaults((r.settings || {}) as Partial<Settings>),
        vocab: (r.vocab as VocabMap | undefined) || {},
        stats: (r.stats as Stats | undefined) || emptyStats(),
        exportedAt: new Date().toISOString()
      });
    });
  });
}

// Cloud sync token, handed to the extension by the signed-in web app. Its
// presence is what "linked to an account" means; absence = local-only.
export function getSyncToken(): Promise<string> {
  return new Promise((resolve) => {
    chrome.storage.local.get(["syncToken"], (r) => resolve((r.syncToken as string | undefined) || ""));
  });
}

export function setSyncToken(token: string): Promise<void> {
  return enqueue(async () => {
    if (token) {
      // A fresh token (the web app re-linked us) clears any prior "re-link
      // needed" state and resets the consecutive-401 tolerance counter.
      await chrome.storage.local.set({
        syncToken: token,
        relinkNeeded: false,
        syncAuthFailures: 0,
      });
    } else {
      // Unlinking (sign-out / expired token): drop the profile too so the
      // popup doesn't keep claiming "Synced as <email>".
      await chrome.storage.local.set({ syncToken: "", syncProfile: null, syncStatus: { ...EMPTY_SYNC_STATUS } });
    }
  });
}

// Consecutive sync 401s. A single 401 (a brief auth blip or a token race) must
// not unlink the extension, so cloud-sync only clears the token after several
// in a row (see cloud-sync.ts). Persisted so the count survives SW recycles.
export function getSyncAuthFailures(): Promise<number> {
  return new Promise((resolve) => {
    chrome.storage.local.get(["syncAuthFailures"], (r) => resolve(Number(r.syncAuthFailures) || 0));
  });
}

export function setSyncAuthFailures(n: number): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ syncAuthFailures: Math.max(0, n) }, () => resolve());
  });
}

// Set when repeated 401s force an unlink — the popup surfaces a distinct
// "re-link needed" state instead of the generic "not signed in". Cleared by
// setSyncToken() the moment the web app hands over a fresh token.
export function getRelinkNeeded(): Promise<boolean> {
  return new Promise((resolve) => {
    chrome.storage.local.get(["relinkNeeded"], (r) => resolve(!!r.relinkNeeded));
  });
}

export function setRelinkNeeded(needed: boolean): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ relinkNeeded: needed }, () => resolve());
  });
}

// Who the sync token belongs to, handed over with the token by the web app (or
// minted directly by the background worker — see lib/account-link). Display-only
// (popup "Synced as <email> · Pro"); auth is the token itself.
export interface SyncProfile {
  email: string | null;
  name: string | null;
  /** null when the sender did not say — the popup omits the tier rather than
   * guessing "Free" for an account that may well be paying. */
  plan: SyncPlan | null;
}

/**
 * Fold an incoming profile payload onto whatever is already stored.
 *
 * A field the sender omits keeps its stored value; a field the sender sends as
 * null clears it. That distinction matters for `plan`: older extension builds
 * and older web builds send `{email, name}` with no plan at all, and treating
 * that as "plan: null" would blank the tier on every re-link.
 */
export function mergeSyncProfile(
  previous: SyncProfile | null,
  incoming: Partial<SyncProfile> | null | undefined
): SyncProfile {
  const base: SyncProfile = previous ?? { email: null, name: null, plan: null };
  if (!incoming || typeof incoming !== "object") return { ...base };
  return {
    email: "email" in incoming ? incoming.email ?? null : base.email,
    name: "name" in incoming ? incoming.name ?? null : base.name,
    plan: "plan" in incoming ? normalizeSyncPlan(incoming.plan) : base.plan,
  };
}

/** Only the three tiers we bill are storable — anything else is "unknown". */
export function normalizeSyncPlan(value: unknown): SyncPlan | null {
  return value === "free" || value === "pro" || value === "max" ? value : null;
}

export interface SyncStatus {
  state: "idle" | "syncing" | "ok" | "error";
  lastAttemptAt: number | null;
  lastSuccessAt: number | null;
  error: string | null;
}

const EMPTY_SYNC_STATUS: SyncStatus = {
  state: "idle",
  lastAttemptAt: null,
  lastSuccessAt: null,
  error: null,
};

export function getSyncProfile(): Promise<SyncProfile | null> {
  return new Promise((resolve) => {
    chrome.storage.local.get(["syncProfile"], (r) => {
      const p = r.syncProfile as Partial<SyncProfile> | null | undefined;
      resolve(
        p && typeof p === "object"
          ? { email: p.email ?? null, name: p.name ?? null, plan: normalizeSyncPlan(p.plan) }
          : null
      );
    });
  });
}

/** Merge-write, so a sender that knows only the email cannot blank the tier. */
export function setSyncProfile(incoming: Partial<SyncProfile> | null): Promise<void> {
  return enqueue(async () => {
    const previous = await getSyncProfile();
    await chrome.storage.local.set({ syncProfile: mergeSyncProfile(previous, incoming) });
  });
}

export function getSyncStatus(): Promise<SyncStatus> {
  return new Promise((resolve) => {
    chrome.storage.local.get(["syncStatus"], (r) => {
      const s = r.syncStatus as Partial<SyncStatus> | null | undefined;
      if (!s || typeof s !== "object") {
        resolve({ ...EMPTY_SYNC_STATUS });
        return;
      }
      const state = s.state === "syncing" || s.state === "ok" || s.state === "error" ? s.state : "idle";
      resolve({
        state,
        lastAttemptAt: Number.isFinite(s.lastAttemptAt) ? Number(s.lastAttemptAt) : null,
        lastSuccessAt: Number.isFinite(s.lastSuccessAt) ? Number(s.lastSuccessAt) : null,
        error: typeof s.error === "string" ? s.error : null,
      });
    });
  });
}

export function setSyncStatus(next: SyncStatus): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ syncStatus: next }, () => resolve());
  });
}

// --- Silent account link bookkeeping (see lib/account-link) -----------------
// The background worker can mint a sync token straight from the browser's
// animevocab.com session cookie. These two timestamps are what keep that from
// turning into a mint loop against KV (the failure mode that once burned the
// free-tier write budget): one throttles background attempts, the other stops a
// probe from silently undoing a sign-out the user just performed on the site.

export function getAutoLinkAttemptedAt(): Promise<number | null> {
  return new Promise((resolve) => {
    chrome.storage.local.get(["autoLinkAttemptedAt"], (r) => {
      const n = Number(r.autoLinkAttemptedAt);
      resolve(Number.isFinite(n) && n > 0 ? n : null);
    });
  });
}

export function setAutoLinkAttemptedAt(at: number): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ autoLinkAttemptedAt: at }, () => resolve());
  });
}

export function getAutoLinkSuppressedUntil(): Promise<number | null> {
  return new Promise((resolve) => {
    chrome.storage.local.get(["autoLinkSuppressedUntil"], (r) => {
      const n = Number(r.autoLinkSuppressedUntil);
      resolve(Number.isFinite(n) && n > 0 ? n : null);
    });
  });
}

export function getReviewPrompt(): Promise<ReviewPromptState> {
  return new Promise((resolve) => {
    chrome.storage.local.get(["reviewPrompt"], (r) => {
      resolve(normalizeReviewPrompt(r.reviewPrompt));
    });
  });
}

export function setReviewPrompt(next: ReviewPromptState): Promise<ReviewPromptState> {
  return enqueue(async () => {
    const state = normalizeReviewPrompt(next);
    await chrome.storage.local.set({ reviewPrompt: state });
    return state;
  });
}

/**
 * Atomically (within this page's storage queue) record a new ask display.
 * Re-reads before write so a popup+dashboard race that already counted a show
 * does not increment askCount twice. Returns whether this call counted a show.
 */
export function recordReviewPromptShown(now = Date.now()): Promise<boolean> {
  return enqueue(async () => {
    const r = await chrome.storage.local.get(["reviewPrompt"]);
    const prompt = normalizeReviewPrompt(r.reviewPrompt);
    if (!shouldCountShown(prompt, now)) return false;
    await chrome.storage.local.set({ reviewPrompt: applyShown(prompt, now) });
    return true;
  });
}

export function resetProgress(): Promise<void> {
  return enqueue(async () => {
    // Wipe learning progress only. reviewPrompt must survive so "No thanks",
    // Rate, and the two-ask cap remain install-lifetime preferences.
    await chrome.storage.local.set({ vocab: {}, stats: emptyStats() });
    sendBadge({ daily: {} });
  });
}
