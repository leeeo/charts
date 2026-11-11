import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ChartSpecError, renderChart, validateSpec } from '../src/index.ts';

const attr = (tag: string, name: string): number => Number(new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1] ?? 'NaN');
const pathOf = (spec: unknown): string => {
  try { validateSpec(spec); } catch (e) { if (e instanceof ChartSpecError) return e.path; throw e; }
  return '';
};
const arcs = (html: string): string[] => html.match(/<path class="lc-mark lc-carc[^>]*>/g) ?? [];
const ribbons = (html: string): string[] => html.match(/<path class="lc-mark lc-ribbon[^>]*>/g) ?? [];
const groups = [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }, { id: 'c', label: 'C' }];
const spec = (extra: object) => ({ type: 'chord', title: 't', groups, ...extra });
const span = (tag: string): number => attr(tag, 'data-a1') - attr(tag, 'data-a0');

test('chord: arc length is proportional to the group total (undirected, symmetric matrix)', () => {
  const html = renderChart(spec({ directed: false, matrix: [[0, 10, 20], [10, 0, 30], [20, 30, 0]] }));
  const a = arcs(html);
  assert.equal(a.length, 3);
  assert.deepEqual(a.map((x) => attr(x, 'data-v')), [30, 40, 50]);
  assert.ok(Math.abs(span(a[0]!) / span(a[2]!) - 30 / 50) < 0.005);
  assert.ok(Math.abs(span(a[1]!) / span(a[2]!) - 40 / 50) < 0.005);
  assert.equal(ribbons(html).length, 3, 'one ribbon per pair');
  assert.ok(!/style="(?!--c:)/.test(html));
});

test('chord: directed flows get one ribbon per direction and arcs sized by out + in', () => {
  const html = renderChart(spec({ matrix: [[0, 10, 0], [30, 0, 0], [0, 0, 5]] }));
  const r = ribbons(html);
  assert.equal(r.length, 3);
  assert.ok(r.some((x) => attr(x, 'data-s') === 0 && attr(x, 'data-t') === 1 && attr(x, 'data-v') === 10));
  assert.ok(r.some((x) => attr(x, 'data-s') === 1 && attr(x, 'data-t') === 0 && attr(x, 'data-v') === 30));
  assert.deepEqual(arcs(html).map((x) => attr(x, 'data-v')), [40, 40, 10]);
  assert.match(html, /aria-label="B → A: 30 · 66\.7%"/);
});

test('chord: a links list gives the same layout as the equivalent matrix', () => {
  const m = renderChart(spec({ matrix: [[0, 10, 0], [30, 0, 0], [0, 0, 5]] }));
  const l = renderChart(spec({ links: [{ source: 'a', target: 'b', value: 10 }, { source: 'b', target: 'a', value: 30 }, { source: 'c', target: 'c', value: 5 }] }));
  assert.deepEqual(arcs(l), arcs(m));
  assert.deepEqual(ribbons(l), ribbons(m));
});

test('chord: a null flow is not drawn, the table shows 데이터 없음 and it is counted', () => {
  const html = renderChart(spec({ matrix: [[0, null, 4], [2, 0, 0], [0, 0, 0]] }));
  assert.equal(ribbons(html).length, 2);
  assert.match(html, /<th scope="row">A<\/th><td>0<\/td><td class="lc-na">데이터 없음<\/td><td>4<\/td>/);
  assert.match(html, /결측 1\./);
});

test('chord: all-zero or all-null data renders the empty state', () => {
  assert.match(renderChart(spec({ matrix: [[0, null, 0], [null, 0, 0], [0, 0, null]] })), /class="lc-empty"/);
  const html = renderChart(spec({ links: [{ source: 'a', target: 'b', value: null }] }));
  assert.match(html, /class="lc-empty"/);
  assert.equal(arcs(html).length, 0);
});

test('chord: invalid specs throw ChartSpecError with the right path', () => {
  assert.equal(pathOf(spec({ matrix: [[0, 1, 2], [1, 0]] })), 'matrix');
  assert.equal(pathOf(spec({ matrix: [[0, 1, 2], [1, 0], [2, 0, 0]] })), 'matrix[1]');
  assert.equal(pathOf(spec({ matrix: [[0, -1, 2], [1, 0, 0], [2, 0, 0]] })), 'matrix[0][1]');
  assert.equal(pathOf(spec({ directed: false, matrix: [[0, 1, 2], [3, 0, 0], [2, 0, 0]] })), 'matrix[1][0]');
  assert.equal(pathOf(spec({})), 'matrix');
  assert.equal(pathOf(spec({ matrix: [[0, 0, 0], [0, 0, 0], [0, 0, 0]], links: [] })), 'links');
  assert.equal(pathOf(spec({ links: [{ source: 'x', target: 'a', value: 1 }] })), 'links[0].source');
  assert.equal(pathOf(spec({ links: [{ source: 'a', target: 'b', value: 1 }, { source: 'a', target: 'b', value: 2 }] })), 'links[1]');
  assert.equal(pathOf(spec({ directed: false, links: [{ source: 'a', target: 'b', value: 1 }, { source: 'b', target: 'a', value: 2 }] })), 'links[1]');
  assert.equal(pathOf({ ...spec({ matrix: [[1]] }), groups: [{ id: 'a', label: 'A', color: 'url(x)' }] }), 'groups[0].color');
});

test('chord: user text is escaped and arcs and ribbons are focusable with labels', () => {
  const html = renderChart({ type: 'chord', title: 't', unit: { suffix: '명' }, groups: [{ id: 'a', label: '<검색>' }, { id: 'b', label: '"SNS"', quality: '추정' }], matrix: [[0, 1200], [800, 0]] });
  assert.ok(!html.includes('<검색>'));
  assert.match(html, /<g class="lc-pt lc-pt-ribbon" tabindex="0" aria-label="&lt;검색&gt; → &quot;SNS&quot;: 1,200명 · 60%">/);
  assert.match(html, /<g class="lc-pt lc-pt-carc" tabindex="0" aria-label="&quot;SNS&quot;: 합계 2,000명 \(유출 800명, 유입 1,200명\) · 추정">/);
});

test('chord 0.8: arc labels carry the group total on a bold second line', () => {
  const html = renderChart({ type: 'chord', title: 't', unit: { suffix: '명' }, groups, matrix: [[0, 10, 20], [10, 0, 30], [20, 30, 0]] });
  assert.match(html, /<text class="lc-clabel lc-c1" x="[\d.]+" y="[\d.]+" text-anchor="[a-z]+">A<tspan class="lc-clabel-val" x="[\d.]+" dy="15">60명<\/tspan><\/text>/);
});
