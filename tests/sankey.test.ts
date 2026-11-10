import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ChartSpecError, renderChart } from '../src/index.ts';

const attr = (tag: string, name: string): string => new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1] ?? '';
const links = (html: string): string[] => html.match(/<path class="lc-mark lc-link[^>]*>/g) ?? [];
const nodes = (html: string): string[] => html.match(/<rect class="lc-mark lc-node[^>]*>/g) ?? [];
/** Band thickness: distance between the two y values at the target end (the "L" segment). */
const thick = (tag: string): number => {
  const m = /C[^C]*? ([\d.]+),([\d.]+)L([\d.]+),([\d.]+)C/.exec(attr(tag, 'd'));
  return Number(m?.[4]) - Number(m?.[2]);
};
const pathOf = (input: object): string => {
  try { renderChart(input); } catch (e) { assert.ok(e instanceof ChartSpecError); return e.path; }
  throw new Error('expected failure');
};
const ns = [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }, { id: 'c', label: 'C' }, { id: 'd', label: 'D' }];

test('sankey: band thickness and node height are proportional to value; columns follow the longest path', () => {
  const html = renderChart({ type: 'sankey', title: 't', width: 600, height: 300, nodes: ns, links: [
    { source: 'a', target: 'b', value: 30 }, { source: 'a', target: 'c', value: 10 }, { source: 'b', target: 'c', value: 30 },
  ] });
  const l = links(html);
  assert.equal(l.length, 3);
  const [ab, ac] = l as [string, string];
  assert.ok(Math.abs(thick(ab) / thick(ac) - 3) < 0.01);
  const n = nodes(html);
  assert.equal(n.length, 3, 'isolated node d is not drawn');
  const byI = Object.fromEntries(n.map((t) => [attr(t, 'data-i'), t]));
  const x = (i: string): number => Number(attr(byI[i] as string, 'x'));
  const h = (i: string): number => Number(attr(byI[i] as string, 'height'));
  assert.ok(x('0') < x('1') && x('1') < x('2'), 'c sits after b because of a -> b -> c');
  assert.ok(Math.abs(h('0') - h('2')) < 0.01, 'a out 40 = c in 40');
  assert.ok(Math.abs(h('0') / h('1') - 40 / 30) < 0.01);
  assert.ok(Math.abs(h('0') - thick(ab) - thick(ac)) < 0.02, 'outgoing bands fill the source bar');
});

test('sankey: null link is missing, not drawn and not zero', () => {
  const html = renderChart({ type: 'sankey', title: 't', nodes: ns.slice(0, 3), links: [
    { source: 'a', target: 'b', value: 5 }, { source: 'a', target: 'c', value: null },
  ] });
  assert.equal(links(html).length, 1);
  assert.match(html, /<th scope="row">A → C<\/th><td class="lc-na">데이터 없음<\/td>/);
  assert.match(html, /<desc[^>]*>[^<]*생키 다이어그램[^<]*결측 1/);
  assert.ok(!html.includes('data-v="null"'));
});

test('sankey: all-null and all-zero show the empty state', () => {
  assert.match(renderChart({ type: 'sankey', title: 't', nodes: ns, links: [{ source: 'a', target: 'b', value: null }] }), /class="lc-empty"/);
  assert.match(renderChart({ type: 'sankey', title: 't', nodes: ns, links: [{ source: 'a', target: 'b', value: 0 }] }), /class="lc-empty"/);
});

test('sankey: cycles, unknown node ids and bad values are rejected with paths', () => {
  const s = (lk: unknown[]) => ({ type: 'sankey', title: 't', nodes: ns, links: lk });
  assert.equal(pathOf(s([{ source: 'a', target: 'b', value: 1 }, { source: 'b', target: 'c', value: 1 }, { source: 'c', target: 'a', value: 1 }])), 'links[2]');
  assert.equal(pathOf(s([{ source: 'a', target: 'a', value: 1 }])), 'links[0]');
  assert.equal(pathOf(s([{ source: 'x', target: 'a', value: 1 }])), 'links[0].source');
  assert.equal(pathOf(s([{ source: 'a', target: 'zz', value: 1 }])), 'links[0].target');
  assert.equal(pathOf(s([{ source: 'a', target: 'b', value: -2 }])), 'links[0].value');
  assert.equal(pathOf(s([{ source: 'a', target: 'b', value: 1, w: 1 }])), 'links[0].w');
  assert.equal(pathOf(s([])), 'links');
  assert.equal(pathOf({ ...s([{ source: 'a', target: 'b', value: 1 }]), nodes: [{ id: 'a', label: 'A' }, { id: 'a', label: 'B' }] }), 'nodes[1].id');
  try { renderChart(s([{ source: 'a', target: 'a', value: 1 }])); } catch (e) { assert.match((e as Error).message, /would create a cycle/); }
});

test('sankey: text is escaped; links and nodes are focusable and labelled', () => {
  const html = renderChart({ type: 'sankey', title: '<b>', unit: { suffix: '명' }, nodes: [{ id: 'a', label: '<i>검색' }, { id: 'b', label: '설치 "앱"' }, { id: 'c', label: '이탈' }], links: [
    { source: 'a', target: 'b', value: 1200, quality: '추정치' }, { source: 'a', target: 'c', value: 300 },
  ] });
  assert.ok(!html.includes('<b>') && !html.includes('<i>'));
  assert.match(html, /<g class="lc-pt lc-pt-link" tabindex="0" aria-label="&lt;i&gt;검색 → 설치 &quot;앱&quot;: 1,200명 \(80%\) · 추정치">/);
  assert.match(html, /<g class="lc-pt lc-pt-node" tabindex="0" aria-label="&lt;i&gt;검색: 유출 1,500명">/);
  assert.match(html, /aria-label="설치 &quot;앱&quot;: 유입 1,200명"/);
});
