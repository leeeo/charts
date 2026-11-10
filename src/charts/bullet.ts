// Bullet chart: one row per KPI with qualitative range bands, the actual value as a bar and the target as a tick,
// on one shared scale starting at 0.
import type { BaseSpec, Value } from '../types.ts';
import { definePlugin } from '../plugin.ts';
import { BASE, base, color, dict, fail, idList, num, optNum, optStr, str, value } from '../check.ts';
import { type Ctx, colorAttrs, empty, focusable, frame, present, table, wrapTable } from '../kit.ts';
import { esc, makeFmt, n2, niceTicks, truncate, tw } from '../format.ts';

export interface BulletRow {
  id: string;
  label: string;
  /** Actual value; null = missing (no bar, listed as 데이터 없음). */
  value: Value;
  /** Target; omitted = no target, null = target missing. */
  target?: Value;
  /** Upper bounds of the qualitative bands (e.g. 나쁨/보통), sorted ascending; the rest of the scale is the last band. */
  ranges?: number[];
  quality?: string;
  color?: string;
}
export interface BulletSpec extends BaseSpec {
  type: 'bullet';
  rows: BulletRow[];
  /** Minimum axis maximum (the scale still grows to fit the data). */
  max?: number;
}

const ROW = 34;
const L = {
  ko: { achieved: '달성', rate: '달성률' },
  en: { achieved: 'of target', rate: 'Attainment' },
};

