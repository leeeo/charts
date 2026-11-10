// Beeswarm: one horizontal numeric axis, one row per group; every sample is a dot at its exact x, pushed up/down
// deterministically (ascending value order, nearest free offset alternating below/above) so dots do not overlap.
// Optional threshold line (e.g. an SLO); dots beyond it get the lc-swarm-over class and are counted.
import type { BaseSpec, Value } from '../types.ts';
import { definePlugin } from '../plugin.ts';
import { BASE, MAX_POINTS, MAX_SERIES, base, color, dict, fail, idList, num, oneOf, optNum, optStr, str, value } from '../check.ts';
import { clamp, esc, makeFmt, n2, niceTicks, truncate, tw } from '../format.ts';
import { type Ctx, FS, MAX_FOCUS, colorAttrs, empty, focusable, frame, legend, table, wrapTable } from '../kit.ts';

export interface SwarmGroup {
  id: string;
  label: string;
  /** Raw samples; null = missing (not drawn, counted). */
  values: Value[];
  color?: string;
  quality?: string;
}

export interface SwarmThreshold {
  value: number;
  label?: string;
  /** Which side counts as a breach (default "above"). */
  direction?: 'above' | 'below';
}

export interface BeeswarmSpec extends BaseSpec {
  type: 'beeswarm';
  groups: SwarmGroup[];
  xLabel?: string;
  xMin?: number;
  xMax?: number;
  threshold?: SwarmThreshold;
  /** Dot radius in px (1.5..8); default 3.5, 2.5 when a group has more than 150 samples. */
  radius?: number;
}

const L = {
  ko: { thr: '임계값', above: '초과', below: '미만', values: '값', overlap: '공간이 부족해 일부 점이 겹침' },
  en: { thr: 'threshold', above: 'above', below: 'below', values: 'Values', overlap: 'some dots overlap for lack of space' },
};

/** Deterministic swarm offsets for x positions (any order); returns y offsets and whether any dot had to overlap. */
export function swarm(xs: number[], r: number, half: number): { off: number[]; overlap: boolean } {
  const order = xs.map((x, j) => ({ x, j })).sort((a, b) => a.x - b.x || a.j - b.j);
  const off = new Array<number>(xs.length).fill(0);
  const placed: { x: number; y: number }[] = [];
  const d2 = (2 * r - 0.01) ** 2;
  const step = r / 2;
  let lo = 0;
  let overlap = false;
  for (const p of order) {
    while (lo < placed.length && placed[lo]!.x < p.x - 2 * r) lo++;
    let y = 0;
    for (let k = 0; ; k++) {
      const c = k === 0 ? 0 : (k % 2 ? 1 : -1) * Math.ceil(k / 2) * step;
      if (Math.abs(c) > half) { y = 0; overlap = true; break; }
      let free = true;
      for (let m = lo; m < placed.length; m++) {
        const q = placed[m]!;
        if ((q.x - p.x) ** 2 + (q.y - c) ** 2 < d2) { free = false; break; }
      }
      if (free) { y = c; break; }
    }
    off[p.j] = y;
    placed.push({ x: p.x, y });
  }
  return { off, overlap };
}

function quantile(s: number[], p: number): number {
  const h = (s.length - 1) * p;
  const a = Math.floor(h);
  const b = Math.ceil(h);
  return s[a]! + (s[b]! - s[a]!) * (h - a);
}

