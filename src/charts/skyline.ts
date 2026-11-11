// Skyline: one column per day for a long date range (e.g. a year of daily values), drawn edge to edge so the
// columns form a stepped silhouette, with month labels underneath. Missing days (null) get no column; they are shaded
// as a muted band with a dashed baseline so they never read as 0. A real 0 is a zero-height column on a solid baseline.
// Above MAX_FOCUS days the columns are not individually focusable; the data table carries every value.
// Readability (0.8.0): each run is filled as one silhouette path (no seams between hundreds of thin columns; the
// per-day columns stay transparent on top for hover and focus), the edge line thins out when a column is under 1.5px,
// and the highest day is marked with its value and date.
import type { BaseSpec, Value } from '../types.ts';
import { definePlugin } from '../plugin.ts';
import { BASE, base, color, dict, fail, optNum, optStr, value } from '../check.ts';
import { type Ctx, FS, MAX_FOCUS, colorAttrs, empty, focusable, frame, runs, table, wrapTable } from '../kit.ts';
import { esc, makeFmt, n2, niceTicks, tw } from '../format.ts';
import { dateArg, iso, ymd } from './timeline.ts';

export interface SkylineSpec extends BaseSpec {
  type: 'skyline';
  /** First day, 'YYYY-MM-DD'. values[i] belongs to start + i days. */
  start: string;
  /** One value per day (>= 0); null = missing. */
  values: Value[];
  /** Series name used in value boxes and the table header. */
  name?: string;
  yMax?: number;
  color?: string;
  quality?: string;
}

const MAX_DAYS = 1100;
const VFS = 13;
const MON_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const L = { ko: { days: '일', mean: '평균' }, en: { days: ' days', mean: 'mean' } };

