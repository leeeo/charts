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

// Funnel whose spec order (subscribe above churn) makes the install -> churn band cross trial -> subscribe.
const funnel = (order?: 'auto' | 'input') => ({
  type: 'sankey', title: 't', width: 720, height: 300, ...(order ? { order } : {}),
  nodes: [{ id: 'a', label: 'A' }, { id: 'i', label: 'I' }, { id: 't', label: 'T' }, { id: 's', label: 'S' }, { id: 'c', label: 'C' }],
  links: [
    { source: 'a', target: 'i', value: 100 }, { source: 'i', target: 't', value: 55 }, { source: 'i', target: 'c', value: 45 },
    { source: 't', target: 's', value: 12 }, { source: 't', target: 'c', value: 43 },
  ],
});

test('sankey order: auto reorders a column only to remove crossings; input keeps the spec order', () => {
  const y = (html: string, i: number): number => Number(attr(nodes(html).find((t) => attr(t, 'data-i') === String(i)) as string, 'y'));
  const auto = renderChart(funnel());
  assert.ok(y(auto, 4) < y(auto, 3), 'churn moves above subscribe so the bands do not cross');
  const input = renderChart(funnel('input'));
  assert.ok(y(input, 3) < y(input, 4), 'order: input keeps subscribe above churn');
  const plain = { type: 'sankey', title: 't', nodes: ns.slice(0, 3), links: [{ source: 'a', target: 'b', value: 2 }, { source: 'a', target: 'c', value: 1 }] };
  const noId = (html: string): string => html.replace(/lc-[a-z0-9]{6}(?=[-"\s])/g, 'ID'); // per-render figure id
  assert.equal(noId(renderChart(plain)), noId(renderChart({ ...plain, order: 'input' })), 'no crossing: auto equals input');
  assert.equal(pathOf({ ...plain, order: 'random' }), 'order');
});

test('sankey labels: outside the bands, name then value, hover hooks on bands', () => {
  const html = renderChart(funnel());
  const n = nodes(html);
  const first = n.find((t) => attr(t, 'data-i') === '0') as string;
  const last = n.find((t) => attr(t, 'data-i') === '4') as string;
  const lbl = (name: string): string => (new RegExp(`<text class="lc-node-lbl[^>]*>(?:(?!</text>).)*>${name}</tspan>`).exec(html) ?? [''])[0];
  assert.match(lbl('A'), /text-anchor="end"/, 'first column label is left of the bar');
  assert.ok(Number(attr(lbl('A'), 'x')) < Number(attr(first, 'x')));
  assert.ok(Number(attr(lbl('C'), 'x')) > Number(attr(last, 'x')) + Number(attr(last, 'width')), 'last column label is right of the bar');
  assert.match(html, /<tspan x="[\d.]+">A<\/tspan><tspan class="lc-node-val" x="[\d.]+" dy="16">100<\/tspan>/);
  for (const l of links(html)) assert.match(l, /data-s="\d+" data-t="\d+"/);
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

test('sankey 0.8: a middle-column name splits into halves of two or more letters (a trailing * is not a letter)', () => {
  const html = renderChart({ type: 'sankey', title: 't', width: 240, height: 220, unit: { suffix: '억' }, computedNote: 'n', nodes: [
    { id: 'rev', label: '매출' }, { id: 'op', label: '영업이익', computed: true }, { id: 'sga', label: '판매관리비' }, { id: 'net', label: '순이익' }, { id: 'tax', label: '법인세' },
  ], links: [{ source: 'rev', target: 'op', value: 40 }, { source: 'rev', target: 'sga', value: 60 }, { source: 'op', target: 'net', value: 30 }, { source: 'op', target: 'tax', value: 10 }] });
  assert.match(html, /<tspan x="[\d.]+">영업<\/tspan><tspan x="[\d.]+" dy="15">이익\*<\/tspan>/);
  assert.match(html, /<tspan x="[\d.]+">판매<\/tspan><tspan x="[\d.]+" dy="15">관리비<\/tspan>/);
  assert.ok(!/<tspan[^>]*>.\*?<\/tspan>/.test(html), 'no one-letter line');
});

// 0.8.1: at phone widths (a 390px screen leaves ~340px for the chart) a 4-column flow used to put a middle label on top
// of the next column's label or bar. Label blocks are estimated the way the renderer sizes them (tw, CJK = 1em).
test('sankey 0.8.1: at 320-360px no node label meets another label or a bar', async () => {
  const { tw } = await import('../src/format.ts');
  const income = { type: 'sankey', title: 't', unit: { suffix: '억' }, relax: true, nodes: [
    { id: 'revenue', label: '매출', tone: 'revenue' }, { id: 'gross', label: '매출총이익', tone: 'profit', computed: true },
    { id: 'cogs', label: '매출원가', tone: 'cost' }, { id: 'op', label: '영업이익', tone: 'profit', computed: true },
    { id: 'sga', label: '판매관리비', tone: 'cost' }, { id: 'net', label: '순이익', tone: 'profit', computed: true }, { id: 'tax', label: '법인세 등', tone: 'cost' },
  ], links: [
    { source: 'revenue', target: 'gross', value: 420 }, { source: 'revenue', target: 'cogs', value: 580 }, { source: 'gross', target: 'op', value: 150 },
    { source: 'gross', target: 'sga', value: 270 }, { source: 'op', target: 'net', value: 110 }, { source: 'op', target: 'tax', value: 40 },
  ] };
  for (const width of [320, 340, 360]) {
    const html = renderChart(income, { width });
    const boxes = [...html.matchAll(/<text class="lc-node-lbl[^>]* x="([\d.]+)" y="([\d.]+)"( text-anchor="(end|middle)")?>(.*?)<\/text>/g)].map((m) => {
      const lines = [...(m[5] as string).matchAll(/<tspan[^>]*>([^<]*)<\/tspan>/g)].map((s) => s[1] as string);
      const val = lines.pop() as string;
      const w = Math.max(...lines.map((s) => tw(s, 12)), tw(val, 13) * 1.06);
      const x = Number(m[1]); const left = m[4] === 'end' ? x - w : m[4] === 'middle' ? x - w / 2 : x;
      const top = Number(m[2]) - 12;
      return { s: lines.join(''), b: [left, top, left + w, top + 31 + 15 * (lines.length - 1)] };
    });
    assert.equal(boxes.length, 7, `${width}: every node is labelled`);
    const bars = nodes(html).map((r) => { const x = Number(attr(r, 'x')); const y = Number(attr(r, 'y')); return [x, y, x + 12, y + Number(attr(r, 'height'))]; });
    const meet = (a: number[], b: number[]): boolean => Math.min(a[2] as number, b[2] as number) - Math.max(a[0] as number, b[0] as number) > 0.5 && Math.min(a[3] as number, b[3] as number) - Math.max(a[1] as number, b[1] as number) > 0.5;
    boxes.forEach((a, i) => boxes.slice(i + 1).forEach((b) => assert.ok(!meet(a.b, b.b), `${width}: ${a.s} meets ${b.s}`)));
    for (const a of boxes) assert.equal(bars.filter((r) => meet(a.b, r)).length, 0, `${width}: ${a.s} sits on a bar`);
  }
});
