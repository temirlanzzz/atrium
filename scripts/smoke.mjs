// Real-time smoke test: intro, scroll, hover, open a window, try on, add to bag, go back.
// Usage: node scripts/smoke.mjs [url]   (needs `npm run preview`)
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const url = process.argv[2] || 'http://127.0.0.1:4173/';
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errors = [];
for (const [name, vp, mobile] of [['desktop', { width: 1280, height: 800 }, false], ['mobile', { width: 390, height: 844 }, true]]) {
  const page = await browser.newPage({ viewport: vp, isMobile: mobile, hasTouch: mobile });
  page.on('pageerror', e => errors.push(`${name}: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') errors.push(`${name} console: ${m.text()}`); });
  await page.goto(url, { timeout: 180000 });
  await page.waitForSelector('body.ready', { timeout: 180000 });
  await page.waitForTimeout(6000);
  if (!mobile) { await page.mouse.move(640, 300); await page.mouse.wheel(0, 900); await page.waitForTimeout(2500); }
  // find a hoverable window
  let found = false;
  for (let y = 200; y <= 600 && !found; y += 60) for (let x = 200; x <= vp.width - 100 && !found; x += 80) {
    if (mobile) { await page.evaluate(([x, y]) => window.dispatchEvent(new PointerEvent('pointermove', { clientX: x, clientY: y, pointerType: 'mouse' })), [x, y]); }
    else await page.mouse.move(x, y);
    await page.waitForTimeout(250);
    if (await page.locator('#tag.on').count()) { found = [x, y]; }
  }
  console.log(name, 'hover found at', found, await page.locator('#tag b').textContent().catch(() => ''));
  if (!found) { errors.push(`${name}: no window could be hovered`); continue; }
  if (mobile) await page.touchscreen.tap(found[0], found[1]); else await page.mouse.click(found[0], found[1]);
  await page.waitForSelector('body.in-studio', { timeout: 30000 });
  await page.waitForTimeout(2500);
  await page.click('#p-size button:nth-child(4)');
  await page.click('#p-sw .sw:last-child');
  await page.click('#p-add');
  await page.waitForTimeout(1200);
  const n = await page.textContent('#bag-n');
  console.log(name, 'bag', n, 'fit', await page.textContent('#p-fit'), 'try label', await page.textContent('#p-try'));
  if (n !== '1') errors.push(`${name}: bag count ${n}`);
  await page.screenshot({ path: `out/smoke-${name}-studio.png` });
  await page.click('#p-close');
  await page.waitForFunction(() => !document.body.classList.contains('in-studio'), null, { timeout: 15000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `out/smoke-${name}-back.png` });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  if (overflow) errors.push(`${name}: horizontal overflow`);
  await page.close();
}
await browser.close();
console.log(errors.length ? 'FAIL\n' + errors.join('\n') : 'PASS: intro, scroll, hover, studio, size, colour, bag, back on desktop and mobile');
process.exit(errors.length ? 1 : 0);
