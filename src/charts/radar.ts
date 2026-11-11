// Radar chart: one spoke per axis around a circle, all on a shared 0..max scale; one polygon per series.
// A null axis value is a gap: the two polygon edges touching it are not drawn and the area is not filled.
// Hovering or focusing a point keeps its series (area, outline, dots) lit and fades the others (radar.css).
import type { BaseSpec, Series } from '../types.ts';
import { definePlugin } from '../plugin.ts';
import { BASE, base, dict, fail, labels, optNum, seriesList } from '../check.ts';
import { clamp, esc, makeFmt, n2, niceTicks, truncate, tw } from '../format.ts';
import { type Ctx, FS, MAX_FOCUS, colorAttrs, empty, frame, legend, present, seriesTable, wrapTable } from '../kit.ts';
import { seriesPt } from './cmp.ts';

export interface RadarSpec extends BaseSpec {
  type: 'radar';
  /** Axis names, 3..24, clockwise from the top. */
  axes: string[];
  /** One value per axis per series (>= 0); null = missing. */
  series: Series[];
  /** Outer ring value; extended (never clipped) when data exceeds it. */
  max?: number;
}

const MAX_AXES = 24;

export const plugin = definePlugin<RadarSpec>({
  type: 'radar',
  names: { ko: '방사형 차트', en: 'Radar chart' },
  validate(input) {
    const o = dict(input, 'spec', [...BASE, 'axes', 'series', 'max']);
    const out = base(o) as unknown as RadarSpec;
    out.type = 'radar';
    out.axes = labels(o.axes, 'axes');
    if (out.axes.length < 3) fail('axes', 'must have at least 3 entries');
    if (out.axes.length > MAX_AXES) fail('axes', `must have at most ${MAX_AXES} entries`);
    out.series = seriesList(o.series, 'series', out.axes.length, true);
    const m = optNum(o.max, 'max', 0, 1e15);
    if (m !== undefined) out.max = m;
    return out;
  },
  height(_spec, W) {
    return W < 420 ? 300 : 360;
  },
  render(spec, ctx: Ctx) {
    const t = ctx.t;
    const n = spec.axes.length;
    const all = spec.series.flatMap((s) => s.values);
    const vals = present(all);
    const fmt = makeFmt(spec.unit, all);
    const missing = all.length - vals.length;
    const q = (s: Series): string => (s.quality ? ` · ${s.quality}` : '');
    let svg = '';
    if (!vals.length) svg = empty(ctx);
    else {
      const rd = niceTicks(0, Math.max(spec.max ?? 0, ...vals), 5);
      const rmax = rd.max || 1;
      const labMax = clamp(ctx.W * 0.2, 36, 130);
      const labs = spec.axes.map((a) => truncate(a, labMax, FS));
      const lw = Math.max(...labs.map((l) => tw(l, FS)));
      const R = Math.max(24, Math.min((ctx.W - 2 * (lw + 14)) / 2, (ctx.H - 2 * (FS + 12)) / 2));
      const cx = ctx.W / 2;
      const cy = ctx.H / 2;
      const ang = (k: number): number => -Math.PI / 2 + (2 * Math.PI * k) / n;
      const pt = (k: number, v: number): [number, number] => [cx + Math.cos(ang(k)) * R * (v / rmax), cy + Math.sin(ang(k)) * R * (v / rmax)];
      const xy = (p: [number, number]): string => `${n2(p[0])} ${n2(p[1])}`;
      for (const tk of rd.ticks) {
        if (tk <= 0) continue;
        svg += `<polygon class="lc-grid lc-radar-ring" points="${spec.axes.map((_, k) => xy(pt(k, tk)).replace(' ', ',')).join(' ')}"/>`;
      }
      spec.axes.forEach((_, k) => {
        const [x, y] = pt(k, rmax);
        svg += `<line class="lc-grid" x1="${n2(cx)}" y1="${n2(cy)}" x2="${n2(x)}" y2="${n2(y)}"/>`;
      });
      // ring values sit on the bisector between the first two spokes, away from the axis labels
      const ta = -Math.PI / 2 + Math.PI / n;
      for (const tk of rd.ticks) {
        if (tk <= 0) continue;
        const r = R * (tk / rmax);
        svg += `<text class="lc-tick lc-radar-tick" x="${n2(cx + Math.cos(ta) * r + 3)}" y="${n2(cy + Math.sin(ta) * r - 2)}">${esc(fmt(tk))}</text>`;
      }
      labs.forEach((l, k) => {
        const c = Math.cos(ang(k));
        const s = Math.sin(ang(k));
        const w = tw(l, FS);
        const anchor = Math.abs(c) < 0.25 ? 'middle' : c > 0 ? 'start' : 'end';
        let x = cx + c * (R + 8);
        if (anchor === 'start') x = Math.min(x, ctx.W - w - 2);
        else if (anchor === 'end') x = Math.max(x, w + 2);
        else x = clamp(x, w / 2 + 2, ctx.W - w / 2 - 2);
        const y = cy + s * (R + 8) + FS * 0.36 + s * FS * 0.45;
        svg += `<text class="lc-radar-axis" x="${n2(x)}" y="${n2(y)}" text-anchor="${anchor}">${esc(l)}</text>`;
      });
      const canFocus = vals.length <= MAX_FOCUS;
      // Areas and outlines first, every series' dots after them, so a value box is never covered by a later area.
      let dotsSvg = '';
      spec.series.forEach((s, si) => {
        const ca = colorAttrs(si, s.color);
        const ok = (k: number): boolean => s.values[((k % n) + n) % n] !== null;
        const P = s.values.map((v, k) => (v === null ? null : pt(k, v)));
        let d = '';
        let area = '';
        if (s.values.every((v) => v !== null)) {
          d = `M${(P as [number, number][]).map(xy).join('L')}Z`;
          area = `<polygon class="lc-radar-area ${ca} points="${(P as [number, number][]).map((p) => `${n2(p[0])},${n2(p[1])}`).join(' ')}"/>`;
        } else {
          const start = s.values.findIndex((v) => v === null);
          for (let j = 1; j <= n; j++) {
            const k = (start + j) % n;
            const p = P[k];
            if (!p) continue;
            d += `${ok(k - 1) && j > 1 ? 'L' : 'M'}${xy(p)}`;
          }
        }
        let dots = '';
        s.values.forEach((v, k) => {
          const p = P[k];
          if (v === null || !p) return;
          const dot = `<circle class="lc-mark lc-radar-dot ${ca} data-i="${k}" data-s="${si}" data-v="${v}" cx="${n2(p[0])}" cy="${n2(p[1])}" r="3.5"/>`;
          dots += canFocus ? seriesPt(ctx, 'lc-pt-radar', si, `${spec.axes[k]}, ${s.name}: ${fmt(v)}${q(s)}`, dot, p[0], p[1]) : dot;
        });
        svg += `<g class="lc-radar-s ${ca} data-s="${si}">${area}${d ? `<path class="lc-radar-line ${ca} d="${d}"/>` : ''}</g>`;
        dotsSvg += canFocus ? dots : `<g class="lc-radar-s ${ca} data-s="${si}">${dots}</g>`;
      });
      svg += `<g class="lc-radar-dots">${dotsSvg}</g>`;
    }

    const desc = spec.series.map((s) => {
      const vs = present(s.values);
      const miss = s.values.length - vs.length;
      if (!vs.length) return `${s.name}: ${t.na}.`;
      const hi = Math.max(...vs);
      const lo = Math.min(...vs);
      return `${s.name}: ${t.max} ${fmt(hi)} (${spec.axes[s.values.indexOf(hi)]}), ${t.min} ${fmt(lo)} (${spec.axes[s.values.indexOf(lo)]})${miss ? `, ${t.missing} ${miss}` : ''}.${s.quality ? ` ${t.quality}: ${s.quality}.` : ''}`;
    }).join(' ') + (missing ? ` ${t.missing} ${missing}.` : '');
    const showLegend = spec.legend === true || (spec.legend !== false && spec.series.length > 1);
    const lg = showLegend ? legend(spec.series.map((s, i) => ({ name: s.name, idx: i, ...(s.color ? { color: s.color } : {}), ...(s.quality ? { quality: s.quality } : {}) }))) : '';
    return frame(ctx, spec, svg, desc, lg, wrapTable(spec.table ?? 'details', t, seriesTable(t, spec.title, t.cat, spec.axes, spec.series, fmt)));
  },
});
