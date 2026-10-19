// Real-time smoke test: intro, scroll, hover, open a window, try on, add to bag, go back.
// Usage: node scripts/smoke.mjs [url]   (needs `npm run preview`)
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const url = process.argv[2] || 'http://127.0.0.1:4173/';
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errors = [];
for (const [name, vp, mobile] of [['desktop', { width: 960, height: 600 }, false], ['mobile', { width: 390, height: 844 }, true]]) {
  const page = await browser.newPage({ viewport: vp, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
  page.setDefaultTimeout(240000);
  page.on('pageerror', e => errors.push(`${name}: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') errors.push(`${name} console: ${m.text()}`); });
  await page.goto(url, { timeout: 180000 });
  await page.waitForSelector('body.ready', { timeout: 180000 });
  // a software GPU renders a few frames per second: wait for the intro by state, not time
  await page.waitForFunction(() => !document.getElementById('title').classList.contains('show'), null, { timeout: 600000 });
  if (!mobile) { await page.mouse.move(vp.width / 2, vp.height / 2); await page.mouse.wheel(0, 900); await page.waitForTimeout(4000); }
  // find a hoverable window
  let found = false;
  for (let y = 160; y <= vp.height - 160 && !found; y += 90) for (let x = 120; x <= vp.width - 120 && !found; x += 110) {
    if (mobile) { await page.evaluate(([x, y]) => window.dispatchEvent(new PointerEvent('pointermove', { clientX: x, clientY: y, pointerType: 'mouse' })), [x, y]); }
    else await page.mouse.move(x, y);
    try { await page.waitForSelector('#tag.on', { timeout: 6000 }); found = [x, y]; } catch {}
  }
  console.log(name, 'hover found at', found, await page.locator('#tag b').textContent().catch(() => ''));
  if (!found) { errors.push(`${name}: no window could be hovered`); continue; }
  if (mobile) await page.touchscreen.tap(found[0], found[1]); else await page.mouse.click(found[0], found[1]);
  await page.waitForSelector('body.in-studio', { timeout: 300000 });
  await page.waitForTimeout(4000);
  if (await page.locator('#size-row').isVisible()) await page.click('#p-size button:nth-child(4)');
  await page.click('#p-sw button:last-child');
  await page.click('#p-add');
  await page.waitForTimeout(1200);
  const n = await page.textContent('#bag-n');
  console.log(name, 'bag', n, 'product', await page.textContent('#p-name'), 'colour', await page.textContent('#p-sw button.on').catch(() => 'swatch'));
  if (n !== '1') errors.push(`${name}: bag count ${n}`);
  await page.screenshot({ path: `out/smoke-${name}-studio.png` });
  await page.click('#p-close');
  await page.waitForFunction(() => !document.body.classList.contains('in-studio'), null, { timeout: 300000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `out/smoke-${name}-back.png` });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  if (overflow) errors.push(`${name}: horizontal overflow`);
  await page.close();
}
await browser.close();
console.log(errors.length ? 'FAIL\n' + errors.join('\n') : 'PASS: intro, scroll, hover, studio, size, colour, bag, back on desktop and mobile');
process.exit(errors.length ? 1 : 0);
