import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ChartSpecError, renderChart, validateSpec } from '../src/index.ts';

const bars = (html: string): string[] => html.match(/<rect class="lc-mark lc-bullet[^>]*>/g) ?? [];
const targets = (html: string): string[] => html.match(/<line class="lc-bullet-target[^>]*>/g) ?? [];
const ranges = (html: string): string[] => html.match(/<rect class="lc-bullet-range[^>]*>/g) ?? [];
const attr = (tag: string, name: string): number => Number(new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1] ?? 'NaN');
const isErr = (path: string) => (e: unknown): boolean => e instanceof ChartSpecError && e.path === path;

test('bullet: bar, target and ranges share one linear scale from 0', () => {
  const html = renderChart({ type: 'bullet', title: 't', max: 100, rows: [
    { id: 'a', label: 'A', value: 50, target: 75, ranges: [80, 25] },
    { id: 'b', label: 'B', value: 100 },
  ] });
  const [a, b] = bars(html) as [string, string];
  const x0 = attr(a, 'x');
  const full = attr(b, 'width');
  assert.ok(Math.abs(attr(a, 'width') / full - 0.5) < 0.001, '50 is half of 100');
  const tk = targets(html)[0] as string;
  assert.ok(Math.abs((attr(tk, 'x1') - x0) / full - 0.75) < 0.001, 'target at 75');
  const r = ranges(html);
  assert.deepEqual(r.map((x) => attr(x, 'data-k')), [0, 1], 'ranges sorted');
  assert.ok(Math.abs(attr(r[0] as string, 'width') / full - 0.25) < 0.001 && Math.abs(attr(r[1] as string, 'width') / full - 0.55) < 0.001);
  assert.match(html, /<th scope="row">A<\/th><td>50<\/td><td>75<\/td><td>66.7%<\/td><td>25 \/ 80<\/td>/);
});

test('bullet: null value draws no bar but keeps the target; null target is listed as missing', () => {
  const html = renderChart({ type: 'bullet', title: 't', rows: [
    { id: 'a', label: 'A', value: null, target: 40 }, { id: 'b', label: 'B', value: 30, target: null },
  ] });
  assert.deepEqual(bars(html).map((x) => attr(x, 'data-i')), [1]);
  assert.deepEqual(targets(html).map((x) => attr(x, 'data-i')), [0]);
  assert.match(html, /class="lc-bullet-na"[^>]*>데이터 없음</);
  assert.match(html, /<th scope="row">A<\/th><td class="lc-na">데이터 없음<\/td><td>40<\/td>/);
  assert.match(html, /<th scope="row">B<\/th><td>30<\/td><td class="lc-na">데이터 없음<\/td>/);
  assert.match(html, /결측 2/);
});

test('bullet: no values and no targets shows the empty state', () => {
  const html = renderChart({ type: 'bullet', title: 't', rows: [{ id: 'a', label: 'A', value: null, ranges: [10] }] });
  assert.match(html, /class="lc-empty"/);
  assert.equal(bars(html).length, 0);
});

test('bullet: invalid specs fail on the right path', () => {
  assert.throws(() => validateSpec({ type: 'bullet', title: 't', rows: {} }), isErr('rows'));
  assert.throws(() => validateSpec({ type: 'bullet', title: 't', rows: [{ id: 'a', label: 'A', value: 1, target: -1 }] }), isErr('rows[0].target'));
  assert.throws(() => validateSpec({ type: 'bullet', title: 't', rows: [{ id: 'a', label: 'A', value: 1, ranges: [1, 'x'] }] }), isErr('rows[0].ranges[1]'));
  assert.throws(() => validateSpec({ type: 'bullet', title: 't', rows: [{ id: 'a', label: 'A', value: 1, ranges: [1, 2, 3, 4, 5, 6] }] }), isErr('rows[0].ranges'));
  assert.throws(() => validateSpec({ type: 'bullet', title: 't', rows: [{ id: 'a', label: 'A', value: 1 }], max: -1 }), isErr('max'));
});

test('bullet: escaping and one focusable labelled group per row', () => {
  const html = renderChart({ type: 'bullet', title: 't', unit: { suffix: '만원' }, rows: [
    { id: 'a', label: '매출 <월>', value: 1200, target: 1500, quality: '잠정' }, { id: 'b', label: 'B', value: null },
  ] });
  assert.ok(!html.includes('<월>'));
  assert.match(html, /<g class="lc-pt lc-pt-bullet" tabindex="0" aria-label="매출 &lt;월&gt;: 1,200만원 · 목표 1,500만원 \(달성 80%\) · 잠정">/);
  assert.equal((html.match(/class="lc-pt lc-pt-bullet" tabindex="0"/g) ?? []).length, 2);
});
