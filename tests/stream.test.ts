import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ChartSpecError, renderChart, validateSpec } from '../src/index.ts';

const attr = (tag: string, name: string): number => Number(new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1] ?? 'NaN');
const marks = (html: string, cls: string): string[] => html.match(new RegExp(`<(?:rect|circle|path|line) class="lc-mark ${cls}[^>]*>`, 'g')) ?? [];
const pathOf = (spec: object): string => {
  try { validateSpec(spec); } catch (e) { assert.ok(e instanceof ChartSpecError); return e.path; }
  throw new Error('expected failure');
};

const labels = ['1주', '2주', '3주'];
const mid = (d: string): number => attr(d, 'cy');

test('stream: layers stack in order, centred: silhouette is symmetric and thickness is proportional', () => {
  const html = renderChart({ type: 'stream', title: 't', offset: 'silhouette', labels, series: [
    { id: 'a', name: 'A', values: [10, 20, 30] }, { id: 'b', name: 'B', values: [30, 20, 10] }] });
  const dots = marks(html, 'lc-dot lc-stream-dot');
  assert.equal(dots.length, 6);
  const p = (s: number, i: number): string => dots.find((d) => attr(d, 'data-s') === s && attr(d, 'data-i') === i) ?? '';
  // totals are equal (40) so silhouette is symmetric about y = 0: A at label 0 (-15) mirrors B at label 2 (+15), and A at 2 (-5) mirrors B at 0 (+5)
  assert.ok(Math.abs((mid(p(0, 0)) + mid(p(1, 2))) - (mid(p(0, 2)) + mid(p(1, 0)))) < 0.05);
  assert.ok(mid(p(1, 0)) < mid(p(0, 0)), 'second layer is above the first');
  // distance between layer centres = (a + b) / 2 in data units -> equal at every label because a + b is constant
  const gap = (i: number): number => mid(p(0, i)) - mid(p(1, i));
  assert.ok(Math.abs(gap(0) - gap(2)) < 0.05 && Math.abs(gap(0) - gap(1)) < 0.05);
  assert.equal(marks(html, 'lc-dot').length, 6);
});

test('stream: wiggle keeps every value >= 0 thick and a null is a gap in that layer only', () => {
  const html = renderChart({ type: 'stream', title: 't', labels: ['a', 'b', 'c', 'd'], series: [
    { id: 'a', name: 'A', values: [5, 6, 7, 8] }, { id: 'b', name: 'B', values: [3, null, 4, 2] }] });
  assert.equal(marks(html, 'lc-dot lc-stream-dot').filter((d) => attr(d, 'data-s') === 1).length, 3);
  assert.doesNotMatch(html, /data-s="1" data-i="1"/);
  const layerB = html.match(/<(?:path|rect) class="lc-stream [^>]*data-s="1"[^>]*>/g) ?? [];
  assert.equal(layerB.length, 2, 'layer B split into two runs (single point drawn as a narrow rect)');
  assert.match(html, /class="lc-na">데이터 없음/);
  assert.match(html, /결측 1/);
});

test('stream: empty and all-zero data render the empty state', () => {
  assert.match(renderChart({ type: 'stream', title: 't', labels, series: [{ id: 'a', name: 'A', values: [null, null, null] }] }), /class="lc-empty"/);
  assert.match(renderChart({ type: 'stream', title: 't', labels, series: [{ id: 'a', name: 'A', values: [0, 0, null] }] }), /class="lc-empty"/);
});

test('stream: invalid specs report the path', () => {
  const ok = { type: 'stream', title: 't', labels, series: [{ id: 'a', name: 'A', values: [1, 2, 3] }] };
  assert.equal(pathOf({ ...ok, series: [{ id: 'a', name: 'A', values: [1, -2, 3] }] }), 'series[0].values[1]');
  assert.equal(pathOf({ ...ok, offset: 'zero' }), 'offset');
  assert.equal(pathOf({ ...ok, labels: [] }), 'labels');
  assert.equal(pathOf({ ...ok, series: [{ id: 'a', name: 'A', values: [1, 2, 3], color: 'url(x)' }] }), 'series[0].color');
});

test('stream: escaping and focusable labelled marks with share', () => {
  const html = renderChart({ type: 'stream', title: '<t>', unit: { suffix: '명' }, labels: ['<w>'], series: [{ id: 'a', name: 'A&B', values: [300] }, { id: 'b', name: 'C', values: [100] }] });
  assert.doesNotMatch(html, /<t>|<w>|A&B/);
  assert.match(html, /tabindex="0" aria-label="&lt;w&gt;, A&amp;B: 300명 \(75%\)"/);
});
