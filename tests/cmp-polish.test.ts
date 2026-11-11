// 0.8 readability polish of the comparison / distribution / time types: labels beside the marks (name + bold tinted
// value), collision handling, hover attributes, and deterministic output.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ChartSpecError, renderChart, validateSpec } from '../src/index.ts';
import { examples } from '../examples/specs.ts';
import { spread } from '../src/charts/cmp.ts';

const FAMILY = ['waffle', 'segmented', 'funnel', 'gauge', 'bullet', 'slope', 'bump', 'stream', 'scatter', 'bubble', 'box', 'histogram', 'heatmap', 'calendar', 'lollipop', 'dumbbell', 'waterfall', 'pareto', 'marimekko', 'radar', 'parallel', 'ridgeline', 'beeswarm', 'combo', 'timeline'];
const attr = (tag: string, name: string): number => Number(new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1] ?? 'NaN');
const texts = (html: string, cls: string): string[] => html.match(new RegExp(`<text class="[^"]*\\b${cls}\\b[^"]*"[^>]*>.*?</text>`, 'g')) ?? [];
const layer = (html: string): string => /<g class="lc-cm-lbls"[^>]*>(.*?)<\/g>/s.exec(html)?.[1] ?? '';

test('cmp.spread: keeps the input order, separates blocks and stays inside the bounds', () => {
  const out = spread([50, 52, 54, 300], 20, 0, 320);
  assert.deepEqual(out.map(Math.round), [50, 72, 94, 300]);
  assert.deepEqual(spread([310, 318], 20, 0, 320).map(Math.round), [288, 310], 'pushed back inside the upper bound');
  assert.ok(out[0]! < out[1]! && out[1]! < out[2]!);
  const sizes = spread([10, 12], [20, 40], 0, 100, 4);
  assert.ok(sizes[1]! - sizes[0]! >= 20 / 2 + 40 / 2 + 4 - 1e-9);
  assert.ok(sizes[0]! >= 10);
});

test('segmented: every segment gets its name and bold share; narrow ones are pushed apart with a leader, never cut to one letter', () => {
  const html = renderChart({ type: 'segmented', title: 't', items: [{ id: 'a', label: '구독', value: 92 }, { id: 'b', label: '인앱 구매', value: 3 }, { id: 'c', label: '광고 수익', value: 5 }] }, { width: 480 });
  const lbl = layer(html);
  assert.equal((lbl.match(/<tspan class="lc-cm-val"/g) ?? []).length, 3);
  for (const name of ['구독', '인앱 구매', '광고 수익']) assert.ok(lbl.includes(`>${name}</tspan>`), `${name} stays whole`);
  assert.match(lbl, /class="lc-cm-lead"/);
  const off = renderChart({ type: 'segmented', title: 't', showLabels: false, items: [{ id: 'a', label: 'A', value: 1 }] });
  assert.ok(!off.includes('lc-cm-lbls'));
});

