// Tree: a tidy node-link diagram of a hierarchy, laid out left to right. Depth sets the column; leaves take
// consecutive rows in input (depth-first) order and every parent sits at the midpoint of its first and last child,
// so the layout is deterministic and subtrees never overlap. Values are optional; once any node has a `value`, nodes
// without one (or with null) are missing: drawn hollow and dashed, listed as missing in the table and description.
import type { BaseSpec, Value } from '../types.ts';
import { definePlugin } from '../plugin.ts';
import { BASE, base, color, dict, fail, idList, optStr, str, value } from '../check.ts';
import { type Ctx, FS, MAX_FOCUS, colorAttrs, focusable, frame, table, wrapTable } from '../kit.ts';
import { esc, makeFmt, n2, truncate, tw } from '../format.ts';

export interface TreeNode { id: string; label: string; value?: Value; children?: TreeNode[]; color?: string; quality?: string }
export interface TreeSpec extends BaseSpec {
  type: 'tree';
  root: TreeNode;
}

const MAX_NODES = 500;
const MAX_DEPTH = 8;
const ROW = 28;
const TOP = 18;
const NR = 5;
const LFS = 11;
const KEYS = ['label', 'value', 'children', 'color', 'quality'] as const;
const L = {
  ko: { nodes: '개 노드', levels: '단계', leaves: '말단', level: '단계', kids: '하위', n: '개' },
  en: { nodes: ' nodes', levels: 'levels', leaves: 'leaves', level: 'Level', kids: 'Children', n: '' },
};

interface Placed { node: TreeNode; depth: number; parents: string[]; branch: number; parent: number; x: number; y: number }

/** Depth-first placement: y in row units (leaf order), parents centred over their children. */
export function place(root: TreeNode): Placed[] {
  const out: Placed[] = [];
  let leaf = 0;
  const walk = (n: TreeNode, depth: number, parents: string[], branch: number, parent: number): number => {
    const i = out.length;
    const p: Placed = { node: n, depth, parents, branch, parent, x: depth, y: 0 };
    out.push(p);
    if (n.children?.length) {
      const ys = n.children.map((c, ci) => walk(c, depth + 1, [...parents, n.label], depth === 0 ? ci : branch, i));
      p.y = ((ys[0] as number) + (ys[ys.length - 1] as number)) / 2;
    } else p.y = leaf++;
    return p.y;
  };
  walk(root, 0, [], 0, -1);
  return out;
}

const leafCount = (n: TreeNode): number => (n.children?.length ? n.children.reduce((a, c) => a + leafCount(c), 0) : 1);

