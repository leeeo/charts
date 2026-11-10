import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ChartSpecError, renderChart, validateSpec } from '../src/index.ts';

const attr = (tag: string, name: string): number => Number(new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1] ?? 'NaN');
const marks = (html: string, cls: string): string[] => html.match(new RegExp(`<(?:rect|circle|path|line) class="lc-mark ${cls}[^>]*>`, 'g')) ?? [];
const pathOf = (spec: object): string => {
  try { validateSpec(spec); } catch (e) { assert.ok(e instanceof ChartSpecError); return e.path; }
  throw new Error('expected failure');
};

const one = (points: object[]) => ({ type: 'scatter', title: 't', series: [{ id: 's', name: 'S', points }] });

test('scatter: x and y map linearly to positions (right = larger x, up = larger y)', () => {
  const html = renderChart(one([{ x: 0, y: 0 }, { x: 5, y: 5 }, { x: 10, y: 10 }]));
  const dots = marks(html, 'lc-point');
  assert.equal(dots.length, 3);
  const [a, b, c] = dots.map((d) => ({ x: attr(d, 'cx'), y: attr(d, 'cy') }));
  assert.ok(a && b && c);
  assert.ok(c.x > b.x && b.x > a.x && c.y < b.y && b.y < a.y);
  assert.ok(Math.abs((b.x - a.x) - (c.x - b.x)) < 0.05 && Math.abs((a.y - b.y) - (b.y - c.y)) < 0.05);
  assert.match(html, /r=1\./, 'correlation in the description');
});

test('scatter: groups become coloured series with a legend', () => {
  const html = renderChart({ type: 'scatter', title: 't', series: [
    { id: 'a', name: 'A', points: [{ x: 1, y: 1 }] }, { id: 'b', name: 'B', color: '#ff0000', points: [{ x: 2, y: 2 }] }] });
  assert.match(html, /lc-point lc-c1"/);
  assert.match(html, /lc-point lc-c2" style="--c:#ff0000"/);
  assert.match(html, /class="lc-legend"/);
});

test('scatter: a point with a null coordinate is not drawn (never at 0) and the table shows 데이터 없음', () => {
  const html = renderChart(one([{ x: 1, y: 2 }, { x: null, y: 3, label: 'P' }]));
  assert.equal(marks(html, 'lc-point').length, 1);
  assert.match(html, /<th scope="row">P<\/th><td class="lc-na">데이터 없음<\/td><td>3<\/td>/);
  assert.match(html, /결측 1/);
  assert.match(renderChart(one([{ x: null, y: null }])), /class="lc-empty"/);
  assert.match(renderChart(one([])), /class="lc-empty"/);
});

test('scatter: invalid specs report the path', () => {
  const ok = one([{ x: 1, y: 2 }]);
  assert.equal(pathOf(one([{ x: 1, y: '2' }])), 'series[0].points[0].y');
  assert.equal(pathOf(one([{ x: 1 }])), 'series[0].points[0].y');
  assert.equal(pathOf(one([{ x: 1, y: 2, size: 3 }])), 'series[0].points[0].size');
  assert.equal(pathOf({ ...ok, xMin: 5, xMax: 5 }), 'xMax');
  assert.equal(pathOf({ ...ok, series: [] }), 'series');
  assert.equal(pathOf(one(Array.from({ length: 2001 }, () => ({ x: 1, y: 1 })))), 'series[0].points');
  assert.equal(pathOf({ ...ok, xUnit: { suffix: 1 } }), 'xUnit.suffix');
});

test('scatter: escaping and focusable labelled marks', () => {
  const html = renderChart({ type: 'scatter', title: '<t>', unit: { suffix: '%' }, xUnit: { suffix: '분' }, xLabel: '세션', yLabel: '<y>',
    series: [{ id: 's', name: 'S', quality: '추정', points: [{ x: 4.5, y: 1200, label: '<p>' }] }] });
  assert.doesNotMatch(html, /<t>|<y>|<p>/);
  assert.match(html, /tabindex="0" aria-label="&lt;p&gt;, S: 세션 4.5분, &lt;y&gt; 1,200% · 추정"/);
});
