// Shared cartesian plotting (category x axis, value y axis): line, area, bar and their variants.
// Chart types in src/charts/ may reuse domainFor()/plot() for category-based charts.
import type { Series } from './types.ts';
import { type Fmt, clamp, esc, n2, niceTicks, truncate, tw } from './format.ts';
import { type Ctx, FS, colorAttrs, present, runs, tip } from './kit.ts';

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

export interface PlotOpts {
  ctx: Ctx; x: number; y: number; w: number; h: number;
  kind: 'line' | 'area' | 'bar'; horizontal: boolean; stacked: boolean;
  series: Series[]; sidx: number[]; labels: string[]; fmt: Fmt; dom: Domain;
  compact: boolean; bare: boolean; xLabel?: string; focus: boolean; panelId?: string; panelName?: string;
  /** Override the value box / aria text for one point (e.g. percent bars show share and the raw value). */
  labelFor?: (se: Series, i: number, v: number) => string;
  /** Override the tick label formatter (defaults to fmt). */
  tickFmt?: Fmt;
}

/** Draw one cartesian plot. `shapes` go below, `points` (focusable) are emitted last so tips stay on top. */
export function plot(o: PlotOpts): { shapes: string; points: string } {
  const { ctx, kind, horizontal, stacked, series, labels, dom, fmt, compact, bare } = o;
  const fs = compact ? 10.5 : FS;
  const N = labels.length;
  const tickLabels = dom.ticks.map(o.tickFmt ?? fmt);
  const maxTick = Math.max(0, ...tickLabels.map((t) => tw(t, fs)));
  const catMax = Math.max(0, ...labels.map((l) => tw(l, fs)));
  let left: number; let right: number; let top: number; let bottom: number;
  if (bare) { left = 4; right = 6; top = 4; bottom = 4; }
  else if (horizontal) {
    left = Math.min(o.w * 0.4, catMax + 12);
    right = Math.ceil(tw(tickLabels[tickLabels.length - 1] ?? '', fs) / 2) + 6; top = 6;
    bottom = fs + 12 + (o.xLabel ? fs + 6 : 0);
  } else {
    left = maxTick + 12; right = 10; top = 8; bottom = fs + 12 + (o.xLabel ? fs + 6 : 0);
  }
  const px = o.x + left; const py = o.y + top; const pw = Math.max(10, o.w - left - right); const ph = Math.max(10, o.h - top - bottom);
  const span = dom.max - dom.min || 1;
  const vv = (v: number): number => (horizontal ? px + ((v - dom.min) / span) * pw : py + ph - ((v - dom.min) / span) * ph);
  const band = (horizontal ? ph : pw) / N;
  const cc = (i: number): number => (horizontal ? py : px) + (i + 0.5) * band;
  const zero = vv(clamp(0, dom.min, dom.max));
  let s = '';
  let pts = '';

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
    // all labels when they fit; truncate (never drop) for few categories; otherwise thin out by width
    const fitAll = !horizontal && (catMax + 6 <= band || N <= 6);
    const step = fitAll ? 1 : Math.max(1, Math.ceil(lw / band));
    for (let i = 0; i < N; i += step) {
      const raw = labels[i] ?? '';
      if (horizontal) {
        const t = truncate(raw, left - 12, fs);
        s += `<text class="lc-tick" x="${n2(px - 6)}" y="${n2(cc(i) + fs * 0.35)}" text-anchor="end">${esc(t)}</text>`;
      } else {
        const t = truncate(raw, Math.max(24, (fitAll ? band : step * band) - 4), fs);
        const w = tw(t, fs);
        s += `<text class="lc-tick" x="${n2(clamp(cc(i) - w / 2, o.x, o.x + o.w - w))}" y="${n2(py + ph + fs + 6)}">${esc(t)}</text>`;
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

  if (kind === 'bar') {
    const nS = stacked ? 1 : series.length;
    const gw = band * 0.76;
    const bw = gw / nS;
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
          rect = `<rect class="lc-mark lc-bar ${colorAttrs(sid(j), se.color)} data-s="${j}" data-i="${i}" data-v="${v}" x="${n2(x0)}" y="${n2(off)}" width="${n2(w0)}" height="${n2(wid)}"/>`;
        } else {
          const y0 = Math.min(a, b); const h0 = Math.max(Math.abs(b - a), 1);
          rect = `<rect class="lc-mark lc-bar ${colorAttrs(sid(j), se.color)} data-s="${j}" data-i="${i}" data-v="${v}" x="${n2(off)}" y="${n2(y0)}" width="${n2(wid)}" height="${n2(h0)}"/>`;
        }
        if (o.focus) {
          const ax = horizontal ? Math.max(a, b) : off + wid / 2;
          const ay = horizontal ? off + wid / 2 : Math.min(a, b);
          pts += group('lc-pt-bar', pointLabel(se, i, v), rect, tip(ctx, pointLabel(se, i, v), ax, ay));
        } else s += rect;
      });
    });
  } else {
    series.forEach((se, j) => {
      const c = colorAttrs(sid(j), se.color);
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
  }
  return { shapes: s, points: pts };
}
