// Parallel coordinates: one vertical axis per numeric dimension, each with its own nice range (bottom = min, top = max);
// one polyline per item. A null value breaks that item's line at the axis (no vertex, never drawn as 0).
import type { BaseSpec, Unit, Value } from '../types.ts';
import { definePlugin } from '../plugin.ts';
import { BASE, MAX_POINTS, MAX_SERIES, base, color, dict, fail, idList, optNum, optStr, str, unit, values } from '../check.ts';
import { type Fmt, type Ticks, esc, makeFmt, n2, niceTicks, truncate, tw } from '../format.ts';
import { type Ctx, FS, MAX_FOCUS, colorAttrs, empty, focusable, frame, legend, present, runs, table, unitLabel, wrapTable } from '../kit.ts';

export interface ParallelDimension {
  id: string;
  label: string;
  /** Formatting for this axis (falls back to the spec unit). */
  unit?: Unit;
  /** Axis bounds extend the nice range; data is never clipped. */
  min?: number;
  max?: number;
}

export interface ParallelItem {
  id: string;
  label: string;
  /** One value per dimension; null = missing. */
  values: Value[];
  color?: string;
  quality?: string;
}

export interface ParallelSpec extends BaseSpec {
  type: 'parallel';
  dimensions: ParallelDimension[];
  items: ParallelItem[];
}

const MAX_ITEMS = 200;
const TS = 11;

