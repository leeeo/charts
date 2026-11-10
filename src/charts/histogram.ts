// Histogram: frequency of a numeric measure per bin. Bins come from raw values (equal-width, by `binCount` or `binWidth`;
// default Sturges' rule) or are given directly as {from, to, count}. Bins are [from, to) except the last, which includes `to`.
import type { BaseSpec, Value } from '../types.ts';
import { definePlugin } from '../plugin.ts';
import { BASE, MAX_POINTS, base, color, dict, fail, num, optNum, optStr, value } from '../check.ts';
import { esc, makeFmt, n2, niceTicks, truncate, tw } from '../format.ts';
import { type Ctx, FS, MAX_FOCUS, colorAttrs, empty, focusable, frame, pct, table, wrapTable } from '../kit.ts';

export interface HistogramBin { from: number; to: number; count: Value }

export interface HistogramSpec extends BaseSpec {
  type: 'histogram';
  /** Raw observations; null = missing (ignored, counted). Exactly one of `values` / `bins`. */
  values?: Value[];
  /** Pre-binned counts, ascending and non-overlapping; null count = missing bin (not drawn). */
  bins?: HistogramBin[];
  /** Number of equal-width bins for raw values (1..100). */
  binCount?: number;
  /** Bin width for raw values; bins are aligned to multiples of the width unless `binStart` is given. */
  binWidth?: number;
  /** Lower edge of the first bin (raw values). */
  binStart?: number;
  xLabel?: string;
  /** Axis title for counts. */
  yLabel?: string;
  color?: string;
  quality?: string;
}

const MAX_BINS = 200;
const r9 = (x: number): number => Math.round(x * 1e9) / 1e9;

/** Bins for a validated spec (raw values binned here). */
export function binsOf(spec: HistogramSpec): HistogramBin[] {
  if (spec.bins) return spec.bins;
  const vs = (spec.values ?? []).filter((v): v is number => v !== null);
  if (!vs.length) return [];
  let lo = Math.min(...vs);
  let hi = Math.max(...vs);
  let w: number;
  let n: number;
  if (spec.binWidth !== undefined) {
    w = spec.binWidth;
    lo = spec.binStart ?? Math.floor(lo / w) * w;
    const mn = Math.min(...vs);
    if (lo > mn) lo -= Math.ceil((lo - mn) / w) * w;
    n = Math.floor((hi - lo) / w + 1e-9) + 1;
  } else {
    if (spec.binStart !== undefined) lo = Math.min(lo, spec.binStart);
    if (hi === lo) { lo -= 0.5; hi += 0.5; }
    n = spec.binCount ?? Math.min(50, Math.max(1, Math.ceil(Math.log2(vs.length) + 1)));
    w = (hi - lo) / n;
  }
  const counts = new Array<number>(n).fill(0);
  for (const v of vs) counts[Math.min(n - 1, Math.max(0, Math.floor((v - lo) / w + 1e-9)))]! += 1;
  return counts.map((c, k) => ({ from: r9(lo + k * w), to: r9(lo + (k + 1) * w), count: c }));
}

