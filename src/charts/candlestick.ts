// Candlestick: one OHLC candle per date (close >= open = up, else down; colours follow the up/down convention,
// default Korean: up red, down blue). Optional moving averages (`ma`), indicator overlays (SMA / EMA / Bollinger)
// computed from the closes, and a volume pane under the price pane on the same x axis. A null day is a gap: no
// candle, indicator windows skip it (they use the last N available closes) and their lines break there.
// The `ohlc` type (src/charts/ohlc.ts) draws the same data as OHLC bars through renderOhlc().
// Readability (0.8.0): every day carries a crosshair that shows with its value box, the last close is written in bold
// at the right edge (tinted by its rise or fall against the previous close, with the change), and hovering a day
// fades the other candles (candlestick.css / ohlc.css).
import type { BaseSpec, Value } from '../types.ts';
import { definePlugin } from '../plugin.ts';
import { BASE, base, dict, fail, labels, num, oneOf, optStr } from '../check.ts';
import { clamp, makeFmt, n2 } from '../format.ts';
import { type Ctx, MAX_FOCUS, empty, focusable, frame, legend, pct, table, wrapTable } from '../kit.ts';
import { CONVENTIONS, type Convention, FIN_L, type Overlay, convCls, crosshair, dirCls, dirOf, drawOverlays, lastTag, overlayLines, overlayValues, overlaysOf, sma, timePanes, volBar, volumeOf } from './fin.ts';

export interface Ohlc { open: number; high: number; low: number; close: number }

export interface CandlestickSpec extends BaseSpec {
  type: 'candlestick';
  /** One label per day, e.g. "11-03". */
  dates: string[];
  /** One entry per date; null = no data that day (gap). low <= min(open, close), high >= max(open, close). */
  ohlc: (Ohlc | null)[];
  /** Moving-average windows over closes, e.g. [5, 20]; integers 2..250, at most 4. */
  ma?: number[];
  /** Indicators computed from the closes: { kind: "sma" | "ema" | "bollinger", window, k? }, at most 4. */
  overlays?: Overlay[];
  /** Traded volume per date (>= 0 or null); drawn in a pane under the prices. */
  volume?: Value[];
  /** Up/down colours: "kr" (default, up red / down blue) or "global" (up green / down red). */
  convention?: Convention;
  yLabel?: string;
}

/** Simple moving average of the last `w` available closes (kept for 0.3 callers; same as fin.sma). */
export const movingAverage = sma;

type OhlcLike = Omit<CandlestickSpec, 'type'> & { type: string };

/** Shared validation for candlestick and ohlc specs. */
export function validateOhlcSpec(input: unknown, type: string): OhlcLike {
  const o = dict(input, 'spec', [...BASE, 'dates', 'ohlc', 'ma', 'overlays', 'volume', 'convention', 'yLabel']);
  const out = base(o) as unknown as OhlcLike;
  out.type = type;
  out.dates = labels(o.dates, 'dates');
  const n = out.dates.length;
  if (!Array.isArray(o.ohlc)) fail('ohlc', 'must be an array');
  if (o.ohlc.length !== n) fail('ohlc', `must have ${n} entries (one per label), got ${o.ohlc.length}`);
  out.ohlc = o.ohlc.map((d, i) => {
    if (d === null) return null;
    const p = `ohlc[${i}]`;
    const x = dict(d, p, ['open', 'high', 'low', 'close']);
    const open = num(x.open, `${p}.open`);
    const close = num(x.close, `${p}.close`);
    const low = num(x.low, `${p}.low`, -1e15, Math.min(open, close));
    const high = num(x.high, `${p}.high`, Math.max(open, close), 1e15);
    return { open, high, low, close };
  });
  if (o.ma !== undefined) {
    if (!Array.isArray(o.ma)) fail('ma', 'must be an array');
    if (o.ma.length > 4) fail('ma', 'must have at most 4 entries');
    out.ma = o.ma.map((w, i) => {
      const v = num(w, `ma[${i}]`, 2, 250);
      if (!Number.isInteger(v)) fail(`ma[${i}]`, 'must be an integer');
      return v;
    });
  }
  const ov = overlaysOf(o.overlays);
  if (ov !== undefined) out.overlays = ov;
  if ((out.ma?.length ?? 0) + (ov?.length ?? 0) > 6) fail('overlays', 'must have at most 6 entries together with ma');
  const vol = volumeOf(o.volume, n);
  if (vol !== undefined) out.volume = vol;
  const cv = oneOf(o.convention, 'convention', CONVENTIONS);
  if (cv !== undefined) out.convention = cv;
  const yl = optStr(o.yLabel, 'yLabel', 60);
  if (yl !== undefined) out.yLabel = yl;
  return out;
}

