/**
 * Builds the N5 syllabus data from two sources:
 *
 * 1. The reviewed curriculum in src/n5/curriculum.ts. Its 230 vocabulary ids and
 *    48 grammar ids are the contract with n5_heard and the extension, so they are
 *    copied verbatim and never regenerated.
 * 2. OpenJLPT N5 vocabulary (CC BY-SA 4.0, pinned commit below), which fills the
 *    rest of the N5 pool with a reading, an English meaning and a part of speech.
 *
 * The course teaches 24 units x 25 words = 600. The remaining 151 words are a
 * documented reserve for a longer course: `reserve: true`, excluded by the planner.
 * Reserve selection is deterministic: the longest specific nouns (place, nature,
 * animal, occupation, country, school) go last, so short everyday nouns stay in the
 * course. This is a heuristic, not a frequency claim.
 *
 * Run from backend/: node scripts/build-n5-syllabus.mjs
 */
import { build } from "esbuild";
import fs from "node:fs";
import path from "node:path";

const OPENJLPT_COMMIT = "0d1d3410bec90bd4098a7c72de820543cb4f707c";
const OPENJLPT_URL = `https://raw.githubusercontent.com/evanclan/OpenJLPT/${OPENJLPT_COMMIT}/data/json/vocab/n5.json`;
const OUT = path.join("src", "n5", "syllabus");

