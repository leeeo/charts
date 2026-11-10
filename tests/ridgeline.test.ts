import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ChartSpecError, renderChart, validateSpec } from '../src/index.ts';

const attr = (tag: string, name: string): number => Number(new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1] ?? 'NaN');
const pathOf = (spec: unknown): string => {
  try { validateSpec(spec); } catch (e) { if (e instanceof ChartSpecError) return e.path; throw e; }
  return '';
};
import { silverman } from '../src/charts/ridgeline.ts';

const ridges = (html: string): string[] => html.match(/<path class="lc-mark lc-ridge[^>]*>/g) ?? [];
const g = (id: string, values: (number | null)[]) => ({ id, label: id.toUpperCase(), values });
const spec = (groups: object[], extra: object = {}) => ({ type: 'ridgeline', title: 't', groups, ...extra });
const peakHeight = (tag: string): number => {
  const ys = [...(/ d="([^"]*)"/.exec(tag)![1]!.matchAll(/[ML][-\d.]+ ([-\d.]+)/g))].map((m) => Number(m[1]));
  return Math.max(...ys) - Math.min(...ys);
};

test('ridgeline: Silverman bandwidth, peak at the centre of a symmetric sample, shared density scale', () => {
  const xs = [4, 5, 5, 6, 6, 6, 7, 7, 8];
  const html = renderChart(spec([g('a', xs), g('b', [0, 2, 4, 6, 8, 10, 12])]));
  const [a, b] = ridges(html);
  assert.ok(a && b);
  // sd = 1.2247, IQR = 2 -> min(sd, IQR/1.34) = 1.2247; h = 0.9 * 1.2247 * 9^-0.2
  assert.ok(Math.abs(attr(a, 'data-bw') - 0.9 * Math.sqrt(1.5) * 9 ** -0.2) < 1e-9);
  assert.equal(attr(a, 'data-bw'), silverman(xs));
  assert.ok(Math.abs(attr(a, 'data-peak') - 6) < 0.15, 'mode of the symmetric sample is 6');
  assert.equal(attr(a, 'data-v'), 6);
  assert.ok(peakHeight(a) > peakHeight(b) * 2, 'the tight group peaks much higher on the shared scale');
});

test('ridgeline: a fixed bandwidth overrides the rule', () => {
  const html = renderChart(spec([g('a', [1, 2, 3])], { bandwidth: 0.75 }));
  assert.equal(attr(ridges(html)[0]!, 'data-bw'), 0.75);
  assert.match(html, /고정 대역폭/);
});

test('ridgeline: nulls are ignored and counted; an all-null group shows 데이터 없음; all-null -> empty state', () => {
  const html = renderChart(spec([g('a', [1, null, 3, 5]), g('b', [null])]));
  const r = ridges(html);
  assert.equal(r.length, 1);
  assert.equal(attr(r[0]!, 'data-n'), 3);
  assert.equal(attr(r[0]!, 'data-v'), 3);
  assert.match(html, /결측 2\./);
  assert.match(html, /<th scope="row">B<\/th><td>0<\/td><td class="lc-na">데이터 없음<\/td>/);
  const none = renderChart(spec([g('a', [null, null])]));
  assert.match(none, /class="lc-empty"/);
  assert.equal(ridges(none).length, 0);
});

test('ridgeline: invalid specs throw ChartSpecError with the right path', () => {
  assert.equal(pathOf(spec([{ id: 'a', label: 'A' }])), 'groups[0].values');
  assert.equal(pathOf(spec([g('a', [1, 'x'] as never)])), 'groups[0].values[1]');
  assert.equal(pathOf(spec([g('a', [1])], { bandwidth: -1 })), 'bandwidth');
  assert.equal(pathOf(spec([g('a', [1])], { overlap: 9 })), 'overlap');
  assert.equal(pathOf(spec([g('a', [1])], { xMin: 5, xMax: 1 })), 'xMax');
  assert.equal(pathOf(spec([g('a', new Array(2001).fill(1))])), 'groups[0].values');
});

test('ridgeline: user text is escaped and ridges are focusable with labels', () => {
  const html = renderChart({ type: 'ridgeline', title: 't', unit: { suffix: '분' }, groups: [{ id: 'a', label: '<월>', values: [1000, 1200, 1400], quality: '표본' }] });
  assert.ok(!html.includes('<월>'));
  assert.match(html, /<g class="lc-pt lc-pt-ridge" tabindex="0" aria-label="&lt;월&gt;: 개수 3, 중앙값 1,200분, 최소 1,000분, 최대 1,400분 · 표본">/);
});
