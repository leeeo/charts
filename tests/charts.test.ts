import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { ChartSpecError, renderChart, validateSpec } from '../src/index.ts';
import { Chart } from '../src/react.ts';
import { tw } from '../src/format.ts';

const attr = (tag: string, name: string): string => new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1] ?? '';
const num = (tag: string, name: string): number => Number(attr(tag, name));
const tags = (html: string, re: RegExp): string[] => html.match(re) ?? [];
const marks = (html: string, cls: string): string[] => tags(html, new RegExp(`<(?:rect|circle|path) class="lc-mark ${cls}[^>]*>`, 'g'));

const labels = ['1월', '2월', '3월', '4월', '5월'];
const unit = { label: '원', suffix: '원' };

test('validateSpec rejects bad input at the boundary', () => {
  const ok = { type: 'line', title: 't', labels: ['a', 'b'], series: [{ id: 's', name: 'S', values: [1, null] }] };
  assert.doesNotThrow(() => validateSpec(ok));
  const bad = (patch: object): ChartSpecError => {
    try { validateSpec({ ...ok, ...patch }); } catch (e) { return e as ChartSpecError; }
    throw new Error('expected failure');
  };
  assert.equal(bad({ series: [{ id: 's', name: 'S', values: [1, Number.NaN] }] }).path, 'series[0].values[1]');
  assert.equal(bad({ series: [{ id: 's', name: 'S', values: [1, '2'] }] }).path, 'series[0].values[1]');
  assert.equal(bad({ series: [{ id: 's', name: 'S', values: [1] }] }).path, 'series[0].values');
  assert.equal(bad({ series: [{ id: 's', name: 'S', values: [1, 2], color: 'red;}</style>' }] }).path, 'series[0].color');
  assert.equal(bad({ extra: 1 }).path, 'spec.extra');
  assert.equal(bad({ series: [{ id: 's', name: 'S', values: [1, 2] }, { id: 's', name: 'T', values: [1, 2] }] }).path, 'series[1].id');
  assert.throws(() => validateSpec({ type: 'pie' }), ChartSpecError);
  assert.throws(() => validateSpec({ ...ok, type: 'bar', stacked: true, series: [{ id: 's', name: 'S', values: [-1, 2] }] }), ChartSpecError);
});

