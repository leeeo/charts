// Gauge: one value on a semicircular min..max arc, with optional threshold bands (the track) and a target marker.
import type { BaseSpec, Value } from '../types.ts';
import { definePlugin } from '../plugin.ts';
import { BASE, base, color, dict, fail, num, optNum, optStr, value } from '../check.ts';
import { type Ctx, colorAttrs, empty, focusable, frame, table, wrapTable } from '../kit.ts';
import { clamp, esc, makeFmt, n2, truncate, tw } from '../format.ts';

export interface GaugeBand { to: number; label?: string; color?: string }
export interface GaugeSpec extends BaseSpec {
  type: 'gauge';
  /** Current value; null = missing (empty state). Values outside min..max are drawn clamped and noted. */
  value: Value;
  min?: number;
  max: number;
  target?: number;
  /** Short caption under the value, e.g. "이번 달 매출". */
  label?: string;
  quality?: string;
  color?: string;
  /** Threshold bands by upper bound (sorted ascending); each starts where the previous one ends. */
  bands?: GaugeBand[];
}

const L = {
  ko: { out: '범위 밖', achieved: '달성' },
  en: { out: 'out of range', achieved: 'of target' },
};

/** Point on the arc: f=0 left end, f=0.5 top, f=1 right end. */
const pt = (cx: number, cy: number, r: number, f: number): [number, number] => {
  const a = Math.PI + f * Math.PI;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
};
const ring = (cx: number, cy: number, r0: number, r1: number, f0: number, f1: number): string => {
  const [ax, ay] = pt(cx, cy, r1, f0); const [bx, by] = pt(cx, cy, r1, f1);
  const [cx2, cy2] = pt(cx, cy, r0, f1); const [dx, dy] = pt(cx, cy, r0, f0);
  return `M${n2(ax)} ${n2(ay)} A${n2(r1)} ${n2(r1)} 0 0 1 ${n2(bx)} ${n2(by)} L${n2(cx2)} ${n2(cy2)} A${n2(r0)} ${n2(r0)} 0 0 0 ${n2(dx)} ${n2(dy)} Z`;
};

