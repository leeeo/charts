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
import type { PieSpec } from './charts/pie.ts';
import type { LollipopSpec } from './charts/lollipop.ts';
import type { DumbbellSpec } from './charts/dumbbell.ts';
import type { WaterfallSpec } from './charts/waterfall.ts';
import type { ParetoSpec } from './charts/pareto.ts';
import type { MarimekkoSpec } from './charts/marimekko.ts';
import type { RadarSpec } from './charts/radar.ts';
import type { ParallelSpec } from './charts/parallel.ts';
import type { RidgelineSpec } from './charts/ridgeline.ts';
import type { BeeswarmSpec } from './charts/beeswarm.ts';
import type { CandlestickSpec } from './charts/candlestick.ts';
import type { TimelineSpec } from './charts/timeline.ts';
import type { SkylineSpec } from './charts/skyline.ts';
import type { SunburstSpec } from './charts/sunburst.ts';
import type { TreeSpec } from './charts/tree.ts';
import type { NetworkSpec } from './charts/network.ts';
import type { ChordSpec } from './charts/chord.ts';
import type { MapSpec } from './charts/map.ts';

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
  | SankeySpec
  | PieSpec
  | LollipopSpec
  | DumbbellSpec
  | WaterfallSpec
  | ParetoSpec
  | MarimekkoSpec
  | RadarSpec
  | ParallelSpec
  | RidgelineSpec
  | BeeswarmSpec
  | CandlestickSpec
  | TimelineSpec
  | SkylineSpec
  | SunburstSpec
  | TreeSpec
  | NetworkSpec
  | ChordSpec
  | MapSpec;

export type {
  WaffleSpec, SegmentedSpec, FunnelSpec, GaugeSpec, BulletSpec, SlopeSpec, BumpSpec, StreamSpec, ScatterSpec, BubbleSpec, BoxSpec, HistogramSpec, HeatmapSpec, CalendarSpec, TreemapSpec, SankeySpec, PieSpec, LollipopSpec, DumbbellSpec, WaterfallSpec, ParetoSpec, MarimekkoSpec, RadarSpec, ParallelSpec, RidgelineSpec, BeeswarmSpec, CandlestickSpec, TimelineSpec, SkylineSpec, SunburstSpec, TreeSpec, NetworkSpec, ChordSpec, MapSpec,
};
