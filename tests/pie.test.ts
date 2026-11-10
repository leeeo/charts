import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ChartSpecError, renderChart } from '../src/index.ts';

const slices = (html: string): string[] => html.match(/<path class="lc-mark lc-slice[^>]*>/g) ?? [];

test('pie: wedges meet at the centre, null slice is listed as missing, no centre total', () => {
  const html = renderChart({ type: 'pie', title: '경로', width: 280, slices: [{ id: 'a', label: 'A', value: 3 }, { id: 'b', label: 'B', value: null }, { id: 'c', label: 'C', value: 1 }] });
  assert.equal(slices(html).length, 2);
  assert.ok(!html.includes('lc-center'), 'pie has no centre label');
  assert.match(html, /aria-label="A: 3 \(75%\)"/);
  assert.match(html, /<th scope="row">B<\/th><td class="lc-na">데이터 없음<\/td>/);
  assert.match(html, /<desc[^>]*>[^<]*파이 차트[^<]*결측 1/);
});

test('pie: all-null shows the empty state; negative and unknown keys are rejected; text is escaped', () => {
  assert.match(renderChart({ type: 'pie', title: 't', slices: [{ id: 'a', label: 'A', value: null }] }), /class="lc-empty"/);
  assert.throws(() => renderChart({ type: 'pie', title: 't', slices: [{ id: 'a', label: 'A', value: -1 }] }), (e: unknown) => e instanceof ChartSpecError && e.path === 'slices[0].value');
  assert.throws(() => renderChart({ type: 'pie', title: 't', centerLabel: 'x', slices: [{ id: 'a', label: 'A', value: 1 }] }), (e: unknown) => e instanceof ChartSpecError && e.path === 'spec.centerLabel');
  const html = renderChart({ type: 'pie', title: '<b>', slices: [{ id: 'a', label: '"x"<', value: 1 }] });
  assert.ok(!html.includes('<b>') && html.includes('&quot;x&quot;&lt;'));
});
