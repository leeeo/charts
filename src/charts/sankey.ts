// Sankey: nodes in columns by longest path from a source, links drawn as bands whose thickness is proportional to
// the flow value. The graph must be acyclic. A null link value is missing: it keeps its place in the layout
// structure but is not drawn, and is listed as missing in the table and description.
import type { BaseSpec, Value } from '../types.ts';
import { definePlugin } from '../plugin.ts';
import { BASE, base, color, dict, fail, idList, optStr, str, value } from '../check.ts';
import { type Ctx, MAX_FOCUS, colorAttrs, empty, focusable, frame, pct, table, wrapTable } from '../kit.ts';
import { esc, makeFmt, n2, truncate, tw } from '../format.ts';

export interface SankeyNode { id: string; label: string; color?: string; quality?: string }
export interface SankeyLink { source: string; target: string; value: Value; quality?: string }
export interface SankeySpec extends BaseSpec {
  type: 'sankey';
  nodes: SankeyNode[];
  links: SankeyLink[];
}

const MAX_NODES = 100;
const MAX_LINKS = 500;
const NODE_W = 12;
const PAD_Y = 8;
const GAP = 10;
const FS = 12;
const L = {
  ko: { nodes: '노드', links: '링크', flow: '총 흐름', largest: '가장 큰 흐름', inflow: '유입', outflow: '유출', ofSource: '출발 노드 유출 대비', count: '개' },
  en: { nodes: 'nodes', links: 'links', flow: 'Total flow', largest: 'Largest flow', inflow: 'In', outflow: 'Out', ofSource: 'Share of source outflow', count: '' },
};

/** Column of each node = length of the longest path reaching it from a node with no inbound links. */
export function columns(nodeCount: number, links: { s: number; t: number }[]): number[] {
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
  return col;
}

