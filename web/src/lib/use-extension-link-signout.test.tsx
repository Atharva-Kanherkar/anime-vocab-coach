// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
afterEach(() => { cleanup(); vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
it('does not broadcast an in-flight token after sign-out', async () => {
  vi.resetModules();
  vi.useFakeTimers();
  let finish!: (response: Response) => void;
  vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(resolve => { finish = resolve; })));
  const posted = vi.spyOn(window, 'postMessage');
  const { useExtensionLink, notifyExtensionLinkSignedOut } = await import('./use-extension-link');
  renderHook(() => useExtensionLink());
  await act(async () => {
    window.dispatchEvent(new MessageEvent('message', { source: window, origin: location.origin, data: { source: 'avc-ext', type: 'avc-ext-present' } }));
  });
  expect(fetch).toHaveBeenCalledOnce();
  await act(async () => {
    notifyExtensionLinkSignedOut();
    finish(new Response(JSON.stringify({ token: 'stale-token' })));
    await Promise.resolve();
  });
  expect(posted.mock.calls.some(([msg]) => msg?.type === 'avc-sync-token')).toBe(false);
});
