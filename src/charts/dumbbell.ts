// Dumbbell chart: two values per category (e.g. before/after, two segments) as dots joined by a line.
// Horizontal by default (categories on the y axis). A null end draws only the present dot and no line.
import type { BaseSpec, Value } from '../types.ts';
import { definePlugin } from '../plugin.ts';
import { BASE, base, color, dict, idList, oneOf, optBool, optStr, put, str, value } from '../check.ts';
import { type Fmt, clamp, esc, makeFmt, n2, tw } from '../format.ts';
import { type Ctx, FS, MAX_FOCUS, colorAttrs, empty, focusable, frame, legend, pct, table, wrapTable } from '../kit.ts';
import { catAxes, missingNote, sortOrder, valueDomain } from './lollipop.ts';

export interface DumbbellItem { id: string; label: string; start: Value; end: Value; quality?: string }

export interface DumbbellSpec extends BaseSpec {
  type: 'dumbbell';
  /** Name of the first value, e.g. "2025년" or "iOS". */
  startLabel: string;
  /** Name of the second value, e.g. "2026년" or "Android". */
  endLabel: string;
  items: DumbbellItem[];
  /** "none" (default), "start" / "end" (by that value, descending) or "change" (end - start, descending). */
  sort?: 'none' | 'start' | 'end' | 'change';
  /** Categories on the y axis (default true); false puts categories on the x axis. */
  horizontal?: boolean;
  /** Include 0 in the value axis (default false: the axis fits the data). */
  zero?: boolean;
  startColor?: string;
  endColor?: string;
  xLabel?: string;
}

export const MAX_DUMBBELL_ITEMS = 200;
const START_C = 7; // lc-c8 (neutral) for the first value
const END_C = 0; // lc-c1 (accent) for the second value

const signed = (d: number, fmt: Fmt): string => (d > 0 ? `+${fmt(d)}` : fmt(d));

function changeText(a: number, b: number, fmt: Fmt): string {
  const d = b - a;
  return `${signed(d, fmt)}${a !== 0 ? ` (${d > 0 ? '+' : ''}${pct(d / Math.abs(a))})` : ''}`;
}

