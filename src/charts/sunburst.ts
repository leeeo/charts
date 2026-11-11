// Sunburst: a radial hierarchy of up to three levels. The inner ring is level 1; every node's angle is its share of
// the grand total (sum of present leaves), and children split their parent's angle. Leaves carry `value`, groups carry
// `children`. Null leaves are missing: no arc, listed as missing in the table and description.
// Labels (0.8.0): the name runs along the arc (curved, with the bold value on a second curved line when the ring is
// wide enough); a leaf whose arc is too short for its name gets a label outside the circle (name + bold value) with a
// leader line, stacked per side so labels never overlap. Hovering an arc keeps its whole branch and fades the rest.
import type { BaseSpec, Value } from '../types.ts';
import { definePlugin } from '../plugin.ts';
import { BASE, MAX_POINTS, base, color, dict, fail, idList, optStr, str, value } from '../check.ts';
import { type Ctx, FS, MAX_FOCUS, colorAttrs, empty, focusable, frame, legend, pct, table, wrapTable } from '../kit.ts';
import { esc, makeFmt, n2, truncate, tw } from '../format.ts';

export interface SunburstNode { id: string; label: string; value?: Value; children?: SunburstNode[]; color?: string; quality?: string }
export interface SunburstSpec extends BaseSpec {
  type: 'sunburst';
  /** Level-1 nodes. A leaf has `value` (>= 0 or null); a group has `children` (at most 3 levels in total). */
  items: SunburstNode[];
  /** Text above the total in the centre (default "합계"). */
  centerLabel?: string;
}

const MAX_DEPTH = 3;
const MAX_TOP = 200;
const LFS = 11;
const VFS = 13;
const LINE = 15;
/** Branch hover rules exist in sunburst.css for this many top-level items. */
export const BRANCH_RULES = 24;
const L = {
  ko: { leaves: '개 말단 항목', largest: '가장 큰 항목', level: '단계' },
  en: { leaves: ' leaves', largest: 'Largest', level: 'Level' },
};

interface Flat { node: SunburstNode; depth: number; top: number; parents: string[]; sum: number | null; a0: number; a1: number }

/** Annular sector path (angles in radians, 0 = 12 o'clock, clockwise). A full turn is drawn as two rings (evenodd). */
export function arcPath(cx: number, cy: number, ri: number, ro: number, a0: number, a1: number): string {
  const P = (r: number, a: number): string => `${n2(cx + r * Math.sin(a))} ${n2(cy - r * Math.cos(a))}`;
  if (a1 - a0 >= 2 * Math.PI - 1e-9) {
    const ring = (r: number): string => `M${P(r, 0)}A${n2(r)} ${n2(r)} 0 1 1 ${P(r, Math.PI)}A${n2(r)} ${n2(r)} 0 1 1 ${P(r, 0)}Z`;
    return ring(ro) + (ri > 0 ? ring(ri) : '');
  }
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const inner = ri > 0 ? `L${P(ri, a1)}A${n2(ri)} ${n2(ri)} 0 ${large} 0 ${P(ri, a0)}` : `L${n2(cx)} ${n2(cy)}`;
  return `M${P(ro, a0)}A${n2(ro)} ${n2(ro)} 0 ${large} 1 ${P(ro, a1)}${inner}Z`;
}

/** Open arc at radius r from a0 to a1 (clockwise); `flip` runs it the other way so text along it reads left to right. */
function arcLine(cx: number, cy: number, r: number, a0: number, a1: number, flip: boolean): string {
  const P = (a: number): string => `${n2(cx + r * Math.sin(a))} ${n2(cy - r * Math.cos(a))}`;
  const mid = (a0 + a1) / 2;
  const seg = (to: number): string => `A${n2(r)} ${n2(r)} 0 0 ${flip ? 0 : 1} ${P(to)}`;
  // Two arcs so a span above 180 degrees (or a full turn) stays a valid path.
  return flip ? `M${P(a1)}${seg(mid)}${seg(a0)}` : `M${P(a0)}${seg(mid)}${seg(a1)}`;
}

