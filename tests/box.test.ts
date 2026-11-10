import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ChartSpecError, renderChart, validateSpec } from '../src/index.ts';

const attr = (tag: string, name: string): number => Number(new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1] ?? 'NaN');
const boxes = (html: string): string[] => html.match(/<rect class="lc-mark lc-box[^>]*>/g) ?? [];
const outliers = (html: string): string[] => html.match(/<circle class="lc-mark lc-outlier[^>]*>/g) ?? [];
const pathOf = (spec: unknown): string => {
  try { validateSpec(spec); } catch (e) { if (e instanceof ChartSpecError) return e.path; throw e; }
  return '';
};

test('box: quartiles, 1.5 IQR whiskers and outliers from raw samples; box spans q1..q3 on a linear scale', () => {
  const html = renderChart({ type: 'box', title: 't', groups: [{ id: 'a', label: 'A', values: [1, 2, 3, 4, 5, 6, 7, 8, 9, 100] }] });
  const [b] = boxes(html);
  assert.ok(b);
  // type-7 quantiles: q1 = 3.25, median = 5.5, q3 = 7.75; fences -3.5..14.5, so 100 is an outlier and the upper whisker is 9
  assert.equal(attr(b, 'data-q1'), 3.25);
  assert.equal(attr(b, 'data-v'), 5.5);
  assert.equal(attr(b, 'data-q3'), 7.75);
  assert.equal(attr(b, 'data-lo'), 1);
  assert.equal(attr(b, 'data-hi'), 9);
  const o = outliers(html);
  assert.equal(o.length, 1);
  assert.equal(attr(o[0]!, 'data-v'), 100);
  // pixel geometry: (q3 - q1) / (100 - q3) matches the pixel distances
  const boxH = attr(b, 'height');
  const above = attr(b, 'y') - attr(o[0]!, 'cy');
  assert.ok(Math.abs(boxH / above - (7.75 - 3.25) / (100 - 7.75)) < 0.01);
});

test('box: a given five-number summary draws min..max whiskers and no outliers', () => {
  const html = renderChart({ type: 'box', title: 't', unit: { suffix: '분' }, groups: [{ id: 'w', label: '웹', summary: { min: 1, q1: 2, median: 3, q3: 4, max: 10 } }] });
  const [b] = boxes(html);
  assert.equal(attr(b!, 'data-lo'), 1);
  assert.equal(attr(b!, 'data-hi'), 10);
  assert.equal(outliers(html).length, 0);
  assert.match(html, /aria-label="웹: 중앙값 3분, 1사분위 2분, 3사분위 4분, 최소 1분, 최대 10분 · 요약값"/);
});

test('box: nulls are ignored and counted; an all-null group shows 데이터 없음; all groups empty -> empty state', () => {
  const html = renderChart({ type: 'box', title: 't', groups: [{ id: 'a', label: 'A', values: [1, null, 3, 5] }, { id: 'b', label: 'B', values: [null, null] }] });
  assert.equal(boxes(html).length, 1);
  assert.equal(attr(boxes(html)[0]!, 'data-v'), 3, 'median of 1,3,5 ignores the null');
  assert.match(html, /결측 3\./);
  assert.match(html, /<th scope="row">B<\/th><td>0<\/td><td class="lc-na">데이터 없음<\/td>/);
  const none = renderChart({ type: 'box', title: 't', groups: [{ id: 'a', label: 'A', values: [null] }] });
  assert.match(none, /class="lc-empty"/);
  assert.equal(boxes(none).length, 0);
});

test('box: invalid specs throw ChartSpecError with the right path', () => {
  const g = (x: object) => ({ type: 'box', title: 't', groups: [{ id: 'a', label: 'A', ...x }] });
  assert.equal(pathOf(g({})), 'groups[0].values');
  assert.equal(pathOf(g({ values: [1], summary: { min: 0, q1: 0, median: 0, q3: 0, max: 0 } })), 'groups[0].summary');
  assert.equal(pathOf(g({ values: [1, 'x'] })), 'groups[0].values[1]');
  assert.equal(pathOf(g({ summary: { min: 0, q1: 2, median: 1, q3: 3, max: 4 } })), 'groups[0].summary.median');
  assert.equal(pathOf(g({ values: [1], color: 'url(x)' })), 'groups[0].color');
  assert.equal(pathOf({ ...g({ values: [1] }), yMin: 5, yMax: 1 }), 'yMax');
  assert.equal(pathOf(g({ values: new Array(2001).fill(1) })), 'groups[0].values');
});

test('box: user text is escaped and marks are focusable with labels', () => {
  const html = renderChart({ type: 'box', title: '<b>', groups: [{ id: 'a', label: '<A&>', values: [1, 2, 3], quality: '추정"' }] });
  assert.ok(!html.includes('<A&>'));
  assert.match(html, /&lt;A&amp;&gt;/);
  assert.match(html, /<g class="lc-pt lc-pt-box" tabindex="0" aria-label="&lt;A&amp;&gt;: 중앙값 2, [^"]*· 개수 3 · 추정&quot;">/);
});
