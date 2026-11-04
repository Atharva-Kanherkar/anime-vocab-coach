import type { LearningDirection } from "./direction";
import { resolveLearningDirection } from "./locale-direction";
import type { SiteLocale } from "./locale";

export type PauseMode = "copilot" | "pause" | "off";
/** Mirrors the extension's `DisplayScript` (src/types.ts) — separate builds,
 * so both must be updated together. `romaji-kana` shows both scripts at once. */
export type DisplayScript = "romaji" | "kana" | "kanji" | "romaji-kana";

export interface ExtensionSettings {
  pauseMode: PauseMode;
  cooldownSec: number;
  maxCardsPerHour: number;
  targetLevel: number;
  autoResumeSec: number;
  displayScript: DisplayScript;
  learningDirection: LearningDirection;
  autoSpeak: boolean;
  sites: { youtube: boolean; netflix: boolean; generic: boolean };
}

/** Every accepted `displayScript`. An unlisted value is silently reset to the
 * default on sync, so a new script must be added here as well as to the type. */
export const DISPLAY_SCRIPTS: readonly DisplayScript[] = [
  "romaji",
  "romaji-kana",
  "kana",
  "kanji",
] as const;

export const EXTENSION_SETTINGS_DEFAULTS: ExtensionSettings = {
  pauseMode: "copilot",
  cooldownSec: 20,
  maxCardsPerHour: 12,
  targetLevel: 5,
  autoResumeSec: 15,
  displayScript: "romaji",
  learningDirection: "en-ja",
  autoSpeak: true,
  sites: { youtube: true, netflix: true, generic: true },
};

export function parseExtensionSettings(
  raw: Record<string, unknown> | undefined,
  locale: SiteLocale = "en"
): ExtensionSettings {
  const d = EXTENSION_SETTINGS_DEFAULTS;
  const sites = (raw?.sites as Record<string, boolean> | undefined) || {};
  let pauseMode = raw?.pauseMode;
  if (pauseMode === "notify") pauseMode = "copilot";

  const hasExplicitDirection =
    raw?.learningDirection === "ja-en" || raw?.learningDirection === "en-ja";

  return {
    pauseMode:
      pauseMode === "copilot" || pauseMode === "pause" || pauseMode === "off"
        ? pauseMode
        : d.pauseMode,
    cooldownSec: clampNum(raw?.cooldownSec, 5, 120, d.cooldownSec),
    maxCardsPerHour: clampNum(raw?.maxCardsPerHour, 1, 60, d.maxCardsPerHour),
    targetLevel: clampNum(raw?.targetLevel, 1, 5, d.targetLevel),
    autoResumeSec: clampNum(raw?.autoResumeSec, 0, 120, d.autoResumeSec),
    displayScript: DISPLAY_SCRIPTS.includes(raw?.displayScript as DisplayScript)
      ? (raw!.displayScript as DisplayScript)
      : d.displayScript,
    learningDirection: hasExplicitDirection
      ? (raw!.learningDirection as LearningDirection)
      : resolveLearningDirection(undefined, locale),
    autoSpeak: raw?.autoSpeak !== false,
    sites: {
      youtube: sites.youtube !== false,
      netflix: sites.netflix !== false,
      generic: sites.generic !== false,
    },
  };
}

function clampNum(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

export function settingsToRecord(settings: ExtensionSettings): Record<string, unknown> {
  return { ...settings };
}
