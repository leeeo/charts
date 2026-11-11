// Bubble chart: a scatter plot whose circle AREA is proportional to a third value (size), with a size key.
// Named bubbles carry their name beside the circle (see scatter.ts renderXY).
import type { BaseSpec, Unit, Value } from '../types.ts';
import { definePlugin } from '../plugin.ts';
import { BASE, base, dict, optStr, put, unit } from '../check.ts';
import { XY_KEYS, renderXY, validateXY } from './scatter.ts';

export interface BubblePoint {
  x: Value;
  y: Value;
  /** Size value (>= 0); circle area is proportional to it. null = missing (point not drawn). */
  size: Value;
  label?: string;
}

export interface BubbleSeries {
  id: string;
  name: string;
  points: BubblePoint[];
  color?: string;
  quality?: string;
}

export interface BubbleSpec extends BaseSpec {
  type: 'bubble';
  series: BubbleSeries[];
  xLabel?: string;
  yLabel?: string;
  /** Name of the size value, e.g. "매출" (default "크기"). */
  sizeLabel?: string;
  xUnit?: Unit;
  sizeUnit?: Unit;
  xMin?: number;
  xMax?: number;
  yMin?: number;
  yMax?: number;
  /** Write each named point's label next to its bubble (default true). */
  pointLabels?: boolean;
}

export const plugin = definePlugin<BubbleSpec>({
  type: 'bubble',
  names: { ko: '버블 차트', en: 'Bubble chart' },
  validate(input) {
    const o = dict(input, 'spec', [...BASE, ...XY_KEYS, 'sizeLabel', 'sizeUnit']);
    const out = base(o);
    out.type = 'bubble';
    validateXY(o, out, true);
    put(out, 'sizeLabel', optStr(o.sizeLabel, 'sizeLabel', 60));
    put(out, 'sizeUnit', unit(o.sizeUnit, 'sizeUnit'));
    return out as unknown as BubbleSpec;
  },
  height: (_spec, w) => (w < 420 ? 280 : 340),
  render: (spec, ctx) => renderXY(spec, ctx, true),
});
