// Deterministic capture: drives the app frame by frame through ?capture and
// screenshots each frame, so the reel is smooth even on a software GPU.
// Usage: node scripts/capture.mjs [--stills 2,5,9] [--video] [--url http://127.0.0.1:4173/]
// Needs a running `npm run preview`, Playwright and ffmpeg.
import { createRequire } from 'node:module';
import { mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const url = arg('--url', 'http://127.0.0.1:4173/') + '?capture' + (arg('--shot') ? '&shot=' + arg('--shot') : '');
const stills = arg('--stills', '') ? arg('--stills').split(',').map(Number) : [];
const video = process.argv.includes('--video');
const W = +arg('--w', 1280), H = +arg('--h', 800), FPS = 30, DUR = +arg('--dur', 14);

mkdirSync('out', { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
page.on('console', m => { if (m.type() === 'error') console.log('console:', m.text()); });
page.on('pageerror', e => { console.log('pageerror:', e.message); process.exit(1); });
await page.goto(url);
await page.waitForFunction(() => window.__step, null, { timeout: 120000 });
// let the loader fade finish
await page.evaluate(() => document.getElementById('loader').remove());

let t = 0, frame = 0;
const dt = 1 / FPS;
if (video) { rmSync('out/frames', { recursive: true, force: true }); mkdirSync('out/frames', { recursive: true }); }
const end = video ? DUR : Math.max(...stills, 0) + dt;
const pending = [...stills].sort((a, b) => a - b);
while (t < end) {
  // Stills only render the frames they need; video renders every frame and
  // waits a frame after each step so the software GPU never builds a backlog.
  const needed = video || (pending.length && t + dt >= pending[0] - dt * 2);
  if (needed) await page.evaluate((d) => { window.__step(d); return new Promise(r => requestAnimationFrame(() => r())); }, dt);
  else await page.evaluate((d) => window.__advance(d), dt);
  t += dt;
  if (video) await page.screenshot({ path: `out/frames/${String(frame++).padStart(4, '0')}.jpg`, quality: 92, type: 'jpeg', timeout: 180000 });
  while (pending.length && t >= pending[0]) {
    const s = pending.shift();
    await page.screenshot({ path: `out/still-${s}.png`, timeout: 180000 });
    console.log('still', s);
  }
}
await browser.close();
if (video) {
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', 'out/frames/%04d.jpg', '-c:v', 'libx264', '-preset', 'slow', '-crf', '27',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', 'out/atrium-demo.mp4'], { stdio: 'inherit' });
  console.log('wrote out/atrium-demo.mp4');
}
