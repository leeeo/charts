import type { ChartSpec, Panel, Series, Slice, Value } from './types.ts';
import type { ChartPlugin } from './plugin.ts';
import { BASE, ChartSpecError, type Dict, MAX_SERIES, base, color, dict, fail, labels, oneOf, optBool, optNum, optStr, seriesList, str } from './check.ts';

export { ChartSpecError };

/** Allowed `valueLabels` values (shared with the pie plugin). */
export const VALUE_LABELS = ['auto', 'none'] as const;

/**
 * Validate untrusted input against the core six types plus the given plugin registry and return a clean, typed copy.
 * Throws ChartSpecError with a JSON path.
 */
export function validateWith(input: unknown, plugins: Readonly<Record<string, ChartPlugin>>): ChartSpec {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) fail('spec', 'must be an object');
  const probe = (typeof input === 'object' && input !== null ? (input as Dict).type : undefined);
  const put = (out: Record<string, unknown>, k: string, v: unknown) => { if (v !== undefined) out[k] = v; };
  switch (probe) {
    case 'line':
    case 'area':
    case 'bar':
    case 'sparkline': {
      const extra = probe === 'area' ? ['stacked'] : probe === 'bar' ? ['stacked', 'horizontal', 'percent'] : [];
      const o = dict(input, 'spec', [...BASE, 'labels', 'xLabel', 'yMin', 'yMax', 'series', 'valueLabels', ...extra]);
      const out = base(o);
      out.type = probe;
      put(out, 'valueLabels', oneOf(o.valueLabels, 'valueLabels', VALUE_LABELS));
      const ls = labels(o.labels, 'labels');
      const stacked = optBool(o.stacked, 'stacked');
      out.labels = ls;
      put(out, 'xLabel', optStr(o.xLabel, 'xLabel', 60));
      const yMin = optNum(o.yMin, 'yMin', -1e15, 1e15);
      const yMax = optNum(o.yMax, 'yMax', -1e15, 1e15);
      if (yMin !== undefined && yMax !== undefined && yMin >= yMax) fail('yMax', 'must be greater than yMin');
      put(out, 'yMin', yMin);
      put(out, 'yMax', yMax);
      // stacked areas need non-negative values; stacked bars may diverge below zero
      out.series = seriesList(o.series, 'series', ls.length, stacked === true && probe === 'area');
      if (probe === 'sparkline' && (out.series as Series[]).length !== 1) fail('series', 'sparkline takes exactly one series');
      put(out, 'stacked', stacked);
      put(out, 'horizontal', optBool(o.horizontal, 'horizontal'));
      const percent = optBool(o.percent, 'percent');
      if (percent === true && stacked !== true) fail('percent', 'requires stacked: true');
      put(out, 'percent', percent);
      return out as unknown as ChartSpec;
    }
    case 'donut': {
      const o = dict(input, 'spec', [...BASE, 'slices', 'centerLabel', 'valueLabels']);
      const out = base(o);
      out.type = 'donut';
      put(out, 'valueLabels', oneOf(o.valueLabels, 'valueLabels', VALUE_LABELS));
      const sl = o.slices;
      if (!Array.isArray(sl) || sl.length === 0) fail('slices', 'must be a non-empty array');
      if (sl.length > MAX_SERIES) fail('slices', `must have at most ${MAX_SERIES} entries`);
      const seen = new Set<string>();
      out.slices = sl.map((s, i): Slice => {
        const p = `slices[${i}]`;
        const d = dict(s, p, ['id', 'label', 'value', 'color', 'quality']);
        const id = str(d.id, `${p}.id`, 64);
        if (seen.has(id)) fail(`${p}.id`, 'duplicate id');
        seen.add(id);
        const v = d.value;
        if (v !== null && (typeof v !== 'number' || !Number.isFinite(v) || v < 0)) fail(`${p}.value`, 'must be a finite number >= 0 or null (missing)');
        const r: Slice = { id, label: str(d.label, `${p}.label`, 80), value: v as Value };
        const c = color(d.color, `${p}.color`);
        const q = optStr(d.quality, `${p}.quality`, 60);
        if (c !== undefined) r.color = c;
        if (q !== undefined) r.quality = q;
        return r;
      });
      put(out, 'centerLabel', optStr(o.centerLabel, 'centerLabel', 40));
      return out as unknown as ChartSpec;
    }
    case 'multiples': {
      const o = dict(input, 'spec', [...BASE, 'panelType', 'labels', 'xLabel', 'panels', 'columns', 'sharedY', 'yMin', 'yMax', 'valueLabels']);
      const out = base(o);
      out.type = 'multiples';
      put(out, 'valueLabels', oneOf(o.valueLabels, 'valueLabels', VALUE_LABELS));
      const pt = oneOf(o.panelType, 'panelType', ['line', 'area', 'bar'] as const);
      if (pt === undefined) fail('panelType', 'is required');
      out.panelType = pt;
      const ls = labels(o.labels, 'labels');
      out.labels = ls;
      put(out, 'xLabel', optStr(o.xLabel, 'xLabel', 60));
      const cols = optNum(o.columns, 'columns', 1, 12);
      if (cols !== undefined && !Number.isInteger(cols)) fail('columns', 'must be an integer');
      put(out, 'columns', cols);
      put(out, 'sharedY', optBool(o.sharedY, 'sharedY'));
      put(out, 'yMin', optNum(o.yMin, 'yMin', -1e15, 1e15));
      put(out, 'yMax', optNum(o.yMax, 'yMax', -1e15, 1e15));
      const ps = o.panels;
      if (!Array.isArray(ps) || ps.length === 0) fail('panels', 'must be a non-empty array');
      if (ps.length > 48) fail('panels', 'must have at most 48 entries');
      const seen = new Set<string>();
      out.panels = ps.map((p, i): Panel => {
        const path = `panels[${i}]`;
        const d = dict(p, path, ['id', 'title', 'subtitle', 'quality', 'series']);
        const id = str(d.id, `${path}.id`, 64);
        if (seen.has(id)) fail(`${path}.id`, 'duplicate id');
        seen.add(id);
        const r: Panel = { id, title: str(d.title, `${path}.title`, 80), series: seriesList(d.series, `${path}.series`, ls.length, false) };
        const st = optStr(d.subtitle, `${path}.subtitle`, 80);
        const q = optStr(d.quality, `${path}.quality`, 60);
        if (st !== undefined) r.subtitle = st;
        if (q !== undefined) r.quality = q;
        return r;
      });
      return out as unknown as ChartSpec;
    }
    default: {
      const p = typeof probe === 'string' && Object.hasOwn(plugins, probe) ? plugins[probe] : undefined;
      if (p) return p.validate(input) as ChartSpec;
      return fail('type', `must be one of ${['line', 'area', 'bar', 'sparkline', 'donut', 'multiples', ...Object.keys(plugins)].join(', ')}`);
    }
  }
}
