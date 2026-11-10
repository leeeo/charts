// Market map: a treemap of market capitalisation (area) coloured by price change in five steps
// (strong fall .. strong rise, plus flat and unknown). Every cell big enough carries its name and the signed change
// with a ▲/▼ mark, and the legend lists each step with its range in text, so the reading never relies on red/blue
// alone. Colours follow the up/down convention (kr: up red, down blue; global: up green, down red).
// Up to two levels: sector groups ({children}) or plain items. A missing cap leaves the item off the map (listed as
// missing); a missing change is drawn neutral and written 데이터 없음.
import type { BaseSpec, Value } from '../types.ts';
import { definePlugin } from '../plugin.ts';
import { BASE, MAX_POINTS, base, dict, fail, idList, num, oneOf, optStr, str, value } from '../check.ts';
import { esc, makeFmt, n2, truncate, tw } from '../format.ts';
import { type Ctx, MAX_FOCUS, empty, focusable, frame, pct, table, wrapTable } from '../kit.ts';
import { squarify } from './treemap.ts';
import { CONVENTIONS, type Convention, convCls } from './fin.ts';

export interface MarketLeaf { id: string; label: string; value: Value; change: Value; quality?: string }
export interface MarketGroup { id: string; label: string; children: MarketLeaf[] }
export type MarketItem = MarketLeaf | MarketGroup;

export interface MarketmapSpec extends BaseSpec {
  type: 'marketmap';
  /** value = market cap (area); change = price change in percent (e.g. 2.4 for +2.4%). */
  items: MarketItem[];
  /** Two ascending thresholds in percent for the colour steps (default [1, 3]): |change| < a is flat. */
  steps?: [number, number];
  convention?: Convention;
}

const LFS = 11;
const L = {
  ko: { cap: '시가총액', change: '등락률', flat: '보합', up: '상승', down: '하락', strong: '큰 ', na: '데이터 없음', group: '그룹', ups: '상승', downs: '하락', flats: '보합' },
  en: { cap: 'Market cap', change: 'Change', flat: 'flat', up: 'up', down: 'down', strong: 'strong ', na: 'no data', group: 'Group', ups: 'up', downs: 'down', flats: 'flat' },
};

const isGroup = (it: MarketItem): it is MarketGroup => 'children' in it;

/** Colour step of a change: -2..2 (0 = flat), or null when unknown. */
export function stepOf(change: Value, steps: [number, number]): -2 | -1 | 0 | 1 | 2 | null {
  if (change === null) return null;
  const a = Math.abs(change);
  const s = a < steps[0] ? 0 : a < steps[1] ? 1 : 2;
  return (s === 0 ? 0 : change > 0 ? s : -s) as -2 | -1 | 0 | 1 | 2;
}
const stepCls = (s: ReturnType<typeof stepOf>): string => (s === null ? 'lc-mm-na' : s === 0 ? 'lc-mm-0' : s > 0 ? `lc-mm-u${s}` : `lc-mm-d${-s}`);

export const signedPct = (c: number): string => `${c > 0 ? '▲' : c < 0 ? '▼' : ''}${c > 0 ? '+' : ''}${Math.round(c * 100) / 100}%`;

