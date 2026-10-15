// Backup files: what Export writes and Import reads back (ISO 25010
// reliability: recoverability). Export existed with no way to restore it.
//
// Import never deletes and never rolls progress backwards. It merges the way
// cloud sync does (web/src/lib/sync.ts mergeCloudSnapshots): per word, the copy
// seen most recently wins, but the earliest first-seen and the larger seen and
// shown counts survive; per day, each counter takes the larger value.
import type { DailyStats, Stats, VocabMap, VocabRecord, WordState } from "../types";

export const BACKUP_MAX_BYTES = 20 * 1024 * 1024;
const MAX_CARD_TIMESTAMPS = 10_000;
const STATES: readonly WordState[] = ["new", "learning", "known", "ignored"];

export interface Backup {
  vocab: VocabMap;
  stats: Stats;
}

const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const str = (v: unknown): v is string => typeof v === "string";

/** One word from a backup, or null if it is not a word record we wrote. */
function readRecord(raw: unknown): VocabRecord | null {
  const r = raw as Partial<VocabRecord> | null;
  if (!r || typeof r !== "object") return null;
  if (!STATES.includes(r.state as WordState) || !str(r.reading) || !str(r.gloss)) return null;
  if (![r.level, r.freqRank, r.seenCount, r.shownCount, r.firstSeenAt, r.lastSeenAt].every(num)) return null;
  let srs: VocabRecord["srs"] = null;
  if (r.srs != null) {
    const s = r.srs;
    if (!num(s.stage) || s.stage < 1 || s.stage > 5 || !num(s.dueAt) || !num(s.lapses)) return null;
    srs = { stage: s.stage, dueAt: s.dueAt, lapses: s.lapses };
  }
  const source = r.source && typeof r.source === "object"
    ? { title: str(r.source.title) ? r.source.title : null, line: str(r.source.line) ? r.source.line : null, en: str(r.source.en) ? r.source.en : null }
    : null;
  return {
    state: r.state as WordState,
    reading: r.reading,
    gloss: r.gloss,
    level: r.level!,
    freqRank: r.freqRank!,
    seenCount: r.seenCount!,
    shownCount: r.shownCount!,
    firstSeenAt: r.firstSeenAt!,
    lastSeenAt: r.lastSeenAt!,
    srs,
    ...(source ? { source } : {}),
  };
}

function readDaily(raw: unknown): DailyStats | null {
  const d = raw as Partial<DailyStats> | null;
  if (!d || typeof d !== "object") return null;
  const n = (v: unknown) => (num(v) && v >= 0 ? v : 0);
  return { met: n(d.met), judged: n(d.judged), reviews: n(d.reviews), watchMin: n(d.watchMin) };
}

/** Validate a parsed backup file. Malformed words are dropped and counted
 * rather than failing the whole file. */
export function parseBackup(json: unknown): { ok: true; backup: Backup; skipped: number } | { ok: false; error: string } {
  const data = json as { vocab?: unknown; stats?: unknown } | null;
  if (!data || typeof data !== "object" || !data.vocab || typeof data.vocab !== "object") {
    return { ok: false, error: "This isn't an AnimeVocab backup (no word list in it)." };
  }
  const vocab: VocabMap = {};
  let skipped = 0;
  for (const [base, raw] of Object.entries(data.vocab as Record<string, unknown>)) {
    const rec = base && base.length <= 64 ? readRecord(raw) : null;
    if (rec) vocab[base] = rec;
    else skipped++;
  }
  const rawStats = (data.stats || {}) as { daily?: unknown; cardTimestamps?: unknown };
  const daily: Record<string, DailyStats> = {};
  if (rawStats.daily && typeof rawStats.daily === "object") {
    for (const [day, raw] of Object.entries(rawStats.daily as Record<string, unknown>)) {
      const d = /^\d{4}-\d{2}-\d{2}$/.test(day) ? readDaily(raw) : null;
      if (d) daily[day] = d;
    }
  }
  const cardTimestamps = Array.isArray(rawStats.cardTimestamps) ? rawStats.cardTimestamps.filter(num) : [];
  return { ok: true, backup: { vocab, stats: { daily, cardTimestamps } }, skipped };
}

function mergeRecord(mine: VocabRecord, theirs: VocabRecord): VocabRecord {
  const winner = theirs.lastSeenAt > mine.lastSeenAt ? theirs : mine;
  return {
    ...winner,
    firstSeenAt: Math.min(mine.firstSeenAt, theirs.firstSeenAt),
    seenCount: Math.max(mine.seenCount, theirs.seenCount),
    shownCount: Math.max(mine.shownCount, theirs.shownCount),
  };
}

/** Merge a backup into what this browser holds. Pure. */
export function mergeBackup(
  current: Backup,
  incoming: Backup
): { merged: Backup; added: number; updated: number } {
  const vocab: VocabMap = { ...current.vocab };
  let added = 0;
  let updated = 0;
  for (const [base, rec] of Object.entries(incoming.vocab)) {
    const mine = vocab[base];
    if (!mine) {
      vocab[base] = rec;
      added++;
      continue;
    }
    const next = mergeRecord(mine, rec);
    if (JSON.stringify(next) !== JSON.stringify(mine)) updated++;
    vocab[base] = next;
  }
  const daily: Record<string, DailyStats> = { ...(current.stats.daily || {}) };
  for (const [day, d] of Object.entries(incoming.stats.daily)) {
    const e = daily[day];
    daily[day] = e
      ? { met: Math.max(e.met, d.met), judged: Math.max(e.judged, d.judged), reviews: Math.max(e.reviews, d.reviews), watchMin: Math.max(e.watchMin, d.watchMin) }
      : d;
  }
  const stamps = [...new Set([...(current.stats.cardTimestamps || []), ...incoming.stats.cardTimestamps])].sort((a, b) => a - b);
  return {
    merged: { vocab, stats: { daily, cardTimestamps: stamps.slice(-MAX_CARD_TIMESTAMPS) } },
    added,
    updated,
  };
}
