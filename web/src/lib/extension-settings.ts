import {
  normalizeDirection,
  type LearningDirection,
} from "./direction";

export type PauseMode = "copilot" | "pause" | "off";
export type DisplayScript = "romaji" | "kana" | "kanji";

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

export function parseExtensionSettings(raw: Record<string, unknown> | undefined): ExtensionSettings {
  const d = EXTENSION_SETTINGS_DEFAULTS;
  const sites = (raw?.sites as Record<string, boolean> | undefined) || {};
  let pauseMode = raw?.pauseMode;
  if (pauseMode === "notify") pauseMode = "copilot";

  return {
    pauseMode:
      pauseMode === "copilot" || pauseMode === "pause" || pauseMode === "off"
        ? pauseMode
        : d.pauseMode,
    cooldownSec: clampNum(raw?.cooldownSec, 5, 120, d.cooldownSec),
    maxCardsPerHour: clampNum(raw?.maxCardsPerHour, 1, 60, d.maxCardsPerHour),
    targetLevel: clampNum(raw?.targetLevel, 1, 5, d.targetLevel),
    autoResumeSec: clampNum(raw?.autoResumeSec, 0, 120, d.autoResumeSec),
    displayScript:
      raw?.displayScript === "kana" || raw?.displayScript === "kanji" || raw?.displayScript === "romaji"
        ? raw.displayScript
        : d.displayScript,
    learningDirection: normalizeDirection(raw?.learningDirection),
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
