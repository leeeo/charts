import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ChartSpecError, renderChart, validateSpec } from '../src/index.ts';

const attr = (tag: string, name: string): number => Number(new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1] ?? 'NaN');
const pathOf = (spec: unknown): string => {
  try { validateSpec(spec); } catch (e) { if (e instanceof ChartSpecError) return e.path; throw e; }
  return '';
};
import { movingAverage } from '../src/charts/candlestick.ts';

const candles = (html: string): string[] => html.match(/<rect class="lc-mark lc-candle[^>]*>/g) ?? [];
const d = (open: number, high: number, low: number, close: number) => ({ open, high, low, close });
const spec = (ohlc: unknown[], extra: object = {}) => ({ type: 'candlestick', title: 't', dates: ohlc.map((_, i) => `D${i + 1}`), ohlc, ...extra });

test('candlestick: body spans open..close, up/down classes, linear y scale', () => {
  const html = renderChart(spec([d(10, 14, 8, 12), d(12, 13, 6, 7)]));
  const [a, b] = candles(html);
  assert.ok(a && b);
  assert.match(a, /lc-candle-up/);
  assert.match(b, /lc-candle-down/);
  // body heights proportional to |close - open|: 2 vs 5
  assert.ok(Math.abs(attr(a, 'height') / attr(b, 'height') - 2 / 5) < 0.01);
  // a's body top (12) is above b's body top (12) by 0 -> same y
  assert.ok(Math.abs(attr(a, 'y') - attr(b, 'y')) < 0.01);
  assert.equal(attr(b, 'data-l'), 6);
});

test('candlestick: moving average uses the last N available closes and skips null days', () => {
  assert.deepEqual(movingAverage([1, 2, null, 3, 4], 2), [null, 1.5, null, 2.5, 3.5]);
  const html = renderChart(spec([d(1, 1, 1, 1), d(2, 2, 2, 2), null, d(3, 3, 3, 3), d(4, 4, 4, 4), d(5, 5, 5, 5)], { ma: [2] }));
  const p = /<path class="lc-cs-ma [^"]*" data-w="2" d="([^"]*)"/.exec(html)![1]!;
  assert.equal(p.match(/M/g)!.length, 1, 'the run before the null day has one point and is skipped; the run after is one line');
  assert.equal(p.match(/L/g)!.length, 2);
  assert.match(html, /2일 이동평균/);
  assert.match(html, /<th scope="row">D4<\/th><td>3<\/td><td>3<\/td><td>3<\/td><td>3<\/td><td>2.5<\/td>/);
});

test('candlestick: null day has no candle, is counted, and the table shows 데이터 없음; all-null -> empty', () => {
  const html = renderChart(spec([d(10, 11, 9, 10), null, d(10, 12, 9, 11)]));
  assert.equal(candles(html).length, 2);
  assert.ok(!html.includes('data-i="1"'));
  assert.match(html, /결측 1\./);
  assert.match(html, /<th scope="row">D2<\/th><td class="lc-na">데이터 없음<\/td>/);
  assert.match(renderChart(spec([null, null])), /class="lc-empty"/);
});

test('candlestick: invalid specs throw ChartSpecError with the right path', () => {
  assert.equal(pathOf({ ...spec([d(1, 2, 0, 1)]), dates: ['a', 'b'] }), 'ohlc');
  assert.equal(pathOf(spec([d(10, 11, 10.5, 10)])), 'ohlc[0].low');
  assert.equal(pathOf(spec([d(10, 10.5, 9, 11)])), 'ohlc[0].high');
  assert.equal(pathOf(spec([{ open: 1, high: 2, low: 0 }])), 'ohlc[0].close');
  assert.equal(pathOf(spec([d(1, 2, 0, 1)], { ma: [5.5] })), 'ma[0]');
  assert.equal(pathOf(spec([d(1, 2, 0, 1)], { ma: [2, 3, 4, 5, 6] })), 'ma');
  assert.equal(pathOf(spec([{ ...d(1, 2, 0, 1), volume: 3 }])), 'ohlc[0].volume');
});

test('candlestick: user text is escaped and candles are focusable with labels', () => {
  const html = renderChart({ type: 'candlestick', title: '<t>', unit: { suffix: '원' }, dates: ['<11-01>', '11-02'], ohlc: [d(1000, 1300, 900, 1200), d(1200, 1250, 1100, 1140)] });
  assert.ok(!html.includes('<11-01>'));
  assert.match(html, /<g class="lc-pt lc-pt-candle" tabindex="0" aria-label="&lt;11-01&gt;: 시가 1,000원, 고가 1,300원, 저가 900원, 종가 1,200원 · 상승">/);
  assert.match(html, /aria-label="11-02: [^"]*종가 1,140원 \(전일 대비 -5%\) · 하락"/);
});
