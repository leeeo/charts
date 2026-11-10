// Ridgeline: one Gaussian kernel density ridge per group from raw samples, rows overlapping, labels on the left.
// Bandwidth per group follows Silverman's rule h = 0.9 * min(sd, IQR / 1.34) * n^(-1/5) unless the spec fixes it.
// All ridges share one density scale, so peak heights are comparable. Nulls are ignored and counted.
import type { BaseSpec, Value } from '../types.ts';
import { definePlugin } from '../plugin.ts';
import { BASE, MAX_POINTS, MAX_SERIES, base, color, dict, fail, idList, optNum, optStr, str, value } from '../check.ts';
import { clamp, esc, makeFmt, n2, niceTicks, truncate, tw } from '../format.ts';
import { type Ctx, FS, MAX_FOCUS, colorAttrs, empty, focusable, frame, legend, table, wrapTable } from '../kit.ts';

export interface RidgeGroup {
  id: string;
  label: string;
  /** Raw samples; null = missing (ignored, counted). */
  values: Value[];
  color?: string;
  quality?: string;
}

export interface RidgelineSpec extends BaseSpec {
  type: 'ridgeline';
  groups: RidgeGroup[];
  xLabel?: string;
  /** Axis bounds extend the nice domain; data is never clipped. */
  xMin?: number;
  xMax?: number;
  /** Fixed kernel bandwidth in data units for every group; omitted or 0 = Silverman's rule per group. */
  bandwidth?: number;
  /** How far a peak may rise into the rows above, in row heights (0..3, default 1). */
  overlap?: number;
}

const L = {
  ko: { bw: '대역폭', rule: '가우시안 커널 밀도, 대역폭은 Silverman 규칙', fixed: '가우시안 커널 밀도, 고정 대역폭' },
  en: { bw: 'bandwidth', rule: 'Gaussian kernel density, Silverman bandwidth', fixed: 'Gaussian kernel density, fixed bandwidth' },
};
const GRID = 96;

interface Stat { n: number; min: number; max: number; median: number; mean: number; bw: number; xs: number[] }

function quantile(s: number[], p: number): number {
  const h = (s.length - 1) * p;
  const a = Math.floor(h);
  const b = Math.ceil(h);
  return s[a]! + (s[b]! - s[a]!) * (h - a);
}

/** Silverman's rule of thumb; 0 when the sample has no spread. */
export function silverman(sorted: number[]): number {
  const n = sorted.length;
  if (n < 2) return 0;
  const mean = sorted.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(sorted.reduce((a, v) => a + (v - mean) ** 2, 0) / (n - 1));
  const iqr = quantile(sorted, 0.75) - quantile(sorted, 0.25);
  const s = iqr > 0 ? Math.min(sd, iqr / 1.34) : sd;
  return s > 0 ? 0.9 * s * n ** -0.2 : 0;
}

const density = (xs: number[], h: number, x: number): number => {
  let sum = 0;
  for (const v of xs) { const z = (x - v) / h; sum += Math.exp(-0.5 * z * z); }
  return sum / (xs.length * h * Math.sqrt(2 * Math.PI));
};

