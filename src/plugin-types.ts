// Spec types of the plugin chart types (src/charts/*). Placeholders export `never` until implemented.
import type { WaffleSpec } from './charts/waffle.ts';
import type { SegmentedSpec } from './charts/segmented.ts';
import type { FunnelSpec } from './charts/funnel.ts';
import type { GaugeSpec } from './charts/gauge.ts';
import type { BulletSpec } from './charts/bullet.ts';
import type { SlopeSpec } from './charts/slope.ts';
import type { BumpSpec } from './charts/bump.ts';
import type { StreamSpec } from './charts/stream.ts';
import type { ScatterSpec } from './charts/scatter.ts';
import type { BubbleSpec } from './charts/bubble.ts';
import type { BoxSpec } from './charts/box.ts';
import type { HistogramSpec } from './charts/histogram.ts';
import type { HeatmapSpec } from './charts/heatmap.ts';
import type { CalendarSpec } from './charts/calendar.ts';
import type { TreemapSpec } from './charts/treemap.ts';
import type { SankeySpec } from './charts/sankey.ts';

export type PluginSpec =
  | WaffleSpec
  | SegmentedSpec
  | FunnelSpec
  | GaugeSpec
  | BulletSpec
  | SlopeSpec
  | BumpSpec
  | StreamSpec
  | ScatterSpec
  | BubbleSpec
  | BoxSpec
  | HistogramSpec
  | HeatmapSpec
  | CalendarSpec
  | TreemapSpec
  | SankeySpec;

export type {
  WaffleSpec, SegmentedSpec, FunnelSpec, GaugeSpec, BulletSpec, SlopeSpec, BumpSpec, StreamSpec, ScatterSpec, BubbleSpec, BoxSpec, HistogramSpec, HeatmapSpec, CalendarSpec, TreemapSpec, SankeySpec,
};
