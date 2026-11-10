import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ChartSpecError, renderChart } from '../src/index.ts';

const attr = (tag: string, name: string): number => Number(new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1]);
const nodes = (html: string): string[] => html.match(/<circle class="lc-mark lc-node[^>]*>/g) ?? [];
const node = (html: string, i: number): string => nodes(html).find((c) => attr(c, 'data-i') === i) ?? '';
const pathOf = (input: object): string => {
  try { renderChart(input); } catch (e) { assert.ok(e instanceof ChartSpecError); return e.path; }
  throw new Error('expected failure');
};
const spec = {
  type: 'tree', title: 't', width: 600,
  root: { id: 'r', label: 'R', value: 10, children: [
    { id: 'a', label: 'A', value: 6, children: [{ id: 'a1', label: 'A1', value: 4 }, { id: 'a2', label: 'A2', value: 2 }] },
    { id: 'b', label: 'B', value: null },
  ] },
};

test('tree: depth sets the column, leaves take rows in order, parents are centred on their children', () => {
  const html = renderChart(spec);
  assert.equal(nodes(html).length, 5);
  const [r, a, a1, a2, b] = [0, 1, 2, 3, 4].map((i) => node(html, i)) as string[];
  assert.ok(attr(r as string, 'cx') < attr(a as string, 'cx') && attr(a as string, 'cx') < attr(a1 as string, 'cx'));
  assert.equal(attr(a as string, 'cx'), attr(b as string, 'cx'), 'same depth, same column');
  assert.ok(attr(a1 as string, 'cy') < attr(a2 as string, 'cy') && attr(a2 as string, 'cy') < attr(b as string, 'cy'));
  assert.equal(attr(a as string, 'cy'), (attr(a1 as string, 'cy') + attr(a2 as string, 'cy')) / 2);
  assert.equal(attr(r as string, 'cy'), (attr(a as string, 'cy') + attr(b as string, 'cy')) / 2);
  assert.equal((html.match(/class="lc-tree-link"/g) ?? []).length, 4);
  assert.equal(attr(a1 as string, 'data-v'), 4);
});

test('tree: a null value is missing (hollow, no data-v), 데이터 없음 in the table, counted in the desc', () => {
  const html = renderChart(spec);
  const b = node(html, 4);
  assert.match(b, /lc-node-na/);
  assert.ok(!/data-v=/.test(b));
  assert.match(html, /<th scope="row">R › B<\/th><td>2<\/td><td class="lc-na">데이터 없음<\/td><td>0<\/td>/);
  assert.match(html, /<desc[^>]*>[^<]*트리[^<]*결측 1/);
});

test('tree: all-null values still draw the structure with every node missing; no values means no value column', () => {
  const html = renderChart({ type: 'tree', title: 't', root: { id: 'r', label: 'R', value: null, children: [{ id: 'a', label: 'A', value: null }] } });
  assert.equal((html.match(/lc-node-na/g) ?? []).length, 2);
  assert.match(html, /결측 2/);
  const plain = renderChart({ type: 'tree', title: 't', root: { id: 'r', label: 'R', children: [{ id: 'a', label: 'A' }] } });
  assert.ok(!plain.includes('lc-node-na') && !plain.includes('lc-na'));
  assert.ok(!plain.includes('<th scope="col">값</th>'));
});

test('tree: invalid specs throw ChartSpecError with the right path', () => {
  const ok = (root: unknown) => ({ type: 'tree', title: 't', root });
  assert.equal(pathOf(ok(undefined)), 'root');
  assert.equal(pathOf(ok({ id: 'r' })), 'root.label');
  assert.equal(pathOf(ok({ id: 'r', label: 'R', children: [] })), 'root.children');
  assert.equal(pathOf(ok({ id: 'r', label: 'R', children: [{ id: 'r', label: 'X' }] })), 'root.children[0].id');
  assert.equal(pathOf(ok({ id: 'r', label: 'R', value: 'x' })), 'root.value');
  assert.equal(pathOf(ok({ id: 'r', label: 'R', color: 'red;}' })), 'root.color');
  assert.equal(pathOf(ok({ id: 'r', label: 'R', extra: 1 })), 'root.extra');
  let deep: Record<string, unknown> = { id: 'n8', label: 'N' };
  for (let i = 7; i >= 0; i--) deep = { id: `n${i}`, label: 'N', children: [deep] };
  assert.equal(pathOf(ok(deep)), `root${'.children[0]'.repeat(7)}.children`);
});

test('tree: user text is escaped and nodes are focusable with labels', () => {
  const html = renderChart({ type: 'tree', title: '<b>', unit: { suffix: '명' }, root: { id: 'r', label: '앱 "A"', value: 1200, children: [
    { id: 'x', label: '<i>웹', value: 800, quality: '추정치' },
  ] } });
  assert.ok(!html.includes('<b>') && !html.includes('<i>'));
  assert.match(html, /<g class="lc-pt lc-pt-tree" tabindex="0" aria-label="&lt;i&gt;웹, 앱 &quot;A&quot;: 800명 · 추정치">/);
  assert.match(html, /aria-label="앱 &quot;A&quot;: 1,200명 · 하위 1개"/);
});
