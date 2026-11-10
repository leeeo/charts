// Slope chart: one line per item between a start and an end value, labelled on both sides.
import type { BaseSpec, Value } from '../types.ts';
import { definePlugin } from '../plugin.ts';
import { BASE, base, color, dict, idList, optStr, put, str, value } from '../check.ts';
import { type Fmt, clamp, esc, makeFmt, n2, truncate, tw } from '../format.ts';
import { type Ctx, FS, MAX_FOCUS, colorAttrs, empty, focusable, frame, legend, pct, table, wrapTable } from '../kit.ts';

export interface SlopeItem {
  id: string;
  label: string;
  /** Value at the left (start) column; null = missing. */
  start: Value;
  /** Value at the right (end) column; null = missing. */
  end: Value;
  color?: string;
  quality?: string;
}

export interface SlopeSpec extends BaseSpec {
  type: 'slope';
  /** Left column heading, e.g. "2025년 1분기". */
  startLabel: string;
  /** Right column heading, e.g. "2025년 2분기". */
  endLabel: string;
  items: SlopeItem[];
}

export const MAX_SLOPE_ITEMS = 60;

/** Spread label baselines so neighbours are at least `gap` apart while staying inside [lo, hi] when possible. */
export function spread(ys: number[], gap: number, lo: number, hi: number): number[] {
  const idx = ys.map((_, i) => i).sort((a, b) => (ys[a] ?? 0) - (ys[b] ?? 0) || a - b);
  const out = ys.slice();
  let prev = -Infinity;
  for (const i of idx) { const v = Math.max(out[i] ?? 0, prev + gap); out[i] = v; prev = v; }
  let next = hi + gap;
  for (const i of [...idx].reverse()) { const v = Math.min(out[i] ?? 0, next - gap); out[i] = v; next = v; }
  for (const i of idx) out[i] = Math.max(out[i] ?? 0, lo);
  return out;
}

const signed = (d: number, fmt: Fmt): string => (d > 0 ? `+${fmt(d)}` : fmt(d));

