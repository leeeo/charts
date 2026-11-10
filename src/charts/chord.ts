// Chord diagram: groups as arcs around a circle (arc length proportional to the group's total), flows as ribbons
// between them. Input is a square `matrix` (matrix[i][j] = flow from group i to group j) or a `links` list.
// Directed (default): a group's arc = outflow + inflow; each ribbon starts full-width at the source's outflow
// section and ends in a point at the target's inflow section. Undirected: the matrix must be symmetric and each
// pair is one ribbon. A null flow is missing: not drawn, shown as 데이터 없음 and counted in the description.
import type { BaseSpec, Value } from '../types.ts';
import { definePlugin } from '../plugin.ts';
import { BASE, base, color, dict, fail, idList, optBool, optStr, put, str, value, values } from '../check.ts';
import { type Ctx, FS, MAX_FOCUS, colorAttrs, empty, focusable, frame, legend, pct, table, wrapTable } from '../kit.ts';
import { clamp, esc, makeFmt, n2, truncate, tw } from '../format.ts';

export interface ChordGroup { id: string; label: string; color?: string; quality?: string }
export interface ChordLink { source: string; target: string; value: Value; quality?: string }
export interface ChordSpec extends BaseSpec {
  type: 'chord';
  groups: ChordGroup[];
  /** matrix[i][j] = flow from groups[i] to groups[j]; null = missing. Give either matrix or links. */
  matrix?: Value[][];
  /** Flows by group id; pairs not listed are 0. */
  links?: ChordLink[];
  /** Default true. When false, flows have no direction and a matrix must be symmetric. */
  directed?: boolean;
}

const MAX_GROUPS = 40;
const MAX_LINKS = MAX_GROUPS * MAX_GROUPS;
const L = {
  ko: { groups: '그룹', flows: '흐름', flowTotal: '총 흐름', largest: '가장 큰 흐름', out: '유출', in: '유입', count: '개' },
  en: { groups: 'groups', flows: 'flows', flowTotal: 'Total flow', largest: 'Largest flow', out: 'out', in: 'in', count: '' },
};

/** Point on a circle; angle in radians, clockwise from 12 o'clock. */
const pt = (cx: number, cy: number, r: number, a: number): string => `${n2(cx + r * Math.sin(a))} ${n2(cy - r * Math.cos(a))}`;
const deg = (a: number): string => n2((a * 180) / Math.PI);

interface Flow { s: number; t: number; v: number; k: number }

