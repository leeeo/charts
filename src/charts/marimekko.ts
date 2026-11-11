// Marimekko (variable-width 100% stacked columns): column width = the column's share of the grand total,
// segment height = the series' share within its column. A null cell is missing: it is left out of the column
// (never drawn as 0), shown as 데이터 없음 in the table and counted in the description.
// Segment labels: name and share on one line, name over share when the segment is narrow but tall, share alone when
// only that fits. Hovering a segment keeps it and fades the rest (cmp.css).
import type { BaseSpec, Series } from '../types.ts';
import { definePlugin } from '../plugin.ts';
import { BASE, base, dict, fail, labels, seriesList, optStr, put } from '../check.ts';
import { esc, makeFmt, n2, truncate, tw } from '../format.ts';
import { type Ctx, FS, MAX_FOCUS, colorAttrs, empty, focusable, frame, legend, pct, table, wrapTable } from '../kit.ts';

export interface MarimekkoSpec extends BaseSpec {
  type: 'marimekko';
  /** Columns, e.g. apps or channels. */
  labels: string[];
  /** Segments stacked in every column, e.g. platforms. Values must be >= 0. */
  series: Series[];
  xLabel?: string;
}

export const MAX_MEKKO_COLUMNS = 40;
const Y_TICKS = [0, 0.25, 0.5, 0.75, 1];

export interface MekkoCell { s: number; i: number; v: number; inCol: number; ofAll: number; x: number; w: number; y0: number; y1: number }

/** Layout in unit space: x/w across [0, 1] of the width, y0/y1 across [0, 1] from the bottom. */
export function mekkoLayout(spec: MarimekkoSpec): { colTotals: number[]; grand: number; cells: MekkoCell[] } {
  const colTotals = spec.labels.map((_, i) => spec.series.reduce((a, se) => a + (se.values[i] ?? 0), 0));
  const grand = colTotals.reduce((a, b) => a + b, 0);
  const cells: MekkoCell[] = [];
  if (grand <= 0) return { colTotals, grand, cells };
  let x = 0;
  spec.labels.forEach((_, i) => {
    const tot = colTotals[i] ?? 0;
    const w = tot / grand;
    let y = 0;
    if (tot > 0) {
      spec.series.forEach((se, s) => {
        const v = se.values[i];
        if (v === null || v === undefined) return;
        const h = v / tot;
        cells.push({ s, i, v, inCol: h, ofAll: v / grand, x, w, y0: y, y1: y + h });
        y += h;
      });
    }
    x += w;
  });
  return { colTotals, grand, cells };
}

