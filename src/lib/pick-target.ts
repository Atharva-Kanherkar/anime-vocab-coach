import * as scoring from "./scoring";
import { isEssentialWord } from "./priority-words";
import { ENGLISH_ESSENTIALS } from "./english-essentials";
import { fetchWordPick } from "./word-picker-client";
import { peekAnimeContext } from "./anime-context-client";
import { normalizeDirection } from "./direction";
import type { DictEntry, Settings, Target, Token, VocabMap } from "../types";

function countProgress(vocab: VocabMap): number {
  let n = 0;
  for (const rec of Object.values(vocab)) {
    if (rec.state === "known" || rec.state === "learning") n++;
  }
  return n;
}

/**
 * Pick the best word to show: due reviews first, then AI (gpt-4.1-nano) among
 * eligible candidates, then heuristic fallback if offline / quota / error.
 */
export async function pickTargetSmart(
  tokens: Token[],
  wordStates: VocabMap,
  settings: Settings,
  targetedSet: Set<string>,
  line: string,
  title: string | null,
  overlay?: Record<string, DictEntry> | null
): Promise<Target | null> {
  const direction = normalizeDirection(settings.learningDirection);
  const { dueReview, newWords } = scoring.collectEligible(
    tokens,
    wordStates,
    targetedSet,
    direction,
    overlay
  );
  if (dueReview) return dueReview;
  if (!newWords.length) return null;
  if (newWords.length === 1) return newWords[0]!;

  const candidates = newWords.slice(0, 12).map(({ token, entry }) => ({
    word: token.base,
    reading: entry.reading,
    gloss: entry.glosses[0] || "",
    level: entry.level,
    essential:
      direction === "ja-en"
        ? !!ENGLISH_ESSENTIALS[token.base]
        : isEssentialWord(token.base),
  }));

  const ai = await fetchWordPick({
    line,
    candidates,
    learnerLevel: settings.targetLevel,
    wordsKnown: countProgress(wordStates),
    title,
    animeContext: peekAnimeContext(title),
    direction,
  });

  if (ai.ok && ai.word) {
    const match = newWords.find((t) => t.token.base === ai.word || t.token.surface === ai.word);
    if (match) return match;
  }

  return scoring.pickTargetHeuristic(newWords, wordStates, settings);
}

/** Sync fallback — same as before AI picker. */
export function pickTarget(
  tokens: Token[],
  wordStates: VocabMap,
  settings: Settings,
  targetedSet: Set<string>,
  overlay?: Record<string, DictEntry> | null
): Target | null {
  return scoring.pickTarget(tokens, wordStates, settings, targetedSet, overlay);
}
