// Lollipop chart: one stem from the zero line to a dot per category, optionally sorted and/or horizontal.
// Also exports catAxes(), the category/value axis frame shared by the dumbbell, waterfall and pareto plugins.
import type { BaseSpec, Value } from '../types.ts';
import { definePlugin } from '../plugin.ts';
import { BASE, MAX_POINTS, base, color, dict, idList, oneOf, optBool, optStr, put, str, value } from '../check.ts';
import { type Fmt, type Ticks, clamp, esc, makeFmt, n2, niceTicks, truncate, tw } from '../format.ts';
import { type Ctx, FS, MAX_FOCUS, colorAttrs, empty, focusable, frame, legend, table, wrapTable } from '../kit.ts';

export interface LollipopItem { id: string; label: string; value: Value; color?: string; quality?: string }

export interface LollipopSpec extends BaseSpec {
  type: 'lollipop';
  items: LollipopItem[];
  /** Series name used in value boxes and the table header, e.g. "방문자". */
  name?: string;
  /** "none" (default, input order), "desc" or "asc". Missing values always go last. */
  sort?: 'none' | 'desc' | 'asc';
  /** Categories on the y axis, stems grow to the right. */
  horizontal?: boolean;
  /** Mark colour override (default series colour 1). */
  color?: string;
  xLabel?: string;
}

export interface AxesOpts {
  labels: string[];
  dom: Ticks;
  fmt: Fmt;
  horizontal: boolean;
  /** Extra space reserved on each side of the plot area (value labels, a second axis, notes). */
  top?: number; right?: number; bottom?: number;
  xLabel?: string;
}

export interface Axes {
  svg: string;
  /** Value -> pixel along the value axis. */
  vv: (v: number) => number;
  /** Category index -> pixel centre along the category axis. */
  cc: (i: number) => number;
  band: number; zero: number;
  px: number; py: number; pw: number; ph: number;
}

/** Grid, value ticks, category labels and the zero line for a category chart filling the whole viewBox. */
export function catAxes(ctx: Ctx, o: AxesOpts): Axes {
  const { labels, dom, fmt, horizontal } = o;
  const N = Math.max(1, labels.length);
  const tickLabels = dom.ticks.map(fmt);
  const maxTick = Math.max(0, ...tickLabels.map((t) => tw(t, FS)));
  const catMax = Math.max(0, ...labels.map((l) => tw(l, FS)));
  const xl = o.xLabel ? FS + 6 : 0;
  let left: number; let right: number; let top: number; let bottom: number;
  if (horizontal) {
    left = Math.min(ctx.W * 0.4, catMax + 12);
    right = Math.ceil(tw(tickLabels[tickLabels.length - 1] ?? '', FS) / 2) + 6 + (o.right ?? 0);
    top = 6 + (o.top ?? 0); bottom = FS + 12 + xl + (o.bottom ?? 0);
  } else {
    left = maxTick + 12; right = 10 + (o.right ?? 0); top = 8 + (o.top ?? 0); bottom = FS + 12 + xl + (o.bottom ?? 0);
  }
  const px = left; const py = top;
  const pw = Math.max(10, ctx.W - left - right); const ph = Math.max(10, ctx.H - top - bottom);
  const span = dom.max - dom.min || 1;
  const vv = (v: number): number => (horizontal ? px + ((v - dom.min) / span) * pw : py + ph - ((v - dom.min) / span) * ph);
  const band = (horizontal ? ph : pw) / N;
  const cc = (i: number): number => (horizontal ? py : px) + (i + 0.5) * band;
  const zero = vv(clamp(0, dom.min, dom.max));
  let s = '';
  dom.ticks.forEach((t, ti) => {
    const p = vv(t);
    const label = tickLabels[ti] ?? '';
    if (horizontal) {
      const lw = tw(label, FS);
      s += `<line class="lc-grid" x1="${n2(p)}" y1="${n2(py)}" x2="${n2(p)}" y2="${n2(py + ph)}"/>`;
      s += `<text class="lc-tick" x="${n2(clamp(p - lw / 2, 2, ctx.W - lw - 2))}" y="${n2(py + ph + FS + 5)}">${esc(label)}</text>`;
    } else {
      s += `<line class="lc-grid" x1="${n2(px)}" y1="${n2(p)}" x2="${n2(px + pw)}" y2="${n2(p)}"/>`;
      s += `<text class="lc-tick" x="${n2(px - 6)}" y="${n2(p + FS * 0.35)}" text-anchor="end">${esc(label)}</text>`;
    }
  });
  // vertical: every label when they fit or there are few categories (truncated), otherwise thinned out by width
  const fitAll = !horizontal && (catMax + 6 <= band || labels.length <= 6);
  const step = horizontal ? Math.max(1, Math.ceil((FS + 2) / band)) : fitAll ? 1 : Math.max(1, Math.ceil((catMax + 8) / band));
  for (let i = 0; i < labels.length; i += step) {
    const raw = labels[i] ?? '';
    if (horizontal) {
      s += `<text class="lc-tick" x="${n2(px - 6)}" y="${n2(cc(i) + FS * 0.35)}" text-anchor="end">${esc(truncate(raw, left - 11.5, FS))}</text>`;
    } else {
      const t = truncate(raw, Math.max(24, step * band - 4), FS);
      const w = tw(t, FS);
      s += `<text class="lc-tick" x="${n2(clamp(cc(i) - w / 2, 2, ctx.W - w - 2))}" y="${n2(py + ph + FS + 6)}">${esc(t)}</text>`;
    }
  }
  s += horizontal
    ? `<line class="lc-axis" x1="${n2(zero)}" y1="${n2(py)}" x2="${n2(zero)}" y2="${n2(py + ph)}"/>`
    : `<line class="lc-axis" x1="${n2(px)}" y1="${n2(zero)}" x2="${n2(px + pw)}" y2="${n2(zero)}"/>`;
  if (o.xLabel) {
    const t = truncate(o.xLabel, pw, FS);
    s += `<text class="lc-axis-title" x="${n2(px + pw / 2)}" y="${n2(ctx.H - 3 - (o.bottom ?? 0))}" text-anchor="middle">${esc(t)}</text>`;
  }
  return { svg: s, vv, cc, band, zero, px, py, pw, ph };
}

