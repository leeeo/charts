import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ChartSpecError, renderChart, validateSpec } from '../src/index.ts';

const attr = (tag: string, name: string): number => Number(new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1] ?? 'NaN');
const rects = (html: string): string[] => html.match(/<rect class="lc-mark lc-mekko[^>]*>/g) ?? [];
const cell = (html: string, s: number, i: number): string => rects(html).find((r) => attr(r, 'data-s') === s && attr(r, 'data-i') === i) ?? '';
const pathOf = (spec: object): string => {
  try { validateSpec(spec); } catch (e) { assert.ok(e instanceof ChartSpecError); return e.path; }
  throw new Error('expected failure');
};

const base = { type: 'marimekko', title: '플랫폼별 설치', unit: { suffix: '건' }, labels: ['상상플레이', '스톡위키'] };
const series = [{ id: 'ios', name: 'iOS', values: [30, 25] }, { id: 'and', name: 'Android', values: [90, 25] }];

test('marimekko: column width follows the column total and segment height the share within it', () => {
  const html = renderChart({ ...base, series });
  assert.equal(rects(html).length, 4);
  const w = (i: number): number => attr(cell(html, 0, i), 'width');
  assert.ok(Math.abs(w(0) / w(1) - 120 / 50) < 0.01, 'widths 120 : 50');
  assert.ok(Math.abs(attr(cell(html, 1, 0), 'width') - w(0)) < 0.01, 'segments share the column width');
  const h = (s: number, i: number): number => attr(cell(html, s, i), 'height');
  assert.ok(Math.abs(h(1, 0) / h(0, 0) - 3) < 0.01, '90 vs 30 within column 1');
  assert.ok(Math.abs(h(0, 0) + h(1, 0) - (h(0, 1) + h(1, 1))) < 0.05, 'every column is 100% tall');
  assert.ok(attr(cell(html, 0, 1), 'x') > attr(cell(html, 0, 0), 'x'));
  assert.match(html, /<td>30건 \(25%\)<\/td><td>90건 \(75%\)<\/td><td>120건<\/td><td>70\.6%<\/td>/);
  assert.match(html, /class="lc-mekko-lbl"[^>]*>Android 75%</);
});

test('marimekko: a null cell is left out of its column (not 0) and shown as 데이터 없음', () => {
  const html = renderChart({ ...base, series: [{ id: 'ios', name: 'iOS', values: [30, null] }, { id: 'and', name: 'Android', values: [90, 50] }] });
  assert.equal(rects(html).length, 3);
  assert.equal(cell(html, 0, 1), '');
  const full = attr(cell(html, 0, 0), 'height') + attr(cell(html, 1, 0), 'height');
  assert.ok(Math.abs(attr(cell(html, 1, 1), 'height') - full) < 0.05, 'the remaining segment fills its column');
  assert.match(html, /class="lc-na">데이터 없음/);
  assert.match(html, /결측 1\./);
});

test('marimekko: all-null or all-zero data renders the empty state', () => {
  assert.match(renderChart({ ...base, series: [{ id: 'a', name: 'A', values: [null, null] }] }), /class="lc-empty"/);
  assert.match(renderChart({ ...base, series: [{ id: 'a', name: 'A', values: [0, 0] }] }), /class="lc-empty"/);
});

test('marimekko: invalid specs report the path', () => {
  const ok = { ...base, series };
  assert.equal(pathOf({ ...ok, series: [{ id: 'a', name: 'A', values: [1, -1] }] }), 'series[0].values[1]');
  assert.equal(pathOf({ ...ok, series: [{ id: 'a', name: 'A', values: [1] }] }), 'series[0].values');
  assert.equal(pathOf({ ...ok, labels: [] }), 'labels');
  assert.equal(pathOf({ ...ok, labels: Array.from({ length: 41 }, (_, i) => `c${i}`), series: [{ id: 'a', name: 'A', values: Array.from({ length: 41 }, () => 1) }] }), 'labels');
  assert.equal(pathOf({ ...ok, extra: 1 }), 'spec.extra');
});

test('marimekko: user text is escaped and segments are focusable with a full label', () => {
  const html = renderChart({ ...base, labels: ['<script>', 'B'], series: [{ id: 'a', name: '<i>', values: [1200, 800], quality: '추정' }, { id: 'b', name: 'B', values: [1200, 800] }] });
  assert.doesNotMatch(html, /<script>|<i>/);
  assert.match(html, /class="lc-pt lc-pt-mekko" tabindex="0" aria-label="&lt;script&gt;, &lt;i&gt;: 1,200건 · 열 내 50% · 전체 30% · 추정"/);
});