function render(spec: MarketmapSpec, ctx: Ctx): string {
  const t = ctx.t;
  const S = L[ctx.lang];
  const steps = spec.steps ?? [1, 3];
  const leaves: { lf: MarketLeaf; g: MarketGroup | null }[] = [];
  for (const it of spec.items) {
    if (isGroup(it)) for (const lf of it.children) leaves.push({ lf, g: it });
    else leaves.push({ lf: it, g: null });
  }
  const fmt = makeFmt(spec.unit, leaves.map((x) => x.lf.value));
  const total = leaves.reduce((a, x) => a + (x.lf.value ?? 0), 0);
  const leafText = (x: (typeof leaves)[number]): string => {
    const { lf, g } = x;
    return `${lf.label}${g ? `, ${g.label}` : ''}: ${S.change} ${lf.change === null ? S.na : signedPct(lf.change)} · ${S.cap} ${lf.value === null ? t.na : `${fmt(lf.value)}${total > 0 ? ` (${pct(lf.value / total)})` : ''}`}${lf.quality ? ` · ${lf.quality}` : ''}`;
  };
  let svg = '';
  if (total <= 0) svg = empty(ctx);
  else {
    const tops = spec.items.map((it) => (isGroup(it) ? it.children : [it]).reduce((a, c) => a + (c.value ?? 0), 0));
    const live = tops.map((v, i) => (v > 0 ? i : -1)).filter((i) => i >= 0);
    const rects = squarify(live.map((i) => tops[i]!), { x: 0, y: 0, w: ctx.W, h: ctx.H });
    const canFocus = leaves.length <= MAX_FOCUS;
    let marks = ''; let labs = ''; let outl = '';
    live.forEach((ti, k) => {
      const it = spec.items[ti]!;
      const tr = rects[k]!;
      const kids = isGroup(it) ? it.children : [it];
      const head = isGroup(it) && tr.h > LFS * 4 && tr.w > 40 ? LFS + 6 : 0;
      const area = { x: tr.x, y: tr.y + head, w: tr.w, h: tr.h - head };
      const ki = kids.map((_, i) => i).filter((i) => (kids[i]!.value ?? 0) > 0);
      const rs = isGroup(it) ? squarify(ki.map((i) => kids[i]!.value as number), area) : [area];
      if (head) {
        outl += `<rect class="lc-mm-head" x="${n2(tr.x)}" y="${n2(tr.y)}" width="${n2(tr.w)}" height="${n2(head)}"/>`;
        labs += `<text class="lc-mm-glbl" x="${n2(tr.x + 4)}" y="${n2(tr.y + LFS + 1)}">${esc(truncate(it.label, tr.w - 8, LFS))}</text>`;
      }
      ki.forEach((ci, j) => {
        const lf = kids[ci]!; const r = rs[j]!;
        const st = stepOf(lf.change, steps);
        const li = leaves.findIndex((x) => x.lf === lf);
        const rect = `<rect class="lc-mark lc-mm ${stepCls(st)}" data-i="${li}" data-v="${lf.value}" data-c="${lf.change ?? ''}" x="${n2(r.x)}" y="${n2(r.y)}" width="${n2(r.w)}" height="${n2(r.h)}"/>`;
        marks += canFocus ? focusable(ctx, 'lc-pt-mm', leafText(leaves[li]!), rect, r.x + r.w / 2, r.y + Math.min(r.h / 2, 18)) : rect;
        const room = r.w - 8;
        const tc = st === null ? 'lc-mm-tna' : Math.abs(st) === 2 ? 'lc-mm-tstrong' : 'lc-mm-tsoft';
        if (r.h >= LFS + 8 && room >= tw('가…', LFS)) {
          labs += `<text class="lc-mm-lbl ${tc}" x="${n2(r.x + 4)}" y="${n2(r.y + 4 + LFS)}">${esc(truncate(lf.label, room, LFS))}</text>`;
          const ct = lf.change === null ? S.na : signedPct(lf.change);
          if (r.h >= 2 * LFS + 12 && tw(ct, LFS) <= room) labs += `<text class="lc-mm-val ${tc}" x="${n2(r.x + 4)}" y="${n2(r.y + 8 + 2 * LFS)}">${esc(ct)}</text>`;
        }
      });
      if (isGroup(it)) outl += `<rect class="lc-tm-group" x="${n2(tr.x)}" y="${n2(tr.y)}" width="${n2(tr.w)}" height="${n2(tr.h)}"/>`;
    });
    svg = `<g class="lc-mm-marks">${marks}</g><g aria-hidden="true">${outl}</g><g class="lc-mm-labels" aria-hidden="true">${labs}</g>`;
  }
  const known = leaves.filter((x) => x.lf.change !== null && x.lf.value !== null);
  const ups = known.filter((x) => (x.lf.change as number) > 0).length;
  const downs = known.filter((x) => (x.lf.change as number) < 0).length;
  const byCap = [...leaves].filter((x) => x.lf.value !== null).sort((a, b) => (b.lf.value as number) - (a.lf.value as number));
  const capMissing = leaves.filter((x) => x.lf.value === null).length;
  const chMissing = leaves.filter((x) => x.lf.change === null).length;
  let desc = `${leaves.length}${t.items}. ${S.cap} ${t.total} ${fmt(total)}. ${S.ups} ${ups}, ${S.downs} ${downs}, ${S.flats} ${known.length - ups - downs}.`;
  if (byCap[0]) desc += ` ${leafText(byCap[0])}.`;
  if (capMissing) desc += ` ${S.cap} ${t.missing} ${capMissing}.`;
  if (chMissing) desc += ` ${S.change} ${t.missing} ${chMissing}.`;
  const [a, b] = steps;
  const legendItems: [string, string][] = [
    ['lc-mm-d2', `▼ ${S.strong}${S.down} (−${b}% ${ctx.lang === 'ko' ? '이하' : 'or less'})`],
    ['lc-mm-d1', `▼ ${S.down} (−${a}% ~ −${b}%)`],
    ['lc-mm-0', `${S.flat} (±${a}% ${ctx.lang === 'ko' ? '미만' : 'within'})`],
    ['lc-mm-u1', `▲ ${S.up} (+${a}% ~ +${b}%)`],
    ['lc-mm-u2', `▲ ${S.strong}${S.up} (+${b}% ${ctx.lang === 'ko' ? '이상' : 'or more'})`],
    ['lc-mm-na', S.na],
  ];
  const lg = spec.legend === false ? '' : `<ul class="lc-legend lc-mm-legend">${legendItems.map(([c, l]) => `<li><span class="lc-sw lc-mm-sw ${c}"></span><span class="lc-ln">${esc(l)}</span></li>`).join('')}</ul>`;
  const rows = leaves.map((x) => ({
    th: `${x.g ? `${x.g.label} › ` : ''}${x.lf.label}${x.lf.quality ? ` (${x.lf.quality})` : ''}`,
    cells: [x.lf.value === null ? null : fmt(x.lf.value), x.lf.value === null || total <= 0 ? null : pct(x.lf.value / total), x.lf.change === null ? null : signedPct(x.lf.change)],
  }));
  const tbl = table(t, spec.title, [t.cat, S.cap, t.share, S.change], rows);
  const cls = convCls(spec.convention);
  return frame(ctx, spec, svg, desc, lg, wrapTable(spec.table ?? 'details', t, tbl), cls ? { cls } : {});
}

