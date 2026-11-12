// Shared cartesian plotting (category x axis, value y axis): line, area, bar and their variants.
// Chart types in src/charts/ may reuse domainFor()/plot() for category-based charts.
import type { Series } from './types.ts';
import { type Fmt, clamp, esc, n2, niceTicks, truncate, tw } from './format.ts';
import { type Ctx, FS, colorAttrs, present, runs, spread, tip, wrapText } from './kit.ts';

export interface Domain { min: number; max: number; ticks: number[] }

/** Value domain with "nice" ticks. Stacked domains split positive and negative stacks (diverging bars). */
export function domainFor(list: Series[], kind: 'line' | 'area' | 'bar', stacked: boolean, yMin: number | undefined, yMax: number | undefined, count: number): Domain | null {
  const n = list[0]?.values.length ?? 0;
  let lo = Infinity;
  let hi = -Infinity;
  if (stacked) {
    for (let i = 0; i < n; i++) {
      let pos = 0; let neg = 0; let any = false;
      for (const s of list) { const v = s.values[i]; if (v !== null && v !== undefined) { if (v >= 0) pos += v; else neg += v; any = true; } }
      if (any) { lo = Math.min(lo, neg, 0); hi = Math.max(hi, pos); }
    }
  } else {
    for (const s of list) for (const v of present(s.values)) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  }
  if (!Number.isFinite(lo)) return null;
  if (kind !== 'line') { lo = Math.min(lo, 0); hi = Math.max(hi, 0); }
  if (yMin !== undefined) lo = yMin;
  if (yMax !== undefined) hi = yMax;
  const t = niceTicks(lo, hi, count);
  return { min: yMin !== undefined ? Math.min(yMin, t.min) : t.min, max: yMax !== undefined ? Math.max(yMax, t.max) : t.max, ticks: t.ticks };
}

/** Font size of value / end labels and the category label line height. */
const LFS = 11;
const LH = 13;

/** Hangul syllables and jamo: a label made of one Korean word may break in the middle (no hyphenation needed). */
const HANGUL = /[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]/;
/**
 * Category label as at most `lines` lines of `max` px: whole when it fits, wrapped at spaces, a single Korean word
 * split evenly in two, anything else truncated. Never leaves a one-character tail.
 */
export function splitCat(raw: string, max: number, fs: number, lines: number): string[] {
  if (lines < 2 || tw(raw, fs) <= max) return [truncate(raw, max, fs)];
  if (/\s/.test(raw)) return wrapText(raw, max, fs, 2);
  const chars = [...raw];
  if (HANGUL.test(raw) && chars.length >= 4) {
    const m = Math.ceil(chars.length / 2);
    return [truncate(chars.slice(0, m).join(''), max, fs), truncate(chars.slice(m).join(''), max, fs)];
  }
  return [truncate(raw, max, fs)];
}

/** True when a category label of a horizontal bar chart has to wrap onto a second line (used to size the rows). */
export function wrapsCategory(labels: string[], w: number, fs = FS): boolean {
  const catMax = Math.max(0, ...labels.map((l) => tw(l, fs)));
  const left = Math.min(w * 0.4, catMax + 12);
  return catMax > left - 12;
}

export interface PlotOpts {
  ctx: Ctx; x: number; y: number; w: number; h: number;
  kind: 'line' | 'area' | 'bar'; horizontal: boolean; stacked: boolean;
  series: Series[]; sidx: number[]; labels: string[]; fmt: Fmt; dom: Domain;
  compact: boolean; bare: boolean; xLabel?: string; focus: boolean; panelId?: string; panelName?: string;
  /** Override the value box / aria text for one point (e.g. percent bars show share and the raw value). */
  labelFor?: (se: Series, i: number, v: number) => string;
  /** Override the tick label formatter (defaults to fmt). */
  tickFmt?: Fmt;
  /** End-of-series labels for line/area: `full` = series name + last value, `value` = last value only. */
  endLabels?: 'full' | 'value';
  /** Bar value labels: at the bar end for plain bars, inside segments plus the total for stacks (only where they fit). */
  valueLabels?: boolean;
  /** Formatter for value labels (defaults to fmt); percent bars pass a `%` formatter for the drawn share. */
  valueFmt?: Fmt;
}

