// Waterfall chart: a start value, then signed changes that float from the running total, with optional subtotal /
// total bars (computed from the running total) and dashed connectors. A null change is missing: it draws no bar,
// leaves the running total unchanged, is listed under the chart and counted in the description.
import type { BaseSpec, Value } from '../types.ts';
import { definePlugin } from '../plugin.ts';
import { BASE, base, color, dict, fail, idList, num, oneOf, optStr, put, str, value } from '../check.ts';
import { type Fmt, clamp, esc, makeFmt, n2, tw } from '../format.ts';
import { type Ctx, FS, MAX_FOCUS, colorAttrs, empty, focusable, frame, legend, table, wrapTable } from '../kit.ts';
import { catAxes, missingNote, valueDomain } from './lollipop.ts';

export interface WaterfallStep {
  id: string;
  label: string;
  /** "delta" (default): a signed change; "subtotal" / "total": a bar of the running total (no value). */
  kind?: 'delta' | 'subtotal' | 'total';
  /** Signed change for delta steps; null = missing. */
  value?: Value;
  quality?: string;
}

export interface WaterfallSpec extends BaseSpec {
  type: 'waterfall';
  /** Label of the first (start) bar, e.g. "10월 매출". */
  startLabel: string;
  /** Start value; null = missing (no running totals can be drawn: empty state, table only). */
  start: Value;
  steps: WaterfallStep[];
  upColor?: string;
  downColor?: string;
  totalColor?: string;
  xLabel?: string;
}

export const MAX_WATERFALL_STEPS = 200;
const UP = 0; const DOWN = 6; const TOT = 2; // lc-c1, lc-c7, lc-c3

interface Bar { pos: number; label: string; kind: 'start' | 'up' | 'down' | 'subtotal' | 'total' | 'na'; a: number; b: number; v: Value; level: number; missBefore: number; quality?: string }

const signed = (d: number, fmt: Fmt): string => (d > 0 ? `+${fmt(d)}` : fmt(d));

/** Running-total geometry: one entry per bar (start first), with the bar span [a, b] in value units. */
export function waterfallBars(spec: WaterfallSpec): Bar[] {
  let level = spec.start ?? 0;
  let miss = 0;
  const out: Bar[] = [{ pos: 0, label: spec.startLabel, kind: 'start', a: 0, b: level, v: spec.start, level, missBefore: 0 }];
  spec.steps.forEach((s, k) => {
    const q = s.quality ? { quality: s.quality } : {};
    const kind = s.kind ?? 'delta';
    if (kind !== 'delta') {
      out.push({ pos: k + 1, label: s.label, kind, a: 0, b: level, v: level, level, missBefore: miss, ...q });
      return;
    }
    const v = s.value ?? null;
    if (v === null) { miss++; out.push({ pos: k + 1, label: s.label, kind: 'na', a: level, b: level, v: null, level, missBefore: miss, ...q }); return; }
    const a = level; level += v;
    out.push({ pos: k + 1, label: s.label, kind: v >= 0 ? 'up' : 'down', a, b: level, v, level, missBefore: miss, ...q });
  });
  return out;
}

