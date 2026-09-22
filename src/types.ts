export type PauseMode = "copilot" | "pause" | "off";
/** `romaji-kana` shows both scripts at full size: romaji to read now, kana
 * directly under it to start recognising. The bridge between the two. */
export type DisplayScript = "romaji" | "kana" | "kanji" | "romaji-kana";
/** en-ja = English speakers learn Japanese; ja-en = Japanese speakers learn English. */
export type LearningDirection = "en-ja" | "ja-en";
export type WordState = "new" | "learning" | "known" | "ignored";
export type Judgment = "know" | "learn" | "ignore" | "review-pass" | "review-fail" | "dismiss";

export interface Settings {
  pauseMode: PauseMode;
  cooldownSec: number;
  maxCardsPerHour: number;
  targetLevel: number;
  autoResumeSec: number;
  displayScript: DisplayScript;
  /** Which side of the bilingual pair you study. Default: learn Japanese. */
  learningDirection: LearningDirection;
  autoSpeak: boolean;
  /** Interactive subtitle overlay: hover any word for lookup, click/Q to save. */
  subLens: boolean;
  /** Pause the video while a Subtitle Lens popup is open. */
  subLensPeek: boolean;
  openaiKey: string;
  transcribeModel: string;
  sites: { youtube: boolean; netflix: boolean; generic: boolean };
}

export interface Srs {
  stage: number;
  dueAt: number;
  lapses: number;
}

/** Where a word was first learned — the anime title and the line it appeared in.
 * Captured once (at first judgment) so reviews, notebooks, and per-show stats
 * keep the scene context instead of showing a bare word. */
export interface WordSource {
  title: string | null; // anime / video title
  line: string | null; // the Japanese line the word appeared in
  en: string | null; // the on-screen English (or other) context line
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
  source?: WordSource | null;
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

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

/** Billing tier a linked account is on. Shared by the popup account row, the
 * usage meters and the stored sync profile so there is one spelling of it. */
export type SyncPlan = "free" | "pro" | "max";

export interface SiteAdapter {
  name: "youtube" | "netflix" | "generic";
  matches(): boolean;
  getVideo(): HTMLVideoElement | null;
  /** Whatever subtitle text is on screen right now, any language. */
  getVisibleText(): string;
  /** `onClear` fires when the study-language subtitle leaves the screen, so
   * the Subtitle Lens can follow the native line off instead of lingering. */
  start(onLine: (text: string, context: LineContext) => void, onClear?: () => void): void;
}

export const DEFAULTS: Settings = {
  pauseMode: "copilot",
  cooldownSec: 20,
  maxCardsPerHour: 12,
  targetLevel: 5,
  autoResumeSec: 15,
  displayScript: "romaji",
  learningDirection: "en-ja",
  autoSpeak: true,
  subLens: true,
  subLensPeek: true,
  openaiKey: "",
  transcribeModel: "gpt-4o-mini-transcribe",
  sites: { youtube: true, netflix: true, generic: true }
};

export const SRS_INTERVALS = [0, 4 * 3600e3, 24 * 3600e3, 3 * 24 * 3600e3, 7 * 24 * 3600e3, 21 * 24 * 3600e3];
