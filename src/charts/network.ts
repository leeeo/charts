// Network: nodes on a circle (deterministic order: by group, then input order), links as lines whose width is
// proportional to the weight. Directed links bend slightly and end in an arrowhead, so A→B and B→A stay apart.
// A null link weight is missing: the connection is drawn as a thin dashed line, never as a 0-width link.
// Readability (0.8.0): when every node gets a label, it carries the weighted total on a second bold line tinted by
// the node's colour; hovering a link keeps that link, hovering a node keeps its links, and the rest fade (network.css).
import type { BaseSpec, Value } from '../types.ts';
import { definePlugin } from '../plugin.ts';
import { BASE, base, color, dict, fail, idList, optBool, optStr, put, str, value } from '../check.ts';
import { type Ctx, FS, MAX_FOCUS, colorAttrs, empty, focusable, frame, legend, table, wrapTable } from '../kit.ts';
import { clamp, esc, makeFmt, n2, truncate, tw } from '../format.ts';

export interface NetworkNode { id: string; label: string; group?: string; color?: string; quality?: string }
export interface NetworkLink { source: string; target: string; value: Value; quality?: string }
export interface NetworkSpec extends BaseSpec {
  type: 'network';
  nodes: NetworkNode[];
  links: NetworkLink[];
  /** Links have a direction (arrowheads). Default false. */
  directed?: boolean;
}

const MAX_NODES = 100;
const MAX_LINKS = 500;
const MAX_W = 8;
const LINE = 15;
/** Up to this many nodes the label gets a second line with the weighted total. */
const VALUE_LINES_MAX = 24;
const L = {
  ko: { nodes: '노드', links: '링크', degree: '연결 수', conn: '연결', weight: '가중 합계', group: '그룹', largest: '가장 큰 연결', hub: '가장 많이 연결된 노드', count: '개' },
  en: { nodes: 'nodes', links: 'links', degree: 'Links', conn: 'links', weight: 'Weighted total', group: 'Group', largest: 'Largest link', hub: 'Most connected node', count: '' },
};

