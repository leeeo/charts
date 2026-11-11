// Shared finance helpers for the stock chart types (candlestick, ohlc, price, valuation, ...):
// indicators computed from the given data (SMA / EMA / Bollinger), overlay and volume validation, the up/down colour
// convention and a date-axis layout with an optional volume pane under the price pane (one shared x axis).
// A null day is a gap everywhere: no mark, indicator windows skip it, lines break there.
import type { Value } from '../types.ts';
import { dict, fail, num, oneOf, values } from '../check.ts';
import { type Fmt, clamp, esc, group, n2, niceTicks, truncate, tw } from '../format.ts';
import { type Ctx, FS, colorAttrs, runs } from '../kit.ts';

/** Colour convention for rises and falls. kr (default): up red, down blue. global: up green, down red. */
export type Convention = 'kr' | 'global';
export const CONVENTIONS = ['kr', 'global'] as const;
export const convCls = (c: Convention | undefined): string | undefined => (c === 'global' ? 'lc-conv-global' : undefined);

export type OverlayKind = 'sma' | 'ema' | 'bollinger';
export interface Overlay {
  kind: OverlayKind;
  /** Window in trading days (integer 2..250). */
  window: number;
  /** Bollinger width in standard deviations (default 2). Only for kind "bollinger". */
  k?: number;
}

/** Simple moving average of the last `w` available values; null on null days and before `w` values exist. */
export function sma(vals: Value[], w: number): Value[] {
  const win: number[] = [];
  return vals.map((c) => {
    if (c === null) return null;
    win.push(c);
    if (win.length > w) win.shift();
    return win.length === w ? win.reduce((a, b) => a + b, 0) / w : null;
  });
}

/** Exponential moving average (alpha 2/(w+1)), seeded with the SMA of the first `w` available values. */
export function ema(vals: Value[], w: number): Value[] {
  const a = 2 / (w + 1);
  const seed: number[] = [];
  let prev: number | null = null;
  return vals.map((v) => {
    if (v === null) return null;
    if (prev === null) {
      seed.push(v);
      if (seed.length < w) return null;
      prev = seed.reduce((x, y) => x + y, 0) / w;
      return prev;
    }
    prev = prev + a * (v - prev);
    return prev;
  });
}

/** Bollinger bands: SMA of the last `w` available values ± k population standard deviations. */
export function bollinger(vals: Value[], w: number, k: number): { mid: Value[]; upper: Value[]; lower: Value[] } {
  const win: number[] = [];
  const mid: Value[] = []; const upper: Value[] = []; const lower: Value[] = [];
  for (const v of vals) {
    if (v === null) { mid.push(null); upper.push(null); lower.push(null); continue; }
    win.push(v);
    if (win.length > w) win.shift();
    if (win.length < w) { mid.push(null); upper.push(null); lower.push(null); continue; }
    const m = win.reduce((a, b) => a + b, 0) / w;
    const sd = Math.sqrt(win.reduce((a, b) => a + (b - m) ** 2, 0) / w);
    mid.push(m); upper.push(m + k * sd); lower.push(m - k * sd);
  }
  return { mid, upper, lower };
}

export function overlaysOf(v: unknown, path = 'overlays'): Overlay[] | undefined {
  if (v === undefined) return undefined;
  if (!Array.isArray(v)) fail(path, 'must be an array');
  if (v.length > 4) fail(path, 'must have at most 4 entries');
  return v.map((x, i) => {
    const p = `${path}[${i}]`;
    const o = dict(x, p, ['kind', 'window', 'k']);
    const kind = oneOf(o.kind, `${p}.kind`, ['sma', 'ema', 'bollinger'] as const);
    if (kind === undefined) fail(`${p}.kind`, 'is required');
    const w = num(o.window, `${p}.window`, 2, 250);
    if (!Number.isInteger(w)) fail(`${p}.window`, 'must be an integer');
    const r: Overlay = { kind, window: w };
    if (o.k !== undefined) {
      if (kind !== 'bollinger') fail(`${p}.k`, 'unknown property');
      r.k = num(o.k, `${p}.k`, 0.5, 4);
    } else if (kind === 'bollinger') r.k = 2;
    return r;
  });
}

/** Optional non-negative volume array, one entry per date (null = missing). */
export function volumeOf(v: unknown, n: number, path = 'volume'): Value[] | undefined {
  return v === undefined ? undefined : values(v, path, n, true);
}

