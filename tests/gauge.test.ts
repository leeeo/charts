import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ChartSpecError, renderChart, validateSpec } from '../src/index.ts';

const arc = (html: string): string => /<path class="lc-mark lc-gauge[^>]*>/.exec(html)?.[0] ?? '';
const attr = (tag: string, name: string): string => new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1] ?? '';
const isErr = (path: string) => (e: unknown): boolean => e instanceof ChartSpecError && e.path === path;

test('gauge: value maps to the arc fraction; half way ends at the top of the arc', () => {
  const html = renderChart({ type: 'gauge', title: 't', width: 360, height: 220, min: 0, max: 200, value: 100 });
  const a = arc(html);
  assert.equal(attr(a, 'data-f'), '0.5');
  // Outer arc ends at the top centre: x = W/2.
  const m = /A[\d.]+ [\d.]+ 0 0 1 ([\d.]+) ([\d.]+)/.exec(attr(a, 'd'));
  assert.ok(m && Math.abs(Number(m[1]) - 180) < 0.02, `ends at the top: ${m?.[1]}`);
  const q = arc(renderChart({ type: 'gauge', title: 't', min: 50, max: 150, value: 75 }));
  assert.equal(attr(q, 'data-f'), '0.25');
});

test('gauge: target marker, bands, out-of-range values are clamped and noted', () => {
  const html = renderChart({ type: 'gauge', title: 't', unit: { suffix: '%' }, max: 100, value: 120, target: 80,
    bands: [{ to: 90, label: '양호' }, { to: 50, label: '주의' }] });
  assert.equal(attr(arc(html), 'data-f'), '1');
  assert.match(html, /<line class="lc-gauge-target" data-v="80" data-f="0.8"/);
  assert.equal((html.match(/class="lc-gauge-band /g) ?? []).length, 2);
  assert.match(html, /aria-label="값: 120% · 목표 80% \(달성 150%\) · 범위 밖"/);
  assert.match(html, /주의 0%–50%, 양호 50%–90%/, 'bands sorted ascending');
});

test('gauge: null value is missing, shows the empty state and 데이터 없음', () => {
  const html = renderChart({ type: 'gauge', title: 't', max: 10, value: null });
  assert.match(html, /class="lc-empty"/);
  assert.equal(arc(html), '');
  assert.match(html, /<td class="lc-na">데이터 없음<\/td>/);
  assert.match(html, /결측 1/);
});

test('gauge: invalid specs fail on the right path', () => {
  assert.throws(() => validateSpec({ type: 'gauge', title: 't', max: 10 }), isErr('value'));
  assert.throws(() => validateSpec({ type: 'gauge', title: 't', value: 1 }), isErr('max'));
  assert.throws(() => validateSpec({ type: 'gauge', title: 't', value: 1, min: 5, max: 5 }), isErr('max'));
  assert.throws(() => validateSpec({ type: 'gauge', title: 't', value: 1, max: 10, target: 11 }), isErr('target'));
  assert.throws(() => validateSpec({ type: 'gauge', title: 't', value: 1, max: 10, bands: [{ to: 20 }] }), isErr('bands[0].to'));
  assert.throws(() => validateSpec({ type: 'gauge', title: 't', value: 1, max: 10, bands: [{ to: 2, colour: 'red' }] }), isErr('bands[0].colour'));
  assert.throws(() => validateSpec({ type: 'gauge', title: 't', value: 1, max: 10, bands: [] }), isErr('bands'));
});

test('gauge: escaping and a focusable labelled mark', () => {
  const html = renderChart({ type: 'gauge', title: 't', unit: { suffix: '원' }, max: 1000000, value: 720000, label: '<매출>', quality: '잠정' });
  assert.ok(!html.includes('<매출>'));
  assert.match(html, /<g class="lc-pt lc-pt-gauge" tabindex="0" aria-label="&lt;매출&gt;: 720,000원 · 잠정">/);
});
