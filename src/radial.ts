// Ring/pie geometry shared by donut (core) and pie (plugin).
import type { DonutSpec, Slice, Unit, ValueLabels } from './types.ts';
import { clamp, esc, makeFmt, n2, truncate, tw } from './format.ts';
import { type Ctx, colorAttrs, empty, frame, legend, pct, spread, table, tip, wrapTable } from './kit.ts';

/** Spec fields the ring renderer needs (donut and pie share them). */
export type RingSpec = Pick<DonutSpec, 'title' | 'description' | 'unit' | 'legend' | 'table' | 'lang' | 'id' | 'width' | 'height'> & { type: string; slices: Slice[]; centerLabel?: string; unit?: Unit; valueLabels?: ValueLabels };

const LFS = 11;
const LH = 13;
/** Slices below this share get no label inside the ring (the legend and value box still carry them). */
const MIN_IN = 0.06;

/**
 * Draw slices as a ring (`hole` = inner radius ratio, 0 for a pie). The centre total is shown only for rings.
 * Labels (name + bold value · share) sit beside the slices with leader lines when the chart is wide enough; narrow
 * charts keep the full ring and print the share inside the bigger slices instead. Hovering or focusing a slice fades
 * the others; on a ring the centre swaps to that slice (CSS only).
 */
