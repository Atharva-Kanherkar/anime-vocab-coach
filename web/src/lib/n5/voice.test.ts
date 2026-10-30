import { describe, expect, it } from "vitest";
import { VAD, callClock, rms, vadStart, vadStep, vadThreshold, type VadState } from "./voice";

/** Feed a loudness level every 20 ms from `from` to `to` and collect events. */
function run(state: VadState, level: number, from: number, to: number) {
  const events: [number, string][] = [];
  for (let t = from; t <= to; t += 20) {
    const step = vadStep(state, level, t);
    state = step.state;
    if (step.event !== "none") events.push([t, step.event]);
  }
  return { state, events };
}

describe("voice activity", () => {
  it("starts with the minimum threshold and a quiet room", () => {
    const s = vadStart(5);
    expect(s).toEqual({ floor: VAD.minLevel / VAD.ratio, startedAt: 5, heard: false, aboveSince: null, belowSince: null });
    expect(vadThreshold(s)).toBeCloseTo(VAD.minLevel);
    expect(vadThreshold({ ...s, floor: 0.1 })).toBeCloseTo(0.1 * VAD.ratio);
  });
  it("hears speech only after it lasts long enough, then ends the turn after a pause", () => {
    let { state, events } = run(vadStart(0), 0.002, 0, 400);
    expect(events).toEqual([]);
    ({ state, events } = run(state, 0.2, 420, 420 + VAD.speechMs));
    expect(events).toEqual([[420 + VAD.speechMs, "speech"]]);
    expect(state.heard).toBe(true);
    // Short pauses inside a sentence don't end the turn.
    ({ state, events } = run(state, 0.001, 700, 700 + VAD.silenceMs - 20));
    expect(events).toEqual([]);
    ({ state, events } = run(state, 0.2, 2000, 2100));
    expect(events).toEqual([]);
    expect(state.belowSince).toBeNull();
    ({ events } = run(state, 0.001, 2200, 2200 + VAD.silenceMs));
    expect(events).toEqual([[2200 + VAD.silenceMs, "end"]]);
  });
  it("ignores a brief click", () => {
    let state = vadStart(0);
    state = vadStep(state, 0.3, 100).state;
    expect(state.aboveSince).toBe(100);
    const step = vadStep(state, 0.3, 100 + VAD.speechMs - 1);
    expect(step.event).toBe("none");
    expect(step.state.heard).toBe(false);
    const quiet = vadStep(step.state, 0, 300);
    expect(quiet.state.aboveSince).toBeNull();
    expect(quiet.state.belowSince).toBe(300);
  });
  it("gives up when nothing is said", () => {
    const { events } = run(vadStart(0), 0.001, 0, VAD.idleMs);
    expect(events).toEqual([[VAD.idleMs, "idle"]]);
    expect(vadStep(vadStart(0), 0, VAD.idleMs - 1).event).toBe("none");
  });
  it("learns a noisy room before speech, and stops learning once speech starts", () => {
    const noisy = run(vadStart(0), 0.01, 0, 2000).state;
    expect(noisy.floor).toBeGreaterThan(0.009);
    expect(vadThreshold(noisy)).toBeGreaterThan(0.02);
    // Room noise alone never counts as speech.
    expect(run(noisy, 0.01, 2020, 4000).events).toEqual([]);
    const speaking = { ...noisy, heard: true };
    expect(vadStep(speaking, 0, 5000).state.floor).toBe(noisy.floor);
    expect(vadStep(vadStart(0), 0.001, 1).state.floor).toBeCloseTo((VAD.minLevel / VAD.ratio) * 0.9 + 0.0001);
  });
  it("measures loudness and formats the call clock", () => {
    expect(rms([])).toBe(0);
    expect(rms([0.5, -0.5, 0.5, -0.5])).toBeCloseTo(0.5);
    expect(rms([1, 0])).toBeCloseTo(Math.SQRT1_2);
    expect(callClock(0)).toBe("00:00");
    expect(callClock(-5)).toBe("00:00");
    expect(callClock(61_999)).toBe("01:01");
    expect(callClock(600_000)).toBe("10:00");
  });
});