function render(spec: WaterfallSpec, ctx: Ctx): string {
  const t = ctx.t;
  const L = ctx.lang === 'ko'
    ? { up: '증가', down: '감소', total: '합계', end: '최종', exMiss: '결측 제외', steps: '단계' }
    : { up: 'Increase', down: 'Decrease', total: 'Total', end: 'End', exMiss: 'excluding missing', steps: ' steps' };
  const bars = waterfallBars(spec);
  const fmt = makeFmt(spec.unit, [spec.start, ...spec.steps.map((s) => s.value ?? null)]);
  const missing = bars.filter((b) => b.kind === 'na');
  const isTotal = (b: Bar): boolean => b.kind === 'start' || b.kind === 'subtotal' || b.kind === 'total';
  const valText = (b: Bar): string => (b.v === null ? t.na : isTotal(b) ? fmt(b.v) : signed(b.v, fmt));
  const aria = (b: Bar): string => {
    const tail = b.kind === 'up' || b.kind === 'down' ? ` (${t.total} ${fmt(b.level)})` : b.kind !== 'start' && b.missBefore ? ` (${L.exMiss} ${b.missBefore})` : '';
    return `${b.label}: ${valText(b)}${tail}${b.quality ? ` · ${b.quality}` : ''}`;
  };
  const known = spec.start !== null;
  let inner = '';
  if (!known) inner = empty(ctx);
  else {
    const ends = bars.flatMap((b) => [b.a, b.b]);
    const dom = valueDomain(Math.min(...ends), Math.max(...ends), ctx.H - 60, true);
    const ax = catAxes(ctx, {
      labels: bars.map((b) => b.label), dom, fmt, horizontal: false, top: FS + 2, bottom: missing.length ? FS + 8 : 0,
      ...(spec.xLabel ? { xLabel: spec.xLabel } : {}),
    });
    const bw = Math.max(1, ax.band * 0.7);
    const focus = bars.length <= MAX_FOCUS;
    let links = '';
    let marks = '';
    let prev: { x: number; y: number } | null = null;
    for (const b of bars) {
      if (b.kind === 'na') continue;
      const x = ax.cc(b.pos) - bw / 2;
      const y0 = ax.vv(Math.max(b.a, b.b)); const y1 = ax.vv(Math.min(b.a, b.b));
      const h = Math.max(1, y1 - y0);
      const ci = isTotal(b) ? TOT : b.kind === 'up' ? UP : DOWN;
      const col = isTotal(b) ? spec.totalColor : b.kind === 'up' ? spec.upColor : spec.downColor;
      const cls = `lc-wf-${b.kind === 'start' ? 'total' : b.kind}`;
      if (prev) links += `<line class="lc-wf-link" x1="${n2(prev.x)}" y1="${n2(prev.y)}" x2="${n2(x)}" y2="${n2(prev.y)}"/>`;
      prev = { x: x + bw, y: ax.vv(b.level) };
      let g = `<rect class="lc-mark lc-wf ${cls} ${colorAttrs(ci, col)} data-i="${b.pos}" data-v="${b.v}" x="${n2(x)}" y="${n2(y0)}" width="${n2(bw)}" height="${n2(h)}"/>`;
      const label = valText(b); const w = tw(label, FS);
      if (w <= ax.band - 2) g += `<text class="lc-wf-val" x="${n2(clamp(ax.cc(b.pos) - w / 2, 2, ctx.W - w - 2))}" y="${n2(Math.max(FS, y0 - 4))}">${esc(label)}</text>`;
      marks += focus ? focusable(ctx, 'lc-pt-wf', aria(b), g, ax.cc(b.pos), y0) : g;
    }
    inner = ax.svg + links + marks + missingNote(ctx, missing.map((b) => b.label));
  }
  const deltas = bars.filter((b): b is Bar & { v: number } => (b.kind === 'up' || b.kind === 'down') && b.v !== null);
  const ups = deltas.filter((b) => b.kind === 'up'); const downs = deltas.filter((b) => b.kind === 'down');
  const sum = (bs: { v: number }[]): number => bs.reduce((a, b) => a + b.v, 0);
  const last = bars[bars.length - 1] as Bar;
  let desc = `${spec.steps.length}${ctx.lang === 'ko' ? '개 ' : ''}${L.steps}. ` +
    (spec.start === null ? `${spec.startLabel} ${t.na}. ` : `${spec.startLabel} ${fmt(spec.start)} → ${L.end} ${fmt(last.level)} (${t.change} ${signed(last.level - spec.start, fmt)}). `) +
    `${L.up} ${ups.length} (${signed(sum(ups), fmt)}), ${L.down} ${downs.length} (${fmt(sum(downs))}).`;
  if (deltas.length) {
    const big = deltas.reduce((a, b) => (Math.abs(b.v) > Math.abs(a.v) ? b : a));
    desc += ` ${t.max}: ${big.label} ${signed(big.v, fmt)}.`;
  }
  const missN = missing.length + (known ? 0 : 1);
  if (missN) desc += ` ${t.missing} ${missN}: ${[...(known ? [] : [spec.startLabel]), ...missing.map((b) => b.label)].join(', ')}.`;
  const q = bars.filter((b) => b.quality);
  if (q.length) desc += ` ${t.quality}: ${q.map((b) => `${b.label} ${b.quality}`).join(', ')}.`;
  const lg = spec.legend === false ? '' : legend([
    { name: L.up, idx: UP, ...(spec.upColor ? { color: spec.upColor } : {}) },
    { name: L.down, idx: DOWN, ...(spec.downColor ? { color: spec.downColor } : {}) },
    { name: L.total, idx: TOT, ...(spec.totalColor ? { color: spec.totalColor } : {}) },
  ]);
  const tbl = table(t, spec.title, [t.cat, t.change, t.total], bars.map((b) => ({
    th: `${b.label}${b.quality ? ` (${b.quality})` : ''}`,
    cells: [b.v === null ? null : isTotal(b) ? '–' : signed(b.v, fmt), b.v === null || !known ? null : fmt(b.level)],
  })));
  return frame(ctx, spec, inner, desc, lg, wrapTable(spec.table ?? 'details', t, tbl));
}

export const plugin = definePlugin<WaterfallSpec>({
  type: 'waterfall',
  names: { ko: '폭포 차트', en: 'Waterfall chart' },
  validate(input) {
    const o = dict(input, 'spec', [...BASE, 'startLabel', 'start', 'steps', 'upColor', 'downColor', 'totalColor', 'xLabel']);
    const out = base(o);
    out.type = 'waterfall';
    out.startLabel = str(o.startLabel, 'startLabel', 60);
    if (o.start === undefined) num(o.start, 'start');
    out.start = value(o.start, 'start');
    out.steps = idList(o.steps, 'steps', ['label', 'kind', 'value', 'quality'], MAX_WATERFALL_STEPS, (it, p, id) => {
      const r: Record<string, unknown> = { id, label: str(it.label, `${p}.label`, 60) };
      const kind = oneOf(it.kind, `${p}.kind`, ['delta', 'subtotal', 'total'] as const);
      put(r, 'kind', kind);
      if (kind === 'subtotal' || kind === 'total') {
        // subtotal / total bars are computed from the running total; a value would be silently ignored
        if (it.value !== undefined) fail(`${p}.value`, 'unknown property');
      } else r.value = value(it.value, `${p}.value`);
      put(r, 'quality', optStr(it.quality, `${p}.quality`, 60));
      return r;
    });
    put(out, 'upColor', color(o.upColor, 'upColor'));
    put(out, 'downColor', color(o.downColor, 'downColor'));
    put(out, 'totalColor', color(o.totalColor, 'totalColor'));
    put(out, 'xLabel', optStr(o.xLabel, 'xLabel', 80));
    return out as unknown as WaterfallSpec;
  },
  height: () => 320,
  render,
});
