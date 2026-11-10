import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ChartSpecError, renderChart, validateSpec } from '../src/index.ts';

const attr = (tag: string, name: string): number => Number(new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1] ?? 'NaN');
const bars = (html: string): string[] => html.match(/<rect class="lc-mark lc-wf[^>]*>/g) ?? [];
const bar = (html: string, i: number): string => bars(html).find((b) => attr(b, 'data-i') === i) ?? '';
const pathOf = (spec: object): string => {
  try { validateSpec(spec); } catch (e) { assert.ok(e instanceof ChartSpecError); return e.path; }
  throw new Error('expected failure');
};

const base = { type: 'waterfall', title: '매출 변화', unit: { suffix: '만원' }, startLabel: '10월', start: 100 };
const steps = [
  { id: 'up', label: '신규', value: 50 },
  { id: 'down', label: '환불', value: -30 },
  { id: 'sub', label: '소계', kind: 'subtotal' },
];

test('waterfall: changes float from the running total and totals are computed', () => {
  const html = renderChart({ ...base, steps });
  assert.equal(bars(html).length, 4);
  const top = (i: number): number => attr(bar(html, i), 'y');
  const bottom = (i: number): number => top(i) + attr(bar(html, i), 'height');
  const per = attr(bar(html, 0), 'height') / 100; // px per unit from the start bar
  assert.ok(Math.abs(bottom(1) - top(0)) < 0.05, 'increase starts at the start total');
  assert.ok(Math.abs(attr(bar(html, 1), 'height') - 50 * per) < 0.05);
  assert.ok(Math.abs(top(2) - top(1)) < 0.05, 'decrease hangs from the new total (150)');
  assert.ok(Math.abs(attr(bar(html, 2), 'height') - 30 * per) < 0.05);
  assert.ok(Math.abs(attr(bar(html, 3), 'height') - 120 * per) < 0.05, 'subtotal = 120');
  assert.match(bar(html, 1), /lc-wf-up/);
  assert.match(bar(html, 2), /lc-wf-down/);
  assert.match(bar(html, 3), /lc-wf-subtotal/);
  assert.equal((html.match(/<line class="lc-wf-link"/g) ?? []).length, 3, 'one connector between neighbours');
  assert.match(html, /<th scope="row">환불<\/th><td>-30만원<\/td><td>120만원<\/td>/);
  assert.match(html, /10월 100만원 → 최종 120만원 \(변화 \+20만원\)/);
});

test('waterfall: a null step draws no bar, keeps the running total and is listed', () => {
  const html = renderChart({ ...base, steps: [{ id: 'n', label: '광고', value: null }, ...steps] });
  assert.equal(bars(html).length, 4);
  assert.equal(bar(html, 1), '', 'no bar for the missing step');
  assert.ok(Math.abs(attr(bar(html, 2), 'y') + attr(bar(html, 2), 'height') - attr(bar(html, 0), 'y')) < 0.05, 'next change starts from the unchanged total');
  assert.equal((html.match(/<line class="lc-wf-link"/g) ?? []).length, 3, 'the connector bridges the gap');
  assert.match(html, /<th scope="row">광고<\/th><td class="lc-na">데이터 없음<\/td><td class="lc-na">데이터 없음<\/td>/);
  assert.match(html, /결측: 광고/);
  assert.match(html, /결측 1: 광고\./);
  assert.match(html, /aria-label="소계: 120만원 \(결측 제외 1\)"/);
});

test('waterfall: a missing start renders the empty state', () => {
  const html = renderChart({ ...base, start: null, steps });
  assert.match(html, /class="lc-empty"/);
  assert.equal(bars(html).length, 0);
});

test('waterfall: invalid specs report the path', () => {
  const ok = { ...base, steps };
  const { start: _s, ...noStart } = ok;
  assert.equal(pathOf(noStart), 'start');
  assert.equal(pathOf({ ...ok, steps: [] }), 'steps');
  assert.equal(pathOf({ ...ok, steps: [{ id: 'a', label: 'A' }] }), 'steps[0].value');
  assert.equal(pathOf({ ...ok, steps: [{ id: 'a', label: 'A', kind: 'total', value: 3 }] }), 'steps[0].value');
  assert.equal(pathOf({ ...ok, steps: [{ id: 'a', label: 'A', kind: 'sum' }] }), 'steps[0].kind');
  assert.equal(pathOf({ ...ok, upColor: 'red;' }), 'upColor');
  assert.equal(pathOf({ ...ok, extra: 1 }), 'spec.extra');
});

test('waterfall: user text is escaped and bars are focusable with a full label', () => {
  const html = renderChart({ ...base, startLabel: '<b>', steps: [{ id: 'a', label: '<script>', value: 1200, quality: '추정' }] });
  assert.doesNotMatch(html, /<script>|<b>/);
  assert.match(html, /class="lc-pt lc-pt-wf" tabindex="0" aria-label="&lt;script&gt;: \+1,200만원 \(합계 1,300만원\) · 추정"/);
});
