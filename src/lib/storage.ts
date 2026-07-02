import { warn } from "./log";
import { checkEligibility } from "./scoring";
import { lookup } from "./dictionary";
import { DEFAULTS, SRS_INTERVALS } from "../types";
import type { Judgment, JudgmentMeta, Settings, Stats, Token, VocabMap, VocabRecord, WordState } from "../types";

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

export function getSettings(): Promise<Settings> {
  return new Promise((resolve) => {
    chrome.storage.local.get(["settings"], (r) => {
      resolve({ ...DEFAULTS, ...(r.settings || {}) });
    });
  });
}

export function setSettings(partial: Partial<Settings>): Promise<Settings> {
  return enqueue(async () => {
    const r = await chrome.storage.local.get(["settings"]);
    const settings: Settings = { ...DEFAULTS, ...(r.settings || {}), ...partial };
    await chrome.storage.local.set({ settings });
    return settings;
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

export function recordSeen(tokens: Token[], wordStates: VocabMap, targetedSet: Set<string>): Promise<void> {
  return enqueue(async () => {
    const r = await chrome.storage.local.get(["vocab", "stats"]);
    const vocab: VocabMap = { ...((r.vocab as VocabMap | undefined) || {}) };
    const stats: Stats = (r.stats as Stats | undefined) || emptyStats();
    const day = todayKey();
    const daily = ensureDaily(stats, day);
    let changed = false;

    for (const token of tokens) {
      const eligibility = checkEligibility(token, wordStates, targetedSet);
      if (!eligibility.countSeen) continue;

      const entry = lookup(token.base);
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
    }
  });
}

export function judgeWord(base: string, judgment: Judgment, meta: JudgmentMeta): Promise<VocabRecord> {
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
        settings: { ...DEFAULTS, ...(r.settings || {}) },
        vocab: (r.vocab as VocabMap | undefined) || {},
        stats: (r.stats as Stats | undefined) || emptyStats(),
        exportedAt: new Date().toISOString()
      });
    });
  });
}

export function resetProgress(): Promise<void> {
  return enqueue(async () => {
    await chrome.storage.local.set({ vocab: {}, stats: emptyStats() });
    sendBadge({ daily: {} });
  });
}
