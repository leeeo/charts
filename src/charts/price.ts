// Price chart: closing prices as a line (or area) with an optional volume pane under it on the same x axis.
// Indicator overlays (SMA / EMA / Bollinger) are computed from the given closes. A null close is a gap: the line
// breaks, indicator windows skip it, and the day's volume (if any) is still drawn.
// Readability (0.8.0): each day's value box comes with a crosshair, and the last close is written in bold at the
// right edge, tinted by its rise or fall against the previous close (fin.css).
import type { BaseSpec, Value } from '../types.ts';
import { definePlugin } from '../plugin.ts';
import { BASE, base, dict, labels, oneOf, optStr, values } from '../check.ts';
import { makeFmt, n2 } from '../format.ts';
import { type Ctx, MAX_FOCUS, colorAttrs, empty, focusable, frame, legend, pct, runs, table, wrapTable } from '../kit.ts';
import { CONVENTIONS, type Convention, FIN_L, type Overlay, convCls, crosshair, dirCls, dirOf, drawOverlays, lastTag, linePath, overlayLines, overlayValues, overlaysOf, timePanes, volBar, volumeOf } from './fin.ts';

export interface PriceSpec extends BaseSpec {
  type: 'price';
  /** One label per trading day. */
  dates: string[];
  /** Closing price per date; null = no trade / no data (gap). */
  close: Value[];
  /** Traded volume per date (>= 0 or null). */
  volume?: Value[];
  /** "line" (default) or "area". */
  style?: 'line' | 'area';
  overlays?: Overlay[];
  convention?: Convention;
  yLabel?: string;
}

