import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ChartSpecError, renderChart, validateSpec } from '../src/index.ts';

const attr = (tag: string, name: string): number => Number(new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1] ?? 'NaN');
const bars = (html: string): string[] => html.match(/<rect class="lc-mark lc-bar[^>]*>/g) ?? [];
const pick = (html: string, s: number, i: number): string => bars(html).find((b) => attr(b, 'data-s') === s && attr(b, 'data-i') === i) ?? '';

test('percent bars fill every category to the same length; raw values stay in the table and value box', () => {
  const html = renderChart({
    type: 'bar', stacked: true, percent: true, title: 't', unit: { suffix: '건' }, labels: ['a', 'b'],
    series: [{ id: 'x', name: 'X', values: [30, 1] }, { id: 'y', name: 'Y', values: [10, 3] }],
  });
  const len = (i: number): number => attr(pick(html, 0, i), 'height') + attr(pick(html, 1, i), 'height');
  assert.ok(Math.abs(len(0) - len(1)) < 0.05, 'both stacks are 100%');
  assert.ok(Math.abs(attr(pick(html, 0, 0), 'height') / len(0) - 0.75) < 0.01, '30 of 40 is 75%');
  assert.match(html, /aria-label="a, X: 75% \(30건\)"/);
  assert.match(html, /<th scope="row">a<\/th><td>30건<\/td><td>10건<\/td>/);
  assert.match(html, />100%</, 'percent ticks');
});

test('percent bars: a null cell is omitted, an all-null category draws nothing, percent needs stacked', () => {
  const html = renderChart({ type: 'bar', stacked: true, percent: true, title: 't', labels: ['a', 'b'], series: [{ id: 'x', name: 'X', values: [5, null] }, { id: 'y', name: 'Y', values: [null, null] }] });
  assert.equal(bars(html).length, 1);
  assert.match(html, /class="lc-na">데이터 없음/);
  const empty = renderChart({ type: 'bar', stacked: true, percent: true, title: 't', labels: ['a'], series: [{ id: 'x', name: 'X', values: [null] }] });
  assert.match(empty, /class="lc-empty"/);
  assert.throws(() => validateSpec({ type: 'bar', percent: true, title: 't', labels: ['a'], series: [{ id: 'x', name: 'X', values: [1] }] }), (e: unknown) => e instanceof ChartSpecError && e.path === 'percent');
});

test('diverging stacked bars: negatives stack below zero, positives above, both from the same baseline', () => {
  const html = renderChart({
    type: 'bar', stacked: true, title: 't', labels: ['a'],
    series: [{ id: 'n1', name: 'N1', values: [-10] }, { id: 'n2', name: 'N2', values: [-20] }, { id: 'p', name: 'P', values: [30] }],
  });
  const n1 = pick(html, 0, 0); const n2 = pick(html, 1, 0); const p = pick(html, 2, 0);
  const zero = attr(p, 'y') + attr(p, 'height');
  assert.ok(Math.abs(attr(n1, 'y') - zero) < 0.05, 'first negative starts at zero');
  assert.ok(Math.abs(attr(n2, 'y') - (attr(n1, 'y') + attr(n1, 'height'))) < 0.05, 'second negative continues below');
  assert.ok(Math.abs(attr(p, 'height') - (attr(n1, 'height') + attr(n2, 'height'))) < 0.05, '30 up equals 10+20 down');
  assert.match(html, /aria-label="a, N2: -20"/);
});
