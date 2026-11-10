// Heatmap: a rows x columns matrix of values, coloured by a 7-step sequential scale (classes lc-heat-0..6 over one hue).
// Null cells are drawn as dashed, crossed outlines so they never read as 0.
import type { BaseSpec, Value } from '../types.ts';
import { definePlugin } from '../plugin.ts';
import { BASE, MAX_POINTS, base, color, dict, fail, labels, optBool, optNum, optStr, values } from '../check.ts';
import { clamp, esc, makeFmt, n2, truncate, tw } from '../format.ts';
import { type Ctx, FS, MAX_FOCUS, colorAttrs, empty, focusable, frame, table, wrapTable } from '../kit.ts';

export interface HeatmapSpec extends BaseSpec {
  type: 'heatmap';
  rows: string[];
  columns: string[];
  /** values[r][c]; null = missing. */
  values: Value[][];
  /** Title of the column axis (shown above the column labels). */
  xLabel?: string;
  /** Title of the row axis (table header, left gutter). */
  yLabel?: string;
  /** Scale bounds; default = data min/max. Values outside are clamped to the end classes. */
  min?: number;
  max?: number;
  /** Print values inside cells when they fit. */
  showValues?: boolean;
  color?: string;
  quality?: string;
}

export const STEPS = 7;

/** Scale class 0..STEPS-1 for v in [lo, hi]. */
export const level = (v: number, lo: number, hi: number): number =>
  hi > lo ? clamp(Math.floor(((v - lo) / (hi - lo)) * STEPS), 0, STEPS - 1) : Math.floor(STEPS / 2);

/** Scale legend: one swatch per class (prefix e.g. 'lc-heat-'), plus the missing swatch when needed. */
export function scaleLegend(prefix: string, lo: number, hi: number, fmt: (v: number) => string, naText: string, withNa: boolean, colorCls: string): string {
  const items: string[] = [];
  if (hi > lo) {
    for (let k = 0; k < STEPS; k++) {
      const a = lo + ((hi - lo) * k) / STEPS;
      const b = lo + ((hi - lo) * (k + 1)) / STEPS;
      items.push(`<li><span class="lc-sw ${prefix}${k}"></span><span class="lc-ln">${esc(`${fmt(a)}–${fmt(b)}`)}</span></li>`);
    }
  } else items.push(`<li><span class="lc-sw ${prefix}${Math.floor(STEPS / 2)}"></span><span class="lc-ln">${esc(fmt(lo))}</span></li>`);
  if (withNa) items.push(`<li><span class="lc-sw lc-sw-na"></span><span class="lc-ln">${esc(naText)}</span></li>`);
  return `<ul class="lc-legend lc-scale ${colorCls}>${items.join('')}</ul>`;
}

const topOf = (spec: HeatmapSpec): number => FS + 8 + (spec.xLabel ? FS + 6 : 0);

