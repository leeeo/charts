// 0.8.1 phone-width polish: a 360-430px screen leaves 270-340px for a chart card.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderChart } from '../src/index.ts';
import { tw } from '../src/format.ts';

const vals = (html: string, cls: string): { x: number; s: string }[] =>
  [...html.matchAll(new RegExp(`<text class="lc-val ${cls}[^"]*"[^>]* x="([\\d.]+)"[^>]*>([^<]*)</text>`, 'g'))].map((m) => ({ x: Number(m[1]), s: m[2] as string }));

test('bar 0.8.1: stack totals on narrow columns are left out instead of running together', () => {
  const days = Array.from({ length: 17 }, (_, i) => `11/${i + 1}`);
  const spec = { type: 'bar', title: 't', stacked: true, unit: { suffix: '명' }, labels: days,
    series: [{ id: 'a', name: 'A', values: days.map((_, i) => i % 2) }, { id: 'b', name: 'B', values: days.map((_, i) => (i + 1) % 2) }] };
  assert.equal(vals(renderChart(spec, { width: 300 }), 'lc-val-sum').length, 0, '300px: 17 totals of "1명" do not fit');
  const wide = vals(renderChart(spec, { width: 1200 }), 'lc-val-sum');
  assert.equal(wide.length, 17, '1200px keeps every total');
  for (let i = 1; i < wide.length; i++) {
    const a = wide[i - 1] as { x: number; s: string }; const b = wide[i] as { x: number; s: string };
    assert.ok(b.x - a.x >= (tw(a.s, 11) + tw(b.s, 11)) / 2 * 1.06 + 4, 'totals keep a gap');
  }
});

test('bar 0.8.1: grouped bar values need a gap to their neighbour, or are left out', () => {
  const spec = { type: 'bar', title: 't', unit: { suffix: '건' }, labels: ['상상플레이', '레슨', '스톡위키', '어닝스'],
    series: [{ id: 'now', name: '이번 주', values: [420, 180, 95, null] }, { id: 'prev', name: '지난 주', values: [380, 210, 60, 0] }] };
  assert.equal(vals(renderChart(spec, { width: 340 }), '').length, 0);
  assert.ok(vals(renderChart(spec, { width: 720 }), '').length >= 7);
});

test('box 0.8.1: a group name that does not fit its slot wraps onto two lines instead of "상상…"', () => {
  const g = (id: string, label: string, base: number) => ({ id, label, values: [base, base + 1, base + 2, base + 3, base + 5] });
  const spec = { type: 'box', title: 't', groups: [g('a', '상상플레이', 3), g('b', '트레이딩', 1), g('c', '일정', 1), g('d', '웹', 2)] };
  const narrow = renderChart(spec, { width: 270 });
  assert.match(narrow, /<tspan x="[\d.]+">상상플<\/tspan><tspan x="[\d.]+" dy="13">레이<\/tspan>/);
  assert.ok(!narrow.includes('상상…'));
  assert.match(renderChart(spec, { width: 720 }), /<text class="lc-tick"[^>]*>상상플레이<\/text>/, 'wide: one line, as before');
});

test('calendar 0.8.1: weekday labels skip rows when a row is not 2px taller than the glyph', () => {
  const data = Array.from({ length: 150 }, (_, i) => ({ date: new Date(Date.UTC(2026, 5, 1) + i * 864e5).toISOString().slice(0, 10), value: i }));
  const weekdays = (html: string): string[] => [...html.matchAll(/<text class="lc-tick"[^>]*text-anchor="end">([월화수목금토일])<\/text>/g)].map((m) => m[1] as string);
  assert.deepEqual(weekdays(renderChart({ type: 'calendar', title: 't', data }, { width: 300 })), ['월', '수', '금', '일']);
  assert.equal(weekdays(renderChart({ type: 'calendar', title: 't', data }, { width: 720 })).length, 7);
});

test('histogram / marimekko 0.8.1: the tallest count label and the 100% tick stay inside the chart', () => {
  const h = renderChart({ type: 'histogram', title: 't', bins: [{ from: 0, to: 7, count: 15 }, { from: 7, to: 14, count: 8 }] }, { width: 300 });
  const bar = /<rect class="lc-mark lc-bin[^>]* y="([\d.]+)"/.exec(h);
  const label = /<text class="lc-cm-lbl[^>]* y="([\d.]+)"[^>]*>15<\/text>/.exec(h);
  assert.ok(bar && label);
  assert.ok(Number(label[1]) <= Number(bar[1]) - 4 && Number(label[1]) - 9 >= 0, 'count label sits above the bar, inside the svg');
  const m = renderChart({ type: 'marimekko', title: 't', labels: ['A', 'B'], series: [{ id: 'x', name: 'X', values: [1, 2] }, { id: 'y', name: 'Y', values: [2, 1] }] }, { width: 300 });
  const top = /<text class="lc-tick"[^>]* y="([\d.]+)"[^>]*>100%<\/text>/.exec(m);
  assert.ok(top && Number(top[1]) - 12 * 0.9 >= -0.5, '100% tick glyphs start inside the svg');
});