export interface PlotOut {
  /** Axes, grid and the marks that are not focusable. */
  shapes: string;
  /** Value / end labels layer (`<g class="lc-lbls">`), drawn above the marks and below the focusable points. */
  labels: string;
  /** Focusable marks with their value boxes; emitted last so tips stay on top. */
  points: string;
  /** Category centre of index i and the pixel position of a value, for callers that add their own marks. */
  cx: (i: number) => number;
  vv: (v: number) => number;
}

/** Draw one cartesian plot. Concatenate `shapes + labels + points`. */
export function plot(o: PlotOpts): PlotOut {
  const { ctx, kind, horizontal, stacked, series, labels, dom, fmt, compact, bare } = o;
  const fs = compact ? 10.5 : FS;
  const N = labels.length;
  const tickLabels = dom.ticks.map(o.tickFmt ?? fmt);
  const maxTick = Math.max(0, ...tickLabels.map((t) => tw(t, fs)));
  const catMax = Math.max(0, ...labels.map((l) => tw(l, fs)));
  const vfmt = o.valueFmt ?? fmt;
  const lastOf = (se: Series): number => se.values.reduce<number>((a, v, i) => (v === null ? a : i), -1);
  // end labels (line/area): reserve a right margin for the widest label, capped at 30% of the plot width
  const ends = kind !== 'bar' && o.endLabels ? series.map((se) => ({ se, i: lastOf(se) })).filter((e) => e.i >= 0) : [];
  const endText = (se: Series): { name: string; val: string } => ({ name: o.endLabels === 'full' ? se.name : '', val: vfmt(se.values[lastOf(se)] as number) });
  let endW = 0;
  if (ends.length) {
    const need = Math.max(...ends.map(({ se }) => { const t = endText(se); return Math.max(tw(t.val, LFS), t.name ? tw(t.name, LFS) : 0); }));
    endW = Math.min(need, o.w * 0.3) + 8;
  }
  // bar value labels: plain bars reserve room at the bar end; stacks label segments inside and the total at the end
  const bars = kind === 'bar' && o.valueLabels === true;
  const nS = stacked ? 1 : series.length;
  const totals = stacked ? labels.map((_, i) => series.reduce((a, s) => a + (s.values[i] ?? 0), 0)) : [];
  const diverging = stacked && series.some((s) => s.values.some((v) => v !== null && v < 0));
  const showTotal = bars && stacked && !diverging && !o.valueFmt;
  const valW = bars ? Math.max(0, ...series.flatMap((s) => present(s.values).map((v) => tw(vfmt(v), LFS))), ...(showTotal ? totals.map((t) => tw(fmt(t), LFS)) : [])) : 0;
  let left: number; let right: number; let top: number; let bottom: number;
  let catLines = 1;
  if (bare) { left = 4; right = 6 + endW; top = 4; bottom = 4; }
  else if (horizontal) {
    left = Math.min(o.w * 0.4, catMax + 12);
    right = Math.max(Math.ceil(tw(tickLabels[tickLabels.length - 1] ?? '', fs) / 2) + 6, bars && (!stacked || showTotal) ? valW + 10 : 0); top = 6;
    bottom = fs + 12 + (o.xLabel ? fs + 6 : 0);
  } else {
    left = maxTick + 12; right = 10 + endW; top = bars && (!stacked || showTotal) ? LFS + 10 : 8;
    // labels with a space may wrap onto a second line (never split inside a word); single words are truncated or thinned
    const band0 = (o.w - left - right) / N;
    if (N <= 8 && labels.some((l) => tw(l, fs) + 6 > band0 && splitCat(l, band0 - 4, fs, 2).length > 1)) catLines = 2;
    bottom = fs + 12 + (catLines - 1) * LH + (o.xLabel ? fs + 6 : 0);
  }
  const px = o.x + left; const py = o.y + top; const pw = Math.max(10, o.w - left - right); const ph = Math.max(10, o.h - top - bottom);
  const span = dom.max - dom.min || 1;
  const vv = (v: number): number => (horizontal ? px + ((v - dom.min) / span) * pw : py + ph - ((v - dom.min) / span) * ph);
  const band = (horizontal ? ph : pw) / N;
  const cc = (i: number): number => (horizontal ? py : px) + (i + 0.5) * band;
  const zero = vv(clamp(0, dom.min, dom.max));
  let s = '';
  let pts = '';
  let lbl = '';

  if (!bare) {
    for (const [ti, t] of dom.ticks.entries()) {
      const p = vv(t);
      const label = tickLabels[ti] ?? '';
      if (horizontal) {
        s += `<line class="lc-grid" x1="${n2(p)}" y1="${n2(py)}" x2="${n2(p)}" y2="${n2(py + ph)}"/>`;
        const lw = tw(label, fs);
        s += `<text class="lc-tick" x="${n2(clamp(p - lw / 2, o.x, o.x + o.w - lw))}" y="${n2(py + ph + fs + 5)}">${esc(label)}</text>`;
      } else {
        s += `<line class="lc-grid" x1="${n2(px)}" y1="${n2(p)}" x2="${n2(px + pw)}" y2="${n2(p)}"/>`;
        s += `<text class="lc-tick" x="${n2(px - 6)}" y="${n2(p + fs * 0.35)}" text-anchor="end">${esc(label)}</text>`;
      }
    }
    const lw = horizontal ? fs + 4 : catMax + 8;
    // all labels when they fit or there are few categories (wrapped to two lines, then truncated); otherwise thin out
    const fitAll = !horizontal && (catMax + 6 <= band || N <= 6 || catLines > 1);
    const step = fitAll ? 1 : Math.max(1, Math.ceil(lw / band));
    for (let i = 0; i < N; i += step) {
      const raw = labels[i] ?? '';
      if (horizontal) {
        const lines = splitCat(raw, left - 12, fs, band >= 2 * LH + 2 ? 2 : 1);
        const y0 = cc(i) + fs * 0.35 - ((lines.length - 1) * LH) / 2;
        s += `<text class="lc-tick" x="${n2(px - 6)}" y="${n2(y0)}" text-anchor="end">${lines.map((l, k) => `<tspan x="${n2(px - 6)}"${k ? ` dy="${LH}"` : ''}>${esc(l)}</tspan>`).join('')}</text>`;
      } else {
        const max = Math.max(24, (fitAll ? band : step * band) - 4);
        const lines = splitCat(raw, max, fs, catLines);
        const y0 = py + ph + fs + 6;
        s += `<text class="lc-tick" x="${n2(cc(i))}" y="${n2(y0)}" text-anchor="middle">${lines.map((l, k) => {
          const w = tw(l, fs);
          const x = clamp(cc(i), o.x + w / 2, o.x + o.w - w / 2);
          return `<tspan x="${n2(x)}"${k ? ` dy="${LH}"` : ''}>${esc(l)}</tspan>`;
        }).join('')}</text>`;
      }
    }
    s += horizontal
      ? `<line class="lc-axis" x1="${n2(zero)}" y1="${n2(py)}" x2="${n2(zero)}" y2="${n2(py + ph)}"/>`
      : `<line class="lc-axis" x1="${n2(px)}" y1="${n2(zero)}" x2="${n2(px + pw)}" y2="${n2(zero)}"/>`;
    if (o.xLabel) {
      s += `<text class="lc-axis-title" x="${n2(px + pw / 2)}" y="${n2(o.y + o.h - 3)}" text-anchor="middle">${esc(truncate(o.xLabel, pw, fs))}</text>`;
    }
  }

  const sid = (j: number): number => o.sidx[j] ?? j;
  // Stack spans per series and category: positives grow up from 0, negatives grow down from 0.
  const spans: ([number, number] | null)[][] = [];
  if (stacked) {
    const pos = new Array<number>(N).fill(0); const neg = new Array<number>(N).fill(0);
    for (const se of series) {
      spans.push(se.values.map((v, i) => {
        if (v === null) return null;
        if (v >= 0) { const a = pos[i] ?? 0; pos[i] = a + v; return [a, a + v]; }
        const a = neg[i] ?? 0; neg[i] = a + v; return [a, a + v];
      }));
    }
  }
  const pointLabel = o.labelFor ?? ((se: Series, i: number, v: number): string =>
    `${labels[i] ?? ''}, ${se.name}${o.panelName ? ` (${o.panelName})` : ''}: ${fmt(v)}${se.quality ? ` · ${se.quality}` : ''}`);
  const group = (cls: string, aria: string, inner: string, t: string): string =>
    `<g class="lc-pt ${cls}" tabindex="0" aria-label="${esc(aria)}">${inner}${t}</g>`;
  const tint = (j: number, se: Series): string => colorAttrs(sid(j), se.color);

  if (kind === 'bar') {
    const gw = band * 0.76;
    const bw = gw / nS;
    // plain bars: labels only when the widest one fits the bar slot (horizontal bars always have room reserved)
    const slot = horizontal ? Infinity : band / nS - 1;
    // Neighbouring end labels keep a gap (bold text is ~6% wider than the estimate, the halo adds 1.5px a side): on
    // narrow screens a run of equal values ("1명1명1명") would otherwise read as one word, so the labels are left out
    // and the value boxes carry them.
    const totW = Math.max(0, ...totals.map((t) => tw(fmt(t), LFS)));
    const endLbl = bars && (!stacked ? valW * 1.06 + 4 <= slot : showTotal && (horizontal || totW * 1.06 + 4 <= band));
    series.forEach((se, j) => {
      se.values.forEach((v, i) => {
        if (v === null) return;
        let a: number; let b: number;
        if (stacked) { const sp = spans[j]?.[i] ?? [0, v]; a = vv(sp[0]); b = vv(sp[1]); } else { a = zero; b = vv(v); }
        const off = cc(i) - gw / 2 + (stacked ? 0 : j * bw);
        const wid = Math.max(1, bw - (nS > 1 ? 1.5 : 0));
        let rect: string;
        if (horizontal) {
          const x0 = Math.min(a, b); const w0 = Math.max(Math.abs(b - a), 1);
          rect = `<rect class="lc-mark lc-bar ${tint(j, se)} data-s="${j}" data-i="${i}" data-v="${v}" x="${n2(x0)}" y="${n2(off)}" width="${n2(w0)}" height="${n2(wid)}"/>`;
        } else {
          const y0 = Math.min(a, b); const h0 = Math.max(Math.abs(b - a), 1);
          rect = `<rect class="lc-mark lc-bar ${tint(j, se)} data-s="${j}" data-i="${i}" data-v="${v}" x="${n2(off)}" y="${n2(y0)}" width="${n2(wid)}" height="${n2(h0)}"/>`;
        }
        // inside-segment labels travel with the (focusable) bar so they stay above it; the rest go to the label layer
        let inside = '';
        if (bars) {
          const text = vfmt(v);
          const w = tw(text, LFS);
          const len = Math.abs(b - a);
          if (stacked) {
            // inside the segment when it is thick and long enough for the text
            if (wid >= LFS + 3 && len >= w + 6) {
              const mx = horizontal ? (a + b) / 2 : off + wid / 2; const my = horizontal ? off + wid / 2 : (a + b) / 2;
              inside = `<g class="lc-lbls" aria-hidden="true"><text class="lc-val lc-val-in" data-s="${j}" x="${n2(mx)}" y="${n2(my + LFS * 0.36)}" text-anchor="middle">${esc(text)}</text></g>`;
            }
          } else if (endLbl) {
            const neg = v < 0;
            if (horizontal) {
              const x = neg ? Math.min(a, b) - 4 : Math.max(a, b) + 4;
              lbl += `<text class="lc-val ${tint(j, se)} data-s="${j}" x="${n2(x)}" y="${n2(off + wid / 2 + LFS * 0.36)}"${neg ? ' text-anchor="end"' : ''}>${esc(text)}</text>`;
            } else {
              const y = neg ? Math.min(Math.max(a, b) + LFS + 3, py + ph - 2) : Math.min(a, b) - 4;
              lbl += `<text class="lc-val ${tint(j, se)} data-s="${j}" x="${n2(off + wid / 2)}" y="${n2(y)}" text-anchor="middle">${esc(text)}</text>`;
            }
          }
        }
        if (o.focus) {
          const ax = horizontal ? Math.max(a, b) : off + wid / 2;
          const ay = horizontal ? off + wid / 2 : Math.min(a, b);
          pts += group('lc-pt-bar', pointLabel(se, i, v), rect + inside, tip(ctx, pointLabel(se, i, v), ax, ay));
        } else s += rect + inside;
      });
    });
    if (endLbl && stacked) {
      totals.forEach((t, i) => {
        if (!series.some((se) => se.values[i] !== null)) return;
        const e = vv(t); const off = cc(i);
        lbl += horizontal
          ? `<text class="lc-val lc-val-sum" x="${n2(e + 4)}" y="${n2(off + LFS * 0.36)}">${esc(fmt(t))}</text>`
          : `<text class="lc-val lc-val-sum" x="${n2(off)}" y="${n2(e - 4)}" text-anchor="middle">${esc(fmt(t))}</text>`;
      });
    }
  } else {
    series.forEach((se, j) => {
      const c = tint(j, se);
      const top = (i: number): number => vv(stacked ? (spans[j]?.[i]?.[1] ?? 0) : (se.values[i] ?? 0));
      const bot = (i: number): number => (stacked ? vv(spans[j]?.[i]?.[0] ?? 0) : zero);
      const xs = (i: number): number => cc(i);
      for (const r of runs(se.values)) {
        if (r.length < 2) continue;
        if (kind === 'area') {
          const up = r.map((i) => `${n2(xs(i))} ${n2(top(i))}`).join(' L');
          const dn = [...r].reverse().map((i) => `${n2(xs(i))} ${n2(bot(i))}`).join(' L');
          s += `<path class="lc-area ${c} data-s="${j}" d="M${up} L${dn} Z"/>`;
        }
      }
      const d = runs(se.values).filter((r) => r.length > 1).map((r) => 'M' + r.map((i) => `${n2(xs(i))} ${n2(top(i))}`).join(' L')).join(' ');
      if (d) s += `<path class="lc-line ${c} data-s="${j}" pathLength="1" d="${d}"/>`;
      const total = present(se.values).length;
      const visible = total <= 24;
      const solo = new Set(runs(se.values).filter((r) => r.length === 1).map((r) => r[0]));
      se.values.forEach((v, i) => {
        if (v === null) return;
        const cx = xs(i); const cy = top(i);
        const dot = `<circle class="lc-mark lc-dot${visible || solo.has(i) ? ' lc-dot-vis' : ''} ${c} data-s="${j}" data-i="${i}" data-v="${v}" cx="${n2(cx)}" cy="${n2(cy)}" r="${compact ? 3 : 3.5}"/>`;
        if (o.focus) {
          pts += group('lc-pt-dot', pointLabel(se, i, v), `<circle class="lc-hit" cx="${n2(cx)}" cy="${n2(cy)}" r="9"/>${dot}`, tip(ctx, pointLabel(se, i, v), cx, cy));
        } else if (solo.has(i) || visible) s += dot;
      });
    });
    if (ends.length) {
      // name above the bold value, right of the last point; neighbours are pushed apart and get a leader line
      const maxW = endW - 8;
      const items = ends.map(({ se, i }) => {
        const t = endText(se);
        const name = t.name ? truncate(t.name, maxW, LFS) : '';
        const j = series.indexOf(se);
        const y = vv(stacked ? (spans[j]?.[i]?.[1] ?? 0) : (se.values[i] ?? 0));
        return { se, j, i, name, val: t.val, y, lines: name ? 2 : 1 };
      });
      const hgt = (it: { lines: number }): number => it.lines * LH;
      // labels may overhang the plot by a few px (a bare sparkline uses its whole height) before neighbours push them
      const ys = spread(items.map((it) => ({ y: it.y, h: hgt(it) + 2 })), bare ? o.y : py - 6, bare ? o.y + o.h : py + ph + 6);
      // one label column right of the plot; a bare strip (sparkline) tucks the label next to its last point
      const x = bare ? Math.min(px + pw + 6, Math.max(...items.map((it) => cc(it.i))) + 8) : px + pw + 6;
      items.forEach((it, k) => {
        const yc = ys[k] ?? it.y;
        const y0 = yc - ((it.lines - 1) * LH) / 2 + LFS * 0.36;
        if (Math.abs(yc - it.y) > LH / 2) lbl += `<path class="lc-lead" d="M${n2(cc(it.i) + 4)},${n2(it.y)}L${n2(x - 2)},${n2(yc)}"/>`;
        lbl += `<text class="lc-end ${tint(it.j, it.se)} data-s="${it.j}" x="${n2(x)}" y="${n2(y0)}">${it.name ? `<tspan class="lc-lbl">${esc(it.name)}</tspan><tspan class="lc-lbl-v" x="${n2(x)}" dy="${LH}">${esc(it.val)}</tspan>` : `<tspan class="lc-lbl-v">${esc(it.val)}</tspan>`}</text>`;
      });
    }
  }
  return { shapes: s, labels: lbl ? `<g class="lc-lbls" aria-hidden="true">${lbl}</g>` : '', points: pts, cx: cc, vv };
}
