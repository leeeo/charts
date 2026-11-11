// Treemap: a hierarchy of up to two levels laid out with the squarified algorithm, so every leaf's area is
// proportional to its value. Top-level items are either leaves ({value}) or groups ({children}). Null leaves are
// missing: they get no area and are listed as missing in the table and description.
// Readability (0.8.0): a group tall enough carries a header strip with its name and total, cells print the name
// (wrapped to two lines when the cell is narrow but tall) and a bold value with its share, and hovering a cell keeps
// its group while the other groups fade (see treemap.css).
import type { BaseSpec, Value } from '../types.ts';
import { definePlugin } from '../plugin.ts';
import { BASE, MAX_POINTS, base, color, dict, fail, idList, optStr, str, value } from '../check.ts';
import { type Ctx, MAX_FOCUS, colorAttrs, empty, focusable, frame, legend, pct, table, wrapTable, wrapText } from '../kit.ts';
import { esc, makeFmt, n2, truncate, tw } from '../format.ts';

export interface TreemapLeaf { id: string; label: string; value: Value; color?: string; quality?: string }
export interface TreemapGroup { id: string; label: string; children: TreemapLeaf[]; color?: string; quality?: string }
export type TreemapItem = TreemapLeaf | TreemapGroup;
export interface TreemapSpec extends BaseSpec {
  type: 'treemap';
  /** Top-level items: a leaf has `value`, a group has `children` (leaves only). */
  items: TreemapItem[];
}

const MAX_TOP = 200;
const LFS = 11;
const LINE = LFS + 3;
/** Group header strip height; drawn only when the group is at least this tall four times over and 60px wide. */
const HEAD = LFS + 7;
const L = {
  ko: { group: '그룹', groups: '개 그룹', largest: '가장 큰 항목', smallest: '가장 작은 항목' },
  en: { group: 'Group', groups: ' groups', largest: 'Largest', smallest: 'Smallest' },
};

export const isGroup = (it: TreemapItem): it is TreemapGroup => 'children' in it;

interface Rect { x: number; y: number; w: number; h: number }

/**
 * Squarified layout: values (all > 0) are placed in `r` with areas proportional to value. Items are taken in
 * descending value order (ties by index) and returned in input order.
 */
export function squarify(vals: number[], r: Rect): Rect[] {
  const out: Rect[] = vals.map(() => ({ x: r.x, y: r.y, w: 0, h: 0 }));
  const total = vals.reduce((a, v) => a + v, 0);
  if (total <= 0 || r.w <= 0 || r.h <= 0) return out;
  const scale = (r.w * r.h) / total;
  const order = vals.map((v, i) => ({ a: v * scale, i })).sort((p, q) => q.a - p.a || p.i - q.i);
  let { x, y, w, h } = r;
  const worst = (row: number[], side: number): number => {
    const s = row.reduce((a, v) => a + v, 0);
    const mx = Math.max(...row); const mn = Math.min(...row);
    return Math.max((side * side * mx) / (s * s), (s * s) / (side * side * mn));
  };
  const place = (row: { a: number; i: number }[]): void => {
    const s = row.reduce((a, it) => a + it.a, 0);
    if (w >= h) {
      const cw = h > 0 ? s / h : 0;
      let yy = y;
      for (const it of row) { const ih = cw > 0 ? it.a / cw : 0; out[it.i] = { x, y: yy, w: cw, h: ih }; yy += ih; }
      x += cw; w -= cw;
    } else {
      const rh = w > 0 ? s / w : 0;
      let xx = x;
      for (const it of row) { const iw = rh > 0 ? it.a / rh : 0; out[it.i] = { x: xx, y, w: iw, h: rh }; xx += iw; }
      y += rh; h -= rh;
    }
  };
  let row: { a: number; i: number }[] = [];
  for (const it of order) {
    const side = Math.min(w, h);
    if (!row.length || worst([...row.map((p) => p.a), it.a], side) <= worst(row.map((p) => p.a), side)) row.push(it);
    else { place(row); row = [it]; }
  }
  if (row.length) place(row);
  return out;
}

function leaf(it: Record<string, unknown>, p: string, id: string): TreemapLeaf {
  const s: TreemapLeaf = { id, label: str(it.label, `${p}.label`, 60), value: value(it.value, `${p}.value`, 0) };
  const c = color(it.color, `${p}.color`);
  const q = optStr(it.quality, `${p}.quality`, 60);
  if (c !== undefined) s.color = c;
  if (q !== undefined) s.quality = q;
  return s;
}

