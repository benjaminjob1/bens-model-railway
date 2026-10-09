const { chromium } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined), args: ['--no-sandbox'] });
  const results = [];
  const { mirrorTrackPath } = await import('../src/lib/trackGeometry.ts');
  const arc = 'M 45 200 A 355 165 0 0 1 755 200';
  assert.equal(mirrorTrackPath(arc), 'M 755 200 A 355 165 0 0 0 45 200');
  assert.equal(mirrorTrackPath(mirrorTrackPath(arc)), arc);
  results.push({ name: 'Mirrored track retains arc radii and reverses sweep', passed: true });
  async function check(name, run, setup) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
    page.setDefaultTimeout(10000);
    // Interaction regressions stay deterministic when third-party assets are slow.
    await page.route('**/*', route => {
      const request = route.request();
      if (!request.url().startsWith('http://localhost:3000') || request.resourceType() === 'image') return route.abort();
      return route.continue();
    });
    await page.addInitScript(() => {
      window.audioCalls = [];
      HTMLMediaElement.prototype.play = function () { window.audioCalls.push(this.src); return Promise.resolve(); };
      HTMLMediaElement.prototype.pause = function () {};
    });
    if (setup) await page.addInitScript(setup);
    try { await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' }); await run(page); results.push({ name, passed: true }); }
    catch (error) { results.push({ name, passed: false, error: error.message }); }
    await page.close();
  }
  await check('Mute closes consent and keeps audio silent', async page => {
    await page.getByRole('button', { name: /^🔇 Mute Sounds$/ }).click();
    await page.waitForTimeout(500);
    assert.equal(await page.getByRole('button', { name: /^🔊 Play Sounds$/ }).count(), 0);
    assert.deepEqual(await page.evaluate(() => window.audioCalls), []);
    await page.reload();
    await page.waitForTimeout(500);
    assert.equal(await page.getByRole('button', { name: /^🔊 Play Sounds$/ }).count(), 0);
  });
  await check('Dismissed disclaimer removes navigation gap', async page => {
    await page.getByRole('button', { name: /^🔊 Play Sounds$/ }).click();
    await page.getByRole('button', { name: 'Dismiss disclaimer' }).click();
    await page.waitForTimeout(800);
    assert.equal(await page.locator('nav').first().evaluate(el => Math.round(el.getBoundingClientRect().top)), 0);
  });
  await check('Muted preference applies to Real Railways', async page => {
    await page.waitForTimeout(500);
    await page.goto('http://localhost:3000/real-railways', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);
    await page.getByRole('link', { name: 'Hayle Area' }).click();
    assert.deepEqual(await page.evaluate(() => window.audioCalls), []);
  }, () => localStorage.setItem('railway-sound-muted', 'true'));
  await check('Site works when browser storage is blocked', async page => {
    await page.getByRole('button', { name: /^🔇 Mute Sounds$/ }).click({ timeout: 10000 });
    await page.waitForTimeout(500);
    assert.equal(await page.getByRole('button', { name: /^🔊 Play Sounds$/ }).count(), 0);
    await page.getByRole('button', { name: 'Dismiss disclaimer' }).click();
  }, () => { Storage.prototype.getItem = () => { throw new DOMException('Blocked', 'SecurityError'); }; Storage.prototype.setItem = () => { throw new DOMException('Blocked', 'SecurityError'); }; });
  await check('Keyboard gallery and mobile navigation work', async page => {
    await page.getByRole('button', { name: /^🔇 Mute Sounds$/ }).click();
    await page.getByRole('button', { name: 'Dismiss disclaimer' }).click();
    await page.getByRole('button', { name: 'Open navigation' }).click();
    assert.equal(await page.getByRole('button', { name: 'Close navigation' }).getAttribute('aria-expanded'), 'true');
    await page.locator('#mobile-navigation').getByRole('link', { name: '3D Renders' }).click();
    assert.equal(await page.getByRole('button', { name: 'Open navigation' }).getAttribute('aria-expanded'), 'false');
    const image = page.getByRole('button', { name: /^View / }).first();
    await image.focus(); await page.keyboard.press('Enter');
    await page.getByRole('dialog').waitFor();
    await page.keyboard.press('Escape');
    await page.getByRole('dialog').waitFor({ state: 'detached' });
    assert.equal(await image.evaluate(el => document.activeElement === el), true);
  });
  await check('Touch toggles each signal exactly once', async page => {
    await page.getByRole('button', { name: /^🔇 Mute Sounds$/ }).click();
    const signal = page.getByRole('button', { name: 'Toggle signal sig-1', exact: true });
    await signal.tap();
    assert.equal(await signal.getAttribute('aria-pressed'), 'true');
    await signal.tap();
    assert.equal(await signal.getAttribute('aria-pressed'), 'false');
    assert.deepEqual(await page.evaluate(() => window.audioCalls), []);
  });
  await check('Both pages render without hydration errors or horizontal overflow', async page => {
    const errors = [];
    page.on('console', message => { if (message.type() === 'error' && /hydrat|didn.t match/i.test(message.text())) errors.push(message.text()); });
    page.on('pageerror', error => errors.push(error.message));
    for (const path of ['/', '/real-railways']) {
      await page.goto('http://localhost:3000' + path, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(800);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    }
    assert.deepEqual(errors, []);
  }, () => localStorage.setItem('railway-sound-muted', 'true'));
  await check('3D model failures have a clear retry path', async page => {
    await page.getByRole('button', { name: /^🔇 Mute Sounds$/ }).click();
    await page.locator('model-viewer').evaluate(el => el.dispatchEvent(new Event('error')));
    await page.getByRole('button', { name: 'Retry 3D model' }).waitFor();
    await page.getByRole('button', { name: 'Retry 3D model' }).click();
    assert.equal(await page.getByRole('button', { name: 'Retry 3D model' }).count(), 0);
  });
  await browser.close();
  console.log(JSON.stringify(results, null, 2));
  if (results.some(result => !result.passed)) process.exitCode = 1;
})();
