import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ChartSpecError, renderChart, validateSpec } from '../src/index.ts';

const attr = (tag: string, name: string): number => Number(new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1] ?? 'NaN');
const pathOf = (spec: unknown): string => {
  try { validateSpec(spec); } catch (e) { if (e instanceof ChartSpecError) return e.path; throw e; }
  return '';
};
import { KR_SIDO, KR_SIDO_ATTRIBUTION } from '../src/geo/kr-sido.ts';

const regions = (html: string): string[] => html.match(/<path class="lc-mark lc-region[^>]*>/g) ?? [];
const nas = (html: string): string[] => html.match(/<path class="lc-region-na[^>]*>/g) ?? [];
const level = (tag: string): number => Number(/lc-map-(\d)/.exec(tag)?.[1] ?? 'NaN');
const code = (tag: string): string => /data-code="(\d+)"/.exec(tag)?.[1] ?? '';
const spec = (values: object, extra: object = {}) => ({ type: 'map', title: 't', values, ...extra });

test('map: values keyed by code or short name map to sequential classes', () => {
  const html = renderChart(spec({ '서울': 0, '26': 50, '대구광역시': 100 }));
  const r = regions(html);
  assert.equal(r.length, 3);
  const of = (c: string): string => r.find((x) => code(x) === c)!;
  assert.equal(level(of('11')), 0, 'min -> lightest');
  assert.equal(level(of('27')), 6, 'max -> darkest');
  assert.equal(level(of('26')), 3, 'middle of 5 classes -> middle step');
  assert.equal(attr(of('26'), 'data-v'), 50);
  assert.match(html, /<ul class="lc-legend lc-map-legend lc-c1">/);
  assert.equal((html.match(/<span class="lc-sw lc-map-\d">/g) ?? []).length, 5);
  assert.ok(!/style="(?!--c:)/.test(html));
});

test('map: null and absent provinces are hatched, listed missing and shown as 데이터 없음', () => {
  const html = renderChart(spec({ '서울': 10, '경기': 20, '세종': null }));
  const n = nas(html);
  assert.equal(n.length, 15);
  assert.ok(n.every((x) => /fill="url\(#[^)]+-na\)"/.test(x)));
  assert.match(html, /<pattern id="[^"]+-na"/);
  assert.match(html, /<th scope="row">세종특별자치시<\/th><td class="lc-na">데이터 없음<\/td>/);
  assert.match(html, /결측 15 \(부산, 대구, /);
  assert.match(html, /<span class="lc-sw lc-sw-mapna"><\/span><span class="lc-ln">데이터 없음<\/span><span class="lc-lv">부산, /);
});

test('map: every province is focusable with its name and value; attribution and islands are kept', () => {
  const values = Object.fromEntries(KR_SIDO.map((r, i) => [r.code, 1000 + i * 100]));
  const html = renderChart(spec(values, { unit: { suffix: '건' }, quality: '<추정>' }));
  assert.equal((html.match(/<g class="lc-pt lc-pt-region" tabindex="0"/g) ?? []).length, 17);
  assert.match(html, /aria-label="서울특별시: 1,000건 · &lt;추정&gt;"/);
  assert.ok(!html.includes('<추정>'));
  assert.ok(html.includes(`<p class="lc-src">${KR_SIDO_ATTRIBUTION}</p>`));
  assert.ok(KR_SIDO_ATTRIBUTION.includes('CC BY 4.0'));
  assert.ok(html.indexOf('lc-src') < html.indexOf('</figure>') && html.indexOf('lc-src') > html.indexOf('</svg>'));
  const gb = KR_SIDO.find((r) => r.code === '47')!;
  assert.ok(html.includes(` d="${gb.d}"`), '경북 (with Ulleungdo / Dokdo) drawn unchanged');
  assert.equal(nas(html).length, 0);
});

test('map: labels are optional and do not overlap', () => {
  const values = Object.fromEntries(KR_SIDO.map((r, i) => [r.short, i]));
  assert.ok(!renderChart(spec(values)).includes('lc-maplabel'));
  const html = renderChart(spec(values, { labels: true, width: 640 }));
  assert.ok((html.match(/class="lc-maplabel"/g) ?? []).length >= 10);
  assert.ok(html.includes('>서울<') && html.includes('>제주<'));
});

test('map: empty or all-null values render the empty state', () => {
  assert.match(renderChart(spec({})), /class="lc-empty"/);
  const html = renderChart(spec({ '서울': null, '부산': null }));
  assert.match(html, /class="lc-empty"/);
  assert.equal(regions(html).length + nas(html).length, 0);
});

test('map: invalid specs throw ChartSpecError with the right path', () => {
  assert.equal(pathOf(spec({ '도쿄': 1 })), 'values.도쿄');
  assert.equal(pathOf(spec({ '11': 1, '서울': 2 })), 'values.서울');
  assert.equal(pathOf(spec({ '서울': '1' })), 'values.서울');
  assert.equal(pathOf(spec([1, 2])), 'values');
  assert.equal(pathOf(spec({ '서울': 1 }, { classes: 2.5 })), 'classes');
  assert.equal(pathOf(spec({ '서울': 1 }, { classes: 9 })), 'classes');
  assert.equal(pathOf(spec({ '서울': 1 }, { min: 5, max: 1 })), 'max');
  assert.equal(pathOf(spec({ '서울': 1 }, { color: 'red;x' })), 'color');
  assert.equal(pathOf(spec({ '서울': 1 }, { regions: [] })), 'spec.regions');
});

test('map 0.8: showValues adds a bold value line; nudged labels keep the largest provinces labelled when narrow', () => {
  const values = { '서울': 4820, '경기': 5960, '인천': 1310, '강원': 380, '충북': 450, '충남': 610, '대전': 640, '세종': null };
  const html = renderChart(spec(values, { labels: true, showValues: true, width: 340, unit: { suffix: '건' } }));
  assert.match(html, /<text class="lc-maplabel"[^>]*>경기<tspan class="lc-maplabel-val" x="[\d.]+" dy="14">5,960건<\/tspan><\/text>/, 'the largest value is labelled first');
  assert.match(html, /<text class="lc-maplabel"[^>]*>서울<tspan class="lc-maplabel-val"/);
  assert.match(html, /<g class="lc-maplabels lc-c1" aria-hidden="true">/);
  assert.ok(!renderChart(spec(values, { labels: true, width: 340 })).includes('lc-maplabel-val'));
});
