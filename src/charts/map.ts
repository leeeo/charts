// Map: choropleth of Korea's 17 provinces (시도). Values are keyed by province code ('11') or name ('서울',
// '서울특별시'); the validated copy is keyed by code. Equal-interval sequential classes (lc-map-0..6 over one hue).
// A null or absent province is hatched and listed as 데이터 없음, never coloured as the lowest class.
// Boundaries: src/geo/kr-sido.ts (CC BY 4.0); the attribution line is printed under the map.
import type { BaseSpec, Value } from '../types.ts';
import { definePlugin } from '../plugin.ts';
import { BASE, base, color, dict, fail, optBool, optNum, optStr, put, value } from '../check.ts';
import { type Ctx, colorAttrs, empty, focusable, frame, table, wrapTable } from '../kit.ts';
import { clamp, esc, makeFmt, n2, tw } from '../format.ts';
import { KR_SIDO, KR_SIDO_ATTRIBUTION, KR_SIDO_VIEWBOX } from '../geo/kr-sido.ts';

export interface MapSpec extends BaseSpec {
  type: 'map';
  /** Value per province, keyed by code ('11') or name ('서울' / '서울특별시'); null = missing. */
  values: Record<string, Value>;
  /** Number of colour classes (2..7, default 5). */
  classes?: number;
  /** Scale bounds; default = data min/max. Values outside are clamped to the end classes. */
  min?: number;
  max?: number;
  /** Print the short province name on the map (skipped where names would overlap). */
  labels?: boolean;
  /** With labels: add the value under the name. */
  showValues?: boolean;
  color?: string;
  quality?: string;
}

const LFS = 11;
const PAD = 8;
/** Label points where the stored centroid is not a good spot (경기 surrounds 서울, 경북's centroid lies in 대구). */
const LABEL_AT: Record<string, [number, number]> = { '41': [420, 241], '47': [639, 375] };
const L = {
  ko: { region: '시도', of: '17개 시도 중', count: '개', none: '데이터 없음' },
  en: { region: 'Province', of: 'of 17 provinces', count: '', none: 'No data' },
};

const byKey = new Map<string, string>();
for (const r of KR_SIDO) { byKey.set(r.code, r.code); byKey.set(r.short, r.code); byKey.set(r.name, r.code); }

/** Palette step 0..6 for class c of k. */
const step = (c: number, k: number): number => (k <= 1 ? 3 : Math.round((c * 6) / (k - 1)));

