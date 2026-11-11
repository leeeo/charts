// Value / end labels, category wrapping and the CSS-only hover highlight added in 0.8.0 (core types and pie).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ChartSpecError, renderChart, validateSpec } from '../src/index.ts';
import { spread } from '../src/kit.ts';
import { splitCat } from '../src/cartesian.ts';
import { tw } from '../src/format.ts';

const attr = (tag: string, name: string): string => new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1] ?? '';
const num = (tag: string, name: string): number => Number(attr(tag, name));
const tags = (html: string, re: RegExp): string[] => html.match(re) ?? [];
const ends = (html: string): string[] => tags(html, /<text class="lc-end[^>]*>.*?<\/text>/g);
const vals = (html: string): string[] => tags(html, /<text class="lc-val[^>]*>[^<]*<\/text>/g);
const days = ['11/03', '11/04', '11/05', '11/06', '11/07'];

test('line/area: every series ends with its name and bold last value inside the viewBox; valueLabels none removes them', () => {
  const spec = { type: 'line', title: 't', unit: { suffix: '명' }, labels: days, series: [
    { id: 'web', name: '웹', values: [320, 340, 310, null, 420] }, { id: 'app', name: '앱', values: [120, 135, 150, 148, null] }] };
  const html = renderChart(spec, { width: 390 });
  const e = ends(html);
  assert.equal(e.length, 2);
  assert.match(e[0] ?? '', /data-s="0"[^>]*><tspan class="lc-lbl">웹<\/tspan><tspan class="lc-lbl-v"[^>]*>420명<\/tspan>/);
  assert.match(e[1] ?? '', /<tspan class="lc-lbl">앱<\/tspan><tspan class="lc-lbl-v"[^>]*>148명<\/tspan>/, 'last present value, not the trailing null');
  for (const t of e) assert.ok(num(t, 'x') + tw('420명', 11) <= 390, 'label fits the viewBox');
  assert.ok(html.indexOf('<g class="lc-lbls"') < html.indexOf('<g class="lc-pt'), 'labels sit below the focusable points so value boxes stay on top');
  assert.ok(!renderChart({ ...spec, valueLabels: 'none' }).includes('lc-lbls'));
  assert.ok(!renderChart({ ...spec, valueLabels: 'none' }).includes('lc-end'));
  const area = renderChart({ ...spec, type: 'area', stacked: true, series: spec.series.map((s) => ({ ...s, values: s.values.map((v) => (v === null ? 0 : v)) })) });
  assert.equal(ends(area).length, 2);
});

test('end labels never overlap: close series are pushed apart and get a leader line', () => {
  const html = renderChart({ type: 'line', title: 't', labels: ['a', 'b'], series: [
    { id: 'x', name: 'X', values: [1, 10] }, { id: 'y', name: 'Y', values: [2, 10.2] }, { id: 'z', name: 'Z', values: [3, 9.8] }] }, { width: 400 });
  const ys = ends(html).map((t) => num(t, 'y')).sort((a, b) => a - b);
  for (let i = 1; i < ys.length; i++) assert.ok((ys[i] as number) - (ys[i - 1] as number) >= 26, `labels ${ys[i - 1]} and ${ys[i]} keep two lines apart`);
  assert.ok(tags(html, /<path class="lc-lead"/g).length >= 2);
});

test('spread keeps order, separates neighbours and stays inside the bounds', () => {
  const out = spread([{ y: 50, h: 20 }, { y: 52, h: 20 }, { y: 10, h: 20 }, { y: 195, h: 20 }], 0, 200);
  assert.deepEqual(out.map((v) => Math.round(v)), [50, 70, 10, 190], 'the later neighbour moves, the earlier keeps its place');
  const sorted = [...out].sort((a, b) => a - b);
  for (let i = 1; i < sorted.length; i++) assert.ok((sorted[i] as number) - (sorted[i - 1] as number) >= 20 - 1e-9);
  assert.deepEqual(spread([], 0, 10), []);
});

test('bars: values at the bar end (vertical only when they fit), inside stacked segments plus the total, raw share for percent bars', () => {
  const hz = renderChart({ type: 'bar', horizontal: true, title: 't', unit: { suffix: '초' }, labels: ['a', 'b'], series: [{ id: 's', name: 'S', values: [182, 24] }] });
  assert.deepEqual(vals(hz).map((t) => />([^<]*)</.exec(t)?.[1]), ['182초', '24초']);
  const bar = tags(hz, /<rect class="lc-mark lc-bar[^>]*>/g)[0] ?? '';
  assert.ok(num(vals(hz)[0] ?? '', 'x') >= num(bar, 'x') + num(bar, 'width'), 'label starts after the bar end');
  const wide = renderChart({ type: 'bar', title: 't', labels: ['a', 'b'], series: [{ id: 's', name: 'S', values: [4, 2] }] }, { width: 640 });
  assert.equal(vals(wide).length, 2);
  const crowded = renderChart({ type: 'bar', title: 't', unit: { suffix: '건' }, labels: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'], series: [{ id: 's', name: 'S', values: [1200, 2, 3, 4, 5, 6, 7, 8] }, { id: 'z', name: 'Z', values: [1, 2, 3, 4, 5, 6, 7, 8] }] }, { width: 320 });
  assert.equal(vals(crowded).length, 0, 'labels that would overlap their neighbours are left to the value box');
  const st = renderChart({ type: 'bar', stacked: true, title: 't', unit: { suffix: '%' }, labels: ['월'], series: [{ id: 'o', name: 'O', values: [40] }, { id: 's', name: 'S', values: [25] }] });
  assert.match(st, /<g class="lc-pt lc-pt-bar"[^>]*><rect[^>]*data-s="0"[^>]*\/><g class="lc-lbls" aria-hidden="true"><text class="lc-val lc-val-in" data-s="0"[^>]*>40%<\/text>/, 'segment label travels with its bar');
  assert.match(st, /<text class="lc-val lc-val-sum"[^>]*>65%<\/text>/);
  const pc = renderChart({ type: 'bar', stacked: true, percent: true, horizontal: true, title: 't', unit: { suffix: '건' }, labels: ['a'], series: [{ id: 'm', name: 'M', values: [620] }, { id: 'd', name: 'D', values: [380] }] });
  assert.match(pc, /lc-val-in" data-s="0"[^>]*>62%</);
  assert.ok(!pc.includes('lc-val-sum'), 'percent stacks have no total');
  const dv = renderChart({ type: 'bar', stacked: true, horizontal: true, title: 't', labels: ['a'], series: [{ id: 'n', name: 'N', values: [-30] }, { id: 'p', name: 'P', values: [55] }] });
  assert.ok(!dv.includes('lc-val-sum'), 'diverging stacks have no total');
  assert.match(dv, /lc-val-in" data-s="0"[^>]*>-30</);
  assert.ok(!renderChart({ type: 'bar', title: 't', labels: ['a'], series: [{ id: 's', name: 'S', values: [1] }], valueLabels: 'none' }).includes('lc-val'));
});

test('category labels wrap instead of truncating: at spaces, or a Korean word split evenly; never a one-letter tail', () => {
  assert.deepEqual(splitCat('상상플레이', tw('상상플', 12) + 1, 12, 2), ['상상플', '레이']);
  assert.deepEqual(splitCat('설정 및 개인정보 처리방침 안내', 100, 12, 2), ['설정 및 개인정보', '처리방침 안내']);
  assert.deepEqual(splitCat('11/03', 24, 12, 2), ['11…'], 'ascii codes are truncated, never split');
  assert.deepEqual(splitCat('짧음', 100, 12, 2), ['짧음']);
  const v = renderChart({ type: 'bar', title: 't', labels: ['상상플레이', '레슨', '스톡위키', '어닝스'], series: [{ id: 'a', name: 'A', values: [1, 2, 3, 4] }, { id: 'b', name: 'B', values: [1, 2, 3, 4] }] }, { width: 260 });
  const first = /<text class="lc-tick"[^>]*text-anchor="middle">(.*?)<\/text>/.exec(v)?.[1] ?? '';
  assert.match(first, /<tspan[^>]*>상상플<\/tspan><tspan[^>]*dy="13">레이<\/tspan>/);
  assert.ok(!v.includes('…'), 'no truncation needed once labels wrap');
  const h = renderChart({ type: 'bar', horizontal: true, title: 't', labels: ['설정 및 개인정보 처리방침 안내', '튜토리얼'], series: [{ id: 'a', name: 'A', values: [1, 2] }] }, { width: 300 });
  assert.match(h, /<tspan[^>]*>설정 및 개인정보<\/tspan><tspan[^>]*dy="13">처리방침 안내<\/tspan>/);
  assert.equal(num(/<svg[^>]*>/.exec(h)?.[0] ?? '', 'height'), 160, 'rows grow to fit two lines (2 x 36 + 50, floored at 160)');
  const h3 = renderChart({ type: 'bar', horizontal: true, title: 't', labels: ['설정 및 개인정보 처리방침 안내', '둘', '셋', '넷'], series: [{ id: 'a', name: 'A', values: [1, 2, 3, 4] }] }, { width: 300 });
  assert.equal(num(/<svg[^>]*>/.exec(h3)?.[0] ?? '', 'height'), 4 * 36 + 50);
});

test('donut/pie: labels beside the slices when wide, share inside when narrow; centre swap per slice; shares use one decimal; no inline styles', () => {
  const spec = { type: 'donut', title: 't', unit: { suffix: '건' }, centerLabel: '합계', slices: [
    { id: 'a', label: '안드로이드', value: 640 }, { id: 'i', label: 'iOS', value: 280 }, { id: 'w', label: '웹', value: 90 }, { id: 'x', label: '기타', value: null }] };
  const wide = renderChart(spec, { width: 640 });
  assert.match(wide, /class="lc lc-t-donut lc-ring-out"/);
  assert.equal(ends(wide).length, 3);
  assert.match(ends(wide)[0] ?? '', /data-i="0"[^>]*><tspan class="lc-lbl">안드로이드<\/tspan><tspan class="lc-lbl-v"[^>]*>640건 · 63.4%<\/tspan>/);
  assert.equal(tags(wide, /<path class="lc-lead"/g).length, 3);
  assert.equal(tags(wide, /<g class="lc-center-alt" data-i="\d+"/g).length, 3, 'one hidden centre per drawn slice');
  assert.match(wide, /<g class="lc-center-main"><text class="lc-center"[^>]*font-size="[\d.]+">1,010건<\/text>/);
  assert.ok(!wide.includes(' style='), 'no inline style attributes (CSP)');
  for (const t of ends(wide)) { const x = num(t, 'x'); assert.ok(x >= 0 && x <= 640, `label x ${x} inside`); }
  const narrow = renderChart(spec, { width: 280 });
  assert.ok(!narrow.includes('lc-ring-out') && !narrow.includes('lc-lead'));
  assert.match(narrow, /<g class="lc-pt lc-pt-slice"[^>]*><path[^>]*data-i="0"[^>]*\/><g class="lc-lbls" aria-hidden="true"><text class="lc-val lc-val-in" data-i="0"[^>]*>63.4%<\/text>/);
  assert.match(narrow, /<li>.*안드로이드.*640건 · 63.4%/);
  assert.match(narrow, /<td>63.4%<\/td>/);
  assert.ok(!renderChart({ ...spec, valueLabels: 'none' }, { width: 640 }).includes('lc-lbls'));
  const pie = renderChart({ type: 'pie', title: 't', slices: [{ id: 'a', label: 'A', value: 3 }, { id: 'b', label: 'B', value: 1 }], valueLabels: 'auto' }, { width: 640 });
  assert.equal(ends(pie).length, 2);
  assert.ok(!pie.includes('lc-center'), 'pie has no centre');
  assert.equal(num(/<svg[^>]*>/.exec(renderChart(spec, { width: 640 }))?.[0] ?? '', 'width'), 640);
});

test('sparkline and multiples: the last value sits right of the line; an empty panel gets a dashed frame', () => {
  const spark = { type: 'sparkline', title: 's', unit: { suffix: '명' }, labels: days, series: [{ id: 'v', name: 'V', values: [1, 3, 2, null, 5] }] };
  const s = renderChart(spark);
  assert.match(ends(s)[0] ?? '', /<tspan class="lc-lbl-v">5명<\/tspan>/);
  assert.ok(!ends(s)[0]?.includes('lc-lbl"'), 'value only, no series name');
  assert.equal(ends(renderChart(spark, { width: 100 })).length, 0, 'too narrow for a label');
  const m = renderChart({ type: 'multiples', panelType: 'line', title: 'm', labels: ['a', 'b'], panels: [
    { id: 'p1', title: 'P1', series: [{ id: 'u', name: 'U', values: [1, 2] }] },
    { id: 'p2', title: 'P2', series: [{ id: 'u', name: 'U', values: [null, null] }] },
    { id: 'p3', title: 'P3', series: [{ id: 'u', name: 'U', values: [1, 2] }, { id: 'w', name: 'W', values: [2, 4] }] }] });
  assert.equal(ends(m).length, 3);
  assert.ok(!ends(m)[0]?.includes('lc-lbl"') && ends(m)[1]?.includes('<tspan class="lc-lbl">U</tspan>'), 'single-series panels show the value, several series name it');
  assert.equal(tags(m, /<rect class="lc-panel-empty"/g).length, 1);
});

test('valueLabels is validated; the value box bolds the value; hover rules exist for every series and slice index', () => {
  const ok = { type: 'line', title: 't', labels: ['a', 'b'], series: [{ id: 's', name: 'S', values: [1, 2] }] };
  assert.throws(() => validateSpec({ ...ok, valueLabels: 'all' }), (e: unknown) => e instanceof ChartSpecError && e.path === 'valueLabels');
  assert.throws(() => validateSpec({ type: 'pie', title: 't', slices: [{ id: 'a', label: 'A', value: 1 }], valueLabels: 1 }), (e: unknown) => e instanceof ChartSpecError && e.path === 'valueLabels');
  assert.equal((validateSpec({ ...ok, valueLabels: 'none' }) as { valueLabels?: string }).valueLabels, 'none');
  assert.match(renderChart(ok), /<g class="lc-tip" aria-hidden="true"><rect[^>]*\/><text[^>]*>a, S: <tspan class="lc-tip-v">1<\/tspan><\/text>/);
  const css = readFileSync(new URL('../src/chart.css', import.meta.url), 'utf8');
  for (let k = 0; k < 12; k++) {
    assert.ok(css.includes(`.lc-pt:hover > [data-s="${k}"], .lc-pt:focus > [data-s="${k}"]`), `series ${k} keeps full opacity on hover and focus`);
    assert.ok(css.includes(`.lc-center-alt[data-i="${k}"] { display: block; }`), `slice ${k} swaps the ring centre`);
  }
  assert.ok(css.includes('.lc-svg:has(.lc-pt:hover, .lc-pt:focus) .lc-lbls > * { opacity: 0.3; }'), 'labels step back while a value box is open');
  assert.ok(!css.includes('\r'), 'stylesheet is LF only');
});