function flatten(items: SunburstNode[]): Flat[] {
  const out: Flat[] = [];
  const walk = (n: SunburstNode, depth: number, top: number, parents: string[]): number | null => {
    const f: Flat = { node: n, depth, top, parents, sum: null, a0: 0, a1: 0 };
    out.push(f);
    if (n.children) {
      const sums = n.children.map((c) => walk(c, depth + 1, top, [...parents, n.label]));
      const vs = sums.filter((v): v is number => v !== null);
      f.sum = vs.length ? vs.reduce((a, v) => a + v, 0) : null;
    } else f.sum = n.value ?? null;
    return f.sum;
  };
  items.forEach((it, i) => walk(it, 1, i, []));
  return out;
}

export const plugin = definePlugin<SunburstSpec>({
  type: 'sunburst',
  names: { ko: '선버스트', en: 'Sunburst' },
  validate(input) {
    const o = dict(input, 'spec', [...BASE, 'items', 'centerLabel']);
    const out = base(o) as unknown as SunburstSpec;
    out.type = 'sunburst';
    const seen = new Set<string>();
    let count = 0;
    const node = (it: Record<string, unknown>, p: string, id: string, depth: number): SunburstNode => {
      if (seen.has(id)) fail(`${p}.id`, 'duplicate id');
      seen.add(id);
      if (++count > MAX_POINTS) fail('items', `must have at most ${MAX_POINTS} entries`);
      const n: SunburstNode = { id, label: str(it.label, `${p}.label`, 60) };
      if (it.children !== undefined) {
        if (depth >= MAX_DEPTH) fail(`${p}.children`, 'unknown property');
        if (it.value !== undefined) fail(`${p}.value`, 'unknown property');
        n.children = idList(it.children, `${p}.children`, ['label', 'value', 'children', 'color', 'quality'], MAX_POINTS, (c, cp, cid) => node(c, cp, cid, depth + 1));
      } else n.value = value(it.value, `${p}.value`, 0);
      const c = color(it.color, `${p}.color`);
      const q = optStr(it.quality, `${p}.quality`, 60);
      if (c !== undefined) n.color = c;
      if (q !== undefined) n.quality = q;
      return n;
    };
    out.items = idList(o.items, 'items', ['label', 'value', 'children', 'color', 'quality'], MAX_TOP, (it, p, id) => node(it, p, id, 1));
    const cl = optStr(o.centerLabel, 'centerLabel', 30);
    if (cl !== undefined) out.centerLabel = cl;
    return out;
  },
  height(_spec, width) {
    return width < 420 ? 320 : 400;
  },
  render(spec, ctx: Ctx) {
    const t = ctx.t;
    const L2 = L[ctx.lang];
    const flat = flatten(spec.items);
    const leaves = flat.filter((f) => !f.node.children);
    const fmt = makeFmt(spec.unit, leaves.map((f) => f.sum));
    const tops = flat.filter((f) => f.depth === 1);
    const total = tops.reduce((a, f) => a + (f.sum ?? 0), 0);
    const share = (v: number): string => (total > 0 ? pct(v / total) : '–');
    const qOf = (f: Flat): string | undefined => f.node.quality ?? spec.items[f.top]?.quality;
    const text = (f: Flat): string =>
      `${f.node.label}${f.parents.length ? `, ${f.parents.join(' › ')}` : ''}: ${f.sum === null ? t.na : `${fmt(f.sum)} (${share(f.sum)})`}${qOf(f) ? ` · ${qOf(f)}` : ''}`;

    let svg = '';
    if (total <= 0) svg = empty(ctx);
    else {
      // Angles: walk the hierarchy again and split each parent's span by child sums.
      let k = 0;
      const assign = (a0: number, a1: number, siblings: SunburstNode[], parentSum: number): void => {
        let a = a0;
        for (const n of siblings) {
          const f = flat[k++] as Flat;
          const span = parentSum > 0 && f.sum !== null ? ((a1 - a0) * f.sum) / parentSum : 0;
          f.a0 = a; f.a1 = a + span; a += span;
          if (n.children) assign(f.a0, f.a1, n.children, f.sum ?? 0);
        }
      };
      assign(0, 2 * Math.PI, spec.items, total);
      const depth = Math.max(...flat.map((f) => f.depth));
      const cy = ctx.H / 2;
      const drawn = flat.filter((f) => f.sum !== null && f.sum > 0);
      const canFocus = drawn.length <= MAX_FOCUS;
      const val = (f: Flat): string => fmt(f.sum as number);
      // Geometry for a radius R: the inner hole is 26% of R and every level gets the same ring width.
      const ringOf = (R: number, f: Flat): { ri: number; ro: number; rm: number; rw: number } => {
        const r0 = R * 0.26; const rw = (R - r0) / depth;
        const ri = r0 + (f.depth - 1) * rw;
        return { ri, ro: ri + rw, rm: ri + rw / 2, rw };
      };
      // A name fits along its arc when the arc at the ring's middle radius is longer than the text.
      const fitsAlong = (R: number, f: Flat): boolean => { const g = ringOf(R, f); return (f.a1 - f.a0) * g.rm >= tw(f.node.label, LFS) + 8 && g.rw >= LFS + 6; };
      // Leaves whose name does not fit along the arc get a label outside the circle; the circle shrinks and shifts to
      // leave a gutter on the side(s) that need one (at most 28% of the width each). Up to three passes: a smaller
      // circle can make more leaves need an outside label.
      const BLOCK = LFS + LINE + 2;
      const blockW = (f: Flat): number => Math.max(tw(f.node.label, LFS), tw(val(f), VFS) * 1.06);
      const onRight = (f: Flat): boolean => Math.sin((f.a0 + f.a1) / 2) >= 0;
      let R = Math.min(ctx.W, ctx.H) / 2 - 4;
      let gL = 0; let gR = 0;
      let outside = drawn.filter((f) => !f.node.children && !fitsAlong(R, f));
      for (let pass = 0; pass < 3 && outside.length; pass++) {
        const g = (right: boolean): number => { const w = outside.filter((f) => onRight(f) === right).map(blockW); return w.length ? Math.min(ctx.W * 0.28, Math.max(...w)) + 12 : 0; };
        const nL = Math.max(gL, g(false)); const nR = Math.max(gR, g(true));
        if (nL === gL && nR === gR) break;
        gL = nL; gR = nR;
        R = Math.min((ctx.W - gL - gR) / 2, ctx.H / 2) - 4;
        outside = drawn.filter((f) => !f.node.children && !fitsAlong(R, f));
      }
      const cx = gL + (ctx.W - gL - gR) / 2;
      let marks = '';
      let labels = '';
      let defs = '';
      const spots: { f: Flat; x: number; y: number; right: boolean }[] = [];
      for (const f of drawn) {
        const i = flat.indexOf(f);
        const { ri, ro, rm, rw } = ringOf(R, f);
        const top = spec.items[f.top] as SunburstNode;
        const d = arcPath(cx, cy, ri, ro, f.a0, f.a1);
        // data-b is the branch (top-level index): the stylesheet keeps a hovered arc's whole branch visible.
        const path = `<path class="lc-mark lc-sb lc-sb-d${f.depth} ${colorAttrs(f.top, f.node.color ?? top.color)} data-i="${i}" data-d="${f.depth}" data-b="${f.top}" data-v="${f.sum}" fill-rule="evenodd" d="${d}"/>`;
        const am = (f.a0 + f.a1) / 2;
        const ax = cx + rm * Math.sin(am); const ay = cy - rm * Math.cos(am);
        marks += canFocus ? focusable(ctx, 'lc-pt-sb', text(f), path, ax, ay) : path;
        if (outside.includes(f)) { spots.push({ f, x: cx + (ro + 1) * Math.sin(am), y: cy - (ro + 1) * Math.cos(am), right: Math.sin(am) >= 0 }); continue; }
        if (!fitsAlong(R, f)) continue;
        // Curved label: the name along the ring's middle, the bold value on a second line when the ring is wide enough.
        // In the lower half the path runs the other way so the text stays upright and reads left to right.
        const flip = am > Math.PI / 2 && am < 1.5 * Math.PI;
        const two = rw >= 2 * LFS + 10 && (f.a1 - f.a0) * rm >= tw(val(f), VFS) + 8;
        const id = `${ctx.pid}-sb${i}`;
        const line = (r: number, k: string, cls: string, s: string): string => {
          defs += `<path id="${id}${k}" d="${arcLine(cx, cy, r, f.a0, f.a1, flip)}"/>`;
          return `<text class="${cls} ${colorAttrs(f.top, f.node.color ?? top.color)}><textPath href="#${id}${k}" startOffset="50%" text-anchor="middle">${esc(s)}</textPath></text>`;
        };
        if (two) {
          labels += line(flip ? rm - 1 : rm + 1, 'n', 'lc-sb-lbl', f.node.label);
          labels += line(flip ? rm + 1 + VFS * 0.8 : rm - 1 - VFS * 0.8, 'v', 'lc-sb-val', val(f));
        } else labels += line(flip ? rm + LFS * 0.36 : rm - LFS * 0.36, 'n', 'lc-sb-lbl', f.node.label);
      }
      // Outside labels: name, then the bold value; stacked per side so they never overlap, with a leader to the arc.
      const side = (right: boolean): void => {
        const list = spots.filter((s) => s.right === right).map((s) => ({ s, top: s.y - BLOCK / 2 })).sort((a, b) => a.top - b.top);
        let floor = 2;
        for (const it of list) { it.top = Math.max(it.top, floor); floor = it.top + BLOCK + 2; }
        let ceil = ctx.H - 2;
        for (let j = list.length - 1; j >= 0; j--) { const it = list[j] as (typeof list)[number]; it.top = Math.min(it.top, ceil - BLOCK); ceil = it.top - 2; }
        // Half a pixel of slack so a name that set the gutter width is never cut by rounding.
        const room = Math.max((right ? gR : gL) - 11.5, tw('가…', LFS));
        for (const { s, top } of list) {
          const lx = right ? cx + R + 10 : cx - R - 10;
          const x = n2(lx);
          const tp = spec.items[s.f.top] as SunburstNode;
          labels += `<text class="lc-sb-out ${colorAttrs(s.f.top, s.f.node.color ?? tp.color)} x="${x}" y="${n2(top + LFS)}"${right ? '' : ' text-anchor="end"'}><tspan x="${x}">${esc(truncate(s.f.node.label, room, LFS))}</tspan><tspan class="lc-sb-val" x="${x}" dy="${LINE}">${esc(truncate(val(s.f), room, VFS))}</tspan></text>`;
          labels += `<path class="lc-sb-lead" d="M${n2(s.x)},${n2(s.y)}L${n2(lx + (right ? -3 : 3))},${n2(top + BLOCK / 2)}"/>`;
        }
      };
      side(false); side(true);
      const r0 = R * 0.26;
      let center = '';
      const tt = fmt(total);
      if (tw(tt, FS + 2) <= 2 * r0 - 10) {
        const cl = truncate(spec.centerLabel ?? t.total, 2 * r0 - 10, FS);
        center = `<text class="lc-sb-cl" x="${n2(cx)}" y="${n2(cy - 4)}" text-anchor="middle">${esc(cl)}</text><text class="lc-sb-ct" x="${n2(cx)}" y="${n2(cy + FS + 2)}" text-anchor="middle">${esc(tt)}</text>`;
      }
      svg = `${defs ? `<defs>${defs}</defs>` : ''}<g class="lc-sb-marks">${marks}</g><g class="lc-sb-labels" aria-hidden="true">${labels}${center}</g>`;
    }

    const missing = leaves.filter((f) => f.sum === null).length;
    const big = leaves.filter((f) => f.sum !== null).sort((a, b) => (b.sum as number) - (a.sum as number))[0];
    const quals = [...new Set(flat.map((f) => f.node.quality).filter((q): q is string => !!q))];
    const desc = `${leaves.length}${L2.leaves}. ${t.total} ${fmt(total)}. ` +
      tops.map((f) => `${f.node.label} ${f.sum === null ? t.na : `${fmt(f.sum)} (${share(f.sum)})`}`).join(', ') + '.' +
      (big ? ` ${L2.largest}: ${text(big)}.` : '') + (missing ? ` ${t.missing} ${missing}.` : '') + (quals.length ? ` ${t.quality}: ${quals.join(', ')}.` : '');
    const tbl = table(t, spec.title, [t.cat, L2.level, t.value, t.share], flat.map((f) => ({
      th: `${[...f.parents, f.node.label].join(' › ')}${f.node.quality ? ` (${f.node.quality})` : ''}`,
      cells: [String(f.depth), f.sum === null ? null : fmt(f.sum), f.sum === null ? null : share(f.sum)],
    })));
    const lg = spec.legend !== false && total > 0 && tops.length > 1
      ? legend(tops.map((f) => ({ name: f.node.label, idx: f.top, color: f.node.color, quality: f.node.quality, extra: f.sum === null ? t.na : fmt(f.sum) })))
      : '';
    return frame(ctx, spec, svg, desc, lg, wrapTable(spec.table ?? 'details', t, tbl));
  },
});