function render(spec: DumbbellSpec, ctx: Ctx): string {
  const t = ctx.t;
  const items = spec.items;
  const horizontal = spec.horizontal !== false;
  const fmt = makeFmt(spec.unit, items.flatMap((it) => [it.start, it.end]));
  const vals = items.flatMap((it) => [it.start, it.end]).filter((v): v is number => v !== null);
  const missing = items.filter((it) => it.start === null || it.end === null);
  const key = (it: DumbbellItem): Value => {
    if (spec.sort === 'start') return it.start;
    if (spec.sort === 'end') return it.end;
    return it.start === null || it.end === null ? null : it.end - it.start;
  };
  const order = sortOrder(items.map(key), spec.sort && spec.sort !== 'none' ? 'desc' : 'none');
  const v = (x: Value): string => (x === null ? t.na : fmt(x));
  const aria = (it: DumbbellItem): string => {
    const ch = it.start !== null && it.end !== null ? ` (${t.change} ${changeText(it.start, it.end, fmt)})` : '';
    return `${it.label}: ${spec.startLabel} ${v(it.start)} → ${spec.endLabel} ${v(it.end)}${ch}${it.quality ? ` · ${it.quality}` : ''}`;
  };
  let inner = '';
  if (!vals.length) inner = empty(ctx);
  else {
    const lo = Math.min(...vals); const hi = Math.max(...vals);
    const dom = valueDomain(lo, hi, horizontal ? ctx.W - 120 : ctx.H - 60, spec.zero === true);
    const valW = Math.max(...vals.map((x) => tw(fmt(x), FS)));
    const ax = catAxes(ctx, {
      labels: order.map((i) => items[i]?.label ?? ''), dom, fmt, horizontal,
      top: horizontal ? 0 : FS + 2, right: horizontal ? valW + 8 : 0, bottom: missing.length ? FS + 8 : 0,
      ...(spec.xLabel ? { xLabel: spec.xLabel } : {}),
    });
    const r = clamp(ax.band * 0.28, 2.5, 5.5);
    const showVals = horizontal ? ax.band >= FS + 1 : true;
    const focus = items.length <= MAX_FOCUS;
    let marks = '';
    order.forEach((i, pos) => {
      const it = items[i];
      if (!it) return;
      const q = ax.cc(pos);
      const xy = (x: number): [number, number] => (horizontal ? [ax.vv(x), q] : [q, ax.vv(x)]);
      let g = '';
      if (it.start !== null && it.end !== null) {
        const [x1, y1] = xy(it.start); const [x2, y2] = xy(it.end);
        const dir = it.end > it.start ? 'lc-db-up' : it.end < it.start ? 'lc-db-down' : 'lc-db-flat';
        g += `<line class="lc-dumbbell-line ${dir}" data-i="${i}" x1="${n2(x1)}" y1="${n2(y1)}" x2="${n2(x2)}" y2="${n2(y2)}"/>`;
      }
      type End = { side: 0 | 1; x: number; ci: number; col: string | undefined };
      const ends: End[] = [];
      if (it.start !== null) ends.push({ side: 0, x: it.start, ci: START_C, col: spec.startColor });
      if (it.end !== null) ends.push({ side: 1, x: it.end, ci: END_C, col: spec.endColor });
      for (const { side, x, ci, col } of ends) {
        const [cx, cy] = xy(x);
        g += `<circle class="lc-mark lc-dumbbell ${colorAttrs(ci, col)} data-i="${i}" data-end="${side}" data-v="${x}" cx="${n2(cx)}" cy="${n2(cy)}" r="${n2(r)}"/>`;
      }
      if (!ends.length) return;
      // value labels: the larger value on its outer (right / upper) side, where space is reserved; the smaller on its
      // outer side, or between the two dots when the outer side has no room; dropped (still in tip/table) otherwise
      if (showVals) {
        const sorted = [...ends].sort((a, b) => a.x - b.x || a.side - b.side);
        const high = sorted[sorted.length - 1] as End;
        const low = sorted.length > 1 && (sorted[0] as End).x !== high.x ? sorted[0] : undefined;
        const [hx, hy] = xy(high.x);
        const hl = fmt(high.x); const hw = tw(hl, FS);
        if (horizontal) g += `<text class="lc-dumbbell-val" x="${n2(Math.min(hx + r + 4, ctx.W - hw - 2))}" y="${n2(hy + FS * 0.35)}">${esc(hl)}</text>`;
        else if (hw <= ax.band - 2) g += `<text class="lc-dumbbell-val" x="${n2(clamp(hx - hw / 2, 2, ctx.W - hw - 2))}" y="${n2(Math.max(FS, hy - r - 4))}">${esc(hl)}</text>`;
        if (low) {
          const ll = fmt(low.x); const lw = tw(ll, FS);
          const [lx, ly] = xy(low.x);
          if (horizontal) {
            const outer = lx - r - 4 - lw;
            const x = outer >= ax.px + 1 ? outer : lx + r + 4 + lw <= hx - r - 4 ? lx + r + 4 : null;
            if (x !== null) g += `<text class="lc-dumbbell-val" x="${n2(x)}" y="${n2(ly + FS * 0.35)}">${esc(ll)}</text>`;
          } else if (lw <= ax.band - 2) {
            const outer = ly + r + FS;
            const y = outer <= ax.py + ax.ph - 2 ? outer : ly - r - 4 - FS >= hy + r ? ly - r - 4 : null;
            if (y !== null) g += `<text class="lc-dumbbell-val" x="${n2(clamp(lx - lw / 2, 2, ctx.W - lw - 2))}" y="${n2(y)}">${esc(ll)}</text>`;
          }
        }
      }
      const anchor = xy(Math.max(...ends.map((e) => e.x)));
      marks += focus ? focusable(ctx, 'lc-pt-dumbbell', aria(it), g, anchor[0], anchor[1]) : g;
    });
    inner = ax.svg + marks + missingNote(ctx, missing.map((it) => it.label));
  }
  const up = items.filter((it) => it.start !== null && it.end !== null && it.end > it.start).length;
  const down = items.filter((it) => it.start !== null && it.end !== null && it.end < it.start).length;
  const L = ctx.lang === 'ko' ? { up: '증가', down: '감소' } : { up: 'up', down: 'down' };
  const desc = `${items.length}${t.items} (${spec.startLabel} → ${spec.endLabel}), ${L.up} ${up}, ${L.down} ${down}. ` +
    items.map((it) => `${aria(it)}.`).join(' ') + (missing.length ? ` ${t.missing} ${missing.length}.` : '');
  const lg = spec.legend === false ? '' : legend([
    { name: spec.startLabel, idx: START_C, ...(spec.startColor ? { color: spec.startColor } : {}) },
    { name: spec.endLabel, idx: END_C, ...(spec.endColor ? { color: spec.endColor } : {}) },
  ]);
  const tbl = table(t, spec.title, [t.cat, spec.startLabel, spec.endLabel, t.change], order.map((i) => {
    const it = items[i] as DumbbellItem;
    return {
      th: `${it.label}${it.quality ? ` (${it.quality})` : ''}`,
      cells: [it.start === null ? null : fmt(it.start), it.end === null ? null : fmt(it.end), it.start === null || it.end === null ? null : changeText(it.start, it.end, fmt)],
    };
  }));
  return frame(ctx, spec, inner, desc, lg, wrapTable(spec.table ?? 'details', t, tbl));
}

export const plugin = definePlugin<DumbbellSpec>({
  type: 'dumbbell',
  names: { ko: '덤벨 차트', en: 'Dumbbell chart' },
  validate(input) {
    const o = dict(input, 'spec', [...BASE, 'startLabel', 'endLabel', 'items', 'sort', 'horizontal', 'zero', 'startColor', 'endColor', 'xLabel']);
    const out = base(o);
    out.type = 'dumbbell';
    out.startLabel = str(o.startLabel, 'startLabel', 40);
    out.endLabel = str(o.endLabel, 'endLabel', 40);
    out.items = idList(o.items, 'items', ['label', 'start', 'end', 'quality'], MAX_DUMBBELL_ITEMS, (it, p, id) => {
      const r: Record<string, unknown> = { id, label: str(it.label, `${p}.label`, 60), start: value(it.start, `${p}.start`), end: value(it.end, `${p}.end`) };
      put(r, 'quality', optStr(it.quality, `${p}.quality`, 60));
      return r;
    });
    put(out, 'sort', oneOf(o.sort, 'sort', ['none', 'start', 'end', 'change'] as const));
    put(out, 'horizontal', optBool(o.horizontal, 'horizontal'));
    put(out, 'zero', optBool(o.zero, 'zero'));
    put(out, 'startColor', color(o.startColor, 'startColor'));
    put(out, 'endColor', color(o.endColor, 'endColor'));
    put(out, 'xLabel', optStr(o.xLabel, 'xLabel', 80));
    return out as unknown as DumbbellSpec;
  },
  height: (spec) => (spec.horizontal === false ? 300 : clamp(spec.items.length * 28 + 60, 160, 2400)),
  render,
});