export function renderRing(spec: RingSpec, ctx: Ctx, hole = 0.62): string {
  const t = ctx.t;
  const fmt = makeFmt(spec.unit, spec.slices.map((s) => s.value));
  const valid = spec.slices.filter((s) => s.value !== null && s.value > 0);
  const total = spec.slices.reduce((a, s) => a + (s.value ?? 0), 0);
  const share = (v: number): string => pct(total > 0 ? v / total : 0);
  const R0 = Math.max(20, Math.min(ctx.W, ctx.H) / 2 - 8);
  // outside labels: two lines (name / value · share), at most 30% of the width each side; used when the ring keeps
  // at least 62% of its full radius and 56px, otherwise the share goes inside the slices
  const vl = spec.valueLabels !== 'none' && valid.length > 0;
  const need = vl ? Math.max(...valid.map((s) => Math.max(tw(s.label, LFS), tw(`${fmt(s.value as number)} · ${share(s.value as number)}`, LFS)))) : 0;
  const lw = Math.min(need, ctx.W * 0.3);
  const Rout = Math.min(ctx.H / 2 - 8, (ctx.W - 2 * (lw + 18)) / 2);
  const outside = vl && Rout >= Math.max(56, R0 * 0.62);
  const R = outside ? Rout : R0;
  const r0 = R * hole;
  const cx = ctx.W / 2; const cy = ctx.H / 2;
  let inner = '';
  let pts = '';
  let lbl = '';
  let alt = '';
  if (!valid.length) inner = empty(ctx);
  else {
    let a0 = -Math.PI / 2;
    const P = (rad: number, a: number): string => `${n2(cx + rad * Math.cos(a))} ${n2(cy + rad * Math.sin(a))}`;
    const side: { i: number; s: Slice; mid: number; right: boolean }[] = [];
    spec.slices.forEach((s, i) => {
      if (s.value === null || s.value <= 0) return;
      const frac = s.value / total;
      const a1 = a0 + frac * Math.PI * 2;
      let d: string;
      if (frac > 0.9999) {
        d = `M${P(R, a0)} A${n2(R)} ${n2(R)} 0 1 1 ${P(R, a0 + Math.PI)} A${n2(R)} ${n2(R)} 0 1 1 ${P(R, a0)} M${P(r0, a0)} A${n2(r0)} ${n2(r0)} 0 1 0 ${P(r0, a0 + Math.PI)} A${n2(r0)} ${n2(r0)} 0 1 0 ${P(r0, a0)} Z`;
      } else {
        const big = a1 - a0 > Math.PI ? 1 : 0;
        d = `M${P(R, a0)} A${n2(R)} ${n2(R)} 0 ${big} 1 ${P(R, a1)} L${P(r0, a1)} A${n2(r0)} ${n2(r0)} 0 ${big} 0 ${P(r0, a0)} Z`;
      }
      const mid = (a0 + a1) / 2;
      const text = `${s.label}: ${fmt(s.value)} (${share(s.value)})${s.quality ? ` · ${s.quality}` : ''}`;
      const path = `<path class="lc-mark lc-slice ${colorAttrs(i, s.color)} data-i="${i}" data-v="${s.value}" fill-rule="evenodd" d="${d}"/>`;
      // the share inside a slice travels with the (focusable) slice so it stays above the fill
      let inside = '';
      if (vl) {
        if (outside) side.push({ i, s, mid, right: Math.cos(mid) >= -1e-9 });
        else if (frac >= MIN_IN && R - r0 >= LFS + 6) {
          const rm = r0 > 0 ? (R + r0) / 2 : R * 0.62;
          inside = `<g class="lc-lbls" aria-hidden="true"><text class="lc-val lc-val-in" data-i="${i}" x="${n2(cx + rm * Math.cos(mid))}" y="${n2(cy + rm * Math.sin(mid) + LFS * 0.36)}" text-anchor="middle">${esc(share(s.value))}</text></g>`;
        }
      }
      // the value box hangs from the middle of the slice so it does not cover the outside labels
      pts += `<g class="lc-pt lc-pt-slice" tabindex="0" aria-label="${esc(text)}">${path}${inside}${tip(ctx, text, cx + ((R + r0) / 2) * Math.cos(mid), cy + ((R + r0) / 2) * Math.sin(mid))}</g>`;
      if (r0 > 0) {
        // centre text for this slice, shown by CSS while the slice is hovered or focused
        const v = fmt(s.value);
        const fsz = clamp((r0 * 1.7) / Math.max(1, tw(v, 1)), 11, 22);
        alt += `<g class="lc-center-alt" data-i="${i}" aria-hidden="true"><text class="lc-center-sub" x="${n2(cx)}" y="${n2(cy - fsz * 0.55)}" text-anchor="middle">${esc(truncate(s.label, r0 * 1.7, 11))}</text><text class="lc-center lc-center-v ${colorAttrs(i, s.color)} x="${n2(cx)}" y="${n2(cy + fsz * 0.5)}" text-anchor="middle" font-size="${n2(fsz)}">${esc(v)}</text><text class="lc-center-sub" x="${n2(cx)}" y="${n2(cy + fsz * 0.5 + 14)}" text-anchor="middle">${esc(share(s.value))}</text></g>`;
      }
      a0 = a1;
    });
    if (outside) {
      // per side: top-to-bottom order, pushed apart so two-line labels never overlap, leader from the arc's midpoint
      for (const right of [true, false]) {
        const items = side.filter((it) => it.right === right);
        if (!items.length) continue;
        const ys = spread(items.map((it) => ({ y: cy + (R + 14) * Math.sin(it.mid), h: 2 * LH + 4 })), 4, ctx.H - 4);
        const lx = right ? cx + R + 18 : cx - R - 18;
        items.forEach((it, k) => {
          const y = ys[k] ?? cy;
          const ex = cx + (R + 2) * Math.cos(it.mid); const ey = cy + (R + 2) * Math.sin(it.mid);
          const kx = right ? Math.max(lx - 6, ex + 6) : Math.min(lx + 6, ex - 6);
          lbl += `<path class="lc-lead" d="M${n2(ex)},${n2(ey)}L${n2(kx)},${n2(y)}L${n2(lx + (right ? -3 : 3))},${n2(y)}"/>`;
          const v = it.s.value as number;
          lbl += `<text class="lc-end ${colorAttrs(it.i, it.s.color)} data-i="${it.i}" x="${n2(lx)}" y="${n2(y - LH / 2 + LFS * 0.36)}"${right ? '' : ' text-anchor="end"'}><tspan class="lc-lbl">${esc(truncate(it.s.label, lw, LFS))}</tspan><tspan class="lc-lbl-v" x="${n2(lx)}" dy="${LH}">${esc(`${fmt(v)} · ${share(v)}`)}</tspan></text>`;
        });
      }
    }
    if (r0 > 0) {
      const big = fmt(total);
      const fsz = clamp((r0 * 1.7) / Math.max(1, tw(big, 1)), 11, 24);
      inner += `<g class="lc-center-main"><text class="lc-center" x="${n2(cx)}" y="${n2(cy + (spec.centerLabel ? 0 : fsz * 0.35))}" text-anchor="middle" font-size="${n2(fsz)}">${esc(big)}</text>`;
      if (spec.centerLabel) inner += `<text class="lc-center-sub" x="${n2(cx)}" y="${n2(cy + 16)}" text-anchor="middle">${esc(truncate(spec.centerLabel, r0 * 1.7, 11))}</text>`;
      inner += '</g>' + alt;
    }
  }
  const missing = spec.slices.filter((s) => s.value === null).length;
  const desc = `${t.total} ${fmt(total)}. ` + spec.slices.map((s) => (s.value === null ? `${s.label}: ${t.na}` : `${s.label}: ${fmt(s.value)}${total > 0 ? ` (${share(s.value)})` : ''}`)).join(', ') + (missing ? `. ${t.missing} ${missing}.` : '.');
  const lg = spec.legend === false ? '' : legend(spec.slices.map((s, i) => ({ name: s.label, idx: i, ...(s.color ? { color: s.color } : {}), ...(s.quality ? { quality: s.quality } : {}), extra: s.value === null ? t.na : `${fmt(s.value)}${total > 0 ? ` · ${share(s.value)}` : ''}` })));
  const tbl = wrapTable(spec.table ?? 'details', t, table(t, spec.title, [t.cat, t.value, t.share],
    spec.slices.map((s) => ({ th: `${s.label}${s.quality ? ` (${s.quality})` : ''}`, cells: s.value === null ? [null, null] : [fmt(s.value), total > 0 ? share(s.value) : null] }))));
  const lbls = lbl ? `<g class="lc-lbls" aria-hidden="true">${lbl}</g>` : '';
  return frame(ctx, spec, inner + lbls + pts, desc, lg, tbl, outside ? { cls: 'lc-ring-out' } : {});
}
