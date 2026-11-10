import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ChartSpecError, renderChart, validateSpec } from '../src/index.ts';

const attr = (tag: string, name: string): number => Number(new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1] ?? 'NaN');
const bars = (html: string): string[] => html.match(/<rect class="lc-mark lc-pareto-bar[^>]*>/g) ?? [];
const dots = (html: string): string[] => html.match(/<circle class="lc-mark lc-pareto-dot[^>]*>/g) ?? [];
const pathOf = (spec: object): string => {
  try { validateSpec(spec); } catch (e) { assert.ok(e instanceof ChartSpecError); return e.path; }
  throw new Error('expected failure');
};

const base = { type: 'pareto', title: '문의 유형', unit: { suffix: '건' } };
const items = [
  { id: 'a', label: '결제', value: 20 },
  { id: 'b', label: '로그인', value: 50 },
  { id: 'c', label: '기타', value: 10 },
  { id: 'd', label: '광고', value: 20 },
];

test('pareto: bars are sorted descending and the cumulative line reaches 100%', () => {
  const html = renderChart({ ...base, items });
  const bs = bars(html);
  assert.deepEqual(bs.map((b) => attr(b, 'data-i')), [1, 0, 3, 2], 'descending, ties keep input order');
  const xs = bs.map((b) => attr(b, 'x'));
  assert.ok(xs.every((x, k) => k === 0 || x > (xs[k - 1] ?? 0)));
  const h = bs.map((b) => attr(b, 'height'));
  assert.ok(Math.abs((h[0] ?? 0) / (h[3] ?? 1) - 5) < 0.01, '50 vs 10');
  const ds = dots(html);
  assert.deepEqual(ds.map((d) => attr(d, 'data-v')), [50, 70, 90, 100]);
  const cy = ds.map((d) => attr(d, 'cy'));
  // cumulative axis is linear: 70% is 20 points above 50%, 90% another 20 points
  assert.ok(Math.abs(((cy[0] ?? 0) - (cy[1] ?? 0)) - ((cy[1] ?? 0) - (cy[2] ?? 0))) < 0.05);
  assert.match(html, /<path class="lc-pareto-line/);
  assert.match(html, /class="lc-pareto-guide"/);
  assert.match(html, />80%</);
  assert.match(html, />100%</, 'right-hand percent axis');
  assert.match(html, /상위 3개 → 80%\+ \(90%\): 로그인, 결제, 광고\./);
  assert.ok(bs[3]?.includes('lc-pareto-tail'), 'bars beyond the threshold are de-emphasised');
});

test('pareto: a null item is left off the axis, excluded from the cumulative share and listed', () => {
  const html = renderChart({ ...base, items: [...items, { id: 'n', label: '미분류', value: null }] });
  assert.equal(bars(html).length, 4);
  assert.deepEqual(dots(html).map((d) => attr(d, 'data-v')), [50, 70, 90, 100]);
  assert.match(html, /<th scope="row">미분류<\/th><td class="lc-na">데이터 없음<\/td>/);
  assert.match(html, /결측: 미분류/);
  assert.match(html, /결측 1\./);
});

test('pareto: all-null items render the empty state', () => {
  assert.match(renderChart({ ...base, items: [{ id: 'a', label: 'A', value: null }] }), /class="lc-empty"/);
});

test('pareto: invalid specs report the path', () => {
  const ok = { ...base, items };
  assert.equal(pathOf({ ...ok, items: [{ id: 'a', label: 'A', value: -1 }] }), 'items[0].value');
  assert.equal(pathOf({ ...ok, threshold: 100 }), 'threshold');
  assert.equal(pathOf({ ...ok, lineColor: 'x;y' }), 'lineColor');
  assert.equal(pathOf({ ...ok, items: [] }), 'items');
  assert.equal(pathOf({ ...ok, extra: 1 }), 'spec.extra');
});

test('pareto: user text is escaped and marks are focusable with a full label', () => {
  const html = renderChart({ ...base, title: '<b>', threshold: 70, items: [{ id: 'a', label: '<script>', value: 1200, quality: '추정' }, { id: 'b', label: 'B', value: 800 }] });
  assert.doesNotMatch(html, /<script>|<b>/);
  assert.match(html, /class="lc-pt lc-pt-pareto" tabindex="0" aria-label="&lt;script&gt;: 1,200건 · 비율 60% · 누적 60% · 추정"/);
  assert.match(html, />70%</);
});
