// Combo chart: grouped bars (e.g. quarterly revenue and operating income) with one or more lines on the same
// categories. A line may use a right-hand axis (e.g. operating margin in %); a dual axis is only allowed with both
// axis titles (yLabel and y2Label) so each scale is labelled, and right-axis lines are dashed and marked
// "(오른쪽 축)" in the legend, value boxes and table. Bars may be negative (losses) and grow down from zero.
// Null values are missing: no bar, the line breaks, the table says 데이터 없음.
import type { BaseSpec, Series, Unit, Value } from '../types.ts';
import { definePlugin } from '../plugin.ts';
import { BASE, base, dict, fail, labels, oneOf, optStr, seriesList, unit } from '../check.ts';
import { clamp, esc, makeFmt, n2, niceTicks, truncate, tw } from '../format.ts';
import { type Ctx, FS, MAX_FOCUS, colorAttrs, empty, focusable, frame, legend, present, runs, summarize, table, wrapTable } from '../kit.ts';

export interface ComboLine extends Series { axis?: 'left' | 'right' }

export interface ComboSpec extends BaseSpec {
  type: 'combo';
  labels: string[];
  /** Bar series on the left axis (1..4). */
  bars: Series[];
  /** Line series (0..3); `axis: "right"` puts a line on the right axis. */
  lines?: ComboLine[];
  /** Format of the right axis values (the base `unit` formats the left axis). */
  unit2?: Unit;
  /** Left axis title; required when any line uses the right axis. */
  yLabel?: string;
  /** Right axis title; required when any line uses the right axis. */
  y2Label?: string;
  xLabel?: string;
}

const XS = 11;
const R = { ko: ' (오른쪽 축)', en: ' (right axis)' };