export const plugin = definePlugin<MapSpec>({
  type: 'map',
  names: { ko: '단계 구분도', en: 'Choropleth map' },
  defaultWidth: 480,
  validate(input) {
    const o = dict(input, 'spec', [...BASE, 'values', 'classes', 'min', 'max', 'labels', 'showValues', 'color', 'quality']);
    const out = base(o) as unknown as MapSpec;
    out.type = 'map';
    const vo = dict(o.values, 'values', [...byKey.keys()]);
    const got: Record<string, Value> = {};
    for (const [k, v] of Object.entries(vo)) {
      const code = byKey.get(k) as string;
      if (code in got) fail(`values.${k}`, 'duplicate id');
      got[code] = value(v, `values.${k}`);
    }
    out.values = {};
    for (const r of KR_SIDO) if (r.code in got) out.values[r.code] = got[r.code] as Value;
    const classes = optNum(o.classes, 'classes', 2, 7);
    if (classes !== undefined && !Number.isInteger(classes)) fail('classes', 'must be an integer');
    const lo = optNum(o.min, 'min', -1e15, 1e15);
    const hi = optNum(o.max, 'max', -1e15, 1e15);
    if (lo !== undefined && hi !== undefined && lo >= hi) fail('max', 'must be greater than min');
    const r = out as unknown as Record<string, unknown>;
    put(r, 'classes', classes);
    put(r, 'min', lo);
    put(r, 'max', hi);
    put(r, 'labels', optBool(o.labels, 'labels'));
    put(r, 'showValues', optBool(o.showValues, 'showValues'));
    put(r, 'color', color(o.color, 'color'));
    put(r, 'quality', optStr(o.quality, 'quality', 60));
    return out;
  },
  height(_spec, W) {
    return Math.round(clamp((W * KR_SIDO_VIEWBOX[1]) / KR_SIDO_VIEWBOX[0], 260, 680));
  },
  render(spec, ctx: Ctx) {
    const t = ctx.t;
    const l = L[ctx.lang];
    const vs: Value[] = KR_SIDO.map((r) => spec.values[r.code] ?? null);
    const fmt = makeFmt(spec.unit, vs);
    const pres = vs.filter((v): v is number => v !== null);
    const missingNames = KR_SIDO.filter((_, i) => vs[i] === null).map((r) => r.short);
    const k = spec.classes ?? 5;
    const lo = spec.min ?? (pres.length ? Math.min(...pres) : 0);
    const hi = spec.max ?? (pres.length ? Math.max(...pres) : 0);
    const cls = (v: number): number => (hi > lo ? clamp(Math.floor(((v - lo) / (hi - lo)) * k), 0, k - 1) : Math.floor(k / 2));
    const bounds = Array.from({ length: k + 1 }, (_, c) => Math.round((lo + ((hi - lo) * c) / k) * 100) / 100);
    const bfmt = makeFmt(spec.unit, [...vs, ...bounds]);
    const rangeText = (c: number): string => (hi > lo ? `${bfmt(bounds[c]!)}–${bfmt(bounds[c + 1]!)}` : bfmt(lo));
    const q = spec.quality ? ` · ${spec.quality}` : '';

    let svg = '';
    if (!pres.length) svg = empty(ctx);
    else {
      const [vw, vh] = KR_SIDO_VIEWBOX;
      const s = Math.min((ctx.W - 2 * PAD) / vw, (ctx.H - 2 * PAD) / vh);
      const ox = (ctx.W - vw * s) / 2;
      const oy = (ctx.H - vh * s) / 2;
      const tf = `translate(${n2(ox)} ${n2(oy)}) scale(${Math.round(s * 1e5) / 1e5})`;
      const hs = 6 / s;
      const hatchId = `${ctx.pid}-na`;
      const defs = missingNames.length
        ? `<defs><pattern id="${hatchId}" width="${n2(hs)}" height="${n2(hs)}" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect class="lc-map-nabg" width="${n2(hs)}" height="${n2(hs)}"/><path class="lc-map-hatch" d="M0 0V${n2(hs)}" stroke-width="${n2(1.2 / s)}"/></pattern></defs>`
        : '';
      const at = (i: number): [number, number] => {
        const r = KR_SIDO[i]!;
        const [x, y] = LABEL_AT[r.code] ?? [r.cx, r.cy];
        return [ox + x * s, oy + y * s];
      };
      let regions = '';
      KR_SIDO.forEach((r, i) => {
        const v = vs[i]!;
        const inner = v === null
          ? `<path class="lc-region-na" data-i="${i}" data-code="${r.code}" fill="url(#${hatchId})" transform="${tf}" vector-effect="non-scaling-stroke" d="${r.d}"/>`
          : `<path class="lc-mark lc-region lc-map-${step(cls(v), k)}" data-i="${i}" data-code="${r.code}" data-v="${v}" transform="${tf}" vector-effect="non-scaling-stroke" d="${r.d}"/>`;
        const [ax, ay] = at(i);
        regions += focusable(ctx, 'lc-pt-region', `${r.name}: ${v === null ? t.na : fmt(v)}${v === null ? '' : q}`, inner, ax, ay);
      });
      let labels = '';
      if (spec.labels) {
        const boxes: [number, number, number, number][] = [];
        KR_SIDO.forEach((r, i) => {
          const v = vs[i]!;
          const lines = [r.short, ...(spec.showValues && v !== null ? [fmt(v)] : [])];
          const w = Math.max(...lines.map((x) => tw(x, LFS))) + 2;
          const h = lines.length * (LFS + 2);
          const [px, py] = at(i);
          const x = clamp(px, w / 2 + 2, ctx.W - w / 2 - 2);
          const y0 = clamp(py - h / 2, 2, ctx.H - h - 2);
          const box: [number, number, number, number] = [x - w / 2, y0, x + w / 2, y0 + h];
          if (boxes.some((b) => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1])) return;
          boxes.push(box);
          labels += `<text class="lc-maplabel" x="${n2(x)}" y="${n2(y0 + LFS)}" text-anchor="middle">${lines.map((txt, j) => (j ? `<tspan x="${n2(x)}" dy="${LFS + 2}">${esc(txt)}</tspan>` : esc(txt))).join('')}</text>`;
        });
      }
      svg = `${defs}<g class="lc-map ${colorAttrs(0, spec.color)}>${regions}</g>${labels ? `<g class="lc-maplabels" aria-hidden="true">${labels}</g>` : ''}`;
    }

    let desc = `${l.of} ${pres.length}${l.count}.`;
    if (pres.length) {
      const iMin = vs.reduce<number>((b, v, i) => (v !== null && (b < 0 || v < (vs[b] as number)) ? i : b), -1);
      const iMax = vs.reduce<number>((b, v, i) => (v !== null && (b < 0 || v > (vs[b] as number)) ? i : b), -1);
      const mean = pres.reduce((a, b) => a + b, 0) / pres.length;
      desc += ` ${t.min} ${fmt(vs[iMin] as number)} (${KR_SIDO[iMin]!.short}), ${t.max} ${fmt(vs[iMax] as number)} (${KR_SIDO[iMax]!.short}), ${t.mean} ${makeFmt(spec.unit, [...vs, Math.round(mean * 100) / 100])(mean)}.`;
    } else desc += ` ${t.na}.`;
    if (missingNames.length) desc += ` ${t.missing} ${missingNames.length} (${missingNames.join(', ')}).`;
    if (spec.quality) desc += ` ${t.quality}: ${spec.quality}.`;

    let lg = '';
    if (pres.length) {
      lg = `<p class="lc-src">${esc(KR_SIDO_ATTRIBUTION)}</p>`;
      if (spec.legend !== false) {
        const items: string[] = [];
        const used = hi > lo ? Array.from({ length: k }, (_, c) => c) : [Math.floor(k / 2)];
        for (const c of used) items.push(`<li><span class="lc-sw lc-map-${step(c, k)}"></span><span class="lc-ln">${esc(rangeText(c))}</span></li>`);
        if (missingNames.length) items.push(`<li><span class="lc-sw lc-sw-mapna"></span><span class="lc-ln">${esc(l.none)}</span><span class="lc-lv">${esc(missingNames.join(', '))}</span></li>`);
        lg += `<ul class="lc-legend lc-map-legend ${colorAttrs(0, spec.color)}>${items.join('')}</ul>`;
      }
    }
    const tbl = table(t, `${spec.title}${spec.quality ? ` (${spec.quality})` : ''}`, [l.region, t.value, t.range],
      KR_SIDO.map((r, i) => {
        const v = vs[i]!;
        return { th: r.name, cells: v === null ? [null, null] : [fmt(v), rangeText(cls(v))] };
      }));
    return frame(ctx, spec, svg, desc, lg, wrapTable(spec.table ?? 'details', t, tbl));
  },
});