export const plugin = definePlugin<NetworkSpec>({
  type: 'network',
  names: { ko: '네트워크 그래프', en: 'Network graph' },
  defaultWidth: 640,
  validate(input) {
    const o = dict(input, 'spec', [...BASE, 'nodes', 'links', 'directed']);
    const out = base(o) as unknown as NetworkSpec;
    out.type = 'network';
    out.nodes = idList(o.nodes, 'nodes', ['label', 'group', 'color', 'quality'], MAX_NODES, (it, p, id) => {
      const n: NetworkNode = { id, label: str(it.label, `${p}.label`, 60) };
      const r = n as unknown as Record<string, unknown>;
      put(r, 'group', optStr(it.group, `${p}.group`, 40));
      put(r, 'color', color(it.color, `${p}.color`));
      put(r, 'quality', optStr(it.quality, `${p}.quality`, 60));
      return n;
    });
    const directed = optBool(o.directed, 'directed');
    put(out as unknown as Record<string, unknown>, 'directed', directed);
    const ids = new Set(out.nodes.map((n) => n.id));
    if (!Array.isArray(o.links)) fail('links', 'must be an array');
    if (o.links.length > MAX_LINKS) fail('links', `must have at most ${MAX_LINKS} entries`);
    const seen = new Set<string>();
    out.links = (o.links as unknown[]).map((item, i) => {
      const p = `links[${i}]`;
      const it = dict(item, p, ['source', 'target', 'value', 'quality']);
      const source = str(it.source, `${p}.source`, 64);
      const target = str(it.target, `${p}.target`, 64);
      if (!ids.has(source)) fail(`${p}.source`, 'must be the id of a node');
      if (!ids.has(target)) fail(`${p}.target`, 'must be the id of a node');
      if (source === target) fail(`${p}.target`, 'must differ from source');
      const key = directed ? `${source}\u0000${target}` : [source, target].sort().join('\u0000');
      if (seen.has(key)) fail(p, 'duplicate link');
      seen.add(key);
      const l: NetworkLink = { source, target, value: value(it.value, `${p}.value`, 0) };
      put(l as unknown as Record<string, unknown>, 'quality', optStr(it.quality, `${p}.quality`, 60));
      return l;
    });
    return out;
  },
  height(_spec, W) {
    return Math.round(clamp(W * 0.75, 300, 600));
  },
  render(spec, ctx: Ctx) {
    const t = ctx.t;
    const l = L[ctx.lang];
    const directed = spec.directed === true;
    const n = spec.nodes.length;
    const idx = new Map(spec.nodes.map((nd, i) => [nd.id, i]));
    const vals = spec.links.map((k) => k.value);
    const fmt = makeFmt(spec.unit, vals);
    const pres = vals.filter((v): v is number => v !== null);
    const missing = vals.length - pres.length;
    const ends = spec.links.map((k) => [idx.get(k.source) as number, idx.get(k.target) as number] as const);
    const deg = new Array<number>(n).fill(0);
    const wdeg = new Array<number>(n).fill(0);
    ends.forEach(([s, d], k) => {
      deg[s]! += 1; deg[d]! += 1;
      const v = vals[k];
      if (v !== null && v !== undefined) { wdeg[s]! += v; wdeg[d]! += v; }
    });
    const groups: string[] = [];
    for (const nd of spec.nodes) if (nd.group !== undefined && !groups.includes(nd.group)) groups.push(nd.group);
    const hasUngrouped = groups.length > 0 && spec.nodes.some((nd) => nd.group === undefined);
    const gIdx = spec.nodes.map((nd) => (nd.group === undefined ? (groups.length ? groups.length : 0) : groups.indexOf(nd.group)));
    const lab = (i: number): string => spec.nodes[i]!.label;
    const arrow = directed ? '→' : '–';
    const nodeText = (i: number): string => {
      const nd = spec.nodes[i]!;
      return `${nd.label}${nd.group ? `, ${nd.group}` : ''}: ${l.conn} ${deg[i]}${l.count} · ${l.weight} ${fmt(wdeg[i]!)}${nd.quality ? ` · ${nd.quality}` : ''}`;
    };
    const linkText = (k: number): string => {
      const lk = spec.links[k]!;
      const [s, d] = ends[k]!;
      return `${lab(s)} ${arrow} ${lab(d)}: ${lk.value === null ? t.na : fmt(lk.value)}${lk.quality ? ` · ${lk.quality}` : ''}`;
    };

    let svg = '';
    if (!pres.length) svg = empty(ctx);
    else {
      const twoLine = n <= VALUE_LINES_MAX;
      const labMax = Math.min(Math.max(...spec.nodes.map((nd, i) => Math.max(tw(nd.label, FS), twoLine ? tw(fmt(wdeg[i]!), FS + 1) : 0))), ctx.W * 0.2);
      const cx = ctx.W / 2;
      const cy = ctx.H / 2;
      const R0 = Math.max(24, Math.min(ctx.W / 2 - labMax - 10, ctx.H / 2 - FS - (twoLine ? LINE : 0) - 10));
      const rmax = clamp((Math.PI * R0) / n * 0.8, 3, 14);
      const R = Math.max(16, R0 - rmax);
      const rmin = Math.min(4, rmax);
      const maxWd = Math.max(0, ...wdeg);
      const rad = wdeg.map((w) => (maxWd > 0 ? rmin + (rmax - rmin) * Math.sqrt(w / maxWd) : rmin));
      const order = spec.nodes.map((_, i) => i).sort((a, b) => gIdx[a]! - gIdx[b]! || a - b);
      const ang = new Array<number>(n).fill(0);
      const pos: [number, number][] = spec.nodes.map(() => [0, 0]);
      order.forEach((i, k) => {
        const a = (2 * Math.PI * k) / n;
        ang[i] = a;
        pos[i] = [cx + R * Math.sin(a), cy - R * Math.cos(a)];
      });
      const maxV = Math.max(...pres);
      const width = (v: number): number => (maxV > 0 ? 1 + ((MAX_W - 1) * v) / maxV : 1);
      const canFocusLinks = n + spec.links.length <= MAX_FOCUS;
      const canFocusNodes = n <= MAX_FOCUS;

      let links = '';
      spec.links.forEach((lk, k) => {
        const [s, d] = ends[k]!;
        const [x0, y0] = pos[s]!;
        const [x2, y2] = pos[d]!;
        const v = lk.value;
        const w = v === null ? 1 : width(v);
        let dPath: string;
        let ax: number;
        let ay: number;
        let head = '';
        if (directed) {
          const dx = x2 - x0;
          const dy = y2 - y0;
          const len = Math.hypot(dx, dy) || 1;
          const qx = (x0 + x2) / 2 - (dy / len) * len * 0.12;
          const qy = (y0 + y2) / 2 + (dx / len) * len * 0.12;
          const ex = x2 - qx;
          const ey = y2 - qy;
          const el = Math.hypot(ex, ey) || 1;
          const ux = ex / el;
          const uy = ey / el;
          const tipX = x2 - ux * (rad[d]! + 1.5);
          const tipY = y2 - uy * (rad[d]! + 1.5);
          const al = 5 + w * 0.8;
          const hw = 3 + w * 0.5;
          const bx = tipX - ux * al;
          const by = tipY - uy * al;
          dPath = `M${n2(x0)} ${n2(y0)}Q${n2(qx)} ${n2(qy)} ${n2(bx)} ${n2(by)}`;
          if (v !== null) head = `<path class="lc-narrow ${colorAttrs(gIdx[s]!, spec.nodes[s]!.color)} data-s="${s}" data-t="${d}" d="M${n2(tipX)} ${n2(tipY)}L${n2(bx - uy * hw)} ${n2(by + ux * hw)}L${n2(bx + uy * hw)} ${n2(by - ux * hw)}Z"/>`;
          ax = 0.25 * x0 + 0.5 * qx + 0.25 * x2;
          ay = 0.25 * y0 + 0.5 * qy + 0.25 * y2;
        } else {
          dPath = `M${n2(x0)} ${n2(y0)}L${n2(x2)} ${n2(y2)}`;
          ax = (x0 + x2) / 2;
          ay = (y0 + y2) / 2;
        }
        const inner = v === null
          ? `<path class="lc-nlink-na" data-i="${k}" data-s="${s}" data-t="${d}" d="${dPath}"/>`
          : `<path class="lc-mark lc-nlink ${colorAttrs(gIdx[s]!, spec.nodes[s]!.color)} data-i="${k}" data-s="${s}" data-t="${d}" data-v="${v}" d="${dPath}" stroke-width="${n2(w)}"/>${head}`;
        links += canFocusLinks ? focusable(ctx, 'lc-pt-nlink', linkText(k), inner, ax, ay) : inner;
      });

      let nodes = '';
      spec.nodes.forEach((nd, i) => {
        const [x, y] = pos[i]!;
        const inner = `<circle class="lc-mark lc-nnode ${colorAttrs(gIdx[i]!, nd.color)} data-i="${i}" data-v="${wdeg[i]}" data-deg="${deg[i]}" cx="${n2(x)}" cy="${n2(y)}" r="${n2(rad[i]!)}"/>`;
        nodes += canFocusNodes ? focusable(ctx, 'lc-pt-nnode', nodeText(i), inner, x, y - rad[i]!) : inner;
      });

      // Labels outside the circle; thinned when neighbours are closer than one text line. With few nodes the label
      // has a second line: the weighted total, bold and tinted by the node colour.
      const gap = (2 * Math.PI * R) / n;
      const lstep = Math.max(1, Math.ceil((FS + 1) / gap));
      const withValue = twoLine && lstep === 1 && gap >= FS + LINE;
      let labels = '';
      order.forEach((i, k) => {
        if (k % lstep) return;
        const a = ang[i]!;
        const rl = R + rmax + 5;
        const sa = Math.sin(a);
        const ca = Math.cos(a);
        const x = cx + rl * sa;
        const y1 = cy - rl * ca + FS * 0.36 - ca * FS * 0.3;
        // Two lines stack away from the circle: above it the name moves up, below it the value moves down.
        const shift = withValue ? (ca > 0.3 ? LINE : ca < -0.3 ? 0 : LINE / 2) : 0;
        const y = clamp(y1 - shift, FS, ctx.H - 3 - (withValue ? LINE : 0));
        const anchor = sa > 0.3 ? 'start' : sa < -0.3 ? 'end' : 'middle';
        const room = anchor === 'start' ? ctx.W - 3 - x : anchor === 'end' ? x - 3 : 2 * Math.min(x - 3, ctx.W - 3 - x);
        const text = truncate(lab(i), Math.min(room, labMax + 20), FS);
        const value = withValue ? `<tspan class="lc-nlabel-val" x="${n2(x)}" dy="${LINE}">${esc(truncate(fmt(wdeg[i]!), Math.min(room, labMax + 20), FS + 1))}</tspan>` : '';
        if (room > tw('…', FS)) labels += `<text class="lc-nlabel ${colorAttrs(gIdx[i]!, spec.nodes[i]!.color)} x="${n2(x)}" y="${n2(y)}" text-anchor="${anchor}">${esc(text)}${value}</text>`;
      });
      svg = `<g class="lc-nlinks">${links}</g><g class="lc-nnodes">${nodes}</g><g class="lc-nlabels" aria-hidden="true">${labels}</g>`;
    }

    let desc = `${n} ${l.nodes}, ${spec.links.length} ${l.links}.`;
    if (pres.length) {
      const sum = pres.reduce((a, b) => a + b, 0);
      let best = -1;
      vals.forEach((v, k) => { if (v !== null && (best < 0 || v > (vals[best] as number))) best = k; });
      const [bs, bd] = ends[best]!;
      let hub = 0;
      deg.forEach((d, i) => { if (d > deg[hub]! || (d === deg[hub]! && wdeg[i]! > wdeg[hub]!)) hub = i; });
      desc += ` ${t.total} ${fmt(sum)}. ${l.largest}: ${lab(bs)} ${arrow} ${lab(bd)} ${fmt(vals[best] as number)}. ${l.hub}: ${lab(hub)} (${deg[hub]}${l.count}).`;
    } else desc += ` ${t.na}.`;
    if (missing) desc += ` ${t.missing} ${missing}.`;
    const qs = [...new Set([...spec.nodes.map((nd) => nd.quality), ...spec.links.map((k) => k.quality)].filter((q): q is string => !!q))];
    if (qs.length) desc += ` ${t.quality}: ${qs.join(', ')}.`;

    const lg = spec.legend === false || !pres.length || !groups.length ? ''
      : legend([...groups.map((g, i) => ({ name: g, idx: i })), ...(hasUngrouped ? [{ name: t.other, idx: groups.length }] : [])]);
    const anyQ = spec.links.some((k) => k.quality);
    const linkTable = table(t, `${spec.title} · ${l.links}`, [t.from, t.to, t.value, ...(anyQ ? [t.quality] : [])],
      spec.links.map((lk, k) => ({ th: lab(ends[k]![0]), cells: [lab(ends[k]![1]), lk.value === null ? null : fmt(lk.value), ...(anyQ ? [lk.quality ?? ''] : [])] })));
    const nodeTable = table(t, `${spec.title} · ${l.nodes}`, [ctx.lang === 'ko' ? l.nodes : 'Node', l.group, l.degree, l.weight],
      spec.nodes.map((nd, i) => ({ th: nd.label, cells: [nd.group ?? '', String(deg[i]), fmt(wdeg[i]!)] })));
    return frame(ctx, spec, svg, desc, lg, wrapTable(spec.table ?? 'details', t, linkTable + nodeTable));
  },
});
