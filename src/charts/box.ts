// Box plot: one box-and-whisker per group, from raw samples (quartiles by linear interpolation, Tukey 1.5 IQR whiskers,
// outliers drawn as dots) or from a given five-number summary (whiskers = min/max, no outliers).
// The median is written in bold (tinted by the box colour) beside the box when the slot has room; hovering a box
// keeps it and fades the rest (cmp.css).
import type { BaseSpec, Value } from '../types.ts';
import { definePlugin } from '../plugin.ts';
import { BASE, MAX_POINTS, MAX_SERIES, base, color, dict, fail, idList, num, optNum, optStr, str, value } from '../check.ts';
import { clamp, esc, makeFmt, n2, niceTicks, truncate, tw } from '../format.ts';
import { splitCat } from '../cartesian.ts';
import { type Ctx, FS, MAX_FOCUS, colorAttrs, empty, focusable, frame, legend, table, wrapTable } from '../kit.ts';
import { VAL, labelLayer, valueText } from './cmp.ts';

export interface BoxSummary { min: number; q1: number; median: number; q3: number; max: number }

export interface BoxGroup {
  id: string;
  label: string;
  /** Raw samples; null = missing (ignored, counted). Exactly one of `values` / `summary`. */
  values?: Value[];
  /** Pre-computed five-number summary (min <= q1 <= median <= q3 <= max). */
  summary?: BoxSummary;
  color?: string;
  quality?: string;
}

export interface BoxSpec extends BaseSpec {
  type: 'box';
  groups: BoxGroup[];
  yLabel?: string;
  /** Axis bounds extend the nice domain; data is never clipped. */
  yMin?: number;
  yMax?: number;
}

interface Stats {
  n: number | null; min: number; q1: number; median: number; q3: number; max: number;
  lo: number; hi: number; mean: number | null; outliers: number[]; given: boolean;
}

const L = {
  ko: { wLo: '아래 수염', wHi: '위 수염', whisker: '수염', outlier: '이상값', rule: '수염은 1.5 IQR 이내 최솟값·최댓값', given: '요약값' },
  en: { wLo: 'lower whisker', wHi: 'upper whisker', whisker: 'whiskers', outlier: 'outlier', rule: 'whiskers reach the furthest point within 1.5 IQR', given: 'given summary' },
};

function quantile(s: number[], p: number): number {
  const h = (s.length - 1) * p;
  const a = Math.floor(h);
  const b = Math.ceil(h);
  return s[a]! + (s[b]! - s[a]!) * (h - a);
}

const missingOf = (g: BoxGroup): number => (g.values ? g.values.filter((v) => v === null).length : 0);

function stats(g: BoxGroup): Stats | null {
  if (g.summary) {
    const s = g.summary;
    return { n: null, ...s, lo: s.min, hi: s.max, mean: null, outliers: [], given: true };
  }
  const vs = (g.values ?? []).filter((v): v is number => v !== null).sort((a, b) => a - b);
  if (!vs.length) return null;
  const q1 = quantile(vs, 0.25);
  const median = quantile(vs, 0.5);
  const q3 = quantile(vs, 0.75);
  const iqr = q3 - q1;
  const fLo = q1 - 1.5 * iqr;
  const fHi = q3 + 1.5 * iqr;
  const inside = vs.filter((v) => v >= fLo && v <= fHi);
  return {
    n: vs.length, min: vs[0]!, q1, median, q3, max: vs[vs.length - 1]!,
    lo: inside[0] ?? q1, hi: inside[inside.length - 1] ?? q3,
    mean: vs.reduce((a, b) => a + b, 0) / vs.length,
    outliers: vs.filter((v) => v < fLo || v > fHi), given: false,
  };
}

