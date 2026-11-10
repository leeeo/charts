// Candlestick: one OHLC candle per date (close >= open = up, else down; Korean convention: up red, down blue via CSS).
// Optional simple moving averages of the close. A null day is a gap: no candle, the MA window skips it
// (averages the last N available closes) and the MA line breaks there.
import type { BaseSpec, Value } from '../types.ts';
import { definePlugin } from '../plugin.ts';
import { BASE, base, dict, fail, labels, num, optStr } from '../check.ts';
import { clamp, esc, makeFmt, n2, niceTicks, truncate, tw } from '../format.ts';
import { type Ctx, FS, MAX_FOCUS, colorAttrs, empty, focusable, frame, legend, pct, runs, table, wrapTable } from '../kit.ts';

export interface Ohlc { open: number; high: number; low: number; close: number }

export interface CandlestickSpec extends BaseSpec {
  type: 'candlestick';
  /** One label per day, e.g. "11-03". */
  dates: string[];
  /** One entry per date; null = no data that day (gap). low <= min(open, close), high >= max(open, close). */
  ohlc: (Ohlc | null)[];
  /** Moving-average windows over closes, e.g. [5, 20]; integers 2..250, at most 4. */
  ma?: number[];
  yLabel?: string;
}

const L = {
  ko: { open: '시가', high: '고가', low: '저가', close: '종가', up: '상승', down: '하락', prev: '전일 대비', ma: (w: number) => `${w}일 이동평균`, period: '기간', days: '일' },
  en: { open: 'Open', high: 'High', low: 'Low', close: 'Close', up: 'up', down: 'down', prev: 'vs prev.', ma: (w: number) => `${w}-day MA`, period: 'Period', days: ' days' },
};
const MA_COLORS = [1, 4, 3, 5];
const XS = 11;

/** Simple moving average of the last `w` available closes; null on null days and before `w` closes exist. */
export function movingAverage(closes: Value[], w: number): Value[] {
  const win: number[] = [];
  return closes.map((c) => {
    if (c === null) return null;
    win.push(c);
    if (win.length > w) win.shift();
    return win.length === w ? win.reduce((a, b) => a + b, 0) / w : null;
  });
}

