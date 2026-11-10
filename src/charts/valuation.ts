// Valuation band (PER / PBR band): for each date, band lines at multiple × per-share base (EPS for PER, BPS for PBR)
// computed from the given data, with the price line drawn over them. Bands are not drawn where the base is missing
// or not positive (a multiple of a loss is meaningless); those dates are counted in the summary. The implied
// multiple (price / base) is written in the value box and table.
import type { BaseSpec, Value } from '../types.ts';
import { definePlugin } from '../plugin.ts';
import { BASE, base as baseOf, dict, fail, labels, num, oneOf, optStr, values } from '../check.ts';
import { esc, makeFmt, n2, tw } from '../format.ts';
import { type Ctx, FS, MAX_FOCUS, colorAttrs, empty, focusable, frame, legend, runs, table, wrapTable } from '../kit.ts';
import { linePath, timePanes } from './fin.ts';

export interface ValuationSpec extends BaseSpec {
  type: 'valuation';
  dates: string[];
  /** Price per date (null = gap). */
  price: Value[];
  /** Per-share base per date: EPS (PER) or BPS (PBR); null or <= 0 = no band that date. */
  base: Value[];
  /** Band multiples, ascending, 2..6 entries, e.g. [6, 9, 12, 15]. */
  multiples: number[];
  /** "PER" (default) or "PBR". */
  metric?: 'PER' | 'PBR';
  yLabel?: string;
}

const L = {
  ko: { x: (m: number) => `${m}배`, price: '주가', eps: 'EPS', bps: 'BPS', implied: (m: string) => `현재 ${m}`, between: '사이', below: '아래', above: '위', noBand: (k: number, b: string) => `${b} 없음 또는 0 이하 ${k}일은 밴드 없음` },
  en: { x: (m: number) => `${m}x`, price: 'Price', eps: 'EPS', bps: 'BPS', implied: (m: string) => `Implied ${m}`, between: 'between', below: 'below', above: 'above', noBand: (k: number, b: string) => `no band on ${k} days without a positive ${b}` },
};

/** price / base, or null when either is missing or base <= 0. */
export const impliedMultiple = (p: Value, b: Value): number | null => (p === null || b === null || b <= 0 ? null : p / b);

