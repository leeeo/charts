import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ChartSpecError, renderChart } from '../src/index.ts';

const attr = (tag: string, name: string): number => Number(new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1]);
const rects = (html: string): string[] => html.match(/<rect class="lc-mark lc-tm[^>]*>/g) ?? [];
const area = (tag: string): number => attr(tag, 'width') * attr(tag, 'height');
const pathOf = (input: object): string => {
  try { renderChart(input); } catch (e) { assert.ok(e instanceof ChartSpecError); return e.path; }
  throw new Error('expected failure');
};

test('treemap: leaf areas are proportional to values and fill the viewBox', () => {
  const html = renderChart({ type: 'treemap', title: 't', width: 400, height: 200, items: [
    { id: 'a', label: 'A', value: 30 }, { id: 'b', label: 'B', value: 10 }, { id: 'c', label: 'C', value: 60 },
  ] });
  const r = rects(html);
  assert.equal(r.length, 3);
  const byV = Object.fromEntries(r.map((t) => [attr(t, 'data-v'), area(t)]));
  const total = 400 * 200;
  assert.ok(Math.abs((byV[30] as number) - total * 0.3) < 2);
  assert.ok(Math.abs((byV[10] as number) - total * 0.1) < 2);
  assert.ok(Math.abs((byV[60] as number) - total * 0.6) < 2);
  for (const t of r) {
    assert.ok(attr(t, 'x') >= 0 && attr(t, 'y') >= 0 && attr(t, 'x') + attr(t, 'width') <= 400.01 && attr(t, 'y') + attr(t, 'height') <= 200.01);
  }
});

test('treemap: groups nest children inside the group rect with proportional areas', () => {
  const html = renderChart({ type: 'treemap', title: 't', width: 300, height: 300, items: [
    { id: 'g', label: 'G', children: [{ id: 'g1', label: 'G1', value: 2 }, { id: 'g2', label: 'G2', value: 1 }] },
    { id: 'h', label: 'H', value: 3 },
  ] });
  const r = rects(html);
  assert.equal(r.length, 3);
  const g = /<rect class="lc-tm-group"[^>]*>/.exec(html)?.[0] ?? '';
  assert.ok(Math.abs(area(g) - 45000) < 2, 'group gets half the area');
  const [g1, g2] = r.filter((t) => attr(t, 'data-v') !== 3);
  assert.ok(Math.abs(area(g1 as string) / area(g2 as string) - 2) < 0.01);
  for (const t of [g1, g2] as string[]) {
    assert.ok(attr(t, 'x') >= attr(g, 'x') - 0.01 && attr(t, 'x') + attr(t, 'width') <= attr(g, 'x') + attr(g, 'width') + 0.01);
  }
  assert.match(html, /class="lc-legend"/);
});

test('treemap: null leaf gets no area, is listed as missing and counted in the desc', () => {
  const html = renderChart({ type: 'treemap', title: 't', items: [{ id: 'a', label: 'A', value: 3 }, { id: 'b', label: 'B', value: null }] });
  assert.equal(rects(html).length, 1);
  assert.ok(!/data-v="0"/.test(html) && !/data-v="null"/.test(html));
  assert.match(html, /<th scope="row">B<\/th><td class="lc-na">데이터 없음<\/td>/);
  assert.match(html, /<desc[^>]*>[^<]*트리맵[^<]*결측 1/);
});

test('treemap: empty and all-null show the empty state', () => {
  assert.match(renderChart({ type: 'treemap', title: 't', items: [{ id: 'a', label: 'A', value: null }] }), /class="lc-empty"/);
  assert.match(renderChart({ type: 'treemap', title: 't', items: [{ id: 'g', label: 'G', children: [{ id: 'a', label: 'A', value: null }] }] }), /class="lc-empty"/);
});

test('treemap: invalid specs throw ChartSpecError with the right path', () => {
  const ok = (items: unknown[]) => ({ type: 'treemap', title: 't', items });
  assert.equal(pathOf(ok([{ id: 'a', label: 'A', value: -1 }])), 'items[0].value');
  assert.equal(pathOf(ok([{ id: 'a', label: 'A' }])), 'items[0].value');
  assert.equal(pathOf(ok([{ id: 'a', label: 'A', children: [] }])), 'items[0].children');
  assert.equal(pathOf(ok([{ id: 'a', label: 'A', value: 1, children: [{ id: 'b', label: 'B', value: 1 }] }])), 'items[0].value');
  assert.equal(pathOf(ok([{ id: 'a', label: 'A', children: [{ id: 'b', label: 'B', value: 1, children: [] }] }])), 'items[0].children[0].children');
  assert.equal(pathOf(ok([{ id: 'a', label: 'A', value: 1 }, { id: 'g', label: 'G', children: [{ id: 'a', label: 'B', value: 1 }] }])), 'items[1].children[0].id');
  assert.equal(pathOf(ok([{ id: 'a', label: 'A', value: 1, color: 'red;}' }])), 'items[0].color');
  assert.equal(pathOf({ ...ok([{ id: 'a', label: 'A', value: 1 }]), extra: 1 }), 'spec.extra');
  assert.equal(pathOf(ok([])), 'items');
});

test('treemap: user text is escaped and marks are focusable with labels', () => {
  const html = renderChart({ type: 'treemap', title: '<b>', unit: { suffix: '명' }, items: [
    { id: 'g', label: '앱 "A"', quality: '추정치', children: [{ id: 'x', label: '<i>방문', value: 1200 }] },
    { id: 'y', label: '설치', value: 800 },
  ] });
  assert.ok(!html.includes('<b>') && !html.includes('<i>'));
  assert.ok(html.includes('&lt;i&gt;방문'));
  assert.match(html, /<g class="lc-pt lc-pt-tm" tabindex="0" aria-label="&lt;i&gt;방문, 앱 &quot;A&quot;: 1,200명 \(60%\) · 추정치">/);
  assert.match(html, /aria-label="설치: 800명 \(40%\)"/);
});

test('treemap 0.8: group header strip, cell value with share, cells grouped for hover', () => {
  const html = renderChart({ type: 'treemap', title: 't', width: 600, height: 300, unit: { suffix: '원' }, items: [
    { id: 'g', label: '앱', children: [{ id: 'g1', label: '구독', value: 600 }, { id: 'g2', label: '광고', value: 200 }] },
    { id: 'h', label: '기타', value: 200 },
  ] });
  assert.match(html, /<rect class="lc-tm-head"/);
  assert.match(html, /<text class="lc-tm-glbl"[^>]*>앱<tspan class="lc-tm-gval" dx="6">800원<\/tspan><\/text>/);
  assert.match(html, /<text class="lc-tm-val"[^>]*>600원 · 60%<\/text>/);
  assert.equal((html.match(/<g class="lc-tm-g">/g) ?? []).length, 2, 'one group per top-level item');
  const head = /<rect class="lc-tm-head"[^>]*height="([\d.]+)"/.exec(html);
  const cell = /<rect class="lc-mark lc-tm[^>]*data-v="600"[^>]*y="([\d.]+)"/.exec(html);
  assert.ok(Number(cell?.[1]) >= Number(head?.[1]), 'cells start below the header strip');
});