function render(spec: ComboSpec, ctx: Ctx): string {
  const t = ctx.t;
  const bars = spec.bars;
  const lines = spec.lines ?? [];
  const leftLines = lines.filter((l) => l.axis !== 'right');
  const rightLines = lines.filter((l) => l.axis === 'right');
  const dual = rightLines.length > 0;
  const leftAll = [...bars, ...leftLines].flatMap((s) => s.values);
  const rightAll = rightLines.flatMap((s) => s.values);
  const fmt = makeFmt(spec.unit, leftAll);
  const fmt2 = makeFmt(spec.unit2, rightAll);
  const n = spec.labels.length;
  // colour indices: bars first, then lines, in spec order
  const idx = new Map<Series, number>();
  [...bars, ...lines].forEach((s, i) => idx.set(s, i));
  const fmtOf = (s: Series): ((v: number) => string) => ((s as ComboLine).axis === 'right' ? fmt2 : fmt);
  const nameOf = (s: Series): string => `${s.name}${(s as ComboLine).axis === 'right' ? R[ctx.lang] : ''}`;
  const colText = (i: number): string => `${spec.labels[i]}: ` + [...bars, ...lines].map((s) => {
    const v = s.values[i];
    return `${s.name} ${v === null || v === undefined ? t.na : fmtOf(s)(v)}${s.quality ? ` (${s.quality})` : ''}`;
  }).join(' · ');

  const lv = present(leftAll);
  const rv = present(rightAll);
  let svg = '';
  if (!lv.length && !rv.length) svg = empty(ctx);
  else {
    const count = ctx.H < 240 ? 4 : 5;
    const ld = niceTicks(Math.min(0, ...lv), Math.max(0, ...lv), count);
    const rd = rv.length ? niceTicks(Math.min(...rv), Math.max(...rv), count) : null;
    const ll = ld.ticks.map(fmt);
    const rl = rd ? rd.ticks.map(fmt2) : [];
    const yT = spec.yLabel ? FS + 8 : 0;
    const y2T = dual && spec.y2Label ? FS + 8 : 0;
    const left = Math.max(...ll.map((l) => tw(l, FS))) + 10 + yT;
    const right = dual ? Math.max(...rl.map((l) => tw(l, FS))) + 10 + y2T : 10;
    const top = 10;
    const xT = spec.xLabel ? FS + 6 : 0;
    const bottom = XS + 14 + xT;
    const pw = Math.max(20, ctx.W - left - right);
    const ph = Math.max(20, ctx.H - top - bottom);
    const sy = (v: number): number => top + ph - ((v - ld.min) / (ld.max - ld.min || 1)) * ph;
    const sy2 = (v: number): number => (rd ? top + ph - ((v - rd.min) / (rd.max - rd.min || 1)) * ph : 0);
    const syOf = (s: Series): ((v: number) => number) => ((s as ComboLine).axis === 'right' ? sy2 : sy);
    const band = pw / Math.max(1, n);
    const cx = (i: number): number => left + band * (i + 0.5);
    ld.ticks.forEach((tk, k) => {
      const y = sy(tk);
      svg += `<line class="lc-grid" x1="${n2(left)}" x2="${n2(left + pw)}" y1="${n2(y)}" y2="${n2(y)}"/>`;
      svg += `<text class="lc-tick" x="${n2(left - 6)}" y="${n2(y + FS * 0.36)}" text-anchor="end">${esc(ll[k]!)}</text>`;
    });
    if (rd) rd.ticks.forEach((tk, k) => {
      svg += `<text class="lc-tick lc-combo-r-tick" x="${n2(left + pw + 6)}" y="${n2(sy2(tk) + FS * 0.36)}">${esc(rl[k]!)}</text>`;
    });
    if (spec.yLabel) svg += `<text class="lc-axis-title" transform="translate(${n2(FS)} ${n2(top + ph / 2)}) rotate(-90)" text-anchor="middle">${esc(truncate(spec.yLabel, ph, FS))}</text>`;
    if (dual && spec.y2Label) svg += `<text class="lc-axis-title" transform="translate(${n2(ctx.W - FS * 0.4)} ${n2(top + ph / 2)}) rotate(-90)" text-anchor="middle">${esc(truncate(spec.y2Label, ph, FS))}</text>`;
    const zero = sy(0);
    svg += `<line class="lc-axis" x1="${n2(left)}" x2="${n2(left + pw)}" y1="${n2(zero)}" y2="${n2(zero)}"/>`;
    if (dual) svg += `<line class="lc-axis" x1="${n2(left + pw)}" x2="${n2(left + pw)}" y1="${n2(top)}" y2="${n2(top + ph)}"/>`;
    const xl = spec.labels.map((l) => truncate(l, Math.max(40, band * 3), XS));
    const lw = Math.max(...xl.map((l) => tw(l, XS))) + 8;
    const step = Math.max(1, Math.ceil(lw / band));
    xl.forEach((l, i) => {
      if (i % step) return;
      const w = tw(l, XS);
      svg += `<text class="lc-tick lc-cs-x" x="${n2(clamp(cx(i), w / 2 + 2, ctx.W - w / 2 - 2))}" y="${n2(top + ph + XS + 8)}" text-anchor="middle">${esc(l)}</text>`;
    });
    if (spec.xLabel) svg += `<text class="lc-axis-title" x="${n2(left + pw / 2)}" y="${n2(ctx.H - 4)}" text-anchor="middle">${esc(truncate(spec.xLabel, pw, FS))}</text>`;
    const inner = band * 0.72;
    const bw = bars.length ? inner / bars.length : 0;
    let lineSvg = '';
    for (const s of lines) {
      const f = syOf(s);
      const d = runs(s.values).filter((r) => r.length > 1).map((r) => r.map((i, j) => `${j ? 'L' : 'M'}${n2(cx(i))} ${n2(f(s.values[i] as number))}`).join('')).join('');
      if (d) lineSvg += `<path class="lc-line lc-combo-line${s.axis === 'right' ? ' lc-combo-r' : ''} ${colorAttrs(idx.get(s)!, s.color)} d="${d}"/>`;
    }
    const canFocus = n * (bars.length + lines.length) <= MAX_FOCUS * 2 && n <= MAX_FOCUS;
    let barSvg = '';
    let marks = '';
    for (let i = 0; i < n; i++) {
      let g = '';
      bars.forEach((s, k) => {
        const v = s.values[i];
        if (v === null || v === undefined) return;
        const x = cx(i) - inner / 2 + k * bw + bw * 0.08;
        const y = sy(Math.max(0, v));
        const h = Math.abs(sy(v) - zero);
        g += `<rect class="lc-mark lc-bar lc-combo-bar${v < 0 ? ' lc-combo-neg' : ''} ${colorAttrs(idx.get(s)!, s.color)} data-s="${esc(s.id)}" data-i="${i}" data-v="${v}" x="${n2(x)}" y="${n2(y)}" width="${n2(Math.max(1, bw * 0.84))}" height="${n2(Math.max(v !== 0 ? 1 : 0, h))}"/>`;
      });
      let dots = '';
      for (const s of lines) {
        const v = s.values[i];
        if (v === null || v === undefined) continue;
        const solo = (i === 0 || s.values[i - 1] === null) && (i === n - 1 || s.values[i + 1] === null);
        dots += `<circle class="lc-mark lc-dot lc-combo-dot${solo ? ' lc-dot-vis' : ''}${s.axis === 'right' ? ' lc-combo-r' : ''} ${colorAttrs(idx.get(s)!, s.color)} data-s="${esc(s.id)}" data-i="${i}" data-v="${v}" cx="${n2(cx(i))}" cy="${n2(syOf(s)(v))}" r="3.5"/>`;
      }
      barSvg += g;
      if (canFocus) {
        const hit = `<rect class="lc-hit" x="${n2(cx(i) - band / 2)}" y="${n2(top)}" width="${n2(band)}" height="${n2(ph)}"/>`;
        marks += focusable(ctx, 'lc-pt-combo', colText(i), hit + dots, cx(i), top + 4);
      } else marks += dots;
    }
    svg += barSvg + lineSvg + marks;
  }

  const desc = `${n}${t.items} (${spec.labels[0]}–${spec.labels[n - 1]}). ` +
    [summarize(t, spec.labels, [...bars, ...leftLines], fmt), rightLines.length ? summarize(t, spec.labels, rightLines.map((s) => ({ ...s, name: nameOf(s) })), fmt2) : ''].filter(Boolean).join(' ');
  const all = [...bars, ...lines];
  const lg = spec.legend === false ? '' : legend(all.map((s) => ({ name: nameOf(s), idx: idx.get(s)!, ...(s.color ? { color: s.color } : {}), ...(s.quality ? { quality: s.quality } : {}) })));
  const tbl = table(t, spec.title, [spec.xLabel ?? t.cat, ...all.map((s) => `${nameOf(s)}${s.quality ? ` (${s.quality})` : ''}`)],
    spec.labels.map((l, i) => ({ th: l, cells: all.map((s) => { const v = s.values[i]; return v === null || v === undefined ? null : fmtOf(s)(v); }) })));
  return frame(ctx, spec, svg, desc, lg, wrapTable(spec.table ?? 'details', t, tbl));
}

