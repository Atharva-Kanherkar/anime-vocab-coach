import { beforeEach, describe, expect, it, vi } from 'vitest';
import { restoredAccountCache } from '../src/lib/account-cache';
import { normalizeAnimeVocabExport } from '../web/src/lib/sync';
const local: Record<string, unknown> = {};
beforeEach(() => {
  for (const k of Object.keys(local)) delete local[k];
  vi.stubGlobal('chrome', { storage: { local: { get: vi.fn(async (key: string) => ({ [key]: local[key] })) } } });
  vi.stubGlobal('fetch', vi.fn());
});
describe('account cache after explicit sign-out', () => {
  it('never fetches or replaces a legacy deck on first sign-in', async () => {
    local.vocab = { legacy: { srs: { stage: 5 } } };
    expect(await restoredAccountCache('token')).toEqual({});
    expect(fetch).not.toHaveBeenCalled();
  });
  it('restores all words and review schedules before accepting the token', async () => {
    local.accountCacheClearedAt = 123;
    const vocab = { '明日': { state: 'learning', reading: 'あした', gloss: 'tomorrow', level: 5, freqRank: 100, seenCount: 9, shownCount: 2, firstSeenAt: 1700000000000, lastSeenAt: 1700000000001, srs: { stage: 3, dueAt: 1800000000000, lapses: 1 } } };
    const snapshot = normalizeAnimeVocabExport({ vocab, settings: { pauseMode: 'off' }, stats: { daily: {}, cardTimestamps: [] } });
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ envelope: { snapshot, webReviewSeq: 9 } })));
    const patch = await restoredAccountCache('token');
    expect(patch.vocab).toEqual(vocab);
    expect(patch.settings).toEqual({ pauseMode: 'off' });
    expect(patch.webReviewSeq).toBe(9);
    expect(patch.accountCacheClearedAt).toBeNull();
  });
  it('keeps the gate closed on restore failure', async () => {
    local.accountCacheClearedAt = 123;
    vi.mocked(fetch).mockResolvedValue(new Response('{}', { status: 503 }));
    await expect(restoredAccountCache('token')).rejects.toThrow('Could not restore');
    expect(local.accountCacheClearedAt).toBe(123);
  });
  it('allows an account with no cloud snapshot to start with an empty cache', async () => {
    local.accountCacheClearedAt = 123;
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ envelope: null })));
    const patch = await restoredAccountCache('new-account-token');
    expect(patch.vocab).toEqual({});
    expect(patch.webReviewSeq).toBe(0);
    expect(patch.accountCacheClearedAt).toBeNull();
  });
  it('does not adopt a cache from a cancelled sign-in', async () => {
    local.accountCacheClearedAt = 123;
    vi.mocked(fetch).mockImplementation(async () => { local.accountCacheClearedAt = 456; return new Response('{}'); });
    await expect(restoredAccountCache('token')).rejects.toThrow('Account changed');
  });
});
