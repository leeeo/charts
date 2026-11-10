import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ChartSpecError, renderChart } from '../src/index.ts';

const attr = (tag: string, name: string): number => Number(new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1]);
const bars = (html: string): string[] => html.match(/<rect class="lc-mark lc-tl[^>]*>/g) ?? [];
const bar = (html: string, i: number): string => bars(html).find((b) => attr(b, 'data-i') === i) ?? '';
const pathOf = (input: object): string => {
  try { renderChart(input); } catch (e) { assert.ok(e instanceof ChartSpecError); return e.path; }
  throw new Error('expected failure');
};

test('timeline: bar x and width map linearly to start and end', () => {
  const html = renderChart({ type: 'timeline', title: 't', width: 600, items: [
    { id: 'a', lane: 'L', label: 'A', start: 0, end: 50 },
    { id: 'b', lane: 'L', label: 'B', start: 50, end: 100 },
  ] });
  const a = bar(html, 0); const b = bar(html, 1);
  assert.ok(Math.abs(attr(a, 'width') - attr(b, 'width')) < 0.02, 'equal durations, equal widths');
  assert.ok(Math.abs(attr(a, 'x') + attr(a, 'width') - attr(b, 'x')) < 0.02, 'B starts where A ends');
  assert.equal(attr(a, 'y'), attr(b, 'y'), 'touching items share a row');
  assert.equal(attr(a, 'data-v'), 50);
});

test('timeline: overlapping items in a lane stack into sub-rows; other lanes start below', () => {
  const html = renderChart({ type: 'timeline', title: 't', items: [
    { id: 'a', lane: 'L1', label: 'A', start: 0, end: 10 },
    { id: 'b', lane: 'L1', label: 'B', start: 5, end: 15 },
    { id: 'c', lane: 'L1', label: 'C', start: 11, end: 20 },
    { id: 'd', lane: 'L2', label: 'D', start: 0, end: 5 },
  ] });
  const y = (i: number): number => attr(bar(html, i), 'y');
  assert.ok(y(1) > y(0), 'B overlaps A so it goes to row 2');
  assert.equal(y(2), y(0), 'C fits back in row 1');
  assert.ok(y(3) > y(1), 'lane 2 is below both rows of lane 1');
});

test('timeline: date axis is end-inclusive and minutes axis formats HH:MM', () => {
  const d = renderChart({ type: 'timeline', axis: 'date', title: 't', items: [
    { id: 'a', lane: 'L', label: 'A', start: '2026-11-01', end: '2026-11-01' },
    { id: 'b', lane: 'L', label: 'B', start: '2026-11-02', end: '2026-11-03' },
  ] });
  assert.ok(Math.abs(attr(bar(d, 1), 'width') / attr(bar(d, 0), 'width') - 2) < 0.01);
  assert.match(d, /aria-label="A, L: 2026-11-01 – 2026-11-01 \(1일\)"/);
  const m = renderChart({ type: 'timeline', axis: 'minutes', title: 't', items: [{ id: 'a', lane: '배포', label: '빌드', start: 540, end: 630 }] });
  assert.match(m, /aria-label="빌드, 배포: 09:00 – 10:30 \(1시간 30분\)"/);
});

test('timeline: null start or end is missing, not drawn, and listed as 데이터 없음', () => {
  const html = renderChart({ type: 'timeline', title: 't', items: [
    { id: 'a', lane: 'L', label: 'A', start: 1, end: 3 },
    { id: 'b', lane: 'L', label: 'B', start: 2, end: null },
  ] });
  assert.equal(bars(html).length, 1);
  assert.match(html, /<th scope="row">B<\/th><td>L<\/td><td>2<\/td><td class="lc-na">데이터 없음<\/td><td class="lc-na">데이터 없음<\/td>/);
  assert.match(html, /<desc[^>]*>[^<]*타임라인[^<]*결측 1/);
});

test('timeline: all-missing shows the empty state', () => {
  assert.match(renderChart({ type: 'timeline', title: 't', items: [{ id: 'a', lane: 'L', label: 'A', start: null, end: null }] }), /class="lc-empty"/);
});

test('timeline: milestones are focusable diamonds and listed in a table', () => {
  const html = renderChart({ type: 'timeline', axis: 'date', title: 't', items: [{ id: 'a', lane: 'L', label: 'A', start: '2026-11-01', end: '2026-11-10' }],
    milestones: [{ id: 'm', label: '출시', at: '2026-11-05' }] });
  assert.match(html, /<path class="lc-mark lc-ms" data-i="0"/);
  assert.match(html, /aria-label="출시: 2026-11-05"/);
  assert.match(html, /<th scope="row">출시<\/th><td>–<\/td><td>2026-11-05<\/td>/);
});

test('timeline: invalid specs throw ChartSpecError with the right path', () => {
  const it = (x: object) => ({ type: 'timeline', title: 't', items: [{ id: 'a', lane: 'L', label: 'A', start: 1, end: 2, ...x }] });
  assert.equal(pathOf(it({ end: 0 })), 'items[0].end');
  assert.equal(pathOf(it({ start: 'x' })), 'items[0].start');
  assert.equal(pathOf(it({ lane: '' })), 'items[0].lane');
  assert.equal(pathOf(it({ color: 'red;}' })), 'items[0].color');
  assert.equal(pathOf({ ...it({}), axis: 'date' }), 'items[0].start');
  assert.equal(pathOf({ ...it({}), axis: 'week' }), 'axis');
  assert.equal(pathOf({ ...it({}), axis: 'minutes', items: [{ id: 'a', lane: 'L', label: 'A', start: -5, end: 2 }] }), 'items[0].start');
  assert.equal(pathOf({ ...it({}), milestones: [{ id: 'm', label: 'M' }] }), 'milestones[0].at');
  assert.equal(pathOf({ ...it({}), extra: 1 }), 'spec.extra');
  assert.equal(pathOf({ type: 'timeline', title: 't', items: [] }), 'items');
});

test('timeline: user text is escaped and bars are focusable with labels', () => {
  const html = renderChart({ type: 'timeline', title: '<b>', unit: { suffix: '일' }, items: [
    { id: 'a', lane: '앱 "A"', label: '<i>베타', start: 1, end: 15, quality: '추정치' },
  ] });
  assert.ok(!html.includes('<b>') && !html.includes('<i>'));
  assert.match(html, /<g class="lc-pt lc-pt-tl" tabindex="0" aria-label="&lt;i&gt;베타, 앱 &quot;A&quot;: 1일 – 15일 \(14일\) · 추정치">/);
});