export const plugin = definePlugin<GaugeSpec>({
  type: 'gauge',
  names: { ko: '게이지', en: 'Gauge' },
  defaultWidth: 360,
  validate(input) {
    const o = dict(input, 'spec', [...BASE, 'value', 'min', 'max', 'target', 'label', 'quality', 'color', 'bands']);
    const out = base(o) as unknown as GaugeSpec;
    out.type = 'gauge';
    if (o.value === undefined) fail('value', 'is required');
    out.value = value(o.value, 'value');
    const min = optNum(o.min, 'min', -1e15, 1e15) ?? 0;
    const max = num(o.max, 'max');
    if (max <= min) fail('max', 'must be greater than min');
    if (o.min !== undefined) out.min = min;
    out.max = max;
    const target = optNum(o.target, 'target', min, max);
    if (target !== undefined) out.target = target;
    const label = optStr(o.label, 'label', 60);
    if (label !== undefined) out.label = label;
    const q = optStr(o.quality, 'quality', 60);
    if (q !== undefined) out.quality = q;
    const c = color(o.color, 'color');
    if (c !== undefined) out.color = c;
    if (o.bands !== undefined) {
      if (!Array.isArray(o.bands) || o.bands.length === 0) fail('bands', 'must be a non-empty array');
      if (o.bands.length > 8) fail('bands', 'must have at most 8 entries');
      out.bands = o.bands.map((b, i) => {
        const p = `bands[${i}]`;
        const d = dict(b, p, ['to', 'label', 'color']);
        const band: GaugeBand = { to: num(d.to, `${p}.to`, min, max) };
        const bl = optStr(d.label, `${p}.label`, 40);
        const bc = color(d.color, `${p}.color`);
        if (bl !== undefined) band.label = bl;
        if (bc !== undefined) band.color = bc;
        return band;
      }).sort((a, b) => a.to - b.to);
    }
    return out;
  },
  height(spec, W) {
    return Math.round(clamp(W * 0.6, 140, 300) + (spec.label ? 16 : 0));
  },
  render(spec, ctx: Ctx) {
    const t = ctx.t;
    const L2 = L[ctx.lang];
    const min = spec.min ?? 0;
    const max = spec.max;
    const v = spec.value;
    const fmt = makeFmt(spec.unit, [v, min, max, spec.target ?? null, ...(spec.bands ?? []).map((b) => b.to)]);
    const frac = (x: number): number => clamp((x - min) / (max - min), 0, 1);
    const out = v !== null && (v < min || v > max);
    const ach = v !== null && spec.target !== undefined && spec.target !== 0 ? v / spec.target : null;
    const achText = ach !== null ? `${Math.round(ach * 1000) / 10}%` : null;
    const valText = v === null ? `${spec.label ?? t.value}: ${t.na}`
      : `${spec.label ?? t.value}: ${fmt(v)}${spec.target !== undefined ? ` · ${t.target} ${fmt(spec.target)}${achText ? ` (${L2.achieved} ${achText})` : ''}` : ''}${out ? ` · ${L2.out}` : ''}${spec.quality ? ` · ${spec.quality}` : ''}`;
    const bands = (spec.bands ?? []).map((b, k, arr) => ({ ...b, from: k === 0 ? min : arr[k - 1]!.to }));

    let svg = '';
    if (v === null) svg = empty(ctx);
    else {
      const bottom = spec.label ? 38 : 22;
      const cx = ctx.W / 2;
      const cy = ctx.H - bottom;
      const R = Math.max(16, Math.min(ctx.W / 2 - 8, cy - 8));
      const th = clamp(R * 0.22, 8, 34);
      svg += `<path class="lc-gauge-track" d="${ring(cx, cy, R - th, R, 0, 1)}"/>`;
      bands.forEach((b, k) => {
        if (b.to <= b.from) return;
        const cls = b.color ? `lc-gauge-band lc-gb-col ${colorAttrs(k, b.color)}` : `lc-gauge-band lc-gb-${k % 4}"`;
        svg += `<path class="${cls} data-b="${k}" d="${ring(cx, cy, R - th, R, frac(b.from), frac(b.to))}"/>`;
      });
      const f = frac(v);
      let inner = `<path class="lc-mark lc-gauge ${colorAttrs(0, spec.color)} data-i="0" data-v="${v}" data-f="${n2(f)}" d="${ring(cx, cy, R - th * 0.8, R - th * 0.2, 0, f)}"/>`;
      if (spec.target !== undefined) {
        const tf = frac(spec.target);
        const [x0, y0] = pt(cx, cy, R - th - 4, tf); const [x1, y1] = pt(cx, cy, R + 4, tf);
        inner += `<line class="lc-gauge-target" data-v="${spec.target}" data-f="${n2(tf)}" x1="${n2(x0)}" y1="${n2(y0)}" x2="${n2(x1)}" y2="${n2(y1)}"/>`;
      }
      const big = fmt(v);
      const room = 2 * (R - th) * 0.85;
      const fs = clamp(Math.min(R * 0.34, room / Math.max(1, tw(big, 1))), 10, 40);
      inner += `<text class="lc-center lc-gauge-val" x="${n2(cx)}" y="${n2(cy - 4)}" text-anchor="middle" font-size="${n2(fs)}">${esc(truncate(big, room, fs))}</text>`;
      const [ax, ay] = pt(cx, cy, R, f);
      svg += focusable(ctx, 'lc-pt-gauge', valText, inner, ax, ay);
      const minT = fmt(min); const maxT = fmt(max);
      const half = ctx.W / 2 - 4;
      svg += `<text class="lc-tick" x="${n2(cx - R)}" y="${n2(cy + 15)}">${esc(truncate(minT, half, 12))}</text>`;
      svg += `<text class="lc-tick" x="${n2(cx + R)}" y="${n2(cy + 15)}" text-anchor="end">${esc(truncate(maxT, half, 12))}</text>`;
      if (spec.label) svg += `<text class="lc-center-sub lc-gauge-lbl" x="${n2(cx)}" y="${n2(cy + 31)}" text-anchor="middle">${esc(truncate(spec.label, ctx.W - 8, 12))}</text>`;
    }

    const bandText = bands.map((b) => `${b.label ? `${b.label} ` : ''}${fmt(b.from)}–${fmt(b.to)}`).join(', ');
    const desc = `${valText}. ${t.min} ${fmt(min)}, ${t.max} ${fmt(max)}.${bandText ? ` ${t.range}: ${bandText}.` : ''}${v === null ? ` ${t.missing} 1.` : ''}`;
    const rows: { th: string; cells: (string | null)[] }[] = [
      { th: `${spec.label ?? t.value}${spec.quality ? ` (${spec.quality})` : ''}`, cells: [v === null ? null : fmt(v)] },
      { th: t.min, cells: [fmt(min)] },
      { th: t.max, cells: [fmt(max)] },
    ];
    if (spec.target !== undefined) rows.push({ th: t.target, cells: [`${fmt(spec.target)}${achText ? ` (${L2.achieved} ${achText})` : ''}`] });
    bands.forEach((b, k) => rows.push({ th: `${t.range} ${k + 1}${b.label ? `: ${b.label}` : ''}`, cells: [`${fmt(b.from)}–${fmt(b.to)}`] }));
    return frame(ctx, spec, svg, desc, '', wrapTable(spec.table ?? 'details', t, table(t, spec.title, [t.cat, t.value], rows)));
  },
});
