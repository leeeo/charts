import type { BaseSpec, Slice, ValueLabels } from '../types.ts';
import { definePlugin } from '../plugin.ts';
import { BASE, MAX_SERIES, base, color, dict, idList, oneOf, optStr, put, str, value } from '../check.ts';
import { renderRing } from '../radial.ts';
import { VALUE_LABELS } from '../validate-core.ts';

/**
 * Pie chart: like donut without the hole. null slices are left out of the circle and listed as missing.
 * `valueLabels` (default `auto`) puts name + value beside each slice, or the share inside when the chart is narrow.
 */
export interface PieSpec extends BaseSpec { type: 'pie'; slices: Slice[]; valueLabels?: ValueLabels }

export const plugin = definePlugin<PieSpec>({
  type: 'pie',
  names: { ko: '파이 차트', en: 'Pie chart' },
  defaultWidth: 280,
  validate(input) {
    const o = dict(input, 'spec', [...BASE, 'slices', 'valueLabels']);
    const out = base(o);
    out.type = 'pie';
    put(out, 'valueLabels', oneOf(o.valueLabels, 'valueLabels', VALUE_LABELS));
    out.slices = idList(o.slices, 'slices', ['label', 'value', 'color', 'quality'], MAX_SERIES, (d, p, id): Slice => {
      const r: Slice = { id, label: str(d.label, `${p}.label`, 80), value: value(d.value, `${p}.value`, 0) };
      put(r as unknown as Record<string, unknown>, 'color', color(d.color, `${p}.color`));
      put(r as unknown as Record<string, unknown>, 'quality', optStr(d.quality, `${p}.quality`, 60));
      return r;
    });
    return out as unknown as PieSpec;
  },
  height: (_spec, w) => Math.min(260, Math.max(180, w * 0.8)),
  render: (spec, ctx) => renderRing(spec, ctx, 0),
});
