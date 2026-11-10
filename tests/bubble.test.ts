import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ChartSpecError, renderChart, validateSpec } from '../src/index.ts';

const attr = (tag: string, name: string): number => Number(new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1] ?? 'NaN');
const marks = (html: string, cls: string): string[] => html.match(new RegExp(`<(?:rect|circle|path|line) class="lc-mark ${cls}[^>]*>`, 'g')) ?? [];
const pathOf = (spec: object): string => {
  try { validateSpec(spec); } catch (e) { assert.ok(e instanceof ChartSpecError); return e.path; }
  throw new Error('expected failure');
};

const spec = (points: object[]) => ({ type: 'bubble', title: 't', sizeLabel: '매출', series: [{ id: 's', name: 'S', points }] });

test('bubble: circle area is proportional to size', () => {
  const html = renderChart(spec([{ x: 1, y: 1, size: 100 }, { x: 2, y: 2, size: 25 }, { x: 3, y: 3, size: 0 }]));
  const r = (size: number): number => attr(marks(html, 'lc-point').find((d) => attr(d, 'data-size') === size) ?? '', 'r');
  assert.ok(Math.abs((r(25) / r(100)) ** 2 - 0.25) < 0.001, 'quarter size = quarter area');
  assert.equal(r(0), 0);
  const order = marks(html, 'lc-point').map((d) => attr(d, 'data-size'));
  assert.deepEqual(order, [100, 25, 0], 'largest drawn first');
  assert.match(html, /class="lc-size-legend"><span class="lc-ln">매출<\/span>/);
});

test('bubble: null size or coordinate is not drawn and shows 데이터 없음', () => {
  const html = renderChart(spec([{ x: 1, y: 1, size: 10 }, { x: 2, y: 2, size: null, label: 'N' }]));
  assert.equal(marks(html, 'lc-point').length, 1);
  assert.match(html, /<th scope="row">N<\/th><td>2<\/td><td>2<\/td><td class="lc-na">데이터 없음<\/td>/);
  assert.match(html, /결측 1/);
  assert.match(renderChart(spec([{ x: 1, y: 1, size: null }])), /class="lc-empty"/);
});

test('bubble: invalid specs report the path', () => {
  assert.equal(pathOf(spec([{ x: 1, y: 1, size: -1 }])), 'series[0].points[0].size');
  assert.equal(pathOf(spec([{ x: 1, y: 1 }])), 'series[0].points[0].size');
  assert.equal(pathOf({ ...spec([{ x: 1, y: 1, size: 1 }]), sizeUnit: { decimals: 1.5 } }), 'sizeUnit.decimals');
  assert.equal(pathOf({ ...spec([{ x: 1, y: 1, size: 1 }]), yMin: 3, yMax: 1 }), 'yMax');
});

test('bubble: escaping and focusable labelled marks', () => {
  const html = renderChart({ ...spec([{ x: 1800, y: 6.2, size: 420, label: '<k>' }]), sizeUnit: { suffix: '만원' }, sizeLabel: '<매출>' });
  assert.doesNotMatch(html, /<k>|<매출>/);
  assert.match(html, /tabindex="0" aria-label="&lt;k&gt;, S: x 1,800, y 6.2, &lt;매출&gt; 420만원"/);
});
