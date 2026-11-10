import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ChartSpecError, renderChart, validateSpec } from '../src/index.ts';

const attr = (tag: string, name: string): number => Number(new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1] ?? 'NaN');
const pathOf = (spec: unknown): string => {
  try { validateSpec(spec); } catch (e) { if (e instanceof ChartSpecError) return e.path; throw e; }
  return '';
};
const dots = (html: string): string[] => html.match(/<circle class="lc-mark lc-radar-dot[^>]*>/g) ?? [];
const spec = (values: (number | null)[], extra: object = {}) => ({ type: 'radar', title: 't', axes: ['A', 'B', 'C', 'D'], series: [{ id: 's', name: 'S', values }], ...extra });

test('radar: points sit on their spoke at radius proportional to value on the shared 0..max scale', () => {
  const html = renderChart(spec([100, 50, 25, 100], { max: 100 }), { width: 640 });
  const d = dots(html);
  assert.equal(d.length, 4);
  const cx = 320;
  const cy = 180; // default height 360 at width 640
  const r = (t: string): number => Math.hypot(attr(t, 'cx') - cx, attr(t, 'cy') - cy);
  assert.ok(Math.abs(attr(d[0]!, 'cx') - cx) < 0.01, 'axis A points straight up');
  assert.ok(Math.abs(r(d[1]!) / r(d[0]!) - 0.5) < 0.01);
  assert.ok(Math.abs(r(d[2]!) / r(d[0]!) - 0.25) < 0.01);
  assert.ok(attr(d[1]!, 'cx') > cx && Math.abs(attr(d[1]!, 'cy') - cy) < 0.01, 'axis B is to the right (clockwise)');
  assert.match(html, /<polygon class="lc-radar-area/);
  assert.match(html, /<path class="lc-radar-line [^"]*" d="M[^"]*Z"/);
});

test('radar: null axis value is a gap (no dot, open outline, no fill) and is counted; table shows 데이터 없음', () => {
  const html = renderChart(spec([10, null, 30, 40]));
  assert.equal(dots(html).length, 3);
  assert.ok(!html.includes('lc-radar-area'));
  const d = /<path class="lc-radar-line [^"]*" d="([^"]*)"/.exec(html)![1]!;
  assert.ok(!d.includes('Z'));
  assert.equal(d.match(/M/g)!.length, 1, 'C-D-A is one continuous run');
  assert.equal(d.match(/L/g)!.length, 2);
  assert.match(html, /결측 1/);
  assert.match(html, /<th scope="row">B<\/th><td class="lc-na">데이터 없음<\/td>/);
  assert.ok(!html.includes('data-v="0"'));
});

test('radar: all-null data renders the empty state', () => {
  const html = renderChart(spec([null, null, null, null]));
  assert.match(html, /class="lc-empty"/);
  assert.equal(dots(html).length, 0);
});

test('radar: invalid specs throw ChartSpecError with the right path', () => {
  assert.equal(pathOf({ type: 'radar', title: 't', axes: ['A', 'B'], series: [{ id: 's', name: 'S', values: [1, 2] }] }), 'axes');
  assert.equal(pathOf(spec([1, 2, 3])), 'series[0].values');
  assert.equal(pathOf(spec([1, -2, 3, 4])), 'series[0].values[1]');
  assert.equal(pathOf(spec([1, 2, 3, 4], { max: -1 })), 'max');
  assert.equal(pathOf(spec([1, 2, 3, 4], { foo: 1 })), 'spec.foo');
  assert.equal(pathOf({ ...spec([1, 2, 3, 4]), series: [{ id: 's', name: 'S', values: [1, 2, 3, 4], color: 'url(x)' }] }), 'series[0].color');
});

test('radar: user text is escaped and dots are focusable with labels', () => {
  const html = renderChart({ type: 'radar', title: '<t>', unit: { suffix: '점' }, axes: ['<A>', 'B', 'C'], series: [{ id: 's', name: 'S&', values: [1200, 2, 3], quality: '추정' }] });
  assert.ok(!html.includes('<A>'));
  assert.match(html, /<g class="lc-pt lc-pt-radar" tabindex="0" aria-label="&lt;A&gt;, S&amp;: 1,200점 · 추정">/);
});