export const plugin = definePlugin<TreeSpec>({
  type: 'tree',
  names: { ko: '트리', en: 'Tree' },
  defaultWidth: 720,
  validate(input) {
    const o = dict(input, 'spec', [...BASE, 'root']);
    const out = base(o) as unknown as TreeSpec;
    out.type = 'tree';
    const seen = new Set<string>();
    const node = (it: Record<string, unknown>, p: string, id: string, depth: number): TreeNode => {
      if (seen.has(id)) fail(`${p}.id`, 'duplicate id');
      seen.add(id);
      if (seen.size > MAX_NODES) fail('root', `must have at most ${MAX_NODES} entries`);
      const n: TreeNode = { id, label: str(it.label, `${p}.label`, 60) };
      if (it.value !== undefined) n.value = value(it.value, `${p}.value`);
      if (it.children !== undefined) {
        if (depth >= MAX_DEPTH - 1) fail(`${p}.children`, 'unknown property');
        n.children = idList(it.children, `${p}.children`, KEYS, MAX_NODES, (c, cp, cid) => node(c, cp, cid, depth + 1));
      }
      const c = color(it.color, `${p}.color`);
      const q = optStr(it.quality, `${p}.quality`, 60);
      if (c !== undefined) n.color = c;
      if (q !== undefined) n.quality = q;
      return n;
    };
    const r = dict(o.root, 'root', ['id', ...KEYS]);
    out.root = node(r, 'root', str(r.id, 'root.id', 64), 0);
    return out;
  },
  height(spec) {
    return TOP + leafCount(spec.root) * ROW;
  },
  render(spec, ctx: Ctx) {
    const t = ctx.t;
    const L2 = L[ctx.lang];
    const nodes = place(spec.root);
    const hasValues = nodes.some((p) => p.node.value !== undefined);
    const val = (p: Placed): Value => p.node.value ?? null;
    const fmt = makeFmt(spec.unit, nodes.map(val));
    const depth = Math.max(...nodes.map((p) => p.depth));
    const kidsTxt = (p: Placed): string => (p.node.children?.length ? `${L2.kids} ${p.node.children.length}${L2.n}` : '');
    const text = (p: Placed): string => {
      const v = val(p);
      const head = `${p.node.label}${p.parents.length ? `, ${p.parents.join(' › ')}` : ''}`;
      const body = [hasValues ? (v === null ? t.na : fmt(v)) : '', kidsTxt(p)].filter(Boolean).join(' · ');
      return `${head}${body ? `: ${body}` : ''}${p.node.quality ? ` · ${p.node.quality}` : ''}`;
    };
    const shown = (p: Placed): string => { const v = val(p); return hasValues && v !== null ? `${p.node.label} · ${fmt(v)}` : p.node.label; };

    // Columns: reserve room on the right for leaf labels, the rest is split evenly between depths.
    const x0 = NR + 4;
    // Label widths get a safety factor: real fonts can run ~10% wider than the tw() estimate.
    const lw = (s: string): number => tw(s, LFS) * 1.12;
    const leafW = Math.max(...nodes.filter((p) => !p.node.children?.length).map((p) => lw(shown(p)))) + NR + 10;
    const rightW = Math.min(leafW, ctx.W * 0.4);
    const step = depth > 0 ? Math.max(0, (ctx.W - x0 - rightW - 2) / depth) : 0;
    const X = (p: Placed): number => x0 + p.depth * step;
    const Y = (p: Placed): number => TOP + p.y * ROW + ROW / 2;

    let links = '';
    for (const p of nodes) {
      if (p.parent < 0) continue;
      const q = nodes[p.parent] as Placed;
      const px = X(q); const py = Y(q); const cx = X(p); const cy = Y(p); const mx = (px + cx) / 2;
      links += `<path class="lc-tree-link" d="M${n2(px)} ${n2(py)}C${n2(mx)} ${n2(py)} ${n2(mx)} ${n2(cy)} ${n2(cx)} ${n2(cy)}"/>`;
    }
    const canFocus = nodes.length <= MAX_FOCUS;
    let marks = '';
    let labels = '';
    nodes.forEach((p, i) => {
      const x = X(p); const y = Y(p);
      const v = val(p);
      const miss = hasValues && v === null;
      const leaf = !p.node.children?.length;
      const c = `<circle class="lc-mark lc-node${leaf ? ' lc-node-leaf' : ''}${miss ? ' lc-node-na' : ''} ${colorAttrs(p.branch, p.node.color)} data-i="${i}"${v !== null ? ` data-v="${v}"` : ''} cx="${n2(x)}" cy="${n2(y)}" r="${NR}"/>`;
      marks += canFocus ? focusable(ctx, 'lc-pt-tree', text(p), c, x, y - NR) : c;
      // Leaves: label to the right. Inner nodes: label above-right, within one column.
      const lx = leaf ? x + NR + 4 : x + NR + 2;
      const ly = leaf ? y + LFS * 0.36 : y - NR - 3;
      const room = leaf ? ctx.W - lx - 4 : step - NR - 8;
      const full = shown(p);
      const txt = lw(full) <= room ? full : truncate(p.node.label, room / 1.12, LFS);
      if (room >= lw('가…')) labels += `<text class="lc-tree-lbl${leaf ? '' : ' lc-tree-in'}" x="${n2(lx)}" y="${n2(ly)}">${esc(txt)}</text>`;
    });
    const svg = `<g class="lc-tree-links" aria-hidden="true">${links}</g><g class="lc-tree-marks">${marks}</g><g class="lc-tree-labels" aria-hidden="true">${labels}</g>`;

    const leaves = nodes.filter((p) => !p.node.children?.length).length;
    const present = nodes.filter((p) => val(p) !== null);
    const missing = hasValues ? nodes.length - present.length : 0;
    const hi = present.length ? present.reduce((a, p) => ((val(p) as number) > (val(a) as number) ? p : a)) : undefined;
    const lo = present.length ? present.reduce((a, p) => ((val(p) as number) < (val(a) as number) ? p : a)) : undefined;
    const quals = [...new Set(nodes.map((p) => p.node.quality).filter((q): q is string => !!q))];
    const desc = `${nodes.length}${L2.nodes}, ${depth + 1}${ctx.lang === 'ko' ? '' : ' '}${L2.levels}, ${L2.leaves} ${leaves}. ${text(nodes[0] as Placed)}.` +
      (hasValues && hi && lo ? ` ${t.max} ${fmt(val(hi) as number)} (${hi.node.label}), ${t.min} ${fmt(val(lo) as number)} (${lo.node.label}).` : '') +
      (missing ? ` ${t.missing} ${missing}.` : '') + (quals.length ? ` ${t.quality}: ${quals.join(', ')}.` : '');
    const tbl = table(t, spec.title, [t.cat, L2.level, ...(hasValues ? [t.value] : []), L2.kids], nodes.map((p) => {
      const v = val(p);
      return {
        th: `${[...p.parents, p.node.label].join(' › ')}${p.node.quality ? ` (${p.node.quality})` : ''}`,
        cells: [String(p.depth + 1), ...(hasValues ? [v === null ? null : fmt(v)] : []), String(p.node.children?.length ?? 0)],
      };
    }));
    return frame(ctx, spec, svg, desc, '', wrapTable(spec.table ?? 'details', t, tbl));
  },
});
