// Sankey: nodes in columns by longest path from a source, links drawn as bands whose thickness is proportional to
// the flow value. The graph must be acyclic. A null link value is missing: it keeps its place in the layout
// structure but is not drawn, and is listed as missing in the table and description.
// Optional semantics (0.5.0): `tone` colours a node or link by meaning (revenue / profit / cost / neutral; cost is also
// hatched so it does not rely on colour alone), `computed` marks a derived node with '*' and a legend note,
// `align: "justify"` puts every end node in the last column and `relax` moves nodes towards their bands to cut
// crossings. Inside each column nodes are reordered to reduce band crossings (`order: "auto"`, default since 0.7.0);
// `order: "input"` keeps the spec order top to bottom. Auto ordering only moves a node when crossings strictly drop.
import type { BaseSpec, Value } from '../types.ts';
import { definePlugin } from '../plugin.ts';
import { BASE, base, color, dict, fail, idList, oneOf, optBool, optStr, str, value } from '../check.ts';
import { type Ctx, MAX_FOCUS, colorAttrs, empty, focusable, frame, pct, table, wrapTable } from '../kit.ts';
import { esc, makeFmt, n2, truncate, tw } from '../format.ts';

export type SankeyTone = 'revenue' | 'profit' | 'cost' | 'neutral';
export interface SankeyNode { id: string; label: string; color?: string; quality?: string; tone?: SankeyTone; computed?: boolean }
export interface SankeyLink { source: string; target: string; value: Value; quality?: string; tone?: SankeyTone }
export interface SankeySpec extends BaseSpec {
  type: 'sankey';
  nodes: SankeyNode[];
  links: SankeyLink[];
  /** "left" (default): column = longest path from a source. "justify": nodes without outgoing links go to the last column. */
  align?: 'left' | 'justify';
  /** Move nodes towards the bands they connect to (the order inside a column is kept). Default false. */
  relax?: boolean;
  /** "auto" (default): reorder nodes inside a column when that strictly reduces band crossings. "input": spec order. */
  order?: 'auto' | 'input';
  /** Legend text for nodes marked `computed` (shown after '*'). */
  computedNote?: string;
}

const TONES = ['revenue', 'profit', 'cost', 'neutral'] as const;

const MAX_NODES = 100;
const MAX_LINKS = 500;
const NODE_W = 12;
const PAD_Y = 8;
const GAP = 10;
const FS = 12;
const VAL_FS = 13;
const LINE = 15;
// Auto ordering compares every pair of bands; above this many drawn links the spec order is kept.
const AUTO_MAX_LINKS = 120;
const AUTO_MAX_EVALS = 600;
const L = {
  ko: { nodes: '노드', links: '링크', flow: '총 흐름', largest: '가장 큰 흐름', inflow: '유입', outflow: '유출', ofSource: '출발 노드 유출 대비', count: '개',
    tone: { revenue: '매출', profit: '이익', cost: '비용·손실', neutral: '기타' }, hatched: '빗금', computed: '계산값' },
  en: { nodes: 'nodes', links: 'links', flow: 'Total flow', largest: 'Largest flow', inflow: 'In', outflow: 'Out', ofSource: 'Share of source outflow', count: '',
    tone: { revenue: 'Revenue', profit: 'Profit', cost: 'Cost or loss', neutral: 'Other' }, hatched: 'hatched', computed: 'Computed' },
};

/**
 * Column of each node = length of the longest path reaching it from a node with no inbound links.
 * With `justify`, nodes that have no outgoing links are moved to the last column.
 */
export function columns(nodeCount: number, links: { s: number; t: number }[], justify = false): number[] {
  const col = new Array<number>(nodeCount).fill(0);
  const indeg = new Array<number>(nodeCount).fill(0);
  const out: number[][] = Array.from({ length: nodeCount }, () => []);
  for (const l of links) { out[l.s]?.push(l.t); indeg[l.t] = (indeg[l.t] ?? 0) + 1; }
  const queue = col.map((_, i) => i).filter((i) => indeg[i] === 0);
  for (let q = 0; q < queue.length; q++) {
    const u = queue[q] as number;
    for (const v of out[u] ?? []) {
      col[v] = Math.max(col[v] ?? 0, (col[u] ?? 0) + 1);
      indeg[v] = (indeg[v] ?? 0) - 1;
      if (indeg[v] === 0) queue.push(v);
    }
  }
  if (justify) {
    const last = Math.max(0, ...col);
    const hasOut = new Set(links.map((l) => l.s));
    const hasIn = new Set(links.map((l) => l.t));
    col.forEach((_, i) => { if (!hasOut.has(i) && hasIn.has(i)) col[i] = last; });
  }
  return col;
}

