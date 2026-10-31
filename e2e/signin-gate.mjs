// Real extension, fresh Chromium profile, fake hosts. No production API writes.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const shots = 'e2e/shots';
mkdirSync(shots, { recursive: true });
const ctx = await chromium.launchPersistentContext('', {
  headless: false,
  args: [`--disable-extensions-except=${process.cwd()}/extension`, `--load-extension=${process.cwd()}/extension`,
    '--host-resolver-rules=MAP animevocab.com 127.0.0.1:1,MAP api.animevocab.com 127.0.0.1:1'],
});
ctx.setDefaultTimeout(15000);
let checks = 0;
const check = (name, value) => { assert.ok(value, name); checks++; console.log('PASS', name); };
async function until(fn) {
  for (let i = 0; i < 100; i++) { if (await fn()) return; await new Promise(r => setTimeout(r, 100)); }
  throw new Error('Timed out: ' + fn.toString());
}
try {
  await ctx.route('https://animevocab.com/**', route => route.fulfill({ contentType: 'text/html', body: '<h1>Sign in</h1>' }));
  await ctx.route('https://www.youtube.com/**', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><title>Japanese episode - YouTube</title><div id="movie_player"><video width="640" height="360" muted></video><div class="ytp-caption-window-container"><span class="ytp-caption-segment"></span></div></div>` }));
  const sw = ctx.serviceWorkers()[0] || await ctx.waitForEvent('serviceworker');
  const id = new URL(sw.url()).host;
  await until(() => sw.evaluate(async () => !!(await chrome.storage.local.get('onboarding')).onboarding?.installedAt));
  await until(async () => ctx.pages().some(p => p.url().includes('/start')));
  check('fresh install opens hosted /start', ctx.pages().some(p => p.url().includes('/start?from=install')));
  // Fake the worker transport too: context routing does not intercept SW fetches.
  await sw.evaluate(() => {
    globalThis.requests = [];
    globalThis.allowMint = false;
    globalThis.fetch = async (url, init = {}) => {
      const path = String(url);
      globalThis.requests.push({ url: path, method: init.method || 'GET', body: init.body });
      if (path.endsWith('/api/sync/token')) return new Response(JSON.stringify(globalThis.allowMint ? { token: 'silent-token', profile: { name: 'Learner', plan: 'free' } } : {}), { status: globalThis.allowMint ? 200 : 401 });
      if (path.includes('/api/sync/snapshot')) return new Response(JSON.stringify(init.method === 'PUT' ? { ok: true } : { envelope: null }));
      if (path.includes('/api/track') || path.includes('/track')) return new Response(null, { status: 204 });
      return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
    };
  });
  const local = () => sw.evaluate(() => chrome.storage.local.get(null));
  const requests = () => sw.evaluate(() => globalThis.requests);
  const featureRequests = async () => (await requests()).filter(r => /\/api\/(anime|ai|transcript|me|n5|tts)/.test(r.url));
  const events = async name => (await requests()).filter(r => r.url.includes('/api/track') && r.body).map(r => JSON.parse(r.body)).filter(r => r.name === name);
  await sw.evaluate(() => chrome.storage.session.clear());
  const page = await ctx.newPage();
  const logs = [];
  page.on('pageerror', err => console.log('PAGE ERROR', String(err)));
  page.on('console', msg => { logs.push(msg.text()); if (process.env.AVC_E2E_VERBOSE) console.log('PAGE', msg.text()); });
  await page.goto('https://www.youtube.com/watch?v=account-gate');
  await page.locator('[data-avc-signin-chip] .chip').waitFor();
  await page.waitForTimeout(2200);
  check('signed out: chip only, no learning UI', await page.locator('#avc-overlay-host, #avc-lens-host').count() === 0);
  check('signed out: no feature API requests', (await featureRequests()).length === 0);
  await page.screenshot({ path: `${shots}/signin-gate-chip.png` });
  await page.getByRole('button', { name: 'Dismiss sign-in reminder' }).click();
  await until(async () => (await local()).signinChipDismissed === true);
  await until(async () => (await events('signin_gate_dismissed')).length === 1);
  await page.reload();
  await page.waitForTimeout(2300);
  check('dismissal survives reload and records beacon', await page.locator('[data-avc-signin-chip]').count() === 0);
  const popup = await ctx.newPage();
  await popup.goto(`chrome-extension://${id}/popup/popup.html`);
  await popup.locator('#gate-signin').waitFor();
  check('popup has one visible sign-in action', await popup.locator('button:visible').count() === 1);
  check('popup hides learning sections', await popup.locator('.av-actions, .av-account, .av-usage, .av-footer').evaluateAll(els => els.every(el => getComputedStyle(el).display === 'none')));
  check('opening popup does not mint', !(await requests()).some(r => r.url.endsWith('/api/sync/token')));
  const refusal = await popup.evaluate(() => chrome.runtime.sendMessage({ type: 'avc-listen-start', tabId: 999 }));
  check('Listening refuses before capture or BYO key', refusal.ok === false && /free account/.test(refusal.error));
  await sw.evaluate(() => chrome.storage.local.set({ signinUpgradeNotice: true }));
  await popup.reload();
  await popup.getByText('Your words now live in your free account. Sign in to keep them.').waitFor();
  check('upgrade notice consumed once', !(await local()).signinUpgradeNotice);
  await popup.reload();
  await popup.locator('#gate-signin').waitFor();
  check('upgrade notice is gone on next open', await popup.locator('.av-gate-upgrade').count() === 0);
  await popup.screenshot({ path: `${shots}/signin-gate-popup.png` });
  // Use a real runtime request from an extension page; worker cannot message itself.
  const videoTab = await sw.evaluate(async () => (await chrome.tabs.query({ url: 'https://www.youtube.com/*' }))[0].id);
  const flow = await popup.evaluate(tabId => chrome.runtime.sendMessage({ type: 'avc-open-signin', from: 'content_chip', tabId }), videoTab);
  check('signed-out session opens /start', flow.opened === true && flow.linked === false);
  const session = await sw.evaluate(() => chrome.storage.session.get(null));
  check('return tab and start tab are recorded', session.signinReturnTab === videoTab && typeof session.signinStartTab === 'number');
  const deck = { '明日': { word: '明日', reading: 'あした', meaning: 'tomorrow', due: 1795000000000, interval: 12, ease: 2.5, reps: 4 } };
  await sw.evaluate(vocab => chrome.storage.local.set({ vocab }), deck);
  // Complete through the real sync bridge, just like the signed-in web page.
  await until(async () => ctx.pages().some(p => p.url().includes('/start?from=content_chip')));
  const start = ctx.pages().find(p => p.url().includes('/start?from=content_chip'));
  assert.ok(start);
  await start.waitForLoadState('domcontentloaded');
  await start.evaluate(() => window.postMessage({ source: 'avc-web', type: 'avc-sync-token', token: 'test-token', profile: { name: 'Learner' } }, location.origin));
  await until(() => start.isClosed());
  await until(async () => (await events('signin_completed')).length === 1);
  await until(async () => (await requests()).some(r => r.method === 'PUT' && r.url.endsWith('/api/sync/snapshot')));
  const put = (await requests()).find(r => r.method === 'PUT' && r.url.endsWith('/api/sync/snapshot'));
  assert.deepEqual(JSON.parse(put.body).export.vocab, deck);
  check('legacy deck uploads with every schedule field intact', true);
  check('completion attributed to original chip', (await events('signin_completed'))[0].surface === 'content_chip');
  check('return video tab focused', await sw.evaluate(async id => (await chrome.tabs.get(id)).active, videoTab));
  check('return state cleared', !(await sw.evaluate(() => chrome.storage.session.get('signinReturnTab'))).signinReturnTab);
  await until(async () => await page.locator('[data-avc-signin-chip]').count() === 0);
  await page.waitForTimeout(2200);
  // A visible subtitle should now reach the real adapter and mount its UI.
  await page.evaluate(() => document.querySelector('.ytp-caption-segment').textContent = '明日、また会おう。');
  await until(async () => logs.some(s => s.includes('adapter chosen:')));
  check('sign-in starts adapter without reloading', true);
  await sw.evaluate(() => chrome.storage.local.set({ syncToken: 'test-token' }));
  await page.waitForTimeout(300);
  check('same token does not duplicate completion', (await events('signin_completed')).length === 1);
  // Sign-out runs the actual web bridge and clears the account cache.
  await sw.evaluate(id => chrome.storage.session.set({ listeningTabs: { [id]: true } }), videoTab);
  const web = await ctx.newPage();
  await web.goto('https://animevocab.com/app');
  await web.evaluate(() => window.postMessage({ source: 'avc-web', type: 'avc-sign-out' }, location.origin));
  await until(async () => !(await local()).syncToken && Object.keys((await local()).vocab || {}).length === 0);
  await page.locator('[data-avc-signin-chip] .chip').waitFor();
  check('sign-out clears cache and restores chip', Object.keys((await local()).vocab || {}).length === 0 && !(await local()).signinChipDismissed);
  const listenState = await sw.evaluate(() => chrome.storage.session.get('listeningTabs'));
  check('sign-out stops Listening', !listenState.listeningTabs?.[videoTab]);
  const before = (await featureRequests()).length;
  await page.evaluate(() => document.querySelector('.ytp-caption-segment').textContent = '約束を守ると言った。');
  await page.waitForTimeout(2200);
  check('no new feature calls after sign-out', (await featureRequests()).length === before);
  // A browser with a signed-in website session links without opening a tab.
  await sw.evaluate(() => { globalThis.allowMint = true; return chrome.storage.local.remove('autoLinkSuppressedUntil'); });
  const pagesBefore = ctx.pages().length;
  const silent = await popup.evaluate(tabId => chrome.runtime.sendMessage({ type: 'avc-open-signin', from: 'popup', tabId }), videoTab);
  check('existing website session silently links', silent.linked === true && silent.opened === false && ctx.pages().length === pagesBefore);
  console.log(`${checks}/${checks} checks passed`);
} finally { await ctx.close(); }
