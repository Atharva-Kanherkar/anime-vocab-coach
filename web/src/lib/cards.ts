// Collectible card system. XP is derived deterministically from the user's
// sync snapshot (words, reviews, watch time), so there's no server state to
// migrate — the collection recomputes anywhere the snapshot lives.
//
// Art pipeline: each card has an optional `art` path under /public/cards/.
// Until real AI-generated art lands, cards render a typographic placeholder
// (kanji motif on a print pattern). See docs/anime-cards.md for the
// generation spec (style prompt, sizes, manifest workflow).

export type Rarity = "N" | "R" | "SR" | "SSR" | "UR";

export interface CardDef {
  id: string;
  /** Original character name (no licensed characters — copyright-safe). */
  name: string;
  /** Kanji motif used as the placeholder art + the card's "element". */
  kanji: string;
  reading: string;
  epithet: string;
  rarity: Rarity;
  /** Level at which the card unlocks. */
  level: number;
  /** Optional path to real art under /public (e.g. "/cards/ronin.png"). */
  art?: string;
}

export interface LevelState {
  xp: number;
  level: number;
  rankKanji: string;
  rankName: string;
  /** XP into the current level / XP needed for the next. */
  intoLevel: number;
  forNext: number;
}

export const MAX_LEVEL = 50;

// Cumulative XP needed to *reach* level n (level 1 = 0).
export function xpForLevel(n: number): number {
  const clamped = Math.max(1, Math.min(MAX_LEVEL, Math.floor(n)));
  return 40 * (clamped - 1) * clamped;
}

export function computeXp(input: {
  totalWords: number;
  judgedCards: number;
  watchMinutes: number;
  streakLongest: number;
}): number {
  return (
    input.totalWords * 12 +
    input.judgedCards * 6 +
    input.watchMinutes * 3 +
    input.streakLongest * 25
  );
}

const RANKS: [number, string, string][] = [
  [1, "見習い", "Apprentice"],
  [5, "旅人", "Traveler"],
  [10, "剣士", "Swordfighter"],
  [18, "侍", "Samurai"],
  [28, "師匠", "Master"],
  [40, "伝説", "Legend"],
];

export function levelState(xp: number): LevelState {
  let level = 1;
  while (level < MAX_LEVEL && xp >= xpForLevel(level + 1)) level++;
  const floor = xpForLevel(level);
  const ceil = level >= MAX_LEVEL ? floor : xpForLevel(level + 1);
  const rank = [...RANKS].reverse().find(([min]) => level >= min) ?? RANKS[0];
  return {
    xp,
    level,
    rankKanji: rank[1],
    rankName: rank[2],
    intoLevel: xp - floor,
    forNext: Math.max(1, ceil - floor),
  };
}

// Placeholder set: 24 original archetype characters. The full planned set is
// 100 (N60 / R25 / SR10 / SSR4 / UR1); these are the first unlock band.
export const CARDS: CardDef[] = [
  { id: "hikari", name: "Hikari", kanji: "光", reading: "ひかり", epithet: "First Light of the Rally", rarity: "N", level: 1 },
  { id: "kaeru", name: "Pon", kanji: "蛙", reading: "かえる", epithet: "Pond Sage of Ward 3", rarity: "N", level: 1 },
  { id: "yume", name: "Yume", kanji: "夢", reading: "ゆめ", epithet: "Keeper of Unwatched Episodes", rarity: "N", level: 2 },
  { id: "neko", name: "Mikan", kanji: "猫", reading: "ねこ", epithet: "Subtitle-Chasing Stray", rarity: "N", level: 2 },
  { id: "kaze", name: "Fuu", kanji: "風", reading: "かぜ", epithet: "Courier of the Night Breeze", rarity: "N", level: 3 },
  { id: "hoshi", name: "Sora", kanji: "星", reading: "ほし", epithet: "Cartographer of Small Stars", rarity: "N", level: 3 },
  { id: "mori", name: "Kodama", kanji: "森", reading: "もり", epithet: "Echo of the Cedar Deep", rarity: "N", level: 4 },
  { id: "yakusoku", name: "Chikai", kanji: "約", reading: "やく", epithet: "The Promise-Keeper", rarity: "R", level: 5 },
  { id: "nakama", name: "Banchou", kanji: "仲", reading: "なか", epithet: "Captain of the Found Family", rarity: "R", level: 6 },
  { id: "ame", name: "Shizuku", kanji: "雨", reading: "あめ", epithet: "Umbrella Duelist", rarity: "R", level: 7 },
  { id: "hono", name: "Kaen", kanji: "炎", reading: "ほのお", epithet: "Third-Act Flame", rarity: "R", level: 8 },
  { id: "tsuki", name: "Mizuki", kanji: "月", reading: "つき", epithet: "Archivist of the Silver Hour", rarity: "R", level: 9 },
  { id: "kaminari", name: "Rai", kanji: "雷", reading: "かみなり", epithet: "Drummer of Sudden Storms", rarity: "R", level: 10 },
  { id: "umi", name: "Nami", kanji: "海", reading: "うみ", epithet: "Navigator of the Long Arc", rarity: "R", level: 11 },
  { id: "hana", name: "Saki", kanji: "花", reading: "はな", epithet: "Florist of Lost Timelines", rarity: "R", level: 12 },
  { id: "katana", name: "Kaito", kanji: "侍", reading: "さむらい", epithet: "Ronin of the Rainy Ward", rarity: "SR", level: 14 },
  { id: "kitsune", name: "Kuzunoha", kanji: "狐", reading: "きつね", epithet: "Nine-Tailed Proofreader", rarity: "SR", level: 16 },
  { id: "tori", name: "Tsubasa", kanji: "翼", reading: "つばさ", epithet: "Wing over the Credits", rarity: "SR", level: 18 },
  { id: "yoru", name: "Yoru", kanji: "夜", reading: "よる", epithet: "Binge-Watch Sentinel", rarity: "SR", level: 21 },
  { id: "ryu", name: "Tatsu", kanji: "竜", reading: "りゅう", epithet: "Dragon of the Final Season", rarity: "SR", level: 24 },
  { id: "oni", name: "Douji", kanji: "鬼", reading: "おに", epithet: "Gatekeeper of Episode One", rarity: "SSR", level: 28 },
  { id: "tenshi", name: "Amane", kanji: "天", reading: "てん", epithet: "Herald of the OP Skip", rarity: "SSR", level: 32 },
  { id: "shinigami", name: "Kuro", kanji: "死", reading: "し", epithet: "Collector of Dropped Shows", rarity: "SSR", level: 36 },
  { id: "kami", name: "Mikoto", kanji: "神", reading: "かみ", epithet: "The One Who Finishes Backlogs", rarity: "UR", level: 40 },
];

export function unlockedCards(level: number): CardDef[] {
  return CARDS.filter((c) => c.level <= level);
}

export function nextUnlock(level: number): CardDef | null {
  return CARDS.find((c) => c.level > level) ?? null;
}

export const RARITY_LABEL: Record<Rarity, string> = {
  N: "Normal",
  R: "Rare",
  SR: "Super Rare",
  SSR: "Spectral Rare",
  UR: "Ultra Rare",
};

export const RARITY_STARS: Record<Rarity, number> = { N: 1, R: 2, SR: 3, SSR: 4, UR: 5 };
