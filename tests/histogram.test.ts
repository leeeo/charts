import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ChartSpecError, renderChart, validateSpec } from '../src/index.ts';

const attr = (tag: string, name: string): number => Number(new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1] ?? 'NaN');
const bins = (html: string): string[] => html.match(/<rect class="lc-mark lc-bin[^>]*>/g) ?? [];
const pathOf = (spec: unknown): string => {
  try { validateSpec(spec); } catch (e) { if (e instanceof ChartSpecError) return e.path; throw e; }
  return '';
};

test('histogram: binWidth bins raw values; bar heights are proportional to counts and widths to bin size', () => {
  const html = renderChart({ type: 'histogram', title: 't', binWidth: 10, values: [1, 2, 3, 4, 12, 15, 29] });
  const b = bins(html);
  assert.equal(b.length, 3);
  assert.deepEqual(b.map((x) => attr(x, 'data-v')), [4, 2, 1]);
  assert.deepEqual(b.map((x) => attr(x, 'data-from')), [0, 10, 20]);
  assert.ok(Math.abs(attr(b[0]!, 'height') / attr(b[1]!, 'height') - 2) < 0.01);
  assert.ok(Math.abs(attr(b[0]!, 'width') - attr(b[2]!, 'width')) < 0.01);
  // bins are contiguous along x
  assert.ok(attr(b[1]!, 'x') > attr(b[0]!, 'x') + attr(b[0]!, 'width') - 0.01);
});

test('histogram: binCount splits min..max evenly; the max lands in the last bin', () => {
  const html = renderChart({ type: 'histogram', title: 't', binCount: 4, values: [0, 1, 2, 3, 4, 5, 6, 7, 8] });
  assert.deepEqual(bins(html).map((x) => attr(x, 'data-v')), [2, 2, 2, 3]);
});

test('histogram: given bins draw as is; a null bin is omitted, not zero; null values are counted as missing', () => {
  const html = renderChart({
    type: 'histogram', title: 't', unit: { suffix: '분' },
    bins: [{ from: 0, to: 5, count: 10 }, { from: 5, to: 10, count: null }, { from: 10, to: 20, count: 5 }],
  });
  const b = bins(html);
  assert.equal(b.length, 2);
  assert.ok(Math.abs(attr(b[1]!, 'width') / attr(b[0]!, 'width') - 2) < 0.05, 'a 10-wide bin is twice as wide as a 5-wide bin');
  assert.match(html, /<th scope="row">5분–10분<\/th><td class="lc-na">데이터 없음<\/td>/);
  assert.match(html, /결측 1\./);
  const raw = renderChart({ type: 'histogram', title: 't', binWidth: 1, values: [1, null, 1, null] });
  assert.equal(bins(raw).length, 1);
  assert.equal(attr(bins(raw)[0]!, 'data-v'), 2);
  assert.match(raw, /<th scope="row">결측<\/th><td>2<\/td>/);
});

test('histogram: empty and all-null data render the empty state', () => {
  for (const values of [[], [null, null]]) {
    const html = renderChart({ type: 'histogram', title: 't', values });
    assert.match(html, /class="lc-empty"/);
    assert.equal(bins(html).length, 0);
  }
});

test('histogram: invalid specs throw ChartSpecError with the right path', () => {
  const s = { type: 'histogram', title: 't' };
  assert.equal(pathOf(s), 'values');
  assert.equal(pathOf({ ...s, values: [1], bins: [{ from: 0, to: 1, count: 1 }] }), 'bins');
  assert.equal(pathOf({ ...s, values: [1], binCount: 3, binWidth: 1 }), 'binWidth');
  assert.equal(pathOf({ ...s, values: [1], binCount: 2.5 }), 'binCount');
  assert.equal(pathOf({ ...s, values: [0, 1000], binWidth: 1 }), 'binWidth');
  assert.equal(pathOf({ ...s, values: [1, 'x'] }), 'values[1]');
  assert.equal(pathOf({ ...s, bins: [{ from: 0, to: 0, count: 1 }] }), 'bins[0].to');
  assert.equal(pathOf({ ...s, bins: [{ from: 0, to: 5, count: 1 }, { from: 3, to: 8, count: 1 }] }), 'bins[1].from');
  assert.equal(pathOf({ ...s, bins: [{ from: 0, to: 5, count: -1 }] }), 'bins[0].count');
  assert.equal(pathOf({ ...s, bins: [{ from: 0, to: 5, count: 1 }], binWidth: 2 }), 'binWidth');
});

test('histogram: user text is escaped and bins are focusable with labels', () => {
  const html = renderChart({ type: 'histogram', title: '<t>', xLabel: '<x>', quality: '"추정"', unit: { suffix: '일' }, binWidth: 7, values: [0, 1, 8] });
  assert.ok(!html.includes('<x>'));
  assert.match(html, /&lt;x&gt;/);
  assert.match(html, /<g class="lc-pt lc-pt-bin" tabindex="0" aria-label="0일–7일: 2 \(66.7%\) · &quot;추정&quot;">/);
});