export const plugin = definePlugin<BoxSpec>({
  type: 'box',
  names: { ko: '상자 그림', en: 'Box plot' },
  validate(input) {
    const o = dict(input, 'spec', [...BASE, 'groups', 'yLabel', 'yMin', 'yMax']);
    const out = base(o) as unknown as BoxSpec;
    out.type = 'box';
    let total = 0;
    out.groups = idList(o.groups, 'groups', ['label', 'values', 'summary', 'color', 'quality'], MAX_SERIES, (g, p, id) => {
      const go: BoxGroup = { id, label: str(g.label, `${p}.label`, 60) };
      if (g.values !== undefined && g.summary !== undefined) fail(`${p}.summary`, 'cannot be used together with values');
      if (g.values !== undefined) {
        if (!Array.isArray(g.values)) fail(`${p}.values`, 'must be an array');
        total += g.values.length;
        if (total > MAX_POINTS) fail(`${p}.values`, `must have at most ${MAX_POINTS} entries`);
        go.values = g.values.map((x, i) => value(x, `${p}.values[${i}]`));
      } else if (g.summary !== undefined) {
        const sp = `${p}.summary`;
        const s = dict(g.summary, sp, ['min', 'q1', 'median', 'q3', 'max']);
        const min = num(s.min, `${sp}.min`);
        const q1 = num(s.q1, `${sp}.q1`, min);
        const median = num(s.median, `${sp}.median`, q1);
        const q3 = num(s.q3, `${sp}.q3`, median);
        const max = num(s.max, `${sp}.max`, q3);
        go.summary = { min, q1, median, q3, max };
      } else fail(`${p}.values`, 'is required');
      const c = color(g.color, `${p}.color`);
      const q = optStr(g.quality, `${p}.quality`, 60);
      if (c !== undefined) go.color = c;
      if (q !== undefined) go.quality = q;
      return go;
    });
    const yl = optStr(o.yLabel, 'yLabel', 60);
    if (yl !== undefined) out.yLabel = yl;
    const lo = optNum(o.yMin, 'yMin', -1e15, 1e15);
    const hi = optNum(o.yMax, 'yMax', -1e15, 1e15);
    if (lo !== undefined && hi !== undefined && lo >= hi) fail('yMax', 'must be greater than yMin');
    if (lo !== undefined) out.yMin = lo;
    if (hi !== undefined) out.yMax = hi;
    return out;
  },
  height(_spec, W) {
    return W < 420 ? 260 : 320;
  },
  render(spec, ctx: Ctx) {
    const t = ctx.t;
    const L2 = L[ctx.lang];
    const st = spec.groups.map(stats);
    const data: Value[] = spec.groups.flatMap((g) => g.values ?? (g.summary ? [g.summary.min, g.summary.max] : []));
    const fmt = makeFmt(spec.unit, data);
    // derived stats (interpolated quartiles, mean) keep the data's decimals unless they need more (max 2)
    const fmtQ = (v: number): string => makeFmt(spec.unit, [...data, Math.round(v * 100) / 100])(v);
    const tail = (g: BoxGroup, s: Stats): string => `${s.n !== null ? ` · ${t.count} ${s.n}` : ` · ${L2.given}`}${g.quality ? ` · ${g.quality}` : ''}`;
    const boxText = (g: BoxGroup, s: Stats): string =>
      `${g.label}: ${t.median} ${fmtQ(s.median)}, ${t.q1} ${fmtQ(s.q1)}, ${t.q3} ${fmtQ(s.q3)}, ` +
      (s.given ? `${t.min} ${fmt(s.min)}, ${t.max} ${fmt(s.max)}` : `${L2.whisker} ${fmt(s.lo)}–${fmt(s.hi)}${s.outliers.length ? `, ${L2.outlier} ${s.outliers.length}` : ''}`) +
      tail(g, s);

    let svg = '';
    const live = st.filter((s): s is Stats => s !== null);
    if (!live.length) svg = empty(ctx);
    else {
      let lo = Math.min(...live.map((s) => s.min));
      let hi = Math.max(...live.map((s) => s.max));
      if (spec.yMin !== undefined) lo = Math.min(lo, spec.yMin);
      if (spec.yMax !== undefined) hi = Math.max(hi, spec.yMax);
      const yd = niceTicks(lo, hi, ctx.H < 220 ? 4 : 5);
      const labs = yd.ticks.map(fmt);
      const top = 10;
      const axisT = spec.yLabel ? FS + 8 : 0;
      const left = Math.max(...labs.map((l) => tw(l, FS))) + 10 + axisT;
      const pw = Math.max(20, ctx.W - left - 10);
      // Narrow screens: a group name that does not fit its slot wraps onto a second line (like bar categories) instead
      // of being cut to two letters; the axis band grows by one line only then.
      const catRoom = Math.max(pw / spec.groups.length - 4, 1);
      const catLines = spec.groups.some((g) => tw(g.label, FS) > catRoom && splitCat(g.label, catRoom, FS, 2).length > 1) ? 2 : 1;
      const bottom = FS + 14 + (catLines - 1) * 13;
      const ph = Math.max(20, ctx.H - top - bottom);
      const sy = (v: number): number => top + ph - ((v - yd.min) / (yd.max - yd.min || 1)) * ph;
      yd.ticks.forEach((tk, k) => {
        const y = sy(tk);
        svg += `<line class="lc-grid" x1="${n2(left)}" x2="${n2(left + pw)}" y1="${n2(y)}" y2="${n2(y)}"/>`;
        svg += `<text class="lc-tick" x="${n2(left - 6)}" y="${n2(y + FS * 0.36)}" text-anchor="end">${esc(labs[k]!)}</text>`;
      });
      if (spec.yLabel) {
        svg += `<text class="lc-axis-title" transform="translate(${n2(FS)} ${n2(top + ph / 2)}) rotate(-90)" text-anchor="middle">${esc(truncate(spec.yLabel, ph, FS))}</text>`;
      }
      svg += `<line class="lc-axis" x1="${n2(left)}" x2="${n2(left + pw)}" y1="${n2(top + ph)}" y2="${n2(top + ph)}"/>`;
      const slot = pw / spec.groups.length;
      const bw = clamp(slot * 0.5, 4, 56);
      const marks = spec.groups.length + live.reduce((a, s) => a + s.outliers.length, 0);
      const canFocus = marks <= MAX_FOCUS;
      let lbl = '';
      spec.groups.forEach((g, i) => {
        const cx = left + slot * (i + 0.5);
        svg += catLines > 1
          ? `<text class="lc-tick" x="${n2(cx)}" y="${n2(top + ph + FS + 4)}" text-anchor="middle">${splitCat(g.label, catRoom, FS, 2).map((l, k) => `<tspan x="${n2(cx)}"${k ? ' dy="13"' : ''}>${esc(l)}</tspan>`).join('')}</text>`
          : `<text class="lc-tick" x="${n2(cx)}" y="${n2(top + ph + FS + 4)}" text-anchor="middle">${esc(truncate(g.label, Math.max(slot - 4, 1), FS))}</text>`;
        const s = st[i];
        if (!s) {
          if (tw(t.na, 11) <= slot - 4) svg += `<text class="lc-box-na" x="${n2(cx)}" y="${n2(top + ph / 2)}" text-anchor="middle">${t.na}</text>`;
          return;
        }
        const yq1 = sy(s.q1);
        const yq3 = sy(s.q3);
        const ylo = sy(s.lo);
        const yhi = sy(s.hi);
        const cap = bw * 0.25;
        const ca = colorAttrs(i, g.color);
        const inner = `<g class="lc-box-g ${ca}>` +
          `<line class="lc-box-whisker" x1="${n2(cx)}" x2="${n2(cx)}" y1="${n2(yq1)}" y2="${n2(ylo)}"/>` +
          `<line class="lc-box-whisker" x1="${n2(cx)}" x2="${n2(cx)}" y1="${n2(yq3)}" y2="${n2(yhi)}"/>` +
          `<line class="lc-box-whisker" x1="${n2(cx - cap)}" x2="${n2(cx + cap)}" y1="${n2(ylo)}" y2="${n2(ylo)}"/>` +
          `<line class="lc-box-whisker" x1="${n2(cx - cap)}" x2="${n2(cx + cap)}" y1="${n2(yhi)}" y2="${n2(yhi)}"/>` +
          `<rect class="lc-mark lc-box ${ca} data-i="${i}" data-v="${s.median}" data-q1="${s.q1}" data-q3="${s.q3}" data-lo="${s.lo}" data-hi="${s.hi}" x="${n2(cx - bw / 2)}" y="${n2(yq3)}" width="${n2(bw)}" height="${n2(Math.max(1, yq1 - yq3))}" rx="2"/>` +
          `<line class="lc-box-median" x1="${n2(cx - bw / 2)}" x2="${n2(cx + bw / 2)}" y1="${n2(sy(s.median))}" y2="${n2(sy(s.median))}"/></g>`;
        svg += canFocus ? focusable(ctx, 'lc-pt-box', boxText(g, s), inner, cx, yhi) : inner;
        // Median: right of the box when the slot has room, else above the upper whisker (unless an outlier sits there).
        const med = fmtQ(s.median);
        const mw = tw(med, VAL) * 1.06;
        if (mw <= slot / 2 - bw / 2 - 8) lbl += valueText(cx + bw / 2 + 5, sy(s.median) + VAL * 0.36, med, ca, 'start');
        else if (mw <= slot - 4 && yhi - 6 - VAL >= top && !s.outliers.some((v) => sy(v) > yhi - VAL - 10 && sy(v) < yhi)) lbl += valueText(cx, yhi - 6, med, ca, 'middle');
        s.outliers.forEach((v) => {
          const dot = `<circle class="lc-mark lc-outlier ${ca} data-i="${i}" data-v="${v}" cx="${n2(cx)}" cy="${n2(sy(v))}" r="3"/>`;
          svg += canFocus ? focusable(ctx, 'lc-pt-outlier', `${g.label}, ${L2.outlier}: ${fmt(v)}${g.quality ? ` · ${g.quality}` : ''}`, dot, cx, sy(v)) : dot;
        });
      });
      svg += labelLayer(lbl);
    }

    const missing = spec.groups.reduce((a, g) => a + missingOf(g), 0);
    const desc = `${spec.groups.map((g, i) => {
      const s = st[i];
      return s ? boxText(g, s) : `${g.label}: ${t.na}`;
    }).join('. ')}. ${L2.rule}.${missing ? ` ${t.missing} ${missing}.` : ''}`;
    const lg = spec.legend === true ? legend(spec.groups.map((g, i) => ({
      name: g.label, idx: i, ...(g.color ? { color: g.color } : {}), ...(g.quality ? { quality: g.quality } : {}),
    }))) : '';
    const tbl = table(t, spec.title, [t.cat, t.count, t.min, L2.wLo, t.q1, t.median, t.q3, L2.wHi, t.max, t.mean, L2.outlier, t.missing],
      spec.groups.map((g, i) => {
        const s = st[i];
        const th = `${g.label}${g.quality ? ` (${g.quality})` : ''}`;
        const miss = g.values ? String(missingOf(g)) : '';
        if (!s) return { th, cells: [String(0), null, null, null, null, null, null, null, null, null, miss] };
        return {
          th,
          cells: [
            s.n === null ? '' : String(s.n), fmt(s.min), fmt(s.lo), fmtQ(s.q1), fmtQ(s.median), fmtQ(s.q3), fmt(s.hi), fmt(s.max),
            s.mean === null ? '' : fmtQ(s.mean), s.given ? '' : s.outliers.map(fmt).join(', ') || '0', miss,
          ],
        };
      }));
    return frame(ctx, spec, svg, desc, lg, wrapTable(spec.table ?? 'details', t, tbl));
  },
});
