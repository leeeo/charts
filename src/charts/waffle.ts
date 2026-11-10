// Waffle chart: shares as a grid of unit cells (10 per row). Default: 10x10 grid, one cell = 1% of the total.
// With `cellValue`, one cell = that many units and the grid grows by rows.
import type { BaseSpec, Slice } from '../types.ts';
import { definePlugin } from '../plugin.ts';
import { BASE, base, color, dict, fail, idList, optNum, optStr, str, value } from '../check.ts';
import { type Ctx, colorAttrs, empty, focusable, frame, legend, pct, table, wrapTable } from '../kit.ts';
import { makeFmt, n2 } from '../format.ts';

export interface WaffleSpec extends BaseSpec {
  type: 'waffle';
  /** Categories; null value = missing (no cells, listed as 데이터 없음). */
  items: Slice[];
  /** Units represented by one cell. Omitted: one cell = 1% of the total (always 100 cells). */
  cellValue?: number;
}

const COLS = 10;
const MAX_CELLS = 1000;
const L = {
  ko: { cell: (u: string) => `1칸 = ${u}` },
  en: { cell: (u: string) => `1 cell = ${u}` },
};

/** Cells per item: largest-remainder allocation to exactly 100 in percent mode, rounded units otherwise. */
function cellsFor(items: Slice[], cellValue: number | undefined): number[] {
  if (cellValue !== undefined) return items.map((s) => (s.value === null ? 0 : Math.round(s.value / cellValue)));
  const total = items.reduce((a, s) => a + (s.value ?? 0), 0);
  if (total <= 0) return items.map(() => 0);
  const raw = items.map((s) => (s.value === null ? 0 : (s.value / total) * 100));
  const out = raw.map(Math.floor);
  const rest = 100 - out.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => i).sort((a, b) => (raw[b]! - out[b]!) - (raw[a]! - out[a]!) || a - b);
  for (let k = 0; k < rest; k++) out[order[k]!]! += 1;
  return out;
}

const rowsFor = (spec: WaffleSpec): number =>
  spec.cellValue === undefined ? 10 : Math.max(1, Math.ceil(cellsFor(spec.items, spec.cellValue).reduce((a, b) => a + b, 0) / COLS));

const cellSize = (W: number, rows: number): number => Math.max(4, Math.min(28, (W - 8) / COLS, 600 / rows));

export const plugin = definePlugin<WaffleSpec>({
  type: 'waffle',
  names: { ko: '와플 차트', en: 'Waffle chart' },
  defaultWidth: 360,
  validate(input) {
    const o = dict(input, 'spec', [...BASE, 'items', 'cellValue']);
    const out = base(o) as unknown as WaffleSpec;
    out.type = 'waffle';
    out.items = idList(o.items, 'items', ['label', 'value', 'color', 'quality'], 12, (it, p, id) => {
      const s: Slice = { id, label: str(it.label, `${p}.label`, 60), value: value(it.value, `${p}.value`, 0) };
      const c = color(it.color, `${p}.color`);
      const q = optStr(it.quality, `${p}.quality`, 60);
      if (c !== undefined) s.color = c;
      if (q !== undefined) s.quality = q;
      return s;
    });
    const cv = optNum(o.cellValue, 'cellValue', 1e-6, 1e15);
    if (cv !== undefined) {
      out.cellValue = cv;
      if (cellsFor(out.items, cv).reduce((a, b) => a + b, 0) > MAX_CELLS) fail('cellValue', `is too small for the data (more than ${MAX_CELLS} cells)`);
    }
    return out;
  },
  height(spec, W) {
    const rows = rowsFor(spec);
    return Math.round(cellSize(W, rows) * rows + 8);
  },
  render(spec, ctx: Ctx) {
    const t = ctx.t;
    const L2 = L[ctx.lang];
    const fmt = makeFmt(spec.unit, [...spec.items.map((s) => s.value), spec.cellValue ?? null]);
    const total = spec.items.reduce((a, s) => a + (s.value ?? 0), 0);
    const cells = cellsFor(spec.items, spec.cellValue);
    const nCells = cells.reduce((a, b) => a + b, 0);
    const share = (v: number): string | null => (total > 0 ? pct(v / total) : null);
    const itemText = (s: Slice): string => (s.value === null ? `${s.label}: ${t.na}` : `${s.label}: ${fmt(s.value)}${total > 0 ? ` (${share(s.value)})` : ''}${s.quality ? ` · ${s.quality}` : ''}`);

    let svg = '';
    if (nCells === 0) svg = empty(ctx);
    else {
      const rows = spec.cellValue === undefined ? 10 : Math.max(1, Math.ceil(nCells / COLS));
      const cs = Math.max(2, Math.min((ctx.W - 8) / COLS, (ctx.H - 8) / rows));
      const gap = Math.max(1, cs * 0.12);
      const gx = (ctx.W - cs * COLS) / 2;
      const gy = (ctx.H - cs * rows) / 2;
      let k = 0;
      spec.items.forEach((s, i) => {
        if (s.value === null || cells[i] === 0) return;
        let rects = '';
        let ax = 0; let ay = 0;
        for (let c = 0; c < cells[i]!; c++, k++) {
          const x = gx + (k % COLS) * cs + gap / 2;
          const y = gy + Math.floor(k / COLS) * cs + gap / 2;
          if (c === 0) { ax = x + (cs - gap) / 2; ay = y; }
          rects += `<rect class="lc-mark lc-cell ${colorAttrs(i, s.color)} data-i="${i}" data-v="${s.value}" data-k="${k}" x="${n2(x)}" y="${n2(y)}" width="${n2(cs - gap)}" height="${n2(cs - gap)}" rx="${n2(Math.min(3, cs * 0.15))}"/>`;
        }
        // Categories are capped at 12 (< MAX_FOCUS), so every category is one tab stop.
        svg += focusable(ctx, 'lc-pt-waffle', itemText(s), rects, ax, ay);
      });
    }

    const missing = spec.items.filter((s) => s.value === null).length;
    const cellNote = L2.cell(spec.cellValue === undefined ? '1%' : fmt(spec.cellValue));
    const desc = `${t.total} ${fmt(total)}. ${cellNote}. ${spec.items.map(itemText).join(', ')}.${missing ? ` ${t.missing} ${missing}.` : ''}`;
    const lg = spec.legend === false ? '' : legend(spec.items.map((s, i) => ({
      name: s.label, idx: i, ...(s.color ? { color: s.color } : {}), ...(s.quality ? { quality: s.quality } : {}),
      extra: s.value === null ? t.na : `${fmt(s.value)}${total > 0 ? ` · ${share(s.value)}` : ''}`,
    })));
    const tbl = table(t, `${spec.title} (${cellNote})`, [t.cat, t.value, t.share, t.count], spec.items.map((s, i) => ({
      th: `${s.label}${s.quality ? ` (${s.quality})` : ''}`,
      cells: s.value === null ? [null, null, null] : [fmt(s.value), share(s.value), String(cells[i])],
    })));
    return frame(ctx, spec, svg, desc, lg, wrapTable(spec.table ?? 'details', t, tbl));
  },
});
