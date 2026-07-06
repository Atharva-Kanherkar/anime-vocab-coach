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
  /** Visual description consumed by scripts/generate-cards.mjs (art prompts). */
  look: string;
  /** Path to real art under /public. Resolved from CARD_ART (cards-art.ts,
   * auto-managed by the generator) at render time in cards-panel. */
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
// `look` feeds the art generator — keep each subject visually distinct
// (species, wardrobe, prop, mood) while the style block keeps the set coherent.
export const CARDS: CardDef[] = [
  { id: "hikari", name: "Hikari", kanji: "光", reading: "ひかり", epithet: "First Light of the Rally", rarity: "N", level: 1, look: "small cheerful girl with a chin-length bob holding up a round paper lantern, oversized cream raincoat, rubber boots" },
  { id: "kaeru", name: "Pon", kanji: "蛙", reading: "かえる", epithet: "Pond Sage of Ward 3", rarity: "N", level: 1, look: "round wise frog spirit wearing a tiny straw hat and a leaf cape, sitting on a stone, holding a teacup" },
  { id: "yume", name: "Yume", kanji: "夢", reading: "ゆめ", epithet: "Keeper of Unwatched Episodes", rarity: "N", level: 2, look: "sleepy long-haired girl wrapped in a star-patterned blanket, drifting slightly above the ground, one sock missing" },
  { id: "neko", name: "Mikan", kanji: "猫", reading: "ねこ", epithet: "Subtitle-Chasing Stray", rarity: "N", level: 2, look: "scrappy bobtail cat mid-pounce chasing a floating strip of paper, bandage on one ear, tiny bell collar" },
  { id: "kaze", name: "Fuu", kanji: "風", reading: "かぜ", epithet: "Courier of the Night Breeze", rarity: "N", level: 3, look: "wiry courier boy on a delivery bicycle, scarf streaming horizontally, satchel of letters, flat cap" },
  { id: "hoshi", name: "Sora", kanji: "星", reading: "ほし", epithet: "Cartographer of Small Stars", rarity: "N", level: 3, look: "studious girl with round glasses and twin braids peering through a brass telescope, star charts tucked under her arm" },
  { id: "mori", name: "Kodama", kanji: "森", reading: "もり", epithet: "Echo of the Cedar Deep", rarity: "N", level: 4, look: "small moss-covered forest spirit with a hollow knothole face, sprout growing from its head, standing among mushrooms" },
  { id: "yakusoku", name: "Chikai", kanji: "約", reading: "やく", epithet: "The Promise-Keeper", rarity: "R", level: 5, look: "earnest boy in a school uniform holding out a pinky finger, red string of fate tied to it trailing out of frame" },
  { id: "nakama", name: "Banchou", kanji: "仲", reading: "なか", epithet: "Captain of the Found Family", rarity: "R", level: 6, look: "broad-shouldered delinquent captain with a pompadour and a long coat worn over the shoulders, gentle grin, arms crossed" },
  { id: "ame", name: "Shizuku", kanji: "雨", reading: "あめ", epithet: "Umbrella Duelist", rarity: "R", level: 7, look: "poised girl in a raincoat holding a closed oil-paper umbrella like a sword in a fencing stance, rain streaks around her" },
  { id: "hono", name: "Kaen", kanji: "炎", reading: "ほのお", epithet: "Third-Act Flame", rarity: "R", level: 8, look: "fired-up spiky-haired fighter with taped fists, headband trailing, small stylized flames rising off his shoulders" },
  { id: "tsuki", name: "Mizuki", kanji: "月", reading: "つき", epithet: "Archivist of the Silver Hour", rarity: "R", level: 9, look: "elegant librarian woman in a kimono cardigan shelving a glowing crescent moon among books on a tall ladder" },
  { id: "kaminari", name: "Rai", kanji: "雷", reading: "かみなり", epithet: "Drummer of Sudden Storms", rarity: "R", level: 10, look: "grinning oni-horned drummer kid mid-strike on a taiko drum, drumsticks crackling with zigzag lightning bolts" },
  { id: "umi", name: "Nami", kanji: "海", reading: "うみ", epithet: "Navigator of the Long Arc", rarity: "R", level: 11, look: "confident sailor girl at a ship's wheel, peaked cap, wave crests curling behind her, compass hanging from her neck" },
  { id: "hana", name: "Saki", kanji: "花", reading: "はな", epithet: "Florist of Lost Timelines", rarity: "R", level: 12, look: "gentle florist with a messy bun and an apron full of tools, cradling an armful of oversized chrysanthemums" },
  { id: "katana", name: "Kaito", kanji: "侍", reading: "さむらい", epithet: "Ronin of the Rainy Ward", rarity: "SR", level: 14, look: "weathered ronin in a straw hat and tattered haori, hand resting on a sheathed katana, rain falling in thin lines" },
  { id: "kitsune", name: "Kuzunoha", kanji: "狐", reading: "きつね", epithet: "Nine-Tailed Proofreader", rarity: "SR", level: 16, look: "sly nine-tailed fox spirit in a scholar's robe, reading glasses perched on the snout, red brush pen in paw, tails fanned out" },
  { id: "tori", name: "Tsubasa", kanji: "翼", reading: "つばさ", epithet: "Wing over the Credits", rarity: "SR", level: 18, look: "androgynous runner with large folded paper-crane wings, track jacket, caught mid-leap over rooftops" },
  { id: "yoru", name: "Yoru", kanji: "夜", reading: "よる", epithet: "Binge-Watch Sentinel", rarity: "SR", level: 21, look: "hooded night watcher perched on a power line, glowing screen-light reflected on their face, city silhouette below" },
  { id: "ryu", name: "Tatsu", kanji: "竜", reading: "りゅう", epithet: "Dragon of the Final Season", rarity: "SR", level: 24, look: "serpentine eastern dragon coiled around a torii gate, whiskers flowing, clutching a pearl, clouds in flat bands" },
  { id: "oni", name: "Douji", kanji: "鬼", reading: "おに", epithet: "Gatekeeper of Episode One", rarity: "SSR", level: 28, look: "towering horned oni in a festival happi coat standing guard at a wooden gate, iron club planted, stern but kind eyes" },
  { id: "tenshi", name: "Amane", kanji: "天", reading: "てん", epithet: "Herald of the OP Skip", rarity: "SSR", level: 32, look: "serene celestial herald with a halo ring and layered ceremonial robes, blowing a long horagai conch, ribbons spiraling" },
  { id: "shinigami", name: "Kuro", kanji: "死", reading: "し", epithet: "Collector of Dropped Shows", rarity: "SSR", level: 36, look: "dapper reaper in a wide-brimmed hat and long coat, ledger book chained to the belt, scythe replaced by a giant bookmark" },
  { id: "kami", name: "Mikoto", kanji: "神", reading: "かみ", epithet: "The One Who Finishes Backlogs", rarity: "UR", level: 40, look: "radiant deity seated on a floating shrine roof, many hands each holding a different remote control, serene smile, sun disk behind" },
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