export const plugin = definePlugin<SankeySpec>({
  type: 'sankey',
  names: { ko: '생키 다이어그램', en: 'Sankey diagram' },
  defaultWidth: 720,
  validate(input) {
    const o = dict(input, 'spec', [...BASE, 'nodes', 'links', 'align', 'relax', 'order', 'computedNote']);
    const out = base(o) as unknown as SankeySpec;
    out.type = 'sankey';
    out.nodes = idList(o.nodes, 'nodes', ['label', 'color', 'quality', 'tone', 'computed'], MAX_NODES, (it, p, id) => {
      const n: SankeyNode = { id, label: str(it.label, `${p}.label`, 60) };
      const c = color(it.color, `${p}.color`);
      const q = optStr(it.quality, `${p}.quality`, 60);
      const tone = oneOf(it.tone, `${p}.tone`, TONES);
      const computed = optBool(it.computed, `${p}.computed`);
      if (c !== undefined) n.color = c;
      if (q !== undefined) n.quality = q;
      if (tone !== undefined) n.tone = tone;
      if (computed !== undefined) n.computed = computed;
      return n;
    });
    const align = oneOf(o.align, 'align', ['left', 'justify'] as const);
    const relax = optBool(o.relax, 'relax');
    const order = oneOf(o.order, 'order', ['auto', 'input'] as const);
    const note = optStr(o.computedNote, 'computedNote', 60);
    if (align !== undefined) out.align = align;
    if (relax !== undefined) out.relax = relax;
    if (order !== undefined) out.order = order;
    if (note !== undefined) out.computedNote = note;
    const index = new Map(out.nodes.map((n, i) => [n.id, i]));
    if (!Array.isArray(o.links) || o.links.length === 0) fail('links', 'must be a non-empty array');
    if (o.links.length > MAX_LINKS) fail('links', `must have at most ${MAX_LINKS} entries`);
    // Adjacency built incrementally so the link that closes a cycle is the one reported.
    const adj: number[][] = out.nodes.map(() => []);
    const reaches = (from: number, to: number): boolean => {
      const seen = new Set<number>([from]);
      const stack = [from];
      while (stack.length) {
        const u = stack.pop() as number;
        if (u === to) return true;
        for (const v of adj[u] ?? []) if (!seen.has(v)) { seen.add(v); stack.push(v); }
      }
      return false;
    };
    out.links = (o.links as unknown[]).map((item, i) => {
      const p = `links[${i}]`;
      const it = dict(item, p, ['source', 'target', 'value', 'quality', 'tone']);
      const source = str(it.source, `${p}.source`, 64);
      const target = str(it.target, `${p}.target`, 64);
      const s = index.get(source); const t = index.get(target);
      if (s === undefined) fail(`${p}.source`, 'must be the id of a node');
      if (t === undefined) fail(`${p}.target`, 'must be the id of a node');
      if (s === t || reaches(t, s)) fail(p, 'would create a cycle');
      adj[s]?.push(t);
      const l: SankeyLink = { source, target, value: value(it.value, `${p}.value`, 0) };
      const q = optStr(it.quality, `${p}.quality`, 60);
      const tone = oneOf(it.tone, `${p}.tone`, TONES);
      if (q !== undefined) l.quality = q;
      if (tone !== undefined) l.tone = tone;
      return l;
    });
    return out;
  },
  height(spec) {
    const index = new Map(spec.nodes.map((n, i) => [n.id, i]));
    const col = columns(spec.nodes.length, spec.links.map((l) => ({ s: index.get(l.source) as number, t: index.get(l.target) as number })), spec.align === 'justify');
    const per = new Map<number, number>();
    for (const c of col) per.set(c, (per.get(c) ?? 0) + 1);
    return Math.min(720, Math.max(240, Math.max(...per.values()) * 44 + 2 * PAD_Y));
  },
  render(spec, ctx: Ctx) {
    const t = ctx.t;
    const L2 = L[ctx.lang];
    const nodes = spec.nodes;
    const index = new Map(nodes.map((n, i) => [n.id, i]));
    const links = spec.links.map((l, i) => ({ l, i, s: index.get(l.source) as number, t: index.get(l.target) as number }));
    const fmt = makeFmt(spec.unit, spec.links.map((l) => l.value));
    const inSum = nodes.map(() => 0); const outSum = nodes.map(() => 0);
    const inKnown = nodes.map(() => false); const outKnown = nodes.map(() => false);
    for (const x of links) {
      if (x.l.value === null) continue;
      outSum[x.s] = (outSum[x.s] ?? 0) + x.l.value; outKnown[x.s] = true;
      inSum[x.t] = (inSum[x.t] ?? 0) + x.l.value; inKnown[x.t] = true;
    }
    const nodeV = nodes.map((_, i) => Math.max(inSum[i] ?? 0, outSum[i] ?? 0));
    const col = columns(nodes.length, links, spec.align === 'justify');
    const C = Math.max(...col) + 1;
    const hasIn = nodes.map((_, i) => links.some((x) => x.t === i));
    const sources = nodes.map((_, i) => i).filter((i) => !hasIn[i]);
    const totalFlow = sources.reduce((a, i) => a + (outSum[i] ?? 0), 0);
    // Visible label: computed nodes carry '*', explained in the legend.
    const name = (i: number): string => `${nodes[i]?.label ?? ''}${nodes[i]?.computed ? '*' : ''}`;
    const note = spec.computedNote ?? L2.computed;
    // Colour precedence: explicit color > tone > palette. A link without its own tone follows its source node.
    const nodeTone = (i: number): SankeyTone | undefined => (nodes[i]?.color ? undefined : nodes[i]?.tone);
    const linkTone = (x: (typeof links)[number]): SankeyTone | undefined => x.l.tone ?? nodeTone(x.s);
    const toneCls = (tone: SankeyTone | undefined, i: number, c?: string): string => (tone ? `lc-tone-${tone}"` : colorAttrs(i, c));
    const hatchId = `${ctx.pid}-hatch`;
    // Cost / loss marks get a hatch overlay (geometry attributes only) so the meaning does not rely on colour alone.
    const hatch = (tone: SankeyTone | undefined, tag: 'path' | 'rect', geometry: string): string => (tone === 'cost' ? `<${tag} class="lc-sk-hatch" fill="url(#${hatchId})" ${geometry}/>` : '');
    const ofSource = (x: (typeof links)[number]): number | null => (x.l.value === null || !(outSum[x.s] ?? 0) ? null : x.l.value / (outSum[x.s] as number));
    const linkText = (x: (typeof links)[number]): string => {
      const sh = ofSource(x);
      return `${name(x.s)} → ${name(x.t)}: ${x.l.value === null ? t.na : fmt(x.l.value)}${sh !== null ? ` (${pct(sh)})` : ''}${x.l.quality ? ` · ${x.l.quality}` : ''}`;
    };
    const nodeText = (i: number): string => {
      const n = nodes[i] as SankeyNode;
      const parts = [hasIn[i] ? `${L2.inflow} ${inKnown[i] ? fmt(inSum[i] as number) : t.na}` : '', links.some((x) => x.s === i) ? `${L2.outflow} ${outKnown[i] ? fmt(outSum[i] as number) : t.na}` : ''].filter(Boolean);
      const tone = nodeTone(i);
      return `${name(i)}: ${parts.join(' · ')}${tone ? ` · ${L2.tone[tone]}` : ''}${n.computed ? ` · ${note}` : ''}${n.quality ? ` · ${n.quality}` : ''}`;
    };

    let svg = '';
    const drawnLinks = links.filter((x) => x.l.value !== null && x.l.value > 0);
    if (!drawnLinks.length) svg = empty(ctx);
    else {
      // Vertical scale: the fullest column fills the height; every column shares it so bands stay proportional.
      const byCol: number[][] = Array.from({ length: C }, () => []);
      nodes.forEach((_, i) => { if ((nodeV[i] ?? 0) > 0) byCol[col[i] as number]?.push(i); });
      const avail = ctx.H - 2 * PAD_Y;
      const k = Math.min(...byCol.filter((c) => c.length).map((c) => (avail - GAP * (c.length - 1)) / c.reduce((a, i) => a + (nodeV[i] ?? 0), 0)));
      // Labels live outside the bands (first column left, last column right), so the plot is inset by the widest
      // label block of those columns (name line or bold value line), each capped at 28% of the width.
      const blockW = (i: number): number => Math.max(tw(name(i), FS), tw(fmt(nodeV[i] as number), VAL_FS) * 1.06);
      const capW = ctx.W * (C > 1 ? 0.28 : 0.5);
      const sideW = (c: number): number => Math.min(capW, Math.max(0, ...(byCol[c] ?? []).map(blockW)));
      const leftW = C > 1 ? sideW(0) + 10 : 0;
      const rightW = sideW(C - 1) + 10;
      const x0 = 4 + leftW;
      const colGap = C > 1 ? (ctx.W - 4 - rightW - x0 - NODE_W) / (C - 1) : 0;
      const nx = (c: number): number => x0 + c * colGap;
      const ny = nodes.map(() => 0);
      const nh = nodes.map((_, i) => (nodeV[i] ?? 0) * k);
      const stack = (): void => {
        for (const c of byCol) {
          const used = c.reduce((a, i) => a + (nh[i] ?? 0), 0) + GAP * Math.max(0, c.length - 1);
          let y = PAD_Y + (avail - used) / 2;
          for (const i of c) { ny[i] = y; y += (nh[i] ?? 0) + GAP; }
        }
      };
      stack();
      if ((spec.order ?? 'auto') === 'auto' && drawnLinks.length <= AUTO_MAX_LINKS) {
        const bands = drawnLinks.map((x) => ({ i: x.i, s: x.s, t: x.t, h: (x.l.value as number) * k }));
        const left = nodes.map((_, i) => nx(col[i] as number));
        orderNodes(byCol, stack, () => crossingCost(bands, ny, left));
      }
      if (spec.relax) relaxNodes(byCol, drawnLinks.map((x) => ({ i: x.i, s: x.s, t: x.t, h: (x.l.value as number) * k })), ny, nh, ctx.H);
      const canFocus = drawnLinks.length + byCol.flat().length <= MAX_FOCUS;
      // Band offsets: outgoing links stacked by target position, incoming by source position.
      const sOff = nodes.map(() => 0); const tOff = nodes.map(() => 0);
      const y0 = new Map<number, number>(); const y1 = new Map<number, number>();
      for (const x of [...drawnLinks].sort((a, b) => (ny[a.t] as number) - (ny[b.t] as number) || a.i - b.i)) { y0.set(x.i, (ny[x.s] as number) + (sOff[x.s] as number)); sOff[x.s] = (sOff[x.s] as number) + (x.l.value as number) * k; }
      for (const x of [...drawnLinks].sort((a, b) => (ny[a.s] as number) - (ny[b.s] as number) || a.i - b.i)) { y1.set(x.i, (ny[x.t] as number) + (tOff[x.t] as number)); tOff[x.t] = (tOff[x.t] as number) + (x.l.value as number) * k; }
      let linkSvg = '';
      for (const x of drawnLinks) {
        const th = (x.l.value as number) * k;
        const xa = nx(col[x.s] as number) + NODE_W; const xb = nx(col[x.t] as number);
        const ya = y0.get(x.i) as number; const yb = y1.get(x.i) as number;
        const xm = (xa + xb) / 2;
        const d = `M${n2(xa)},${n2(ya)}C${n2(xm)},${n2(ya)} ${n2(xm)},${n2(yb)} ${n2(xb)},${n2(yb)}L${n2(xb)},${n2(yb + th)}C${n2(xm)},${n2(yb + th)} ${n2(xm)},${n2(ya + th)} ${n2(xa)},${n2(ya + th)}Z`;
        const n = nodes[x.s] as SankeyNode;
        const tone = linkTone(x);
        // data-s / data-t let the stylesheet light up a node's bands on hover (see sankey.css).
        const ends = `data-s="${x.s}" data-t="${x.t}"`;
        const path = `<path class="lc-mark lc-link ${toneCls(tone, x.s, n.color)} data-i="${x.i}" data-v="${x.l.value}" ${ends} d="${d}"/>`;
        const shape = path + hatch(tone, 'path', `${ends} d="${d}"`);
        linkSvg += canFocus ? focusable(ctx, 'lc-pt-link', linkText(x), shape, xm, (ya + yb) / 2 + th / 2) : shape;
      }
      let nodeSvg = '';
      let labelSvg = '';
      const spots: { i: number; c: number; x: number; y: number; h: number }[] = [];
      for (const i of byCol.flat()) {
        const n = nodes[i] as SankeyNode;
        const c = col[i] as number;
        const x = nx(c); const y = ny[i] as number; const h = Math.max(1, nh[i] as number);
        const rect = `<rect class="lc-mark lc-node ${toneCls(nodeTone(i), i, n.color)} data-i="${i}" data-v="${nodeV[i]}" x="${n2(x)}" y="${n2(y)}" width="${NODE_W}" height="${n2(h)}"/>`;
        const shape = rect + hatch(nodeTone(i), 'rect', `x="${n2(x)}" y="${n2(y)}" width="${NODE_W}" height="${n2(h)}"`);
        nodeSvg += canFocus ? focusable(ctx, 'lc-pt-node', nodeText(i), shape, x + NODE_W / 2, y) : shape;
        spots.push({ i, c, x, y, h });
      }
      // Two-line labels: name, then the bold value coloured by the node's meaning. First column: left of the bar,
      // last column: right of the bar, both pushed apart vertically with a leader line when moved. Middle columns:
      // above the bar, below it when there is no room, otherwise beside it.
      const BLOCK = FS + LINE + 4;
      // Middle-column names may wrap onto up to three lines before the last line is truncated: words first (a word may
      // run 15% over the room), and a word that is still too wide splits once into two halves of two or more letters,
      // so narrow columns keep readable names instead of single letters. A trailing '*' (computed) does not count as a
      // letter, so "영업이익*" splits as "영업" + "이익*", never "영업이" + "익*".
      const wrapName = (s: string, room: number): string[] => {
        const soft = room * 1.15;
        const pieces = s.split(' ').flatMap((word) => {
          const ch = [...word];
          const letters = word.endsWith('*') ? ch.length - 1 : ch.length;
          if (tw(word, FS) <= soft || letters < 4) return [word];
          const k = Math.floor(letters / 2);
          return [ch.slice(0, k).join(''), ch.slice(k).join('')];
        });
        const lines: string[] = [];
        let cur = '';
        for (const p of pieces) {
          const next = cur ? `${cur} ${p}` : p;
          if (!cur || tw(next, FS) <= soft) { cur = next; continue; }
          lines.push(cur);
          cur = p;
        }
        if (cur) lines.push(cur);
        if (lines.length <= 3) return lines;
        return [...lines.slice(0, 2), truncate(lines.slice(2).join(' '), soft, FS)];
      };
      const lineCount = (i: number, room: number, wrap: boolean): number => (wrap ? wrapName(name(i), Math.max(room, tw('가…', FS))).length : 1);
      const label = (sp: (typeof spots)[number], lx: number, ty: number, anchor: string, room: number, wrap = false): string => {
        const r = Math.max(room, tw('가…', FS));
        const lines = wrap ? wrapName(name(sp.i), r) : [truncate(name(sp.i), r, FS)];
        const x = n2(lx);
        return `<text class="lc-node-lbl ${toneCls(nodeTone(sp.i), sp.i, nodes[sp.i]?.color)} x="${x}" y="${n2(ty)}"${anchor}>` +
          lines.map((ln, k) => `<tspan x="${x}"${k ? ` dy="${LINE}"` : ''}>${esc(ln)}</tspan>`).join('') +
          `<tspan class="lc-node-val" x="${x}" dy="${LINE + 1}">${esc(fmt(nodeV[sp.i] as number))}</tspan></text>`;
      };
      // Occupied boxes (x, y, right, bottom): every bar, then each label as it is placed. Middle-column labels pick the
      // first candidate spot that meets none of them, so on narrow screens a label never lands on another label or bar.
      const taken: [number, number, number, number][] = spots.map((s) => [s.x - 1, s.y - 1, s.x + NODE_W + 1, s.y + Math.max(1, s.h) + 1]);
      const blockOf = (i: number, lx: number, ty: number, anchor: 'start' | 'middle' | 'end', room: number, wrap: boolean): [number, number, number, number] => {
        const r = Math.max(room, tw('가…', FS));
        const lines = wrap ? wrapName(name(i), r) : [truncate(name(i), r, FS)];
        const w = Math.max(...lines.map((ln) => tw(ln, FS)), tw(fmt(nodeV[i] as number), VAL_FS) * 1.06);
        const left = anchor === 'start' ? lx : anchor === 'end' ? lx - w : lx - w / 2;
        return [left, ty - FS, left + w, ty - FS + BLOCK + LINE * (lines.length - 1)];
      };
      const overlap = (b: [number, number, number, number]): number => taken.reduce((a, o) => {
        const w = Math.min(b[2], o[2]) - Math.max(b[0], o[0]); const h = Math.min(b[3], o[3]) - Math.max(b[1], o[1]);
        return a + (w > 0 && h > 0 ? w * h : 0);
      }, 0);
      const side = (c: number, right: boolean): void => {
        const list = spots.filter((s) => s.c === c).map((s) => ({ s, top: s.y + s.h / 2 - BLOCK / 2 })).sort((a, b) => a.top - b.top);
        let floor = 2;
        for (const it of list) { it.top = Math.max(it.top, floor); floor = it.top + BLOCK + 2; }
        let ceil = ctx.H - 2;
        for (let j = list.length - 1; j >= 0; j--) { const it = list[j] as (typeof list)[number]; it.top = Math.min(it.top, ceil - BLOCK); ceil = it.top - 2; }
        for (const { s: sp, top } of list) {
          const edge = right ? sp.x + NODE_W : sp.x;
          const lx = right ? edge + 8 : edge - 8;
          labelSvg += label(sp, lx, top + FS, right ? '' : ' text-anchor="end"', (right ? rightW : leftW) - 10);
          taken.push(blockOf(sp.i, lx, top + FS, right ? 'start' : 'end', (right ? rightW : leftW) - 10, false));
          const cy = sp.y + sp.h / 2; const mid = top + BLOCK / 2;
          if (Math.abs(mid - cy) > 4) labelSvg += `<path class="lc-sk-lead" d="M${n2(edge + (right ? 1 : -1))},${n2(cy)}L${n2(lx + (right ? -2 : 2))},${n2(mid)}"/>`;
        }
      };
      if (C > 1) side(0, false);
      side(C - 1, true);
      for (const sp of spots) {
        if (sp.c === 0 || sp.c === C - 1) continue;
        const same = spots.filter((s) => s.c === sp.c);
        const above = Math.max(2, ...same.filter((s) => s.y < sp.y).map((s) => s.y + s.h));
        const below = Math.min(ctx.H - 2, ...same.filter((s) => s.y > sp.y).map((s) => s.y));
        const cx = sp.x + NODE_W / 2;
        // Centred over the bar the label owns its column's width (half a gap each side), so neighbouring columns'
        // labels cannot meet; beside the bar the width ends at the next column.
        const room = colGap - 4;
        const tall = BLOCK + LINE * (lineCount(sp.i, room, true) - 1);
        const room2 = colGap - NODE_W - 8;
        const tall2 = BLOCK + LINE * (lineCount(sp.i, room2, true) - 1);
        const fit = (top: number): number => Math.min(Math.max(top, 2), ctx.H - 2 - tall2);
        // Candidates in order of preference: above the bar, below it (both only when the column leaves room), beside it
        // at the bar's middle, then beside it slid along the bar (nearest the middle first, 6px steps, ending at the
        // plot edges). The first spot that meets no bar or placed label wins; if every spot meets something, the one
        // with the least overlap does. Wide layouts that never collided keep their previous placement.
        type Cand = { ty: number; x: number; anchor: 'start' | 'middle'; room: number; slid?: boolean };
        const cands: Cand[] = [];
        if (sp.y - above >= tall + 4) cands.push({ ty: sp.y - 4 - tall + FS, x: cx, anchor: 'middle', room });
        if (below - (sp.y + sp.h) >= tall + 4) cands.push({ ty: sp.y + sp.h + 4 + FS, x: cx, anchor: 'middle', room });
        const mid = fit(sp.y + sp.h / 2 - tall2 / 2);
        cands.push({ ty: mid + FS, x: sp.x + NODE_W + 6, anchor: 'start', room: room2 });
        for (let d = 6; d < ctx.H; d += 6) {
          for (const top of [mid + d, mid - d]) if (fit(top) === top) cands.push({ ty: top + FS, x: sp.x + NODE_W + 6, anchor: 'start', room: room2, slid: true });
        }
        let best = cands[0] as Cand; let bestCost = Infinity;
        for (const cd of cands) {
          const v = overlap(blockOf(sp.i, cd.x, cd.ty, cd.anchor, cd.room, true));
          if (v < bestCost) { best = cd; bestCost = v; }
          if (v === 0) break;
        }
        labelSvg += label(sp, best.x, best.ty, best.anchor === 'middle' ? ' text-anchor="middle"' : '', best.room, true);
        const placed = blockOf(sp.i, best.x, best.ty, best.anchor, best.room, true);
        taken.push(placed);
        // A label slid past its bar's ends gets the same leader line as the side labels, so it still points at its bar.
        const lm = (placed[1] + placed[3]) / 2;
        if (best.slid && (lm < sp.y || lm > sp.y + sp.h)) {
          const ey = Math.min(Math.max(lm, sp.y), sp.y + Math.max(1, sp.h));
          labelSvg += `<path class="lc-sk-lead" d="M${n2(sp.x + NODE_W + 1)},${n2(ey)}L${n2(best.x - 2)},${n2(lm)}"/>`;
        }
      }
      const defs = linkSvg.includes('lc-sk-hatch') || nodeSvg.includes('lc-sk-hatch')
        ? `<defs><pattern id="${hatchId}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path class="lc-sk-hatch-line" d="M0 0V6"/></pattern></defs>` : '';
      svg = `${defs}<g class="lc-links">${linkSvg}</g><g class="lc-nodes">${nodeSvg}</g><g class="lc-node-lbls" aria-hidden="true">${labelSvg}</g>`;
    }

    // Legend only when the spec uses tones or computed nodes, so earlier specs render as before.
    const used = new Set<SankeyTone>([...nodes.map((_, i) => nodeTone(i)), ...links.map(linkTone)].filter((x): x is SankeyTone => !!x));
    const anyComputed = nodes.some((n) => n.computed);
    const legendItems = [
      ...TONES.filter((tn) => used.has(tn)).map((tn) => `<li><span class="lc-sw lc-tone-${tn}${tn === 'cost' ? ' lc-sk-sw-hatch' : ''}"></span><span class="lc-ln">${esc(L2.tone[tn])}${tn === 'cost' ? ` (${esc(L2.hatched)})` : ''}</span></li>`),
      ...(anyComputed ? [`<li><span class="lc-ln">* ${esc(note)}</span></li>`] : []),
    ];
    const lg = spec.legend === false || !legendItems.length ? '' : `<ul class="lc-legend lc-sk-legend">${legendItems.join('')}</ul>`;

    const missing = links.filter((x) => x.l.value === null).length;
    const big = [...drawnLinks].sort((a, b) => (b.l.value as number) - (a.l.value as number) || a.i - b.i)[0];
    const quals = [...new Set([...nodes.map((n) => n.quality), ...spec.links.map((l) => l.quality)].filter((q): q is string => !!q))];
    const desc = `${L2.nodes} ${nodes.length}${L2.count}, ${L2.links} ${links.length}${L2.count}. ${L2.flow} ${fmt(totalFlow)}.` +
      `${big ? ` ${L2.largest}: ${linkText(big)}.` : ''} ${links.map(linkText).join(', ')}.` +
      `${missing ? ` ${t.missing} ${missing}.` : ''}${quals.length ? ` ${t.quality}: ${quals.join(', ')}.` : ''}`;
    const linkTbl = table(t, `${spec.title} · ${L2.links}`, [`${t.from} → ${t.to}`, t.value, L2.ofSource], links.map((x) => {
      const sh = ofSource(x);
      return { th: `${name(x.s)} → ${name(x.t)}${x.l.quality ? ` (${x.l.quality})` : ''}`, cells: [x.l.value === null ? null : fmt(x.l.value), sh === null ? null : pct(sh)] };
    }));
    const nodeTbl = table(t, `${spec.title} · ${L2.nodes}`, [t.cat, L2.inflow, L2.outflow], nodes.map((n, i) => ({
      th: `${name(i)}${n.quality ? ` (${n.quality})` : ''}`,
      cells: [hasIn[i] ? (inKnown[i] ? fmt(inSum[i] as number) : null) : '–', links.some((x) => x.s === i) ? (outKnown[i] ? fmt(outSum[i] as number) : null) : '–'],
    })));
    return frame(ctx, spec, svg, desc, lg, wrapTable(spec.table ?? 'details', t, linkTbl + nodeTbl));
  },
});