export const ohlcHeight = (spec: { volume?: Value[] }, W: number): number => (spec.volume ? (W < 420 ? 300 : 380) : W < 420 ? 260 : 320);

/** Render candlestick (`bars: false`) or OHLC bars (`bars: true`). */
export function renderOhlc(spec: OhlcLike, ctx: Ctx, bars: boolean): string {
  const t = ctx.t;
  const L2 = FIN_L[ctx.lang];
  const n = spec.dates.length;
  const days = spec.ohlc;
  const flat: Value[] = days.flatMap((d) => (d ? [d.open, d.high, d.low, d.close] : []));
  const fmt = makeFmt(spec.unit, flat);
  const fmtQ = (v: number): string => makeFmt(spec.unit, [...flat, Math.round(v * 100) / 100])(v);
  const vfmt = makeFmt(undefined, spec.volume ?? []);
  const closes: Value[] = days.map((d) => (d ? d.close : null));
  const lines = overlayLines(ctx.lang, closes, spec.ma, spec.overlays);
  const prevClose = (i: number): number | null => { for (let k = i - 1; k >= 0; k--) { const d = days[k]; if (d) return d.close; } return null; };
  const ovText = (i: number): string => lines.map((l) => { const v = l.v[i]; return v === null || v === undefined ? '' : ` · ${l.name} ${fmtQ(v)}`; }).join('');
  const dayText = (i: number, d: Ohlc): string => {
    const pc = prevClose(i);
    const vol = spec.volume?.[i];
    return `${spec.dates[i]}: ${L2.open} ${fmt(d.open)}, ${L2.high} ${fmt(d.high)}, ${L2.low} ${fmt(d.low)}, ${L2.close} ${fmt(d.close)}` +
      `${pc !== null && pc !== 0 ? ` (${L2.prev} ${d.close >= pc ? '+' : ''}${pct((d.close - pc) / pc)})` : ''} · ${d.close >= d.open ? L2.up : L2.down}` +
      `${vol !== null && vol !== undefined ? ` · ${L2.volume} ${vfmt(vol)}` : ''}${ovText(i)}`;
  };
  const live = days.filter((d): d is Ohlc => d !== null);
  let svg = '';
  if (!live.length) svg = empty(ctx);
  else {
    const ovs = overlayValues(lines);
    const p = timePanes(ctx, {
      dates: spec.dates, fmt, lo: Math.min(...live.map((d) => d.low), ...ovs), hi: Math.max(...live.map((d) => d.high), ...ovs),
      ...(spec.yLabel ? { yLabel: spec.yLabel } : {}), ...(spec.volume ? { volume: spec.volume } : {}),
    });
    svg += p.svg;
    const bw = clamp(p.slot * 0.62, 1, 16);
    const canFocus = live.length <= MAX_FOCUS;
    let marks = '';
    days.forEach((d, i) => {
      const vol = spec.volume?.[i];
      const vb = vol !== null && vol !== undefined && p.vH > 0 ? volBar(p, i, vol, d ? (d.close >= d.open ? 1 : -1) : 0) : '';
      if (!d) { svg += vb; return; }
      const x = p.cx(i);
      const up = d.close >= d.open;
      const ud = up ? 'lc-candle-up' : 'lc-candle-down';
      let shape: string;
      if (bars) {
        const tk = Math.max(2, bw / 2);
        shape = `<g class="lc-candle-g lc-ohlc-g ${ud}"><path class="lc-mark lc-ohlc ${ud}" data-i="${i}" data-v="${d.close}" data-o="${d.open}" data-h="${d.high}" data-l="${d.low}" ` +
          `d="M${n2(x)} ${n2(p.sy(d.high))}V${n2(p.sy(d.low))}M${n2(x - tk)} ${n2(p.sy(d.open))}H${n2(x)}M${n2(x)} ${n2(p.sy(d.close))}H${n2(x + tk)}"/></g>`;
      } else {
        const yT = p.sy(Math.max(d.open, d.close));
        const yB = p.sy(Math.min(d.open, d.close));
        shape = `<g class="lc-candle-g ${ud}">` +
          `<line class="lc-candle-wick" x1="${n2(x)}" x2="${n2(x)}" y1="${n2(p.sy(d.high))}" y2="${n2(p.sy(d.low))}"/>` +
          `<rect class="lc-mark lc-candle ${ud}" data-i="${i}" data-v="${d.close}" data-o="${d.open}" data-h="${d.high}" data-l="${d.low}" x="${n2(x - bw / 2)}" y="${n2(yT)}" width="${n2(bw)}" height="${n2(Math.max(1, yB - yT))}"/></g>`;
      }
      const inner = (canFocus ? crosshair(p, i) : '') + shape + vb;
      marks += canFocus ? focusable(ctx, 'lc-pt-candle', dayText(i, d), inner, x, p.sy(d.high)) : inner;
    });
    // Last close tag at the right edge: value and change against the previous close, tinted by direction.
    const li = days.reduce<number>((a, d, i) => (d ? i : a), -1);
    const last = days[li] as Ohlc;
    const pc = prevClose(li);
    const chg = pc !== null && pc !== 0 ? ` (${last.close >= pc ? '+' : ''}${pct((last.close - pc) / pc)})` : '';
    // indicator lines under the focusable marks so value boxes stay on top
    const spans = days.flatMap((d, i) => (d ? [{ x: p.cx(i), y0: p.sy(d.high), y1: p.sy(d.low) }] : []));
    svg += drawOverlays(lines, p, true) + marks + lastTag(p, ctx, li, last.close, fmt(last.close) + chg, dirCls(dirOf(last.close, pc)), spans);
  }

  const missing = n - live.length;
  let desc = '';
  if (live.length) {
    const fi = days.findIndex((d) => d !== null);
    const li = days.reduce<number>((a, d, i) => (d ? i : a), -1);
    const first = days[fi]!;
    const last = days[li]!;
    const hi = Math.max(...live.map((d) => d.high));
    const lo = Math.min(...live.map((d) => d.low));
    const ups = live.filter((d) => d.close >= d.open).length;
    desc = `${L2.period} ${spec.dates[fi]}–${spec.dates[li]}, ${live.length}${L2.days}. ${L2.close} ${fmt(first.close)} → ${fmt(last.close)}` +
      `${first.close !== 0 ? ` (${last.close >= first.close ? '+' : ''}${pct((last.close - first.close) / first.close)})` : ''}. ` +
      `${L2.high} ${fmt(hi)} (${spec.dates[days.findIndex((d) => d?.high === hi)]}), ${L2.low} ${fmt(lo)} (${spec.dates[days.findIndex((d) => d?.low === lo)]}). ` +
      `${L2.up} ${ups}, ${L2.down} ${live.length - ups}.` +
      lines.map((l) => { const v = l.v[li]; return v === null || v === undefined ? '' : ` ${l.name} ${fmtQ(v)}.`; }).join('');
  } else desc = `${t.na}.`;
  if (missing) desc += ` ${t.missing} ${missing}.`;
  const lg = lines.length && spec.legend !== false ? legend(lines.map((l) => ({ name: l.name, idx: l.idx }))) : '';
  const head = [t.date, L2.open, L2.high, L2.low, L2.close, ...(spec.volume ? [L2.volume] : []), ...lines.flatMap((l) => (l.upper ? [l.name, `${l.name} ${L2.bbU}`, `${l.name} ${L2.bbL}`] : [l.name]))];
  const q = (v: Value | undefined): string | null => (v === null || v === undefined ? null : fmtQ(v));
  const tbl = table(t, spec.title, head, days.map((d, i) => ({
    th: spec.dates[i]!,
    cells: [
      ...(d ? [fmt(d.open), fmt(d.high), fmt(d.low), fmt(d.close)] : [null, null, null, null]),
      ...(spec.volume ? [spec.volume[i] === null || spec.volume[i] === undefined ? null : vfmt(spec.volume[i] as number)] : []),
      ...lines.flatMap((l) => (l.upper ? [q(l.v[i]), q(l.upper[i]), q(l.lower?.[i])] : [q(l.v[i])])),
    ],
  })));
  const cls = convCls(spec.convention);
  return frame(ctx, spec, svg, desc, lg, wrapTable(spec.table ?? 'details', t, tbl), cls ? { cls } : {});
}

export const plugin = definePlugin<CandlestickSpec>({
  type: 'candlestick',
  names: { ko: '캔들 차트', en: 'Candlestick' },
  validate: (input) => validateOhlcSpec(input, 'candlestick') as CandlestickSpec,
  height: ohlcHeight,
  render: (spec, ctx) => renderOhlc(spec, ctx, false),
});
