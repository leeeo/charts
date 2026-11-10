// Serves the repo root and screenshots examples/index.html at 390/1440 px in light and dark.
// usage: node scripts/preview.mjs <outDir>
import { createServer } from 'node:http';
import { readFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs';
import { join, extname, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = process.argv[2];
if (!out) throw new Error('usage: node scripts/preview.mjs <outDir>');
mkdirSync(out, { recursive: true });
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css' };
const server = createServer((req, res) => {
  const p = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^([\\/]\.\.)+/, '');
  const f = join(root, p === '/' ? 'examples/index.html' : p);
  if (!f.startsWith(root) || !existsSync(f)) { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'content-type': types[extname(f)] ?? 'application/octet-stream' }).end(readFileSync(f));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
const base = join(process.env.LOCALAPPDATA ?? '', 'ms-playwright');
const dirs = readdirSync(base).filter((d) => /^chromium-\d+$/.test(d)).sort((a, b) => Number(b.slice(9)) - Number(a.slice(9)));
const exe = dirs.map((d) => join(base, d, 'chrome-win64', 'chrome.exe')).find(existsSync) ?? dirs.map((d) => join(base, d, 'chrome-win', 'chrome.exe')).find(existsSync);
const browser = await chromium.launch({ executablePath: exe, headless: true });
for (const width of [390, 1440]) for (const theme of ['light', 'dark']) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('http://127.0.0.1:' + port + '/examples/index.html?theme=' + theme);
  await page.waitForSelector('html[data-ready="1"]');
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: theme });
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  const file = join(out, 'examples-' + width + '-' + theme + '.png');
  await page.screenshot({ path: file, fullPage: true });
  console.log(file, 'overflowX=' + over, errors.length ? 'errors=' + errors.join('|') : 'no-errors');
  await ctx.close();
}
await browser.close();
server.close();
