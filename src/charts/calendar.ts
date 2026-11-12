// Calendar heatmap: one cell per day for a date range, weeks as columns (Monday first), weekdays as rows, month labels on top.
// Days without an entry (or with value null) are missing and drawn as dashed outlines, never as 0.
import type { BaseSpec, Value } from '../types.ts';
import { definePlugin } from '../plugin.ts';
import { BASE, MAX_POINTS, base, color, dict, fail, optNum, optStr, value } from '../check.ts';
import { esc, makeFmt, n2, tw } from '../format.ts';
import { type Ctx, FS, MAX_FOCUS, colorAttrs, empty, focusable, frame, table, wrapTable } from '../kit.ts';
import { level, scaleLegend } from './heatmap.ts';

export interface CalendarDay { date: string; value: Value }

export interface CalendarSpec extends BaseSpec {
  type: 'calendar';
  /** One entry per day, 'YYYY-MM-DD'. Days without an entry are missing. */
  data: CalendarDay[];
  /** Range bounds; default = first/last date in data. */
  start?: string;
  end?: string;
  /** Scale bounds; default = data min/max. */
  min?: number;
  max?: number;
  color?: string;
  quality?: string;
}

const MAX_DAYS = 800;
const DAY = 86400000;
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const WD = { ko: ['월', '화', '수', '목', '금', '토', '일'], en: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] };
const MON_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const L = { ko: { weekday: '요일', days: '일', total: '합계' }, en: { weekday: 'Weekday', days: ' days', total: 'total' } };

/** Day number since 1970-01-01 (UTC), or null for an invalid date string. */
function dayNum(s: string): number | null {
  const m = DATE.exec(s);
  if (!m) return null;
  const y = Number(m[1]); const mo = Number(m[2]); const d = Number(m[3]);
  const ms = Date.UTC(y, mo - 1, d);
  const back = new Date(ms);
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d) return null;
  return ms / DAY;
}

function dateArg(v: unknown, path: string): number {
  if (typeof v !== 'string') fail(path, 'must be a date YYYY-MM-DD');
  const n = dayNum(v);
  if (n === null) fail(path, 'must be a date YYYY-MM-DD');
  return n;
}

const iso = (n: number): string => new Date(n * DAY).toISOString().slice(0, 10);
/** Monday = 0 .. Sunday = 6 (1970-01-01 was a Thursday). */
const wday = (n: number): number => (((n + 3) % 7) + 7) % 7;

function rangeOf(spec: CalendarSpec): [number, number] | null {
  const ds = spec.data.map((d) => dayNum(d.date) as number);
  const s = spec.start !== undefined ? dayNum(spec.start) : ds.length ? Math.min(...ds) : null;
  const e = spec.end !== undefined ? dayNum(spec.end) : ds.length ? Math.max(...ds) : null;
  return s === null || e === null ? null : [s, e];
}

const LEFT_PAD = 8;
const topH = FS + 8;
const leftOf = (lang: 'ko' | 'en'): number => Math.max(...WD[lang].map((w) => tw(w, FS))) + LEFT_PAD;
const weeksOf = (s: number, e: number): number => Math.floor((e - (s - wday(s))) / 7) + 1;

