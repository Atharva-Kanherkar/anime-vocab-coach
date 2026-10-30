import { describe, expect, it } from "vitest";
import { buildDrill, requeue, type DrillCard } from "./drill";
import { MAX_RECORDING_MS, recorderTransition, recordingType, remaining, type RecorderState } from "./recorder";

const cards: DrillCard[] = ["a", "b", "c", "d", "e"].map((id, i) => ({ id, reading: `word${i}`, meaning: `meaning ${i}`, audio: `clip${i}` }));

describe("drill", () => {
  it("builds one seeded round per card with exactly one answer among three distinct options", () => {
    const rounds = buildDrill(cards, 7);
    expect(rounds).toHaveLength(5);
    expect(buildDrill(cards, 7)).toEqual(rounds);
    expect(new Set(rounds.map((r) => r.cardId)).size).toBe(5);
    for (const round of rounds) {
      expect(round.options).toHaveLength(3);
      expect(round.options.filter((o) => o.id === round.answerId)).toHaveLength(1);
      expect(new Set(round.options.map((o) => o.label)).size).toBe(3);
      const card = cards.find((c) => c.id === round.cardId)!;
      if (round.kind === "meaning") { expect(round.prompt).toBe(card.meaning); expect(round.options.every((o) => o.japanese)).toBe(true); }
      if (round.kind === "word") expect(round.prompt).toBe(card.reading);
      if (round.kind === "listen") { expect(round.audio).toBe(card.audio); expect(round.prompt).toBe(""); }
    }
    expect(new Set(rounds.map((r) => r.kind))).toEqual(new Set(["meaning", "listen", "word"]));
  });
  it("needs three cards and never repeats a duplicate label as a distractor", () => {
    expect(buildDrill(cards.slice(0, 2), 1)).toEqual([]);
    const dup = [...cards.slice(0, 3), { ...cards[2], id: "z" }];
    for (const round of buildDrill(dup, 3, ["word"])) expect(new Set(round.options.map((o) => o.label)).size).toBe(round.options.length);
  });
  it("requeues a missed card once, in a different kind", () => {
    const rounds = buildDrill(cards, 11);
    expect(requeue(rounds, 0, true, cards, 11)).toBe(rounds);
    const again = requeue(rounds, 0, false, cards, 11);
    expect(again).toHaveLength(6);
    expect(again[5].cardId).toBe(rounds[0].cardId);
    expect(again[5].kind).not.toBe(rounds[0].kind);
    expect(requeue(again, 5, false, cards, 11)).toBe(again);
  });
});

describe("drill edges", () => {
  it("works with exactly three cards and with seed zero", () => {
    expect(buildDrill(cards.slice(0, 3), 5)).toHaveLength(3);
    expect(buildDrill(cards, 0)).toHaveLength(5);
  });
  it("actually shuffles: different seeds reorder cards and options", () => {
    const firsts = new Set(Array.from({ length: 30 }, (_, seed) => buildDrill(cards, seed + 1)[0].cardId));
    expect(firsts.size).toBeGreaterThan(2);
    const answerSlots = new Set(Array.from({ length: 30 }, (_, seed) => buildDrill(cards, seed + 1)[0].options.findIndex((o) => o.id === buildDrill(cards, seed + 1)[0].answerId)));
    expect(answerSlots.size).toBe(3);
  });
  it("labels options by kind and never offers a distractor that reads like the answer", () => {
    const same = [{ id: "x", reading: "ねこ", meaning: "cat", audio: "c1" }, { id: "y", reading: "ねこ", meaning: "kitty", audio: "c2" }, { id: "z", reading: "いぬ", meaning: "dog", audio: "c3" }, { id: "w", reading: "とり", meaning: "bird", audio: "c4" }];
    for (let seed = 1; seed < 20; seed++) {
      for (const round of buildDrill(same, seed, ["meaning"])) {
        const labels = round.options.map((o) => o.label);
        expect(new Set(labels).size).toBe(labels.length);
        expect(round.options.every((o) => o.label === same.find((c) => c.id === o.id)!.reading)).toBe(true);
      }
      for (const round of buildDrill(same, seed, ["word"])) expect(round.options.every((o) => o.label === same.find((c) => c.id === o.id)!.meaning && !o.japanese)).toBe(true);
    }
    const listen = buildDrill(cards, 3, ["listen"]);
    expect(listen.every((r) => r.prompt === "" && r.audio && r.options.every((o) => !o.japanese))).toBe(true);
  });
  it("does not requeue a card that already comes back later or an unknown card", () => {
    const rounds = buildDrill(cards, 13);
    const withRepeat = [...rounds, rounds[0]];
    expect(requeue(withRepeat, 0, false, cards, 13)).toBe(withRepeat);
    expect(requeue(rounds, 99, false, cards, 13)).toBe(rounds);
    expect(requeue(rounds, 0, false, cards.slice(1).filter((c) => c.id !== rounds[0].cardId), 13)).toBe(rounds);
    const again = requeue(rounds, 2, false, cards, 13);
    expect(again.at(-1)!.cardId).toBe(rounds[2].cardId);
    expect(again.at(-1)!.key).toContain(":again:2");
  });
});