export const plugin = definePlugin<SkylineSpec>({
  type: 'skyline',
  names: { ko: '스카이라인', en: 'Skyline' },
  defaultWidth: 960,
  validate(input) {
    const o = dict(input, 'spec', [...BASE, 'start', 'values', 'name', 'yMax', 'color', 'quality']);
    const out = base(o) as unknown as SkylineSpec;
    out.type = 'skyline';
    if (o.start === undefined) fail('start', 'is required');
    dateArg(o.start, 'start');
    out.start = o.start as string;
    if (!Array.isArray(o.values) || o.values.length === 0) fail('values', 'must be a non-empty array');
    if (o.values.length > MAX_DAYS) fail('values', `must have at most ${MAX_DAYS} entries`);
    out.values = o.values.map((v, i) => value(v, `values[${i}]`, 0));
    const name = optStr(o.name, 'name', 80);
    const yMax = optNum(o.yMax, 'yMax', 0, 1e15);
    if (yMax === 0) fail('yMax', 'must be greater than 0');
    const c = color(o.color, 'color');
    const q = optStr(o.quality, 'quality', 60);
    if (name !== undefined) out.name = name;
    if (yMax !== undefined) out.yMax = yMax;
    if (c !== undefined) out.color = c;
    if (q !== undefined) out.quality = q;
    return out;
  },
  height(_spec, width) {
    return width < 420 ? 200 : 240;
  },
  render(spec, ctx: Ctx) {
    const t = ctx.t;
    const L2 = L[ctx.lang];
    const vals = spec.values;
    const n = vals.length;
    const s0 = dateArg(spec.start, 'start');
    const fmt = makeFmt(spec.unit, vals);
    const present = vals.map((v, i) => ({ v, i })).filter((p): p is { v: number; i: number } => p.v !== null);
    const name = spec.name;
    const dayText = (i: number): string => {
      const v = vals[i] ?? null;
      return `${iso(s0 + i)}${name ? `, ${name}` : ''}: ${v === null ? t.na : fmt(v)}${spec.quality ? ` · ${spec.quality}` : ''}`;
    };

    let svg = '';
    if (!present.length) svg = empty(ctx);
    else {
      const max = Math.max(...present.map((p) => p.v));
      const nt = niceTicks(0, spec.yMax ?? max, ctx.H < 220 ? 3 : 4);
      const hi = spec.yMax ?? nt.max;
      const ticks = nt.ticks.filter((v) => v <= hi);
      const left = Math.max(...ticks.map((v) => tw(fmt(v), FS) * 1.12)) + 8;
      const x0 = left; const x1 = ctx.W - 6;
      const top = 8; const baseY = ctx.H - FS - 14;
      const cw = (x1 - x0) / n;
      const X = (i: number): number => x0 + i * cw;
      const Y = (v: number): number => baseY - (Math.min(v, hi) / (hi || 1)) * (baseY - top);

      let grid = '';
      for (const v of ticks) {
        const y = Y(v);
        grid += `<line class="lc-grid" x1="${n2(x0)}" y1="${n2(y)}" x2="${n2(x1)}" y2="${n2(y)}"/><text class="lc-tick" x="${n2(x0 - 4)}" y="${n2(y + FS * 0.36)}" text-anchor="end">${esc(fmt(v))}</text>`;
      }
      let na = '';
      const nullRuns = runs(vals.map((v) => (v === null ? 0 : null)));
      for (const r of nullRuns) {
        const a = X(r[0] as number); const b = X((r[r.length - 1] as number) + 1);
        na += `<rect class="lc-sky-na" x="${n2(a)}" y="${n2(top)}" width="${n2(b - a)}" height="${n2(baseY - top)}"/><line class="lc-sky-naline" x1="${n2(a)}" y1="${n2(baseY)}" x2="${n2(b)}" y2="${n2(baseY)}"/>`;
      }
      const canFocus = present.length <= MAX_FOCUS;
      let marks = '';
      let fill = '';
      let edge = '';
      let baseLine = '';
      for (const r of runs(vals)) {
        const a = r[0] as number; const b = (r[r.length - 1] as number) + 1;
        baseLine += `<line class="lc-axis" x1="${n2(X(a))}" y1="${n2(baseY)}" x2="${n2(X(b))}" y2="${n2(baseY)}"/>`;
        let d = `M${n2(X(a))} ${n2(baseY)}`;
        for (const i of r) d += `V${n2(Y(vals[i] as number))}H${n2(X(i + 1))}`;
        fill += `<path class="lc-sky-fill ${colorAttrs(0, spec.color)} d="${d}V${n2(baseY)}Z"/>`;
        edge += `<path class="lc-sky-edge" d="${d}V${n2(baseY)}"/>`;
      }
      for (const { v, i } of present) {
        const y = Y(v);
        const rect = `<rect class="lc-mark lc-sky ${colorAttrs(0, spec.color)} data-i="${i}" data-v="${v}" x="${n2(X(i))}" y="${n2(y)}" width="${n2(cw)}" height="${n2(baseY - y)}"/>`;
        marks += canFocus ? focusable(ctx, 'lc-pt-sky', dayText(i), rect, X(i) + cw / 2, y) : rect;
      }
      // Peak: a dot on the highest day with its value (bold, tinted) and date, kept inside the plot.
      const peak = present.reduce((a, p) => (p.v > a.v ? p : a));
      const px = X(peak.i) + cw / 2; const py = Y(peak.v);
      const pv = fmt(peak.v); const pd = iso(s0 + peak.i);
      const pw = Math.max(tw(pv, VFS), tw(pd, FS)) * 1.08;
      const onLeft = px + 6 + pw > x1;
      const lx = onLeft ? px - 6 : px + 6;
      const ly = Math.max(top + VFS, py - 6);
      const peakSvg = `<g class="lc-sky-peak ${colorAttrs(0, spec.color)}><circle class="lc-sky-peak-dot" cx="${n2(px)}" cy="${n2(py)}" r="3"/>` +
        `<text class="lc-sky-peak-val" x="${n2(lx)}" y="${n2(ly)}"${onLeft ? ' text-anchor="end"' : ''}>${esc(pv)}<tspan class="lc-sky-peak-date" x="${n2(lx)}" dy="${FS + 2}">${esc(pd)}</tspan></text></g>`;
      // Month labels at the first day of each month (and the first day of the range), skipped when they would collide.
      let months = '';
      let lastR = -Infinity;
      for (let i = 0; i < n; i++) {
        const [y, m, d] = ymd(s0 + i);
        if (d !== 1 && i !== 0) continue;
        const x = X(i);
        if (d === 1) months += `<line class="lc-axis" x1="${n2(x)}" y1="${n2(baseY)}" x2="${n2(x)}" y2="${n2(baseY + 4)}"/>`;
        const txt = ctx.lang === 'ko' ? (m === 1 || i === 0 ? `${y}년 ${m}월` : `${m}월`) : `${MON_EN[m - 1]}${m === 1 || i === 0 ? ` ${y}` : ''}`;
        const w = tw(txt, FS) * 1.12;
        const tx = Math.min(x + 2, ctx.W - w - 2);
        if (tx < lastR + 6) continue;
        lastR = tx + w;
        months += `<text class="lc-tick" x="${n2(tx)}" y="${n2(baseY + FS + 6)}">${esc(txt)}</text>`;
      }
      // Columns under 1.5px wide: the edge line is thinned so it does not cover the fill (see skyline.css).
      svg = `<g aria-hidden="true">${grid}${na}${fill}</g><g class="lc-sky-marks${cw < 1.5 ? ' lc-sky-dense' : ''}">${marks}</g><g aria-hidden="true"${cw < 1.5 ? ' class="lc-sky-dense"' : ''}>${edge}${baseLine}${months}${peakSvg}</g>`;
    }

    const missing = n - present.length;
    const desc = (() => {
      const head = `${n}${L2.days} (${iso(s0)} – ${iso(s0 + n - 1)}).`;
      if (!present.length) return `${head} ${t.na}.`;
      const total = present.reduce((a, p) => a + p.v, 0);
      const hiP = present.reduce((a, p) => (p.v > a.v ? p : a));
      const loP = present.reduce((a, p) => (p.v < a.v ? p : a));
      return `${head}${name ? ` ${name}:` : ''} ${t.total} ${fmt(total)}, ${L2.mean} ${fmt(total / present.length)}, ${t.max} ${fmt(hiP.v)} (${iso(s0 + hiP.i)}), ${t.min} ${fmt(loP.v)} (${iso(s0 + loP.i)}).` +
        `${missing ? ` ${t.missing} ${missing}.` : ''}${spec.quality ? ` ${t.quality}: ${spec.quality}.` : ''}`;
    })();
    const tbl = table(t, spec.title, [t.date, `${name ?? t.value}${spec.quality ? ` (${spec.quality})` : ''}`],
      vals.map((v, i) => ({ th: iso(s0 + i), cells: [v === null ? null : fmt(v)] })));
    return frame(ctx, spec, svg, desc, '', wrapTable(spec.table ?? 'details', t, tbl));
  },
});
