import { describe, expect, it } from "vitest";
import type { N5LessonProgress } from "../../../../shared/n5/contracts";
import { completedSteps, localStepsKey, parseLocalSteps, sectionIndex, stepsFor, unitPercent } from "./steps";

const progress = (p: Partial<N5LessonProgress>): N5LessonProgress => ({ lessonId: "l", status: "not_started", bestPercent: null, watched: false, speaking: "not_started", heard: [], ...p });

describe("unit steps", () => {
  it("drops watch for study and final units", () => {
    expect(stepsFor("episode")).toEqual(["learn", "drill", "watch", "practice", "speak"]);
    expect(stepsFor("study")).toEqual(["learn", "drill", "practice", "speak"]);
    expect(stepsFor("final")).not.toContain("watch");
  });
  it("combines server progress with this browser's study marks", () => {
    expect([...completedSteps("episode", undefined, [])]).toEqual([]);
    expect([...completedSteps("episode", progress({}), ["learn"])]).toEqual(["learn"]);
    expect(completedSteps("episode", progress({}), ["drill"])).toEqual(new Set(["drill", "learn"]));
    expect(completedSteps("episode", progress({ watched: true }), [])).toEqual(new Set(["watch"]));
    expect(completedSteps("study", progress({ watched: true }), [])).toEqual(new Set());
    expect(completedSteps("episode", progress({ status: "practised" }), [])).toEqual(new Set(["learn", "practice"]));
    expect(completedSteps("episode", progress({ status: "passed", speaking: "practice_only" }), [])).toEqual(new Set(["learn", "practice", "speak"]));
    expect(completedSteps("episode", progress({ status: "in_progress" }), [])).toEqual(new Set());
  });
  it("reports percent of the unit's own steps", () => {
    expect(unitPercent("episode", new Set(["learn", "drill"]))).toBe(40);
    expect(unitPercent("final", new Set(["learn", "drill"]))).toBe(50);
    expect(unitPercent("episode", new Set(["learn", "drill", "watch", "practice", "speak"]))).toBe(100);
  });
  it("keeps only learn and drill from untrusted storage", () => {
    expect(parseLocalSteps('["learn","drill","practice","learn"]')).toEqual(["learn", "drill"]);
    for (const bad of [null, "", "{", '{"a":1}', "x".repeat(201), "[1,2]"]) expect(parseLocalSteps(bad)).toEqual([]);
    expect(localStepsKey("a:b", "c")).not.toBe(localStepsKey("a", "b:c"));
  });
  it("maps units to the four sections", () => {
    expect([1, 6, 7, 12, 13, 18, 19, 24, 99].map(sectionIndex)).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 3]);
  });
});
