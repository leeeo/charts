// Serves site/dist and captures it with Chromium: full pages at 390 (mobile emulation) and 1440, light and dark,
// plus focus / playground-error states, and one light-theme image per gallery chart into docs/images/ for the README.
// usage: node site/shots.mjs <outDir>      (build first: node site/build.mjs)
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const site = dirname(fileURLToPath(import.meta.url));
const dist = join(site, 'dist');
const images = join(site, '..', 'docs', 'images');
const out = process.argv[2];
if (!out) throw new Error('usage: node site/shots.mjs <outDir>');
if (!existsSync(join(dist, 'index.html'))) throw new Error('run node site/build.mjs first');
mkdirSync(out, { recursive: true });
mkdirSync(images, { recursive: true });

const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.txt': 'text/plain' };
const server = createServer((req, res) => {
  const p = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^([\\/]\.\.)+/, '');
  const f = join(dist, p.endsWith('/') || p.endsWith('\\') ? join(p, 'index.html') : p);
  if (!f.startsWith(dist) || !existsSync(f)) { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'content-type': types[extname(f)] ?? 'application/octet-stream' }).end(readFileSync(f));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const url = 'http://127.0.0.1:' + server.address().port + '/';

const base = join(process.env.LOCALAPPDATA ?? '', 'ms-playwright');
const dirs = readdirSync(base).filter((d) => /^chromium-\d+$/.test(d)).sort((a, b) => Number(b.slice(9)) - Number(a.slice(9)));
const exe = dirs.flatMap((d) => [join(base, d, 'chrome-win64', 'chrome.exe'), join(base, d, 'chrome-win', 'chrome.exe')]).find(existsSync);
const browser = await chromium.launch({ executablePath: exe, headless: true });

async function open(width, theme) {
  const mobile = width < 600;
  const ctx = await browser.newContext({
    viewport: { width, height: mobile ? 844 : 900 }, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile,
    colorScheme: theme, reducedMotion: 'reduce',
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(() => {
    window.__cls = 0;
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
  });
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForSelector('html[data-ready="1"]');
  await page.evaluate(() => document.fonts.ready);
  return { ctx, page, errors };
}

for (const width of [390, 1440]) for (const theme of ['light', 'dark']) {
  const { ctx, page, errors } = await open(width, theme);
  const info = await page.evaluate(() => ({
    theme: document.documentElement.dataset.theme,
    overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    cls: Math.round(window.__cls * 10000) / 10000,
    wide: [...document.querySelectorAll('main *')].filter((el) => el.getBoundingClientRect().right > document.documentElement.clientWidth + 1 && !el.closest('pre, .lc-scroll, textarea')).map((el) => el.tagName + '.' + el.className).slice(0, 5),
  }));
  const file = join(out, `site-${width}-${theme}.png`);
  await page.screenshot({ path: file, fullPage: true });
  await page.screenshot({ path: join(out, `site-${width}-${theme}-top.png`) });
  console.log(file, JSON.stringify(info), errors.length ? 'errors=' + errors.join('|') : 'no-errors');
  if (width === 1440) {
    // Keyboard: Tab from the gallery heading into the first focusable chart point; the tooltip and ring must show.
    // Gallery charts are drawn lazily near the viewport: bring the card in first.
    await page.locator('#g-bar-grouped').scrollIntoViewIfNeeded();
    await page.locator('#g-bar-grouped .pane[data-pane="' + theme + '"] .lc-pt').first().focus();
    await page.keyboard.press('Tab');
    await page.locator('#g-bar-grouped').screenshot({ path: join(out, `site-${width}-${theme}-focus.png`) });
    // Playground: a wrong value type shows an inline error and keeps the last chart.
    await page.fill('#play-input', '{"type":"line","title":"오류 예시","labels":["1월","2월"],"series":[{"id":"a","name":"방문","values":[1,"둘"]}]}');
    await page.click('#play-render');
    await page.locator('#play').screenshot({ path: join(out, `site-${width}-${theme}-play-error.png`) });
    console.log('play status:', await page.textContent('#play-status'));
  }
  await ctx.close();
}

// README images: the light pane of every gallery card.
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, colorScheme: 'light', reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForSelector('html[data-ready="1"]');
  for (const id of await page.$$eval('.card', (cards) => cards.map((c) => c.id.slice(2)))) {
    const host = page.locator(`#g-${id} .pane[data-pane="light"] .host`);
    await host.scrollIntoViewIfNeeded();
    await page.waitForSelector(`#g-${id} .pane[data-pane="light"] .host.is-drawn svg`); // gallery charts are drawn lazily
    await host.screenshot({ path: join(images, `${id}.png`) });
  }
  await page.waitForSelector('#g-line .pane[data-pane="dark"] .host.is-drawn svg');
  await page.locator('#g-line .pane[data-pane="dark"] .host').screenshot({ path: join(images, 'line-dark.png') });
  console.log('readme images ->', images);
  await ctx.close();
}
await browser.close();
server.close();
