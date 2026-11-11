// Scatter plot: numeric x/y points, optional groups as coloured series. Also hosts the shared x/y engine used by bubble.ts.
// Hovering or focusing a point keeps its series lit and fades the others (scatter.css). Named points can carry their
// name next to the mark (`pointLabels`; on by default for bubbles), placed right, left, above or below the mark,
// wherever it neither covers another label nor another mark.
import type { BaseSpec, Unit, Value } from '../types.ts';
import { definePlugin } from '../plugin.ts';
import { BASE, type Dict, MAX_POINTS, MAX_SERIES, base, color, dict, fail, idList, optBool, optNum, optStr, put, str, unit, value } from '../check.ts';
import { type Fmt, clamp, esc, makeFmt, n2, niceTicks, truncate, tw } from '../format.ts';
import { type Ctx, FS, MAX_FOCUS, colorAttrs, empty, frame, legend, table, wrapTable } from '../kit.ts';
import { inkText, labelLayer, seriesPt } from './cmp.ts';

export interface ScatterPoint {
  x: Value;
  y: Value;
  /** Optional point name shown in the value box and table, e.g. an app or campaign name. */
  label?: string;
}

export interface ScatterSeries {
  id: string;
  name: string;
  points: ScatterPoint[];
  color?: string;
  quality?: string;
}

export interface ScatterSpec extends BaseSpec {
  type: 'scatter';
  /** One series per group; a single series draws an ungrouped scatter (no legend). */
  series: ScatterSeries[];
  xLabel?: string;
  yLabel?: string;
  /** Number format of x values (`unit` formats y). */
  xUnit?: Unit;
  /** Axis bounds extend the nice domain; data outside them is never clipped. */
  xMin?: number;
  xMax?: number;
  yMin?: number;
  yMax?: number;
  /** Write each named point's label next to its mark (default false for scatter, true for bubble). */
  pointLabels?: boolean;
}

// ---- shared x/y engine (scatter + bubble) ----

/** Structural shape of the specs the x/y engine draws. */
export interface XYSpec extends BaseSpec {
  type: string;
  series: { id: string; name: string; color?: string; quality?: string; points: { x: Value; y: Value; size?: Value; label?: string }[] }[];
  xLabel?: string;
  yLabel?: string;
  xUnit?: Unit;
  xMin?: number;
  xMax?: number;
  yMin?: number;
  yMax?: number;
  sizeLabel?: string;
  sizeUnit?: Unit;
  pointLabels?: boolean;
}

export const XY_KEYS = ['series', 'xLabel', 'yLabel', 'xUnit', 'xMin', 'xMax', 'yMin', 'yMax', 'pointLabels'] as const;

/** Validate the shared x/y fields of `o` into `out`. `withSize` requires a `size` (>= 0 or null) on every point. */
export function validateXY(o: Dict, out: Record<string, unknown>, withSize: boolean): void {
  let total = 0;
  out.series = idList(o.series, 'series', ['name', 'points', 'color', 'quality'], MAX_SERIES, (s, p, id) => {
    const so: Record<string, unknown> = { id, name: str(s.name, `${p}.name`, 80) };
    const pts = s.points;
    if (!Array.isArray(pts)) fail(`${p}.points`, 'must be an array');
    total += pts.length;
    if (total > MAX_POINTS) fail(`${p}.points`, `must have at most ${MAX_POINTS} entries`);
    so.points = pts.map((q, i) => {
      const pp = `${p}.points[${i}]`;
      const d = dict(q, pp, withSize ? ['x', 'y', 'size', 'label'] : ['x', 'y', 'label']);
      const po: Record<string, unknown> = { x: value(d.x, `${pp}.x`), y: value(d.y, `${pp}.y`) };
      if (withSize) po.size = value(d.size, `${pp}.size`, 0);
      put(po, 'label', optStr(d.label, `${pp}.label`, 60));
      return po;
    });
    put(so, 'color', color(s.color, `${p}.color`));
    put(so, 'quality', optStr(s.quality, `${p}.quality`, 60));
    return so;
  });
  put(out, 'xLabel', optStr(o.xLabel, 'xLabel', 60));
  put(out, 'yLabel', optStr(o.yLabel, 'yLabel', 60));
  put(out, 'xUnit', unit(o.xUnit, 'xUnit'));
  put(out, 'pointLabels', optBool(o.pointLabels, 'pointLabels'));
  for (const ax of ['x', 'y'] as const) {
    const lo = optNum(o[`${ax}Min`], `${ax}Min`, -1e15, 1e15);
    const hi = optNum(o[`${ax}Max`], `${ax}Max`, -1e15, 1e15);
    if (lo !== undefined && hi !== undefined && lo >= hi) fail(`${ax}Max`, `must be greater than ${ax}Min`);
    put(out, `${ax}Min`, lo);
    put(out, `${ax}Max`, hi);
  }
}