export const plugin = definePlugin<TreemapSpec>({
  type: 'treemap',
  names: { ko: '트리맵', en: 'Treemap' },
  validate(input) {
    const o = dict(input, 'spec', [...BASE, 'items']);
    const out = base(o) as unknown as TreemapSpec;
    out.type = 'treemap';
    const seen = new Set<string>();
    let count = 0;
    const unique = (id: string, p: string): void => { if (seen.has(id)) fail(`${p}.id`, 'duplicate id'); seen.add(id); };
    out.items = idList(o.items, 'items', ['label', 'value', 'children', 'color', 'quality'], MAX_TOP, (it, p, id) => {
      unique(id, p);
      if (it.children === undefined) { count++; return leaf(it, p, id); }
      if (it.value !== undefined) fail(`${p}.value`, 'unknown property');
      const g: TreemapGroup = {
        id, label: str(it.label, `${p}.label`, 60),
        children: idList(it.children, `${p}.children`, ['label', 'value', 'color', 'quality'], MAX_POINTS, (c, cp, cid) => {
          unique(cid, cp);
          if (++count > MAX_POINTS) fail('items', `must have at most ${MAX_POINTS} entries`);
          return leaf(c, cp, cid);
        }),
      };
      const c = color(it.color, `${p}.color`);
      const q = optStr(it.quality, `${p}.quality`, 60);
      if (c !== undefined) g.color = c;
      if (q !== undefined) g.quality = q;
      return g;
    });
    return out;
  },
  height(_spec, width) {
    return width < 420 ? 300 : 380;
  },
  render(spec, ctx: Ctx) {
    const t = ctx.t;
    const L2 = L[ctx.lang];
    const items = spec.items;
    const leaves: { lf: TreemapLeaf; g: TreemapGroup | null; top: number }[] = [];
    items.forEach((it, top) => {
      if (isGroup(it)) for (const lf of it.children) leaves.push({ lf, g: it, top });
      else leaves.push({ lf: it, g: null, top });
    });
    const fmt = makeFmt(spec.unit, leaves.map((x) => x.lf.value));
    const sumOf = (it: TreemapItem): number | null => {
      const vs = (isGroup(it) ? it.children : [it]).map((c) => c.value).filter((v): v is number => v !== null);
      return vs.length ? vs.reduce((a, v) => a + v, 0) : null;
    };
    const topSums = items.map(sumOf);
    const total = topSums.reduce<number>((a, v) => a + (v ?? 0), 0);
    const share = (v: number): string => (total > 0 ? pct(v / total) : '–');
    const hasGroups = items.some(isGroup);

    const leafText = (x: (typeof leaves)[number]): string => {
      const { lf, g } = x;
      const name = g ? `${lf.label}, ${g.label}` : lf.label;
      const q = lf.quality ?? g?.quality;
      return `${name}: ${lf.value === null ? t.na : `${fmt(lf.value)} (${share(lf.value)})`}${q ? ` · ${q}` : ''}`;
    };

    let svg = '';
    if (total <= 0) svg = empty(ctx);
    else {
      const drawn = leaves.filter((x) => x.lf.value !== null && x.lf.value > 0).length;
      const canFocus = drawn <= MAX_FOCUS;
      const tops = items.map((_, i) => i).filter((i) => (topSums[i] ?? 0) > 0);
      const topRects = squarify(tops.map((i) => topSums[i] as number), { x: 0, y: 0, w: ctx.W, h: ctx.H });
      let marks = '';
      let labelsSvg = '';
      let outlines = '';
      tops.forEach((ti, k) => {
        const it = items[ti] as TreemapItem;
        const tr = topRects[k] as Rect;
        const kids = isGroup(it) ? it.children : [it];
        const live = kids.map((_, i) => i).filter((i) => { const v = kids[i]?.value; return v !== null && v !== undefined && v > 0; });
        // Group header: name and total on a strip above the cells (only when the group has room for it).
        const head = isGroup(it) && tr.h >= 4 * LFS + 8 && tr.w >= 60 ? HEAD : 0;
        const area: Rect = { x: tr.x, y: tr.y + head, w: tr.w, h: tr.h - head };
        const rects = isGroup(it) ? squarify(live.map((i) => kids[i]?.value as number), area) : [tr];
        let cells = '';
        live.forEach((ci, j) => {
          const lf = kids[ci] as TreemapLeaf;
          const r = rects[j] as Rect;
          const idx = leaves.findIndex((x) => x.lf === lf);
          const c = lf.color ?? it.color;
          const rect = `<rect class="lc-mark lc-tm ${colorAttrs(ti, c)} data-i="${idx}" data-v="${lf.value}" x="${n2(r.x)}" y="${n2(r.y)}" width="${n2(r.w)}" height="${n2(r.h)}"/>`;
          cells += canFocus ? focusable(ctx, 'lc-pt-tm', leafText(leaves[idx] as (typeof leaves)[number]), rect, r.x + r.w / 2, r.y + Math.min(r.h / 2, 44)) : rect;
          // Labels only where they fit: at least a few characters wide and one line tall. A name wider than the cell
          // wraps onto two lines when the cell is tall enough; the value line (bold, with the share) follows when it fits.
          const room = r.w - 8;
          if (r.h >= LFS + 8 && room >= tw('가…', LFS)) {
            const lines = tw(lf.label, LFS) <= room ? [lf.label] : r.h >= 3 * LINE + 10 ? wrapText(lf.label, room, LFS, 2) : [truncate(lf.label, room, LFS)];
            const x = n2(r.x + 4);
            labelsSvg += `<text class="lc-tm-lbl" x="${x}" y="${n2(r.y + 4 + LFS)}">${lines.map((l, q) => `<tspan x="${x}"${q ? ` dy="${LINE}"` : ''}>${esc(l)}</tspan>`).join('')}</text>`;
            const vy = r.y + 4 + LFS + lines.length * LINE + 1;
            const vt = fmt(lf.value as number);
            const vs = `${vt} · ${share(lf.value as number)}`;
            if (vy + 4 <= r.y + r.h && tw(vt, LFS) <= room) labelsSvg += `<text class="lc-tm-val" x="${x}" y="${n2(vy)}">${esc(tw(vs, LFS) <= room ? vs : vt)}</text>`;
          }
        });
        marks += `<g class="lc-tm-g">${cells}</g>`;
        if (head) {
          const sum = fmt(topSums[ti] as number);
          const room = tr.w - 8;
          const both = tw(it.label, LFS) + 6 + tw(sum, LFS) <= room;
          outlines += `<rect class="lc-tm-head" x="${n2(tr.x)}" y="${n2(tr.y)}" width="${n2(tr.w)}" height="${n2(head)}"/>`;
          labelsSvg += `<text class="lc-tm-glbl" x="${n2(tr.x + 4)}" y="${n2(tr.y + LFS + 2)}">${esc(both ? it.label : truncate(it.label, room, LFS))}${both ? `<tspan class="lc-tm-gval" dx="6">${esc(sum)}</tspan>` : ''}</text>`;
        }
        if (isGroup(it)) outlines += `<rect class="lc-tm-group" x="${n2(tr.x)}" y="${n2(tr.y)}" width="${n2(tr.w)}" height="${n2(tr.h)}"/>`;
      });
      svg = `<g class="lc-tm-marks">${marks}</g><g class="lc-tm-outlines" aria-hidden="true">${outlines}</g><g class="lc-tm-labels" aria-hidden="true">${labelsSvg}</g>`;
    }

    const present = leaves.filter((x) => x.lf.value !== null);
    const missing = leaves.length - present.length;
    const byV = [...present].sort((a, b) => (b.lf.value as number) - (a.lf.value as number));
    const big = byV[0]; const small = byV[byV.length - 1];
    const quals = [...new Set(items.flatMap((it) => [it.quality, ...(isGroup(it) ? it.children.map((c) => c.quality) : [])]).filter((q): q is string => !!q))];
    const groupsText = hasGroups
      ? ` ${items.filter(isGroup).length}${L2.groups}: ${items.map((it, i) => (isGroup(it) ? `${it.label} ${topSums[i] === null ? t.na : `${fmt(topSums[i] as number)} (${share(topSums[i] as number)})`}` : '')).filter(Boolean).join(', ')}.`
      : '';
    const desc = `${leaves.length}${t.items}. ${t.total} ${fmt(total)}.${groupsText}` +
      `${big ? ` ${L2.largest}: ${leafText(big)}.` : ''}${small && small !== big ? ` ${L2.smallest}: ${leafText(small)}.` : ''}` +
      `${missing ? ` ${t.missing} ${missing}.` : ''}${quals.length ? ` ${t.quality}: ${quals.join(', ')}.` : ''}`;

    const rows: { th: string; cells: (string | null)[] }[] = [];
    items.forEach((it, i) => {
      if (isGroup(it)) {
        const s = topSums[i] ?? null;
        rows.push({ th: `${it.label} · ${t.total}${it.quality ? ` (${it.quality})` : ''}`, cells: [s === null ? null : fmt(s), s === null ? null : share(s)] });
        for (const c of it.children) rows.push({ th: `${it.label} › ${c.label}${c.quality ? ` (${c.quality})` : ''}`, cells: [c.value === null ? null : fmt(c.value), c.value === null ? null : share(c.value)] });
      } else rows.push({ th: `${it.label}${it.quality ? ` (${it.quality})` : ''}`, cells: [it.value === null ? null : fmt(it.value), it.value === null ? null : share(it.value)] });
    });
    const tbl = table(t, spec.title, [t.cat, t.value, t.share], rows);
    const lg = hasGroups && spec.legend !== false && total > 0
      ? legend(items.map((it, i) => ({ name: it.label, idx: i, color: it.color, quality: it.quality, extra: topSums[i] === null ? t.na : fmt(topSums[i] as number) })))
      : '';
    return frame(ctx, spec, svg, desc, lg, wrapTable(spec.table ?? 'details', t, tbl));
  },
});