export const plugin = definePlugin<SankeySpec>({
  type: 'sankey',
  names: { ko: '생키 다이어그램', en: 'Sankey diagram' },
  defaultWidth: 720,
  validate(input) {
    const o = dict(input, 'spec', [...BASE, 'nodes', 'links']);
    const out = base(o) as unknown as SankeySpec;
    out.type = 'sankey';
    out.nodes = idList(o.nodes, 'nodes', ['label', 'color', 'quality'], MAX_NODES, (it, p, id) => {
      const n: SankeyNode = { id, label: str(it.label, `${p}.label`, 60) };
      const c = color(it.color, `${p}.color`);
      const q = optStr(it.quality, `${p}.quality`, 60);
      if (c !== undefined) n.color = c;
      if (q !== undefined) n.quality = q;
      return n;
    });
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
      const it = dict(item, p, ['source', 'target', 'value', 'quality']);
      const source = str(it.source, `${p}.source`, 64);
      const target = str(it.target, `${p}.target`, 64);
      const s = index.get(source); const t = index.get(target);
      if (s === undefined) fail(`${p}.source`, 'must be the id of a node');
      if (t === undefined) fail(`${p}.target`, 'must be the id of a node');
      if (s === t || reaches(t, s)) fail(p, 'would create a cycle');
      adj[s]?.push(t);
      const l: SankeyLink = { source, target, value: value(it.value, `${p}.value`, 0) };
      const q = optStr(it.quality, `${p}.quality`, 60);
      if (q !== undefined) l.quality = q;
      return l;
    });
    return out;
  },
  height(spec) {
    const index = new Map(spec.nodes.map((n, i) => [n.id, i]));
    const col = columns(spec.nodes.length, spec.links.map((l) => ({ s: index.get(l.source) as number, t: index.get(l.target) as number })));
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
    const col = columns(nodes.length, links);
    const C = Math.max(...col) + 1;
    const hasIn = nodes.map((_, i) => links.some((x) => x.t === i));
    const sources = nodes.map((_, i) => i).filter((i) => !hasIn[i]);
    const totalFlow = sources.reduce((a, i) => a + (outSum[i] ?? 0), 0);
    const name = (i: number): string => nodes[i]?.label ?? '';
    const ofSource = (x: (typeof links)[number]): number | null => (x.l.value === null || !(outSum[x.s] ?? 0) ? null : x.l.value / (outSum[x.s] as number));
    const linkText = (x: (typeof links)[number]): string => {
      const sh = ofSource(x);
      return `${name(x.s)} → ${name(x.t)}: ${x.l.value === null ? t.na : fmt(x.l.value)}${sh !== null ? ` (${pct(sh)})` : ''}${x.l.quality ? ` · ${x.l.quality}` : ''}`;
    };
    const nodeText = (i: number): string => {
      const n = nodes[i] as SankeyNode;
      const parts = [hasIn[i] ? `${L2.inflow} ${inKnown[i] ? fmt(inSum[i] as number) : t.na}` : '', links.some((x) => x.s === i) ? `${L2.outflow} ${outKnown[i] ? fmt(outSum[i] as number) : t.na}` : ''].filter(Boolean);
      return `${n.label}: ${parts.join(' · ')}${n.quality ? ` · ${n.quality}` : ''}`;
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
      const colGap = C > 1 ? (ctx.W - NODE_W - 8) / (C - 1) : 0;
      const nx = (c: number): number => 4 + c * colGap;
      const ny = nodes.map(() => 0);
      const nh = nodes.map((_, i) => (nodeV[i] ?? 0) * k);
      for (const c of byCol) {
        const used = c.reduce((a, i) => a + (nh[i] ?? 0), 0) + GAP * Math.max(0, c.length - 1);
        let y = PAD_Y + (avail - used) / 2;
        for (const i of c) { ny[i] = y; y += (nh[i] ?? 0) + GAP; }
      }
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
        const path = `<path class="lc-mark lc-link ${colorAttrs(x.s, n.color)} data-i="${x.i}" data-v="${x.l.value}" d="${d}"/>`;
        linkSvg += canFocus ? focusable(ctx, 'lc-pt-link', linkText(x), path, xm, (ya + yb) / 2 + th / 2) : path;
      }
      let nodeSvg = '';
      let labelSvg = '';
      for (const i of byCol.flat()) {
        const n = nodes[i] as SankeyNode;
        const c = col[i] as number;
        const x = nx(c); const y = ny[i] as number; const h = Math.max(1, nh[i] as number);
        const rect = `<rect class="lc-mark lc-node ${colorAttrs(i, n.color)} data-i="${i}" data-v="${nodeV[i]}" x="${n2(x)}" y="${n2(y)}" width="${NODE_W}" height="${n2(h)}"/>`;
        nodeSvg += canFocus ? focusable(ctx, 'lc-pt-node', nodeText(i), rect, x + NODE_W / 2, y) : rect;
        // Labels sit to the right of the bar, except in the last column (to the left), within one column gap.
        const room = Math.max(0, (C > 1 ? colGap : ctx.W) - NODE_W - 14);
        const full = `${n.label} ${fmt(nodeV[i] as number)}`;
        const text = tw(full, FS) <= room ? full : truncate(n.label, room, FS);
        const last = c === C - 1 && C > 1;
        const ty = Math.min(Math.max(y + h / 2 + FS * 0.36, FS), ctx.H - 2);
        if (room >= tw('가…', FS)) labelSvg += `<text class="lc-node-lbl" x="${n2(last ? x - 6 : x + NODE_W + 6)}" y="${n2(ty)}"${last ? ' text-anchor="end"' : ''}>${esc(text)}</text>`;
      }
      svg = `<g class="lc-links">${linkSvg}</g><g class="lc-nodes">${nodeSvg}</g><g class="lc-node-lbls" aria-hidden="true">${labelSvg}</g>`;
    }

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
      th: `${n.label}${n.quality ? ` (${n.quality})` : ''}`,
      cells: [hasIn[i] ? (inKnown[i] ? fmt(inSum[i] as number) : null) : '–', links.some((x) => x.s === i) ? (outKnown[i] ? fmt(outSum[i] as number) : null) : '–'],
    })));
    return frame(ctx, spec, svg, desc, '', wrapTable(spec.table ?? 'details', t, linkTbl + nodeTbl));
  },
});