export const plugin = definePlugin<ParallelSpec>({
  type: 'parallel',
  names: { ko: '평행 좌표', en: 'Parallel coordinates' },
  validate(input) {
    const o = dict(input, 'spec', [...BASE, 'dimensions', 'items']);
    const out = base(o) as unknown as ParallelSpec;
    out.type = 'parallel';
    out.dimensions = idList(o.dimensions, 'dimensions', ['label', 'unit', 'min', 'max'], MAX_SERIES, (d, p, id) => {
      const dim: ParallelDimension = { id, label: str(d.label, `${p}.label`, 60) };
      const u = unit(d.unit, `${p}.unit`);
      const lo = optNum(d.min, `${p}.min`, -1e15, 1e15);
      const hi = optNum(d.max, `${p}.max`, -1e15, 1e15);
      if (lo !== undefined && hi !== undefined && lo >= hi) fail(`${p}.max`, 'must be greater than min');
      if (u !== undefined) dim.unit = u;
      if (lo !== undefined) dim.min = lo;
      if (hi !== undefined) dim.max = hi;
      return dim;
    });
    const nd = out.dimensions.length;
    if (nd < 2) fail('dimensions', 'must have at least 2 entries');
    const maxItems = Math.min(MAX_ITEMS, Math.floor(MAX_POINTS / nd));
    if (Array.isArray(o.items) && o.items.length > maxItems) fail('items', `must have at most ${maxItems} entries`);
    out.items = idList(o.items, 'items', ['label', 'values', 'color', 'quality'], maxItems, (it, p, id) => {
      const item: ParallelItem = { id, label: str(it.label, `${p}.label`, 60), values: values(it.values, `${p}.values`, nd, false) };
      const c = color(it.color, `${p}.color`);
      const q = optStr(it.quality, `${p}.quality`, 60);
      if (c !== undefined) item.color = c;
      if (q !== undefined) item.quality = q;
      return item;
    });
    return out;
  },
  height(_spec, W) {
    return W < 420 ? 280 : 340;
  },
  render(spec, ctx: Ctx) {
    const t = ctx.t;
    const dims = spec.dimensions;
    const items = spec.items;
    const cols = dims.map((_, k) => items.map((it) => it.values[k] ?? null));
    const fmts: Fmt[] = dims.map((d, k) => makeFmt(d.unit ?? spec.unit, cols[k]!));
    const all = cols.flat();
    const nPresent = present(all).length;
    const missing = all.length - nPresent;
    const q = (it: ParallelItem): string => (it.quality ? ` · ${it.quality}` : '');
    const itemText = (it: ParallelItem): string =>
      `${it.label}: ${dims.map((d, k) => { const v = it.values[k]; return `${d.label} ${v === null || v === undefined ? t.na : fmts[k]!(v)}`; }).join(', ')}${q(it)}`;
    let svg = '';
    if (!nPresent) svg = empty(ctx);
    else {
      const doms: (Ticks | null)[] = dims.map((d, k) => {
        const vs = present(cols[k]!);
        const lo = Math.min(...vs, d.min ?? Infinity, ...(d.max !== undefined && !vs.length ? [d.max] : []));
        const hi = Math.max(...vs, d.max ?? -Infinity, ...(d.min !== undefined && !vs.length ? [d.min] : []));
        return Number.isFinite(lo) && Number.isFinite(hi) ? niceTicks(lo, hi, 5) : null;
      });
      const slot = (ctx.W - 16) / dims.length;
      const ax = (k: number): number => 8 + slot * (k + 0.5);
      const top = 2 * FS + 16;
      const bot = ctx.H - FS - 12;
      const ph = Math.max(10, bot - top);
      const sy = (k: number, v: number): number => {
        const dm = doms[k]!;
        return bot - ((v - dm.min) / (dm.max - dm.min || 1)) * ph;
      };
      const fit = (s: string, size: number): string => truncate(s, Math.max(slot - 6, 1), size);
      dims.forEach((d, k) => {
        const x = ax(k);
        const ul = unitLabel(d.unit);
        svg += `<text class="lc-par-head" x="${n2(x)}" y="${n2(FS + 2)}" text-anchor="middle">${esc(fit(ul ? `${d.label} (${ul})` : d.label, FS))}</text>`;
        svg += `<line class="lc-axis lc-par-axis" x1="${n2(x)}" x2="${n2(x)}" y1="${n2(top)}" y2="${n2(bot)}"/>`;
        const dm = doms[k];
        if (!dm) {
          svg += `<text class="lc-par-na" x="${n2(x)}" y="${n2(top + ph / 2)}" text-anchor="middle">${esc(fit(t.na, TS))}</text>`;
          return;
        }
        dm.ticks.forEach((tk) => {
          svg += `<line class="lc-grid" x1="${n2(x - 3)}" x2="${n2(x + 3)}" y1="${n2(sy(k, tk))}" y2="${n2(sy(k, tk))}"/>`;
        });
        svg += `<text class="lc-tick lc-par-tick" x="${n2(x)}" y="${n2(top - 6)}" text-anchor="middle">${esc(fit(fmts[k]!(dm.max), TS))}</text>`;
        svg += `<text class="lc-tick lc-par-tick" x="${n2(x)}" y="${n2(bot + TS + 6)}" text-anchor="middle">${esc(fit(fmts[k]!(dm.min), TS))}</text>`;
      });
      const canFocus = items.length <= MAX_FOCUS;
      items.forEach((it, i) => {
        const ca = colorAttrs(i, it.color);
        const vals = it.values.map((v, k) => (v === null || !doms[k] ? null : v));
        const d = runs(vals).map((r) => r.map((k, j) => `${j ? 'L' : 'M'}${n2(ax(k))} ${n2(sy(k, vals[k] as number))}`).join('')).join('');
        let inner = d ? `<path class="lc-par-line ${ca} d="${d}"/>` : '';
        vals.forEach((v, k) => {
          if (v === null) return;
          inner += `<circle class="lc-mark lc-par-dot ${ca} data-i="${i}" data-d="${k}" data-v="${v}" cx="${n2(ax(k))}" cy="${n2(sy(k, v))}" r="2.5"/>`;
        });
        if (!inner) return;
        const k0 = vals.findIndex((v) => v !== null);
        const g = `<g class="lc-par-item ${ca} data-i="${i}">${inner}</g>`;
        svg += canFocus ? focusable(ctx, 'lc-pt-par', itemText(it), g, ax(k0), sy(k0, vals[k0] as number)) : g;
      });
    }

    const dimDesc = dims.map((d, k) => {
      const vs = present(cols[k]!);
      if (!vs.length) return `${d.label}: ${t.na}`;
      const hi = Math.max(...vs);
      const lo = Math.min(...vs);
      const f = fmts[k]!;
      return `${d.label}: ${t.min} ${f(lo)} (${items[cols[k]!.indexOf(lo)]!.label}), ${t.max} ${f(hi)} (${items[cols[k]!.indexOf(hi)]!.label})`;
    }).join('. ');
    const quals = items.filter((it) => it.quality).map((it) => `${it.label}: ${it.quality}`);
    const desc = `${items.length}${t.items}, ${dims.length}${ctx.lang === 'ko' ? '개 축' : ' axes'}. ${dimDesc}.${missing ? ` ${t.missing} ${missing}.` : ''}${quals.length ? ` ${t.quality}: ${quals.join(', ')}.` : ''}`;
    const showLegend = spec.legend === true || (spec.legend !== false && items.length <= MAX_SERIES);
    const lg = showLegend ? legend(items.map((it, i) => ({ name: it.label, idx: i, ...(it.color ? { color: it.color } : {}), ...(it.quality ? { quality: it.quality } : {}) }))) : '';
    const head = [t.cat, ...dims.map((d) => { const ul = unitLabel(d.unit); return ul ? `${d.label} (${ul})` : d.label; })];
    const tbl = table(t, spec.title, head, items.map((it) => ({
      th: `${it.label}${it.quality ? ` (${it.quality})` : ''}`,
      cells: it.values.map((v, k) => (v === null ? null : fmts[k]!(v))),
    })));
    return frame(ctx, spec, svg, desc, lg, wrapTable(spec.table ?? 'details', t, tbl));
  },
});
