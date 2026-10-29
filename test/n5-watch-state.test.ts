import { describe, expect, it } from "vitest";
import { classifyN5WatchSignal, n5WatchObservation, type N5WatchKind } from "../src/lib/n5-watch-state";

describe("classifyN5WatchSignal", () => {
  it("classifies an explicit completion as watched", () => {
    expect(classifyN5WatchSignal({ finished: true })).toBe("complete");
  });

  it("classifies skip, seek and replay without awarding credit", () => {
    expect(classifyN5WatchSignal({ finished: false, skipped: true })).toBe("skip");
    expect(classifyN5WatchSignal({ finished: false, seeked: true })).toBe("seek");
    expect(classifyN5WatchSignal({ finished: false, replayed: true })).toBe("replay");
  });

  it("returns none when no playback action was reported", () => {
    expect(classifyN5WatchSignal({ finished: false })).toBe("none");
    expect(classifyN5WatchSignal({})).toBe("none");
  });
});

describe("n5WatchObservation", () => {
  it("emits a watched observation only for completions", () => {
    expect(n5WatchObservation({ finished: true }, "s1-e1", 1234)).toEqual({
      episodeId: "s1-e1",
      kind: "complete" as N5WatchKind,
      observedAt: 1234,
    });
    expect(n5WatchObservation({ finished: false, skipped: true }, "s1-e1", 1234)).toEqual({
      episodeId: "s1-e1",
      kind: "skip" as N5WatchKind,
      observedAt: 1234,
    });
    expect(n5WatchObservation({ finished: false }, "s1-e1", 1234)).toBeNull();
  });
});