export const plugin = definePlugin<CandlestickSpec>({
  type: 'candlestick',
  names: { ko: '캔들 차트', en: 'Candlestick' },
  validate(input) {
    const o = dict(input, 'spec', [...BASE, 'dates', 'ohlc', 'ma', 'yLabel']);
    const out = base(o) as unknown as CandlestickSpec;
    out.type = 'candlestick';
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
    const yl = optStr(o.yLabel, 'yLabel', 60);
    if (yl !== undefined) out.yLabel = yl;
    return out;
  },
  height(_spec, W) {
    return W < 420 ? 260 : 320;
  },
  render(spec, ctx: Ctx) {
    const t = ctx.t;
    const L2 = L[ctx.lang];
    const n = spec.dates.length;
    const days = spec.ohlc;
    const flat: Value[] = days.flatMap((d) => (d ? [d.open, d.high, d.low, d.close] : []));
    const fmt = makeFmt(spec.unit, flat);
    const fmtQ = (v: number): string => makeFmt(spec.unit, [...flat, Math.round(v * 100) / 100])(v);
    const closes: Value[] = days.map((d) => (d ? d.close : null));
    const mas = (spec.ma ?? []).map((w) => ({ w, v: movingAverage(closes, w) }));
    const prevClose = (i: number): number | null => { for (let k = i - 1; k >= 0; k--) { const d = days[k]; if (d) return d.close; } return null; };
    const dayText = (i: number, d: Ohlc): string => {
      const pc = prevClose(i);
      return `${spec.dates[i]}: ${L2.open} ${fmt(d.open)}, ${L2.high} ${fmt(d.high)}, ${L2.low} ${fmt(d.low)}, ${L2.close} ${fmt(d.close)}` +
        `${pc !== null && pc !== 0 ? ` (${L2.prev} ${d.close >= pc ? '+' : ''}${pct((d.close - pc) / pc)})` : ''} · ${d.close >= d.open ? L2.up : L2.down}`;
    };
    const live = days.filter((d): d is Ohlc => d !== null);
    let svg = '';
    if (!live.length) svg = empty(ctx);
    else {
      const maVals = mas.flatMap((m) => m.v.filter((v): v is number => v !== null));
      const yd = niceTicks(Math.min(...live.map((d) => d.low), ...maVals), Math.max(...live.map((d) => d.high), ...maVals), ctx.H < 220 ? 4 : 5);
      const ylabs = yd.ticks.map(fmt);
      const axisT = spec.yLabel ? FS + 8 : 0;
      const left = Math.max(...ylabs.map((l) => tw(l, FS))) + 10 + axisT;
      const top = 10;
      const bottom = XS + 14;
      const pw = Math.max(20, ctx.W - left - 10);
      const ph = Math.max(20, ctx.H - top - bottom);
      const sy = (v: number): number => top + ph - ((v - yd.min) / (yd.max - yd.min || 1)) * ph;
      const slot = pw / n;
      const cx = (i: number): number => left + slot * (i + 0.5);
      yd.ticks.forEach((tk, k) => {
        const y = sy(tk);
        svg += `<line class="lc-grid" x1="${n2(left)}" x2="${n2(left + pw)}" y1="${n2(y)}" y2="${n2(y)}"/>`;
        svg += `<text class="lc-tick" x="${n2(left - 6)}" y="${n2(y + FS * 0.36)}" text-anchor="end">${esc(ylabs[k]!)}</text>`;
      });
      if (spec.yLabel) svg += `<text class="lc-axis-title" transform="translate(${n2(FS)} ${n2(top + ph / 2)}) rotate(-90)" text-anchor="middle">${esc(truncate(spec.yLabel, ph, FS))}</text>`;
      svg += `<line class="lc-axis" x1="${n2(left)}" x2="${n2(left + pw)}" y1="${n2(top + ph)}" y2="${n2(top + ph)}"/>`;
      const xl = spec.dates.map((d) => truncate(d, 90, XS));
      const lw = Math.max(...xl.map((l) => tw(l, XS))) + 8;
      const step = Math.max(1, Math.ceil(lw / slot));
      xl.forEach((l, i) => {
        if (i % step) return;
        const w = tw(l, XS);
        svg += `<text class="lc-tick lc-cs-x" x="${n2(clamp(cx(i), w / 2 + 2, ctx.W - w / 2 - 2))}" y="${n2(top + ph + XS + 6)}" text-anchor="middle">${esc(l)}</text>`;
      });
      const bw = clamp(slot * 0.62, 1, 16);
      const canFocus = live.length <= MAX_FOCUS;
      days.forEach((d, i) => {
        if (!d) return;
        const x = cx(i);
        const up = d.close >= d.open;
        const yT = sy(Math.max(d.open, d.close));
        const yB = sy(Math.min(d.open, d.close));
        const inner = `<g class="lc-candle-g ${up ? 'lc-candle-up' : 'lc-candle-down'}">` +
          `<line class="lc-candle-wick" x1="${n2(x)}" x2="${n2(x)}" y1="${n2(sy(d.high))}" y2="${n2(sy(d.low))}"/>` +
          `<rect class="lc-mark lc-candle ${up ? 'lc-candle-up' : 'lc-candle-down'}" data-i="${i}" data-v="${d.close}" data-o="${d.open}" data-h="${d.high}" data-l="${d.low}" x="${n2(x - bw / 2)}" y="${n2(yT)}" width="${n2(bw)}" height="${n2(Math.max(1, yB - yT))}"/></g>`;
        svg += canFocus ? focusable(ctx, 'lc-pt-candle', dayText(i, d), inner, x, sy(d.high)) : inner;
      });
      mas.forEach((m, k) => {
        const dd = runs(m.v).filter((r) => r.length > 1).map((r) => r.map((i, j) => `${j ? 'L' : 'M'}${n2(cx(i))} ${n2(sy(m.v[i] as number))}`).join('')).join('');
        if (dd) svg += `<path class="lc-cs-ma ${colorAttrs(MA_COLORS[k]!)} data-w="${m.w}" d="${dd}"/>`;
      });
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
        mas.map((m) => { const v = m.v[li]; return v === null || v === undefined ? '' : ` ${L2.ma(m.w)} ${fmtQ(v)}.`; }).join('');
    } else desc = `${t.na}.`;
    if (missing) desc += ` ${t.missing} ${missing}.`;
    const lg = mas.length && spec.legend !== false ? legend(mas.map((m, k) => ({ name: L2.ma(m.w), idx: MA_COLORS[k]! }))) : '';
    const tbl = table(t, spec.title, [t.date, L2.open, L2.high, L2.low, L2.close, ...mas.map((m) => L2.ma(m.w))], days.map((d, i) => ({
      th: spec.dates[i]!,
      cells: [...(d ? [fmt(d.open), fmt(d.high), fmt(d.low), fmt(d.close)] : [null, null, null, null]), ...mas.map((m) => { const v = m.v[i]; return v === null || v === undefined ? null : fmtQ(v); })],
    })));
    return frame(ctx, spec, svg, desc, lg, wrapTable(spec.table ?? 'details', t, tbl));
  },
});