function leaf(o: Record<string, unknown>, p: string, id: string): MarketLeaf {
  if (o.change === undefined) fail(`${p}.change`, 'is required');
  const r: MarketLeaf = { id, label: str(o.label, `${p}.label`, 60), value: value(o.value, `${p}.value`, 0), change: value(o.change, `${p}.change`) };
  if (r.change !== null && Math.abs(r.change) > 1000) fail(`${p}.change`, 'must be a finite number in [-1000, 1000]');
  const q = optStr(o.quality, `${p}.quality`, 60);
  if (q !== undefined) r.quality = q;
  return r;
}

export const plugin = definePlugin<MarketmapSpec>({
  type: 'marketmap',
  names: { ko: '시가총액 맵', en: 'Market map' },
  validate(input) {
    const o = dict(input, 'spec', [...BASE, 'items', 'steps', 'convention']);
    const out = base(o) as unknown as MarketmapSpec;
    out.type = 'marketmap';
    const seen = new Set<string>();
    let count = 0;
    const uniq = (id: string, p: string): void => { if (seen.has(id)) fail(`${p}.id`, 'duplicate id'); seen.add(id); };
    out.items = idList(o.items, 'items', ['label', 'value', 'change', 'children', 'quality'], 200, (it, p, id) => {
      uniq(id, p);
      if (it.children === undefined) { count++; return leaf(it, p, id); }
      for (const k of ['value', 'change', 'quality']) if (it[k] !== undefined) fail(`${p}.${k}`, 'unknown property');
      return {
        id, label: str(it.label, `${p}.label`, 60),
        children: idList(it.children, `${p}.children`, ['label', 'value', 'change', 'quality'], MAX_POINTS, (c, cp, cid) => {
          uniq(cid, cp);
          if (++count > 500) fail('items', 'must have at most 500 entries');
          return leaf(c, cp, cid);
        }),
      };
    });
    if (o.steps !== undefined) {
      if (!Array.isArray(o.steps) || o.steps.length !== 2) fail('steps', 'must have exactly 2 entries');
      const s0 = num(o.steps[0], 'steps[0]', 0.01, 100);
      const s1 = num(o.steps[1], 'steps[1]', 0.01, 100);
      if (s1 <= s0) fail('steps[1]', 'must be greater than steps[0]');
      out.steps = [s0, s1];
    }
    const cv = oneOf(o.convention, 'convention', CONVENTIONS);
    if (cv !== undefined) out.convention = cv;
    return out;
  },
  height: (_s, W) => (W < 420 ? 300 : 400),
  render,
});
