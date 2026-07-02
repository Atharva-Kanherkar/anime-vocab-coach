export type PauseMode = "pause" | "notify" | "off";
export type DisplayScript = "romaji" | "kana" | "kanji";
export type WordState = "new" | "learning" | "known" | "ignored";
export type Judgment = "know" | "learn" | "ignore" | "review-pass" | "review-fail" | "dismiss";

export interface Settings {
  pauseMode: PauseMode;
  cooldownSec: number;
  maxCardsPerHour: number;
  targetLevel: number;
  autoResumeSec: number;
  displayScript: DisplayScript;
  autoSpeak: boolean;
  openaiKey: string;
  transcribeModel: string;
  sites: { youtube: boolean; netflix: boolean; generic: boolean };
}

export interface Srs {
  stage: number;
  dueAt: number;
  lapses: number;
}

export interface VocabRecord {
  state: WordState;
  reading: string;
  gloss: string;
  level: number;
  freqRank: number;
  seenCount: number;
  shownCount: number;
  firstSeenAt: number;
  lastSeenAt: number;
  srs: Srs | null;
}

export type VocabMap = Record<string, VocabRecord>;

export interface DailyStats {
  met: number;
  judged: number;
  reviews: number;
  watchMin: number;
}

export interface Stats {
  daily: Record<string, DailyStats>;
  cardTimestamps: number[];
}

export interface Token {
  surface: string;
  base: string;
  reading: string;
  pos: string;
  pos1: string;
}

export interface DictEntry {
  reading: string;
  glosses: string[];
  level: number;
  freqRank: number;
}

export interface Target {
  token: Token;
  entry: DictEntry;
  isReview: boolean;
}

export interface JudgmentMeta {
  reading: string;
  gloss: string;
  level: number;
  freqRank: number;
}

export interface LineContext {
  en: string;
  fromAudio?: boolean;
}

export interface SiteAdapter {
  name: "youtube" | "netflix" | "generic";
  matches(): boolean;
  getVideo(): HTMLVideoElement | null;
  /** Whatever subtitle text is on screen right now, any language. */
  getVisibleText(): string;
  start(onLine: (text: string, context: LineContext) => void): void;
}

export const DEFAULTS: Settings = {
  pauseMode: "pause",
  cooldownSec: 20,
  maxCardsPerHour: 12,
  targetLevel: 5,
  autoResumeSec: 0,
  displayScript: "romaji",
  autoSpeak: true,
  openaiKey: "",
  transcribeModel: "gpt-4o-mini-transcribe",
  sites: { youtube: true, netflix: true, generic: true }
};

export const SRS_INTERVALS = [0, 4 * 3600e3, 24 * 3600e3, 3 * 24 * 3600e3, 7 * 24 * 3600e3, 21 * 24 * 3600e3];