// Band centre lines are cubic curves with both control points at the horizontal midpoint. For a horizontal fraction
// s of the band, the vertical fraction is g(s): solve 1.5t(1-t) + t^3 = s for t, then 3t^2 - 2t^3.
const gMemo = new Map<number, number>();
function ease(s: number): number {
  const key = Math.round(s * 1000);
  const hit = gMemo.get(key);
  if (hit !== undefined) return hit;
  let lo = 0; let hi = 1;
  for (let it = 0; it < 20; it++) { const t = (lo + hi) / 2; if (1.5 * t * (1 - t) + t * t * t < key / 1000) lo = t; else hi = t; }
  const t = (lo + hi) / 2;
  const g = 3 * t * t - 2 * t * t * t;
  gMemo.set(key, g);
  return g;
}

/**
 * Crossing weight of the current layout: the area where two bands cover each other. Bands keep a constant vertical
 * thickness, so for every pair whose horizontal spans overlap the vertical overlap is sampled at five points. Band ends
 * use the same stacking as the renderer (outgoing by target position, incoming by source position).
 */
export function crossingCost(ls: { i: number; s: number; t: number; h: number }[], ny: number[], left: number[]): number {
  const sAcc = new Map<number, number>(); const tAcc = new Map<number, number>();
  const y0 = new Map<number, number>(); const y1 = new Map<number, number>();
  for (const x of [...ls].sort((a, b) => (ny[a.t] as number) - (ny[b.t] as number) || a.i - b.i)) { y0.set(x.i, (ny[x.s] as number) + (sAcc.get(x.s) ?? 0)); sAcc.set(x.s, (sAcc.get(x.s) ?? 0) + x.h); }
  for (const x of [...ls].sort((a, b) => (ny[a.s] as number) - (ny[b.s] as number) || a.i - b.i)) { y1.set(x.i, (ny[x.t] as number) + (tAcc.get(x.t) ?? 0)); tAcc.set(x.t, (tAcc.get(x.t) ?? 0) + x.h); }
  const geo = ls.map((x) => ({ h: x.h, xa: (left[x.s] as number) + NODE_W, xb: left[x.t] as number, ya: y0.get(x.i) as number, yb: y1.get(x.i) as number }));
  const at = (g: (typeof geo)[number], x: number): number => g.ya + (g.yb - g.ya) * ease((x - g.xa) / (g.xb - g.xa));
  let cost = 0;
  for (let a = 0; a < geo.length; a++) {
    for (let b = a + 1; b < geo.length; b++) {
      const p = geo[a] as (typeof geo)[number]; const q = geo[b] as (typeof geo)[number];
      const lo = Math.max(p.xa, q.xa); const hi = Math.min(p.xb, q.xb);
      if (hi - lo < 1) continue;
      for (const f of [0.1, 0.3, 0.5, 0.7, 0.9]) {
        const tp = at(p, lo + (hi - lo) * f); const tq = at(q, lo + (hi - lo) * f);
        const cover = Math.min(tp + p.h, tq + q.h) - Math.max(tp, tq);
        if (cover > 0.5) cost += cover * (hi - lo) / 5;
      }
    }
  }
  return cost;
}