export const plugin = definePlugin<BeeswarmSpec>({
  type: 'beeswarm',
  names: { ko: '벌떼 차트', en: 'Beeswarm' },
  validate(input) {
    const o = dict(input, 'spec', [...BASE, 'groups', 'xLabel', 'xMin', 'xMax', 'threshold', 'radius']);
    const out = base(o) as unknown as BeeswarmSpec;
    out.type = 'beeswarm';
    let total = 0;
    out.groups = idList(o.groups, 'groups', ['label', 'values', 'color', 'quality'], MAX_SERIES, (g, p, id) => {
      if (!Array.isArray(g.values)) fail(`${p}.values`, 'must be an array');
      total += g.values.length;
      if (total > MAX_POINTS) fail(`${p}.values`, `must have at most ${MAX_POINTS} entries`);
      const go: SwarmGroup = { id, label: str(g.label, `${p}.label`, 60), values: g.values.map((x, i) => value(x, `${p}.values[${i}]`)) };
      const c = color(g.color, `${p}.color`);
      const q = optStr(g.quality, `${p}.quality`, 60);
      if (c !== undefined) go.color = c;
      if (q !== undefined) go.quality = q;
      return go;
    });
    const xl = optStr(o.xLabel, 'xLabel', 60);
    if (xl !== undefined) out.xLabel = xl;
    const lo = optNum(o.xMin, 'xMin', -1e15, 1e15);
    const hi = optNum(o.xMax, 'xMax', -1e15, 1e15);
    if (lo !== undefined && hi !== undefined && lo >= hi) fail('xMax', 'must be greater than xMin');
    if (lo !== undefined) out.xMin = lo;
    if (hi !== undefined) out.xMax = hi;
    if (o.threshold !== undefined) {
      const th = dict(o.threshold, 'threshold', ['value', 'label', 'direction']);
      const tv: SwarmThreshold = { value: num(th.value, 'threshold.value') };
      const tl = optStr(th.label, 'threshold.label', 40);
      const dir = oneOf(th.direction, 'threshold.direction', ['above', 'below'] as const);
      if (tl !== undefined) tv.label = tl;
      if (dir !== undefined) tv.direction = dir;
      out.threshold = tv;
    }
    const r = optNum(o.radius, 'radius', 1.5, 8);
    if (r !== undefined) out.radius = r;
    return out;
  },
  height(spec, W) {
    return 34 + spec.groups.length * (W < 420 ? 56 : 72) + FS + 12 + (spec.xLabel ? FS + 6 : 0);
  },
  render(spec, ctx: Ctx) {
    const t = ctx.t;
    const L2 = L[ctx.lang];
    const th = spec.threshold;
    const data = spec.groups.flatMap((g) => g.values);
    const fmt = makeFmt(spec.unit, th ? [...data, th.value] : data);
    const fmtQ = (v: number): string => makeFmt(spec.unit, [...data, Math.round(v * 100) / 100])(v);
    const pres = data.filter((v): v is number => v !== null);
    const over = (v: number): boolean => (th ? (th.direction === 'below' ? v < th.value : v > th.value) : false);
    const q = (g: SwarmGroup): string => (g.quality ? ` · ${g.quality}` : '');
    const side = th?.direction === 'below' ? L2.below : L2.above;
    const thrName = th ? th.label ?? L2.thr : '';
    let overlapNote = false;

    let svg = '';
    if (!pres.length) svg = empty(ctx);
    else {
      let lo = Math.min(...pres);
      let hi = Math.max(...pres);
      if (th) { lo = Math.min(lo, th.value); hi = Math.max(hi, th.value); }
      if (spec.xMin !== undefined) lo = Math.min(lo, spec.xMin);
      if (spec.xMax !== undefined) hi = Math.max(hi, spec.xMax);
      const xd = niceTicks(lo, hi, ctx.W < 420 ? 4 : 6);
      const tickLabs = xd.ticks.map(fmt);
      const labMax = clamp(ctx.W * 0.26, 40, 140);
      const labs = spec.groups.map((g) => truncate(g.label, labMax, FS));
      const left = Math.max(...labs.map((l) => tw(l, FS)), tw(tickLabs[0]!, FS) / 2) + 14;
      const right = Math.max(10, tw(tickLabs[tickLabs.length - 1]!, FS) / 2 + 4);
      const pw = Math.max(20, ctx.W - left - right);
      const top = th ? FS + 12 : 8;
      const bottom = FS + 12 + (spec.xLabel ? FS + 6 : 0);
      const ph = Math.max(20, ctx.H - top - bottom);
      const rowH = ph / spec.groups.length;
      const sx = (v: number): number => left + ((v - xd.min) / (xd.max - xd.min || 1)) * pw;
      const r = spec.radius ?? (spec.groups.some((g) => g.values.length > 150) ? 2.5 : 3.5);
      const baseY = top + ph;
      xd.ticks.forEach((tk, k) => {
        const x = sx(tk);
        svg += `<line class="lc-grid" x1="${n2(x)}" x2="${n2(x)}" y1="${n2(top)}" y2="${n2(baseY)}"/>`;
        svg += `<text class="lc-tick" x="${n2(x)}" y="${n2(baseY + FS + 4)}" text-anchor="middle">${esc(tickLabs[k]!)}</text>`;
      });
      svg += `<line class="lc-axis" x1="${n2(left)}" x2="${n2(left + pw)}" y1="${n2(baseY)}" y2="${n2(baseY)}"/>`;
      if (spec.xLabel) svg += `<text class="lc-axis-title" x="${n2(left + pw / 2)}" y="${n2(ctx.H - 4)}" text-anchor="middle">${esc(truncate(spec.xLabel, pw, FS))}</text>`;
      const canFocus = pres.length <= MAX_FOCUS;
      spec.groups.forEach((g, i) => {
        const cy = top + rowH * (i + 0.5);
        if (i) svg += `<line class="lc-swarm-sep" x1="${n2(left)}" x2="${n2(left + pw)}" y1="${n2(top + rowH * i)}" y2="${n2(top + rowH * i)}"/>`;
        svg += `<text class="lc-swarm-label" x="${n2(left - 8)}" y="${n2(cy + FS * 0.36)}" text-anchor="end">${esc(labs[i]!)}</text>`;
        const idx = g.values.map((v, j) => (v === null ? -1 : j)).filter((j) => j >= 0);
        if (!idx.length) {
          svg += `<text class="lc-swarm-na" x="${n2(left + 6)}" y="${n2(cy + FS * 0.36)}">${esc(t.na)}</text>`;
          return;
        }
        const xs = idx.map((j) => sx(g.values[j] as number));
        const { off, overlap } = swarm(xs, r, Math.max(0, rowH / 2 - r - 1));
        if (overlap) overlapNote = true;
        const ca = colorAttrs(i, g.color);
        idx.forEach((j, m) => {
          const v = g.values[j] as number;
          const y = cy + off[m]!;
          const dot = `<circle class="lc-mark lc-swarm-dot${over(v) ? ' lc-swarm-over' : ''} ${ca} data-i="${i}" data-j="${j}" data-v="${v}" cx="${n2(xs[m]!)}" cy="${n2(y)}" r="${n2(r)}"/>`;
          svg += canFocus ? focusable(ctx, 'lc-pt-swarm', `${g.label}: ${fmt(v)}${over(v) ? ` · ${thrName} ${side}` : ''}${q(g)}`, dot, xs[m]!, y) : dot;
        });
      });
      if (th) {
        const x = sx(th.value);
        const lab = truncate(`${thrName} ${fmt(th.value)}`, pw, FS);
        const w = tw(lab, FS);
        svg += `<line class="lc-swarm-thr" x1="${n2(x)}" x2="${n2(x)}" y1="${n2(top - 4)}" y2="${n2(baseY)}"/>`;
        svg += `<text class="lc-swarm-thr-label" x="${n2(clamp(x, left + w / 2, ctx.W - 4 - w / 2))}" y="${n2(FS + 2)}" text-anchor="middle">${esc(lab)}</text>`;
      }
    }

    const missing = data.length - pres.length;
    const groupText = spec.groups.map((g) => {
      const xs = g.values.filter((v): v is number => v !== null).sort((a, b) => a - b);
      if (!xs.length) return `${g.label}: ${t.na}`;
      const nOver = xs.filter(over).length;
      return `${g.label}: ${t.count} ${xs.length}, ${t.median} ${fmtQ(quantile(xs, 0.5))}, ${t.min} ${fmt(xs[0]!)}, ${t.max} ${fmt(xs[xs.length - 1]!)}${th ? `, ${thrName} ${side} ${nOver}` : ''}${q(g)}`;
    }).join('. ');
    const desc = `${groupText}.${th ? ` ${thrName} ${fmt(th.value)}.` : ''}${missing ? ` ${t.missing} ${missing}.` : ''}${overlapNote ? ` ${L2.overlap}.` : ''}`;
    const lg = spec.legend === true ? legend(spec.groups.map((g, i) => ({ name: g.label, idx: i, ...(g.color ? { color: g.color } : {}), ...(g.quality ? { quality: g.quality } : {}) }))) : '';
    const head = [t.cat, t.count, t.min, t.median, t.max, ...(th ? [`${thrName} ${side}`] : []), t.missing, L2.values];
    const tbl = table(t, spec.title, head, spec.groups.map((g) => {
      const xs = g.values.filter((v): v is number => v !== null).sort((a, b) => a - b);
      const th2 = `${g.label}${g.quality ? ` (${g.quality})` : ''}`;
      const miss = String(g.values.length - xs.length);
      const thCell = th ? [String(xs.filter(over).length)] : [];
      if (!xs.length) return { th: th2, cells: ['0', null, null, null, ...thCell, miss, null] };
      return { th: th2, cells: [String(xs.length), fmt(xs[0]!), fmtQ(quantile(xs, 0.5)), fmt(xs[xs.length - 1]!), ...thCell, miss, g.values.map((v) => (v === null ? t.na : fmt(v))).join(', ')] };
    }));
    return frame(ctx, spec, svg, desc, lg, wrapTable(spec.table ?? 'details', t, tbl));
  },
});
