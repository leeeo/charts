import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ChartSpecError, renderChart, validateSpec } from '../src/index.ts';

const segs = (html: string): string[] => html.match(/<rect class="lc-mark lc-seg[^>]*>/g) ?? [];
const attr = (tag: string, name: string): number => Number(new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1] ?? 'NaN');
const isErr = (path: string) => (e: unknown): boolean => e instanceof ChartSpecError && e.path === path;

test('segmented: widths are proportional, contiguous and fill the bar', () => {
  const html = renderChart({ type: 'segmented', title: 't', width: 402, items: [
    { id: 'a', label: 'A', value: 50 }, { id: 'b', label: 'B', value: 30 }, { id: 'c', label: 'C', value: 20 },
  ] });
  const s = segs(html);
  assert.equal(s.length, 3);
  const w = s.map((r) => attr(r, 'width'));
  assert.deepEqual(w, [200, 120, 80]);
  assert.equal(attr(s[1] as string, 'x'), attr(s[0] as string, 'x') + w[0]!);
  // 0.8: name + bold share label under the segment (shared lc-cm-lbl / lc-cm-val style)
  assert.match(html, /<tspan class="lc-cm-val"[^>]*>50%</);
});

test('segmented: null is skipped (not a zero-width segment) and shown as missing', () => {
  const html = renderChart({ type: 'segmented', title: 't', width: 402, items: [{ id: 'a', label: 'A', value: 1 }, { id: 'b', label: 'B', value: null }, { id: 'c', label: 'C', value: 3 }] });
  const s = segs(html);
  assert.deepEqual(s.map((r) => attr(r, 'data-i')), [0, 2]);
  assert.deepEqual(s.map((r) => attr(r, 'width')), [100, 300]);
  assert.match(html, /<th scope="row">B<\/th><td class="lc-na">데이터 없음<\/td>/);
  assert.match(html, /결측 1/);
});

test('segmented: all-null shows the empty state', () => {
  const html = renderChart({ type: 'segmented', title: 't', items: [{ id: 'a', label: 'A', value: null }] });
  assert.match(html, /class="lc-empty"/);
  assert.equal(segs(html).length, 0);
});

test('segmented: invalid specs fail on the right path', () => {
  assert.throws(() => validateSpec({ type: 'segmented', title: 't' }), isErr('items'));
  assert.throws(() => validateSpec({ type: 'segmented', title: 't', items: [{ id: 'a', label: 'A', value: 'x' }] }), isErr('items[0].value'));
  assert.throws(() => validateSpec({ type: 'segmented', title: 't', items: [{ id: 'a', label: 'A', value: 1 }, { id: 'a', label: 'B', value: 1 }] }), isErr('items[1].id'));
  assert.throws(() => validateSpec({ type: 'segmented', title: 't', items: [{ id: 'a', label: 'A', value: 1 }], showLabels: 'no' }), isErr('showLabels'));
});

test('segmented: escaping, focusable labelled segments, labels can be turned off', () => {
  const html = renderChart({ type: 'segmented', title: 't', unit: { suffix: '건' }, items: [{ id: 'a', label: '"<i>', value: 3000, quality: '잠정' }, { id: 'b', label: 'B', value: 1000 }] });
  assert.ok(!html.includes('<i>'));
  assert.match(html, /<g class="lc-pt lc-pt-seg" tabindex="0" aria-label="&quot;&lt;i&gt;: 3,000건 \(75%\) · 잠정">/);
  const off = renderChart({ type: 'segmented', title: 't', showLabels: false, items: [{ id: 'a', label: 'A', value: 1 }] });
  assert.ok(!off.includes('lc-cm-lbls'));
});
