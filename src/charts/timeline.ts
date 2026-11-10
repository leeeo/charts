// Timeline (Gantt-like lanes): each item is a bar from `start` to `end` in its lane. Items that overlap in a lane stack
// into sub-rows (greedy, by start then input order), so bars never cover each other. The axis is numeric, minutes of a
// day (HH:MM) or dates (YYYY-MM-DD, end inclusive). Milestones are single points drawn as a diamond and a dashed line.
// An item whose start or end is null is missing: it is not drawn and shows as missing in the table and description.
import type { BaseSpec, Value } from '../types.ts';
import { definePlugin } from '../plugin.ts';
import { BASE, base, color, dict, fail, idList, num, oneOf, optStr, str, value } from '../check.ts';
import { type Ctx, FS, MAX_FOCUS, colorAttrs, empty, focusable, frame, table, wrapTable } from '../kit.ts';
import { esc, makeFmt, n2, niceTicks, truncate, tw } from '../format.ts';

export type TimelinePos = number | string;
export interface TimelineItem { id: string; lane: string; label: string; start: TimelinePos | null; end: TimelinePos | null; color?: string; quality?: string }
export interface TimelineMilestone { id: string; label: string; at: TimelinePos; lane?: string }
export interface TimelineSpec extends BaseSpec {
  type: 'timeline';
  /** "number" (default), "minutes" (minutes since midnight, shown as HH:MM) or "date" ('YYYY-MM-DD', end inclusive). */
  axis?: 'number' | 'minutes' | 'date';
  items: TimelineItem[];
  milestones?: TimelineMilestone[];
  xLabel?: string;
}

const MAX_ITEMS = 200;
const MAX_MS = 50;
const ROW = 22;
const BAR = 16;
const LANE_GAP = 6;
const LFS = 11;
const DAY = 86400000;
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const L = {
  ko: { lane: '레인', lanes: '개 레인', dur: '기간', longest: '가장 긴 항목', ms: '마일스톤', at: '시점', span: '범위' },
  en: { lane: 'Lane', lanes: ' lanes', dur: 'Duration', longest: 'Longest', ms: 'Milestone', at: 'At', span: 'Range' },
};

/** Day number since 1970-01-01 (UTC), or null for an invalid 'YYYY-MM-DD' string. Shared with skyline. */
export function dayNum(s: string): number | null {
  const m = DATE.exec(s);
  if (!m) return null;
  const y = Number(m[1]); const mo = Number(m[2]); const d = Number(m[3]);
  const ms = Date.UTC(y, mo - 1, d);
  const back = new Date(ms);
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d) return null;
  return ms / DAY;
}
export function dateArg(v: unknown, path: string): number {
  const n = typeof v === 'string' ? dayNum(v) : null;
  if (n === null) fail(path, 'must be a date YYYY-MM-DD');
  return n;
}
export const iso = (n: number): string => new Date(n * DAY).toISOString().slice(0, 10);
export const ymd = (n: number): [number, number, number] => { const d = new Date(n * DAY); return [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()]; };

const pad2 = (x: number): string => String(x).padStart(2, '0');
const hhmm = (m: number): string => { const r = Math.round(m); return `${pad2(Math.floor(r / 60))}:${pad2(r % 60)}`; };

/** Numeric position of a validated value; date ends are exclusive (+1 day) so a one-day item has width. */
function posOf(spec: TimelineSpec, v: TimelinePos, isEnd: boolean): number {
  if (spec.axis === 'date') return (dayNum(v as string) as number) + (isEnd ? 1 : 0);
  return v as number;
}

interface Layout { lanes: string[]; rows: number[]; row: Map<number, number>; laneOf: Map<number, number> }

