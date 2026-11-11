import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ChartSpecError, createCharts } from '../src/core.ts';
import { renderChart } from '../src/index.ts';
import { plugin as sankey } from '../src/charts/sankey.ts';
import { plugin as combo } from '../src/charts/combo.ts';
import { examples } from '../examples/specs.ts';

const slim = createCharts([sankey, combo]);

test('core entry: registered and core types render exactly like the full entry', () => {
  const picked = examples.filter((e) => ['sankey', 'combo', 'bar', 'line', 'donut', 'multiples', 'area', 'sparkline'].includes((e.spec as { type: string }).type));
  assert.ok(picked.length >= 8);
  for (const e of picked) assert.equal(slim.renderChart(e.spec, { width: 480 }), renderChart(e.spec, { width: 480 }), (e.spec as { title: string }).title);
});

test('core entry: an unregistered type is rejected and the message lists only registered types', () => {
  try {
    slim.renderChart({ type: 'pie', title: 't', slices: [] });
    assert.fail('expected failure');
  } catch (e) {
    assert.ok(e instanceof ChartSpecError);
    assert.equal(e.path, 'type');
    assert.match(e.message, /sankey, combo$/);
  }
  assert.throws(() => slim.validateSpec({ type: 'toString', title: 't' }), ChartSpecError);
});