export const plugin = definePlugin<HistogramSpec>({
  type: 'histogram',
  names: { ko: '히스토그램', en: 'Histogram' },
  validate(input) {
    const o = dict(input, 'spec', [...BASE, 'values', 'bins', 'binCount', 'binWidth', 'binStart', 'xLabel', 'yLabel', 'color', 'quality']);
    const out = base(o) as unknown as HistogramSpec;
    out.type = 'histogram';
    if (o.values !== undefined && o.bins !== undefined) fail('bins', 'cannot be used together with values');
    if (o.values !== undefined) {
      if (!Array.isArray(o.values)) fail('values', 'must be an array');
      if (o.values.length > MAX_POINTS) fail('values', `must have at most ${MAX_POINTS} entries`);
      out.values = o.values.map((x, i) => value(x, `values[${i}]`));
      const bc = optNum(o.binCount, 'binCount', 1, 100);
      if (bc !== undefined && !Number.isInteger(bc)) fail('binCount', 'must be an integer');
      const bw = optNum(o.binWidth, 'binWidth', 1e-9, 1e15);
      if (bc !== undefined && bw !== undefined) fail('binWidth', 'cannot be used together with binCount');
      const bs = optNum(o.binStart, 'binStart', -1e15, 1e15);
      if (bc !== undefined) out.binCount = bc;
      if (bw !== undefined) out.binWidth = bw;
      if (bs !== undefined) out.binStart = bs;
      if (binsOf(out).length > MAX_BINS) fail('binWidth', `is too small for the data (more than ${MAX_BINS} bins)`);
    } else if (o.bins !== undefined) {
      for (const k of ['binCount', 'binWidth', 'binStart'] as const) if (o[k] !== undefined) fail(k, 'cannot be used together with bins');
      if (!Array.isArray(o.bins) || o.bins.length === 0) fail('bins', 'must be a non-empty array');
      if (o.bins.length > MAX_BINS) fail('bins', `must have at most ${MAX_BINS} entries`);
      let prev = -1e15;
      out.bins = o.bins.map((b, i) => {
        const p = `bins[${i}]`;
        const d = dict(b, p, ['from', 'to', 'count']);
        const from = num(d.from, `${p}.from`, prev);
        const to = num(d.to, `${p}.to`);
        if (to <= from) fail(`${p}.to`, 'must be greater than from');
        prev = to;
        return { from, to, count: value(d.count, `${p}.count`, 0) };
      });
    } else fail('values', 'is required');
    const xl = optStr(o.xLabel, 'xLabel', 60);
    const yl = optStr(o.yLabel, 'yLabel', 60);
    const c = color(o.color, 'color');
    const q = optStr(o.quality, 'quality', 60);
    if (xl !== undefined) out.xLabel = xl;
    if (yl !== undefined) out.yLabel = yl;
    if (c !== undefined) out.color = c;
    if (q !== undefined) out.quality = q;
    return out;
  },
  height(_spec, W) {
    return W < 420 ? 240 : 300;
  },
  render(spec, ctx: Ctx) {
    const t = ctx.t;
    const bins = binsOf(spec);
    const edges = bins.flatMap((b) => [b.from, b.to]);
    const fmtX = makeFmt(spec.unit, [...edges, ...(spec.values ?? [])]);
    const fmtC = makeFmt(undefined, bins.map((b) => b.count));
    const total = bins.reduce((a, b) => a + (b.count ?? 0), 0);
    const range = (b: HistogramBin): string => `${fmtX(b.from)}–${fmtX(b.to)}`;
    const binText = (b: HistogramBin): string =>
      `${range(b)}: ${b.count === null ? t.na : `${fmtC(b.count)}${total > 0 ? ` (${pct(b.count / total)})` : ''}`}${spec.quality ? ` · ${spec.quality}` : ''}`;

    let svg = '';
    const drawn = bins.filter((b) => b.count !== null);
    if (!drawn.length) svg = empty(ctx);
    else {
      const yd = niceTicks(0, Math.max(...drawn.map((b) => b.count as number)), ctx.H < 220 ? 4 : 5);
      const yLabs = yd.ticks.map(fmtC);
      const top = 10;
      const left = Math.max(...yLabs.map((l) => tw(l, FS))) + 10 + (spec.yLabel ? FS + 8 : 0);
      const bottom = FS + 12 + (spec.xLabel ? FS + 8 : 0);
      const x0 = bins[0]!.from;
      const x1 = bins[bins.length - 1]!.to;
      const xl = edges.length ? [fmtX(x0), fmtX(x1)] : [];
      const right = Math.max(10, tw(xl[1] ?? '', FS) / 2 + 4);
      const lft = Math.max(left, tw(xl[0] ?? '', FS) / 2 + 4);
      const pw = Math.max(20, ctx.W - lft - right);
      const ph = Math.max(20, ctx.H - top - bottom);
      const sx = (v: number): number => lft + ((v - x0) / (x1 - x0 || 1)) * pw;
      const sy = (v: number): number => top + ph - ((v - yd.min) / (yd.max - yd.min || 1)) * ph;
      yd.ticks.forEach((tk, k) => {
        const y = sy(tk);
        svg += `<line class="lc-grid" x1="${n2(lft)}" x2="${n2(lft + pw)}" y1="${n2(y)}" y2="${n2(y)}"/>`;
        svg += `<text class="lc-tick" x="${n2(lft - 6)}" y="${n2(y + FS * 0.36)}" text-anchor="end">${esc(yLabs[k]!)}</text>`;
      });
      if (spec.yLabel) svg += `<text class="lc-axis-title" transform="translate(${n2(FS)} ${n2(top + ph / 2)}) rotate(-90)" text-anchor="middle">${esc(truncate(spec.yLabel, ph, FS))}</text>`;
      const canFocus = drawn.length <= MAX_FOCUS;
      const ca = colorAttrs(0, spec.color);
      bins.forEach((b, i) => {
        if (b.count === null) return;
        const xa = sx(b.from);
        const xb = sx(b.to);
        const y = sy(b.count);
        const gap = Math.min(1, (xb - xa) * 0.2);
        const rect = `<rect class="lc-mark lc-bin ${ca} data-i="${i}" data-v="${b.count}" data-from="${b.from}" data-to="${b.to}" x="${n2(xa + gap / 2)}" y="${n2(y)}" width="${n2(Math.max(0.5, xb - xa - gap))}" height="${n2(top + ph - y)}"/>`;
        svg += canFocus ? focusable(ctx, 'lc-pt-bin', binText(b), rect, (xa + xb) / 2, y) : rect;
      });
      svg += `<line class="lc-axis" x1="${n2(lft)}" x2="${n2(lft + pw)}" y1="${n2(top + ph)}" y2="${n2(top + ph)}"/>`;
      // x labels at bin edges, thinned so they never overlap
      const ex = [...new Set(edges)].sort((a, b) => a - b);
      let lastEnd = -Infinity;
      const ly = top + ph + FS + 4;
      ex.forEach((e) => {
        const x = sx(e);
        const lab = fmtX(e);
        const half = tw(lab, FS) / 2;
        if (x - half < lastEnd + 8 || x + half > ctx.W - 2 || x - half < 2) return;
        lastEnd = x + half;
        svg += `<line class="lc-axis" x1="${n2(x)}" x2="${n2(x)}" y1="${n2(top + ph)}" y2="${n2(top + ph + 4)}"/>`;
        svg += `<text class="lc-tick" x="${n2(x)}" y="${n2(ly)}" text-anchor="middle">${esc(lab)}</text>`;
      });
      if (spec.xLabel) svg += `<text class="lc-axis-title" x="${n2(lft + pw / 2)}" y="${n2(ly + FS + 8)}" text-anchor="middle">${esc(truncate(spec.xLabel, ctx.W - 8, FS))}</text>`;
    }

    const rawMissing = spec.values ? spec.values.filter((v) => v === null).length : 0;
    const binMissing = bins.filter((b) => b.count === null).length;
    const top1 = drawn.reduce<HistogramBin | null>((a, b) => (a === null || (b.count as number) > (a.count as number) ? b : a), null);
    const vs = (spec.values ?? []).filter((v): v is number => v !== null).sort((a, b) => a - b);
    const L2 = ctx.lang === 'ko' ? { bins: '구간', mode: '최빈 구간', n: '관측' } : { bins: 'bins', mode: 'most frequent', n: 'observations' };
    const desc = [
      `${L2.n} ${fmtC(total)}, ${L2.bins} ${bins.length}.`,
      top1 && total > 0 ? `${L2.mode} ${binText(top1)}.` : '',
      vs.length ? `${t.min} ${fmtX(vs[0]!)}, ${t.median} ${fmtX(vs.length % 2 ? vs[(vs.length - 1) / 2]! : (vs[vs.length / 2 - 1]! + vs[vs.length / 2]!) / 2)}, ${t.max} ${fmtX(vs[vs.length - 1]!)}.` : '',
      rawMissing || binMissing ? `${t.missing} ${rawMissing + binMissing}.` : '',
      spec.quality ? `${t.quality}: ${spec.quality}.` : '',
    ].filter(Boolean).join(' ');
    const rows = bins.map((b) => ({ th: range(b), cells: b.count === null ? [null, null] : [fmtC(b.count), total > 0 ? pct(b.count / total) : null] }));
    if (rawMissing) rows.push({ th: t.missing, cells: [fmtC(rawMissing), ''] });
    const tbl = table(t, `${spec.title}${spec.quality ? ` (${spec.quality})` : ''}`, [t.range, t.count, t.share], rows);
    return frame(ctx, spec, svg, desc, '', wrapTable(spec.table ?? 'details', t, tbl));
  },
});