/**
 * Adjacent swaps inside each column, kept only when the crossing weight strictly drops, until a pass changes nothing.
 * Ties keep the spec order, so a layout without crossings renders exactly as the input order.
 */
function orderNodes(byCol: number[][], stack: () => void, cost: () => number): void {
  let best = cost();
  let evals = 1;
  for (let pass = 0; pass < 8 && best > 0; pass++) {
    let improved = false;
    for (const c of byCol) {
      for (let j = 0; j + 1 < c.length && evals < AUTO_MAX_EVALS; j++) {
        [c[j], c[j + 1]] = [c[j + 1] as number, c[j] as number];
        stack();
        const v = cost(); evals++;
        if (v < best - 1e-6) { best = v; improved = true; } else { [c[j], c[j + 1]] = [c[j + 1] as number, c[j] as number]; stack(); }
      }
    }
    if (!improved) break;
  }
}

/**
 * Iterative relaxation (in the spirit of d3-sankey): each node moves to the value-weighted position that would make
 * its bands straight, forwards then backwards, and collisions are resolved without changing the column order.
 */
function relaxNodes(byCol: number[][], ls: { i: number; s: number; t: number; h: number }[], ny: number[], nh: number[], H: number): void {
  const resolve = (c: number[]): void => {
    let y = PAD_Y;
    for (const i of c) { ny[i] = Math.max(ny[i] as number, y); y = (ny[i] as number) + (nh[i] as number) + GAP; }
    let bottom = H - PAD_Y;
    for (let j = c.length - 1; j >= 0; j--) {
      const i = c[j] as number;
      ny[i] = Math.max(PAD_Y, Math.min(ny[i] as number, bottom - (nh[i] as number)));
      bottom = (ny[i] as number) - GAP;
    }
  };
  const offsets = (): { so: Map<number, number>; to: Map<number, number> } => {
    const so = new Map<number, number>(); const to = new Map<number, number>();
    const sAcc = new Map<number, number>(); const tAcc = new Map<number, number>();
    for (const x of [...ls].sort((a, b) => (ny[a.t] as number) - (ny[b.t] as number) || a.i - b.i)) { so.set(x.i, sAcc.get(x.s) ?? 0); sAcc.set(x.s, (sAcc.get(x.s) ?? 0) + x.h); }
    for (const x of [...ls].sort((a, b) => (ny[a.s] as number) - (ny[b.s] as number) || a.i - b.i)) { to.set(x.i, tAcc.get(x.t) ?? 0); tAcc.set(x.t, (tAcc.get(x.t) ?? 0) + x.h); }
    return { so, to };
  };
  const C = byCol.length;
  // Backward then forward in each round, so the last word belongs to the sources (bands leave them straight).
  for (let it = 0; it < 8; it++) {
    for (let c = C - 2; c >= 0; c--) {
      const { so, to } = offsets();
      for (const i of byCol[c] ?? []) {
        const out = ls.filter((x) => x.s === i);
        const w = out.reduce((a, x) => a + x.h, 0);
        if (w > 0) ny[i] = out.reduce((a, x) => a + x.h * ((ny[x.t] as number) + (to.get(x.i) ?? 0) - (so.get(x.i) ?? 0)), 0) / w;
      }
      resolve(byCol[c] ?? []);
    }
    for (let c = 1; c < C; c++) {
      const { so, to } = offsets();
      for (const i of byCol[c] ?? []) {
        const inc = ls.filter((x) => x.t === i);
        const w = inc.reduce((a, x) => a + x.h, 0);
        if (w > 0) ny[i] = inc.reduce((a, x) => a + x.h * ((ny[x.s] as number) + (so.get(x.i) ?? 0) - (to.get(x.i) ?? 0)), 0) / w;
      }
      resolve(byCol[c] ?? []);
    }
  }
}