export const FIN_L = {
  ko: { open: '시가', high: '고가', low: '저가', close: '종가', up: '상승', down: '하락', flat: '보합', prev: '전일 대비', volume: '거래량', period: '기간', days: '일',
    ma: (w: number) => `${w}일 이동평균`, sma: (w: number) => `${w}일 이동평균`, ema: (w: number) => `${w}일 지수이동평균`,
    bb: (w: number, k: number) => `볼린저 밴드(${w}일, ±${k}σ)`, bbU: '상단', bbL: '하단', maxVol: '최대' },
  en: { open: 'Open', high: 'High', low: 'Low', close: 'Close', up: 'up', down: 'down', flat: 'flat', prev: 'vs prev.', volume: 'Volume', period: 'Period', days: ' days',
    ma: (w: number) => `${w}-day MA`, sma: (w: number) => `${w}-day MA`, ema: (w: number) => `${w}-day EMA`,
    bb: (w: number, k: number) => `Bollinger (${w}, ±${k}σ)`, bbU: 'upper', bbL: 'lower', maxVol: 'max' },
};

/** One drawn indicator. `band` lines carry upper/lower too (Bollinger). */
export interface OvLine { name: string; idx: number; w: number; kind: OverlayKind | 'ma'; v: Value[]; upper?: Value[]; lower?: Value[] }

/**
 * Overlay palette as colour indices for colorAttrs (0-based: 1 = lc-c2 orange, 6 = lc-c7 ochre, ...). Skips lc-c1 (blue)
 * and lc-c4 (rose), the hues closest to down/up, so indicator lines never read as a rise or fall. The first two keep the
 * orange-then-gold look of 0.3 `ma`.
 */
export const OV_COLORS = [1, 6, 4, 2, 5, 7];

export function overlayLines(lang: 'ko' | 'en', closes: Value[], ma: number[] | undefined, overlays: Overlay[] | undefined): OvLine[] {
  const L = FIN_L[lang];
  const out: OvLine[] = [];
  for (const w of ma ?? []) out.push({ name: L.ma(w), idx: 0, w, kind: 'ma', v: sma(closes, w) });
  for (const o of overlays ?? []) {
    if (o.kind === 'sma') out.push({ name: L.sma(o.window), idx: 0, w: o.window, kind: 'sma', v: sma(closes, o.window) });
    else if (o.kind === 'ema') out.push({ name: L.ema(o.window), idx: 0, w: o.window, kind: 'ema', v: ema(closes, o.window) });
    else {
      const b = bollinger(closes, o.window, o.k ?? 2);
      out.push({ name: L.bb(o.window, o.k ?? 2), idx: 0, w: o.window, kind: 'bollinger', v: b.mid, upper: b.upper, lower: b.lower });
    }
  }
  out.forEach((l, k) => { l.idx = OV_COLORS[k % OV_COLORS.length]!; });
  return out;
}

/** Every finite indicator value (for the y domain). */
export const overlayValues = (lines: OvLine[]): number[] =>
  lines.flatMap((l) => [...l.v, ...(l.upper ?? []), ...(l.lower ?? [])]).filter((v): v is number => v !== null);

/** Short number: 1.2억 / 3.4만 (ko) or 1.2M / 3.4K (en). Used for the volume axis only; tables keep full values. */
export function compact(v: number, lang: 'ko' | 'en'): string {
  const a = Math.abs(v);
  const r = (x: number): string => String(Math.round(x * 10) / 10);
  if (lang === 'ko') {
    if (a >= 1e12) return `${r(v / 1e12)}조`;
    if (a >= 1e8) return `${r(v / 1e8)}억`;
    if (a >= 1e4) return `${r(v / 1e4)}만`;
    return group(v, 0);
  }
  if (a >= 1e12) return `${r(v / 1e12)}T`;
  if (a >= 1e9) return `${r(v / 1e9)}B`;
  if (a >= 1e6) return `${r(v / 1e6)}M`;
  if (a >= 1e3) return `${r(v / 1e3)}K`;
  return group(v, 0);
}

export interface Panes {
  svg: string;
  left: number; pw: number; top: number; ph: number;
  /** Volume pane (vH = 0 when absent). */
  vTop: number; vH: number;
  slot: number;
  cx: (i: number) => number;
  sy: (v: number) => number;
  vy: (v: number) => number;
  /** Bottom of the lowest pane (x labels sit below it). */
  bottom: number;
}

const XS = 11;

/**
 * Grid, y ticks and date labels for a price pane over `lo..hi`, plus a volume pane below it when `volume` has data.
 * Both panes share the x positions (`cx`); a null day keeps its slot so gaps stay visible.
 */
