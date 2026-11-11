import { renderChart } from './render.ts';
import { type Mounted, mountWith } from './mount.ts';

export type { Mounted };

/**
 * Render `spec` into `el` at the element's width and re-render when the width changes.
 * Browser only; use renderChart() for Node / build-time output.
 */
export function mountChart(el: HTMLElement, spec: unknown): Mounted {
  return mountWith(el, spec, renderChart);
}
