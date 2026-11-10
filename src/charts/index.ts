// Registry of chart types beyond the core six (line, area, bar, sparkline, donut, multiples).
import type { ChartPlugin } from '../plugin.ts';
import { plugin as waffle } from './waffle.ts';
import { plugin as segmented } from './segmented.ts';
import { plugin as funnel } from './funnel.ts';
import { plugin as gauge } from './gauge.ts';
import { plugin as bullet } from './bullet.ts';
import { plugin as slope } from './slope.ts';
import { plugin as bump } from './bump.ts';
import { plugin as stream } from './stream.ts';
import { plugin as scatter } from './scatter.ts';
import { plugin as bubble } from './bubble.ts';
import { plugin as box } from './box.ts';
import { plugin as histogram } from './histogram.ts';
import { plugin as heatmap } from './heatmap.ts';
import { plugin as calendar } from './calendar.ts';
import { plugin as treemap } from './treemap.ts';
import { plugin as sankey } from './sankey.ts';

/** Every registered plugin, in gallery order. */
export const pluginList: ChartPlugin[] = ([
  waffle, segmented, funnel, gauge, bullet, slope, bump, stream, scatter, bubble, box, histogram, heatmap, calendar, treemap, sankey,
] as (ChartPlugin | null)[]).filter((p): p is ChartPlugin => p !== null);

export const plugins: Record<string, ChartPlugin> = Object.fromEntries(pluginList.map((p) => [p.type, p]));
