// Shared label helpers for the comparison, distribution and time chart types (waffle, segmented, funnel, gauge,
// bullet, slope, bump, stream, scatter, bubble, box, histogram, heatmap, calendar, lollipop, dumbbell, waterfall,
// pareto, marimekko, radar, parallel, ridgeline, beeswarm, combo, timeline). Not a chart type itself.
// Labels follow the 0.7.0 sankey style: the name in ink with a surface halo, the value bold and tinted by the mark
// colour (class `lc-cm-val`, see cmp.css). Hover and focus rules live in cmp.css and each type's stylesheet.
import { esc, n2, truncate, tw } from '../format.ts';
import { type Ctx, tip } from '../kit.ts';

/** Name line font size. */
export const LBL = 12;
/** Value line font size (bold). */
export const VAL = 13;
/** Line pitch between the name and the value line. */
export const LINE = 15;

/** Width of a name + value block; the bold value line runs about 6% wider than the regular estimate. */
export const blockW = (name: string, value: string | null): number => Math.max(tw(name, LBL), value === null ? 0 : tw(value, VAL) * 1.06);

/**
 * Push label centres apart along one axis so that blocks of `size` (one number or one per label) never overlap,
 * keeping the input order and staying inside [lo, hi]. Returns the new centres in the input order.
 */
export function spread(centres: number[], size: number | number[], lo: number, hi: number, gap = 2): number[] {
  const sz = (i: number): number => (typeof size === 'number' ? size : size[i] ?? 0);
  const idx = centres.map((_, i) => i).sort((a, b) => (centres[a] as number) - (centres[b] as number) || a - b);
  const pos = idx.map((i) => centres[i] as number);
  let floor = lo;
  for (let k = 0; k < pos.length; k++) {
    const h = sz(idx[k] as number);
    pos[k] = Math.max(pos[k] as number, floor + h / 2);
    floor = (pos[k] as number) + h / 2 + gap;
  }
  let ceil = hi;
  for (let k = pos.length - 1; k >= 0; k--) {
    const h = sz(idx[k] as number);
    pos[k] = Math.min(pos[k] as number, ceil - h / 2);
    ceil = (pos[k] as number) - h / 2 - gap;
  }
  const out = centres.slice();
  idx.forEach((i, k) => { out[i] = pos[k] as number; });
  return out;
}

export type Anchor = 'start' | 'middle' | 'end';
const anchorAttr = (a: Anchor): string => (a === 'start' ? '' : ` text-anchor="${a}"`);

/**
 * Two-line label at (x, y = baseline of the name line): the name in ink, then the value bold and tinted through the
 * colour class tail `cls` (as returned by colorAttrs(); it closes the class quote itself). `room` truncates both lines.
 * With `value` null only the name line is drawn.
 */
export function nameValue(x: number, y: number, name: string, value: string | null, cls: string, anchor: Anchor, room = Infinity): string {
  const xs = n2(x);
  const nm = esc(truncate(name, room, LBL));
  const vl = value === null ? '' : `<tspan class="lc-cm-val" x="${xs}" dy="${LINE + 1}">${esc(truncate(value, room / 1.06, VAL))}</tspan>`;
  return `<text class="lc-cm-lbl ${cls} x="${xs}" y="${n2(y)}"${anchorAttr(anchor)}><tspan x="${xs}">${nm}</tspan>${vl}</text>`;
}

/** One bold value tinted by the mark colour (baseline at y). */
export function valueText(x: number, y: number, value: string, cls: string, anchor: Anchor, room = Infinity): string {
  return `<text class="lc-cm-lbl lc-cm-val ${cls} x="${n2(x)}" y="${n2(y)}"${anchorAttr(anchor)}>${esc(truncate(value, room / 1.06, VAL))}</text>`;
}

/** One line of plain ink text with the surface halo (baseline at y). */
export function inkText(x: number, y: number, text: string, anchor: Anchor, room = Infinity, extraCls = ''): string {
  return `<text class="lc-cm-lbl${extraCls ? ` ${extraCls}` : ''}" x="${n2(x)}" y="${n2(y)}"${anchorAttr(anchor)}>${esc(truncate(text, room, LBL))}</text>`;
}

/** Leader line from a mark edge to a displaced label (drawn only when the label moved more than 4 px). */
export function leader(x0: number, y0: number, x1: number, y1: number): string {
  return Math.abs(y1 - y0) > 4 || Math.abs(x1 - x0) > 4 ? `<path class="lc-cm-lead" d="M${n2(x0)},${n2(y0)}L${n2(x1)},${n2(y1)}"/>` : '';
}

/** Label layer: sits above the marks and fades while a value box is open (cmp.css). */
export const labelLayer = (inner: string): string => (inner ? `<g class="lc-cm-lbls" aria-hidden="true">${inner}</g>` : '');

/**
 * Focusable mark group like kit.focusable(), plus `data-s` (series index) so the stylesheet can keep one series lit
 * while the others fade (see the per-type hover rules).
 */
export function seriesPt(ctx: Ctx, cls: string, s: number, label: string, inner: string, ax: number, ay: number): string {
  return `<g class="lc-pt ${cls}" tabindex="0" aria-label="${esc(label)}" data-s="${s}">${inner}${tip(ctx, label, ax, ay)}</g>`;
}