const bundle = await build({
  stdin: {
    contents: 'export { render } from "./src/n5/text.ts"; export { UNITS } from "./src/n5/curriculum.ts";',
    resolveDir: process.cwd(),
    sourcefile: "syllabus-entry.ts",
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  platform: "node",
  write: false,
});
const mod = await import("data:text/javascript;base64," + Buffer.from(bundle.outputFiles[0].text).toString("base64"));
const { render, UNITS } = mod;

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const fold = (s) => s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
const norm = (s) => fold(s).replace(/[_^ 。、？！]/g, "");
const length = (s) => [...s].length;

const POS = (tags) => {
  const t = Array.isArray(tags) ? tags : [tags];
  if (t.some((p) => p.startsWith("v"))) return "verb";
  if (t.includes("adj-i") || t.includes("adj-ix")) return "i-adjective";
  if (t.includes("adj-na")) return "na-adjective";
  if (t.includes("adj-pn") || t.includes("adj-f")) return "adjective";
  if (t.includes("adv") || t.includes("adv-to")) return "adverb";
  if (t.includes("pn")) return "pronoun";
  if (t.includes("num")) return "numeral";
  if (t.includes("ctr")) return "counter";
  if (t.includes("conj")) return "conjunction";
  if (t.includes("exp") || t.includes("int")) return "expression";
  if (t.includes("prt")) return "particle";
  return "noun";
};

const RULES = [
  ["greeting", /hello|good morning|good evening|good night|thank|sorry|excuse|please|welcome|goodbye|nice to meet|pleased|how do you do|yes\b|no\b|that's right|not at all|here you are|i'm home|welcome home|cheers|ouch|wow|oh\b|um\b|well\b/i],
  ["time", /time|o'clock|hour|minute|second|day|week|month|year|morning|evening|night|today|tomorrow|yesterday|sunday|monday|tuesday|wednesday|thursday|friday|saturday|a\.m\.|p\.m\.|now\b|early|late\b|always|sometimes|often|usually|soon|again|next\b|last\b|every/i],
  ["family", /mother|father|parent|sister|brother|family|child|wife|husband|son\b|daughter|grandmother|grandfather|aunt|uncle|cousin|baby/i],
  ["number", /^one$|^two$|^three$|^four$|^five$|^six$|^seven$|^eight$|^nine$|^ten$|hundred|thousand|million|number|count|how many|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth/i],
  ["food", /eat|drink|food|rice|bread|meat|fish|vegetable|fruit|apple|orange|egg|milk|water|tea|coffee|juice|beer|sake|wine|sugar|salt|pepper|soup|noodle|sushi|bento|breakfast|lunch|dinner|meal|cake|candy|chocolate|cheese|butter|yogurt|strawberry|grape|banana|peach|melon|potato|tomato|carrot|onion|cabbage|beans|tofu|seaweed|shrimp|squid|octopus|crab|chicken|pork|beef|hamburger|curry|pasta|salad|sandwich|pizza|dessert|snack|taste|delicious|sweet|spicy|bitter|sour|hungry|thirsty/i],
  ["transport", /train|bus|\bcar\b|bicycle|bike|taxi|airplane|plane\b|ship|boat|subway|station|airport|port\b|traffic|drive|ride|walk|on foot|travel|trip|ticket/i],
  ["place", /school|hospital|library|shop|store|restaurant|cafe|park|bank|post office|police|city hall|museum|zoo|temple|shrine|hotel|house|home|room|kitchen|bathroom|toilet|office|classroom|building|street|road|bridge|garden|pool|church|castle|market|town|village|city|country|place|here|there|where|inside|outside|above|below|front|behind|next to|between|\bnear\b|\bfar\b|\bleft\b|\bright\b|middle|corner|\bside\b|\btop\b|\bbottom\b/i],
  ["school", /study|student|teacher|class|lesson|school|university|college|homework|exam|test|question|answer|book|notebook|\bpen\b|pencil|eraser|paper|dictionary|word|letter|sentence|language|english|japanese|math|science|history|music|\bart\b|subject|grade|semester|holiday|vacation|practice|learn|teach|remember|forget|understand|mean|\bread\b|write|listen|speak|\bsay\b|\btell\b|\bask\b/i],
  ["body", /head|face|eye|ear|nose|mouth|tooth|teeth|hand|arm|leg|foot|feet|finger|stomach|\bback\b|neck|shoulder|chest|heart|blood|hair|skin|body|sick|illness|pain|hurt|fever|cold\b|medicine|doctor|nurse|dentist/i],
  ["weather", /weather|rain|snow|wind|cloud|\bsun\b|sunny|cloudy|rainy|snowy|sky|\bhot\b|\bwarm\b|\bcold\b|\bcool\b|humid|dry\b|storm|typhoon|season|spring|summer|autumn|fall\b|winter|temperature/i],
  ["clothing", /clothes|shirt|pants|trousers|skirt|dress|coat|jacket|sweater|\bhat\b|\bcap\b|shoe|sock|glove|scarf|belt|bag|wallet|watch|glasses|\bring\b|wear|put on|take off/i],
  ["house", /room|door|window|wall|floor|ceiling|roof|table|chair|desk|\bbed\b|sofa|shelf|clock|light|lamp|\bkey\b|garden|yard|stairs|elevator|air conditioner|refrigerator|fridge|television|tv\b|radio|phone|telephone|computer|camera|mirror|towel|soap|toothbrush|blanket|pillow|curtain/i],
  ["animal", /cat\b|dog\b|bird|horse|cow\b|pig\b|rabbit|mouse|\brat\b|\btiger\b|lion|elephant|monkey|\bbear\b|\bsnake\b|insect|\bbug\b|\bbutterfly\b|\bbee\b|\bant\b|spider|animal|\bpet\b|\bzoo\b/i],
  ["color", /color|colour|\bred\b|\bblue\b|\bgreen\b|\byellow\b|\bblack\b|\bwhite\b|brown|pink|orange|purple|grey|gray|gold|silver/i],
  ["nature", /mountain|river|lake|sea\b|ocean|beach|island|forest|woods|tree|flower|grass|leaf|leaves|stone|\brock\b|\bsand\b|earth|ground|moon|star|planet|nature|field|farm|rice field|volcano|\bwave\b|\bpond\b|swamp/i],
  ["occupation", /job\b|worker|company|business|boss|manager|employee|salary|occupation|profession|police officer|firefighter|farmer|fisherman|driver|pilot|singer|actor|actress|artist|writer|author|engineer|lawyer|shopkeeper|clerk/i],
  ["country", /nation|america|england|china|korea|france|germany|italy|spain|russia|india|australia|canada|brazil|mexico|\bjapan\b|\bforeign\b|abroad/i],
  ["verb", /^to\s/i],
  ["adjective", /^(big|small|large|little|tall|short|long|new|old|young|good|bad|kind|gentle|strict|easy|difficult|hard|busy|free|early|late|fast|slow|hot|cold|warm|cool|cheap|expensive|high|low|wide|narrow|heavy|light|strong|weak|beautiful|pretty|clean|dirty|quiet|noisy|famous|important|interesting|boring|fun|happy|sad|angry|tired|sleepy|hungry|thirsty|delicious|sweet|spicy|bright|dark|near|far|same|different|various|many|few|much|little)\b/i],
];

function tagOf(meaning, pos) {
  for (const [tag, re] of RULES) if (re.test(meaning)) return tag;
  if (pos === "verb") return "verb";
  if (pos === "i-adjective" || pos === "na-adjective" || pos === "adjective") return "adjective";
  if (pos === "adverb") return "adverb";
  if (pos === "pronoun") return "pronoun";
  if (pos === "numeral") return "number";
  if (pos === "expression") return "greeting";
  return "noun";
}

const POS_BY_TAG = {
  greeting: "expression", time: "noun", family: "noun", number: "numeral",
  food: "noun", transport: "noun", place: "noun", school: "noun", body: "noun",
  weather: "noun", clothing: "noun", house: "noun", animal: "noun", color: "noun",
  nature: "noun", occupation: "noun", country: "noun", noun: "noun",
  verb: "verb", adjective: "adjective", adverb: "adverb", pronoun: "pronoun",
};

const RANK = {
  greeting: 1, pronoun: 1, number: 1, time: 1, family: 1,
  food: 2, place: 2, transport: 2, school: 2, body: 2, weather: 2,
  clothing: 2, house: 2, color: 2, verb: 2, adjective: 2,
  adverb: 3, animal: 3, noun: 3,
  nature: 4, occupation: 4, country: 4,
};

// ---------------------------------------------------------------- vocabulary

const seeded = [];
const seen = new Set();
for (const unit of UNITS) {
  for (const [src, meaning] of unit.vocabulary) {
    if (seen.has(src)) continue;
    seen.add(src);
    seeded.push({ src, meaning, seed: true });
  }
}

const source = await (await fetch(OPENJLPT_URL)).json();
const known = new Set(seeded.map((w) => norm(w.src)));
const addedByReading = new Map();
for (const w of source) {
  if (known.has(norm(w.reading))) continue;
  if ((Array.isArray(w.pos) ? w.pos : [w.pos]).includes("prt")) continue;
  if (addedByReading.has(norm(w.reading))) continue;
  const pos = POS(w.pos);
  const meaning = String(w.meanings[0]).replace(/\s+/g, " ").trim();
  addedByReading.set(norm(w.reading), { src: w.reading, meaning, pos, tag: tagOf(meaning, pos), seed: false });
}
const added = [...addedByReading.values()];

// Fixed expressions the external list does not carry. All are N5 greetings.
const CURATED = [
  ["おはよう", "good morning (casual)"],
  ["おやすみ", "good night (casual)"],
  ["おやすみなさい", "good night (polite)"],
  ["おかえりなさい", "welcome home"],
  ["いってきます", "I'm off (I'll go and come back)"],
  ["いってらっしゃい", "take care (said to someone leaving)"],
  ["ただいま", "I'm home"],
  ["おげんきですか", "how are you?"],
  ["おめでとう", "congratulations"],
  ["がんばって", "do your best"],
  ["いらっしゃいませ", "welcome (said by shop staff)"],
];
const curated = CURATED.filter(([src]) => !known.has(norm(src)) && !addedByReading.has(norm(src)))
  .map(([src, meaning]) => ({ src, meaning, pos: "expression", tag: "greeting", seed: false }));

for (const w of seeded) {
  const pos = POS_BY_TAG[tagOf(w.meaning, "noun")] ?? "noun";
  w.pos = pos;
  w.tag = tagOf(w.meaning, pos);
}

const RESERVE = 151;
// Common nouns stay in the course even when they are long compounds. The reserve is
// the long tail of specific nouns, not a judgement that these words are useless.
const KEEP_NOUNS = new Set([
  "あさごはん", "ばんごはん", "だいどころ", "ばんごう", "ちかてつ", "ちゃわん", "ぶたにく",
  "やさい", "くだもの", "さかな", "たまご", "にく", "おかね", "きっぷ", "てがみ", "しゃしん",
  "ことば", "しごと", "じかん", "ところ", "なまえ", "こえ", "おと", "いろ", "かたち", "いみ",
  "そら", "うみ", "やま", "かわ", "はな", "あめ", "ゆき", "まち", "みち", "みせ", "いえ",
  "へや", "まど", "つくえ", "いす", "でんわ", "でんしゃ", "くるま", "かさ", "かばん", "ほん",
  "ペン", "テスト", "ゲーム", "え", "ニュース", "パーティー",
]);
const candidates = added.filter((w) => w.pos === "noun" && !KEEP_NOUNS.has(w.src)).sort((a, b) =>
  length(b.src) - length(a.src) || a.src.localeCompare(b.src, "ja"));
if (candidates.length < RESERVE) throw new Error(`Only ${candidates.length} reserve candidates, need ${RESERVE}`);
const reserved = new Set(candidates.slice(0, RESERVE).map((w) => w.src));
const courseAdded = added
  .filter((w) => !reserved.has(w.src))
  .sort((a, b) => (RANK[a.tag] - RANK[b.tag]) || a.src.localeCompare(b.src, "ja"));

const ordered = [...curated, ...seeded, ...courseAdded];
const total = ordered.length + RESERVE;
const ids = new Map();
const words = [];
for (const w of [...ordered, ...added.filter((x) => reserved.has(x.src))]) {
  const romaji = render(w.src).romaji;
  let id = slug(romaji);
  if (ids.has(id)) {
    let n = 2;
    while (ids.has(`${id}-${n}`)) n++;
    id = `${id}-${n}`;
  }
  ids.set(id, w.src);
  const reserve = reserved.has(w.src);
  const index = ordered.findIndex((x) => x.src === w.src);
  const band = reserve ? 4 : index < 150 ? 1 : index < 300 ? 2 : index < 450 ? 3 : 4;
  words.push({
    id,
    src: w.src,
    meaning: w.meaning,
    pos: w.pos,
    band,
    tags: reserve ? [w.tag, "reserve"] : [w.tag],
    ...(reserve ? { reserve: true } : {}),
  });
}

if (total < 750 || total > 850) throw new Error(`Word pool is ${total}, expected 750-850`);
if (words.filter((w) => !w.reserve).length !== 600) throw new Error("Course must have exactly 600 words");
if (ids.size !== words.length) throw new Error("Duplicate word ids");

// ---------------------------------------------------------------- grammar

const existingGrammar = [];
for (const unit of UNITS) {
  unit.grammar.forEach((g, i) => {
    const [pattern, title] = g.title.split(" — ").length === 2 ? g.title.split(" — ") : [g.title, ""];
    existingGrammar.push({
      id: `u${String(unit.unit).padStart(2, "0")}-g${i + 1}`,
      title: g.title,
      pattern,
      explanation: g.explanation.split(".")[0] + ".",
      prerequisites: [],
      band: unit.unit <= 6 ? 1 : unit.unit <= 12 ? 2 : unit.unit <= 18 ? 3 : 4,
    });
  });
}

const G = (id, title, pattern, explanation, prerequisites, band) => ({ id, title, pattern, explanation, prerequisites, band });
const grammarAdded = [
  G("g-particle-mo", "も - also / too", "N も ...", "も replaces は or が to say that the same thing is true of another person or thing.", [], 1),
  G("g-question-words", "だれ / なに / どこ / いつ - question words", "question word + ですか", "だれ asks who, なに asks what, どこ asks where and いつ asks when. Keep the word order and add か at the end.", [], 1),
  G("g-numbers-100", "Numbers to 100", "いち, に, さん ... じゅう, ひゃく", "Numbers are regular until 10, then combine: じゅういち is 11 and にじゅう is 20. ひゃく is 100.", [], 1),
  G("g-counter-tsu", "～つ - general counters", "ひとつ, ふたつ, みっつ ...", "The つ counters work for most objects up to ten and need no noun class.", [], 1),
  G("g-ko-so-a-do", "こ / そ / あ / ど - this, that, which", "これ / それ / あれ / どれ", "The こ series is near the speaker, そ near the listener, あ far from both and ど is the question form.", [], 1),

  G("g-particle-ga-subject", "が - subject marker", "N が ...", "が marks the subject, especially new information or the answer to a question. It also follows the object of すき, きらい, ほしい and できます.", ["u01-g1"], 2),
  G("g-particle-wo-object", "を - object marker", "N を verb", "を marks the direct object of a verb. It sounds like o.", ["u01-g1"], 2),
  G("g-particle-de-means-place", "で - place of action or means", "place で verb / tool で verb", "で marks where an action happens, or the tool or vehicle used. It is not the same as に, which marks where something exists.", ["u05-g1"], 2),
  G("g-particle-to-and", "と / や - and (nouns)", "A と B / A や B", "と joins nouns completely, while や lists examples and suggests there are more.", ["u03-g1"], 2),
  G("g-counter-people-things", "～人 / ～枚 / ～台 / ～回 - counters", "number + counter", "Japanese uses different counters for people, flat things, machines and times. The number usually comes before the counter.", ["g-counter-tsu"], 2),
  G("g-counter-age", "～歳 - age", "number + さい", "Ask an age with なんさい. Watch はっさい (8) and じゅっさい (10).", ["g-counter-tsu"], 2),
  G("g-existence-ga-arimasu", "N が あります / います - there is", "place に N が あります / います", "あります is for things and います for people and animals. The thing that exists takes が.", ["u05-g1"], 2),
  G("g-nanika-nanimo", "なにか / なにも - something / nothing", "なにか / なにも + verb", "なにか means something and なにも with a negative verb means nothing.", ["g-question-words"], 2),
  G("g-dake-only", "だけ - only", "N だけ", "だけ limits a noun or a quantity to one thing: みず だけ = only water.", ["g-particle-mo"], 2),

  G("g-te-kara", "～てから - after doing", "V-て から ...", "The て-form plus から says that the second action happens after the first one finishes.", ["u07-g1"], 3),
  G("g-ta-koto-ga-aru", "～た こと が あります - have done", "V-た こと が あります", "This pattern describes an experience you have had at some point in your life, not something you just did.", ["u08-g1"], 3),
  G("g-nagara", "～ながら - while doing", "V-ます stem + ながら ...", "ながら attaches to the stem of a verb to say that two actions happen at the same time by the same person.", ["u07-g1"], 3),
  G("g-toki", "～とき - when", "V / adjective + とき", "とき turns a clause into a time expression: がっこう に いく とき = when I go to school.", ["u07-g1"], 3),
  G("g-mae-ni", "～まえ に - before", "V-dictionary + まえ に / N の まえ に", "まえ に says that something happens before an action or in front of a place.", ["u07-g2"], 3),
  G("g-ato-de", "～あと で - after", "V-た + あと で / N の あと で", "あと で says that something happens after an action or event.", ["u07-g2"], 3),
  G("g-tsumori", "～つもり です - intend to", "V-dictionary + つもり です", "つもり expresses a plan or intention. The verb before it stays in the dictionary form.", ["u07-g1"], 3),
  G("g-desho", "～でしょう - probably", "plain form + でしょう", "でしょう adds probability: あした は あめ でしょう = it will probably rain tomorrow.", ["u08-g2"], 3),
  G("g-kamoshirenai", "～かもしれません - maybe", "plain form + かもしれません", "かもしれません is a weaker, more polite guess than でしょう.", ["u08-g2"], 3),
  G("g-to-omoimasu", "～と おもいます - I think", "plain form + と おもいます", "Use と おもいます to give an opinion. The quoted clause takes the plain form.", ["u07-g1"], 3),

  G("g-n-desu", "～んです - explanation", "plain form + んです", "んです asks for or gives background, reason or context. It is common in conversation.", ["u07-g1"], 4),
  G("g-sou-desu", "～そうです - looks like / I hear", "stem + そうです / plain form + そうです", "There are two patterns: a stem before そうです means 'looks like', and a plain form before そうです means 'I hear'.", ["u11-g1"], 4),
  G("g-hou-ga-ii", "～ほう が いい です - had better", "V-た / V-ない + ほう が いい です", "This gives advice. Use the past form for a positive suggestion and the negative form for advice against something.", ["u11-g1"], 4),
  G("g-ni-naru", "～に なる - become", "N / na-adjective + に なる", "になる says that something becomes something else: せんせい に なる = become a teacher.", ["u11-g2"], 4),
  G("g-te-oku", "～て おきます - do in advance", "V-て おきます", "て おきます says an action is done ahead of time or left in a state for later.", ["u16-g1"], 4),
  G("g-te-shimau", "～て しまいました - ended up doing", "V-て しまいました", "て しまいました says an action was completed, often with regret or surprise.", ["u14-g2"], 4),
  G("g-kara-node", "から / ので - because", "reason から ... / reason ので ...", "から states a reason directly. ので sounds softer and is common when explaining politely.", ["u07-g1"], 4),
  G("g-nasai", "～なさい - do (instruction)", "V-ます stem + なさい", "なさい gives a firm but polite instruction, the way a parent or teacher speaks to a child.", ["u13-g2"], 4),
];

const grammar = [...existingGrammar, ...grammarAdded];
if (grammar.length < 70 || grammar.length > 90) throw new Error(`Grammar is ${grammar.length}, expected 70-90`);
const grammarIds = new Set(grammar.map((g) => g.id));
if (grammarIds.size !== grammar.length) throw new Error("Duplicate grammar ids");
const byId = new Map(grammar.map((g) => [g.id, g]));
for (const g of grammar) {
  for (const p of g.prerequisites) {
    const pre = byId.get(p);
    if (!pre) throw new Error(`${g.id} has unknown prerequisite ${p}`);
    if (pre.band >= g.band) throw new Error(`${g.id} prerequisite ${p} is not from an earlier band`);
  }
}

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, "words.json"), JSON.stringify(words, null, 2) + "\n");
fs.writeFileSync(path.join(OUT, "grammar.json"), JSON.stringify(grammar, null, 2) + "\n");

console.log(JSON.stringify({
  words: words.length,
  seeded: seeded.length,
  curated: curated.length,
  added: added.length,
  reserve: RESERVE,
  course: words.filter((w) => !w.reserve).length,
  grammar: grammar.length,
  grammarAdded: grammarAdded.length,
}, null, 2));
