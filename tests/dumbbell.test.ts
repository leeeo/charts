import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ChartSpecError, renderChart, validateSpec } from '../src/index.ts';

const attr = (tag: string, name: string): number => Number(new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1] ?? 'NaN');
const dots = (html: string): string[] => html.match(/<circle class="lc-mark lc-dumbbell[^>]*>/g) ?? [];
const dot = (html: string, i: number, end: number): string => dots(html).find((d) => attr(d, 'data-i') === i && attr(d, 'data-end') === end) ?? '';
const pathOf = (spec: object): string => {
  try { validateSpec(spec); } catch (e) { assert.ok(e instanceof ChartSpecError); return e.path; }
  throw new Error('expected failure');
};

const base = { type: 'dumbbell', title: '리텐션', unit: { suffix: '%' }, startLabel: 'iOS', endLabel: 'Android' };
const items = [{ id: 'a', label: '상상플레이', start: 20, end: 40 }, { id: 'b', label: '스톡위키', start: 30, end: 25 }];

test('dumbbell: dots sit on a linear value axis and are joined by a line per category', () => {
  const html = renderChart({ ...base, items });
  assert.equal(dots(html).length, 4);
  const x = (i: number, e: number): number => attr(dot(html, i, e), 'cx');
  // 20, 25, 30, 40 on one axis: 30 is midway between 20 and 40, 25 midway between 20 and 30
  assert.ok(Math.abs((x(0, 0) + x(0, 1)) / 2 - x(1, 0)) < 0.05);
  assert.ok(Math.abs((x(0, 0) + x(1, 0)) / 2 - x(1, 1)) < 0.05);
  assert.ok(attr(dot(html, 0, 0), 'cy') < attr(dot(html, 1, 0), 'cy'), 'first category on top');
  assert.equal((html.match(/<line class="lc-dumbbell-line/g) ?? []).length, 2);
  assert.match(html, /lc-dumbbell-line lc-db-up/);
  assert.match(html, /lc-dumbbell-line lc-db-down/);
  assert.match(html, /<td>\+20%<\/td>|<td>\+20% \(\+100%\)<\/td>/);
  assert.match(html, /class="lc-dumbbell-val"[^>]*>20%</, 'start value is labelled');
  assert.match(html, /class="lc-dumbbell-val"[^>]*>40%</, 'end value is labelled');
});

test('dumbbell: sort by change and vertical orientation', () => {
  const html = renderChart({ ...base, items, sort: 'change', horizontal: false });
  assert.ok(attr(dot(html, 0, 0), 'cx') < attr(dot(html, 1, 0), 'cx'), '+20 before -5');
  assert.ok(attr(dot(html, 0, 1), 'cy') < attr(dot(html, 0, 0), 'cy'), '40 above 20');
  const s = renderChart({ ...base, items, sort: 'start' });
  assert.ok(attr(dot(s, 1, 0), 'cy') < attr(dot(s, 0, 0), 'cy'), 'start 30 ranks first');
});

test('dumbbell: a null end draws only the present dot, no line, and is listed as missing', () => {
  const html = renderChart({ ...base, items: [...items, { id: 'n', label: '신규 앱', start: null, end: 12 }] });
  assert.equal(dots(html).filter((d) => attr(d, 'data-i') === 2).length, 1);
  assert.equal((html.match(/<line class="lc-dumbbell-line/g) ?? []).length, 2);
  assert.match(html, /class="lc-na">데이터 없음/);
  assert.match(html, /결측: 신규 앱/);
  assert.match(html, /결측 1\./);
});

test('dumbbell: all-null items render the empty state', () => {
  assert.match(renderChart({ ...base, items: [{ id: 'a', label: 'A', start: null, end: null }] }), /class="lc-empty"/);
});

test('dumbbell: invalid specs report the path', () => {
  const ok = { ...base, items };
  assert.equal(pathOf({ ...ok, endLabel: '' }), 'endLabel');
  assert.equal(pathOf({ ...ok, items: [{ id: 'a', label: 'A', start: 'x', end: 1 }] }), 'items[0].start');
  assert.equal(pathOf({ ...ok, sort: 'desc' }), 'sort');
  assert.equal(pathOf({ ...ok, startColor: 'url(x)' }), 'startColor');
  assert.equal(pathOf({ ...ok, items: Array.from({ length: 201 }, (_, i) => ({ id: `i${i}`, label: 'x', start: 1, end: 2 })) }), 'items');
  assert.equal(pathOf({ ...ok, extra: 1 }), 'spec.extra');
});

test('dumbbell: user text is escaped and marks are focusable with a full label', () => {
  const html = renderChart({ ...base, startLabel: '<i>', items: [{ id: 'a', label: '<script>', start: 1200, end: 1500, quality: '추정' }] });
  assert.doesNotMatch(html, /<script>|<i>/);
  assert.match(html, /class="lc-pt lc-pt-dumbbell" tabindex="0" aria-label="&lt;script&gt;: &lt;i&gt; 1,200% → Android 1,500% \(변화 \+300% \(\+25%\)\) · 추정"/);
  assert.match(html, /<ul class="lc-legend">/);
});
