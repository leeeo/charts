// Streamgraph: stacked areas around a centred baseline ("wiggle" minimises layer slopes, "silhouette" is symmetric).
// null in a layer is a gap: the layer is not drawn at that label and adds nothing to the stack there.
import type { BaseSpec, Series } from '../types.ts';
import { definePlugin } from '../plugin.ts';
import { BASE, MAX_POINTS, base, dict, fail, labels, oneOf, optStr, put, seriesList } from '../check.ts';
import { clamp, esc, makeFmt, n2, truncate, tw } from '../format.ts';
import { type Ctx, FS, MAX_FOCUS, colorAttrs, empty, focusable, frame, legend, pct, runs, seriesTable, summarize, wrapTable } from '../kit.ts';

export interface StreamSpec extends BaseSpec {
  type: 'stream';
  labels: string[];
  /** Layers, bottom to top. Values >= 0; null = missing (gap in that layer). */
  series: Series[];
  /** Baseline: "wiggle" (default) or "silhouette" (symmetric around the centre). */
  offset?: 'wiggle' | 'silhouette';
  xLabel?: string;
}

/** Layer bounds [series][label] = [bottom, top] in data units (null where the value is missing). */
export function streamLayers(series: Series[], n: number, offset: 'wiggle' | 'silhouette'): ([number, number] | null)[][] {
  const f = (j: number, i: number): number => series[j]?.values[i] ?? 0;
  const total = Array.from({ length: n }, (_, i) => series.reduce((a, _s, j) => a + f(j, i), 0));
  const g: number[] = new Array<number>(n).fill(0);
  if (offset === 'silhouette') for (let i = 0; i < n; i++) g[i] = -(total[i] ?? 0) / 2;
  else {
    // weighted wiggle: choose the baseline slope that minimises the thickness-weighted squared slope of the layer centres
    g[0] = -(total[0] ?? 0) / 2;
    for (let i = 1; i < n; i++) {
      let num = 0; let below = 0;
      series.forEach((_s, j) => {
        const d = f(j, i) - f(j, i - 1);
        num += f(j, i) * (below + d / 2);
        below += d;
      });
      const den = total[i] ?? 0;
      g[i] = (g[i - 1] ?? 0) - (den > 0 ? num / den : 0);
    }
  }
  return series.map((s, j) => s.values.map((v, i) => {
    if (v === null) return null;
    let b = g[i] ?? 0;
    for (let k = 0; k < j; k++) b += f(k, i);
    return [b, b + v];
  }));
}