test('funnel: the bold value follows its bar and a tiny stage still draws a 3 px bar', () => {
  const html = renderChart({ type: 'funnel', title: 't', unit: { suffix: '명' }, stages: [{ id: 'a', label: '방문', value: 10000 }, { id: 'b', label: '결제', value: 1 }] }, { width: 480 });
  const bars = html.match(/<rect class="lc-mark lc-funnel[^>]*>/g) ?? [];
  assert.equal(bars.length, 2);
  assert.equal(attr(bars[1]!, 'width'), 3);
  const vals = texts(layer(html), 'lc-cm-val');
  assert.equal(vals.length, 2);
  assert.ok(attr(vals[1]!, 'x') > attr(bars[1]!, 'x') + 3, 'value sits right after the bar');
  assert.match(vals[0]!, />10,000명</);
});

test('gauge: the target is spelled out under the caption with the attainment, and the big value is tinted', () => {
  const spec = { type: 'gauge', title: 't', unit: { suffix: '만원' }, value: 212, max: 400, target: 300, label: '누적' };
  const html = renderChart(spec);
  assert.match(html, /class="lc-center-sub lc-gauge-lbl lc-gauge-tgt"[^>]*>목표 300만원 · 달성 70.7%</);
  assert.match(html, /class="lc-center lc-gauge-val lc-c1"/);
  const h = attr(/<svg[^>]*>/.exec(html)![0], 'height');
  const h0 = attr(/<svg[^>]*>/.exec(renderChart({ ...spec, target: undefined }))![0], 'height');
  assert.equal(h - h0, 16);
});

test('bullet: the bold value follows the bar and jumps past the target tick when the two would collide', () => {
  const html = renderChart({ type: 'bullet', title: 't', unit: { suffix: '%' }, max: 150, rows: [{ id: 'a', label: '방문', value: 98, target: 100 }, { id: 'b', label: '매출', value: 50, target: 100 }] }, { width: 640 });
  const vals = texts(layer(html), 'lc-cm-val');
  assert.equal(vals.length, 2);
  const ticks = html.match(/<line class="lc-bullet-target"[^>]*>/g) ?? [];
  assert.ok(attr(vals[0]!, 'x') > attr(ticks[0]!, 'x1'), '98% label moved past the 100% tick');
  const bars = html.match(/<rect class="lc-mark lc-bullet[^>]*>/g) ?? [];
  assert.ok(attr(vals[1]!, 'x') > attr(bars[1]!, 'x') + attr(bars[1]!, 'width'), '50% label right after its bar');
});

test('slope: wide = one line per label; narrow = name over value, headings pushed apart, names kept whole', () => {
  const spec = { type: 'slope', title: 't', unit: { suffix: '만원' }, startLabel: '2026년 2분기', endLabel: '2026년 3분기', items: [{ id: 'a', label: '상상플레이', start: 420, end: 610 }, { id: 'b', label: '스톡위키', start: 380, end: 355 }] };
  const wide = renderChart(spec, { width: 640 });
  assert.match(wide, /<text class="lc-cm-lbl lc-slope-label lc-c1"[^>]*>상상플레이 <tspan class="lc-cm-val">420만원<\/tspan><\/text>/);
  const narrow = renderChart(spec, { width: 300 });
  assert.match(narrow, /<tspan x="[^"]*">상상플레이<\/tspan><tspan class="lc-cm-val" x="[^"]*" dy="16">420만원<\/tspan>/);
  assert.ok(!narrow.includes('…'), 'no truncated names at 300 px');
  const heads = narrow.match(/<text class="lc-axis-title lc-slope-head"[^>]*>/g) ?? [];
  assert.ok(attr(heads[1]!, 'x') >= attr(heads[0]!, 'x') + 60, 'headings do not overlap');
});

test('bump: focus groups and end labels carry the series index for the hover highlight', () => {
  const html = renderChart({ type: 'bump', title: 't', labels: ['1', '2'], series: [{ id: 'a', name: 'A', values: [3, 1] }, { id: 'b', name: 'B', values: [1, 3] }] });
  assert.match(html, /<g class="lc-pt lc-pt-bump" tabindex="0" aria-label="[^"]*" data-s="1">/);
  assert.match(html, /<text class="lc-cm-lbl lc-bump-label" data-s="1"/);
});

test('stream: a layer tall enough carries its name inside the band; a thin one does not', () => {
  const html = renderChart({ type: 'stream', title: 't', labels: ['1', '2', '3'], series: [{ id: 'a', name: '검색', values: [100, 120, 110] }, { id: 'b', name: '기타', values: [1, 1, 1] }] });
  assert.match(html, /<text class="lc-stream-lbl lc-c1" data-s="0"[^>]*>검색</);
  assert.ok(!html.includes('>기타</text>'));
  assert.match(html, /<g class="lc-pt lc-pt-dot" tabindex="0" aria-label="[^"]*" data-s="0">/);
});

test('scatter / bubble: pointLabels is validated, on by default for bubbles, and names never cover another mark', () => {
  const pts = [{ x: 1, y: 1, size: 5, label: '키워드 A' }, { x: 2, y: 2, size: 9, label: '키워드 B' }];
  const bubble = renderChart({ type: 'bubble', title: 't', series: [{ id: 's', name: 'S', points: pts }] });
  assert.equal(texts(layer(bubble), 'lc-cm-lbl').length, 2);
  const scatter = renderChart({ type: 'scatter', title: 't', series: [{ id: 's', name: 'S', points: pts.map(({ x, y, label }) => ({ x, y, label })) }] });
  assert.ok(!scatter.includes('lc-cm-lbls'));
  const on = renderChart({ type: 'scatter', title: 't', pointLabels: true, series: [{ id: 's', name: 'S', points: pts.map(({ x, y, label }) => ({ x, y, label })) }] });
  assert.equal(texts(layer(on), 'lc-cm-lbl').length, 2);
  assert.throws(() => validateSpec({ type: 'scatter', title: 't', pointLabels: 'yes', series: [{ id: 's', name: 'S', points: [{ x: 1, y: 1 }] }] }), (e: unknown) => e instanceof ChartSpecError && e.path === 'pointLabels');
  // many bubbles on one spot: at most the ones with a free side get a name
  const crowd = Array.from({ length: 12 }, (_, i) => ({ x: 1, y: 1, size: 5, label: `p${i}` }));
  const crowded = renderChart({ type: 'bubble', title: 't', series: [{ id: 's', name: 'S', points: crowd }] });
  assert.ok(texts(layer(crowded), 'lc-cm-lbl').length <= 4);
  assert.match(bubble, /<g class="lc-pt lc-pt-point" tabindex="0" aria-label="[^"]*" data-s="0">/);
});

test('box / histogram: the median and the bin counts are written beside the marks', () => {
  const box = renderChart({ type: 'box', title: 't', groups: [{ id: 'a', label: 'A', values: [1, 2, 3, 4, 5] }] }, { width: 640 });
  assert.match(layer(box), /lc-cm-val lc-c1"[^>]*>3</);
  const hist = renderChart({ type: 'histogram', title: 't', bins: [{ from: 0, to: 1, count: 7 }, { from: 1, to: 2, count: 0 }] }, { width: 640 });
  assert.equal(texts(layer(hist), 'lc-cm-muted').length, 1, 'zero bins carry no count');
});

test('lollipop: negative values are labelled below the dot (vertical) or left of it (horizontal), never over the zero line', () => {
  const v = renderChart({ type: 'lollipop', title: 't', items: [{ id: 'a', label: 'A', value: 100 }, { id: 'b', label: 'B', value: -40 }] });
  const dots = v.match(/<circle class="lc-mark lc-lollipop[^>]*>/g) ?? [];
  const vals = texts(v, 'lc-lollipop-val');
  assert.ok(attr(vals[0]!, 'y') < attr(dots[0]!, 'cy'), 'positive label above');
  assert.ok(attr(vals[1]!, 'y') > attr(dots[1]!, 'cy'), 'negative label below');
  const h = renderChart({ type: 'lollipop', title: 't', horizontal: true, items: [{ id: 'a', label: 'A', value: 100 }, { id: 'b', label: 'B', value: -40 }] });
  const hd = h.match(/<circle class="lc-mark lc-lollipop[^>]*>/g) ?? [];
  const hv = texts(h, 'lc-lollipop-val');
  assert.ok(attr(hv[1]!, 'x') < attr(hd[1]!, 'cx'), 'negative label left of the dot');
});

test('waterfall / pareto: values are tinted bold at normal widths, small ink text on narrow columns, pareto values inside tall bars', () => {
  const wf = { type: 'waterfall', title: 't', startLabel: '시작', start: 100, steps: [{ id: 'a', label: '증가', value: 30 }, { id: 'b', label: '감소', value: -20 }, { id: 'c', label: '끝', kind: 'total' }] };
  assert.equal(texts(layer(renderChart(wf, { width: 640 })), 'lc-cm-val').length, 4);
  const narrow = renderChart({ ...wf, steps: Array.from({ length: 12 }, (_, i) => ({ id: `s${i}`, label: `s${i}`, value: i % 2 ? -5 : 7 })) }, { width: 300 });
  assert.ok(texts(layer(narrow), 'lc-cm-sm').length > 0);
  assert.ok(!layer(narrow).includes('lc-cm-val'));
  const pareto = renderChart({ type: 'pareto', title: 't', items: [{ id: 'a', label: 'A', value: 90 }, { id: 'b', label: 'B', value: 10 }] }, { width: 640 });
  assert.match(layer(pareto), /class="lc-cm-lbl lc-cm-val lc-pareto-in"[^>]*>90</);
  assert.match(layer(pareto), /lc-cm-muted"[^>]*>100%</);
  assert.match(pareto, /class="lc-pareto-guide-lbl"[^>]*text-anchor="end">80%</);
});

test('marimekko: a narrow, tall segment gets its name over its share instead of the share alone', () => {
  const html = renderChart({ type: 'marimekko', title: 't', labels: ['넓은 열', '좁은 열'], series: [{ id: 'a', name: '스토어', values: [900, 60] }, { id: 'b', name: '웹', values: [100, 40] }] }, { width: 640 });
  assert.match(html, /<tspan x="[^"]*">스토어<\/tspan><tspan x="[^"]*" dy="14">60%<\/tspan>/);
});

test('timeline: a name that does not fit its bar is written beside the bar when the gap is free', () => {
  const html = renderChart({ type: 'timeline', title: 't', axis: 'date', items: [
    { id: 'a', lane: 'L', label: '아주 긴 작업 이름입니다', start: '2026-10-01', end: '2026-10-02' },
    { id: 'b', lane: 'L', label: '짧게', start: '2026-12-01', end: '2026-12-20' },
  ] }, { width: 600 });
  assert.match(html, /<text class="lc-cm-lbl lc-tl-out" x="[^"]*" y="[^"]*">아주 긴 작업 이름입니다</);
  assert.match(html, /<text class="lc-tl-lbl" x="[^"]*" y="[^"]*">짧게</);
  const wrapped = renderChart({ type: 'timeline', title: 't', items: [{ id: 'a', lane: '매우 긴 레인 이름 두 줄', label: 'A', start: 0, end: 5 }, { id: 'b', lane: '매우 긴 레인 이름 두 줄', label: 'B', start: 1, end: 6 }] }, { width: 320 });
  assert.match(wrapped, /<text class="lc-tl-lane"[^>]*><tspan x="4">[^<]+<\/tspan><tspan x="4" dy="14">/);
});

test('parallel: headings wrap on narrow slots, and item names follow the last axis only above 420 px', () => {
  const spec = { type: 'parallel', title: 't', dimensions: [{ id: 'v', label: '방문자 수 (명)' }, { id: 'r', label: 'D7 리텐션 (%)' }, { id: 's', label: '매출 (만원)' }], items: [{ id: 'a', label: '상상플레이', values: [1, 2, 3] }, { id: 'b', label: '레슨', values: [2, 1, null] }] };
  const wide = renderChart(spec, { width: 720 });
  assert.match(wide, /<text class="lc-cm-lbl lc-par-name lc-c1"[^>]*>상상플레이</);
  assert.match(wide, /<text class="lc-cm-lbl lc-par-name lc-c2"[^>]*>레슨</, 'a line that stops early is named at its last axis');
  const narrow = renderChart(spec, { width: 240 });
  assert.ok(!narrow.includes('lc-par-name'));
  assert.match(narrow, /<text class="lc-par-head"[^>]*><tspan x="[^"]*">[^<]+<\/tspan><tspan x="[^"]*" dy="14">/);
});

test('radar: every series outline comes before the dots, and the dots carry the series index', () => {
  const html = renderChart({ type: 'radar', title: 't', axes: ['a', 'b', 'c'], series: [{ id: 'x', name: 'X', values: [1, 2, 3] }, { id: 'y', name: 'Y', values: [3, 2, 1] }] });
  const lastLine = html.lastIndexOf('lc-radar-line');
  const firstDot = html.indexOf('lc-radar-dots');
  assert.ok(lastLine < firstDot);
  assert.match(html, /<g class="lc-pt lc-pt-radar" tabindex="0" aria-label="[^"]*" data-s="1">/);
});

test('family B examples render deterministically at desktop and phone widths, with no inline style added', () => {
  for (const e of examples.filter((x) => FAMILY.includes((x.spec as { type: string }).type))) {
    for (const width of [341, 720]) {
      const a = renderChart(e.spec, { width });
      assert.equal(a, renderChart(e.spec, { width }), `${e.id} @${width}`);
      if (!JSON.stringify(e.spec).includes('"color"')) assert.ok(!a.includes(' style="'), `${e.id} @${width} has no inline style`);
    }
  }
});