export const plugin = definePlugin<RidgelineSpec>({
  type: 'ridgeline',
  names: { ko: '능선 차트', en: 'Ridgeline' },
  validate(input) {
    const o = dict(input, 'spec', [...BASE, 'groups', 'xLabel', 'xMin', 'xMax', 'bandwidth', 'overlap']);
    const out = base(o) as unknown as RidgelineSpec;
    out.type = 'ridgeline';
    let total = 0;
    out.groups = idList(o.groups, 'groups', ['label', 'values', 'color', 'quality'], MAX_SERIES, (g, p, id) => {
      if (!Array.isArray(g.values)) fail(`${p}.values`, 'must be an array');
      total += g.values.length;
      if (total > MAX_POINTS) fail(`${p}.values`, `must have at most ${MAX_POINTS} entries`);
      const go: RidgeGroup = { id, label: str(g.label, `${p}.label`, 60), values: g.values.map((x, i) => value(x, `${p}.values[${i}]`)) };
      const c = color(g.color, `${p}.color`);
      const q = optStr(g.quality, `${p}.quality`, 60);
      if (c !== undefined) go.color = c;
      if (q !== undefined) go.quality = q;
      return go;
    });
    const xl = optStr(o.xLabel, 'xLabel', 60);
    if (xl !== undefined) out.xLabel = xl;
    const lo = optNum(o.xMin, 'xMin', -1e15, 1e15);
    const hi = optNum(o.xMax, 'xMax', -1e15, 1e15);
    if (lo !== undefined && hi !== undefined && lo >= hi) fail('xMax', 'must be greater than xMin');
    if (lo !== undefined) out.xMin = lo;
    if (hi !== undefined) out.xMax = hi;
    const bw = optNum(o.bandwidth, 'bandwidth', 0, 1e15);
    if (bw !== undefined) out.bandwidth = bw;
    const ov = optNum(o.overlap, 'overlap', 0, 3);
    if (ov !== undefined) out.overlap = ov;
    return out;
  },
  height(spec, W) {
    return 50 + spec.groups.length * (W < 420 ? 34 : 42) + (spec.xLabel ? FS + 6 : 0);
  },
  render(spec, ctx: Ctx) {
    const t = ctx.t;
    const L2 = L[ctx.lang];
    const data = spec.groups.flatMap((g) => g.values);
    const fmt = makeFmt(spec.unit, data);
    const fmtQ = (v: number): string => makeFmt(spec.unit, [...data, Math.round(v * 100) / 100])(v);
    const pres = data.filter((v): v is number => v !== null);
    const gMin = pres.length ? Math.min(...pres) : 0;
    const gMax = pres.length ? Math.max(...pres) : 0;
    const fallback = (gMax - gMin || Math.abs(gMin) || 1) * 0.05;
    const st: (Stat | null)[] = spec.groups.map((g) => {
      const xs = g.values.filter((v): v is number => v !== null).sort((a, b) => a - b);
      if (!xs.length) return null;
      const bw = spec.bandwidth || silverman(xs) || fallback;
      return { n: xs.length, min: xs[0]!, max: xs[xs.length - 1]!, median: quantile(xs, 0.5), mean: xs.reduce((a, b) => a + b, 0) / xs.length, bw, xs };
    });
    const q = (g: RidgeGroup): string => (g.quality ? ` · ${g.quality}` : '');
    const text = (g: RidgeGroup, s: Stat): string => `${g.label}: ${t.count} ${s.n}, ${t.median} ${fmtQ(s.median)}, ${t.min} ${fmt(s.min)}, ${t.max} ${fmt(s.max)}${q(g)}`;

    let svg = '';
    if (!pres.length) svg = empty(ctx);
    else {
      const xd = niceTicks(Math.min(gMin, spec.xMin ?? gMin), Math.max(gMax, spec.xMax ?? gMax), ctx.W < 420 ? 4 : 6);
      const labMax = clamp(ctx.W * 0.28, 40, 140);
      const labs = spec.groups.map((g) => truncate(g.label, labMax, FS));
      const tickLabs = xd.ticks.map(fmt);
      const left = Math.max(...labs.map((l) => tw(l, FS)), tw(tickLabs[0]!, FS) / 2) + 14;
      const right = Math.max(10, tw(tickLabs[tickLabs.length - 1]!, FS) / 2 + 4);
      const pw = Math.max(20, ctx.W - left - right);
      const top = 8;
      const bottom = FS + 12 + (spec.xLabel ? FS + 6 : 0);
      const ph = Math.max(20, ctx.H - top - bottom);
      const G = spec.groups.length;
      const ov = spec.overlap ?? 1;
      const rh = ph / (G + ov);
      const peakH = rh * (1 + ov);
      const sx = (v: number): number => left + ((v - xd.min) / (xd.max - xd.min || 1)) * pw;
      const grid = Array.from({ length: GRID + 1 }, (_, j) => xd.min + ((xd.max - xd.min) * j) / GRID);
      const dens = st.map((s) => (s ? grid.map((x) => density(s.xs, s.bw, x)) : null));
      const dMax = Math.max(...dens.flatMap((d) => d ?? [])) || 1;
      const baseY = top + ph;
      xd.ticks.forEach((tk, k) => {
        const x = sx(tk);
        svg += `<line class="lc-grid" x1="${n2(x)}" x2="${n2(x)}" y1="${n2(top)}" y2="${n2(baseY)}"/>`;
        svg += `<text class="lc-tick" x="${n2(x)}" y="${n2(baseY + FS + 4)}" text-anchor="middle">${esc(tickLabs[k]!)}</text>`;
      });
      if (spec.xLabel) svg += `<text class="lc-axis-title" x="${n2(left + pw / 2)}" y="${n2(ctx.H - 4)}" text-anchor="middle">${esc(truncate(spec.xLabel, pw, FS))}</text>`;
      const canFocus = G <= MAX_FOCUS;
      spec.groups.forEach((g, i) => {
        const by = top + rh * ov + rh * (i + 1);
        svg += `<line class="lc-ridge-base" x1="${n2(left)}" x2="${n2(left + pw)}" y1="${n2(by)}" y2="${n2(by)}"/>`;
        svg += `<text class="lc-ridge-label" x="${n2(left - 8)}" y="${n2(by - 4)}" text-anchor="end">${esc(labs[i]!)}</text>`;
        const s = st[i];
        const d = dens[i];
        if (!s || !d) {
          svg += `<text class="lc-ridge-na" x="${n2(left + 6)}" y="${n2(by - 4)}">${esc(t.na)}</text>`;
          return;
        }
        const ys = d.map((v) => by - (v / dMax) * peakH);
        let pk = 0;
        d.forEach((v, j) => { if (v > d[pk]!) pk = j; });
        const path = `M${n2(sx(grid[0]!))} ${n2(by)}${grid.map((x, j) => `L${n2(sx(x))} ${n2(ys[j]!)}`).join('')}L${n2(sx(grid[GRID]!))} ${n2(by)}Z`;
        const ca = colorAttrs(i, g.color);
        const mx = sx(s.median);
        const md = by - (density(s.xs, s.bw, s.median) / dMax) * peakH;
        const inner = `<path class="lc-mark lc-ridge ${ca} data-i="${i}" data-v="${s.median}" data-n="${s.n}" data-bw="${s.bw}" data-peak="${grid[pk]}" d="${path}"/>` +
          `<line class="lc-ridge-med" x1="${n2(mx)}" x2="${n2(mx)}" y1="${n2(by)}" y2="${n2(md)}"/>`;
        svg += canFocus ? focusable(ctx, 'lc-pt-ridge', text(g, s), inner, sx(grid[pk]!), ys[pk]!) : inner;
      });
    }

    const missing = data.length - pres.length;
    const desc = `${spec.groups.map((g, i) => { const s = st[i]; return s ? text(g, s) : `${g.label}: ${t.na}`; }).join('. ')}. ${spec.bandwidth ? L2.fixed : L2.rule}.${missing ? ` ${t.missing} ${missing}.` : ''}`;
    const lg = spec.legend === true ? legend(spec.groups.map((g, i) => ({ name: g.label, idx: i, ...(g.color ? { color: g.color } : {}), ...(g.quality ? { quality: g.quality } : {}) }))) : '';
    const tbl = table(t, spec.title, [t.cat, t.count, t.min, t.median, t.mean, t.max, L2.bw, t.missing], spec.groups.map((g, i) => {
      const s = st[i];
      const th = `${g.label}${g.quality ? ` (${g.quality})` : ''}`;
      const miss = String(g.values.filter((v) => v === null).length);
      if (!s) return { th, cells: ['0', null, null, null, null, null, miss] };
      return { th, cells: [String(s.n), fmt(s.min), fmtQ(s.median), fmtQ(s.mean), fmt(s.max), fmtQ(s.bw), miss] };
    }));
    return frame(ctx, spec, svg, desc, lg, wrapTable(spec.table ?? 'details', t, tbl));
  },
});