function render(spec: ValuationSpec, ctx: Ctx): string {
  const t = ctx.t;
  const S = L[ctx.lang];
  const metric = spec.metric ?? 'PER';
  const bName = metric === 'PER' ? S.eps : S.bps;
  const n = spec.dates.length;
  const ms = spec.multiples;
  const bands: Value[][] = ms.map((m) => spec.base.map((b) => (b === null || b <= 0 ? null : m * b)));
  const fmt = makeFmt(spec.unit, spec.price);
  const bfmt = makeFmt(spec.unit, spec.base);
  const xfmt = (v: number): string => `${Math.round(v * 10) / 10}${ctx.lang === 'ko' ? '배' : 'x'}`;
  const where = (x: number): string => {
    if (x < ms[0]!) return `${S.x(ms[0]!)} ${S.below}`;
    if (x > ms[ms.length - 1]!) return `${S.x(ms[ms.length - 1]!)} ${S.above}`;
    const k = ms.findIndex((m, i) => x >= m && x <= (ms[i + 1] ?? m));
    return `${S.x(ms[k]!)}–${S.x(ms[Math.min(k + 1, ms.length - 1)]!)} ${S.between}`;
  };
  const dayText = (i: number): string => {
    const p = spec.price[i] ?? null; const b = spec.base[i] ?? null;
    const im = impliedMultiple(p, b);
    return `${spec.dates[i]}: ${S.price} ${p === null ? t.na : fmt(p)} · ${bName} ${b === null ? t.na : bfmt(b)}` +
      `${im !== null ? ` · ${metric} ${xfmt(im)} (${where(im)})` : ''}`;
  };
  const pv = spec.price.filter((v): v is number => v !== null);
  const bv = bands.flat().filter((v): v is number => v !== null);
  let svg = '';
  if (!pv.length && !bv.length) svg = empty(ctx);
  else {
    const right = Math.max(...ms.map((m) => tw(S.x(m), 11))) + 8;
    const inner = { ...ctx, W: ctx.W - right };
    const p = timePanes(inner, { dates: spec.dates, fmt, lo: Math.min(...pv, ...bv), hi: Math.max(...pv, ...bv), ...(spec.yLabel ? { yLabel: spec.yLabel } : {}) });
    svg += p.svg;
    // fills between adjacent band lines where both exist, alternating shades
    for (let k = 0; k + 1 < ms.length; k++) {
      const lo = bands[k]!; const hi = bands[k + 1]!;
      for (const r of runs(lo).filter((x) => x.length > 1)) {
        svg += `<path class="lc-vb-fill lc-vb-f${k % 2}" d="${r.map((i, j) => `${j ? 'L' : 'M'}${n2(p.cx(i))} ${n2(p.sy(hi[i] as number))}`).join('')}${[...r].reverse().map((i) => `L${n2(p.cx(i))} ${n2(p.sy(lo[i] as number))}`).join('')}Z"/>`;
      }
    }
    bands.forEach((b, k) => {
      const d = linePath(b, p.cx, p.sy);
      if (d) svg += `<path class="lc-vb-line" data-m="${ms[k]}" d="${d}"/>`;
      const li = b.reduce<number>((a, v, i) => (v === null ? a : i), -1);
      if (li >= 0) svg += `<text class="lc-tick lc-vb-lbl" x="${n2(p.cx(li) + 6)}" y="${n2(p.sy(b[li] as number) + 4)}">${esc(S.x(ms[k]!))}</text>`;
    });
    const d = linePath(spec.price, p.cx, p.sy);
    if (d) svg += `<path class="lc-price-line lc-vb-price ${colorAttrs(0)} d="${d}"/>`;
    const lastI = spec.price.reduce<number>((a, v, i) => (v === null ? a : i), -1);
    const canFocus = n <= MAX_FOCUS;
    let marks = '';
    spec.price.forEach((v, i) => {
      const solo = v !== null && (i === 0 || spec.price[i - 1] === null) && (i === n - 1 || spec.price[i + 1] === null);
      const dot = v === null ? '' : `<circle class="lc-mark lc-dot${i === lastI || solo ? ' lc-dot-vis' : ''} ${colorAttrs(0)} data-i="${i}" data-v="${v}" cx="${n2(p.cx(i))}" cy="${n2(p.sy(v))}" r="3"/>`;
      if (!canFocus) { if (i === lastI || solo) marks += dot; return; }
      if (v === null && (spec.base[i] ?? null) === null) return;
      const hit = `<rect class="lc-hit" x="${n2(p.cx(i) - p.slot / 2)}" y="${n2(p.top)}" width="${n2(p.slot)}" height="${n2(p.ph)}"/>`;
      marks += focusable(ctx, 'lc-pt-vb', dayText(i), hit + dot, p.cx(i), v === null ? p.top + p.ph / 2 : p.sy(v));
    });
    svg += marks;
  }
  const lastBoth = spec.dates.reduce<number>((a, _, i) => (impliedMultiple(spec.price[i] ?? null, spec.base[i] ?? null) !== null ? i : a), -1);
  let desc = `${metric} ${ms.map(S.x).join(', ')}. ${n}${t.items} (${spec.dates[0]}–${spec.dates[n - 1]}).`;
  if (lastBoth >= 0) {
    const im = impliedMultiple(spec.price[lastBoth] ?? null, spec.base[lastBoth] ?? null) as number;
    desc += ` ${spec.dates[lastBoth]}: ${S.price} ${fmt(spec.price[lastBoth] as number)}, ${S.implied(metric)} ${xfmt(im)} (${where(im)}).`;
  }
  const noBand = spec.base.filter((b) => b === null || b <= 0).length;
  if (noBand) desc += ` ${S.noBand(noBand, bName)}.`;
  const miss = spec.price.filter((v) => v === null).length;
  if (miss) desc += ` ${t.missing} ${miss}.`;
  const lg = spec.legend === false ? '' : legend([{ name: S.price, idx: 0 }]) .replace('</ul>', `<li><span class="lc-sw lc-vb-sw"></span><span class="lc-ln">${esc(`${metric} ${ms.map(S.x).join(' · ')}`)}</span></li></ul>`);
  const tbl = table(t, spec.title, [t.date, S.price, bName, metric, ...ms.map(S.x)], spec.dates.map((dt, i) => {
    const pr = spec.price[i] ?? null; const b = spec.base[i] ?? null;
    const im = impliedMultiple(pr, b);
    return { th: dt, cells: [pr === null ? null : fmt(pr), b === null ? null : bfmt(b), im === null ? null : xfmt(im), ...bands.map((bb) => { const v = bb[i]; return v === null || v === undefined ? null : fmt(Math.round(v)); })] };
  }));
  return frame(ctx, spec, svg, desc, lg, wrapTable(spec.table ?? 'details', t, tbl));
}

export const plugin = definePlugin<ValuationSpec>({
  type: 'valuation',
  names: { ko: '밸류에이션 밴드', en: 'Valuation band' },
  validate(input) {
    const o = dict(input, 'spec', [...BASE, 'dates', 'price', 'base', 'multiples', 'metric', 'yLabel']);
    const out = baseOf(o) as unknown as ValuationSpec;
    out.type = 'valuation';
    out.dates = labels(o.dates, 'dates');
    const n = out.dates.length;
    out.price = values(o.price, 'price', n, true);
    out.base = values(o.base, 'base', n, false);
    if (!Array.isArray(o.multiples)) fail('multiples', 'must be an array');
    if (o.multiples.length < 2) fail('multiples', 'must have at least 2 entries');
    if (o.multiples.length > 6) fail('multiples', 'must have at most 6 entries');
    out.multiples = o.multiples.map((m, i) => {
      const v = num(m, `multiples[${i}]`, 0.01, 1000);
      if (i > 0 && v <= (o.multiples as number[])[i - 1]!) fail(`multiples[${i}]`, 'must be greater than the previous entry');
      return v;
    });
    const m = oneOf(o.metric, 'metric', ['PER', 'PBR'] as const);
    if (m !== undefined) out.metric = m;
    const yl = optStr(o.yLabel, 'yLabel', 60);
    if (yl !== undefined) out.yLabel = yl;
    return out;
  },
  height: (_s, W) => (W < 420 ? 260 : 320),
  render,
});
