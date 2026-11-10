import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ChartSpecError, renderChart, validateSpec } from '../src/index.ts';

const bars = (html: string): string[] => html.match(/<rect class="lc-mark lc-funnel[^>]*>/g) ?? [];
const attr = (tag: string, name: string): number => Number(new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1] ?? 'NaN');
const convs = (html: string): string[] => [...html.matchAll(/class="lc-funnel-conv"[^>]*>([^<]*)</g)].map((m) => m[1] as string);
const isErr = (path: string) => (e: unknown): boolean => e instanceof ChartSpecError && e.path === path;
const st = (vals: (number | null)[]) => vals.map((v, i) => ({ id: `s${i}`, label: `S${i}`, value: v }));

test('funnel: widths proportional to the largest stage, centred, with step conversion between stages', () => {
  const html = renderChart({ type: 'funnel', title: 't', stages: st([1000, 500, 100]) });
  const b = bars(html);
  const w = b.map((r) => attr(r, 'width'));
  assert.ok(Math.abs(w[1]! / w[0]! - 0.5) < 0.001 && Math.abs(w[2]! / w[0]! - 0.1) < 0.001);
  const mid = (r: string): number => attr(r, 'x') + attr(r, 'width') / 2;
  assert.ok(Math.abs(mid(b[0]!) - mid(b[2]!)) < 0.02, 'bars share one centre');
  assert.deepEqual(convs(html), ['↓ 50%', '↓ 20%']);
  assert.match(html, /전체 전환율 10%/);
  assert.match(html, /<th scope="row">S2<\/th><td>100<\/td><td>20%<\/td><td>10%<\/td>/);
});

test('funnel: a null stage is missing, not zero, and breaks the step conversion on both sides', () => {
  const html = renderChart({ type: 'funnel', title: 't', stages: st([1000, null, 100, 50]) });
  assert.deepEqual(bars(html).map((r) => attr(r, 'data-i')), [0, 2, 3]);
  assert.deepEqual(convs(html), ['↓ 50%'], 'only S2 -> S3 has a conversion');
  assert.match(html, /class="lc-funnel-na"[^>]*>데이터 없음</);
  assert.match(html, /<th scope="row">S1<\/th><td class="lc-na">데이터 없음<\/td><td class="lc-na">데이터 없음<\/td>/);
  assert.match(html, /<th scope="row">S2<\/th><td>100<\/td><td class="lc-na">데이터 없음<\/td><td>10%<\/td>/);
  assert.match(html, /결측 1/);
});

test('funnel: all-null shows the empty state', () => {
  const html = renderChart({ type: 'funnel', title: 't', stages: st([null, null]) });
  assert.match(html, /class="lc-empty"/);
  assert.equal(bars(html).length, 0);
});

test('funnel: invalid specs fail on the right path', () => {
  assert.throws(() => validateSpec({ type: 'funnel', title: 't', stages: [] }), isErr('stages'));
  assert.throws(() => validateSpec({ type: 'funnel', title: 't', stages: [{ id: 'a', label: 'A', value: -3 }] }), isErr('stages[0].value'));
  assert.throws(() => validateSpec({ type: 'funnel', title: 't', stages: [{ id: 'a', label: '', value: 3 }] }), isErr('stages[0].label'));
  assert.throws(() => validateSpec({ type: 'funnel', title: 't', stages: st([1]), color: 'url(x)' }), isErr('color'));
  assert.throws(() => validateSpec({ type: 'funnel', title: 't', stages: st(Array(31).fill(1)) }), isErr('stages'));
});

test('funnel: escaping and focusable labelled stages', () => {
  const html = renderChart({ type: 'funnel', title: 't', unit: { suffix: '명' }, stages: [
    { id: 'a', label: '방문<script>', value: 12000 }, { id: 'b', label: '설치', value: 3000, quality: '추정치' },
  ] });
  assert.ok(!html.includes('<script>'));
  assert.match(html, /aria-label="방문&lt;script&gt;: 12,000명"/);
  assert.match(html, /<g class="lc-pt lc-pt-funnel" tabindex="0" aria-label="설치: 3,000명 · 이전 단계 대비 25% · 첫 단계 대비 25% · 추정치">/);
});
