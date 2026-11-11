// Pareto chart: categories sorted by value (descending) as bars, plus the cumulative share as a line on a
// right-hand 0-100% axis and a guide at the threshold (default 80%). Missing values are left off the axis,
// listed under the chart and excluded from the cumulative total.
// Each bar carries its value (inside the bar top when the bar is tall enough, else above it) and each dot of the
// cumulative line its share; hovering a column keeps it and fades the rest (cmp.css).
import type { BaseSpec, Value } from '../types.ts';
import { definePlugin } from '../plugin.ts';
import { BASE, base, color, dict, idList, optNum, optStr, put, str, value } from '../check.ts';
import { clamp, esc, makeFmt, n2, tw } from '../format.ts';
import { type Ctx, FS, MAX_FOCUS, colorAttrs, empty, focusable, frame, legend, pct, table, wrapTable } from '../kit.ts';
import { VAL, inkText, labelLayer, valueText } from './cmp.ts';
import { catAxes, missingNote, sortOrder, valueDomain } from './lollipop.ts';

export interface ParetoItem { id: string; label: string; value: Value; quality?: string }

export interface ParetoSpec extends BaseSpec {
  type: 'pareto';
  items: ParetoItem[];
  /** Guide line on the cumulative axis in percent (default 80). */
  threshold?: number;
  /** Bar colour override (default series colour 1). */
  color?: string;
  /** Cumulative line colour override (default series colour 2). */
  lineColor?: string;
  xLabel?: string;
}

export const MAX_PARETO_ITEMS = 200;
const RIGHT_TICKS = [0, 20, 40, 60, 80, 100];

export interface ParetoRow { i: number; item: ParetoItem; v: number; share: number | null; cum: number | null }

/** Present items sorted descending with their share and cumulative share (0..1); null shares when the total is 0. */
export function paretoRows(items: ParetoItem[]): ParetoRow[] {
  const order = sortOrder(items.map((it) => it.value), 'desc').filter((i) => items[i]?.value !== null);
  const total = order.reduce((a, i) => a + ((items[i]?.value as number) ?? 0), 0);
  let run = 0;
  return order.map((i) => {
    const item = items[i] as ParetoItem; const v = item.value as number;
    run += v;
    return { i, item, v, share: total > 0 ? v / total : null, cum: total > 0 ? run / total : null };
  });
}

