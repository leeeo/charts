// Ring/pie geometry shared by donut (core) and pie (plugin).
import type { DonutSpec, Slice, Unit } from './types.ts';
import { clamp, esc, makeFmt, n2, truncate, tw } from './format.ts';
import { type Ctx, colorAttrs, empty, frame, legend, table, tip, wrapTable } from './kit.ts';

/** Spec fields the ring renderer needs (donut and pie share them). */
export type RingSpec = Pick<DonutSpec, 'title' | 'description' | 'unit' | 'legend' | 'table' | 'lang' | 'id' | 'width' | 'height'> & { type: string; slices: Slice[]; centerLabel?: string; unit?: Unit };

/** Draw slices as a ring (`inner` = inner radius ratio, 0 for a pie). The centre total is shown only for rings. */
export function renderRing(spec: RingSpec, ctx: Ctx, hole = 0.62): string {
  const t = ctx.t;
  const fmt = makeFmt(spec.unit, spec.slices.map((s) => s.value));
  const valid = spec.slices.filter((s) => s.value !== null && s.value > 0);
  const total = spec.slices.reduce((a, s) => a + (s.value ?? 0), 0);
  const R = Math.max(20, Math.min(ctx.W, ctx.H) / 2 - 8);
  const r0 = R * hole;
  const cx = ctx.W / 2; const cy = ctx.H / 2;
  let inner = '';
  let pts = '';
  if (!valid.length) inner = empty(ctx);
  else {
    let a0 = -Math.PI / 2;
    const P = (rad: number, a: number): string => `${n2(cx + rad * Math.cos(a))} ${n2(cy + rad * Math.sin(a))}`;
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
      const text = `${s.label}: ${fmt(s.value)} (${n2(frac * 100)}%)${s.quality ? ` · ${s.quality}` : ''}`;
      const path = `<path class="lc-mark lc-slice ${colorAttrs(i, s.color)} data-i="${i}" data-v="${s.value}" fill-rule="evenodd" d="${d}"/>`;
      pts += `<g class="lc-pt lc-pt-slice" tabindex="0" aria-label="${esc(text)}">${path}${tip(ctx, text, cx + R * Math.cos(mid), cy + R * Math.sin(mid))}</g>`;
      a0 = a1;
    });
    if (r0 > 0) {
    const big = fmt(total);
    const fsz = clamp((r0 * 1.7) / Math.max(1, tw(big, 1)), 11, 24);
    inner += `<text class="lc-center" x="${n2(cx)}" y="${n2(cy + (spec.centerLabel ? 0 : fsz * 0.35))}" text-anchor="middle" style="font-size:${n2(fsz)}px">${esc(big)}</text>`;
    if (spec.centerLabel) inner += `<text class="lc-center-sub" x="${n2(cx)}" y="${n2(cy + 16)}" text-anchor="middle">${esc(truncate(spec.centerLabel, r0 * 1.7, 11))}</text>`;
    }
  }
  const missing = spec.slices.filter((s) => s.value === null).length;
  const desc = `${t.total} ${fmt(total)}. ` + spec.slices.map((s) => (s.value === null ? `${s.label}: ${t.na}` : `${s.label}: ${fmt(s.value)}${total > 0 ? ` (${n2((s.value / total) * 100)}%)` : ''}`)).join(', ') + (missing ? `. ${t.missing} ${missing}.` : '.');
  const lg = spec.legend === false ? '' : legend(spec.slices.map((s, i) => ({ name: s.label, idx: i, ...(s.color ? { color: s.color } : {}), ...(s.quality ? { quality: s.quality } : {}), extra: s.value === null ? t.na : `${fmt(s.value)}${total > 0 ? ` · ${n2((s.value / total) * 100)}%` : ''}` })));
  const tbl = wrapTable(spec.table ?? 'details', t, table(t, spec.title, [t.cat, t.value, t.share],
    spec.slices.map((s) => ({ th: `${s.label}${s.quality ? ` (${s.quality})` : ''}`, cells: s.value === null ? [null, null] : [fmt(s.value), total > 0 ? n2((s.value / total) * 100) + '%' : null] }))));
  return frame(ctx, spec, inner + pts, desc, lg, tbl);
}

