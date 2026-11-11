import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ChartSpecError, renderChart } from '../src/index.ts';
import { columns } from '../src/charts/sankey.ts';

const attr = (tag: string, name: string): string => new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1] ?? '';
const nodeTag = (html: string, i: number): string => (html.match(new RegExp(`<rect class="lc-mark lc-node[^>]*data-i="${i}"[^>]*>`)) ?? [''])[0];
const pathOf = (input: object): string => {
  try { renderChart(input); } catch (e) { assert.ok(e instanceof ChartSpecError); return e.path; }
  throw new Error('expected failure');
};

// Loss case shaped like a real income flow: revenue splits into costs and operating income; operating income, an
// after-tax gain and the net-loss balance all leave as a non-operating loss.
const loss = {
  type: 'sankey', title: 'flow', width: 720, height: 300, align: 'justify', relax: true, computedNote: '공시 수치 간 차액',
  nodes: [
    { id: 'rev', label: '매출', tone: 'revenue' },
    { id: 'tax', label: '세후 순증가', tone: 'profit', computed: true },
    { id: 'net', label: '순손실', tone: 'cost' },
    { id: 'op', label: '영업이익', tone: 'profit' },
    { id: 'cost', label: '영업비용 등 순차액', tone: 'cost', computed: true },
    { id: 'nonop', label: '영업외 순감소', tone: 'cost', computed: true },
  ],
  links: [
    { source: 'rev', target: 'cost', value: 1009.11 },
    { source: 'rev', target: 'op', value: 96.01, tone: 'profit' },
    { source: 'op', target: 'nonop', value: 96.01 },
    { source: 'tax', target: 'nonop', value: 40.66 },
    { source: 'net', target: 'nonop', value: 103.26 },
  ],
};

test('sankey tones: classes by meaning, explicit link tone wins, cost marks are hatched, legend in words', () => {
  const html = renderChart(loss);
  assert.match(nodeTag(html, 0), /lc-tone-revenue"/);
  assert.match(nodeTag(html, 4), /lc-tone-cost"/);
  const links = html.match(/<path class="lc-mark lc-link[^>]*>/g) ?? [];
  assert.match(links[0] as string, /lc-tone-revenue"/, 'link follows its source tone');
  assert.match(links[1] as string, /lc-tone-profit"/, 'explicit link tone');
  assert.ok(!/style=/.test(html), 'tones need no style attribute (CSP style-src-attr)');
  assert.match(html, /<pattern id="[^"]+-hatch"/);
  assert.equal((html.match(/class="lc-sk-hatch"/g) ?? []).length, 3 + 1, 'three cost nodes and the net-loss link');
  const legend = /<ul class="lc-legend lc-sk-legend">.*?<\/ul>/.exec(html)?.[0] ?? '';
  assert.match(legend, /매출/);
  assert.match(legend, /이익/);
  assert.match(legend, /비용·손실 \(빗금\)/);
  assert.match(legend, /\* 공시 수치 간 차액/);
  assert.match(html, />영업비용 등 순차액\* /, 'computed nodes carry *');
  assert.match(html, /aria-label="영업비용 등 순차액\*: [^"]*비용·손실 · 공시 수치 간 차액/);
});

test('sankey justify: end nodes go to the last column; default keeps the longest-path columns', () => {
  const ls = [{ s: 0, t: 1 }, { s: 0, t: 2 }, { s: 2, t: 3 }];
  assert.deepEqual(columns(4, ls), [0, 1, 1, 2]);
  assert.deepEqual(columns(4, ls, true), [0, 2, 1, 2]);
  const html = renderChart(loss);
  assert.equal(attr(nodeTag(html, 4), 'x'), attr(nodeTag(html, 5), 'x'), 'costs share the last column');
});

test('sankey relax: input order kept top to bottom, the operating-income band runs straight', () => {
  const html = renderChart(loss);
  const y = (i: number): number => Number(attr(nodeTag(html, i), 'y'));
  const h = (i: number): number => Number(attr(nodeTag(html, i), 'height'));
  assert.ok(y(0) < y(1) && y(1) < y(2), 'column 0 keeps the spec order');
  assert.ok(y(4) < y(5), 'costs above the non-operating loss');
  // revenue's operating-income band sits at the bottom of revenue (targets sorted by position)
  const opBandTop = y(0) + h(0) - h(3);
  assert.ok(Math.abs(y(3) - opBandTop) < 1, `operating income aligned with its band (${y(3)} vs ${opBandTop})`);
  for (const i of [0, 1, 2, 3, 4, 5]) assert.ok(y(i) >= 0 && y(i) + h(i) <= 300 + 0.01, `node ${i} inside the viewBox`);
});

test('sankey without new options renders as before (no legend, palette classes)', () => {
  const html = renderChart({ type: 'sankey', title: 't', nodes: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }], links: [{ source: 'a', target: 'b', value: 1 }] });
  assert.ok(!html.includes('lc-sk-legend'));
  assert.ok(!html.includes('lc-tone-'));
  assert.ok(!html.includes('<pattern'));
  assert.match(html, /lc-c1"/);
});

test('sankey new options are validated', () => {
  const n = [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }];
  const l = [{ source: 'a', target: 'b', value: 1 }];
  assert.equal(pathOf({ type: 'sankey', title: 't', nodes: [{ id: 'a', label: 'A', tone: 'gold' }, n[1]], links: l }), 'nodes[0].tone');
  assert.equal(pathOf({ type: 'sankey', title: 't', nodes: [{ id: 'a', label: 'A', computed: 'yes' }, n[1]], links: l }), 'nodes[0].computed');
  assert.equal(pathOf({ type: 'sankey', title: 't', nodes: n, links: [{ ...l[0], tone: 'x' }] }), 'links[0].tone');
  assert.equal(pathOf({ type: 'sankey', title: 't', nodes: n, links: l, align: 'center' }), 'align');
  assert.equal(pathOf({ type: 'sankey', title: 't', nodes: n, links: l, relax: 1 }), 'relax');
  assert.equal(pathOf({ type: 'sankey', title: 't', nodes: [{ id: 'a', label: 'A', color: 'url(x)' }, n[1]], links: l }), 'nodes[0].color');
});
