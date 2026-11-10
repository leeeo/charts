import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ChartSpecError, renderChart, validateSpec } from '../src/index.ts';

const attr = (tag: string, name: string): number => Number(new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1] ?? 'NaN');
const marks = (html: string): string[] => html.match(/<circle class="lc-mark lc-lollipop[^>]*>/g) ?? [];
const stems = (html: string): string[] => html.match(/<line class="lc-lollipop-stem[^>]*>/g) ?? [];
const pathOf = (spec: object): string => {
  try { validateSpec(spec); } catch (e) { assert.ok(e instanceof ChartSpecError); return e.path; }
  throw new Error('expected failure');
};

const base = { type: 'lollipop', title: '방문자', unit: { suffix: '명' }, name: '방문자' };
const items = [{ id: 'a', label: 'A', value: 100 }, { id: 'b', label: 'B', value: 300 }, { id: 'c', label: 'C', value: 200 }];

test('lollipop: stems start at the zero line and dot heights are proportional to values', () => {
  const html = renderChart({ ...base, items });
  const dots = marks(html);
  assert.equal(dots.length, 3);
  const st = stems(html);
  const zero = attr(st[0] ?? '', 'y1');
  assert.ok(st.every((s) => attr(s, 'y1') === zero), 'every stem starts on the same baseline');
  const len = (i: number): number => zero - attr(dots.find((d) => attr(d, 'data-i') === i) ?? '', 'cy');
  assert.ok(Math.abs(len(1) / len(0) - 3) < 0.01, '300 is three times 100');
  assert.ok(Math.abs(len(2) / len(0) - 2) < 0.01);
  assert.ok(attr(dots[0] ?? '', 'cx') < attr(dots[1] ?? '', 'cx'), 'input order left to right');
});

test('lollipop: sort desc orders by value and horizontal stems grow to the right', () => {
  const html = renderChart({ ...base, items, sort: 'desc', horizontal: true });
  const dots = marks(html);
  const y = (i: number): number => attr(dots.find((d) => attr(d, 'data-i') === i) ?? '', 'cy');
  assert.ok(y(1) < y(2) && y(2) < y(0), '300 first, then 200, then 100');
  const st = stems(html);
  const x0 = attr(st[0] ?? '', 'x1');
  const len = (i: number): number => attr(dots.find((d) => attr(d, 'data-i') === i) ?? '', 'cx') - x0;
  assert.ok(Math.abs(len(1) / len(0) - 3) < 0.01);
  assert.match(html, /<th scope="row">B<\/th><td>300명<\/td><\/tr><tr><th scope="row">C<\/th>/, 'table follows the display order');
});

test('lollipop: negative values hang below the zero line', () => {
  const html = renderChart({ ...base, items: [{ id: 'a', label: 'A', value: 10 }, { id: 'b', label: 'B', value: -10 }] });
  const [p, n] = marks(html);
  const zero = attr(stems(html)[0] ?? '', 'y1');
  assert.ok(attr(p ?? '', 'cy') < zero && attr(n ?? '', 'cy') > zero);
  assert.ok(Math.abs((zero - attr(p ?? '', 'cy')) - (attr(n ?? '', 'cy') - zero)) < 0.05);
});

test('lollipop: null is not drawn as 0, sorts last and is listed as missing', () => {
  const html = renderChart({ ...base, sort: 'asc', items: [{ id: 'a', label: 'A', value: 5 }, { id: 'n', label: '신규', value: null }, { id: 'b', label: 'B', value: 1 }] });
  assert.equal(marks(html).length, 2);
  assert.ok(!marks(html).some((d) => attr(d, 'data-i') === 1));
  assert.match(html, /<th scope="row">신규<\/th><td class="lc-na">데이터 없음<\/td><\/tr><\/tbody>/, 'missing row last');
  assert.match(html, /결측: 신규/);
  assert.match(html, /결측 1\./);
});

test('lollipop: all-null items render the empty state', () => {
  assert.match(renderChart({ ...base, items: [{ id: 'a', label: 'A', value: null }] }), /class="lc-empty"/);
});

test('lollipop: invalid specs report the path', () => {
  const ok = { ...base, items };
  assert.equal(pathOf({ ...ok, items: [] }), 'items');
  assert.equal(pathOf({ ...ok, items: [{ id: 'a', label: 'A', value: '1' }] }), 'items[0].value');
  assert.equal(pathOf({ ...ok, items: [{ id: 'a', label: 'A', value: 1 }, { id: 'a', label: 'B', value: 2 }] }), 'items[1].id');
  assert.equal(pathOf({ ...ok, sort: 'up' }), 'sort');
  assert.equal(pathOf({ ...ok, horizontal: 'yes' }), 'horizontal');
  assert.equal(pathOf({ ...ok, color: 'red;x' }), 'color');
  assert.equal(pathOf({ ...ok, extra: 1 }), 'spec.extra');
});

test('lollipop: user text is escaped and marks are focusable with a full label', () => {
  const html = renderChart({ ...base, title: '<b>', items: [{ id: 'a', label: '<script>', value: 1200, quality: '추정' }] });
  assert.doesNotMatch(html, /<script>|<b>/);
  assert.match(html, /class="lc-pt lc-pt-lollipop" tabindex="0" aria-label="&lt;script&gt;, 방문자: 1,200명 · 추정"/);
});
