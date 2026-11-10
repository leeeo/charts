import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ChartSpecError, renderChart, validateSpec } from '../src/index.ts';

const attr = (tag: string, name: string): number => Number(new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1] ?? 'NaN');
const days = (html: string): string[] => html.match(/<rect class="lc-mark lc-day[^>]*>/g) ?? [];
const day = (html: string, date: string): string => (html.match(/<rect class="lc-(?:mark lc-day|day-na)[^>]*>/g) ?? []).find((d) => d.includes(`data-date="${date}"`)) ?? '';
const pathOf = (spec: unknown): string => {
  try { validateSpec(spec); } catch (e) { if (e instanceof ChartSpecError) return e.path; throw e; }
  return '';
};

test('calendar: weeks are columns and weekdays rows (Monday first)', () => {
  // 2026-11-02 is a Monday
  const html = renderChart({
    type: 'calendar', title: 't',
    data: [{ date: '2026-11-02', value: 1 }, { date: '2026-11-03', value: 2 }, { date: '2026-11-08', value: 3 }, { date: '2026-11-09', value: 4 }],
  });
  const mon = day(html, '2026-11-02');
  const tue = day(html, '2026-11-03');
  const sun = day(html, '2026-11-08');
  const nextMon = day(html, '2026-11-09');
  assert.equal(attr(mon, 'x'), attr(tue, 'x'));
  assert.ok(attr(tue, 'y') > attr(mon, 'y'));
  assert.ok(Math.abs((attr(sun, 'y') - attr(mon, 'y')) / (attr(tue, 'y') - attr(mon, 'y')) - 6) < 0.01, 'Sunday is row 6');
  assert.ok(attr(nextMon, 'x') > attr(mon, 'x'));
  assert.equal(attr(nextMon, 'y'), attr(mon, 'y'));
  assert.match(html, />월<\/text>/);
  assert.match(html, />2026년 11월<\/text>/);
  assert.match(day(html, '2026-11-09'), /lc-cal-6/);
  assert.match(day(html, '2026-11-02'), /lc-cal-0/);
});

test('calendar: days without entries and null values are missing outlines, a 0 value is a real cell', () => {
  const html = renderChart({
    type: 'calendar', title: 't', start: '2026-11-01', end: '2026-11-04',
    data: [{ date: '2026-11-01', value: 0 }, { date: '2026-11-02', value: null }, { date: '2026-11-04', value: 5 }],
  });
  assert.equal(days(html).length, 2);
  assert.match(day(html, '2026-11-01'), /lc-mark lc-day/);
  assert.match(day(html, '2026-11-02'), /lc-day-na/);
  assert.match(day(html, '2026-11-03'), /lc-day-na/);
  assert.match(html, /<th scope="row">2026-11-03<\/th><td>화<\/td><td class="lc-na">데이터 없음<\/td>/);
  assert.match(html, /<th scope="row">2026-11-01<\/th><td>일<\/td><td>0<\/td>/);
  assert.match(html, /결측 2\./);
});

test('calendar: no data or all-null data renders the empty state', () => {
  for (const data of [[], [{ date: '2026-01-01', value: null }]]) {
    const html = renderChart({ type: 'calendar', title: 't', data });
    assert.match(html, /class="lc-empty"/);
    assert.equal(days(html).length, 0);
  }
});

test('calendar: invalid specs throw ChartSpecError with the right path', () => {
  const s = { type: 'calendar', title: 't' };
  assert.equal(pathOf(s), 'data');
  assert.equal(pathOf({ ...s, data: [{ date: '2026-02-30', value: 1 }] }), 'data[0].date');
  assert.equal(pathOf({ ...s, data: [{ date: '2026-1-1', value: 1 }] }), 'data[0].date');
  assert.equal(pathOf({ ...s, data: [{ date: '2026-01-01', value: 1 }, { date: '2026-01-01', value: 2 }] }), 'data[1].date');
  assert.equal(pathOf({ ...s, data: [{ date: '2026-01-01', value: 'x' }] }), 'data[0].value');
  assert.equal(pathOf({ ...s, start: '2026-02-01', end: '2026-01-01', data: [] }), 'end');
  assert.equal(pathOf({ ...s, start: '2026-01-01', end: '2026-01-31', data: [{ date: '2026-02-01', value: 1 }] }), 'data[0].date');
  assert.equal(pathOf({ ...s, start: '2023-01-01', end: '2026-01-01', data: [] }), 'end');
  assert.equal(pathOf({ ...s, data: [{ date: '2026-01-01', value: 1, x: 1 }] }), 'data[0].x');
});

test('calendar: user text is escaped and days are focusable with labels', () => {
  const html = renderChart({ type: 'calendar', title: '<t>', unit: { suffix: '명' }, quality: '"추정"', data: [{ date: '2026-11-10', value: 1200 }] });
  assert.ok(!html.includes('<t>'));
  assert.match(html, /<g class="lc-pt lc-pt-day" tabindex="0" aria-label="2026-11-10 \(화\): 1,200명 · &quot;추정&quot;">/);
});
