// Bump chart: rank of each series over time (rank 1 at the top). Ranks are computed from values or given directly.
import type { BaseSpec, Series } from '../types.ts';
import { definePlugin } from '../plugin.ts';
import { BASE, MAX_POINTS, base, dict, fail, labels, oneOf, optBool, optStr, put, seriesList } from '../check.ts';
import { clamp, esc, makeFmt, n2, niceTicks, truncate, tw } from '../format.ts';
import { type Ctx, FS, MAX_FOCUS, colorAttrs, empty, focusable, frame, legend, runs, table, wrapTable } from '../kit.ts';
import { spread } from './slope.ts';

export interface BumpSpec extends BaseSpec {
  type: 'bump';
  /** Time points, e.g. weeks or months. */
  labels: string[];
  /** Values per label (null = missing, drawn as a gap). With `ranks: true` the values are ranks (integers >= 1). */
  series: Series[];
  ranks?: boolean;
  /** Ranking direction when ranks are computed: "desc" (default, largest value = rank 1) or "asc". */
  order?: 'desc' | 'asc';
  xLabel?: string;
}

export const MAX_RANK = 1000;

/** Rank matrix [series][label]; ties share the better rank (1, 2, 2, 4). null stays null. */
export function rankOf(spec: Pick<BumpSpec, 'series' | 'ranks' | 'order' | 'labels'>): (number | null)[][] {
  if (spec.ranks) return spec.series.map((s) => s.values.slice());
  const desc = spec.order !== 'asc';
  return spec.series.map((s) => s.values.map((v, i) => {
    if (v === null) return null;
    let r = 1;
    for (const o of spec.series) { const w = o.values[i]; if (w !== null && w !== undefined && (desc ? w > v : w < v)) r++; }
    return r;
  }));
}

