import { lookup as jaLookup } from "./dictionary";
import { essentialBoost, isEssentialWord } from "./priority-words";
import { ENGLISH_ESSENTIALS } from "./english-essentials";
import type { DictEntry, Settings, Target, Token, VocabMap } from "../types";
import { normalizeDirection } from "./direction";

const ELIGIBLE_POS = ["名詞", "動詞", "形容詞", "副詞", "CONTENT"];
const EXCLUDED_NOUN_POS1 = ["代名詞", "数", "接尾", "非自立", "固有名詞"];

export function hasKanji(base: string): boolean {
  return /[\u4E00-\u9FFF]/.test(base);
}

export interface Eligibility {
  eligible: boolean;
  countSeen: boolean;
  entry?: DictEntry;
}

/** Resolve a dictionary entry for either Japanese (JMdict) or English (essentials + AI overlay). */
export function lookupForDirection(
  base: string,
  direction: Settings["learningDirection"],
  overlay?: Record<string, DictEntry> | null
): DictEntry | null {
  if (overlay?.[base]) return overlay[base]!;
  if (normalizeDirection(direction) === "ja-en") {
    const hit = ENGLISH_ESSENTIALS[base];
    if (!hit) return null;
    return {
      reading: "",
      glosses: [hit.gloss],
      level: hit.level,
      freqRank: Math.round((6 - hit.level) * 2000),
    };
  }
  return jaLookup(base);
}

export function checkEligibility(
  token: Token,
  wordStates: VocabMap,
  targetedSet: Set<string> | null,
  now: number = Date.now(),
  direction: Settings["learningDirection"] = "en-ja",
  overlay?: Record<string, DictEntry> | null
): Eligibility {
  const { base, pos, pos1 } = token;
  const dir = normalizeDirection(direction);
  const isEnglish = dir === "ja-en" || pos === "CONTENT";

  if (!ELIGIBLE_POS.includes(pos)) {
    return { eligible: false, countSeen: false };
  }
  if (!isEnglish && pos === "名詞" && EXCLUDED_NOUN_POS1.includes(pos1)) {
    return { eligible: false, countSeen: false };
  }
  if (!isEnglish && base.length < 2 && !hasKanji(base) && !isEssentialWord(base)) {
    return { eligible: false, countSeen: false };
  }
  if (isEnglish && base.length < 2) {
    return { eligible: false, countSeen: false };
  }

  const entry = lookupForDirection(base, dir, overlay);
  if (!entry) {
    return { eligible: false, countSeen: false };
  }

  const rec = wordStates[base];
  const state = rec?.state;
  if (state === "known" || state === "ignored") {
    return { eligible: false, countSeen: true, entry };
  }
  // A word being learned is only eligible when its review is actually due.
  // Otherwise it must NOT fall through to the new-word path — showing it as a
  // fresh "learn" card would reset its SRS progress. It's still counted as seen.
  if (state === "learning") {
    const due = !!rec?.srs && rec.srs.dueAt <= now;
    if (!due) return { eligible: false, countSeen: true, entry };
  }
  if (targetedSet && targetedSet.has(base)) {
    return { eligible: false, countSeen: true, entry };
  }

  return { eligible: true, countSeen: true, entry };
}

export function collectEligible(
  tokens: Token[],
  wordStates: VocabMap,
  targetedSet: Set<string>,
  direction: Settings["learningDirection"] = "en-ja",
  overlay?: Record<string, DictEntry> | null
): { dueReview: Target | null; newWords: Target[] } {
  const survivors: { token: Token; entry: DictEntry }[] = [];
  const now = Date.now();

  for (const token of tokens) {
    const check = checkEligibility(token, wordStates, targetedSet, now, direction, overlay);
    if (check.eligible && check.entry) {
      survivors.push({ token, entry: check.entry });
    }
  }

  const dueReviews = survivors.filter(({ token }) => {
    const rec = wordStates[token.base];
    return rec?.state === "learning" && rec.srs && rec.srs.dueAt <= now;
  });

  if (dueReviews.length) {
    dueReviews.sort((a, b) => {
      const aDue = wordStates[a.token.base].srs!.dueAt;
      const bDue = wordStates[b.token.base].srs!.dueAt;
      return aDue - bDue;
    });
    const pick = dueReviews[0];
    return {
      dueReview: { token: pick.token, entry: pick.entry, isReview: true },
      newWords: [],
    };
  }

  return {
    dueReview: null,
    newWords: survivors.map(({ token, entry }) => ({ token, entry, isReview: false })),
  };
}

/** Heuristic fallback when AI pick is unavailable. */
export function pickTargetHeuristic(
  newWords: Target[],
  wordStates: VocabMap,
  settings: Settings
): Target | null {
  let best: Target | null = null;
  let bestScore = -1;
  const dir = normalizeDirection(settings.learningDirection);

  for (const { token, entry } of newWords) {
    const essential =
      dir === "ja-en"
        ? ENGLISH_ESSENTIALS[token.base]
          ? 0.25
          : 0
        : essentialBoost(token.base, settings.targetLevel);
    const freqScore = 1 - Math.min(entry.freqRank, 20000) / 20000;
    const levelScore = 1 - Math.abs(entry.level - settings.targetLevel) / 4;
    const familiarity = Math.min(wordStates[token.base]?.seenCount || 0, 5) / 5;
    const score = 0.35 * freqScore + 0.30 * levelScore + 0.15 * familiarity + essential;
    const minScore = essential > 0 ? 0.22 : 0.35;

    if (score < minScore) continue;

    if (!best || score > bestScore || (score === bestScore && entry.freqRank < best.entry.freqRank)) {
      bestScore = score;
      best = { token, entry, isReview: false };
    }
  }

  return best;
}

export function pickTarget(
  tokens: Token[],
  wordStates: VocabMap,
  settings: Settings,
  targetedSet: Set<string>,
  overlay?: Record<string, DictEntry> | null
): Target | null {
  const { dueReview, newWords } = collectEligible(
    tokens,
    wordStates,
    targetedSet,
    settings.learningDirection,
    overlay
  );
  if (dueReview) return dueReview;
  return pickTargetHeuristic(newWords, wordStates, settings);
}