function render(spec: SlopeSpec, ctx: Ctx): string {
  const t = ctx.t;
  const items = spec.items;
  const fmt = makeFmt(spec.unit, items.flatMap((it) => [it.start, it.end]));
  const vals = items.flatMap((it) => [it.start, it.end]).filter((v): v is number => v !== null);
  const missing = items.filter((it) => it.start === null || it.end === null);
  let inner = '';
  if (!vals.length) inner = empty(ctx);
  else {
    let lo = Math.min(...vals); let hi = Math.max(...vals);
    if (lo === hi) { lo -= 1; hi += 1; }
    const head = FS + 10;
    const note = missing.length ? FS + 10 : 0;
    const py = head + 12; const ph = Math.max(10, ctx.H - py - 10 - note);
    const sy = (v: number): number => py + ph - ((v - lo) / (hi - lo)) * ph;
    const sideText = (it: SlopeItem, v: number): number => tw(`${it.label} ${fmt(v)}`, FS);
    const need = Math.max(0, ...items.flatMap((it) => [it.start === null ? 0 : sideText(it, it.start), it.end === null ? 0 : sideText(it, it.end)]));
    const gapMin = Math.max(48, ctx.W * 0.22);
    const margin = clamp(need + 16, 50, (ctx.W - gapMin) / 2);
    const x0 = margin; const x1 = ctx.W - margin;
    const room = margin - 14;
    // label text = "label value" (left) / "value label" (right); the label part is truncated, the value never is
    const text = (it: SlopeItem, v: number, leftSide: boolean): string => {
      const vs = fmt(v);
      const avail = room - tw(vs, FS) - tw(' ', FS);
      if (avail < 14) return vs;
      const l = truncate(it.label, avail, FS);
      return leftSide ? `${l} ${vs}` : `${vs} ${l}`;
    };
    let s = '';
    for (const [x, l] of [[x0, spec.startLabel], [x1, spec.endLabel]] as const) {
      const tl = truncate(l, Math.max(24, Math.min(ctx.W / 2 - 8, margin * 2 - 8)), FS);
      const w = tw(tl, FS);
      s += `<text class="lc-axis-title lc-slope-head" x="${n2(clamp(x - w / 2, 2, ctx.W - w - 2))}" y="${n2(FS + 4)}">${esc(tl)}</text>`;
      s += `<line class="lc-axis" x1="${n2(x)}" y1="${n2(py - 6)}" x2="${n2(x)}" y2="${n2(py + ph + 6)}"/>`;
    }
    const sides = [0, 1].map((side) => {
      const list = items.map((it, i) => ({ i, v: side ? it.end : it.start })).filter((e): e is { i: number; v: number } => e.v !== null);
      const ys = spread(list.map((e) => sy(e.v)), FS + 2, py, py + ph);
      return { list, ys };
    });
    let labelsSvg = '';
    sides.forEach(({ list, ys }, side) => list.forEach((e, k) => {
      const it = items[e.i] as SlopeItem;
      const y = (ys[k] ?? sy(e.v)) + FS * 0.35;
      labelsSvg += side === 0
        ? `<text class="lc-slope-label" x="${n2(x0 - 8)}" y="${n2(y)}" text-anchor="end">${esc(text(it, e.v, true))}</text>`
        : `<text class="lc-slope-label" x="${n2(x1 + 8)}" y="${n2(y)}">${esc(text(it, e.v, false))}</text>`;
    }));
    const focus = items.length <= MAX_FOCUS;
    let marks = '';
    items.forEach((it, i) => {
      const c = colorAttrs(i, it.color);
      let g = '';
      if (it.start !== null && it.end !== null) {
        g += `<line class="lc-slope-line ${it.end > it.start ? 'lc-slope-up' : it.end < it.start ? 'lc-slope-down' : 'lc-slope-flat'} ${c} data-i="${i}" x1="${n2(x0)}" y1="${n2(sy(it.start))}" x2="${n2(x1)}" y2="${n2(sy(it.end))}"/>`;
      }
      for (const [side, v, x] of [[0, it.start, x0], [1, it.end, x1]] as const) {
        if (v === null) continue;
        g += `<circle class="lc-mark lc-slope-dot ${c} data-i="${i}" data-end="${side}" data-v="${v}" cx="${n2(x)}" cy="${n2(sy(v))}" r="4"/>`;
      }
      if (!g) return;
      const ax = it.end !== null ? x1 : x0;
      const ay = sy((it.end ?? it.start) as number);
      marks += focus ? focusable(ctx, 'lc-pt-slope', ariaText(spec, it, fmt, t.na, t.change), g, ax, ay) : g;
    });
    s += labelsSvg + marks;
    if (missing.length) {
      const msg = truncate(`${t.missing}: ${missing.map((it) => it.label).join(', ')}`, ctx.W - 8, FS);
      s += `<text class="lc-tick lc-slope-missing" x="4" y="${n2(ctx.H - 6)}">${esc(msg)}</text>`;
    }
    inner = s;
  }
  const desc = `${items.length}${t.items} (${spec.startLabel} → ${spec.endLabel}). ` + items.map((it) => `${ariaText(spec, it, fmt, t.na, t.change)}.`).join(' ') + (missing.length ? ` ${t.missing} ${missing.length}.` : '');
  const lg = spec.legend === true ? legend(items.map((it, i) => ({ name: it.label, idx: i, ...(it.color ? { color: it.color } : {}), ...(it.quality ? { quality: it.quality } : {}) }))) : '';
  const tbl = table(t, spec.title, [t.cat, spec.startLabel, spec.endLabel, t.change], items.map((it) => ({
    th: `${it.label}${it.quality ? ` (${it.quality})` : ''}`,
    cells: [
      it.start === null ? null : fmt(it.start),
      it.end === null ? null : fmt(it.end),
      it.start === null || it.end === null ? null : changeText(it.start, it.end, fmt),
    ],
  })));
  return frame(ctx, spec, inner, desc, lg, wrapTable(spec.table ?? 'details', t, tbl));
}

function changeText(a: number, b: number, fmt: Fmt): string {
  const d = b - a;
  return `${signed(d, fmt)}${a !== 0 ? ` (${d > 0 ? '+' : ''}${pct(d / Math.abs(a))})` : ''}`;
}

/** "label: start 1,200명 → end 1,500명 (변화 +300명 (+25%)) · quality" */
function ariaText(spec: SlopeSpec, it: SlopeItem, fmt: Fmt, na: string, change: string): string {
  const v = (x: Value): string => (x === null ? na : fmt(x));
  const ch = it.start !== null && it.end !== null ? ` (${change} ${changeText(it.start, it.end, fmt)})` : '';
  return `${it.label}: ${spec.startLabel} ${v(it.start)} → ${spec.endLabel} ${v(it.end)}${ch}${it.quality ? ` · ${it.quality}` : ''}`;
}

export const plugin = definePlugin<SlopeSpec>({
  type: 'slope',
  names: { ko: '기울기 차트', en: 'Slope chart' },
  validate(input) {
    const o = dict(input, 'spec', [...BASE, 'startLabel', 'endLabel', 'items']);
    const out = base(o);
    out.type = 'slope';
    out.startLabel = str(o.startLabel, 'startLabel', 40);
    out.endLabel = str(o.endLabel, 'endLabel', 40);
    out.items = idList(o.items, 'items', ['label', 'start', 'end', 'color', 'quality'], MAX_SLOPE_ITEMS, (it, p, id) => {
      const r: Record<string, unknown> = { id, label: str(it.label, `${p}.label`, 60), start: value(it.start, `${p}.start`), end: value(it.end, `${p}.end`) };
      put(r, 'color', color(it.color, `${p}.color`));
      put(r, 'quality', optStr(it.quality, `${p}.quality`, 60));
      return r;
    });
    return out as unknown as SlopeSpec;
  },
  height: (spec) => clamp(spec.items.length * (FS + 4) + 80, 220, 1100),
  render,
});