test('line chart: null breaks the path, is never plotted as zero, and higher values sit higher', () => {
  const html = renderChart({ type: 'line', title: '매출', unit, labels, series: [{ id: 'a', name: '실적', values: [10, 20, null, 40, 30] }] });
  const path = tags(html, /<path class="lc-line[^>]*>/g)[0] ?? '';
  assert.equal((attr(path, 'd').match(/M/g) ?? []).length, 2, 'two segments around the gap');
  const dots = marks(html, 'lc-dot');
  assert.deepEqual(dots.map((d) => num(d, 'data-i')), [0, 1, 3, 4]);
  assert.ok(!dots.some((d) => num(d, 'data-v') === 0));
  const cy = (i: number): number => num(dots.find((d) => num(d, 'data-i') === i) ?? '', 'cy');
  assert.ok(cy(3) < cy(4) && cy(4) < cy(1) && cy(1) < cy(0), 'y decreases as value increases');
  assert.match(html, /class="lc-na">데이터 없음/);
});

test('isolated point between gaps is drawn as a visible dot', () => {
  const html = renderChart({ type: 'line', title: 't', labels, series: [{ id: 'a', name: 'A', values: [null, 5, null, 7, 8] }] });
  const solo = marks(html, 'lc-dot').find((d) => num(d, 'data-i') === 1) ?? '';
  assert.match(solo, /lc-dot-vis/);
  assert.equal((attr(tags(html, /<path class="lc-line[^>]*>/g)[0] ?? '', 'd').match(/M/g) ?? []).length, 1);
});

test('all-missing data shows an empty state, not a flat zero line', () => {
  const html = renderChart({ type: 'line', title: 't', labels: ['a', 'b'], series: [{ id: 'a', name: 'A', values: [null, null] }] });
  assert.match(html, /class="lc-empty"/);
  assert.equal(marks(html, 'lc-dot').length, 0);
});

test('grouped bars: heights are proportional, gaps have no bar, zero is a real bar', () => {
  const html = renderChart({ type: 'bar', title: 't', labels: ['a', 'b', 'c'], unit, series: [{ id: 's', name: 'S', values: [10, 20, null] }, { id: 'z', name: 'Z', values: [0, 5, 5] }] });
  const bars = marks(html, 'lc-bar');
  const find = (s: number, i: number): string => bars.find((b) => num(b, 'data-s') === s && num(b, 'data-i') === i) ?? '';
  assert.equal(find(0, 2), '', 'missing value has no bar');
  assert.ok(find(1, 0) !== '', 'zero value keeps a (minimal) bar');
  assert.ok(Math.abs(num(find(0, 1), 'height') / num(find(0, 0), 'height') - 2) < 0.05);
  assert.ok(num(find(0, 0), 'x') < num(find(1, 0), 'x'), 'series sit side by side');
  assert.equal(num(find(0, 0), 'y') + num(find(0, 0), 'height'), num(find(0, 1), 'y') + num(find(0, 1), 'height'), 'shared baseline');
});

test('stacked bars touch end to end; horizontal bars grow rightwards from one origin', () => {
  const st = renderChart({ type: 'bar', stacked: true, title: 't', labels: ['a'], series: [{ id: 's', name: 'S', values: [10] }, { id: 'z', name: 'Z', values: [30] }] });
  const [b0, b1] = [marks(st, 'lc-bar')[0] ?? '', marks(st, 'lc-bar')[1] ?? ''];
  assert.ok(Math.abs(num(b1, 'y') + num(b1, 'height') - num(b0, 'y')) < 0.02);
  assert.ok(Math.abs(num(b1, 'height') / num(b0, 'height') - 3) < 0.05);
  const hz = renderChart({ type: 'bar', horizontal: true, title: 't', labels: ['긴 한글 항목 이름 하나', '둘'], series: [{ id: 's', name: 'S', values: [50, 100] }] });
  const [h0, h1] = [marks(hz, 'lc-bar')[0] ?? '', marks(hz, 'lc-bar')[1] ?? ''];
  assert.equal(num(h0, 'x'), num(h1, 'x'));
  assert.ok(Math.abs(num(h1, 'width') / num(h0, 'width') - 2) < 0.05);
});

test('accessible output: role=img with title/desc, data table, focusable labelled points', () => {
  const html = renderChart({ type: 'bar', title: '월별 방문', unit: { label: '명', suffix: '명' }, labels, series: [{ id: 'a', name: '방문', values: [1200, 900, null, 1500, 800], quality: '추정치' }] });
  const svg = /<svg[^>]*>/.exec(html)?.[0] ?? '';
  assert.equal(attr(svg, 'role'), 'img');
  for (const id of attr(svg, 'aria-labelledby').split(' ')) assert.ok(html.includes(`id="${id}"`), id);
  assert.match(html, /<title id="[^"]+">월별 방문<\/title>/);
  assert.match(html, /<desc id="[^"]+">[^<]*결측 1/);
  const pts = tags(html, /<g class="lc-pt[^>]*>/g);
  assert.equal(pts.length, 4);
  for (const p of pts) assert.equal(attr(p, 'tabindex'), '0');
  assert.match(attr(pts[0] ?? '', 'aria-label'), /^1월, 방문: 1,200명 · 추정치$/);
  assert.match(html, /<th scope="row">1월<\/th><td>1,200명<\/td>/);
  assert.match(html, /<details class="lc-data">/);
  assert.match(renderChart({ type: 'sparkline', title: 's', labels, series: [{ id: 'a', name: 'A', values: [1, 2, 3, 4, 5] }] }), /class="lc-sr"/);
});

test('output is deterministic and escapes user text', () => {
  const spec = { type: 'line', title: '<script>alert(1)</script>', labels: ['a&b', 'c'], series: [{ id: 'a', name: '"x"', values: [1, 2] }] };
  const a = renderChart(spec);
  assert.equal(a, renderChart(JSON.parse(JSON.stringify(spec))));
  assert.ok(!a.includes('<script>'));
  assert.ok(a.includes('a&amp;b'));
});

test('Korean text never leaves the viewBox', () => {
  const long = ['대한민국 서울특별시 강남구 매출액', '아주아주아주 긴 한글 범례 이름이 여기에 들어갑니다', '짧음'];
  for (const horizontal of [true, false]) {
    for (const width of [320, 390, 640]) {
      const html = renderChart({ type: 'bar', horizontal, title: 't', unit: { suffix: '원' }, labels: long, xLabel: '구분을 나타내는 아주 긴 가로축 제목입니다 정말로', series: [{ id: 'a', name: 'A', values: [123456789, 2, 3] }] }, { width });
      for (const m of html.matchAll(/<text class="lc-(?:tick|axis-title)"[^>]*>([^<]*)<\/text>/g)) {
        const tag = m[0];
        const w = tw(m[1] ?? '', 12);
        const x = num(tag, 'x');
        const lo = tag.includes('text-anchor="end"') ? x - w : tag.includes('text-anchor="middle"') ? x - w / 2 : x;
        assert.ok(lo >= -0.5 && lo + w <= width + 0.5, `${horizontal} ${width}: "${m[1]}" spans ${lo}..${lo + w}`);
      }
    }
  }
});

test('donut: null slice is omitted from the ring and listed as missing; angles follow values', () => {
  const html = renderChart({ type: 'donut', title: '구성', unit: { suffix: '%' }, slices: [{ id: 'a', label: 'A', value: 75 }, { id: 'b', label: 'B', value: null }, { id: 'c', label: 'C', value: 25 }] });
  assert.equal(marks(html, 'lc-slice').length, 2);
  assert.match(html, /<li>.*B.*데이터 없음/);
  assert.match(html, /A: 75%[^"]*\(75%\)/);
  const only = renderChart({ type: 'donut', title: 'x', slices: [{ id: 'a', label: 'A', value: 5 }] });
  assert.equal(marks(only, 'lc-slice').length, 1);
  assert.throws(() => renderChart({ type: 'donut', title: 'x', slices: [{ id: 'a', label: 'A', value: -1 }] }), ChartSpecError);
});

test('small multiples: shared y keeps panels comparable, unshared normalises each panel', () => {
  const mk = (sharedY: boolean) => renderChart({
    type: 'multiples', panelType: 'line', title: '앱별', labels: ['a', 'b', 'c'], sharedY, columns: 2,
    panels: [
      { id: 'big', title: '큰앱', series: [{ id: 's', name: 'S', values: [100, 50, 100] }] },
      { id: 'small', title: '작은앱', quality: '추정치', series: [{ id: 's', name: 'S', values: [10, 5, null] }] },
    ],
  });
  const cyFor = (html: string, panel: string, i: number): number => {
    const g = tags(html, /<g class="lc-pt[^>]*>.*?<\/g><\/g>|<g class="lc-pt[^>]*>.*?<\/g>/g).find((x) => attr(x, 'aria-label').includes(`(${panel})`) && x.includes(`data-i="${i}"`)) ?? '';
    return num(/<circle class="lc-mark[^>]*>/.exec(g)?.[0] ?? '', 'cy');
  };
  const shared = mk(true); const solo = mk(false);
  assert.ok(cyFor(shared, '작은앱', 0) > cyFor(shared, '큰앱', 1), 'small app peak is low on a shared axis');
  assert.equal(cyFor(solo, '작은앱', 0), cyFor(solo, '큰앱', 0), 'each panel uses its own full range');
  assert.equal(tags(shared, /<g class="lc-panel"/g).length, 2);
  assert.match(shared, /품질: 추정치/);
  assert.equal(tags(shared, /<table>/g).length, 2);
});

test('sparkline exposes first/last/min/max as focus targets', () => {
  const html = renderChart({ type: 'sparkline', title: '추이', labels, series: [{ id: 'a', name: 'A', values: [3, 1, 5, 2, 4] }] });
  assert.equal(tags(html, /<g class="lc-pt[^>]*>/g).length, 4);
});

test('React adapter renders the same markup as the core', () => {
  const spec = { type: 'bar', title: 't', labels: ['a'], series: [{ id: 'a', name: 'A', values: [1] }] };
  const out = renderToStaticMarkup(createElement(Chart, { spec, width: 400 }));
  assert.equal(out, `<div>${renderChart(spec, { width: 400 })}</div>`);
  assert.match(out, /role="img"/);
});

test('CSS honours reduced motion and both themes', () => {
  const css = readFileSync(new URL('../src/chart.css', import.meta.url), 'utf8');
  const motion = css.slice(css.indexOf('@media (prefers-reduced-motion: no-preference)'));
  assert.ok(css.includes('@media (prefers-reduced-motion: reduce)'));
  assert.ok(css.indexOf('animation:') > css.indexOf('prefers-reduced-motion: no-preference'), 'animations only inside the no-preference block');
  assert.ok(motion.includes('lc-draw'));
  assert.ok(css.includes('[data-theme="dark"]') && css.includes('prefers-color-scheme: dark'));
});