export const plugin = definePlugin<CalendarSpec>({
  type: 'calendar',
  names: { ko: '캘린더 히트맵', en: 'Calendar heatmap' },
  defaultWidth: 960,
  validate(input) {
    const o = dict(input, 'spec', [...BASE, 'data', 'start', 'end', 'min', 'max', 'color', 'quality']);
    const out = base(o) as unknown as CalendarSpec;
    out.type = 'calendar';
    const s = o.start === undefined ? undefined : dateArg(o.start, 'start');
    const e = o.end === undefined ? undefined : dateArg(o.end, 'end');
    if (s !== undefined && e !== undefined && e < s) fail('end', 'must not be before start');
    if (!Array.isArray(o.data)) fail('data', 'must be an array');
    if (o.data.length > MAX_POINTS) fail('data', `must have at most ${MAX_POINTS} entries`);
    const seen = new Set<number>();
    out.data = o.data.map((d, i) => {
      const p = `data[${i}]`;
      const x = dict(d, p, ['date', 'value']);
      const n = dateArg(x.date, `${p}.date`);
      if (seen.has(n)) fail(`${p}.date`, 'duplicate date');
      seen.add(n);
      if ((s !== undefined && n < s) || (e !== undefined && n > e)) fail(`${p}.date`, 'must be between start and end');
      return { date: x.date as string, value: value(x.value, `${p}.value`) };
    });
    if (s !== undefined) out.start = o.start as string;
    if (e !== undefined) out.end = o.end as string;
    const r = rangeOf(out);
    if (r && r[1] - r[0] + 1 > MAX_DAYS) fail(e !== undefined ? 'end' : 'data', `must span at most ${MAX_DAYS} days`);
    const lo = optNum(o.min, 'min', -1e15, 1e15);
    const hi = optNum(o.max, 'max', -1e15, 1e15);
    if (lo !== undefined && hi !== undefined && lo >= hi) fail('max', 'must be greater than min');
    if (lo !== undefined) out.min = lo;
    if (hi !== undefined) out.max = hi;
    const c = color(o.color, 'color');
    const q = optStr(o.quality, 'quality', 60);
    if (c !== undefined) out.color = c;
    if (q !== undefined) out.quality = q;
    return out;
  },
  height(spec, W) {
    const r = rangeOf(spec);
    const weeks = r ? weeksOf(r[0], r[1]) : 53;
    const cs = Math.max(4, Math.min(22, (W - leftOf(spec.lang ?? 'ko') - 8) / weeks));
    return Math.round(topH + 7 * cs + 8);
  },
  render(spec, ctx: Ctx) {
    const t = ctx.t;
    const wd = WD[ctx.lang];
    const L2 = L[ctx.lang];
    const r = rangeOf(spec);
    const byDay = new Map<number, Value>(spec.data.map((d) => [dayNum(d.date) as number, d.value]));
    const all: Value[] = spec.data.map((d) => d.value);
    const fmt = makeFmt(spec.unit, all);
    const pres = all.filter((v): v is number => v !== null);
    const lo = spec.min ?? (pres.length ? Math.min(...pres) : 0);
    const hi = spec.max ?? (pres.length ? Math.max(...pres) : 0);
    const dayText = (n: number, v: Value): string => `${iso(n)} (${wd[wday(n)]}): ${v === null ? t.na : fmt(v)}${spec.quality ? ` · ${spec.quality}` : ''}`;
    const days: number[] = [];
    if (r) for (let n = r[0]; n <= r[1]; n++) days.push(n);

    let svg = '';
    if (!r || !pres.length) svg = empty(ctx);
    else {
      const [s, e] = r;
      const left = leftOf(ctx.lang);
      const weeks = weeksOf(s, e);
      const cs = Math.max(1, Math.min(22, (ctx.W - left - 8) / weeks, (ctx.H - topH - 8) / 7));
      const gap = Math.min(2, cs * 0.15);
      const s0 = s - wday(s);
      const col = (n: number): number => Math.floor((n - s0) / 7);
      // weekday labels (all, or every 2nd/3rd row when cells are small). A row shorter than the glyph plus 2px would
      // stack the labels into one column of touching letters (phone widths), so that steps to every 2nd row.
      const wstep = cs >= FS + 2 ? 1 : cs * 2 >= FS ? 2 : cs * 3 >= FS ? 3 : 7;
      for (let k = 0; k < 7; k += wstep) {
        svg += `<text class="lc-tick" x="${n2(left - 6)}" y="${n2(topH + cs * (k + 0.5) + FS * 0.36)}" text-anchor="end">${wd[k]}</text>`;
      }
      // month labels at the week column holding the 1st (and at the range start)
      let lastEnd = -Infinity;
      let first = true;
      for (const n of days) {
        const d = new Date(n * DAY);
        if (n !== s && d.getUTCDate() !== 1) continue;
        const m = d.getUTCMonth();
        const y = d.getUTCFullYear();
        const withYear = first || m === 0;
        const lab = ctx.lang === 'ko' ? (withYear ? `${y}년 ${m + 1}월` : `${m + 1}월`) : (withYear ? `${MON_EN[m]} ${y}` : MON_EN[m]!);
        const x = left + col(n) * cs;
        const w = tw(lab, FS);
        first = false;
        if (x < lastEnd + 6 || x + w > ctx.W - 2) continue;
        lastEnd = x + w;
        svg += `<text class="lc-tick lc-cal-month" x="${n2(x)}" y="${n2(topH - 6)}">${esc(lab)}</text>`;
      }
      const canFocus = days.length <= MAX_FOCUS;
      let cells = '';
      for (const n of days) {
        const v = byDay.has(n) ? byDay.get(n)! : null;
        const x = left + col(n) * cs + gap / 2;
        const y = topH + wday(n) * cs + gap / 2;
        const sz = Math.max(0.5, cs - gap);
        const i = n - s;
        const rx = n2(Math.min(2, sz * 0.2));
        const inner = v === null
          ? `<rect class="lc-day-na" data-i="${i}" data-date="${iso(n)}" x="${n2(x)}" y="${n2(y)}" width="${n2(sz)}" height="${n2(sz)}" rx="${rx}"/>`
          : `<rect class="lc-mark lc-day lc-cal-${level(v, lo, hi)}" data-i="${i}" data-v="${v}" data-date="${iso(n)}" x="${n2(x)}" y="${n2(y)}" width="${n2(sz)}" height="${n2(sz)}" rx="${rx}"/>`;
        cells += canFocus ? focusable(ctx, 'lc-pt-day', dayText(n, v), inner, x + sz / 2, y) : inner;
      }
      svg += `<g class="lc-cal ${colorAttrs(0, spec.color)}>${cells}</g>`;
    }

    const missing = days.filter((n) => (byDay.has(n) ? byDay.get(n) : null) === null).length;
    let desc = '';
    if (r && pres.length) {
      let mn = { n: 0, v: Infinity };
      let mx = { n: 0, v: -Infinity };
      for (const n of days) {
        const v = byDay.get(n);
        if (v === undefined || v === null) continue;
        if (v < mn.v) mn = { n, v };
        if (v > mx.v) mx = { n, v };
      }
      const sum = pres.reduce((a, b) => a + b, 0);
      desc = `${iso(r[0])}–${iso(r[1])}, ${days.length}${L2.days}. ${L2.total} ${fmt(sum)}, ${t.min} ${fmt(mn.v)} (${iso(mn.n)}), ${t.max} ${fmt(mx.v)} (${iso(mx.n)}).`;
    } else desc = `${t.na}.`;
    if (missing) desc += ` ${t.missing} ${missing}.`;
    if (spec.quality) desc += ` ${t.quality}: ${spec.quality}.`;
    const lg = spec.legend === false || !pres.length ? '' : scaleLegend('lc-cal-', lo, hi, fmt, t.na, missing > 0, colorAttrs(0, spec.color));
    const tbl = table(t, `${spec.title}${spec.quality ? ` (${spec.quality})` : ''}`, [t.date, L2.weekday, t.value],
      days.map((n) => {
        const v = byDay.get(n);
        return { th: iso(n), cells: [wd[wday(n)]!, v === undefined || v === null ? null : fmt(v)] };
      }));
    return frame(ctx, spec, svg, desc, lg, wrapTable(spec.table ?? 'details', t, tbl));
  },
});
