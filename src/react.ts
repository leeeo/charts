import { createElement, type ReactElement } from 'react';
import { renderChart } from './render.ts';

export interface ChartProps {
  spec: unknown;
  /** Fixed render width in px; defaults to the spec width. */
  width?: number;
  className?: string;
}

/** SSR-safe React adapter: the markup is the same string renderChart() returns. */
export function Chart({ spec, width, className }: ChartProps): ReactElement {
  const html = renderChart(spec, width === undefined ? {} : { width });
  return createElement('div', { className, dangerouslySetInnerHTML: { __html: html } });
}