export const plugin = definePlugin<BulletSpec>({
  type: 'bullet',
  names: { ko: '불릿 차트', en: 'Bullet chart' },
  validate(input) {
    const o = dict(input, 'spec', [...BASE, 'rows', 'max']);
    const out = base(o) as unknown as BulletSpec;
    out.type = 'bullet';
    out.rows = idList(o.rows, 'rows', ['label', 'value', 'target', 'ranges', 'quality', 'color'], 30, (it, p, id) => {
      const r: BulletRow = { id, label: str(it.label, `${p}.label`, 60), value: value(it.value, `${p}.value`, 0) };
      if (it.target !== undefined) r.target = value(it.target, `${p}.target`, 0);
      if (it.ranges !== undefined) {
        if (!Array.isArray(it.ranges) || it.ranges.length === 0) fail(`${p}.ranges`, 'must be a non-empty array');
        if (it.ranges.length > 5) fail(`${p}.ranges`, 'must have at most 5 entries');
        r.ranges = it.ranges.map((x, k) => num(x, `${p}.ranges[${k}]`, 0)).sort((a, b) => a - b);
      }
      const q = optStr(it.quality, `${p}.quality`, 60);
      const c = color(it.color, `${p}.color`);
      if (q !== undefined) r.quality = q;
      if (c !== undefined) r.color = c;
      return r;
    });
    const max = optNum(o.max, 'max', 0, 1e15);
    if (max !== undefined) out.max = max;
    return out;
  },
  height(spec) {
    return spec.rows.length * ROW + 30;
  },
  render(spec, ctx: Ctx) {
    const t = ctx.t;
    const L2 = L[ctx.lang];
    const rows = spec.rows;
    const all: Value[] = rows.flatMap((r) => [r.value, r.target ?? null, ...(r.ranges ?? [])]);
    const fmt = makeFmt(spec.unit, all);
    const ach = (r: BulletRow): number | null => (r.value === null || r.target === undefined || r.target === null || r.target === 0 ? null : r.value / r.target);
    const achText = (a: number): string => `${Math.round(a * 1000) / 10}%`;
    const rowText = (r: BulletRow): string => {
      const a = ach(r);
      const tg = r.target === undefined ? '' : ` · ${t.target} ${r.target === null ? t.na : fmt(r.target)}`;
      return `${r.label}: ${r.value === null ? t.na : fmt(r.value)}${tg}${a !== null ? ` (${L2.achieved} ${achText(a)})` : ''}${r.quality ? ` · ${r.quality}` : ''}`;
    };
    const hasData = present(rows.flatMap((r) => [r.value, r.target ?? null])).length > 0;

    let svg = '';
    if (!hasData) svg = empty(ctx);
    else {
      const dmax = Math.max(spec.max ?? 0, ...present(all));
      const ticks = niceTicks(0, dmax, 5);
      const top = ticks.max;
      const labelW = Math.min(ctx.W * 0.32, Math.max(40, ...rows.map((r) => tw(r.label, 12) + 10)));
      const padR = tw(fmt(top), 12) / 2 + 2;
      const x0 = labelW; const pw = Math.max(10, ctx.W - labelW - padR);
      const X = (v: number): number => x0 + (Math.min(v, top) / top) * pw;
      rows.forEach((r, i) => {
        const y = 4 + i * ROW;
        const cy = y + 13;
        svg += `<text class="lc-bullet-lbl" x="0" y="${n2(cy + 4)}">${esc(truncate(r.label, labelW - 8, 12))}</text>`;
        svg += `<rect class="lc-bullet-bg" x="${n2(x0)}" y="${n2(cy - 10)}" width="${n2(pw)}" height="20"/>`;
        let from = 0;
        (r.ranges ?? []).forEach((to, k) => {
          if (to > from) svg += `<rect class="lc-bullet-range lc-br-${k}" data-k="${k}" x="${n2(X(from))}" y="${n2(cy - 10)}" width="${n2(X(to) - X(from))}" height="20"/>`;
          from = Math.max(from, to);
        });
        let inner = '';
        if (r.value !== null) inner += `<rect class="lc-mark lc-bullet ${colorAttrs(i, r.color)} data-i="${i}" data-v="${r.value}" x="${n2(x0)}" y="${n2(cy - 4)}" width="${n2(X(r.value) - x0)}" height="8"/>`;
        else inner += `<text class="lc-bullet-na" x="${n2(x0 + 4)}" y="${n2(cy + 4)}">${esc(truncate(t.na, pw - 8, 11))}</text>`;
        if (r.target !== undefined && r.target !== null) {
          const tx = X(r.target);
          inner += `<line class="lc-bullet-target" data-i="${i}" data-v="${r.target}" x1="${n2(tx)}" y1="${n2(cy - 8)}" x2="${n2(tx)}" y2="${n2(cy + 8)}"/>`;
        }
        // At most 30 rows (< MAX_FOCUS): every row is a tab stop, including rows whose value is missing.
        svg += focusable(ctx, 'lc-pt-bullet', rowText(r), inner, r.value !== null ? X(r.value) : x0, cy - 10);
      });
      const ay = 4 + rows.length * ROW;
      svg += ticks.ticks.map((tk) => `<line class="lc-grid" x1="${n2(X(tk))}" y1="${n2(ay - 6)}" x2="${n2(X(tk))}" y2="${n2(ay - 2)}"/><text class="lc-tick" x="${n2(X(tk))}" y="${n2(ay + 12)}" text-anchor="middle">${esc(fmt(tk))}</text>`).join('');
    }

    const missing = rows.filter((r) => r.value === null).length + rows.filter((r) => r.target === null).length;
    const desc = `${rows.length}${t.items}. ${rows.map(rowText).join(', ')}.${missing ? ` ${t.missing} ${missing}.` : ''}`;
    const tbl = table(t, spec.title, [t.cat, t.value, t.target, L2.rate, t.range], rows.map((r) => {
      const a = ach(r);
      return {
        th: `${r.label}${r.quality ? ` (${r.quality})` : ''}`,
        cells: [r.value === null ? null : fmt(r.value), r.target === undefined ? '–' : r.target === null ? null : fmt(r.target), a === null ? (r.target === undefined ? '–' : null) : achText(a), r.ranges ? r.ranges.map(fmt).join(' / ') : '–'],
      };
    }));
    return frame(ctx, spec, svg, desc, '', wrapTable(spec.table ?? 'details', t, tbl));
  },
});
