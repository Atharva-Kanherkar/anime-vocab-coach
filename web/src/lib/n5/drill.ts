/** Instant-feedback recognition rounds built from a lesson's vocabulary. Pure and seeded. */
export interface DrillCard { id: string; reading: string; meaning: string; audio: string }
export type DrillKind = "meaning" | "word" | "listen";
export interface DrillRound {
  key: string;
  kind: DrillKind;
  cardId: string;
  /** meaning: show the English, pick the Japanese. word: show Japanese, pick English. listen: play audio, pick English. */
  prompt: string;
  audio: string | null;
  options: { id: string; label: string; japanese: boolean }[];
  answerId: string;
}

function random(seed: number) {
  let state = seed >>> 0 || 1;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}
function shuffled<T>(items: T[], next: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function roundFor(card: DrillCard, cards: DrillCard[], kind: DrillKind, next: () => number, key: string): DrillRound {
  const label = (c: DrillCard) => (kind === "meaning" ? c.reading : c.meaning);
  const others = shuffled(cards.filter((c) => c.id !== card.id && label(c).toLowerCase() !== label(card).toLowerCase()), next);
  const distractors: DrillCard[] = [];
  for (const other of others) {
    if (distractors.length === 2) break;
    if (!distractors.some((d) => label(d).toLowerCase() === label(other).toLowerCase())) distractors.push(other);
  }
  const options = shuffled([card, ...distractors], next).map((c) => ({ id: c.id, label: label(c), japanese: kind === "meaning" }));
  return { key, kind, cardId: card.id, prompt: kind === "meaning" ? card.meaning : kind === "word" ? card.reading : "", audio: kind === "listen" ? card.audio : null, options, answerId: card.id };
}

/** One round per card, cycling round kinds, in a seeded order. Needs at least three cards. */
export function buildDrill(cards: DrillCard[], seed: number, kinds: DrillKind[] = ["meaning", "listen", "word"]): DrillRound[] {
  if (cards.length < 3) return [];
  const next = random(seed);
  return shuffled(cards, next).map((card, index) => roundFor(card, cards, kinds[index % kinds.length], next, `${seed}:${index}`));
}

/** A missed card comes back once at the end, in a different kind of round. */
export function requeue(rounds: DrillRound[], index: number, correct: boolean, cards: DrillCard[], seed: number): DrillRound[] {
  const round = rounds[index];
  if (correct || !round || rounds.slice(index + 1).some((r) => r.cardId === round.cardId)) return rounds;
  if (rounds.filter((r) => r.cardId === round.cardId).length > 1) return rounds;
  const card = cards.find((c) => c.id === round.cardId);
  if (!card) return rounds;
  const kind: DrillKind = round.kind === "meaning" ? "word" : "meaning";
  return [...rounds, roundFor(card, cards, kind, random(seed + index + 1), `${seed}:again:${index}`)];
}
