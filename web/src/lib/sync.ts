export type WordState = "new" | "learning" | "known" | "ignored";

export interface AnimeVocabExport {
  settings?: Record<string, unknown>;
  vocab?: Record<string, Partial<ExtensionVocabRecord>>;
  stats?: Partial<ExtensionStats>;
  exportedAt?: string;
}

export interface CloudUserProfile {
  id: string;
  email: string | null;
  name: string | null;
}

/** Where a word was first learned (anime title + the line it appeared in). */
export interface WordSource {
  title: string | null;
  line: string | null;
  en: string | null;
}

export interface ExtensionVocabRecord {
  state: WordState;
  reading: string;
  gloss: string;
  level: number;
  freqRank: number;
  seenCount: number;
  shownCount: number;
  firstSeenAt: number;
  lastSeenAt: number;
  srs: { stage: number; dueAt: number; lapses: number } | null;
  source?: WordSource | null;
}

export interface ExtensionDailyStats {
  met: number;
  judged: number;
  reviews: number;
  watchMin: number;
}

export interface ExtensionStats {
  daily: Record<string, Partial<ExtensionDailyStats>>;
  cardTimestamps: number[];
}

export interface CloudWordRecord {
  base: string;
  state: WordState;
  reading: string;
  gloss: string;
  level: number | null;
  freqRank: number | null;
  seenCount: number;
  shownCount: number;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  review: {
    stage: number;
    dueAt: string | null;
    lapses: number;
  } | null;
  source: WordSource | null;
}

export interface CloudDailyStats {
  day: string;
  met: number;
  judged: number;
  reviews: number;
  watchMin: number;
}

export interface CloudSyncSnapshot {
  schemaVersion: 1;
  source: "animevocab-extension";
  importedAt: string;
  sourceExportedAt: string | null;
  settings: Record<string, unknown>;
  words: CloudWordRecord[];
  daily: CloudDailyStats[];
  cardTimestamps: number[];
}

export type ExtensionSyncConnectionState =
  | "local-only"
  | "connected-synced"
  | "sync-error"
  | "disconnected";

export interface ExtensionSyncStatus {
  state: ExtensionSyncConnectionState;
  userId: string | null;
  lastSyncedAt: string | null;
  revision: number | null;
  message: string | null;
}

export interface CloudSyncEnvelope {
  schemaVersion: 1;
  profile: CloudUserProfile;
  snapshot: CloudSyncSnapshot;
  revision: number;
  lastSyncedAt: string;
}

export interface SyncConflict {
  type: "revision-conflict";
  expectedRevision: number | null;
  currentRevision: number;
  currentEnvelope: CloudSyncEnvelope;
}