function render(spec: MarimekkoSpec, ctx: Ctx): string {
  const t = ctx.t;
  const L = ctx.lang === 'ko' ? { inCol: '열 내', ofAll: '전체' } : { inCol: 'in column', ofAll: 'of total' };
  const fmt = makeFmt(spec.unit, spec.series.flatMap((se) => se.values));
  const { colTotals, grand, cells } = mekkoLayout(spec);
  const missing = spec.series.reduce((a, se) => a + se.values.filter((v) => v === null).length, 0);
  const aria = (c: MekkoCell): string => {
    const se = spec.series[c.s] as Series;
    return `${spec.labels[c.i] ?? ''}, ${se.name}: ${fmt(c.v)} · ${L.inCol} ${pct(c.inCol)} · ${L.ofAll} ${pct(c.ofAll)}${se.quality ? ` · ${se.quality}` : ''}`;
  };
  let inner = '';
  if (!cells.length) inner = empty(ctx);
  else {
    const left = tw('100%', FS) + 12;
    const top = 6; const bottom = FS * 2 + 14 + (spec.xLabel ? FS + 6 : 0);
    const px = left; const py = top; const pw = Math.max(10, ctx.W - left - 6); const ph = Math.max(10, ctx.H - top - bottom);
    const X = (u: number): number => px + u * pw;
    const Y = (u: number): number => py + ph - u * ph;
    let s = '';
    for (const p of Y_TICKS) {
      s += `<line class="lc-grid" x1="${n2(px)}" y1="${n2(Y(p))}" x2="${n2(px + pw)}" y2="${n2(Y(p))}"/>`;
      s += `<text class="lc-tick" x="${n2(px - 6)}" y="${n2(Y(p) + FS * 0.35)}" text-anchor="end">${pct(p)}</text>`;
    }
    // column labels: name on the first line, share of the grand total below; skipped when the column is too narrow
    let x = 0;
    spec.labels.forEach((l, i) => {
      const w = (colTotals[i] ?? 0) / grand;
      const cw = w * pw; const cx = X(x + w / 2);
      x += w;
      if (cw < 22) return;
      const name = truncate(l, cw - 4, FS); const share = pct(w);
      s += `<text class="lc-tick" x="${n2(cx)}" y="${n2(py + ph + FS + 5)}" text-anchor="middle">${esc(name)}</text>`;
      if (tw(share, FS) <= cw - 4) s += `<text class="lc-tick lc-mekko-share" x="${n2(cx)}" y="${n2(py + ph + FS * 2 + 9)}" text-anchor="middle">${share}</text>`;
    });
    if (spec.xLabel) s += `<text class="lc-axis-title" x="${n2(px + pw / 2)}" y="${n2(ctx.H - 3)}" text-anchor="middle">${esc(truncate(spec.xLabel, pw, FS))}</text>`;
    const focus = cells.length <= MAX_FOCUS;
    let marks = '';
    for (const c of cells) {
      const se = spec.series[c.s] as Series;
      const rx = X(c.x); const rw = c.w * pw; const ry = Y(c.y1); const rh = (c.y1 - c.y0) * ph;
      let g = `<rect class="lc-mark lc-mekko ${colorAttrs(c.s, se.color)} data-s="${c.s}" data-i="${c.i}" data-v="${c.v}" x="${n2(rx)}" y="${n2(ry)}" width="${n2(rw)}" height="${n2(rh)}"/>`;
      if (rh >= FS + 4) {
        const share = pct(c.inCol);
        const full = `${se.name} ${share}`;
        const cx = n2(rx + rw / 2);
        if (tw(full, FS) <= rw - 8) g += `<text class="lc-mekko-lbl" x="${cx}" y="${n2(ry + rh / 2 + FS * 0.35)}" text-anchor="middle">${esc(full)}</text>`;
        else if (tw(se.name, FS) <= rw - 6 && tw(share, FS) <= rw - 6 && rh >= 2 * FS + 8) g += `<text class="lc-mekko-lbl" x="${cx}" y="${n2(ry + rh / 2 - 2)}" text-anchor="middle"><tspan x="${cx}">${esc(se.name)}</tspan><tspan x="${cx}" dy="${FS + 2}">${esc(share)}</tspan></text>`;
        else if (tw(share, FS) <= rw - 6) g += `<text class="lc-mekko-lbl" x="${cx}" y="${n2(ry + rh / 2 + FS * 0.35)}" text-anchor="middle">${esc(share)}</text>`;
      }
      marks += focus ? focusable(ctx, 'lc-pt-mekko', aria(c), g, rx + rw / 2, ry) : g;
    }
    inner = s + marks + `<line class="lc-axis" x1="${n2(px)}" y1="${n2(py + ph)}" x2="${n2(px + pw)}" y2="${n2(py + ph)}"/>`;
  }
  let desc = `${spec.labels.length}${t.items} × ${spec.series.length} ${t.series}. ${t.total} ${fmt(grand)}.`;
  if (grand > 0) {
    desc += ' ' + spec.labels.map((l, i) => {
      const tot = colTotals[i] ?? 0;
      const segs = cells.filter((c) => c.i === i).map((c) => `${spec.series[c.s]?.name ?? ''} ${pct(c.inCol)}`).join(', ');
      return `${l} ${fmt(tot)} (${pct(tot / grand)})${segs ? `: ${segs}` : ''}.`;
    }).join(' ');
  }
  if (missing) desc += ` ${t.missing} ${missing}.`;
  const q = spec.series.filter((se) => se.quality);
  if (q.length) desc += ` ${t.quality}: ${q.map((se) => `${se.name} ${se.quality}`).join(', ')}.`;
  const lg = spec.legend === false ? '' : legend(spec.series.map((se, i) => ({ name: se.name, idx: i, ...(se.color ? { color: se.color } : {}), ...(se.quality ? { quality: se.quality } : {}) })));
  const tbl = table(t, spec.title, [t.cat, ...spec.series.map((se) => `${se.name}${se.quality ? ` (${se.quality})` : ''}`), t.total, t.share], spec.labels.map((l, i) => {
    const tot = colTotals[i] ?? 0;
    return {
      th: l,
      cells: [
        ...spec.series.map((se) => { const v = se.values[i]; return v === null || v === undefined ? null : `${fmt(v)}${tot > 0 ? ` (${pct(v / tot)})` : ''}`; }),
        spec.series.every((se) => se.values[i] === null) ? null : fmt(tot),
        grand > 0 ? pct(tot / grand) : null,
      ],
    };
  }));
  return frame(ctx, spec, inner, desc, lg, wrapTable(spec.table ?? 'details', t, tbl));
}

export const plugin = definePlugin<MarimekkoSpec>({
  type: 'marimekko',
  names: { ko: '마리메코 차트', en: 'Marimekko chart' },
  validate(input) {
    const o = dict(input, 'spec', [...BASE, 'labels', 'series', 'xLabel']);
    const out = base(o);
    out.type = 'marimekko';
    const ls = labels(o.labels, 'labels');
    if (ls.length > MAX_MEKKO_COLUMNS) fail('labels', `must have at most ${MAX_MEKKO_COLUMNS} entries`);
    out.labels = ls;
    out.series = seriesList(o.series, 'series', ls.length, true);
    put(out, 'xLabel', optStr(o.xLabel, 'xLabel', 80));
    return out as unknown as MarimekkoSpec;
  },
  height: () => 340,
  render,
});
