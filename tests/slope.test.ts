import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ChartSpecError, renderChart, validateSpec } from '../src/index.ts';

const attr = (tag: string, name: string): number => Number(new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1] ?? 'NaN');
const marks = (html: string, cls: string): string[] => html.match(new RegExp(`<(?:rect|circle|path|line) class="lc-mark ${cls}[^>]*>`, 'g')) ?? [];
const pathOf = (spec: object): string => {
  try { validateSpec(spec); } catch (e) { assert.ok(e instanceof ChartSpecError); return e.path; }
  throw new Error('expected failure');
};

const base = { type: 'slope', title: '매출', unit: { suffix: '만원' }, startLabel: '2분기', endLabel: '3분기' };

test('slope: higher values sit higher and positions scale linearly between the extremes', () => {
  const html = renderChart({ ...base, items: [{ id: 'a', label: 'A', start: 100, end: 300 }, { id: 'b', label: 'B', start: 200, end: 200 }] });
  const dots = marks(html, 'lc-slope-dot');
  assert.equal(dots.length, 4);
  const y = (i: number, end: number): number => attr(dots.find((d) => attr(d, 'data-i') === i && attr(d, 'data-end') === end) ?? '', 'cy');
  assert.ok(y(0, 1) < y(1, 1) && y(1, 1) < y(0, 0), '300 above 200 above 100');
  assert.ok(Math.abs((y(0, 0) - y(1, 0)) - (y(1, 1) - y(0, 1))) < 0.05, '200 is midway between 100 and 300');
  assert.ok(attr(dots[1] ?? '', 'cx') > attr(dots[0] ?? '', 'cx'), 'end column is to the right');
  assert.match(html, /class="lc-slope-line lc-slope-up/);
  assert.match(html, /<td>\+200만원 \(\+200%\)<\/td>/);
});

test('slope: a null endpoint draws no line, is listed as missing and shown as 데이터 없음', () => {
  const html = renderChart({ ...base, items: [{ id: 'a', label: 'A', start: 1, end: 2 }, { id: 'n', label: '신규', start: null, end: 5 }] });
  assert.equal((html.match(/<line class="lc-slope-line/g) ?? []).length, 1);
  assert.equal(marks(html, 'lc-slope-dot').filter((d) => attr(d, 'data-i') === 1).length, 1, 'only the present end');
  assert.match(html, /class="lc-na">데이터 없음/);
  assert.match(html, /결측: 신규/);
  assert.match(html, /결측 1\./);
});

test('slope: all-null items render the empty state', () => {
  assert.match(renderChart({ ...base, items: [{ id: 'a', label: 'A', start: null, end: null }] }), /class="lc-empty"/);
});

test('slope: invalid specs report the path', () => {
  const ok = { ...base, items: [{ id: 'a', label: 'A', start: 1, end: 2 }] };
  assert.equal(pathOf({ ...ok, startLabel: '' }), 'startLabel');
  assert.equal(pathOf({ ...ok, items: [{ id: 'a', label: 'A', start: 1, end: '2' }] }), 'items[0].end');
  assert.equal(pathOf({ ...ok, items: [{ id: 'a', label: 'A', start: 1, end: 2, color: 'red;x' }] }), 'items[0].color');
  assert.equal(pathOf({ ...ok, items: [] }), 'items');
  assert.equal(pathOf({ ...ok, extra: 1 }), 'spec.extra');
  assert.equal(pathOf({ ...ok, items: Array.from({ length: 61 }, (_, i) => ({ id: `i${i}`, label: 'x', start: 1, end: 2 })) }), 'items');
});

test('slope: user text is escaped and marks are focusable with a full label', () => {
  const html = renderChart({ ...base, title: '<b>', items: [{ id: 'a', label: '<script>', start: 1200, end: 1500, quality: '추정' }] });
  assert.doesNotMatch(html, /<script>|<b>/);
  assert.match(html, /tabindex="0" aria-label="&lt;script&gt;: 2분기 1,200만원 → 3분기 1,500만원 \(변화 \+300만원 \(\+25%\)\) · 추정"/);
});