export interface SyncSummary {
  totalWords: number;
  newWords: number;
  learningWords: number;
  knownWords: number;
  ignoredWords: number;
  reviewsDue: number;
  watchMinutes: number;
  judgedCards: number;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asNumber(value: unknown, fallback = 0): number {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asWordState(value: unknown, base = "word"): WordState {
  if (value === undefined || value === null || value === "new") return "new";
  if (value === "learning" || value === "known" || value === "ignored") return value;
  throw new Error(`Invalid word state for ${base}.`);
}

function timeToIso(value: unknown): string | null {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return new Date(n).toISOString();
}

function isoToTime(value: string | null): number {
  if (!value) return 0;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : 0;
}

function normalizeIsoString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

function asTimestampArray(value: unknown): number[] {
  return Array.isArray(value)
    ? value.map(Number).filter((n) => Number.isFinite(n) && n > 0)
    : [];
}

const MAX_SOURCE_TITLE = 200;
const MAX_SOURCE_LINE = 500;

function clampOrNull(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim().slice(0, max);
  return t.length ? t : null;
}

// Normalize a word's capture context. Returns null unless it carries something.
function asWordSource(value: unknown): WordSource | null {
  if (!value || typeof value !== "object") return null;
  const s = value as Record<string, unknown>;
  const title = clampOrNull(s.title, MAX_SOURCE_TITLE);
  const line = clampOrNull(s.line, MAX_SOURCE_LINE);
  const en = clampOrNull(s.en, MAX_SOURCE_LINE);
  if (!title && !line && !en) return null;
  return { title, line, en };
}

export function normalizeAnimeVocabExport(
  input: AnimeVocabExport,
  now = new Date()
): CloudSyncSnapshot {
  const vocab = asRecord(input.vocab);
  const stats = input.stats || {};
  const daily = asRecord(stats.daily);

  return {
    schemaVersion: 1,
    source: "animevocab-extension",
    importedAt: now.toISOString(),
    sourceExportedAt: typeof input.exportedAt === "string" ? input.exportedAt : null,
    settings: asRecord(input.settings),
    cardTimestamps: asTimestampArray(stats.cardTimestamps),
    words: Object.entries(vocab)
      .map(([base, raw]) => {
        const rec = asRecord(raw);
        const srs = asRecord(rec.srs);
        const hasSrs = rec.srs !== null && Object.keys(srs).length > 0;
        return {
          base,
          state: asWordState(rec.state, base),
          reading: asString(rec.reading),
          gloss: asString(rec.gloss),
          level: Number.isFinite(Number(rec.level)) ? Number(rec.level) : null,
          freqRank: Number.isFinite(Number(rec.freqRank)) ? Number(rec.freqRank) : null,
          seenCount: asNumber(rec.seenCount),
          shownCount: asNumber(rec.shownCount),
          firstSeenAt: timeToIso(rec.firstSeenAt),
          lastSeenAt: timeToIso(rec.lastSeenAt),
          review: hasSrs
            ? {
                stage: asNumber(srs.stage),
                dueAt: timeToIso(srs.dueAt),
                lapses: asNumber(srs.lapses),
              }
            : null,
          source: asWordSource(rec.source),
        } satisfies CloudWordRecord;
      })
      .sort((a, b) => a.base.localeCompare(b.base)),
    daily: Object.entries(daily)
      .map(([day, raw]) => {
        const rec = asRecord(raw);
        return {
          day,
          met: asNumber(rec.met),
          judged: asNumber(rec.judged),
          reviews: asNumber(rec.reviews),
          watchMin: asNumber(rec.watchMin),
        };
      })
      .sort((a, b) => a.day.localeCompare(b.day)),
  };
}

export function normalizeCloudSyncSnapshot(input: unknown, now = new Date()): CloudSyncSnapshot {
  const raw = asRecord(input);
  const words = Array.isArray(raw.words) ? raw.words : [];
  const daily = Array.isArray(raw.daily) ? raw.daily : [];

  if (raw.schemaVersion !== 1 || raw.source !== "animevocab-extension") {
    throw new Error("invalid_snapshot");
  }

  return {
    schemaVersion: 1,
    source: "animevocab-extension",
    importedAt: normalizeIsoString(raw.importedAt) ?? now.toISOString(),
    sourceExportedAt: normalizeIsoString(raw.sourceExportedAt),
    settings: asRecord(raw.settings),
    cardTimestamps: asTimestampArray(raw.cardTimestamps),
    words: words
      .map((value) => {
        const rec = asRecord(value);
        const review = asRecord(rec.review);
        const hasReview = rec.review !== null && Object.keys(review).length > 0;
        const base = asString(rec.base);
        if (!base) throw new Error("invalid_snapshot");
        return {
          base,
          state: asWordState(rec.state, base),
          reading: asString(rec.reading),
          gloss: asString(rec.gloss),
          level: Number.isFinite(Number(rec.level)) ? Number(rec.level) : null,
          freqRank: Number.isFinite(Number(rec.freqRank)) ? Number(rec.freqRank) : null,
          seenCount: asNumber(rec.seenCount),
          shownCount: asNumber(rec.shownCount),
          firstSeenAt: normalizeIsoString(rec.firstSeenAt),
          lastSeenAt: normalizeIsoString(rec.lastSeenAt),
          review: hasReview
            ? {
                stage: asNumber(review.stage),
                dueAt: normalizeIsoString(review.dueAt),
                lapses: asNumber(review.lapses),
              }
            : null,
          source: asWordSource(rec.source),
        } satisfies CloudWordRecord;
      })
      .sort((a, b) => a.base.localeCompare(b.base)),
    daily: daily
      .map((value) => {
        const rec = asRecord(value);
        const day = asString(rec.day);
        if (!day) throw new Error("invalid_snapshot");
        return {
          day,
          met: asNumber(rec.met),
          judged: asNumber(rec.judged),
          reviews: asNumber(rec.reviews),
          watchMin: asNumber(rec.watchMin),
        } satisfies CloudDailyStats;
      })
      .sort((a, b) => a.day.localeCompare(b.day)),
  };
}

export function summarizeSyncSnapshot(snapshot: CloudSyncSnapshot, now = new Date()): SyncSummary {
  const dueTime = now.getTime();
  return {
    totalWords: snapshot.words.length,
    newWords: snapshot.words.filter((w) => w.state === "new").length,
    learningWords: snapshot.words.filter((w) => w.state === "learning").length,
    knownWords: snapshot.words.filter((w) => w.state === "known").length,
    ignoredWords: snapshot.words.filter((w) => w.state === "ignored").length,
    reviewsDue: snapshot.words.filter((w) => w.review?.dueAt && Date.parse(w.review.dueAt) <= dueTime).length,
    watchMinutes: snapshot.daily.reduce((sum, day) => sum + day.watchMin, 0),
    judgedCards: snapshot.daily.reduce((sum, day) => sum + day.judged, 0),
  };
}

export function pickRecentWords(snapshot: CloudSyncSnapshot, limit = 5): CloudWordRecord[] {
  return [...snapshot.words]
    .filter((word) => word.lastSeenAt)
    .sort((a, b) => Date.parse(b.lastSeenAt!) - Date.parse(a.lastSeenAt!))
    .slice(0, limit);
}

export function pickDueReviews(snapshot: CloudSyncSnapshot, now = new Date(), limit = 5): CloudWordRecord[] {
  const dueTime = now.getTime();
  return [...snapshot.words]
    .filter((word) => word.review?.dueAt && Date.parse(word.review.dueAt) <= dueTime)
    .sort((a, b) => Date.parse(a.review!.dueAt!) - Date.parse(b.review!.dueAt!))
    .slice(0, limit);
}

export function parseAnimeVocabExportJson(text: string): CloudSyncSnapshot {
  const parsed = JSON.parse(text) as AnimeVocabExport;
  return normalizeAnimeVocabExport(parsed);
}

export function cloudSnapshotToAnimeVocabExport(snapshot: CloudSyncSnapshot): AnimeVocabExport {
  const vocab: Record<string, ExtensionVocabRecord> = {};
  const daily: Record<string, ExtensionDailyStats> = {};

  for (const word of snapshot.words) {
    const rec: ExtensionVocabRecord = {
      state: word.state,
      reading: word.reading,
      gloss: word.gloss,
      level: word.level ?? 0,
      freqRank: word.freqRank ?? 0,
      seenCount: word.seenCount,
      shownCount: word.shownCount,
      firstSeenAt: isoToTime(word.firstSeenAt),
      lastSeenAt: isoToTime(word.lastSeenAt),
      srs: word.review
        ? {
            stage: word.review.stage,
            dueAt: isoToTime(word.review.dueAt),
            lapses: word.review.lapses,
          }
        : null,
    };
    // Only attach source when there is one, so words without capture context
    // don't gain a null key on export.
    if (word.source) rec.source = word.source;
    vocab[word.base] = rec;
  }

  for (const day of snapshot.daily) {
    daily[day.day] = {
      met: day.met,
      judged: day.judged,
      reviews: day.reviews,
      watchMin: day.watchMin,
    };
  }

  return {
    settings: snapshot.settings,
    vocab,
    stats: { daily, cardTimestamps: snapshot.cardTimestamps },
    exportedAt: snapshot.sourceExportedAt ?? snapshot.importedAt,
  };
}

export function createCloudSyncEnvelope(
  profile: CloudUserProfile,
  snapshot: CloudSyncSnapshot,
  revision = 1,
  now = new Date()
): CloudSyncEnvelope {
  return {
    schemaVersion: 1,
    profile,
    snapshot,
    revision,
    lastSyncedAt: now.toISOString(),
  };
}

export function applyCloudSyncUpdate(
  current: CloudSyncEnvelope | null,
  profile: CloudUserProfile,
  snapshot: CloudSyncSnapshot,
  expectedRevision: number | null,
  now = new Date()
): CloudSyncEnvelope | SyncConflict {
  if (current && expectedRevision !== current.revision) {
    return {
      type: "revision-conflict",
      expectedRevision,
      currentRevision: current.revision,
      currentEnvelope: current,
    };
  }

  return createCloudSyncEnvelope(profile, snapshot, current ? current.revision + 1 : 1, now);
}
