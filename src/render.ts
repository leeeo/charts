import { plugins } from './charts/index.ts';
import { type RenderOptions, renderWith } from './render-core.ts';

export type { RenderOptions };

/** Validate a spec (throws ChartSpecError) and render it to a deterministic SVG-in-<figure> HTML string. */
export function renderChart(input: unknown, options: RenderOptions = {}): string {
  return renderWith(input, options, plugins);
}
