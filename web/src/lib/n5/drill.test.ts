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
  it("maps browser recording types to the accepted set", () => {
    expect(recordingType("audio/webm;codecs=opus")).toBe("audio/webm");
    expect(recordingType("audio/mp4")).toBe("audio/mp4");
    expect(recordingType("AUDIO/OGG; codecs=opus")).toBe("audio/ogg");
    expect(recordingType("video/webm")).toBeNull();
    expect(recordingType("")).toBeNull();
  });
});
