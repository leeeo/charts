import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { renderChart } from '../src/index.ts';
import { examples } from './specs.ts';

const css = '../dist/chart.css';
const sections = examples.map((e) => `<section class="card" id="${e.id}"><h2>${e.heading}</h2>${e.note ? `<p class="hint">${e.note}</p>` : ''}<div class="host" data-spec="${e.id}">${renderChart(e.spec)}</div></section>`).join('\n');
const html = `<!doctype html>
<html lang="ko" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>@leeeo/charts examples</title>
<link rel="icon" href="data:,">
<link rel="stylesheet" href="${css}">
<style>
  :root { --bg:#f5f6f3; --surface:#fff; --ink:#1c2a24; --muted:#5b6862; --line:#dde3df; --accent:#24664d; }
  [data-theme="dark"] { --bg:#151e1b; --surface:#1d2924; --ink:#e8efe9; --muted:#a8b7ae; --line:#34433b; --accent:#acd2b3; color-scheme: dark; }
  body { margin:0; background:var(--bg); color:var(--ink); font:15px/1.6 system-ui,"Pretendard","Noto Sans KR","Malgun Gothic",sans-serif; }
  main { max-width:1100px; margin:0 auto; padding:16px; }
  header { display:flex; flex-wrap:wrap; gap:8px 16px; align-items:center; justify-content:space-between; }
  h1 { font-size:1.25rem; margin:8px 0; } h2 { font-size:1rem; margin:0 0 4px; }
  button { font:inherit; min-height:44px; padding:0 16px; border-radius:8px; border:1px solid var(--line); background:var(--surface); color:var(--ink); cursor:pointer; }
  button:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
  .grid { align-items:start; display:grid; gap:14px; grid-template-columns:repeat(auto-fit,minmax(min(100%,460px),1fr)); }
  .card { background:var(--surface); border:1px solid var(--line); border-radius:12px; padding:14px; min-width:0; }
  #sparkline .host { width:180px; }
  .card#multiples { grid-column:1 / -1; }
  .hint { margin:0 0 8px; color:var(--muted); font-size:.8125rem; }
</style>
</head>
<body>
<main>
<header><h1>@leeeo/charts 0.1.0 — examples</h1><button id="theme" type="button">테마 전환</button></header>
<div class="grid">
${sections}
</div>
</main>
<script type="module">
import { mountChart } from '../dist/dom.js';
import { examples } from './specs.json.js';
const q = new URLSearchParams(location.search).get('theme');
if (q === 'dark' || q === 'light') document.documentElement.dataset.theme = q;
document.getElementById('theme').addEventListener('click', () => {
  const r = document.documentElement; r.dataset.theme = r.dataset.theme === 'dark' ? 'light' : 'dark';
});
for (const e of examples) {
  const host = document.querySelector('[data-spec="' + e.id + '"]');
  if (host) mountChart(host, e.spec);
}
document.documentElement.dataset.ready = '1';
</script>
</body>
</html>
`;
writeFileSync(fileURLToPath(new URL('./index.html', import.meta.url)), html);
writeFileSync(fileURLToPath(new URL('./specs.json.js', import.meta.url)), 'export const examples = ' + JSON.stringify(examples.map(({ id, spec }) => ({ id, spec })), null, 1) + ';\n');
console.log('examples written:', examples.length);