function render(spec: PriceSpec, ctx: Ctx): string {
  const t = ctx.t;
  const L = FIN_L[ctx.lang];
  const n = spec.dates.length;
  const c = spec.close;
  const fmt = makeFmt(spec.unit, c);
  const fmtQ = (v: number): string => makeFmt(spec.unit, [...c, Math.round(v * 100) / 100])(v);
  const vfmt = makeFmt(undefined, spec.volume ?? []);
  const lines = overlayLines(ctx.lang, c, undefined, spec.overlays);
  const prev = (i: number): number | null => { for (let k = i - 1; k >= 0; k--) { const v = c[k]; if (v !== null && v !== undefined) return v; } return null; };
  const live = c.map((v, i) => (v === null ? -1 : i)).filter((i) => i >= 0);
  const dayText = (i: number): string => {
    const v = c[i];
    const pc = prev(i);
    const vol = spec.volume?.[i];
    const head = v === null || v === undefined ? `${spec.dates[i]}: ${L.close} ${t.na}` :
      `${spec.dates[i]}: ${L.close} ${fmt(v)}${pc !== null && pc !== 0 ? ` (${L.prev} ${v >= pc ? '+' : ''}${pct((v - pc) / pc)})` : ''}`;
    return head + (vol !== null && vol !== undefined ? ` · ${L.volume} ${vfmt(vol)}` : '') +
      lines.map((l) => { const x = l.v[i]; return x === null || x === undefined ? '' : ` · ${l.name} ${fmtQ(x)}`; }).join('');
  };
  let svg = '';
  if (!live.length) svg = empty(ctx);
  else {
    const vals = live.map((i) => c[i] as number);
    const ovs = overlayValues(lines);
    const p = timePanes(ctx, { dates: spec.dates, fmt, lo: Math.min(...vals, ...ovs), hi: Math.max(...vals, ...ovs), ...(spec.yLabel ? { yLabel: spec.yLabel } : {}), ...(spec.volume ? { volume: spec.volume } : {}) });
    svg += p.svg;
    if (spec.volume && p.vH > 0) spec.volume.forEach((v, i) => { if (v !== null) { const cv = c[i]; svg += volBar(p, i, v, cv === null || cv === undefined ? 0 : dirOf(cv, prev(i))); } });
    if (spec.style === 'area') {
      for (const r of runs(c).filter((x) => x.length > 1)) {
        const base = p.top + p.ph;
        svg += `<path class="lc-area lc-price-area ${colorAttrs(0)} d="M${n2(p.cx(r[0]!))} ${n2(base)}${r.map((i) => `L${n2(p.cx(i))} ${n2(p.sy(c[i] as number))}`).join('')}L${n2(p.cx(r[r.length - 1]!))} ${n2(base)}Z"/>`;
      }
    }
    svg += drawOverlays(lines, p);
    const d = linePath(c, p.cx, p.sy);
    if (d) svg += `<path class="lc-price-line ${colorAttrs(0)} d="${d}"/>`;
    const lastI = live[live.length - 1]!;
    const canFocus = n <= MAX_FOCUS;
    let marks = '';
    c.forEach((v, i) => {
      const solo = v !== null && (i === 0 || c[i - 1] === null) && (i === n - 1 || c[i + 1] === null);
      const dot = v === null ? '' : `<circle class="lc-mark lc-dot${i === lastI || solo ? ' lc-dot-vis' : ''} ${colorAttrs(0)} data-i="${i}" data-v="${v}" cx="${n2(p.cx(i))}" cy="${n2(p.sy(v))}" r="3"/>`;
      if (!canFocus) { if (i === lastI || solo) marks += dot; return; }
      if (v === null && (spec.volume?.[i] ?? null) === null) return;
      const hit = `<rect class="lc-hit" x="${n2(p.cx(i) - p.slot / 2)}" y="${n2(p.top)}" width="${n2(p.slot)}" height="${n2(p.bottom - p.top)}"/>`;
      marks += focusable(ctx, 'lc-pt-price', dayText(i), crosshair(p, i) + hit + dot, p.cx(i), v === null ? p.top + p.ph / 2 : p.sy(v));
    });
    const lv = c[lastI] as number;
    const pc = prev(lastI);
    const chg = pc !== null && pc !== 0 ? ` (${lv >= pc ? '+' : ''}${pct((lv - pc) / pc)})` : '';
    const spans = live.map((i) => ({ x: p.cx(i), y0: p.sy(c[i] as number) - 2, y1: p.sy(c[i] as number) + 2 }));
    svg += marks + lastTag(p, ctx, lastI, lv, fmt(lv) + chg, dirCls(dirOf(lv, pc)), spans);
  }
  let desc: string;
  if (live.length) {
    const fi = live[0]!; const li = live[live.length - 1]!;
    const f = c[fi] as number; const l = c[li] as number;
    const vals = live.map((i) => c[i] as number);
    const hi = Math.max(...vals); const lo = Math.min(...vals);
    desc = `${L.period} ${spec.dates[fi]}–${spec.dates[li]}, ${live.length}${L.days}. ${L.close} ${fmt(f)} → ${fmt(l)}${f !== 0 ? ` (${l >= f ? '+' : ''}${pct((l - f) / f)})` : ''}. ` +
      `${L.high} ${fmt(hi)} (${spec.dates[c.indexOf(hi)]}), ${L.low} ${fmt(lo)} (${spec.dates[c.indexOf(lo)]}).` +
      lines.map((x) => { const v = x.v[li]; return v === null || v === undefined ? '' : ` ${x.name} ${fmtQ(v)}.`; }).join('');
  } else desc = `${t.na}.`;
  const miss = n - live.length;
  if (miss) desc += ` ${t.missing} ${miss}.`;
  const lg = spec.legend === false ? '' : legend([{ name: L.close, idx: 0 }, ...lines.map((x) => ({ name: x.name, idx: x.idx }))]);
  const q = (v: Value | undefined): string | null => (v === null || v === undefined ? null : fmtQ(v));
  const head = [t.date, L.close, ...(spec.volume ? [L.volume] : []), ...lines.flatMap((x) => (x.upper ? [x.name, `${x.name} ${L.bbU}`, `${x.name} ${L.bbL}`] : [x.name]))];
  const tbl = table(t, spec.title, head, spec.dates.map((dt, i) => ({
    th: dt,
    cells: [c[i] === null || c[i] === undefined ? null : fmt(c[i] as number), ...(spec.volume ? [spec.volume[i] === null ? null : vfmt(spec.volume[i] as number)] : []),
      ...lines.flatMap((x) => (x.upper ? [q(x.v[i]), q(x.upper[i]), q(x.lower?.[i])] : [q(x.v[i])]))],
  })));
  const cls = convCls(spec.convention);
  return frame(ctx, spec, svg, desc, lg, wrapTable(spec.table ?? 'details', t, tbl), cls ? { cls } : {});
}

export const plugin = definePlugin<PriceSpec>({
  type: 'price',
  names: { ko: '주가 차트', en: 'Price chart' },
  validate(input) {
    const o = dict(input, 'spec', [...BASE, 'dates', 'close', 'volume', 'style', 'overlays', 'convention', 'yLabel']);
    const out = base(o) as unknown as PriceSpec;
    out.type = 'price';
    out.dates = labels(o.dates, 'dates');
    const n = out.dates.length;
    out.close = values(o.close, 'close', n, false);
    const vol = volumeOf(o.volume, n);
    if (vol !== undefined) out.volume = vol;
    const st = oneOf(o.style, 'style', ['line', 'area'] as const);
    if (st !== undefined) out.style = st;
    const ov = overlaysOf(o.overlays);
    if (ov !== undefined) out.overlays = ov;
    const cv = oneOf(o.convention, 'convention', CONVENTIONS);
    if (cv !== undefined) out.convention = cv;
    const yl = optStr(o.yLabel, 'yLabel', 60);
    if (yl !== undefined) out.yLabel = yl;
    return out;
  },
  height: (spec, W) => (spec.volume ? (W < 420 ? 300 : 360) : W < 420 ? 240 : 300),
  render,
});