export const plugin = definePlugin<ComboSpec>({
  type: 'combo',
  names: { ko: '막대·선 복합 차트', en: 'Bar and line combo' },
  validate(input) {
    const o = dict(input, 'spec', [...BASE, 'labels', 'bars', 'lines', 'unit2', 'yLabel', 'y2Label', 'xLabel']);
    const out = base(o) as unknown as ComboSpec;
    out.type = 'combo';
    out.labels = labels(o.labels, 'labels');
    const n = out.labels.length;
    out.bars = seriesList(o.bars, 'bars', n, false);
    if (out.bars.length > 4) fail('bars', 'must have at most 4 series');
    const ids = new Set(out.bars.map((s) => s.id));
    if (o.lines !== undefined) {
      if (!Array.isArray(o.lines)) fail('lines', 'must be an array');
      if (o.lines.length > 3) fail('lines', 'must have at most 3 series');
      out.lines = o.lines.map((raw, i) => {
        const p = `lines[${i}]`;
        const d = dict(raw, p, ['id', 'name', 'values', 'color', 'quality', 'axis']);
        const { axis, ...rest } = d;
        const s = seriesList([rest], p, n, false)[0]! as ComboLine;
        if (ids.has(s.id)) fail(`${p}.id`, 'duplicate id');
        ids.add(s.id);
        const ax = oneOf(axis, `${p}.axis`, ['left', 'right'] as const);
        if (ax !== undefined) s.axis = ax;
        return s;
      });
    }
    const u2 = unit(o.unit2, 'unit2');
    if (u2 !== undefined) out.unit2 = u2;
    const yl = optStr(o.yLabel, 'yLabel', 60);
    const y2 = optStr(o.y2Label, 'y2Label', 60);
    const xl = optStr(o.xLabel, 'xLabel', 60);
    if (out.lines?.some((l) => l.axis === 'right')) {
      if (yl === undefined) fail('yLabel', 'is required when a line uses the right axis');
      if (y2 === undefined) fail('y2Label', 'is required when a line uses the right axis');
    } else if (y2 !== undefined) fail('y2Label', 'requires a line with axis: right');
    if (yl !== undefined) out.yLabel = yl;
    if (y2 !== undefined) out.y2Label = y2;
    if (xl !== undefined) out.xLabel = xl;
    return out;
  },
  height: (_s, W) => (W < 420 ? 260 : 320),
  render,
});