export function timePanes(ctx: Ctx, o: { dates: string[]; lo: number; hi: number; fmt: Fmt; yLabel?: string; volume?: Value[] }): Panes {
  const n = o.dates.length;
  const yd = niceTicks(o.lo, o.hi, ctx.H < 220 ? 4 : 5);
  const ylabs = yd.ticks.map(o.fmt);
  const vols = (o.volume ?? []).filter((v): v is number => v !== null);
  const hasVol = vols.length > 0;
  const vMax = hasVol ? Math.max(...vols) : 0;
  const vLab = hasVol ? compact(vMax, ctx.lang) : '';
  const axisT = o.yLabel ? FS + 8 : 0;
  const left = Math.max(...ylabs.map((l) => tw(l, FS)), hasVol ? Math.max(tw(vLab, XS), tw(FIN_L[ctx.lang].volume, XS)) : 0) + 10 + axisT;
  const top = 10;
  const bottomPad = XS + 14;
  const pw = Math.max(20, ctx.W - left - 10);
  const total = Math.max(40, ctx.H - top - bottomPad);
  const gap = hasVol ? 10 : 0;
  const vH = hasVol ? clamp(total * 0.22, 26, 90) : 0;
  const ph = Math.max(20, total - vH - gap);
  const vTop = top + ph + gap;
  const bottom = hasVol ? vTop + vH : top + ph;
  const sy = (v: number): number => top + ph - ((v - yd.min) / (yd.max - yd.min || 1)) * ph;
  const vy = (v: number): number => vTop + vH - (vMax > 0 ? (v / vMax) * vH : 0);
  const slot = pw / Math.max(1, n);
  const cx = (i: number): number => left + slot * (i + 0.5);
  let svg = '';
  yd.ticks.forEach((tk, k) => {
    const y = sy(tk);
    svg += `<line class="lc-grid" x1="${n2(left)}" x2="${n2(left + pw)}" y1="${n2(y)}" y2="${n2(y)}"/>`;
    svg += `<text class="lc-tick" x="${n2(left - 6)}" y="${n2(y + FS * 0.36)}" text-anchor="end">${esc(ylabs[k]!)}</text>`;
  });
  if (o.yLabel) svg += `<text class="lc-axis-title" transform="translate(${n2(FS)} ${n2(top + ph / 2)}) rotate(-90)" text-anchor="middle">${esc(truncate(o.yLabel, ph, FS))}</text>`;
  svg += `<line class="lc-axis" x1="${n2(left)}" x2="${n2(left + pw)}" y1="${n2(top + ph)}" y2="${n2(top + ph)}"/>`;
  if (hasVol) {
    const L = FIN_L[ctx.lang];
    svg += `<line class="lc-grid" x1="${n2(left)}" x2="${n2(left + pw)}" y1="${n2(vTop)}" y2="${n2(vTop)}"/>`;
    svg += `<line class="lc-axis" x1="${n2(left)}" x2="${n2(left + pw)}" y1="${n2(bottom)}" y2="${n2(bottom)}"/>`;
    svg += `<text class="lc-tick lc-fin-vt" x="${n2(left - 6)}" y="${n2(vTop + XS * 0.8)}" text-anchor="end">${esc(vLab)}</text>`;
    if (vH >= 2 * XS + 6) svg += `<text class="lc-tick lc-fin-vt" x="${n2(left - 6)}" y="${n2(vTop + XS * 1.8 + 4)}" text-anchor="end">${esc(L.volume)}</text>`;
  }
  const xl = o.dates.map((d) => truncate(d, 90, XS));
  const lw = Math.max(...xl.map((l) => tw(l, XS))) + 8;
  const step = Math.max(1, Math.ceil(lw / slot));
  xl.forEach((l, i) => {
    if (i % step) return;
    const w = tw(l, XS);
    svg += `<text class="lc-tick lc-cs-x" x="${n2(clamp(cx(i), w / 2 + 2, ctx.W - w / 2 - 2))}" y="${n2(bottom + XS + 6)}" text-anchor="middle">${esc(l)}</text>`;
  });
  return { svg, left, pw, top, ph, vTop, vH, slot, cx, sy, vy, bottom };
}

/** Volume bar for day i, classed up/down/flat by `dir` (from the close vs the previous close or open). */
export function volBar(p: Panes, i: number, v: number, dir: 1 | 0 | -1): string {
  const bw = clamp(p.slot * 0.62, 1, 16);
  const y = p.vy(v);
  const cls = dir > 0 ? 'lc-fin-up' : dir < 0 ? 'lc-fin-down' : 'lc-fin-flat';
  return `<rect class="lc-mark lc-fin-vol ${cls}" data-i="${i}" data-v="${v}" x="${n2(p.cx(i) - bw / 2)}" y="${n2(y)}" width="${n2(bw)}" height="${n2(Math.max(v > 0 ? 1 : 0, p.vTop + p.vH - y))}"/>`;
}

