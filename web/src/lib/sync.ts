export type WordState = "new" | "learning" | "known" | "ignored";

export interface AnimeVocabExport {
  settings?: Record<string, unknown>;
  vocab?: Record<string, Partial<ExtensionVocabRecord>>;
  stats?: Partial<ExtensionStats>;
  exportedAt?: string;
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

function asWordState(value: unknown): WordState {
  return value === "learning" || value === "known" || value === "ignored" ? value : "new";
}

function timeToIso(value: unknown): string | null {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return new Date(n).toISOString();
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
    words: Object.entries(vocab)
      .map(([base, raw]) => {
        const rec = asRecord(raw);
        const srs = asRecord(rec.srs);
        const hasSrs = rec.srs !== null && Object.keys(srs).length > 0;
        return {
          base,
          state: asWordState(rec.state),
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

export function parseAnimeVocabExportJson(text: string): CloudSyncSnapshot {
  const parsed = JSON.parse(text) as AnimeVocabExport;
  return normalizeAnimeVocabExport(parsed);
}
