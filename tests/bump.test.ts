import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ChartSpecError, renderChart, validateSpec } from '../src/index.ts';

const attr = (tag: string, name: string): number => Number(new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1] ?? 'NaN');
const marks = (html: string, cls: string): string[] => html.match(new RegExp(`<(?:rect|circle|path|line) class="lc-mark ${cls}[^>]*>`, 'g')) ?? [];
const pathOf = (spec: object): string => {
  try { validateSpec(spec); } catch (e) { assert.ok(e instanceof ChartSpecError); return e.path; }
  throw new Error('expected failure');
};

const labels = ['1월', '2월', '3월'];

test('bump: ranks are computed from values (largest = 1 at the top) and ties share a rank', () => {
  const html = renderChart({ type: 'bump', title: 't', labels, series: [
    { id: 'a', name: 'A', values: [10, 30, 5] }, { id: 'b', name: 'B', values: [20, 20, 5] }, { id: 'c', name: 'C', values: [30, 10, 1] }] });
  const dots = marks(html, 'lc-bump-dot');
  const rank = (s: number, i: number): number => attr(dots.find((d) => attr(d, 'data-s') === s && attr(d, 'data-i') === i) ?? '', 'data-r');
  const cy = (s: number, i: number): number => attr(dots.find((d) => attr(d, 'data-s') === s && attr(d, 'data-i') === i) ?? '', 'cy');
  assert.deepEqual([rank(0, 0), rank(1, 0), rank(2, 0)], [3, 2, 1]);
  assert.deepEqual([rank(0, 2), rank(1, 2), rank(2, 2)], [1, 1, 3], 'tie shares rank 1');
  assert.ok(cy(2, 0) < cy(1, 0) && cy(1, 0) < cy(0, 0), 'rank 1 at the top');
  assert.ok(Math.abs((cy(1, 0) - cy(2, 0)) - (cy(0, 0) - cy(1, 0))) < 0.05, 'ranks evenly spaced');
  const asc = renderChart({ type: 'bump', title: 't', order: 'asc', labels: ['x'], series: [{ id: 'a', name: 'A', values: [1] }, { id: 'b', name: 'B', values: [2] }] });
  assert.equal(attr(marks(asc, 'lc-bump-dot')[0] ?? '', 'data-r'), 1);
});

test('bump: given ranks are used as is; null is a gap, not rank 0', () => {
  const html = renderChart({ type: 'bump', title: 't', ranks: true, labels, series: [{ id: 'a', name: 'A', values: [2, null, 1] }, { id: 'b', name: 'B', values: [1, 1, 2] }] });
  const a = marks(html, 'lc-bump-dot').filter((d) => attr(d, 'data-s') === 0);
  assert.equal(a.length, 2);
  assert.doesNotMatch(/<path class="lc-bump-line[^>]*data-s="0"[^>]*>/.exec(html)?.[0] ?? '', /d=/, 'no line through the gap');
  assert.match(html, /class="lc-na">데이터 없음/);
  assert.match(html, /결측 1/);
});

test('bump: all-null renders the empty state', () => {
  assert.match(renderChart({ type: 'bump', title: 't', labels, series: [{ id: 'a', name: 'A', values: [null, null, null] }] }), /class="lc-empty"/);
});

test('bump: invalid specs report the path', () => {
  const ok = { type: 'bump', title: 't', labels, series: [{ id: 'a', name: 'A', values: [1, 2, 3] }] };
  assert.equal(pathOf({ ...ok, ranks: true, series: [{ id: 'a', name: 'A', values: [1, 1.5, 3] }] }), 'series[0].values[1]');
  assert.equal(pathOf({ ...ok, ranks: true, series: [{ id: 'a', name: 'A', values: [0, 1, 3] }] }), 'series[0].values[0]');
  assert.equal(pathOf({ ...ok, order: 'up' }), 'order');
  assert.equal(pathOf({ ...ok, series: [{ id: 'a', name: 'A', values: [1, 2] }] }), 'series[0].values');
  assert.equal(pathOf({ ...ok, labels: Array.from({ length: 2001 }, () => 'x') }), 'labels');
});

test('bump: escaping and focusable labelled marks', () => {
  const html = renderChart({ type: 'bump', title: 't', unit: { suffix: '건' }, labels: ['<a>'], series: [{ id: 'a', name: '"앱"', values: [1200], quality: '추정' }] });
  assert.doesNotMatch(html, /<a>|"앱"/);
  assert.match(html, /tabindex="0" aria-label="&lt;a&gt;, &quot;앱&quot;: 순위 1 \(1,200건\) · 추정"/);
});
