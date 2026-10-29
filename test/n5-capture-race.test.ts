import { expect, it, vi } from "vitest";
import { CaptureStarts } from "../src/lib/capture-starts";
it("cancels pending starts without reviving a prior generation or affecting another tab", () => {
  const starts = new CaptureStarts(), first = starts.begin(1), other = starts.begin(2);
  starts.cancel(1); expect(starts.current(1, first)).toBe(false); expect(starts.current(2, other)).toBe(true);
  const second = starts.begin(1); expect(starts.current(1, first)).toBe(false); expect(starts.current(1, second)).toBe(true);
});
it("actual offscreen entry stops a stream acquired after stop was already acknowledged", async () => {
  vi.resetModules();
  let listener: (message: unknown, sender: unknown, reply: (value: unknown) => void) => unknown = () => {};
  let acquire!: (value: unknown) => void;
  const track = { readyState: "live", stop: vi.fn(() => { track.readyState = "ended"; }) };
  const ctx = vi.fn();
  vi.stubGlobal("chrome", { runtime: { onMessage: { addListener: (fn: typeof listener) => { listener = fn; } }, sendMessage: vi.fn(async () => {}) } });
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: () => new Promise(resolve => { acquire = resolve; }) } });
  vi.stubGlobal("AudioContext", ctx);
  await import("../src/entries/offscreen");
  const response = new Promise(resolve => listener({ type: "avc-offscreen-start", tabId: 7, streamId: "test", auth: { kind: "byo", key: "unused" }, model: "test" }, {}, resolve));
  const stopped = vi.fn(); listener({ type: "avc-offscreen-stop", tabId: 7 }, {}, stopped);
  expect(stopped).toHaveBeenCalledWith({ ok: true });
  acquire({ getTracks: () => [track] });
  expect(await response).toMatchObject({ ok: false });
  expect(track.stop).toHaveBeenCalledOnce(); expect(track.readyState).toBe("ended"); expect(ctx).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
});
