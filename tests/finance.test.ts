import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ChartSpecError, renderChart, validateSpec } from '../src/index.ts';
import { bollinger, compact, ema, sma } from '../src/charts/fin.ts';
import { surpriseOf } from '../src/charts/surprise.ts';
import { rangePos } from '../src/charts/range52.ts';
import { impliedMultiple } from '../src/charts/valuation.ts';
import { stepOf } from '../src/charts/marketmap.ts';

const pathOf = (spec: unknown): string => {
  try { validateSpec(spec); } catch (e) { if (e instanceof ChartSpecError) return e.path; throw e; }
  return '';
};
const attr = (tag: string, name: string): string => new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1] ?? '';
const all = (html: string, re: RegExp): string[] => html.match(re) ?? [];
const d = (open: number, high: number, low: number, close: number) => ({ open, high, low, close });
const close6 = [10, 11, null, 12, 13, 14];
const dates6 = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6'];

test('indicators: SMA / EMA / Bollinger skip null days and are null before the window fills', () => {
  assert.deepEqual(sma(close6, 2), [null, 10.5, null, 11.5, 12.5, 13.5]);
  // EMA(2): alpha 2/3, seeded with the mean of the first two available values
  const e = ema([1, 2, null, 3], 2);
  assert.deepEqual(e.slice(0, 3), [null, 1.5, null]);
  assert.ok(Math.abs((e[3] as number) - (1.5 + (2 / 3) * (3 - 1.5))) < 1e-9);
  const b = bollinger([1, 3, 1, 3], 2, 2);
  assert.deepEqual(b.mid, [null, 2, 2, 2]);
  assert.deepEqual(b.upper, [null, 4, 4, 4]);
  assert.deepEqual(b.lower, [null, 0, 0, 0]);
  assert.equal(compact(18790000, 'ko'), '1879만');
  assert.equal(compact(123000000, 'ko'), '1.2억');
  assert.equal(compact(1500, 'en'), '1.5K');
});

