import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ChartSpecError, renderChart, validateSpec } from '../src/index.ts';

const attr = (tag: string, name: string): number => Number(new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1] ?? 'NaN');
const cells = (html: string): string[] => html.match(/<rect class="lc-mark lc-hcell[^>]*>/g) ?? [];
const level = (tag: string): number => Number(/lc-heat-(\d)/.exec(tag)?.[1] ?? 'NaN');
const pathOf = (spec: unknown): string => {
  try { validateSpec(spec); } catch (e) { if (e instanceof ChartSpecError) return e.path; throw e; }
  return '';
};
const spec = (values: (number | null)[][], extra: object = {}) => ({
  type: 'heatmap', title: 't', rows: values.map((_, i) => `r${i}`), columns: values[0]!.map((_, i) => `c${i}`), values, ...extra,
});

test('heatmap: cells sit on a rows x columns grid and the scale class rises with the value', () => {
  const html = renderChart(spec([[0, 10, 20], [30, 40, 60]]));
  const c = cells(html);
  assert.equal(c.length, 6);
  const at = (r: number, k: number): string => c.find((x) => attr(x, 'data-r') === r && attr(x, 'data-c') === k)!;
  assert.equal(level(at(0, 0)), 0, 'min -> lightest');
  assert.equal(level(at(1, 2)), 6, 'max -> darkest');
  assert.equal(level(at(1, 0)), 3, '30 of 0..60 -> middle class');
  assert.ok(attr(at(0, 1), 'x') > attr(at(0, 0), 'x'));
  assert.equal(attr(at(0, 1), 'y'), attr(at(0, 0), 'y'));
  assert.ok(attr(at(1, 0), 'y') > attr(at(0, 0), 'y'));
  assert.equal(attr(at(0, 0), 'width'), attr(at(1, 2), 'width'));
  assert.match(html, /<ul class="lc-legend lc-scale lc-c1">/);
  assert.ok(!/style="(?!--c:)/.test(html), 'no inline style except the validated --c colour');
});

test('heatmap: a null cell is a distinct outline, not a 0 cell; the table shows 데이터 없음', () => {
  const html = renderChart(spec([[0, null], [5, 10]]));
  assert.equal(cells(html).length, 3);
  assert.match(html, /<rect class="lc-hcell-na" data-i="1"/);
  assert.match(html, /<th scope="row">r0<\/th><td>0<\/td><td class="lc-na">데이터 없음<\/td>/);
  assert.match(html, /결측 1\./);
  assert.match(html, /lc-sw-na/);
});

test('heatmap: all-null matrix renders the empty state', () => {
  const html = renderChart(spec([[null, null]]));
  assert.match(html, /class="lc-empty"/);
  assert.equal(cells(html).length, 0);
});

test('heatmap: invalid specs throw ChartSpecError with the right path', () => {
  assert.equal(pathOf({ ...spec([[1]]), values: [[1], [2]] }), 'values');
  assert.equal(pathOf({ ...spec([[1, 2]]), values: [[1]] }), 'values[0]');
  assert.equal(pathOf({ ...spec([[1, 2]]), values: [[1, 'x']] }), 'values[0][1]');
  assert.equal(pathOf({ ...spec([[1]]), rows: [] }), 'rows');
  assert.equal(pathOf(spec([[1]], { min: 5, max: 5 })), 'max');
  assert.equal(pathOf(spec([[1]], { color: 'red;x' })), 'color');
  assert.equal(pathOf(spec([[1]], { extra: 1 })), 'spec.extra');
  const big = { type: 'heatmap', title: 't', rows: Array.from({ length: 50 }, (_, i) => `r${i}`), columns: Array.from({ length: 41 }, (_, i) => `c${i}`), values: [] };
  assert.equal(pathOf(big), 'values');
});

test('heatmap: user text is escaped and cells are focusable with labels', () => {
  const html = renderChart({ ...spec([[1200]]), rows: ['<월>'], columns: ['"9시"'], unit: { suffix: '명' }, quality: '추정' });
  assert.ok(!html.includes('<월>'));
  assert.match(html, /<g class="lc-pt lc-pt-hcell" tabindex="0" aria-label="&lt;월&gt;, &quot;9시&quot;: 1,200명 · 추정">/);
});