function render(spec: ParetoSpec, ctx: Ctx): string {
  const t = ctx.t;
  const L = ctx.lang === 'ko' ? { cum: '누적', vital: '상위' } : { cum: 'Cumulative', vital: 'Top' };
  const thr = (spec.threshold ?? 80) / 100;
  const items = spec.items;
  const fmt = makeFmt(spec.unit, items.map((it) => it.value));
  const rows = paretoRows(items);
  const missing = items.filter((it) => it.value === null);
  const reach = rows.findIndex((r) => r.cum !== null && r.cum >= thr - 1e-9);
  const aria = (r: ParetoRow): string =>
    `${r.item.label}: ${fmt(r.v)}${r.share !== null ? ` · ${t.share} ${pct(r.share)} · ${L.cum} ${pct(r.cum as number)}` : ''}${r.item.quality ? ` · ${r.item.quality}` : ''}`;
  let inner = '';
  if (!rows.length) inner = empty(ctx);
  else {
    const dom = valueDomain(0, Math.max(...rows.map((r) => r.v)), ctx.H - 60, true);
    const rw = tw('100%', FS) + 10;
    const ax = catAxes(ctx, {
      labels: rows.map((r) => r.item.label), dom, fmt, horizontal: false, right: rw, bottom: missing.length ? FS + 8 : 0,
      ...(spec.xLabel ? { xLabel: spec.xLabel } : {}),
    });
    const py = (p: number): number => ax.py + ax.ph - p * ax.ph;
    const xr = ax.px + ax.pw;
    let s = `<line class="lc-axis" x1="${n2(xr)}" y1="${n2(ax.py)}" x2="${n2(xr)}" y2="${n2(ax.py + ax.ph)}"/>`;
    for (const p of RIGHT_TICKS) s += `<text class="lc-tick lc-pareto-tick" x="${n2(xr + 6)}" y="${n2(py(p / 100) + FS * 0.35)}">${p}%</text>`;
    const gy = py(thr);
    const thrText = pct(thr);
    s += `<line class="lc-pareto-guide" x1="${n2(ax.px)}" y1="${n2(gy)}" x2="${n2(xr)}" y2="${n2(gy)}"/>`;
    // Guide label at the right end of the guide, where the cumulative line has already passed above it.
    s += `<text class="lc-pareto-guide-lbl" x="${n2(xr - 4)}" y="${n2(Math.max(FS, gy - 4))}" text-anchor="end">${esc(thrText)}</text>`;
    const bw = Math.max(1, ax.band * 0.7);
    const focus = rows.length <= MAX_FOCUS;
    const hasLine = rows[0]?.cum !== null;
    const line = hasLine ? `<path class="lc-pareto-line ${colorAttrs(1, spec.lineColor)} d="M${rows.map((r, k) => `${n2(ax.cc(k))} ${n2(py(r.cum as number))}`).join(' L')}"/>` : '';
    // bars below the cumulative line; the focus group (hit area over the bar column + dot) on top so tips stay visible
    let barsSvg = '';
    let marks = '';
    let lbl = '';
    rows.forEach((r, k) => {
      const x = ax.cc(k);
      const y0 = ax.vv(r.v);
      // Bar value: inside the bar top (surface colour) when tall and wide enough, else above the bar when the
      // cumulative dot is not right there. Cumulative share above its dot (ink, halo) when the column is wide enough.
      const vt = fmt(r.v); const vw = tw(vt, VAL) * 1.06;
      const dotY = r.cum !== null ? py(r.cum) : -Infinity;
      if (vw <= bw - 6 && ax.zero - y0 >= VAL + 10) lbl += valueText(x, y0 + VAL + 4, vt, 'lc-pareto-in"', 'middle');
      else if (vw <= ax.band - 2 && Math.abs(dotY - (y0 - 6)) > VAL + 4) lbl += valueText(x, Math.max(VAL, y0 - 5), vt, colorAttrs(0, spec.color), 'middle');
      if (r.cum !== null && dotY < y0 - 4 && tw(pct(r.cum), 11) <= ax.band - 2) lbl += inkText(x, Math.max(11, dotY - 8), pct(r.cum), 'middle', Infinity, 'lc-cm-muted');
      const tail = reach >= 0 && k > reach ? ' lc-pareto-tail' : '';
      barsSvg += `<rect class="lc-mark lc-pareto-bar${tail} ${colorAttrs(0, spec.color)} data-i="${r.i}" data-v="${r.v}" x="${n2(x - bw / 2)}" y="${n2(y0)}" width="${n2(bw)}" height="${n2(Math.max(r.v > 0 ? 1 : 0, ax.zero - y0))}"/>`;
      let g = focus ? `<rect class="lc-hit" x="${n2(x - ax.band / 2)}" y="${n2(ax.py)}" width="${n2(ax.band)}" height="${n2(ax.ph)}"/>` : '';
      if (r.cum !== null) {
        g += `<circle class="lc-mark lc-pareto-dot ${colorAttrs(1, spec.lineColor)} data-i="${r.i}" data-v="${Math.round(r.cum * 10000) / 100}" cx="${n2(x)}" cy="${n2(py(r.cum))}" r="${n2(clamp(ax.band * 0.15, 2, 3.5))}"/>`;
      }
      marks += focus ? focusable(ctx, 'lc-pt-pareto', aria(r), g, x, Math.min(y0, r.cum !== null ? py(r.cum) : y0)) : g;
    });
    inner = ax.svg + s + barsSvg + line + marks + labelLayer(lbl) + missingNote(ctx, missing.map((it) => it.label));
  }
  const total = rows.reduce((a, r) => a + r.v, 0);
  let desc = `${items.length}${t.items}. ${t.total} ${fmt(total)}.`;
  if (rows.length) desc += ` ${t.max} ${rows[0]?.item.label} ${fmt(rows[0]?.v ?? 0)}.`;
  if (reach >= 0) desc += ` ${L.vital} ${reach + 1}${ctx.lang === 'ko' ? '개' : ''} → ${pct(thr)}+ (${pct(rows[reach]?.cum ?? 0)}): ${rows.slice(0, reach + 1).map((r) => r.item.label).join(', ')}.`;
  if (missing.length) desc += ` ${t.missing} ${missing.length}.`;
  const q = items.filter((it) => it.quality);
  if (q.length) desc += ` ${t.quality}: ${q.map((it) => `${it.label} ${it.quality}`).join(', ')}.`;
  const lg = spec.legend === false ? '' : legend([
    { name: t.value, idx: 0, ...(spec.color ? { color: spec.color } : {}) },
    { name: `${L.cum} ${t.share}`, idx: 1, ...(spec.lineColor ? { color: spec.lineColor } : {}) },
  ]);
  const tbl = table(t, spec.title, [t.cat, t.value, t.share, `${L.cum} ${t.share}`], [
    ...rows.map((r) => ({ th: `${r.item.label}${r.item.quality ? ` (${r.item.quality})` : ''}`, cells: [fmt(r.v), r.share === null ? null : pct(r.share), r.cum === null ? null : pct(r.cum)] })),
    ...missing.map((it) => ({ th: `${it.label}${it.quality ? ` (${it.quality})` : ''}`, cells: [null, null, null] })),
  ]);
  return frame(ctx, spec, inner, desc, lg, wrapTable(spec.table ?? 'details', t, tbl));
}

export const plugin = definePlugin<ParetoSpec>({
  type: 'pareto',
  names: { ko: '파레토 차트', en: 'Pareto chart' },
  validate(input) {
    const o = dict(input, 'spec', [...BASE, 'items', 'threshold', 'color', 'lineColor', 'xLabel']);
    const out = base(o);
    out.type = 'pareto';
    out.items = idList(o.items, 'items', ['label', 'value', 'quality'], MAX_PARETO_ITEMS, (it, p, id) => {
      const r: Record<string, unknown> = { id, label: str(it.label, `${p}.label`, 60), value: value(it.value, `${p}.value`, 0) };
      put(r, 'quality', optStr(it.quality, `${p}.quality`, 60));
      return r;
    });
    put(out, 'threshold', optNum(o.threshold, 'threshold', 1, 99));
    put(out, 'color', color(o.color, 'color'));
    put(out, 'lineColor', color(o.lineColor, 'lineColor'));
    put(out, 'xLabel', optStr(o.xLabel, 'xLabel', 80));
    return out as unknown as ParetoSpec;
  },
  height: () => 320,
  render,
});
