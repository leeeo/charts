import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ChartSpecError, renderChart, validateSpec } from '../src/index.ts';

const attr = (tag: string, name: string): number => Number(new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1] ?? 'NaN');
const pathOf = (spec: unknown): string => {
  try { validateSpec(spec); } catch (e) { if (e instanceof ChartSpecError) return e.path; throw e; }
  return '';
};
const dots = (html: string): string[] => html.match(/<circle class="lc-mark lc-par-dot[^>]*>/g) ?? [];
const spec = (items: { id: string; label: string; values: (number | null)[] }[], extra: object = {}) => ({
  type: 'parallel', title: 't', dimensions: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }, { id: 'c', label: 'C' }], items, ...extra,
});

test('parallel: each axis has its own range; vertices map linearly within it', () => {
  const html = renderChart(spec([{ id: 'x', label: 'X', values: [0, 1000, 5] }, { id: 'y', label: 'Y', values: [100, 0, 10] }, { id: 'z', label: 'Z', values: [50, 500, 7.5] }]));
  const d = dots(html);
  assert.equal(d.length, 9);
  const at = (i: number, k: number): string => d.find((t) => attr(t, 'data-i') === i && attr(t, 'data-d') === k)!;
  // per axis, the item at the axis max is at the top, the min at the bottom, and the midpoint halfway
  for (const k of [0, 1, 2]) {
    const ys = [0, 1, 2].map((i) => attr(at(i, k), 'cy'));
    const vs = [0, 1, 2].map((i) => attr(at(i, k), 'data-v'));
    const top = ys[vs.indexOf(Math.max(...vs))]!;
    const bot = ys[vs.indexOf(Math.min(...vs))]!;
    assert.ok(Math.abs(ys[2]! - (top + bot) / 2) < 0.02, `axis ${k}: midpoint value is halfway`);
  }
  assert.ok(Math.abs(attr(at(0, 0), 'cy') - attr(at(1, 1), 'cy')) < 0.01, 'both minima on the same baseline despite different ranges');
  assert.ok(attr(at(0, 0), 'cx') < attr(at(0, 1), 'cx') && attr(at(0, 1), 'cx') < attr(at(0, 2), 'cx'));
});

test('parallel: null breaks the polyline (no vertex, two runs) and shows 데이터 없음', () => {
  const html = renderChart(spec([{ id: 'x', label: 'X', values: [1, null, 3] }, { id: 'y', label: 'Y', values: [2, 4, 1] }]));
  assert.equal(dots(html).filter((t) => attr(t, 'data-i') === 0).length, 2);
  const d = /<path class="lc-par-line [^"]*" d="([^"]*)"/.exec(html)![1]!;
  assert.equal(d.match(/M/g)!.length, 2);
  assert.ok(!d.includes('L'));
  assert.match(html, /<th scope="row">X<\/th><td>1<\/td><td class="lc-na">데이터 없음<\/td>/);
  assert.match(html, /결측 1/);
});

test('parallel: all-null items render the empty state', () => {
  const html = renderChart(spec([{ id: 'x', label: 'X', values: [null, null, null] }]));
  assert.match(html, /class="lc-empty"/);
  assert.equal(dots(html).length, 0);
});

test('parallel: invalid specs throw ChartSpecError with the right path', () => {
  const it = [{ id: 'x', label: 'X', values: [1, 2, 3] }];
  assert.equal(pathOf({ ...spec(it), dimensions: [{ id: 'a', label: 'A' }] }), 'dimensions');
  assert.equal(pathOf(spec([{ id: 'x', label: 'X', values: [1, 2] }])), 'items[0].values');
  assert.equal(pathOf(spec([{ id: 'x', label: 'X', values: [1, 'a' as never, 3] }])), 'items[0].values[1]');
  assert.equal(pathOf({ ...spec(it), dimensions: [{ id: 'a', label: 'A', min: 5, max: 1 }, { id: 'b', label: 'B' }, { id: 'c', label: 'C' }] }), 'dimensions[0].max');
  assert.equal(pathOf(spec([...it, { id: 'x', label: 'Y', values: [1, 2, 3] }])), 'items[1].id');
  assert.equal(pathOf(spec(Array.from({ length: 201 }, (_, i) => ({ id: 'i' + i, label: 'L', values: [1, 2, 3] })))), 'items');
});

test('parallel: user text is escaped and item lines are focusable with labels', () => {
  const html = renderChart({ type: 'parallel', title: 't', dimensions: [{ id: 'a', label: '방문자', unit: { suffix: '명' } }, { id: 'b', label: '<B>' }], items: [{ id: 'x', label: '앱"', values: [1200, null], quality: '추정' }] });
  assert.ok(!html.includes('<B>'));
  assert.match(html, /<g class="lc-pt lc-pt-par" tabindex="0" aria-label="앱&quot;: 방문자 1,200명, &lt;B&gt; 데이터 없음 · 추정">/);
});