export const plugin = definePlugin<ChordSpec>({
  type: 'chord',
  names: { ko: '코드 다이어그램', en: 'Chord diagram' },
  defaultWidth: 640,
  validate(input) {
    const o = dict(input, 'spec', [...BASE, 'groups', 'matrix', 'links', 'directed']);
    const out = base(o) as unknown as ChordSpec;
    out.type = 'chord';
    out.groups = idList(o.groups, 'groups', ['label', 'color', 'quality'], MAX_GROUPS, (it, p, id) => {
      const g: ChordGroup = { id, label: str(it.label, `${p}.label`, 60) };
      const r = g as unknown as Record<string, unknown>;
      put(r, 'color', color(it.color, `${p}.color`));
      put(r, 'quality', optStr(it.quality, `${p}.quality`, 60));
      return g;
    });
    const n = out.groups.length;
    const directed = optBool(o.directed, 'directed');
    put(out as unknown as Record<string, unknown>, 'directed', directed);
    if (o.matrix !== undefined && o.links !== undefined) fail('links', 'must not be combined with matrix');
    if (o.matrix !== undefined) {
      if (!Array.isArray(o.matrix)) fail('matrix', 'must be an array');
      if (o.matrix.length !== n) fail('matrix', `must have ${n} entries (one per label), got ${o.matrix.length}`);
      const m = (o.matrix as unknown[]).map((row, i) => values(row, `matrix[${i}]`, n, true));
      if (directed === false) {
        for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
          if (m[i]![j] !== m[j]![i]) fail(`matrix[${j}][${i}]`, 'must mirror the matrix when directed is false');
        }
      }
      out.matrix = m;
    } else if (o.links !== undefined) {
      if (!Array.isArray(o.links) || o.links.length === 0) fail('links', 'must be a non-empty array');
      if (o.links.length > MAX_LINKS) fail('links', `must have at most ${MAX_LINKS} entries`);
      const ids = new Set(out.groups.map((g) => g.id));
      const seen = new Set<string>();
      out.links = (o.links as unknown[]).map((item, i) => {
        const p = `links[${i}]`;
        const it = dict(item, p, ['source', 'target', 'value', 'quality']);
        const source = str(it.source, `${p}.source`, 64);
        const target = str(it.target, `${p}.target`, 64);
        if (!ids.has(source)) fail(`${p}.source`, 'must be the id of a group');
        if (!ids.has(target)) fail(`${p}.target`, 'must be the id of a group');
        const key = directed === false ? [source, target].sort().join('\u0000') : `${source}\u0000${target}`;
        if (seen.has(key)) fail(p, 'duplicate link');
        seen.add(key);
        const l: ChordLink = { source, target, value: value(it.value, `${p}.value`, 0) };
        put(l as unknown as Record<string, unknown>, 'quality', optStr(it.quality, `${p}.quality`, 60));
        return l;
      });
    } else fail('matrix', 'is required');
    return out;
  },
  height(_spec, W) {
    return Math.round(clamp(W * 0.75, 300, 600));
  },
  render(spec, ctx: Ctx) {
    const t = ctx.t;
    const l = L[ctx.lang];
    const directed = spec.directed !== false;
    const n = spec.groups.length;
    const gi = new Map(spec.groups.map((g, i) => [g.id, i]));
    // Full matrix: links mode fills unlisted pairs with 0 (undirected links fill both directions).
    const M: Value[][] = spec.matrix ?? spec.groups.map(() => new Array<Value>(n).fill(0));
    const linkQ: (string | undefined)[][] = spec.groups.map(() => new Array<string | undefined>(n).fill(undefined));
    let missing = 0;
    if (spec.links) {
      for (const lk of spec.links) {
        const s = gi.get(lk.source) as number;
        const d = gi.get(lk.target) as number;
        M[s]![d] = lk.value;
        linkQ[s]![d] = lk.quality;
        if (!directed) { M[d]![s] = lk.value; linkQ[d]![s] = lk.quality; }
        if (lk.value === null) missing++;
      }
    } else {
      for (let i = 0; i < n; i++) for (let j = directed ? 0 : i; j < n; j++) if (M[i]![j] === null) missing++;
    }
    const all = M.flat();
    const fmt = makeFmt(spec.unit, all);
    const at = (i: number, j: number): number => M[i]![j] ?? 0;
    const outT = spec.groups.map((_, i) => spec.groups.reduce((a, _g, j) => a + at(i, j), 0));
    const inT = spec.groups.map((_, i) => spec.groups.reduce((a, _g, j) => a + at(j, i), 0));
    const tot = directed ? outT.map((v, i) => v + inT[i]!) : outT;
    const flows: Flow[] = [];
    for (let i = 0; i < n; i++) {
      for (let j = directed ? 0 : i; j < n; j++) {
        const v = M[i]![j];
        if (v !== null && v !== undefined && v > 0) flows.push({ s: i, t: j, v, k: flows.length });
      }
    }
    const grand = flows.reduce((a, f) => a + f.v, 0);
    const lab = (i: number): string => spec.groups[i]!.label;
    const arrow = directed ? '→' : '–';
    const flowText = (f: Flow): string => {
      const q = linkQ[f.s]![f.t];
      return `${lab(f.s)} ${arrow} ${lab(f.t)}: ${fmt(f.v)} · ${pct(f.v / grand)}${q ? ` · ${q}` : ''}`;
    };
    const groupText = (i: number): string => {
      const g = spec.groups[i]!;
      return `${g.label}: ${t.total} ${fmt(tot[i]!)}${directed ? ` (${l.out} ${fmt(outT[i]!)}, ${l.in} ${fmt(inT[i]!)})` : ''}${g.quality ? ` · ${g.quality}` : ''}`;
    };

    let svg = '';
    if (!(grand > 0)) svg = empty(ctx);
    else {
      const labMax = Math.min(Math.max(...spec.groups.map((g) => tw(g.label, FS))), ctx.W * 0.2);
      const cx = ctx.W / 2;
      const cy = ctx.H / 2;
      const R = Math.max(30, Math.min(ctx.W / 2 - labMax - 10, ctx.H / 2 - FS - 10));
      const thick = clamp(R * 0.07, 6, 14);
      const r = R - thick - 2;
      const nz = tot.filter((v) => v > 0).length;
      const pad = Math.min(0.04, (2 * Math.PI * 0.25) / nz);
      const sumTot = tot.reduce((a, b) => a + b, 0);
      const kA = (2 * Math.PI - pad * nz) / sumTot;
      const arc0 = new Array<number>(n).fill(0);
      const arc1 = new Array<number>(n).fill(0);
      // segOut[i][j]: start angle of the i->j flow inside i's arc; segIn[j][i]: start of i->j inside j's arc.
      const segOut: number[][] = spec.groups.map(() => new Array<number>(n).fill(0));
      const segIn: number[][] = spec.groups.map(() => new Array<number>(n).fill(0));
      let a = pad / 2;
      for (let i = 0; i < n; i++) {
        arc0[i] = a;
        if (tot[i]! > 0) {
          let x = a;
          for (let j = 0; j < n; j++) { segOut[i]![j] = x; x += at(i, j) * kA; }
          if (directed) for (let j = 0; j < n; j++) { segIn[i]![j] = x; x += at(j, i) * kA; }
          a += tot[i]! * kA;
          arc1[i] = a;
          a += pad;
        } else arc1[i] = a;
      }
      const big = (x0: number, x1: number): number => (x1 - x0 > Math.PI ? 1 : 0);
      const canFocusRibbons = n + flows.length <= MAX_FOCUS;
      let ribbons = '';
      for (const f of flows) {
        const w = f.v * kA;
        const s0 = segOut[f.s]![f.t]!;
        const s1 = s0 + w;
        let d: string;
        let tm: number;
        if (directed) {
          const t0 = segIn[f.t]![f.s]!;
          const t1 = t0 + w;
          tm = (t0 + t1) / 2;
          const ah = Math.min(10, r * 0.08, (r * w) / 2 + 2);
          d = `M${pt(cx, cy, r, s0)}A${n2(r)} ${n2(r)} 0 ${big(s0, s1)} 1 ${pt(cx, cy, r, s1)}Q${n2(cx)} ${n2(cy)} ${pt(cx, cy, r - ah, t0)}L${pt(cx, cy, r, tm)}L${pt(cx, cy, r - ah, t1)}Q${n2(cx)} ${n2(cy)} ${pt(cx, cy, r, s0)}Z`;
        } else if (f.s === f.t) {
          tm = (s0 + s1) / 2;
          d = `M${pt(cx, cy, r, s0)}A${n2(r)} ${n2(r)} 0 ${big(s0, s1)} 1 ${pt(cx, cy, r, s1)}Q${n2(cx)} ${n2(cy)} ${pt(cx, cy, r, s0)}Z`;
        } else {
          const t0 = segOut[f.t]![f.s]!;
          const t1 = t0 + w;
          tm = (t0 + t1) / 2;
          d = `M${pt(cx, cy, r, s0)}A${n2(r)} ${n2(r)} 0 ${big(s0, s1)} 1 ${pt(cx, cy, r, s1)}Q${n2(cx)} ${n2(cy)} ${pt(cx, cy, r, t0)}A${n2(r)} ${n2(r)} 0 ${big(t0, t1)} 1 ${pt(cx, cy, r, t1)}Q${n2(cx)} ${n2(cy)} ${pt(cx, cy, r, s0)}Z`;
        }
        const sm = (s0 + s1) / 2;
        const ax = cx + r * 0.5 * (Math.sin(sm) + Math.sin(tm)) / 2;
        const ay = cy - r * 0.5 * (Math.cos(sm) + Math.cos(tm)) / 2;
        const inner = `<path class="lc-mark lc-ribbon ${colorAttrs(f.s, spec.groups[f.s]!.color)} data-i="${f.k}" data-s="${f.s}" data-t="${f.t}" data-v="${f.v}" d="${d}"/>`;
        ribbons += canFocusRibbons ? focusable(ctx, 'lc-pt-ribbon', flowText(f), inner, ax, ay) : inner;
      }
      let arcs = '';
      let labels = '';
      for (let i = 0; i < n; i++) {
        if (!(tot[i]! > 0)) continue;
        const a0 = arc0[i]!;
        const a1 = arc1[i]!;
        const d = `M${pt(cx, cy, R, a0)}A${n2(R)} ${n2(R)} 0 ${big(a0, a1)} 1 ${pt(cx, cy, R, a1)}L${pt(cx, cy, R - thick, a1)}A${n2(R - thick)} ${n2(R - thick)} 0 ${big(a0, a1)} 0 ${pt(cx, cy, R - thick, a0)}Z`;
        const am = (a0 + a1) / 2;
        const inner = `<path class="lc-mark lc-carc ${colorAttrs(i, spec.groups[i]!.color)} data-i="${i}" data-v="${tot[i]}" data-a0="${deg(a0)}" data-a1="${deg(a1)}" d="${d}"/>`;
        arcs += focusable(ctx, 'lc-pt-carc', groupText(i), inner, cx + R * Math.sin(am), cy - R * Math.cos(am));
        if ((a1 - a0) * R < FS + 2) continue;
        const sa = Math.sin(am);
        const ca = Math.cos(am);
        const rl = R + 6;
        const x = cx + rl * sa;
        const y = clamp(cy - rl * ca + FS * 0.36 - ca * FS * 0.3, FS, ctx.H - 3);
        const anchor = sa > 0.3 ? 'start' : sa < -0.3 ? 'end' : 'middle';
        const room = anchor === 'start' ? ctx.W - 3 - x : anchor === 'end' ? x - 3 : 2 * Math.min(x - 3, ctx.W - 3 - x);
        if (room > tw('…', FS)) labels += `<text class="lc-clabel" x="${n2(x)}" y="${n2(y)}" text-anchor="${anchor}">${esc(truncate(lab(i), Math.min(room, labMax + 20), FS))}</text>`;
      }
      svg = `<g class="lc-ribbons">${ribbons}</g><g class="lc-carcs">${arcs}</g><g class="lc-clabels" aria-hidden="true">${labels}</g>`;
    }

    let desc = `${n} ${l.groups}, ${flows.length} ${l.flows}.`;
    if (grand > 0) {
      const top = flows.reduce((b, f) => (f.v > b.v ? f : b), flows[0]!);
      desc += ` ${l.flowTotal} ${fmt(grand)}. ${l.largest}: ${lab(top.s)} ${arrow} ${lab(top.t)} ${fmt(top.v)} (${pct(top.v / grand)}).`;
    } else desc += ` ${t.na}.`;
    if (missing) desc += ` ${t.missing} ${missing}.`;
    const qs = [...new Set([...spec.groups.map((g) => g.quality), ...(spec.links ?? []).map((k) => k.quality)].filter((q): q is string => !!q))];
    if (qs.length) desc += ` ${t.quality}: ${qs.join(', ')}.`;

    const corner = directed ? `${t.from} \\ ${t.to}` : t.cat;
    const mTable = table(t, spec.title, [corner, ...spec.groups.map((g) => g.label)],
      spec.groups.map((g, i) => ({ th: g.label, cells: M[i]!.map((v) => (v === null ? null : fmt(v))) })));
    const gTable = table(t, `${spec.title} · ${l.groups}`, directed ? [t.cat, l.out, l.in, t.total] : [t.cat, t.total],
      spec.groups.map((g, i) => ({ th: `${g.label}${g.quality ? ` (${g.quality})` : ''}`, cells: directed ? [fmt(outT[i]!), fmt(inT[i]!), fmt(tot[i]!)] : [fmt(tot[i]!)] })));
    // The arc labels name the groups, so the legend is opt-in (legend: true), e.g. when many small arcs lose their label.
    const lg = spec.legend === true && grand > 0 ? legend(spec.groups.map((g, i) => ({ name: g.label, idx: i, ...(g.color ? { color: g.color } : {}), ...(g.quality ? { quality: g.quality } : {}) }))) : '';
    return frame(ctx, spec, svg, desc, lg, wrapTable(spec.table ?? 'details', t, mTable + gTable));
  },
});