function layout(spec: TimelineSpec): Layout {
  const lanes: string[] = [];
  const add = (l: string): number => { let i = lanes.indexOf(l); if (i < 0) { i = lanes.length; lanes.push(l); } return i; };
  const laneOf = new Map<number, number>();
  spec.items.forEach((it, i) => laneOf.set(i, add(it.lane)));
  for (const m of spec.milestones ?? []) if (m.lane !== undefined) add(m.lane);
  const row = new Map<number, number>();
  const rows = lanes.map((_, li) => {
    const idx = spec.items.map((_, i) => i).filter((i) => laneOf.get(i) === li && spec.items[i]?.start !== null && spec.items[i]?.end !== null);
    const s = (i: number): number => posOf(spec, spec.items[i]?.start as TimelinePos, false);
    const e = (i: number): number => posOf(spec, spec.items[i]?.end as TimelinePos, true);
    idx.sort((a, b) => s(a) - s(b) || a - b);
    const ends: number[] = [];
    for (const i of idx) {
      let r = ends.findIndex((x) => x <= s(i));
      if (r < 0) { r = ends.length; ends.push(e(i)); } else ends[r] = e(i);
      row.set(i, r);
    }
    return Math.max(1, ends.length);
  });
  return { lanes, rows, row, laneOf };
}

const topOf = (spec: TimelineSpec): number => (spec.milestones?.length ? FS + 14 : 6);
const axisH = (spec: TimelineSpec): number => FS + 12 + (spec.xLabel ? FS + 6 : 0);

function posArg(axis: TimelineSpec['axis'], v: unknown, path: string, nullable: boolean): TimelinePos | null {
  if (axis === 'date') {
    if (v === null && nullable) return null;
    dateArg(v, path);
    return v as string;
  }
  if (!nullable) return num(v, path, axis === 'minutes' ? 0 : -1e15, 1e15);
  return value(v, path, axis === 'minutes' ? 0 : undefined);
}

