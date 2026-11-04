import { describe, expect, it } from "vitest";
import { UNITS } from "../curriculum";
import { GRAMMAR } from "./plan";

describe("N5 syllabus grammar", () => {
  it("ships 70-90 points with unique ids", () => {
    expect(GRAMMAR.length).toBeGreaterThanOrEqual(70);
    expect(GRAMMAR.length).toBeLessThanOrEqual(90);
    expect(new Set(GRAMMAR.map((point) => point.id)).size).toBe(GRAMMAR.length);
  });

  it("keeps every seeded curriculum grammar id and title", () => {
    let seeded = 0;
    for (const unit of UNITS) {
      unit.grammar.forEach((point, index) => {
        const id = `u${String(unit.unit).padStart(2, "0")}-g${index + 1}`;
        expect(GRAMMAR.find((entry) => entry.id === id)?.title, id).toBe(point.title);
        seeded++;
      });
    }
    expect(seeded).toBe(48);
  });

  it("has a prerequisite in a strictly earlier band, and no cycles", () => {
    const byId = new Map(GRAMMAR.map((point) => [point.id, point]));
    for (const point of GRAMMAR) {
      expect([1, 2, 3, 4]).toContain(point.band);
      for (const prerequisite of point.prerequisites) {
        const earlier = byId.get(prerequisite);
        expect(earlier, `${point.id} -> ${prerequisite}`).toBeDefined();
        expect(earlier!.band, `${point.id} -> ${prerequisite}`).toBeLessThan(point.band);
      }
    }
  });

  it("has a title, pattern and explanation for every point", () => {
    for (const point of GRAMMAR) {
      expect(point.title.trim(), point.id).not.toBe("");
      expect(point.pattern.trim(), point.id).not.toBe("");
      expect(point.explanation.trim(), point.id).not.toBe("");
    }
  });
});