export const plugin = definePlugin<HeatmapSpec>({
  type: 'heatmap',
  names: { ko: '히트맵', en: 'Heatmap' },
  validate(input) {
    const o = dict(input, 'spec', [...BASE, 'rows', 'columns', 'values', 'xLabel', 'yLabel', 'min', 'max', 'showValues', 'color', 'quality']);
    const out = base(o) as unknown as HeatmapSpec;
    out.type = 'heatmap';
    out.rows = labels(o.rows, 'rows');
    out.columns = labels(o.columns, 'columns');
    if (out.rows.length * out.columns.length > MAX_POINTS) fail('values', `must have at most ${MAX_POINTS} entries`);
    if (!Array.isArray(o.values)) fail('values', 'must be an array');
    if (o.values.length !== out.rows.length) fail('values', `must have ${out.rows.length} entries (one per label), got ${o.values.length}`);
    out.values = o.values.map((row, r) => values(row, `values[${r}]`, out.columns.length, false));
    const lo = optNum(o.min, 'min', -1e15, 1e15);
    const hi = optNum(o.max, 'max', -1e15, 1e15);
    if (lo !== undefined && hi !== undefined && lo >= hi) fail('max', 'must be greater than min');
    const put = (k: keyof HeatmapSpec, v: unknown): void => { if (v !== undefined) (out as unknown as Record<string, unknown>)[k] = v; };
    put('min', lo);
    put('max', hi);
    put('xLabel', optStr(o.xLabel, 'xLabel', 60));
    put('yLabel', optStr(o.yLabel, 'yLabel', 60));
    put('showValues', optBool(o.showValues, 'showValues'));
    put('color', color(o.color, 'color'));
    put('quality', optStr(o.quality, 'quality', 60));
    return out;
  },
  height(spec, W) {
    const rh = Math.min(W < 420 ? 24 : 30, Math.max(6, 2000 / spec.rows.length));
    return Math.round(topOf(spec) + spec.rows.length * rh + 8);
  },
  render(spec, ctx: Ctx) {
    const t = ctx.t;
    const flat = spec.values.flat();
    const fmt = makeFmt(spec.unit, flat);
    const pres = flat.filter((v): v is number => v !== null);
    const nr = spec.rows.length;
    const nc = spec.columns.length;
    const missing = flat.length - pres.length;
    const lo = spec.min ?? (pres.length ? Math.min(...pres) : 0);
    const hi = spec.max ?? (pres.length ? Math.max(...pres) : 0);
    const cellText = (r: number, c: number): string => {
      const v = spec.values[r]![c]!;
      return `${spec.rows[r]}, ${spec.columns[c]}: ${v === null ? t.na : fmt(v)}${spec.quality ? ` · ${spec.quality}` : ''}`;
    };

    let svg = '';
    if (!pres.length) svg = empty(ctx);
    else {
      const top = topOf(spec);
      const axisT = spec.yLabel ? FS + 8 : 0;
      const maxL = Math.min(ctx.W * 0.35, Math.max(...spec.rows.map((l) => tw(l, FS))));
      const left = maxL + 8 + axisT;
      const pw = Math.max(nc, ctx.W - left - 8);
      const ph = Math.max(nr, ctx.H - top - 8);
      const cw = pw / nc;
      const rh = ph / nr;
      if (spec.xLabel) svg += `<text class="lc-axis-title" x="${n2(left + pw / 2)}" y="${n2(FS)}" text-anchor="middle">${esc(truncate(spec.xLabel, ctx.W - 8, FS))}</text>`;
      if (spec.yLabel) svg += `<text class="lc-axis-title" transform="translate(${n2(FS)} ${n2(top + ph / 2)}) rotate(-90)" text-anchor="middle">${esc(truncate(spec.yLabel, ph, FS))}</text>`;
      // column labels, thinned when cells are narrower than the labels
      const need = Math.min(Math.max(...spec.columns.map((l) => tw(l, FS))), tw('0000', FS)) + 4;
      const cstep = Math.max(1, Math.ceil(need / cw));
      const cy = top - 6;
      for (let c = 0; c < nc; c += cstep) {
        if (cstep === 1) svg += `<text class="lc-tick" x="${n2(left + cw * (c + 0.5))}" y="${n2(cy)}" text-anchor="middle">${esc(truncate(spec.columns[c]!, cw - 2, FS))}</text>`;
        else {
          const x = left + cw * c + 1;
          const room = Math.min(cw * cstep, ctx.W - 2 - x) - 3;
          if (room > tw('…', FS)) svg += `<text class="lc-tick" x="${n2(x)}" y="${n2(cy)}">${esc(truncate(spec.columns[c]!, room, FS))}</text>`;
        }
      }
      const rstep = Math.max(1, Math.ceil((FS + 2) / rh));
      for (let r = 0; r < nr; r += rstep) {
        svg += `<text class="lc-tick" x="${n2(left - 6)}" y="${n2(top + rh * (r + 0.5) + FS * 0.36)}" text-anchor="end">${esc(truncate(spec.rows[r]!, maxL, FS))}</text>`;
      }
      const canFocus = nr * nc <= MAX_FOCUS;
      const gap = Math.min(1.5, cw * 0.1, rh * 0.1);
      let cells = '';
      for (let r = 0; r < nr; r++) {
        for (let c = 0; c < nc; c++) {
          const v = spec.values[r]![c]!;
          const x = left + cw * c + gap / 2;
          const y = top + rh * r + gap / 2;
          const w = Math.max(0.5, cw - gap);
          const h = Math.max(0.5, rh - gap);
          const i = r * nc + c;
          let inner: string;
          if (v === null) {
            inner = `<rect class="lc-hcell-na" data-i="${i}" data-r="${r}" data-c="${c}" x="${n2(x)}" y="${n2(y)}" width="${n2(w)}" height="${n2(h)}"/><path class="lc-hcell-x" d="M${n2(x)} ${n2(y + h)}L${n2(x + w)} ${n2(y)}"/>`;
          } else {
            const k = level(v, lo, hi);
            inner = `<rect class="lc-mark lc-hcell lc-heat-${k}" data-i="${i}" data-r="${r}" data-c="${c}" data-v="${v}" x="${n2(x)}" y="${n2(y)}" width="${n2(w)}" height="${n2(h)}"/>`;
            const lab = fmt(v);
            if (spec.showValues && rh >= 14 && tw(lab, 11) + 4 <= w) {
              inner += `<text class="lc-hval ${k >= 4 ? 'lc-hval-on' : ''}" x="${n2(x + w / 2)}" y="${n2(y + h / 2 + 4)}" text-anchor="middle">${esc(lab)}</text>`;
            }
          }
          cells += canFocus ? focusable(ctx, 'lc-pt-hcell', cellText(r, c), inner, x + w / 2, y) : inner;
        }
      }
      svg += `<g class="lc-heat ${colorAttrs(0, spec.color)}>${cells}</g>`;
    }

    let desc = '';
    if (pres.length) {
      let mn = { r: 0, c: 0, v: Infinity };
      let mx = { r: 0, c: 0, v: -Infinity };
      spec.values.forEach((row, r) => row.forEach((v, c) => {
        if (v === null) return;
        if (v < mn.v) mn = { r, c, v };
        if (v > mx.v) mx = { r, c, v };
      }));
      const mean = pres.reduce((a, b) => a + b, 0) / pres.length;
      desc = `${nr} x ${nc}. ${t.min} ${fmt(mn.v)} (${spec.rows[mn.r]}, ${spec.columns[mn.c]}), ${t.max} ${fmt(mx.v)} (${spec.rows[mx.r]}, ${spec.columns[mx.c]}), ${t.mean} ${makeFmt(spec.unit, [...flat, Math.round(mean * 100) / 100])(mean)}.`;
    } else desc = `${t.na}.`;
    if (missing) desc += ` ${t.missing} ${missing}.`;
    if (spec.quality) desc += ` ${t.quality}: ${spec.quality}.`;
    const lg = spec.legend === false || !pres.length ? '' : scaleLegend('lc-heat-', lo, hi, fmt, t.na, missing > 0, colorAttrs(0, spec.color));
    const tbl = table(t, `${spec.title}${spec.quality ? ` (${spec.quality})` : ''}`, [spec.yLabel ?? t.cat, ...spec.columns],
      spec.rows.map((l, r) => ({ th: l, cells: spec.values[r]!.map((v) => (v === null ? null : fmt(v))) })));
    return frame(ctx, spec, svg, desc, lg, wrapTable(spec.table ?? 'details', t, tbl));
  },
});