function render(spec: BumpSpec, ctx: Ctx): string {
  const t = ctx.t;
  const N = spec.labels.length;
  const ranks = rankOf(spec);
  const fmt = makeFmt(spec.unit, spec.series.flatMap((s) => s.values));
  const present = ranks.flat().filter((r): r is number => r !== null);
  const rankText = (r: number): string => `${t.rank} ${r}`;
  const pointText = (se: Series, j: number, i: number): string => {
    const r = ranks[j]?.[i] as number;
    const v = se.values[i] as number;
    return `${spec.labels[i] ?? ''}, ${se.name}: ${rankText(r)}${spec.ranks ? '' : ` (${fmt(v)})`}${se.quality ? ` · ${se.quality}` : ''}`;
  };
  let inner = '';
  if (!present.length) inner = empty(ctx);
  else {
    const maxR = Math.max(...present);
    const names = spec.series.map((s) => s.name);
    const right = clamp(Math.max(...names.map((n) => tw(n, FS))) + 16, 44, ctx.W * 0.3);
    const left = tw(String(maxR), FS) + 14;
    const top = 12; const bottom = FS + 12 + (spec.xLabel ? FS + 8 : 0);
    const px = left; const py = top; const pw = Math.max(20, ctx.W - left - right); const ph = Math.max(20, ctx.H - top - bottom);
    const sy = (r: number): number => (maxR === 1 ? py + ph / 2 : py + ((r - 1) / (maxR - 1)) * ph);
    const sx = (i: number): number => (N === 1 ? px + pw / 2 : px + (i / (N - 1)) * pw);
    let s = '';
    const ticks = maxR <= 20 ? Array.from({ length: maxR }, (_, k) => k + 1) : [1, ...niceTicks(1, maxR, 6).ticks.filter((v) => v > 1 && v <= maxR)];
    for (const r of ticks) {
      const y = sy(r);
      s += `<line class="lc-grid" x1="${n2(px)}" y1="${n2(y)}" x2="${n2(px + pw)}" y2="${n2(y)}"/>`;
      s += `<text class="lc-tick" x="${n2(px - 8)}" y="${n2(y + FS * 0.35)}" text-anchor="end">${r}</text>`;
    }
    // x labels: all when they fit, otherwise every step-th
    const catMax = Math.max(...spec.labels.map((l) => tw(l, FS)));
    const band = N > 1 ? pw / (N - 1) : pw;
    const step = catMax + 8 <= band || N <= 4 ? 1 : Math.max(1, Math.ceil((catMax + 8) / band));
    for (let i = 0; i < N; i += step) {
      const l = truncate(spec.labels[i] ?? '', Math.max(24, step * band - 6), FS);
      const w = tw(l, FS);
      s += `<text class="lc-tick" x="${n2(clamp(sx(i) - w / 2, 2, ctx.W - w - 2))}" y="${n2(py + ph + FS + 8)}">${esc(l)}</text>`;
    }
    if (spec.xLabel) s += `<text class="lc-axis-title" x="${n2(px + pw / 2)}" y="${n2(ctx.H - 3)}" text-anchor="middle">${esc(truncate(spec.xLabel, pw, FS))}</text>`;
    const focus = present.length <= MAX_FOCUS;
    let lines = '';
    let marks = '';
    const ends: { j: number; y: number }[] = [];
    spec.series.forEach((se, j) => {
      const rs = ranks[j] ?? [];
      const c = colorAttrs(j, se.color);
      const d = runs(rs).filter((r) => r.length > 1).map((r) => 'M' + r.map((i) => `${n2(sx(i))} ${n2(sy(rs[i] as number))}`).join(' L')).join(' ');
      if (d) lines += `<path class="lc-bump-line ${c} data-s="${j}" d="${d}"/>`;
      rs.forEach((r, i) => {
        if (r === null) return;
        const cx = sx(i); const cy = sy(r);
        const dot = `<circle class="lc-mark lc-bump-dot ${c} data-s="${j}" data-i="${i}" data-r="${r}" data-v="${se.values[i]}" cx="${n2(cx)}" cy="${n2(cy)}" r="4.5"/>`;
        marks += focus ? focusable(ctx, 'lc-pt-bump', pointText(se, j, i), `<circle class="lc-hit" cx="${n2(cx)}" cy="${n2(cy)}" r="9"/>${dot}`, cx, cy - 4) : dot;
      });
      const last = rs.reduce<number>((a, r, i) => (r === null ? a : i), -1);
      if (last >= 0) ends.push({ j, y: sy(rs[last] as number) });
    });
    const ys = spread(ends.map((e) => e.y), FS + 1, py, py + ph);
    const endLabels = ends.map((e, k) => {
      const se = spec.series[e.j] as Series;
      return `<text class="lc-bump-label" x="${n2(px + pw + 10)}" y="${n2((ys[k] ?? e.y) + FS * 0.35)}">${esc(truncate(se.name, right - 14, FS))}</text>`;
    }).join('');
    inner = s + lines + endLabels + marks;
  }
  const first = spec.labels[0] ?? ''; const lastL = spec.labels[N - 1] ?? '';
  const desc = `${N}${t.items} (${first}–${lastL}). ` + spec.series.map((se, j) => {
    const rs = ranks[j] ?? [];
    const idx = rs.map((r, i) => (r === null ? -1 : i)).filter((i) => i >= 0);
    const miss = N - idx.length;
    const q = se.quality ? ` ${t.quality}: ${se.quality}.` : '';
    const a = idx[0]; const b = idx[idx.length - 1];
    if (a === undefined || b === undefined) return `${se.name}: ${t.na}.${q}`;
    const pr = idx.map((i) => rs[i] as number);
    return `${se.name}: ${t.start} ${rankText(rs[a] as number)} (${spec.labels[a]}), ${t.end} ${rankText(rs[b] as number)} (${spec.labels[b]}), ${t.rank} ${t.range} ${Math.min(...pr)}–${Math.max(...pr)}${miss ? `, ${t.missing} ${miss}` : ''}.${q}`;
  }).join(' ');
  // end labels name every series that reaches the last label; the legend is on by default only when some do not
  const endsEarly = spec.series.some((_, j) => (ranks[j] ?? [])[N - 1] === null);
  const lg = (spec.legend ?? endsEarly) ? legend(spec.series.map((se, i) => ({ name: se.name, idx: i, ...(se.color ? { color: se.color } : {}), ...(se.quality ? { quality: se.quality } : {}) }))) : '';
  const tbl = table(t, spec.title, [spec.xLabel ?? t.cat, ...spec.series.map((s) => `${s.name}${s.quality ? ` (${s.quality})` : ''}`)],
    spec.labels.map((l, i) => ({
      th: l,
      cells: spec.series.map((se, j) => {
        const r = ranks[j]?.[i];
        if (r === null || r === undefined) return null;
        return spec.ranks ? rankText(r) : `${rankText(r)} (${fmt(se.values[i] as number)})`;
      }),
    })));
  return frame(ctx, spec, inner, desc, lg, wrapTable(spec.table ?? 'details', t, tbl));
}

export const plugin = definePlugin<BumpSpec>({
  type: 'bump',
  names: { ko: '순위 변동 차트', en: 'Bump chart' },
  validate(input) {
    const o = dict(input, 'spec', [...BASE, 'labels', 'series', 'ranks', 'order', 'xLabel']);
    const out = base(o);
    out.type = 'bump';
    const ls = labels(o.labels, 'labels');
    out.labels = ls;
    const series = seriesList(o.series, 'series', ls.length, false);
    const cap = Math.floor(MAX_POINTS / series.length);
    if (ls.length > cap) fail('labels', `must have at most ${cap} entries`);
    const ranks = optBool(o.ranks, 'ranks');
    if (ranks) {
      series.forEach((s, j) => s.values.forEach((v, i) => {
        if (v === null) return;
        const p = `series[${j}].values[${i}]`;
        if (v < 1 || v > MAX_RANK) fail(p, `must be a finite number in [1, ${MAX_RANK}]`);
        if (!Number.isInteger(v)) fail(p, 'must be an integer');
      }));
    }
    out.series = series;
    put(out, 'ranks', ranks);
    put(out, 'order', oneOf(o.order, 'order', ['desc', 'asc'] as const));
    put(out, 'xLabel', optStr(o.xLabel, 'xLabel', 60));
    return out as unknown as BumpSpec;
  },
  height: (spec) => {
    const maxR = spec.ranks ? Math.max(1, ...spec.series.flatMap((s) => s.values).filter((v): v is number => v !== null)) : spec.series.length;
    return clamp(Math.min(maxR, 20) * 28 + 60, 200, 640);
  },
  render,
});