/** Path data through the non-null values of `v` (runs of one point are skipped). */
export function linePath(v: Value[], cx: (i: number) => number, sy: (v: number) => number): string {
  return runs(v).filter((r) => r.length > 1).map((r) => r.map((i, j) => `${j ? 'L' : 'M'}${n2(cx(i))} ${n2(sy(v[i] as number))}`).join('')).join('');
}

/** Indicator lines (and the shaded Bollinger band) drawn over a price pane. */
export function drawOverlays(lines: OvLine[], p: Panes, legacyMa = false): string {
  let s = '';
  for (const l of lines) {
    if (l.upper && l.lower) {
      const up = l.upper; const lo = l.lower;
      for (const r of runs(l.v).filter((x) => x.length > 1)) {
        const d = r.map((i, j) => `${j ? 'L' : 'M'}${n2(p.cx(i))} ${n2(p.sy(up[i] as number))}`).join('') +
          [...r].reverse().map((i) => `L${n2(p.cx(i))} ${n2(p.sy(lo[i] as number))}`).join('') + 'Z';
        s += `<path class="lc-fin-band ${colorAttrs(l.idx)} d="${d}"/>`;
      }
      for (const edge of [up, lo]) {
        const d = linePath(edge, p.cx, p.sy);
        if (d) s += `<path class="lc-fin-band-edge ${colorAttrs(l.idx)} d="${d}"/>`;
      }
    }
    const d = linePath(l.v, p.cx, p.sy);
    const cls = legacyMa && l.kind === 'ma' ? 'lc-cs-ma' : `lc-cs-ma lc-fin-ov lc-fin-${l.kind}`;
    if (d) s += `<path class="${cls} ${colorAttrs(l.idx)} data-w="${l.w}" d="${d}"/>`;
  }
  return s;
}

/** Up/down/flat direction of `cur` against `prev`. */
export const dirOf = (cur: number, prev: number | null): 1 | 0 | -1 => (prev === null || cur === prev ? 0 : cur > prev ? 1 : -1);

export const dirCls = (dir: 1 | 0 | -1): string => (dir > 0 ? 'lc-fin-up' : dir < 0 ? 'lc-fin-down' : 'lc-fin-flat');

/**
 * Vertical guide across the panes for day i, hidden until its focusable group is hovered or focused (fin.css), so the
 * value box always has a line pointing at the day it describes.
 */
export const crosshair = (p: Panes, i: number): string => `<line class="lc-fin-cross" x1="${n2(p.cx(i))}" x2="${n2(p.cx(i))}" y1="${n2(p.top)}" y2="${n2(p.bottom)}"/>`;

/** Vertical extent of a drawn mark (a candle's high..low, a line point) used to keep the last value tag off the marks. */
export interface MarkSpan { x: number; y0: number; y1: number }

/**
 * Last value tag: a dotted guide from the last mark to the right edge of the pane and the value in bold at the edge,
 * tinted by `cls` (lc-fin-up / lc-fin-down for a rise or fall, or a series colour class). The text sits above the
 * guide; when marks occupy that band it moves below the guide, and when both bands are busy it goes above the highest
 * mark under it.
 */
export function lastTag(p: Panes, ctx: Ctx, i: number, v: number, text: string, cls: string, marks: MarkSpan[] = []): string {
  const y = p.sy(v);
  const x1 = p.left + p.pw;
  const w = tw(text, FS) * 1.08;
  const tx = Math.max(x1 - 2, p.left + w);
  const busy = (top: number, bottom: number): boolean => marks.some((m) => m.x >= tx - w - 2 && m.x <= tx && m.y0 < bottom && m.y1 > top);
  const above = y - 5;
  const below = y + FS + 3;
  const under = marks.filter((m) => m.x >= tx - w - 2 && m.x <= tx);
  const pick = !busy(above - FS, above + 2) ? above : !busy(below - FS, below + 2) ? below : Math.min(...under.map((m) => m.y0)) - 4;
  const ty = clamp(pick, FS + 2, ctx.H);
  return `<g class="lc-fin-last ${cls}" aria-hidden="true"><line class="lc-fin-last-line" x1="${n2(p.cx(i))}" x2="${n2(x1)}" y1="${n2(y)}" y2="${n2(y)}"/>` +
    `<text class="lc-fin-last-val" x="${n2(tx)}" y="${n2(ty)}" text-anchor="end">${esc(text)}</text></g>`;
}
