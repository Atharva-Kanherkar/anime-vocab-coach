/** A stop cancels starts that are still awaiting browser permission or a stream. */
export class CaptureStarts {
  private pending = new Map<number, symbol>();
  begin(tabId: number): symbol { const token = Symbol(); this.pending.set(tabId, token); return token; }
  cancel(tabId: number): void { this.pending.delete(tabId); }
  cancelAll(): number[] { const tabs = [...this.pending.keys()]; this.pending.clear(); return tabs; }
  current(tabId: number, token: symbol): boolean { return this.pending.get(tabId) === token; }
}