function render(spec: StreamSpec, ctx: Ctx): string {
  const t = ctx.t;
  const N = spec.labels.length;
  const all = spec.series.flatMap((s) => s.values);
  const fmt = makeFmt(spec.unit, all);
  const totals = spec.labels.map((_, i) => spec.series.reduce((a, s) => a + (s.values[i] ?? 0), 0));
  const presentCount = all.filter((v) => v !== null).length;
  let inner = '';
  if (!totals.some((v) => v > 0)) inner = empty(ctx);
  else {
    const L = streamLayers(spec.series, N, spec.offset ?? 'wiggle');
    let lo = Infinity; let hi = -Infinity;
    for (const row of L) for (const b of row) if (b) { lo = Math.min(lo, b[0]); hi = Math.max(hi, b[1]); }
    const top = 8; const bottom = FS + 12 + (spec.xLabel ? FS + 8 : 0);
    const px = 8; const py = top; const pw = Math.max(20, ctx.W - 16); const ph = Math.max(20, ctx.H - top - bottom);
    const sy = (v: number): number => py + ph - ((v - lo) / (hi - lo || 1)) * ph;
    const sx = (i: number): number => (N === 1 ? px + pw / 2 : px + (i / (N - 1)) * pw);
    const band = N > 1 ? pw / (N - 1) : pw;
    let s = '';
    const catMax = Math.max(...spec.labels.map((l) => tw(l, FS)));
    const step = catMax + 8 <= band || N <= 4 ? 1 : Math.max(1, Math.ceil((catMax + 8) / band));
    for (let i = 0; i < N; i += step) {
      const x = sx(i);
      const l = truncate(spec.labels[i] ?? '', Math.max(24, step * band - 6), FS);
      const w = tw(l, FS);
      s += `<line class="lc-grid" x1="${n2(x)}" y1="${n2(py)}" x2="${n2(x)}" y2="${n2(py + ph)}"/>`;
      s += `<text class="lc-tick" x="${n2(clamp(x - w / 2, 2, ctx.W - w - 2))}" y="${n2(py + ph + FS + 8)}">${esc(l)}</text>`;
    }
    if (spec.xLabel) s += `<text class="lc-axis-title" x="${n2(px + pw / 2)}" y="${n2(ctx.H - 3)}" text-anchor="middle">${esc(truncate(spec.xLabel, pw, FS))}</text>`;
    // smooth boundary through points with horizontal tangents (cubic, no overshoot, shared by neighbouring layers)
    const curve = (idx: number[], y: (i: number) => number, move: boolean): string => idx.map((i, k) => {
      const prev = idx[k - 1];
      if (k === 0 || prev === undefined) return `${move ? 'M' : 'L'}${n2(sx(i))} ${n2(y(i))}`;
      const xm = (sx(prev) + sx(i)) / 2;
      return ` C${n2(xm)} ${n2(y(prev))} ${n2(xm)} ${n2(y(i))} ${n2(sx(i))} ${n2(y(i))}`;
    }).join('');
    let areas = '';
    let marks = '';
    const focus = presentCount <= MAX_FOCUS;
    spec.series.forEach((se, j) => {
      const row = L[j] ?? [];
      const c = colorAttrs(j, se.color);
      for (const r of runs(se.values)) {
        if (r.length === 1) {
          const i = r[0] as number;
          const b = row[i];
          if (!b) continue;
          const w = N === 1 ? pw * 0.5 : Math.min(10, band * 0.5);
          areas += `<rect class="lc-stream ${c} data-s="${j}" x="${n2(sx(i) - w / 2)}" y="${n2(sy(b[1]))}" width="${n2(w)}" height="${n2(Math.max(0, sy(b[0]) - sy(b[1])))}"/>`;
          continue;
        }
        const upper = curve(r, (i) => sy(row[i]?.[1] ?? 0), true);
        const lower = curve([...r].reverse(), (i) => sy(row[i]?.[0] ?? 0), false);
        areas += `<path class="lc-stream ${c} data-s="${j}" d="${upper} ${lower} Z"/>`;
      }
      se.values.forEach((v, i) => {
        const b = row[i];
        if (v === null || !b) return;
        const cx = sx(i); const cy = sy((b[0] + b[1]) / 2);
        const dot = `<circle class="lc-mark lc-dot lc-stream-dot ${c} data-s="${j}" data-i="${i}" data-v="${v}" cx="${n2(cx)}" cy="${n2(cy)}" r="3.5"/>`;
        const tot = totals[i] ?? 0;
        const text = `${spec.labels[i] ?? ''}, ${se.name}: ${fmt(v)}${tot > 0 ? ` (${pct(v / tot)})` : ''}${se.quality ? ` · ${se.quality}` : ''}`;
        marks += focus ? focusable(ctx, 'lc-pt-dot', text, `<circle class="lc-hit" cx="${n2(cx)}" cy="${n2(cy)}" r="8"/>${dot}`, cx, sy(b[1])) : dot;
      });
    });
    inner = s + areas + marks;
  }
  const first = spec.labels[0] ?? ''; const last = spec.labels[N - 1] ?? '';
  const known = totals.map((v, i) => ({ v, i })).filter((e) => spec.series.some((s) => s.values[e.i] !== null));
  const top = known.reduce<{ v: number; i: number } | null>((a, e) => (a === null || e.v > a.v ? e : a), null);
  const totalText = top ? `${t.total} ${t.max} ${fmt(top.v)} (${spec.labels[top.i] ?? ''}). ` : '';
  const desc = `${N}${t.items} (${first}–${last}). ${totalText}${summarize(t, spec.labels, spec.series, fmt)}`;
  const lg = spec.legend === false ? '' : legend(spec.series.map((s, i) => ({ name: s.name, idx: i, ...(s.color ? { color: s.color } : {}), ...(s.quality ? { quality: s.quality } : {}) })));
  const tbl = seriesTable(t, spec.title, spec.xLabel ?? t.cat, spec.labels, spec.series, fmt);
  return frame(ctx, spec, inner, desc, lg, wrapTable(spec.table ?? 'details', t, tbl));
}

export const plugin = definePlugin<StreamSpec>({
  type: 'stream',
  names: { ko: '스트림 그래프', en: 'Streamgraph' },
  validate(input) {
    const o = dict(input, 'spec', [...BASE, 'labels', 'series', 'offset', 'xLabel']);
    const out = base(o);
    out.type = 'stream';
    const ls = labels(o.labels, 'labels');
    out.labels = ls;
    const series = seriesList(o.series, 'series', ls.length, true);
    const cap = Math.floor(MAX_POINTS / series.length);
    if (ls.length > cap) fail('labels', `must have at most ${cap} entries`);
    out.series = series;
    put(out, 'offset', oneOf(o.offset, 'offset', ['wiggle', 'silhouette'] as const));
    put(out, 'xLabel', optStr(o.xLabel, 'xLabel', 60));
    return out as unknown as StreamSpec;
  },
  height: (_spec, w) => (w < 420 ? 240 : 300),
  render,
});
