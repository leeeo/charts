import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ChartSpecError, renderChart, validateSpec } from '../src/index.ts';

const cells = (html: string): string[] => html.match(/<rect class="lc-mark lc-cell[^>]*>/g) ?? [];
const attr = (tag: string, name: string): number => Number(new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1] ?? 'NaN');
const count = (html: string, i: number): number => cells(html).filter((c) => attr(c, 'data-i') === i).length;
const isErr = (path: string) => (e: unknown): boolean => e instanceof ChartSpecError && e.path === path;

test('waffle: 100 cells split by largest remainder, one cell = 1%', () => {
  const html = renderChart({ type: 'waffle', title: 't', unit: { suffix: '명' }, items: [
    { id: 'a', label: 'A', value: 1 }, { id: 'b', label: 'B', value: 1 }, { id: 'c', label: 'C', value: 1 },
  ] });
  assert.equal(cells(html).length, 100);
  assert.deepEqual([count(html, 0), count(html, 1), count(html, 2)], [34, 33, 33]);
  const html2 = renderChart({ type: 'waffle', title: 't', items: [{ id: 'a', label: 'A', value: 750 }, { id: 'b', label: 'B', value: 250 }] });
  assert.deepEqual([count(html2, 0), count(html2, 1)], [75, 25]);
  const first = cells(html2)[0] as string; const eleventh = cells(html2)[10] as string;
  assert.ok(attr(eleventh, 'y') > attr(first, 'y') && Math.abs(attr(eleventh, 'x') - attr(first, 'x')) < 0.01, '10 cells per row');
  assert.match(html2, /<th scope="row">A<\/th><td>750<\/td><td>75%<\/td><td>75<\/td>/);
});

test('waffle: cellValue sets the unit per cell and the number of rows', () => {
  const html = renderChart({ type: 'waffle', title: 't', cellValue: 100, items: [{ id: 'a', label: 'A', value: 1200 }, { id: 'b', label: 'B', value: 340 }] });
  assert.deepEqual([count(html, 0), count(html, 1)], [12, 3]);
  assert.match(html, /1칸 = 100/);
  assert.throws(() => validateSpec({ type: 'waffle', title: 't', cellValue: 1, items: [{ id: 'a', label: 'A', value: 5000 }] }), isErr('cellValue'));
});

test('waffle: a null category gets no cells, is not zero, and is counted as missing', () => {
  const html = renderChart({ type: 'waffle', title: 't', items: [{ id: 'a', label: 'A', value: 40 }, { id: 'b', label: 'B', value: null }, { id: 'c', label: 'C', value: 60 }] });
  assert.equal(count(html, 1), 0);
  assert.deepEqual([count(html, 0), count(html, 2)], [40, 60]);
  assert.match(html, /<th scope="row">B<\/th><td class="lc-na">데이터 없음<\/td>/);
  assert.match(html, /결측 1/);
});

test('waffle: all-null or zero-total data shows the empty state', () => {
  for (const v of [null, 0]) {
    const html = renderChart({ type: 'waffle', title: 't', items: [{ id: 'a', label: 'A', value: v }] });
    assert.match(html, /class="lc-empty"/);
    assert.equal(cells(html).length, 0);
  }
});

test('waffle: invalid specs fail on the right path', () => {
  assert.throws(() => validateSpec({ type: 'waffle', title: 't', items: [] }), isErr('items'));
  assert.throws(() => validateSpec({ type: 'waffle', title: 't', items: [{ id: 'a', label: 'A', value: -1 }] }), isErr('items[0].value'));
  assert.throws(() => validateSpec({ type: 'waffle', title: 't', items: [{ id: 'a', label: 'A', value: 1, color: 'red;x' }] }), isErr('items[0].color'));
  assert.throws(() => validateSpec({ type: 'waffle', title: 't', items: [{ id: 'a', label: 'A', value: 1 }], cellValue: 0 }), isErr('cellValue'));
  assert.throws(() => validateSpec({ type: 'waffle', title: 't', items: [{ id: 'a', label: 'A', value: 1 }], rows: 3 }), isErr('spec.rows'));
});

test('waffle: user text is escaped and each category is one focusable, labelled group', () => {
  const html = renderChart({ type: 'waffle', title: '<b>', unit: { suffix: '명' }, items: [{ id: 'a', label: '<x>&', value: 1200, quality: '추정치' }, { id: 'b', label: 'B', value: 800 }] });
  assert.ok(!html.includes('<x>') && !html.includes('<b>'));
  assert.match(html, /<g class="lc-pt lc-pt-waffle" tabindex="0" aria-label="&lt;x&gt;&amp;: 1,200명 \(60%\) · 추정치">/);
  assert.equal((html.match(/tabindex="0"/g) ?? []).length, 2);
});
