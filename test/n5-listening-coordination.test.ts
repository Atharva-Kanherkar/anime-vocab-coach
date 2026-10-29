import { expect, it, vi } from "vitest";
import { listeningRegistry, retryCaptureStart } from "../src/lib/listening-coordination";
const deferred = () => { let resolve!: () => void; const promise = new Promise<void>(r => { resolve = r; }); return { promise, resolve }; };
it("never retries a start after stop while the offscreen document is loading", async () => {
  let current = true;
  const delay = deferred(), waiting = deferred();
  const send = vi.fn().mockRejectedValueOnce(new Error("Not loaded")).mockResolvedValue({ ok: true });
  const start = retryCaptureStart(send, () => current, () => { waiting.resolve(); return delay.promise; });
  await waiting.promise;
  current = false; delay.resolve();
  expect(await start).toMatchObject({ ok: false }); expect(send).toHaveBeenCalledTimes(1);
});
it("retries loading failures, returns definitive success/failure, and bounds unavailable offscreen waits", async () => {
  const send = vi.fn().mockResolvedValueOnce(undefined).mockResolvedValueOnce({ ok: true });
  expect(await retryCaptureStart(send, () => true, async () => {})).toEqual({ ok: true }); expect(send).toHaveBeenCalledTimes(2);
  const failure = vi.fn(async () => ({ ok: false, error: "capture denied" }));
  expect(await retryCaptureStart(failure, () => true)).toEqual({ ok: false, error: "capture denied" }); expect(failure).toHaveBeenCalledOnce();
  const missing = vi.fn(async () => undefined);
  await expect(retryCaptureStart(missing, () => true, async () => {})).rejects.toThrow("never acknowledged"); expect(missing).toHaveBeenCalledTimes(15);
});
it("an acknowledged stop waits for an earlier start write and remains the final stored state", async () => {
  let tabs: Record<number, boolean> = {};
  let current = true;
  const entered = deferred(), release = deferred();
  const update = listeningRegistry(async () => structuredClone(tabs), async next => {
    if (next[7]) { entered.resolve(); await release.promise; }
    tabs = structuredClone(next);
  });
  const start = update(7, true, () => current); await entered.promise;
  current = false;
  const stopped = vi.fn(); const stop = update(7, false).then(stopped);
  await Promise.resolve(); expect(stopped).not.toHaveBeenCalled();
  release.resolve(); expect(await start).toBe(false); await stop;
  expect(tabs).toEqual({}); expect(stopped).toHaveBeenCalledOnce();
  expect(await update(7, true)).toBe(true); expect(tabs).toEqual({ 7: true });
});
it("preserves other tabs, ignores cancelled queued writes and recovers after storage failure", async () => {
  let tabs: Record<number, boolean> = { 2: true };
  let fail = true;
  const update = listeningRegistry(async () => structuredClone(tabs), async next => { if (fail) throw new Error("storage unavailable"); tabs = next; });
  await expect(update(7, true)).rejects.toThrow("storage unavailable"); fail = false;
  expect(await update(7, true, () => false)).toBe(false); expect(tabs).toEqual({ 2: true });
  expect(await update(7, true)).toBe(true); expect(tabs).toEqual({ 2: true, 7: true });
  await update(7, false); expect(tabs).toEqual({ 2: true });
});
