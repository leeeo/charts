// Slim entry: the core six types (line, area, bar, sparkline, donut, multiples) plus only the chart types you pass.
//   import { createCharts } from '@leeeo/charts/core';
//   import { plugin as sankey } from '@leeeo/charts/charts/sankey';
//   const { renderChart, mountChart } = createCharts([sankey]);
// Output is identical to the full entry for the same spec; an unregistered type fails validation like an unknown one.
import type { ChartSpec } from './types.ts';
import type { ChartPlugin } from './plugin.ts';
import { validateWith } from './validate-core.ts';
import { type RenderOptions, renderWith } from './render-core.ts';
import { type Mounted, mountWith } from './mount.ts';

export { ChartSpecError } from './check.ts';
export { niceTicks, makeFmt } from './format.ts';
export type { ChartPlugin } from './plugin.ts';
export type { RenderOptions } from './render-core.ts';
export type { Mounted } from './mount.ts';
export type * from './types.ts';

export interface Charts {
  renderChart(input: unknown, options?: RenderOptions): string;
  validateSpec(input: unknown): ChartSpec;
  /** Browser only. */
  mountChart(el: HTMLElement, spec: unknown): Mounted;
}

export function createCharts(list: readonly ChartPlugin[]): Charts {
  const registry: Record<string, ChartPlugin> = Object.create(null) as Record<string, ChartPlugin>;
  for (const p of list) registry[p.type] = p;
  const renderChart = (input: unknown, options: RenderOptions = {}): string => renderWith(input, options, registry);
  return {
    renderChart,
    validateSpec: (input) => validateWith(input, registry),
    mountChart: (el, spec) => mountWith(el, spec, renderChart),
  };
}
