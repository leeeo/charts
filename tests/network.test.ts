import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ChartSpecError, renderChart, validateSpec } from '../src/index.ts';

const attr = (tag: string, name: string): number => Number(new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1] ?? 'NaN');
const pathOf = (spec: unknown): string => {
  try { validateSpec(spec); } catch (e) { if (e instanceof ChartSpecError) return e.path; throw e; }
  return '';
};
const links = (html: string): string[] => html.match(/<path class="lc-mark lc-nlink[^>]*>/g) ?? [];
const nodes = (html: string): string[] => html.match(/<circle class="lc-mark lc-nnode[^>]*>/g) ?? [];
const spec = (ls: { source: string; target: string; value: number | null }[], extra: object = {}) => ({
  type: 'network', title: 't', width: 640, height: 480,
  nodes: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }, { id: 'c', label: 'C' }, { id: 'd', label: 'D' }],
  links: ls, ...extra,
});

test('network: nodes sit on one circle, link width and node size follow the weights', () => {
  const html = renderChart(spec([{ source: 'a', target: 'b', value: 10 }, { source: 'b', target: 'c', value: 40 }, { source: 'c', target: 'd', value: 20 }]));
  const ns = nodes(html);
  assert.equal(ns.length, 4);
  const d = ns.map((n) => Math.hypot(attr(n, 'cx') - 320, attr(n, 'cy') - 240));
  for (const x of d) assert.ok(Math.abs(x - d[0]!) < 0.05, 'equal distance from the centre');
  const ls = links(html);
  assert.equal(ls.length, 3);
  const w = (v: number): number => attr(ls.find((x) => attr(x, 'data-v') === v)!, 'stroke-width');
  assert.equal(w(40), 8);
  assert.ok(Math.abs((w(10) - 1) / (w(40) - 1) - 0.25) < 0.01, 'width - 1 is proportional to the weight');
  const r = (i: number): number => attr(ns.find((x) => attr(x, 'data-i') === i)!, 'r');
  assert.ok(r(2) > r(1) && r(1) > r(0), 'C (60) > B (50) > A (10)');
  assert.ok(!/style="(?!--c:)/.test(html), 'no inline style except --c');
  assert.equal(renderChart(spec([{ source: 'a', target: 'b', value: 10 }])), renderChart(spec([{ source: 'a', target: 'b', value: 10 }])), 'deterministic');
});

test('network: directed links get arrowheads and A→B / B→A take different paths', () => {
  const html = renderChart(spec([{ source: 'a', target: 'b', value: 5 }, { source: 'b', target: 'a', value: 5 }], { directed: true }));
  const ls = links(html);
  assert.equal(ls.length, 2);
  assert.notEqual(/ d="([^"]*)"/.exec(ls[0]!)?.[1], / d="([^"]*)"/.exec(ls[1]!)?.[1]);
  assert.equal((html.match(/class="lc-narrow /g) ?? []).length, 2);
  assert.match(html, /aria-label="A → B: 5"/);
});

test('network: a null weight is a dashed link, not a 0 link; the table shows 데이터 없음', () => {
  const html = renderChart(spec([{ source: 'a', target: 'b', value: 3 }, { source: 'c', target: 'd', value: null }]));
  assert.equal(links(html).length, 1);
  assert.match(html, /<path class="lc-nlink-na" data-i="1"/);
  assert.match(html, /<th scope="row">C<\/th><td>D<\/td><td class="lc-na">데이터 없음<\/td>/);
  assert.match(html, /결측 1\./);
  assert.match(html, /aria-label="C – D: 데이터 없음"/);
});

test('network: no links or all-null weights render the empty state', () => {
  assert.match(renderChart(spec([])), /class="lc-empty"/);
  const html = renderChart(spec([{ source: 'a', target: 'b', value: null }]));
  assert.match(html, /class="lc-empty"/);
  assert.equal(nodes(html).length, 0);
});

test('network: invalid specs throw ChartSpecError with the right path', () => {
  assert.equal(pathOf(spec([{ source: 'a', target: 'zz', value: 1 }])), 'links[0].target');
  assert.equal(pathOf(spec([{ source: 'q', target: 'a', value: 1 }])), 'links[0].source');
  assert.equal(pathOf(spec([{ source: 'a', target: 'a', value: 1 }])), 'links[0].target');
  assert.equal(pathOf(spec([{ source: 'a', target: 'b', value: 1 }, { source: 'b', target: 'a', value: 2 }])), 'links[1]');
  assert.equal(pathOf(spec([{ source: 'a', target: 'b', value: 1 }, { source: 'b', target: 'a', value: 2 }], { directed: true })), '');
  assert.equal(pathOf(spec([{ source: 'a', target: 'b', value: -1 }])), 'links[0].value');
  assert.equal(pathOf({ ...spec([]), nodes: [{ id: 'a', label: 'A' }, { id: 'a', label: 'B' }] }), 'nodes[1].id');
  assert.equal(pathOf({ ...spec([]), nodes: [{ id: 'a', label: 'A', color: 'red;x' }] }), 'nodes[0].color');
  assert.equal(pathOf(spec([], { layout: 'force' })), 'spec.layout');
  assert.equal(pathOf({ ...spec([]), links: {} }), 'links');
});

test('network: user text is escaped, nodes and links are focusable with labels, groups make a legend', () => {
  const html = renderChart({
    ...spec([{ source: 'a', target: 'b', value: 1200 }]), unit: { suffix: '명' },
    nodes: [{ id: 'a', label: '<앱>', group: '게임' }, { id: 'b', label: '"B"', group: '금융', quality: '추정' }],
  });
  assert.ok(!html.includes('<앱>'));
  assert.match(html, /<g class="lc-pt lc-pt-nlink" tabindex="0" aria-label="&lt;앱&gt; – &quot;B&quot;: 1,200명">/);
  assert.match(html, /<g class="lc-pt lc-pt-nnode" tabindex="0" aria-label="&quot;B&quot;, 금융: 연결 1개 · 가중 합계 1,200명 · 추정">/);
  assert.match(html, /<ul class="lc-legend"><li><span class="lc-sw lc-c1"><\/span><span class="lc-ln">게임/);
});