interface Pt { s: number; i: number; x: number; y: number; size: number; label: string }

/** Pearson correlation of a point set (null for fewer than 3 points or zero variance). */
export function pearson(pts: { x: number; y: number }[]): number | null {
  const n = pts.length;
  if (n < 3) return null;
  const mx = pts.reduce((a, p) => a + p.x, 0) / n;
  const my = pts.reduce((a, p) => a + p.y, 0) / n;
  let sxy = 0; let sxx = 0; let syy = 0;
  for (const p of pts) { sxy += (p.x - mx) * (p.y - my); sxx += (p.x - mx) ** 2; syy += (p.y - my) ** 2; }
  if (sxx === 0 || syy === 0) return null;
  return sxy / Math.sqrt(sxx * syy);
}

const SIZE_NAME = { ko: '크기', en: 'Size' } as const;

/** Domain with nice ticks covering the data and optional bounds. */
function axisDomain(vals: number[], lo: number | undefined, hi: number | undefined, count: number) {
  let a = Math.min(...vals); let b = Math.max(...vals);
  if (lo !== undefined) a = Math.min(a, lo);
  if (hi !== undefined) b = Math.max(b, hi);
  return niceTicks(a, b, count);
}

/** Render a scatter (bubble = false) or bubble chart (circle area proportional to size). */
export function renderXY(spec: XYSpec, ctx: Ctx, bubble: boolean): string {
  const t = ctx.t;
  const raw = spec.series.flatMap((s) => s.points);
  const fmtY = makeFmt(spec.unit, raw.map((p) => p.y));
  const fmtX = makeFmt(spec.xUnit, raw.map((p) => p.x));
  const fmtS: Fmt = makeFmt(spec.sizeUnit, raw.map((p) => p.size ?? null));
  const xName = spec.xLabel ?? 'x';
  const yName = spec.yLabel ?? 'y';
  const sName = spec.sizeLabel ?? SIZE_NAME[ctx.lang];
  const pts: Pt[] = [];
  spec.series.forEach((se, s) => se.points.forEach((p, i) => {
    if (p.x === null || p.y === null) return;
    if (bubble && (p.size === null || p.size === undefined)) return;
    pts.push({ s, i, x: p.x, y: p.y, size: p.size ?? 0, label: p.label ?? `#${i + 1}` });
  }));
  const multi = spec.series.length > 1;
  const maxSize = Math.max(0, ...pts.map((p) => p.size));
  let inner = '';
  let rMax = 0;
  if (!pts.length) inner = empty(ctx);
  else {
    const fs = FS;
    const yd = axisDomain(pts.map((p) => p.y), spec.yMin, spec.yMax, ctx.H < 220 ? 4 : 5);
    const yLabs = yd.ticks.map(fmtY);
    const left = Math.max(...yLabs.map((l) => tw(l, fs))) + 10 + (spec.yLabel ? fs + 8 : 0);
    const top = 10;
    const bottom = fs + 12 + (spec.xLabel ? fs + 8 : 0);
    // fewer x ticks until the labels fit side by side
    let count = ctx.W < 420 ? 5 : 7;
    let xd = axisDomain(pts.map((p) => p.x), spec.xMin, spec.xMax, count);
    let xLabs = xd.ticks.map(fmtX);
    let right = 10;
    for (;;) {
      right = Math.max(10, tw(xLabs[xLabs.length - 1] ?? '', fs) / 2 + 4);
      const need = Math.max(...xLabs.map((l) => tw(l, fs))) + 10;
      if (count <= 2 || need * xLabs.length <= ctx.W - left - right) break;
      count--;
      xd = axisDomain(pts.map((p) => p.x), spec.xMin, spec.xMax, count);
      xLabs = xd.ticks.map(fmtX);
    }
    const px = left; const py = top;
    const pw = Math.max(20, ctx.W - left - right); const ph = Math.max(20, ctx.H - top - bottom);
    rMax = bubble ? clamp(Math.min(pw, ph) * 0.08, 6, 32) : 0;
    const dotR = ctx.W < 420 ? 3.5 : 4.5;
    const inset = bubble ? rMax : dotR + 2;
    const sx = (v: number): number => px + inset + ((v - xd.min) / (xd.max - xd.min || 1)) * (pw - 2 * inset);
    const sy = (v: number): number => py + ph - inset - ((v - yd.min) / (yd.max - yd.min || 1)) * (ph - 2 * inset);
    let s = '';
    yd.ticks.forEach((tk, k) => {
      const y = sy(tk);
      s += `<line class="lc-grid" x1="${n2(px)}" y1="${n2(y)}" x2="${n2(px + pw)}" y2="${n2(y)}"/>`;
      s += `<text class="lc-tick" x="${n2(px - 6)}" y="${n2(y + fs * 0.35)}" text-anchor="end">${esc(yLabs[k] ?? '')}</text>`;
    });
    xd.ticks.forEach((tk, k) => {
      const x = sx(tk);
      const l = xLabs[k] ?? '';
      const w = tw(l, fs);
      s += `<line class="lc-grid" x1="${n2(x)}" y1="${n2(py)}" x2="${n2(x)}" y2="${n2(py + ph)}"/>`;
      s += `<text class="lc-tick" x="${n2(clamp(x - w / 2, 2, ctx.W - w - 2))}" y="${n2(py + ph + fs + 6)}">${esc(l)}</text>`;
    });
    s += `<line class="lc-axis" x1="${n2(px)}" y1="${n2(py + ph)}" x2="${n2(px + pw)}" y2="${n2(py + ph)}"/>`;
    s += `<line class="lc-axis" x1="${n2(px)}" y1="${n2(py)}" x2="${n2(px)}" y2="${n2(py + ph)}"/>`;
    if (spec.xLabel) s += `<text class="lc-axis-title" x="${n2(px + pw / 2)}" y="${n2(ctx.H - 3)}" text-anchor="middle">${esc(truncate(spec.xLabel, pw, fs))}</text>`;
    if (spec.yLabel) {
      const yx = fs; const yy = py + ph / 2;
      s += `<text class="lc-axis-title" x="${n2(yx)}" y="${n2(yy)}" text-anchor="middle" transform="rotate(-90 ${n2(yx)} ${n2(yy)})">${esc(truncate(spec.yLabel, ph, fs))}</text>`;
    }
    // bubbles: largest first so small ones stay visible and focusable on top
    const order = bubble ? [...pts].sort((a, b) => b.size - a.size || a.s - b.s || a.i - b.i) : pts;
    const focus = pts.length <= MAX_FOCUS;
    let marks = '';
    const geo: { cx: number; cy: number; r: number }[] = [];
    for (const p of order) {
      const se = spec.series[p.s];
      if (!se) continue;
      const cx = sx(p.x); const cy = sy(p.y);
      const r = bubble ? (maxSize > 0 ? Math.sqrt(p.size / maxSize) * rMax : 0) : dotR;
      geo.push({ cx, cy, r });
      const circle = `<circle class="lc-mark lc-point ${colorAttrs(p.s, se.color)} data-s="${p.s}" data-i="${p.i}" data-x="${p.x}" data-v="${p.y}"${bubble ? ` data-size="${p.size}"` : ''} cx="${n2(cx)}" cy="${n2(cy)}" r="${n2(r)}"/>`;
      if (!focus) { marks += circle; continue; }
      const text = `${p.label}, ${se.name}: ${xName} ${fmtX(p.x)}, ${yName} ${fmtY(p.y)}${bubble ? `, ${sName} ${fmtS(p.size)}` : ''}${se.quality ? ` · ${se.quality}` : ''}`;
      marks += seriesPt(ctx, 'lc-pt-point', p.s, text, `<circle class="lc-hit" cx="${n2(cx)}" cy="${n2(cy)}" r="${n2(Math.max(8, r))}"/>${circle}`, cx, cy - r);
    }
    // Point names: right of the mark, else left, above or below; a spot is taken when it would cover a placed label
    // or another mark, and a name with no free spot is left to the value box.
    let names = '';
    if (spec.pointLabels ?? bubble) {
      const named = order.map((p, k) => ({ p, g: geo[k] as (typeof geo)[number] })).filter((e) => spec.series[e.p.s]?.points[e.p.i]?.label);
      const placed: { x0: number; y0: number; x1: number; y1: number }[] = [];
      const hits = (b: (typeof placed)[number]): boolean =>
        placed.some((o) => b.x0 < o.x1 && b.x1 > o.x0 && b.y0 < o.y1 && b.y1 > o.y0) ||
        geo.some((g) => b.x0 < g.cx + g.r && b.x1 > g.cx - g.r && b.y0 < g.cy + g.r && b.y1 > g.cy - g.r);
      for (const { p, g } of named) {
        const name = p.label;
        const w = tw(name, FS); const h = FS + 2;
        const spots: [number, number, 'start' | 'middle' | 'end'][] = [
          [g.cx + g.r + 4, g.cy, 'start'], [g.cx - g.r - 4, g.cy, 'end'], [g.cx, g.cy - g.r - 4 - h / 2, 'middle'], [g.cx, g.cy + g.r + 4 + h / 2, 'middle'],
        ];
        for (const [x, y, anchor] of spots) {
          const x0 = anchor === 'start' ? x : anchor === 'end' ? x - w : x - w / 2;
          const box = { x0, y0: y - h / 2, x1: x0 + w, y1: y + h / 2 };
          if (box.x0 < px - 2 || box.x1 > px + pw + 2 || box.y0 < py - 2 || box.y1 > py + ph + 2 || hits(box)) continue;
          placed.push(box);
          names += inkText(x, y + FS * 0.35, name, anchor);
          break;
        }
      }
    }
    inner = s + marks + labelLayer(names);
  }

  const total = raw.length;
  const desc = `${pts.length}${t.items}${total > pts.length ? `, ${t.missing} ${total - pts.length}` : ''}. ` + spec.series.map((se, s) => {
    const mine = pts.filter((p) => p.s === s);
    const miss = se.points.length - mine.length;
    const q = se.quality ? ` ${t.quality}: ${se.quality}.` : '';
    if (!mine.length) return `${se.name}: ${t.na}.${q}`;
    const xs = mine.map((p) => p.x); const ys = mine.map((p) => p.y);
    const r = pearson(mine);
    const parts = [
      `${mine.length}${t.items}`,
      `${xName} ${fmtX(Math.min(...xs))}–${fmtX(Math.max(...xs))}`,
      `${yName} ${fmtY(Math.min(...ys))}–${fmtY(Math.max(...ys))}`,
    ];
    if (bubble) { const ss = mine.map((p) => p.size); parts.push(`${sName} ${fmtS(Math.min(...ss))}–${fmtS(Math.max(...ss))}`); }
    if (r !== null) parts.push(`r=${n2(r)}`);
    if (miss) parts.push(`${t.missing} ${miss}`);
    return `${se.name}: ${parts.join(', ')}.${q}`;
  }).join(' ');

  let lg = (spec.legend ?? multi) ? legend(spec.series.map((se, i) => ({ name: se.name, idx: i, ...(se.color ? { color: se.color } : {}), ...(se.quality ? { quality: se.quality } : {}) }))) : '';
  if (bubble && pts.length && maxSize > 0 && spec.legend !== false) lg += sizeLegend(sName, maxSize, rMax, fmtS);

  const head = [t.cat, ...(multi ? [t.series] : []), xName, yName, ...(bubble ? [sName] : [])];
  const rows = spec.series.flatMap((se) => se.points.map((p, i) => {
    const f = (v: Value | undefined, fm: Fmt): string | null => (v === null || v === undefined ? null : fm(v));
    return {
      th: p.label ?? `#${i + 1}`,
      cells: [
        ...(multi ? [`${se.name}${se.quality ? ` (${se.quality})` : ''}`] : []),
        f(p.x, fmtX), f(p.y, fmtY), ...(bubble ? [f(p.size, fmtS)] : []),
      ],
    };
  }));
  return frame(ctx, spec, inner, desc, lg, wrapTable(spec.table ?? 'details', t, table(t, spec.title, head, rows)));
}

