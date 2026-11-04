import { describe, expect, it } from "vitest";
import { GRAMMAR, UNIT_COUNT, WORDS, syllabusBlock, unitTargets } from "./plan";

const allTargets = () => Array.from({ length: UNIT_COUNT }, (_, i) => unitTargets(i + 1));

describe("N5 unit plan", () => {
  it("assigns every course word exactly once across 24 units", () => {
    const assigned = allTargets().flatMap((target) => target.words);
    const course = WORDS.filter((word) => !word.reserve).map((word) => word.id);
    expect(assigned).toHaveLength(600);
    expect(new Set(assigned).size).toBe(600);
    expect([...assigned].sort()).toEqual([...course].sort());
  });

  it("assigns every grammar point exactly once across 24 units", () => {
    const assigned = allTargets().flatMap((target) => target.grammar);
    expect(assigned).toHaveLength(GRAMMAR.length);
    expect(new Set(assigned).size).toBe(GRAMMAR.length);
    expect([...assigned].sort()).toEqual(GRAMMAR.map((point) => point.id).sort());
  });

  it("gives every unit 25 words and 3-4 grammar points", () => {
    for (let unit = 1; unit <= UNIT_COUNT; unit++) {
      const target = unitTargets(unit);
      expect(target.words, `unit ${unit}`).toHaveLength(25);
      expect(new Set(target.words).size, `unit ${unit}`).toBe(25);
      expect(target.grammar.length, `unit ${unit}`).toBeGreaterThanOrEqual(3);
      expect(target.grammar.length, `unit ${unit}`).toBeLessThanOrEqual(4);
    }
  });

  it("never assigns a reserve word", () => {
    const reserve = new Set(WORDS.filter((word) => word.reserve).map((word) => word.id));
    for (const target of allTargets()) {
      for (const id of target.words) expect(reserve.has(id), id).toBe(false);
    }
  });

  it("introduces grammar bands in order and never regresses", () => {
    const band = new Map(GRAMMAR.map((point) => [point.id, point.band]));
    let previous = 0;
    for (let unit = 1; unit <= UNIT_COUNT; unit++) {
      const bands = unitTargets(unit).grammar.map((id) => band.get(id)!);
      for (const current of bands) {
        expect(current, `unit ${unit}`).toBeGreaterThanOrEqual(previous);
        previous = current;
      }
    }
  });

  it("is deterministic and gives units 1 and 24 disjoint words", () => {
    expect(unitTargets(1)).toEqual(unitTargets(1));
    expect(unitTargets(24)).toEqual(unitTargets(24));
    const first = new Set(unitTargets(1).words);
    for (const id of unitTargets(24).words) expect(first.has(id), id).toBe(false);
  });

  it("rejects units outside the course", () => {
    expect(() => unitTargets(0)).toThrow();
    expect(() => unitTargets(25)).toThrow();
    expect(() => unitTargets(1.5)).toThrow();
  });
});

describe("syllabus prompt block", () => {
  it("is byte-stable and covers the whole pool", () => {
    const first = syllabusBlock();
    const second = syllabusBlock();
    expect(first).toBe(second);
    expect(first.length).toBeGreaterThan(10_000);
    for (const word of WORDS) expect(first).toContain(`\t${word.src}\t`);
  });

  it("carries no volatile values that would break a prompt cache", () => {
    const block = syllabusBlock();
    expect(block).not.toMatch(/\b20\d{2}-\d{2}-\d{2}\b/);
    expect(block).not.toMatch(/\bunit \d+\b/i);
    expect(block).not.toMatch(/userId|jobId|attempt \d+/);
  });
});
