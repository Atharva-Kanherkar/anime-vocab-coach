import { describe, it, expect } from 'vitest';
import { CaptureStarts } from '../src/lib/capture-starts';

describe('sign-out cancels pending Listening starts', () => {
  it('invalidates starts on every tab, including tabs not yet marked active', () => {
    const starts = new CaptureStarts();
    const a = starts.begin(1), b = starts.begin(2);
    expect(starts.cancelAll()).toEqual([1, 2]);
    expect(starts.current(1, a)).toBe(false);
    expect(starts.current(2, b)).toBe(false);
    const next = starts.begin(1);
    expect(starts.current(1, next)).toBe(true);
    expect(starts.current(1, a)).toBe(false);
  });
});
