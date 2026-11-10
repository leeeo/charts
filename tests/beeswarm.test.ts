import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ChartSpecError, renderChart, validateSpec } from '../src/index.ts';

const attr = (tag: string, name: string): number => Number(new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1] ?? 'NaN');
const pathOf = (spec: unknown): string => {
  try { validateSpec(spec); } catch (e) { if (e instanceof ChartSpecError) return e.path; throw e; }
  return '';
};
import { swarm } from '../src/charts/beeswarm.ts';

const dots = (html: string): string[] => html.match(/<circle class="lc-mark lc-swarm-dot[^>]*>/g) ?? [];
const spec = (groups: object[], extra: object = {}) => ({ type: 'beeswarm', title: 't', groups, ...extra });

test('beeswarm: x is linear in value and dots never overlap', () => {
  const vals = [10, 10, 10, 10, 11, 12, 12, 20, 30, 30];
  const html = renderChart(spec([{ id: 'a', label: 'A', values: vals }]), { width: 640 });
  const d = dots(html);
  assert.equal(d.length, vals.length);
  const at = (v: number): number => attr(d.find((t) => attr(t, 'data-v') === v)!, 'cx');
  assert.ok(Math.abs((at(20) - at(10)) / (at(30) - at(10)) - 0.5) < 0.01);
  const r = attr(d[0]!, 'r');
  for (let i = 0; i < d.length; i++) for (let j = i + 1; j < d.length; j++) {
    const dist = Math.hypot(attr(d[i]!, 'cx') - attr(d[j]!, 'cx'), attr(d[i]!, 'cy') - attr(d[j]!, 'cy'));
    assert.ok(dist >= 2 * r - 0.05, `dots ${i} and ${j} overlap`);
  }
  assert.deepEqual(renderChart(spec([{ id: 'a', label: 'A', values: vals }])), renderChart(spec([{ id: 'a', label: 'A', values: vals }])));
  assert.deepEqual(swarm([0, 0, 0], 2, 50).off, [0, 4, -4]);
});

test('beeswarm: threshold line, breaches flagged and counted in desc and table', () => {
  const html = renderChart(spec([{ id: 'a', label: 'A', values: [100, 200, 350, 400] }], { unit: { suffix: 'ms' }, threshold: { value: 300, label: 'SLO' } }));
  assert.match(html, /class="lc-swarm-thr"/);
  assert.equal((html.match(/lc-swarm-dot lc-swarm-over/g) ?? []).length, 2);
  assert.match(html, /SLO 초과 2/);
  const below = renderChart(spec([{ id: 'a', label: 'A', values: [100, 200, 350] }], { threshold: { value: 300, direction: 'below' } }));
  assert.equal((below.match(/lc-swarm-over/g) ?? []).length, 2);
});

test('beeswarm: nulls are not drawn and are counted; all-null group shows 데이터 없음; all-null -> empty', () => {
  const html = renderChart(spec([{ id: 'a', label: 'A', values: [1, null, 3] }, { id: 'b', label: 'B', values: [null] }]));
  assert.equal(dots(html).length, 2);
  assert.ok(!html.includes('data-v="0"'));
  assert.match(html, /결측 2\./);
  assert.match(html, /<th scope="row">B<\/th><td>0<\/td><td class="lc-na">데이터 없음<\/td>/);
  assert.match(html, /<td>1, 데이터 없음, 3<\/td>/);
  assert.match(renderChart(spec([{ id: 'a', label: 'A', values: [null] }])), /class="lc-empty"/);
});

test('beeswarm: invalid specs throw ChartSpecError with the right path', () => {
  const ok = [{ id: 'a', label: 'A', values: [1] }];
  assert.equal(pathOf(spec([{ id: 'a', label: 'A', values: [1, 'x'] }])), 'groups[0].values[1]');
  assert.equal(pathOf(spec(ok, { threshold: { label: 'x' } })), 'threshold.value');
  assert.equal(pathOf(spec(ok, { threshold: { value: 1, direction: 'up' } })), 'threshold.direction');
  assert.equal(pathOf(spec(ok, { threshold: { value: 1, color: 'red' } })), 'threshold.color');
  assert.equal(pathOf(spec(ok, { radius: 20 })), 'radius');
  assert.equal(pathOf(spec([{ id: 'a', label: 'A', values: [1] }, { id: 'a', label: 'B', values: [1] }])), 'groups[1].id');
});

test('beeswarm: user text is escaped and dots are focusable with labels', () => {
  const html = renderChart(spec([{ id: 'a', label: '<로그인>', values: [1200], quality: '표본' }], { unit: { suffix: 'ms' }, threshold: { value: 300, label: 'S&O' } }));
  assert.ok(!html.includes('<로그인>'));
  assert.match(html, /<g class="lc-pt lc-pt-swarm" tabindex="0" aria-label="&lt;로그인&gt;: 1,200ms · S&amp;O 초과 · 표본">/);
});