/** Size key for bubbles: the largest size plus two rounded smaller ones, drawn at the same area scale. */
function sizeLegend(name: string, maxSize: number, rMax: number, fmt: Fmt): string {
  const vals = [maxSize, Number((maxSize / 4).toPrecision(1)), Number((maxSize / 16).toPrecision(1))]
    .filter((v, k, a) => v > 0 && v <= maxSize && a.indexOf(v) === k);
  const items = vals.map((v) => {
    const r = Math.sqrt(v / maxSize) * rMax;
    const d = 2 * r + 2;
    return `<span class="lc-size-item"><svg class="lc-size-svg" xmlns="http://www.w3.org/2000/svg" width="${n2(d)}" height="${n2(d)}" viewBox="0 0 ${n2(d)} ${n2(d)}" aria-hidden="true" focusable="false"><circle class="lc-size-sw" cx="${n2(d / 2)}" cy="${n2(d / 2)}" r="${n2(r)}"/></svg><span class="lc-lv">${esc(fmt(v))}</span></span>`;
  }).join('');
  return `<div class="lc-size-legend"><span class="lc-ln">${esc(name)}</span>${items}</div>`;
}

export const plugin = definePlugin<ScatterSpec>({
  type: 'scatter',
  names: { ko: '산점도', en: 'Scatter plot' },
  validate(input) {
    const o = dict(input, 'spec', [...BASE, ...XY_KEYS]);
    const out = base(o);
    out.type = 'scatter';
    validateXY(o, out, false);
    return out as unknown as ScatterSpec;
  },
  height: (_spec, w) => (w < 420 ? 260 : 320),
  render: (spec, ctx) => renderXY(spec, ctx, false),
});
