import { describe, expect, it } from "vitest";
import {
  EpisodeLog,
  MAX_ASKED_KEYS,
  MAX_LOG_LINES,
  isCorrect,
  isEpisodeEnding,
  knownWordsIn,
  missedWords,
  practiceWords,
  rememberAsked,
  scoreQuiz,
  shouldOfferQuiz,
  shuffled,
  verdictFor,
  type QuizQuestion,
} from "../src/lib/episode-quiz";
import type { VocabMap, VocabRecord } from "../src/types";

const rec = (state: VocabRecord["state"]) => ({ state } as VocabRecord);

const meaning = (word: string, answer = 0): QuizQuestion => ({
  kind: "meaning",
  prompt: `What does ${word} mean?`,
  quote: `${word}だよ`,
  choices: ["a", "b", "c", "d"],
  answer,
  explain: "",
  word: { word, reading: "", gloss: "g" },
});
const build: QuizQuestion = { kind: "build", prompt: "Build", tiles: ["猫", "が", "好き"], explain: "" };

describe("EpisodeLog", () => {
  it("dedupes lines and keeps their English", () => {
    const log = new EpisodeLog();
    log.use("a");
    log.add(" 行く  よ ", "let's go");
    log.add("行く よ");
    expect(log.size).toBe(1);
    expect(log.sample()).toEqual([{ ja: "行く よ", en: "let's go" }]);
  });

  it("starts over for a new session but not the same one", () => {
    const log = new EpisodeLog();
    log.use("a");
    log.add("x");
    log.playedSec = 100;
    log.use("a");
    expect(log.size).toBe(1);
    log.use("b");
    expect(log.size).toBe(0);
    expect(log.playedSec).toBe(0);
  });

  it("caps the log and lets an evicted line come back", () => {
    const log = new EpisodeLog();
    log.use("a");
    for (let i = 0; i < MAX_LOG_LINES + 10; i++) log.add(`l${i}`);
    expect(log.size).toBe(MAX_LOG_LINES);
    log.add("l0");
    expect(log.size).toBe(MAX_LOG_LINES);
    expect(log.sample(MAX_LOG_LINES).at(-1)?.ja).toBe("l0");
  });

  it("samples evenly across the whole episode", () => {
    const log = new EpisodeLog();
    log.use("a");
    for (let i = 0; i < 300; i++) log.add(`l${i}`);
    const s = log.sample(120);
    expect(s).toHaveLength(120);
    expect(s[0].ja).toBe("l0");
    expect(s.at(-1)?.ja).toBe("l299");
    expect(s.find((l) => l.ja === "l150" || l.ja === "l149" || l.ja === "l151")).toBeTruthy();
  });
});

describe("isEpisodeEnding", () => {
  const ep = (currentTime: number, duration = 24 * 60, ended = false) => ({ currentTime, duration, ended });
  it("is true once ended", () => expect(isEpisodeEnding(ep(0, NaN, true))).toBe(true));
  it("is true in the credits window", () => {
    expect(isEpisodeEnding(ep(24 * 60 - 140))).toBe(true);
    expect(isEpisodeEnding(ep(24 * 60 - 200))).toBe(false);
  });
  it("uses 10% for shorter episodes", () => {
    expect(isEpisodeEnding(ep(9 * 60 - 60, 9 * 60))).toBe(false);
    expect(isEpisodeEnding(ep(9 * 60 - 50, 9 * 60))).toBe(true);
  });
  it("never fires for clips or unknown durations", () => {
    expect(isEpisodeEnding(ep(170, 180))).toBe(false);
    expect(isEpisodeEnding(ep(1e6, Infinity))).toBe(false);
  });
});

describe("shouldOfferQuiz", () => {
  const ok = { optedOut: false, asked: false, inCourse: false, lines: 40, playedSec: 20 * 60, ending: true };
  it("offers when everything holds", () => expect(shouldOfferQuiz(ok)).toBe(true));
  it.each([
    ["opted out", { optedOut: true }],
    ["already asked", { asked: true }],
    ["following the N5 course", { inCourse: true }],
    ["too few lines", { lines: 19 }],
    ["seeked to the end without watching", { playedSec: 60 }],
    ["mid-episode", { ending: false }],
  ])("does not offer when %s", (_, patch) => expect(shouldOfferQuiz({ ...ok, ...patch })).toBe(false));
});

describe("scoring", () => {
  it("grades choices and tile order", () => {
    expect(isCorrect(meaning("猫", 2), 2)).toBe(true);
    expect(isCorrect(meaning("猫", 2), 1)).toBe(false);
    expect(isCorrect(build, ["猫", "が", "好き"])).toBe(true);
    expect(isCorrect(build, ["が", "猫", "好き"])).toBe(false);
    expect(isCorrect(build, ["猫", "が"])).toBe(false);
    expect(isCorrect(build, null)).toBe(false);
    expect(scoreQuiz([meaning("a"), build], [0, ["猫", "が", "好き"]])).toBe(2);
  });

  it("bands the verdict", () => {
    expect(verdictFor(9, 10)).toBe("Sharp");
    expect(verdictFor(7, 10)).toBe("Solid");
    expect(verdictFor(4, 10)).toBe("Getting there");
    expect(verdictFor(3, 10)).toBe("Rewatch-worthy");
    expect(verdictFor(0, 0)).toBe("Rewatch-worthy");
  });
});

describe("flashcards from misses", () => {
  const qs = [meaning("猫"), meaning("犬"), meaning("猫"), meaning("鳥"), build];
  const answers = [1, 1, 1, 0, null];

  it("only missed meaning words, once each, not already in the deck", () => {
    const vocab: VocabMap = { 犬: rec("learning") };
    expect(missedWords(qs, answers, vocab).map((w) => w.word)).toEqual(["猫"]);
    expect(missedWords(qs, answers, {})[0]).toEqual({ word: "猫", reading: "", gloss: "g", line: "猫だよ" });
  });

  it("re-adds a word the learner had ignored or only seen", () => {
    expect(missedWords(qs, answers, { 猫: rec("new") }).map((w) => w.word)).toEqual(["猫", "犬"]);
  });

  it("picks practice words, missed first", () => {
    expect(practiceWords(qs, answers)).toEqual(["猫", "犬"]);
    expect(practiceWords([meaning("鳥"), meaning("猫")], [0, 1])).toEqual(["猫", "鳥"]);
  });

  it("finds known words that came up", () => {
    const vocab: VocabMap = { 猫: rec("known"), 犬: rec("learning"), 鳥: rec("known"), 魚: rec("new") };
    expect(knownWordsIn([{ ja: "猫と犬と魚", en: "" }], vocab)).toEqual(["猫", "犬"]);
  });
});

describe("helpers", () => {
  it("remembers the newest asked keys", () => {
    let asked: string[] = [];
    for (let i = 0; i < MAX_ASKED_KEYS + 5; i++) asked = rememberAsked(asked, `k${i}`);
    expect(asked).toHaveLength(MAX_ASKED_KEYS);
    expect(rememberAsked(asked, "k10").at(-1)).toBe("k10");
  });

  it("never hands back tiles already in order", () => {
    expect(shuffled(["a", "b", "c"], () => 0.999)).not.toEqual(["a", "b", "c"]);
    expect(shuffled(["a"])).toEqual(["a"]);
  });
});
