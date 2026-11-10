import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ChartSpecError, renderChart } from '../src/index.ts';

const attr = (tag: string, name: string): number => Number(new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1]);
const cols = (html: string): string[] => html.match(/<rect class="lc-mark lc-sky[^>]*>/g) ?? [];
const col = (html: string, i: number): string => cols(html).find((c) => attr(c, 'data-i') === i) ?? '';
const pathOf = (input: object): string => {
  try { renderChart(input); } catch (e) { assert.ok(e instanceof ChartSpecError); return e.path; }
  throw new Error('expected failure');
};

test('skyline: columns are edge to edge and heights are proportional to values', () => {
  const html = renderChart({ type: 'skyline', title: 't', start: '2026-01-01', values: [10, 20, 40, 0] });
  const c = cols(html);
  assert.equal(c.length, 4);
  assert.ok(Math.abs(attr(c[1] as string, 'height') / attr(c[0] as string, 'height') - 2) < 0.01);
  assert.ok(Math.abs(attr(c[2] as string, 'height') / attr(c[0] as string, 'height') - 4) < 0.01);
  assert.equal(attr(c[3] as string, 'height'), 0, 'a real zero is a zero-height column');
  assert.ok(Math.abs(attr(c[0] as string, 'x') + attr(c[0] as string, 'width') - attr(c[1] as string, 'x')) < 0.02);
});

test('skyline: missing days get no column, a shaded band, and 데이터 없음 in the table', () => {
  const html = renderChart({ type: 'skyline', title: 't', start: '2026-02-27', values: [5, null, null, 0, 7] });
  assert.equal(cols(html).length, 3);
  assert.equal(col(html, 1), '');
  assert.equal((html.match(/class="lc-sky-na"/g) ?? []).length, 1, 'one band for the two-day gap');
  assert.match(html, /<th scope="row">2026-02-28<\/th><td class="lc-na">데이터 없음<\/td>/);
  assert.match(html, /<th scope="row">2026-03-02<\/th><td>0<\/td>/);
  assert.match(html, /<desc[^>]*>[^<]*스카이라인[^<]*결측 2/);
  assert.match(html, />3월</, 'month label at March 1');
});

test('skyline: all-null shows the empty state', () => {
  assert.match(renderChart({ type: 'skyline', title: 't', start: '2026-01-01', values: [null, null] }), /class="lc-empty"/);
});

test('skyline: a year of days skips per-column focus but keeps every value in the table', () => {
  const values = Array.from({ length: 365 }, (_, i) => (i % 50 === 7 ? null : 100 + (i % 30)));
  const html = renderChart({ type: 'skyline', title: 't', start: '2026-01-01', values });
  assert.equal(cols(html).length, values.filter((v) => v !== null).length);
  assert.ok(!html.includes('lc-pt-sky'));
  assert.equal((html.match(/<th scope="row">2026-/g) ?? []).length, 365);
});

test('skyline: invalid specs throw ChartSpecError with the right path', () => {
  const ok = { type: 'skyline', title: 't', start: '2026-01-01', values: [1] };
  assert.equal(pathOf({ ...ok, start: '2026-02-30' }), 'start');
  assert.equal(pathOf({ ...ok, start: undefined }), 'start');
  assert.equal(pathOf({ ...ok, values: [] }), 'values');
  assert.equal(pathOf({ ...ok, values: [1, -2] }), 'values[1]');
  assert.equal(pathOf({ ...ok, values: new Array(1101).fill(1) }), 'values');
  assert.equal(pathOf({ ...ok, color: 'url(x)' }), 'color');
  assert.equal(pathOf({ ...ok, yMax: 0 }), 'yMax');
  assert.equal(pathOf({ ...ok, extra: 1 }), 'spec.extra');
});

test('skyline: user text is escaped and short ranges are focusable with labels', () => {
  const html = renderChart({ type: 'skyline', title: '<b>', name: '방문 "웹"', quality: '<추정>', unit: { suffix: '명' }, start: '2026-11-01', values: [1200, null] });
  assert.ok(!html.includes('<b>') && !html.includes('<추정>'));
  assert.match(html, /<g class="lc-pt lc-pt-sky" tabindex="0" aria-label="2026-11-01, 방문 &quot;웹&quot;: 1,200명 · &lt;추정&gt;">/);
});
