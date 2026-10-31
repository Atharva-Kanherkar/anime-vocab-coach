import { expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ suppressedUntil: null as number | null }));
vi.mock('../src/lib/storage', () => ({
  getSyncToken: vi.fn(async () => ''),
  getAutoLinkAttemptedAt: vi.fn(async () => null),
  getAutoLinkSuppressedUntil: vi.fn(async () => state.suppressedUntil),
  setAutoLinkAttemptedAt: vi.fn(async () => {}),
  setSyncProfile: vi.fn(async () => {}),
  setSyncToken: vi.fn(async () => {}),
  normalizeSyncPlan: () => 'free',
}));
vi.mock('../src/lib/extension-events', () => ({ trackExtensionMilestone: vi.fn(async () => {}) }));
import { attemptAutoLink } from '../src/lib/account-link';
import { setSyncToken } from '../src/lib/storage';
it('discards a successful mint if sign-out happened during the request', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => {
    state.suppressedUntil = Date.now() + 300000;
    return new Response(JSON.stringify({ token: 'stale-token' }));
  }));
  expect(await attemptAutoLink('test', { force: true })).toEqual({ linked: false, outcome: 'throttled' });
  expect(setSyncToken).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
});