/** Nice value domain; `withZero` keeps 0 inside (bars, stems). Tick count follows the available length. */
export function valueDomain(lo: number, hi: number, length: number, withZero: boolean): Ticks {
  const a = withZero ? Math.min(lo, 0) : lo; const b = withZero ? Math.max(hi, 0) : hi;
  return niceTicks(a, b, clamp(Math.round(length / 70), 3, 7));
}

/** Display order of item indices: sorted by value when asked, missing values last, ties keep input order. */
export function sortOrder(vals: Value[], sort: 'none' | 'desc' | 'asc' | undefined): number[] {
  const idx = vals.map((_, i) => i);
  if (!sort || sort === 'none') return idx;
  const dir = sort === 'desc' ? -1 : 1;
  return idx.sort((a, b) => {
    const va = vals[a] ?? null; const vb = vals[b] ?? null;
    if (va === null || vb === null) return (va === null ? 1 : 0) - (vb === null ? 1 : 0) || a - b;
    return (va - vb) * dir || a - b;
  });
}

/** "결측: A, B" note line at the bottom of the viewBox. */
export function missingNote(ctx: Ctx, names: string[]): string {
  if (!names.length) return '';
  const msg = truncate(`${ctx.t.missing}: ${names.join(', ')}`, ctx.W - 8, FS);
  return `<text class="lc-tick lc-missing-note" x="4" y="${n2(ctx.H - 6)}">${esc(msg)}</text>`;
}