export const plugin = definePlugin<TimelineSpec>({
  type: 'timeline',
  names: { ko: '타임라인', en: 'Timeline' },
  defaultWidth: 720,
  validate(input) {
    const o = dict(input, 'spec', [...BASE, 'axis', 'items', 'milestones', 'xLabel']);
    const out = base(o) as unknown as TimelineSpec;
    out.type = 'timeline';
    const axis = oneOf(o.axis, 'axis', ['number', 'minutes', 'date'] as const);
    if (axis !== undefined) out.axis = axis;
    const cmp = (v: TimelinePos): number => (axis === 'date' ? (dayNum(v as string) as number) : (v as number));
    out.items = idList(o.items, 'items', ['lane', 'label', 'start', 'end', 'color', 'quality'], MAX_ITEMS, (it, p, id) => {
      const x: TimelineItem = {
        id, lane: str(it.lane, `${p}.lane`, 60), label: str(it.label, `${p}.label`, 80),
        start: posArg(axis, it.start, `${p}.start`, true), end: posArg(axis, it.end, `${p}.end`, true),
      };
      if (x.start !== null && x.end !== null && cmp(x.end) < cmp(x.start)) fail(`${p}.end`, 'must not be before start');
      const c = color(it.color, `${p}.color`);
      const q = optStr(it.quality, `${p}.quality`, 60);
      if (c !== undefined) x.color = c;
      if (q !== undefined) x.quality = q;
      return x;
    });
    if (o.milestones !== undefined) {
      out.milestones = idList(o.milestones, 'milestones', ['label', 'at', 'lane'], MAX_MS, (m, p, id) => {
        const x: TimelineMilestone = { id, label: str(m.label, `${p}.label`, 60), at: posArg(axis, m.at, `${p}.at`, false) as TimelinePos };
        const lane = optStr(m.lane, `${p}.lane`, 60);
        if (lane !== undefined) x.lane = lane;
        return x;
      });
    }
    const xl = optStr(o.xLabel, 'xLabel', 60);
    if (xl !== undefined) out.xLabel = xl;
    return out;
  },
  height(spec) {
    const lay = layout(spec);
    return topOf(spec) + lay.rows.reduce((a, r) => a + r * ROW + LANE_GAP, 0) + axisH(spec);
  },
  render(spec, ctx: Ctx) {
    const t = ctx.t;
    const L2 = L[ctx.lang];
    const axis = spec.axis ?? 'number';
    const items = spec.items;
    const ms = spec.milestones ?? [];
    const lay = layout(spec);
    const live = items.map((_, i) => i).filter((i) => items[i]?.start !== null && items[i]?.end !== null);
    const S = (i: number): number => posOf(spec, items[i]?.start as TimelinePos, false);
    const E = (i: number): number => posOf(spec, items[i]?.end as TimelinePos, true);

    const nums: Value[] = axis === 'number' ? [...items.flatMap((it) => [it.start as Value, it.end as Value]), ...ms.map((m) => m.at as number)] : [];
    const fmt = makeFmt(axis === 'number' ? spec.unit : undefined, nums);
    const posTxt = (v: TimelinePos): string => (axis === 'date' ? (v as string) : axis === 'minutes' ? hhmm(v as number) : fmt(v as number));
    const durTxt = (d: number): string => {
      if (axis === 'date') return ctx.lang === 'ko' ? `${d}일` : `${d} ${d === 1 ? 'day' : 'days'}`;
      if (axis === 'minutes') {
        const h = Math.floor(Math.round(d) / 60); const m = Math.round(d) % 60;
        if (ctx.lang === 'ko') return [h ? `${h}시간` : '', m || !h ? `${m}분` : ''].filter(Boolean).join(' ');
        return [h ? `${h}h` : '', m || !h ? `${m}m` : ''].filter(Boolean).join(' ');
      }
      return fmt(d);
    };
    const dur = (i: number): number => E(i) - S(i);
    const itemText = (i: number): string => {
      const it = items[i] as TimelineItem;
      const body = it.start === null || it.end === null ? t.na : `${posTxt(it.start)} – ${posTxt(it.end)} (${durTxt(dur(i))})`;
      return `${it.label}, ${it.lane}: ${body}${it.quality ? ` · ${it.quality}` : ''}`;
    };
    const msText = (m: TimelineMilestone): string => `${m.label}${m.lane ? `, ${m.lane}` : ''}: ${posTxt(m.at)}`;

    let svg = '';
    if (!live.length) svg = empty(ctx);
    else {
      // Domain over drawn items and milestones.
      const pts = [...live.flatMap((i) => [S(i), E(i)]), ...ms.map((m) => posOf(spec, m.at, false))];
      let lo = Math.min(...pts); let hi = Math.max(...pts);
      const labW = Math.min(Math.max(...lay.lanes.map((l) => tw(l, FS))) + 14, ctx.W * 0.3);
      const x0 = labW; const x1 = ctx.W - 10;
      const pw = Math.max(1, x1 - x0);
      let ticks: { v: number; txt: string }[] = [];
      const sample = axis === 'date' ? tw('12/31', FS) : axis === 'minutes' ? tw('00:00', FS) : Math.max(tw(fmt(lo), FS), tw(fmt(hi), FS));
      const maxT = Math.max(2, Math.floor(pw / (sample + 16)));
      if (axis === 'number') {
        const nt = niceTicks(lo, hi, Math.min(6, maxT));
        lo = nt.min; hi = nt.max;
        ticks = nt.ticks.map((v) => ({ v, txt: fmt(v) }));
      } else if (axis === 'minutes') {
        const step = [5, 10, 15, 30, 60, 120, 180, 240, 360, 720, 1440].find((s) => Math.ceil(hi / s) - Math.floor(lo / s) <= maxT) ?? 1440;
        lo = Math.floor(lo / step) * step; hi = Math.max(Math.ceil(hi / step) * step, lo + step);
        for (let v = lo; v <= hi; v += step) ticks.push({ v, txt: hhmm(v) });
      } else {
        if (hi <= lo) hi = lo + 1;
        const span = hi - lo;
        const dayStep = [1, 2, 7, 14].find((s) => span / s <= maxT);
        if (dayStep !== undefined) {
          for (let v = lo; v <= hi; v += dayStep) { const [, m, d] = ymd(v); ticks.push({ v, txt: `${m}/${d}` }); }
        } else {
          const monthStep = [1, 2, 3, 6, 12].find((s) => span / (30.4 * s) <= maxT) ?? 12;
          const [y0, m0] = ymd(lo);
          for (let k = 0; ; k++) {
            const mi = m0 - 1 + k;
            const y = y0 + Math.floor(mi / 12); const m = (mi % 12) + 1;
            if ((m - 1) % monthStep !== 0) continue;
            const v = Date.UTC(y, m - 1, 1) / DAY;
            if (v > hi) break;
            if (v >= lo) ticks.push({ v, txt: ctx.lang === 'ko' ? (m === 1 ? `${y}년 1월` : `${m}월`) : `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1]}${m === 1 ? ` ${y}` : ''}` });
          }
        }
      }
      const X = (v: number): number => x0 + ((v - lo) / (hi - lo || 1)) * pw;
      const top = topOf(spec);
      const laneTop: number[] = [];
      let yy = top;
      lay.rows.forEach((r) => { laneTop.push(yy); yy += r * ROW + LANE_GAP; });
      const plotB = yy - LANE_GAP / 2;

      let grid = '';
      let tickSvg = '';
      let lastR = -Infinity;
      for (const tk of ticks) {
        const x = X(tk.v);
        grid += `<line class="lc-grid" x1="${n2(x)}" y1="${n2(top)}" x2="${n2(x)}" y2="${n2(plotB)}"/>`;
        const w = tw(tk.txt, FS) * 1.12;
        const cx = Math.min(Math.max(x, w / 2 + 2), ctx.W - w / 2 - 2);
        if (cx - w / 2 < lastR + 6) continue;
        lastR = cx + w / 2;
        tickSvg += `<text class="lc-tick" x="${n2(cx)}" y="${n2(plotB + FS + 6)}" text-anchor="middle">${esc(tk.txt)}</text>`;
      }
      let lanesSvg = '';
      lay.lanes.forEach((l, li) => {
        const y = laneTop[li] as number;
        const h = (lay.rows[li] as number) * ROW;
        if (li > 0) lanesSvg += `<line class="lc-tl-sep" x1="0" y1="${n2(y - LANE_GAP / 2)}" x2="${n2(ctx.W)}" y2="${n2(y - LANE_GAP / 2)}"/>`;
        lanesSvg += `<text class="lc-tl-lane" x="4" y="${n2(y + h / 2 + FS * 0.36)}">${esc(truncate(l, labW - 12, FS))}</text>`;
      });
      const canFocus = live.length + ms.length <= MAX_FOCUS;
      let marks = '';
      let labelsSvg = '';
      for (const i of live) {
        const it = items[i] as TimelineItem;
        const li = lay.laneOf.get(i) as number;
        const x = X(S(i));
        const w = Math.max(X(E(i)) - x, 2);
        const y = (laneTop[li] as number) + (lay.row.get(i) as number) * ROW + (ROW - BAR) / 2;
        const rect = `<rect class="lc-mark lc-tl${it.quality ? ' lc-tl-q' : ''} ${colorAttrs(li, it.color)} data-i="${i}" data-v="${n2(dur(i))}" x="${n2(x)}" y="${n2(y)}" width="${n2(w)}" height="${BAR}" rx="3"/>`;
        marks += canFocus ? focusable(ctx, 'lc-pt-tl', itemText(i), rect, x + w / 2, y) : rect;
        if (w - 8 >= tw('가…', LFS)) labelsSvg += `<text class="lc-tl-lbl" x="${n2(x + 4)}" y="${n2(y + BAR / 2 + LFS * 0.36)}">${esc(truncate(it.label, w - 8, LFS))}</text>`;
      }
      let msSvg = '';
      let msLabels = '';
      let msR = -Infinity;
      const order = ms.map((_, i) => i).sort((a, b) => posOf(spec, (ms[a] as TimelineMilestone).at, false) - posOf(spec, (ms[b] as TimelineMilestone).at, false) || a - b);
      for (const k of order) {
        const m = ms[k] as TimelineMilestone;
        const x = X(posOf(spec, m.at, false));
        const li = m.lane === undefined ? -1 : lay.lanes.indexOf(m.lane);
        const y1 = li < 0 ? top : (laneTop[li] as number);
        const y2 = li < 0 ? plotB : (laneTop[li] as number) + (lay.rows[li] as number) * ROW;
        const dy = y1 + 1;
        const d = `M${n2(x)} ${n2(dy - 5)}L${n2(x + 5)} ${n2(dy)}L${n2(x)} ${n2(dy + 5)}L${n2(x - 5)} ${n2(dy)}Z`;
        const inner = `<line class="lc-tl-msline" x1="${n2(x)}" y1="${n2(y1)}" x2="${n2(x)}" y2="${n2(y2)}"/><path class="lc-mark lc-ms" data-i="${k}" data-v="${n2(posOf(spec, m.at, false))}" d="${d}"/>`;
        msSvg += canFocus ? focusable(ctx, 'lc-pt-ms', msText(m), inner, x, dy) : inner;
        const txt = truncate(m.label, Math.min(140, ctx.W - 4), LFS);
        const w = tw(txt, LFS) * 1.12;
        const cx = Math.min(Math.max(x, w / 2 + 2), ctx.W - w / 2 - 2);
        if (cx - w / 2 >= msR + 6) {
          msR = cx + w / 2;
          msLabels += `<text class="lc-tl-mslbl" x="${n2(cx)}" y="${n2(FS)}" text-anchor="middle">${esc(txt)}</text>`;
        }
      }
      const axisSvg = `<line class="lc-axis" x1="${n2(x0)}" y1="${n2(plotB)}" x2="${n2(x1)}" y2="${n2(plotB)}"/>`;
      const xl = spec.xLabel ? `<text class="lc-axis-title" x="${n2((x0 + x1) / 2)}" y="${n2(plotB + 2 * FS + 14)}" text-anchor="middle">${esc(truncate(spec.xLabel, ctx.W - 8, FS))}</text>` : '';
      svg = `<g aria-hidden="true">${grid}${lanesSvg}</g><g class="lc-tl-marks">${marks}</g><g class="lc-tl-labels" aria-hidden="true">${labelsSvg}</g>` +
        `<g class="lc-tl-ms">${msSvg}</g><g aria-hidden="true">${msLabels}${axisSvg}${tickSvg}${xl}</g>`;
    }

    const missing = items.length - live.length;
    const longest = [...live].sort((a, b) => dur(b) - dur(a) || a - b)[0];
    const quals = [...new Set(items.map((it) => it.quality).filter((q): q is string => !!q))];
    const first = live.length ? live.reduce((a, i) => (S(i) < S(a) ? i : a)) : undefined;
    const last = live.length ? live.reduce((a, i) => (E(i) > E(a) ? i : a)) : undefined;
    const desc = `${items.length}${t.items}, ${lay.lanes.length}${L2.lanes}.` +
      (first !== undefined && last !== undefined ? ` ${L2.span}: ${posTxt(items[first]?.start as TimelinePos)} – ${posTxt(items[last]?.end as TimelinePos)}.` : '') +
      (longest !== undefined ? ` ${L2.longest}: ${itemText(longest)}.` : '') +
      (ms.length ? ` ${L2.ms} ${ms.length}: ${ms.map(msText).join(', ')}.` : '') +
      (missing ? ` ${t.missing} ${missing}.` : '') + (quals.length ? ` ${t.quality}: ${quals.join(', ')}.` : '');
    let tbl = table(t, spec.title, [t.cat, L2.lane, t.start, t.end, L2.dur], items.map((it, i) => ({
      th: `${it.label}${it.quality ? ` (${it.quality})` : ''}`,
      cells: [it.lane, it.start === null ? null : posTxt(it.start), it.end === null ? null : posTxt(it.end), it.start === null || it.end === null ? null : durTxt(dur(i))],
    })));
    if (ms.length) tbl += table(t, `${spec.title} · ${L2.ms}`, [L2.ms, L2.lane, L2.at], ms.map((m) => ({ th: m.label, cells: [m.lane ?? '–', posTxt(m.at)] })));
    return frame(ctx, spec, svg, desc, '', wrapTable(spec.table ?? 'details', t, tbl));
  },
});