test('price: line breaks at the null day, volume pane shares the x axis, overlays are drawn and listed', () => {
  const html = renderChart({ type: 'price', title: 't', unit: { suffix: '원' }, dates: dates6, close: close6, volume: [100, 200, 300, null, 50, 0], overlays: [{ kind: 'sma', window: 2 }, { kind: 'bollinger', window: 2 }] });
  const line = all(html, /<path class="lc-price-line[^>]*>/g)[0]!;
  assert.equal((attr(line, 'd').match(/M/g) ?? []).length, 2, 'two runs around the gap');
  const vols = all(html, /<rect class="lc-mark lc-fin-vol[^>]*>/g);
  assert.deepEqual(vols.map((v) => attr(v, 'data-i')), ['0', '1', '2', '4', '5'], 'volume of the null-close day is still drawn; null volume is not');
  // a dot and its volume bar of the same day share x
  const dot = all(html, /<circle class="lc-mark lc-dot[^>]*data-i="4"[^>]*>/g)[0]!;
  const vb = vols.find((v) => attr(v, 'data-i') === '4')!;
  assert.ok(Math.abs(Number(attr(dot, 'cx')) - (Number(attr(vb, 'x')) + Number(attr(vb, 'width')) / 2)) < 0.02);
  // volume colour follows the close vs the previous close: D2 up, D5 (13 vs 12) up, D6 up; D1 flat (no previous)
  assert.match(vols[0]!, /lc-fin-flat/);
  assert.match(vols[1]!, /lc-fin-up/);
  assert.match(html, /2일 이동평균/);
  assert.match(html, /볼린저 밴드\(2일, ±2σ\)/);
  // Bollinger(2) mid = [null, 10.5, null, 11.5, 12.5, 13.5]: the one-point run before the gap gets no band
  assert.equal(all(html, /<path class="lc-fin-band /g).length, 1, 'band fill per run of two or more points');
  assert.match(html, /aria-label="D3: 종가 데이터 없음 · 거래량 300"/);
  assert.match(html, /결측 1\./);
  assert.match(html, /<th scope="col">거래량<\/th>/);
});

test('candlestick: volume, overlays and the convention class; 0.3 specs render the same structure', () => {
  const ohlc = [d(10, 12, 9, 11), d(11, 11, 8, 9), d(9, 13, 9, 12), null];
  const html = renderChart({ type: 'candlestick', title: 't', dates: ['a', 'b', 'c', 'd'], ohlc, volume: [5, 7, 9, null], overlays: [{ kind: 'ema', window: 2 }], convention: 'global' });
  assert.match(html, /<figure class="lc lc-t-candlestick lc-conv-global"/);
  const vols = all(html, /<rect class="lc-mark lc-fin-vol[^>]*>/g);
  assert.deepEqual(vols.map((v) => /lc-fin-(up|down)/.exec(v)?.[1]), ['up', 'down', 'up']);
  assert.match(html, /class="lc-cs-ma lc-fin-ov lc-fin-ema [^"]*" data-w="2"/);
  assert.match(html, /2일 지수이동평균/);
  const plain = renderChart({ type: 'candlestick', title: 't', dates: ['a', 'b', 'c'], ohlc: [d(1, 2, 0, 1), d(1, 2, 0, 2), d(2, 3, 1, 3)], ma: [2] });
  assert.ok(!plain.includes('lc-fin-vol') && !plain.includes('lc-conv-global'));
  assert.match(plain, /class="lc-cs-ma lc-c2" data-w="2"/);
});

test('ohlc: open tick left, close tick right, same validation as candlestick', () => {
  const html = renderChart({ type: 'ohlc', title: 't', dates: ['a', 'b'], ohlc: [d(10, 14, 8, 12), d(12, 13, 6, 7)] });
  const bars = all(html, /<path class="lc-mark lc-ohlc[^>]*>/g);
  assert.equal(bars.length, 2);
  assert.match(bars[0]!, /lc-candle-up/);
  assert.match(bars[1]!, /lc-candle-down/);
  // d = M x high V low M x-tk open H x M x close H x+tk
  const m = /d="M([\d.]+) [\d.]+V[\d.]+M([\d.]+) [\d.]+H[\d.]+M[\d.]+ [\d.]+H([\d.]+)"/.exec(bars[0]!)!;
  assert.ok(Number(m[2]) < Number(m[1]) && Number(m[3]) > Number(m[1]));
  assert.match(html, /OHLC 차트/);
  assert.equal(pathOf({ type: 'ohlc', title: 't', dates: ['a'], ohlc: [d(10, 11, 10.5, 10)] }), 'ohlc[0].low');
});

test('combo: negative bars grow down from zero, right-axis line is dashed and labelled, dual axis needs both titles', () => {
  const spec = {
    type: 'combo', title: 't', unit: { suffix: '억원' }, unit2: { suffix: '%' }, yLabel: '금액', y2Label: '이익률',
    labels: ['Q1', 'Q2', 'Q3'],
    bars: [{ id: 'rev', name: '매출액', values: [100, 120, null] }, { id: 'op', name: '영업이익', values: [10, -5, 8] }],
    lines: [{ id: 'm', name: '영업이익률', axis: 'right', values: [10, -4.2, null] }],
  };
  const html = renderChart(spec);
  const bars = all(html, /<rect class="lc-mark lc-bar lc-combo-bar[^>]*>/g);
  assert.equal(bars.length, 5, 'null bar is not drawn');
  const pos = bars.find((b) => attr(b, 'data-s') === 'op' && attr(b, 'data-i') === '0')!;
  const neg = bars.find((b) => attr(b, 'data-s') === 'op' && attr(b, 'data-i') === '1')!;
  assert.match(neg, /lc-combo-neg/);
  assert.ok(Math.abs(Number(attr(neg, 'y')) - (Number(attr(pos, 'y')) + Number(attr(pos, 'height')))) < 0.02, 'negative bar starts at the zero line');
  assert.match(html, /<path class="lc-line lc-combo-line lc-combo-r /);
  assert.match(html, /영업이익률 \(오른쪽 축\)/);
  assert.match(html, /aria-label="Q2: 매출액 120억원 · 영업이익 -5억원 · 영업이익률 -4.2%"/);
  assert.match(html, /aria-label="Q3: 매출액 데이터 없음/);
  assert.equal(pathOf({ ...spec, y2Label: undefined }), 'y2Label');
  assert.equal(pathOf({ ...spec, yLabel: undefined }), 'yLabel');
  assert.equal(pathOf({ ...spec, lines: [{ ...spec.lines[0], axis: 'left' }] }), 'y2Label');
  assert.equal(pathOf({ ...spec, lines: [{ ...spec.lines[0], id: 'rev' }] }), 'lines[0].id');
  assert.equal(pathOf({ ...spec, lines: [{ ...spec.lines[0], axis: 'top' }] }), 'lines[0].axis');
});

test('surprise: ratio and state; a missing estimate is 미확인, never zero; missing actual is pending', () => {
  assert.deepEqual(surpriseOf(110, 100), { r: 0.1, state: 'beat' });
  assert.equal(surpriseOf(90, 100).state, 'miss');
  assert.equal(surpriseOf(-30, 20).r, -2.5);
  assert.deepEqual(surpriseOf(50, null), { r: null, state: 'unknown' });
  assert.deepEqual(surpriseOf(null, 10), { r: null, state: 'pending' });
  const html = renderChart({ type: 'surprise', title: 't', unit: { suffix: '억원' }, labels: ['Q1', 'Q2', 'Q3'], actual: [110, 80, null], estimate: [100, null, 90], width: 640 });
  assert.match(html, /aria-label="Q1: 실적 110억원, 예상치 100억원 · 상회 \+10%"/);
  assert.match(html, /aria-label="Q2: 실적 80억원, 예상치 미확인 · 미확인"/);
  assert.match(html, /aria-label="Q3: 실적 데이터 없음, 예상치 90억원 · 발표 전"/);
  assert.equal(all(html, /<rect class="lc-mark lc-sp-bar/g).length, 2);
  assert.equal(all(html, /<line class="lc-mark lc-sp-est/g).length, 2, 'no estimate tick where the estimate is missing');
  assert.match(html, /<th scope="row">Q2<\/th><td>80억원<\/td><td>미확인<\/td>/);
  assert.match(html, />▲10%</);
  assert.equal(pathOf({ type: 'surprise', title: 't', labels: ['a'], actual: [1], estimate: [] }), 'estimate');
});

test('range52: marker position, text position, missing current, current outside the range rejected', () => {
  assert.equal(rangePos(100, 200, 150), 0.5);
  assert.equal(rangePos(5, 5, 5), 0.5);
  const html = renderChart({ type: 'range52', title: 't', unit: { suffix: '원' }, width: 640, items: [
    { id: 'a', label: 'A', low: 100, high: 200, current: 175 }, { id: 'b', label: 'B', low: 10, high: 20, current: null }] });
  const cur = all(html, /<path class="lc-mark lc-r52-cur[^>]*>/g);
  assert.equal(cur.length, 1);
  assert.match(html, /aria-label="A: 52주 최저 100원, 최고 200원, 현재 175원 · 범위의 75% · 최고가 대비 -12.5% · 최저가 대비 \+75%"/);
  assert.match(html, /현재 데이터 없음/);
  assert.equal(pathOf({ type: 'range52', title: 't', items: [{ id: 'a', label: 'A', low: 10, high: 20, current: 25 }] }), 'items[0].current');
  assert.equal(pathOf({ type: 'range52', title: 't', items: [{ id: 'a', label: 'A', low: 30, high: 20, current: 25 }] }), 'items[0].high');
  assert.equal(pathOf({ type: 'range52', title: 't', items: [{ id: 'a', label: 'A', low: 10, high: 20 }] }), 'items[0].current');
});

test('valuation: band lines are multiple × base, skipped where base <= 0 or missing, implied multiple in labels', () => {
  assert.equal(impliedMultiple(1200, 100), 12);
  assert.equal(impliedMultiple(1200, -5), null);
  const html = renderChart({ type: 'valuation', title: 't', unit: { suffix: '원' }, multiples: [10, 15], dates: ['m1', 'm2', 'm3', 'm4'], price: [1000, 1100, 1050, null], base: [100, 100, -10, 80] });
  const lines = all(html, /<path class="lc-vb-line"[^>]*>/g);
  assert.equal(lines.length, 2);
  assert.equal((attr(lines[0]!, 'd').match(/M/g) ?? []).length, 1, 'only the m1-m2 run (m4 alone is skipped)');
  assert.match(html, /aria-label="m2: 주가 1,100원 · EPS 100원 · PER 11배 \(10배–15배 사이\)"/);
  assert.match(html, /EPS 없음 또는 0 이하 1일은 밴드 없음/);
  assert.match(html, /<th scope="row">m3<\/th><td>1,050원<\/td><td>-10원<\/td><td class="lc-na">데이터 없음<\/td>/);
  assert.equal(pathOf({ type: 'valuation', title: 't', multiples: [10, 8], dates: ['a'], price: [1], base: [1] }), 'multiples[1]');
  assert.equal(pathOf({ type: 'valuation', title: 't', multiples: [10], dates: ['a'], price: [1], base: [1] }), 'multiples');
  assert.equal(pathOf({ type: 'valuation', title: 't', multiples: [5, 10], metric: 'EV', dates: ['a'], price: [1], base: [1] }), 'metric');
});

test('marketmap: colour steps, ▲/▼ text in cells and legend, missing cap and change, convention', () => {
  assert.equal(stepOf(0.5, [1, 3]), 0);
  assert.equal(stepOf(2, [1, 3]), 1);
  assert.equal(stepOf(-3, [1, 3]), -2);
  assert.equal(stepOf(null, [1, 3]), null);
  const html = renderChart({ type: 'marketmap', title: 't', unit: { suffix: '조원' }, convention: 'global', items: [
    { id: 'g', label: '반도체', children: [{ id: 'a', label: 'A', value: 300, change: 3.5 }, { id: 'b', label: 'B', value: 100, change: -1.5 }] },
    { id: 'c', label: 'C', value: 100, change: null }, { id: 'd', label: 'D', value: null, change: 1 }] });
  const cells = all(html, /<rect class="lc-mark lc-mm [^>]*>/g);
  assert.deepEqual(cells.map((c) => /lc-mm-(u2|u1|0|d1|d2|na)/.exec(c)?.[1]), ['u2', 'd1', 'na']);
  assert.match(html, />▲\+3.5%</);
  assert.match(html, /▼ 하락 \(−1% ~ −3%\)/);
  assert.match(html, /aria-label="B, 반도체: 등락률 ▼-1.5% · 시가총액 100조원 \(20%\)"/);
  assert.match(html, /시가총액 결측 1\. 등락률 결측 1\./);
  assert.match(html, /lc-conv-global/);
  assert.ok(!/style="/.test(html), 'no inline style attributes (CSP style-src-attr stays strict)');
  assert.equal(pathOf({ type: 'marketmap', title: 't', items: [{ id: 'a', label: 'A', value: 1 }] }), 'items[0].change');
  assert.equal(pathOf({ type: 'marketmap', title: 't', steps: [3, 1], items: [{ id: 'a', label: 'A', value: 1, change: 0 }] }), 'steps[1]');
});

test('finance types never emit inline style attributes and are deterministic', () => {
  const specs = [
    { type: 'price', title: 't', dates: ['a', 'b'], close: [1, 2], volume: [1, 2], overlays: [{ kind: 'bollinger', window: 2 }] },
    { type: 'ohlc', title: 't', dates: ['a'], ohlc: [d(1, 2, 0, 1)], volume: [3] },
    { type: 'combo', title: 't', labels: ['a'], bars: [{ id: 'x', name: 'X', values: [1] }] },
    { type: 'surprise', title: 't', labels: ['a'], actual: [1], estimate: [null] },
    { type: 'range52', title: 't', items: [{ id: 'a', label: 'A', low: 1, high: 2, current: 1.5 }] },
    { type: 'valuation', title: 't', multiples: [1, 2], dates: ['a', 'b'], price: [1, 2], base: [1, 1] },
  ];
  for (const s of specs) {
    const a = renderChart(s);
    assert.ok(!/style="/.test(a), s.type);
    assert.equal(a, renderChart(s));
  }
});