function render(spec: LollipopSpec, ctx: Ctx): string {
  const t = ctx.t;
  const items = spec.items;
  const horizontal = spec.horizontal === true;
  const fmt = makeFmt(spec.unit, items.map((it) => it.value));
  const order = sortOrder(items.map((it) => it.value), spec.sort);
  const present = items.filter((it): it is LollipopItem & { value: number } => it.value !== null);
  const missing = items.filter((it) => it.value === null);
  const aria = (it: LollipopItem): string =>
    `${it.label}${spec.name ? `, ${spec.name}` : ''}: ${it.value === null ? t.na : fmt(it.value)}${it.quality ? ` · ${it.quality}` : ''}`;
  let inner = '';
  if (!present.length) inner = empty(ctx);
  else {
    const vs = present.map((it) => it.value);
    const lo = Math.min(...vs); const hi = Math.max(...vs);
    const dom = valueDomain(lo, hi, horizontal ? ctx.W - 120 : ctx.H - 60, true);
    const valW = Math.max(...vs.map((v) => tw(fmt(v), FS)));
    const note = missing.length ? FS + 8 : 0;
    const ax = catAxes(ctx, {
      labels: order.map((i) => items[i]?.label ?? ''), dom, fmt, horizontal,
      top: horizontal ? 0 : FS + 2, right: horizontal ? valW + 8 : 0, bottom: note,
      ...(spec.xLabel ? { xLabel: spec.xLabel } : {}),
    });
    const focus = present.length <= MAX_FOCUS;
    const r = clamp(ax.band * 0.3, 2, 5.5);
    let marks = '';
    order.forEach((i, pos) => {
      const it = items[i];
      if (!it || it.value === null) return;
      const v = it.value;
      const c = colorAttrs(0, it.color ?? spec.color);
      const p = ax.vv(v); const q = ax.cc(pos);
      const [x1, y1, x2, y2] = horizontal ? [ax.zero, q, p, q] : [q, ax.zero, q, p];
      let g = `<line class="lc-lollipop-stem ${c} data-i="${i}" x1="${n2(x1)}" y1="${n2(y1)}" x2="${n2(x2)}" y2="${n2(y2)}"/>`;
      g += `<circle class="lc-mark lc-lollipop ${c} data-i="${i}" data-v="${v}" cx="${n2(x2)}" cy="${n2(y2)}" r="${n2(r)}"/>`;
      const label = fmt(v);
      const w = tw(label, FS);
      if (horizontal) {
        // value label right of the dot (positives) or right of the zero line (negatives); needs a band tall enough
        if (ax.band >= FS + 1) {
          const lx = v >= 0 ? p + r + 4 : ax.zero + 4;
          g += `<text class="lc-lollipop-val" x="${n2(Math.min(lx, ctx.W - w - 2))}" y="${n2(q + FS * 0.35)}">${esc(label)}</text>`;
        }
      } else if (w <= ax.band - 2) {
        const ly = v >= 0 ? p - r - 4 : ax.zero - 4;
        g += `<text class="lc-lollipop-val" x="${n2(clamp(q - w / 2, 2, ctx.W - w - 2))}" y="${n2(Math.max(ly, FS))}">${esc(label)}</text>`;
      }
      marks += focus ? focusable(ctx, 'lc-pt-lollipop', aria(it), `<circle class="lc-hit" cx="${n2(x2)}" cy="${n2(y2)}" r="9"/>${g}`, x2, y2) : g;
    });
    inner = ax.svg + marks + missingNote(ctx, missing.map((it) => it.label));
  }
  let desc = `${items.length}${t.items}.`;
  if (present.length) {
    const max = present.reduce((a, b) => (b.value > a.value ? b : a));
    const min = present.reduce((a, b) => (b.value < a.value ? b : a));
    const total = present.reduce((a, b) => a + b.value, 0);
    desc += ` ${t.total} ${fmt(total)}, ${t.max} ${max.label} ${fmt(max.value)}, ${t.min} ${min.label} ${fmt(min.value)}.`;
  }
  if (missing.length) desc += ` ${t.missing} ${missing.length}.`;
  const q = items.filter((it) => it.quality);
  if (q.length) desc += ` ${t.quality}: ${q.map((it) => `${it.label} ${it.quality}`).join(', ')}.`;
  const lg = spec.legend === true && spec.name ? legend([{ name: spec.name, idx: 0, ...(spec.color ? { color: spec.color } : {}) }]) : '';
  const tbl = table(t, spec.title, [t.cat, spec.name ?? t.value], order.map((i) => {
    const it = items[i] as LollipopItem;
    return { th: `${it.label}${it.quality ? ` (${it.quality})` : ''}`, cells: [it.value === null ? null : fmt(it.value)] };
  }));
  return frame(ctx, spec, inner, desc, lg, wrapTable(spec.table ?? 'details', t, tbl));
}

export const plugin = definePlugin<LollipopSpec>({
  type: 'lollipop',
  names: { ko: '롤리팝 차트', en: 'Lollipop chart' },
  validate(input) {
    const o = dict(input, 'spec', [...BASE, 'items', 'name', 'sort', 'horizontal', 'color', 'xLabel']);
    const out = base(o);
    out.type = 'lollipop';
    out.items = idList(o.items, 'items', ['label', 'value', 'color', 'quality'], MAX_POINTS, (it, p, id) => {
      const r: Record<string, unknown> = { id, label: str(it.label, `${p}.label`, 60), value: value(it.value, `${p}.value`) };
      put(r, 'color', color(it.color, `${p}.color`));
      put(r, 'quality', optStr(it.quality, `${p}.quality`, 60));
      return r;
    });
    put(out, 'name', optStr(o.name, 'name', 80));
    put(out, 'sort', oneOf(o.sort, 'sort', ['none', 'desc', 'asc'] as const));
    put(out, 'horizontal', optBool(o.horizontal, 'horizontal'));
    put(out, 'color', color(o.color, 'color'));
    put(out, 'xLabel', optStr(o.xLabel, 'xLabel', 80));
    return out as unknown as LollipopSpec;
  },
  height: (spec) => (spec.horizontal ? clamp(spec.items.length * 24 + 60, 160, 2400) : 300),
  render,
});
