import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ChartSpecError, renderChart } from '../src/index.ts';

const attr = (tag: string, name: string): string => new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1] ?? '';
const arcs = (html: string): string[] => html.match(/<path class="lc-mark lc-sb[^>]*>/g) ?? [];
const arc = (html: string, v: number): string => arcs(html).find((a) => Number(attr(a, 'data-v')) === v) ?? '';
/** Angle span (radians, clockwise from 12 o'clock) of an arc path drawn by arcPath, using its outer arc end points. */
const span = (tag: string, cx: number, cy: number): number => {
  const n = attr(tag, 'd').match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
  const ang = (x: number, y: number): number => (Math.atan2(x - cx, cy - y) + 2 * Math.PI) % (2 * Math.PI);
  const a0 = ang(n[0] as number, n[1] as number);
  const a1 = ang(n[7] as number, n[8] as number);
  return (a1 - a0 + 2 * Math.PI) % (2 * Math.PI);
};
const pathOf = (input: object): string => {
  try { renderChart(input); } catch (e) { assert.ok(e instanceof ChartSpecError); return e.path; }
  throw new Error('expected failure');
};

test('sunburst: angles are value shares; children split their parent and sit on the outer ring', () => {
  const html = renderChart({ type: 'sunburst', title: 't', width: 400, height: 400, items: [
    { id: 'a', label: 'A', children: [{ id: 'a1', label: 'A1', value: 50 }, { id: 'a2', label: 'A2', value: 25 }] },
    { id: 'b', label: 'B', value: 25 },
  ] });
  assert.equal(arcs(html).length, 4);
  assert.ok(Math.abs(span(arc(html, 75), 200, 200) - 1.5 * Math.PI) < 0.02, 'A = 75%');
  assert.ok(Math.abs(span(arc(html, 50), 200, 200) - Math.PI) < 0.02, 'A1 = 50%');
  assert.equal(attr(arc(html, 75), 'data-d'), '1');
  assert.equal(attr(arc(html, 50), 'data-d'), '2');
  assert.match(html, /class="lc-sb-ct"[^>]*>100</, 'total in the centre');
});

test('sunburst: a null leaf has no arc, is 데이터 없음 in the table and counted as missing', () => {
  const html = renderChart({ type: 'sunburst', title: 't', items: [
    { id: 'a', label: 'A', children: [{ id: 'a1', label: 'A1', value: 3 }, { id: 'a2', label: 'A2', value: null }] },
  ] });
  assert.equal(arcs(html).length, 2);
  assert.ok(!/data-v="(0|null)"/.test(html));
  assert.match(html, /<th scope="row">A › A2<\/th><td>2<\/td><td class="lc-na">데이터 없음<\/td>/);
  assert.match(html, /<desc[^>]*>[^<]*선버스트[^<]*결측 1/);
});

test('sunburst: all-null shows the empty state', () => {
  assert.match(renderChart({ type: 'sunburst', title: 't', items: [{ id: 'a', label: 'A', children: [{ id: 'b', label: 'B', value: null }] }] }), /class="lc-empty"/);
});

test('sunburst: invalid specs throw ChartSpecError with the right path', () => {
  const ok = (items: unknown[]) => ({ type: 'sunburst', title: 't', items });
  assert.equal(pathOf(ok([{ id: 'a', label: 'A', value: -1 }])), 'items[0].value');
  assert.equal(pathOf(ok([{ id: 'a', label: 'A' }])), 'items[0].value');
  assert.equal(pathOf(ok([{ id: 'a', label: 'A', value: 1, children: [{ id: 'b', label: 'B', value: 1 }] }])), 'items[0].value');
  assert.equal(pathOf(ok([{ id: 'a', label: 'A', children: [{ id: 'b', label: 'B', children: [{ id: 'c', label: 'C', children: [{ id: 'd', label: 'D', value: 1 }] }] }] }])), 'items[0].children[0].children[0].children');
  assert.equal(pathOf(ok([{ id: 'a', label: 'A', value: 1 }, { id: 'g', label: 'G', children: [{ id: 'a', label: 'B', value: 1 }] }])), 'items[1].children[0].id');
  assert.equal(pathOf(ok([{ id: 'a', label: 'A', value: 1, color: 'red;}' }])), 'items[0].color');
  assert.equal(pathOf({ ...ok([{ id: 'a', label: 'A', value: 1 }]), extra: 1 }), 'spec.extra');
  assert.equal(pathOf(ok([])), 'items');
});

test('sunburst: user text is escaped and arcs are focusable with labels', () => {
  const html = renderChart({ type: 'sunburst', title: '<b>', unit: { suffix: '원' }, items: [
    { id: 'g', label: '앱 "A"', quality: '추정치', children: [{ id: 'x', label: '<i>구독', value: 1200 }] },
    { id: 'y', label: '광고', value: 800 },
  ] });
  assert.ok(!html.includes('<b>') && !html.includes('<i>'));
  assert.match(html, /<g class="lc-pt lc-pt-sb" tabindex="0" aria-label="&lt;i&gt;구독, 앱 &quot;A&quot;: 1,200원 \(60%\) · 추정치">/);
  assert.match(html, /aria-label="광고: 800원 \(40%\)"/);
});

test('sunburst 0.8: names run along the arc, a leaf too short for its name gets an outside label with a leader', () => {
  const html = renderChart({ type: 'sunburst', title: 't', width: 400, height: 400, unit: { suffix: '건' }, items: [
    { id: 'a', label: 'A', children: [{ id: 'a1', label: '스토어 검색', value: 900 }, { id: 'a2', label: '웹 링크 유입', value: 20 }] },
    { id: 'b', label: 'B', value: 80 },
  ] });
  assert.match(html, /<text class="lc-sb-lbl lc-c1"><textPath href="#[^"]+" startOffset="50%" text-anchor="middle">스토어 검색<\/textPath><\/text>/);
  assert.match(html, /<text class="lc-sb-val lc-c1"><textPath [^>]*>900건<\/textPath><\/text>/, 'bold value on a second curved line');
  assert.match(html, /<text class="lc-sb-out lc-c1" x="[\d.]+" y="[\d.]+"( text-anchor="end")?><tspan x="[\d.]+">웹 링크 유입<\/tspan><tspan class="lc-sb-val" x="[\d.]+" dy="15">20건<\/tspan><\/text>/);
  assert.match(html, /<path class="lc-sb-lead" d="M/);
  assert.ok(!/<textPath[^>]*>[^<]*…<\/textPath>/.test(html), 'curved labels are never truncated');
  for (const a of arcs(html)) assert.match(a, /data-b="\d+"/, 'branch index for the hover rules');
  assert.equal(renderChart({ type: 'sunburst', title: 't', items: [{ id: 'a', label: 'A', value: 1 }] }).match(/<path id=/g)?.length, 2, 'name and value paths for one curved label');
});
