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
import { plugin as pie } from './pie.ts';
import { plugin as lollipop } from './lollipop.ts';
import { plugin as dumbbell } from './dumbbell.ts';
import { plugin as waterfall } from './waterfall.ts';
import { plugin as pareto } from './pareto.ts';
import { plugin as marimekko } from './marimekko.ts';
import { plugin as radar } from './radar.ts';
import { plugin as parallel } from './parallel.ts';
import { plugin as ridgeline } from './ridgeline.ts';
import { plugin as beeswarm } from './beeswarm.ts';
import { plugin as candlestick } from './candlestick.ts';
import { plugin as timeline } from './timeline.ts';
import { plugin as skyline } from './skyline.ts';
import { plugin as sunburst } from './sunburst.ts';
import { plugin as tree } from './tree.ts';
import { plugin as network } from './network.ts';
import { plugin as chord } from './chord.ts';
import { plugin as map } from './map.ts';

/** Every registered plugin, in gallery order. Placeholders (null) are skipped. */
export const pluginList: ChartPlugin[] = ([
  waffle, segmented, funnel, gauge, bullet, slope, bump, stream, scatter, bubble, box, histogram, heatmap, calendar, treemap, sankey, pie, lollipop, dumbbell, waterfall, pareto, marimekko, radar, parallel, ridgeline, beeswarm, candlestick, timeline, skyline, sunburst, tree, network, chord, map,
] as (ChartPlugin | null)[]).filter((p): p is ChartPlugin => p !== null);

export const plugins: Record<string, ChartPlugin> = Object.fromEntries(pluginList.map((p) => [p.type, p]));