describe("recorder", () => {
  it("follows request → record → send → idle and auto-limits", () => {
    let s: RecorderState = { phase: "idle" };
    s = recorderTransition(s, { type: "request" });
    expect(s).toEqual({ phase: "requesting" });
    s = recorderTransition(s, { type: "granted", at: 1000 });
    expect(remaining(s, 1000 + MAX_RECORDING_MS - 4_500)).toBe(5);
    expect(remaining(s, 1000 + MAX_RECORDING_MS + 1)).toBe(0);
    expect(recorderTransition(s, { type: "request" })).toBe(s);
    s = recorderTransition(s, { type: "stop", at: 3000 });
    expect(s).toEqual({ phase: "sending" });
    expect(recorderTransition(s, { type: "reset" })).toBe(s);
    expect(recorderTransition(s, { type: "failed" })).toEqual({ phase: "error", reason: "failed" });
    expect(recorderTransition(s, { type: "sent" })).toEqual({ phase: "idle" });
  });
  it("rejects too-short clips and surfaces denial", () => {
    const recording = recorderTransition(recorderTransition({ phase: "idle" }, { type: "request" }), { type: "granted", at: 0 });
    expect(recorderTransition(recording, { type: "stop", at: 100 })).toEqual({ phase: "error", reason: "too_short" });
    expect(recorderTransition({ phase: "requesting" }, { type: "denied" })).toEqual({ phase: "error", reason: "denied" });
    expect(recorderTransition({ phase: "idle" }, { type: "denied" })).toEqual({ phase: "idle" });
    expect(recorderTransition({ phase: "error", reason: "denied" }, { type: "reset" })).toEqual({ phase: "idle" });
    expect(recorderTransition({ phase: "idle" }, { type: "stop", at: 1 })).toEqual({ phase: "idle" });
  });
  it("ignores out-of-order events and reports the full budget when idle", () => {
    expect(recorderTransition({ phase: "recording", startedAt: 0 }, { type: "unsupported" })).toEqual({ phase: "error", reason: "unsupported" });
    expect(recorderTransition({ phase: "idle" }, { type: "sent" })).toEqual({ phase: "idle" });
    expect(recorderTransition({ phase: "idle" }, { type: "failed" })).toEqual({ phase: "idle" });
    expect(recorderTransition({ phase: "idle" }, { type: "granted", at: 1 })).toEqual({ phase: "idle" });
    expect(recorderTransition({ phase: "sending" }, { type: "request" })).toEqual({ phase: "sending" });
    expect(recorderTransition({ phase: "error", reason: "failed" }, { type: "request" })).toEqual({ phase: "requesting" });
    expect(recorderTransition({ phase: "recording", startedAt: 0 }, { type: "reset" })).toEqual({ phase: "recording", startedAt: 0 });
    expect(recorderTransition({ phase: "recording", startedAt: 0 }, { type: "stop", at: 600 })).toEqual({ phase: "sending" });
    expect(recorderTransition({ phase: "recording", startedAt: 0 }, { type: "stop", at: 599 })).toEqual({ phase: "error", reason: "too_short" });
    expect(recorderTransition({ phase: "recording", startedAt: 0 }, { type: "cancel" })).toEqual({ phase: "idle" });
    expect(recorderTransition({ phase: "sending" }, { type: "cancel" })).toEqual({ phase: "sending" });
    expect(remaining({ phase: "idle" }, 123)).toBe(30);
    expect(remaining({ phase: "recording", startedAt: 0 }, 0)).toBe(30);
  });
  it("maps browser recording types to the accepted set", () => {
    expect(recordingType("audio/webm;codecs=opus")).toBe("audio/webm");
    expect(recordingType("audio/mp4")).toBe("audio/mp4");
    expect(recordingType("AUDIO/OGG; codecs=opus")).toBe("audio/ogg");
    expect(recordingType("video/webm")).toBeNull();
    expect(recordingType("audio/wav")).toBe("audio/wav");
    expect(recordingType("audio/webm")).toBe("audio/webm");
    expect(recordingType("")).toBeNull();
  });
});
