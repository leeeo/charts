// 52-week range: one row per item with a track from the period low to the period high and a marker at the current
// price, plus the position inside the range written as text ("범위의 63%"). Each row has its own scale (low..high).
// A missing current price shows the track only and is written as 데이터 없음.
import type { BaseSpec, Value } from '../types.ts';
import { definePlugin } from '../plugin.ts';
import { BASE, base, fail, dict, idList, num, optStr, put, str, value } from '../check.ts';
import { esc, makeFmt, n2, truncate, tw } from '../format.ts';
import { type Ctx, FS, MAX_FOCUS, focusable, frame, pct, table, wrapTable } from '../kit.ts';

export interface Range52Item { id: string; label: string; low: number; high: number; current: Value; quality?: string }

export interface Range52Spec extends BaseSpec {
  type: 'range52';
  items: Range52Item[];
  /** Period wording (default "52주"). */
  period?: string;
}

const L = {
  ko: { low: '최저', high: '최고', cur: '현재', posHead: '범위 안 위치', pos: (p: string) => `범위의 ${p}`, fromHigh: '최고가 대비', fromLow: '최저가 대비', period: '52주' },
  en: { low: 'Low', high: 'High', cur: 'Current', posHead: 'Position in range', pos: (p: string) => `${p} of range`, fromHigh: 'vs high', fromLow: 'vs low', period: '52-week' },
};

/** Position of `cur` in [low, high] as 0..1 (0.5 when low == high). */
export const rangePos = (low: number, high: number, cur: number): number => (high > low ? (cur - low) / (high - low) : 0.5);

/** Row height: the narrow layout puts the name and current value on their own line above the track. */
const rowH = (W: number): number => (W < 480 ? 56 : 48);

function render(spec: Range52Spec, ctx: Ctx): string {
  const t = ctx.t;
  const S = L[ctx.lang];
  const period = spec.period ?? S.period;
  const fmt = makeFmt(spec.unit, spec.items.flatMap((it) => [it.low, it.high, it.current]));
  const signed = (r: number): string => `${r > 0 ? '+' : ''}${pct(r)}`;
  const text = (it: Range52Item): string => {
    const base = `${it.label}: ${period} ${S.low} ${fmt(it.low)}, ${S.high} ${fmt(it.high)}, ${S.cur} `;
    if (it.current === null) return `${base}${t.na}${it.quality ? ` · ${it.quality}` : ''}`;
    const c = it.current;
    return `${base}${fmt(c)} · ${S.pos(pct(rangePos(it.low, it.high, c)))}` +
      `${it.high !== 0 ? ` · ${S.fromHigh} ${signed((c - it.high) / it.high)}` : ''}${it.low !== 0 ? ` · ${S.fromLow} ${signed((c - it.low) / it.low)}` : ''}${it.quality ? ` · ${it.quality}` : ''}`;
  };
  const narrow = ctx.W < 480;
  const ROW = rowH(ctx.W);
  const labW = narrow ? 0 : Math.min(ctx.W * 0.3, Math.max(...spec.items.map((it) => tw(it.label, FS))) + 12);
  let svg = '';
  const canFocus = spec.items.length <= MAX_FOCUS;
  spec.items.forEach((it, k) => {
    const y0 = k * ROW + 6;
    const lowT = fmt(it.low); const highT = fmt(it.high);
    const x0 = labW + 4; const x1 = ctx.W - 4;
    const ty = y0 + (narrow ? 32 : 20);
    const sx = (v: number): number => x0 + rangePos(it.low, it.high, v) * (x1 - x0);
    let g = '';
    const lbl = narrow
      ? `<text class="lc-r52-name" x="4" y="${n2(y0 + 13)}">${esc(truncate(it.label, ctx.W * 0.55, FS))}</text>`
      : `<text class="lc-r52-name" x="${n2(labW - 8)}" y="${n2(ty + FS * 0.36)}" text-anchor="end">${esc(truncate(it.label, labW - 10, FS))}</text>`;
    g += `<rect class="lc-r52-track" x="${n2(x0)}" y="${n2(ty - 4)}" width="${n2(x1 - x0)}" height="8" rx="4"/>`;
    g += `<text class="lc-tick lc-r52-end" x="${n2(x0)}" y="${n2(ty + 18)}">${esc(`${S.low} ${lowT}`)}</text>`;
    g += `<text class="lc-tick lc-r52-end" x="${n2(x1)}" y="${n2(ty + 18)}" text-anchor="end">${esc(`${S.high} ${highT}`)}</text>`;
    let curLab = '';
    if (it.current !== null) {
      const cx = sx(it.current);
      g += `<rect class="lc-r52-fill" x="${n2(x0)}" y="${n2(ty - 4)}" width="${n2(Math.max(0, cx - x0))}" height="8" rx="4"/>`;
      g += `<path class="lc-mark lc-r52-cur" data-i="${k}" data-v="${it.current}" d="M${n2(cx)} ${n2(ty - 9)}l5 -6h-10z M${n2(cx - 1.5)} ${n2(ty - 8)}h3v16h-3z"/>`;
      const ct = `${fmt(it.current)} (${pct(rangePos(it.low, it.high, it.current))})`;
      const w = tw(ct, FS);
      const lx = Math.min(Math.max(cx, x0 + w / 2), x1 - w / 2);
      // on narrow screens the name takes the left of the header line, so the current value sits on the right
      curLab = narrow
        ? `<text class="lc-r52-curlbl" x="${n2(ctx.W - 4)}" y="${n2(y0 + 13)}" text-anchor="end">${esc(`${S.cur} ${ct}`)}</text>`
        : `<text class="lc-r52-curlbl" x="${n2(lx)}" y="${n2(ty - 17)}" text-anchor="middle">${esc(ct)}</text>`;
    } else {
      curLab = `<text class="lc-r52-curlbl lc-r52-na" x="${n2(narrow ? ctx.W - 4 : x1)}" y="${n2(narrow ? y0 + 13 : ty - 10)}" text-anchor="end">${esc(`${S.cur} ${t.na}`)}</text>`;
    }
    const inner = g + curLab;
    svg += lbl;
    svg += canFocus ? focusable(ctx, 'lc-pt-r52', text(it), `<rect class="lc-hit" x="${n2(x0)}" y="${n2(y0)}" width="${n2(x1 - x0)}" height="${ROW}"/>${inner}`, it.current === null ? (x0 + x1) / 2 : sx(it.current), ty - 8) : inner;
  });
  const missing = spec.items.filter((it) => it.current === null).length;
  const desc = `${spec.items.length}${t.items}. ` + spec.items.map((it) => `${text(it)}.`).join(' ') + (missing ? ` ${t.missing} ${missing}.` : '');
  const tbl = table(t, spec.title, [t.cat, `${period} ${S.low}`, `${period} ${S.high}`, S.cur, S.posHead], spec.items.map((it) => ({
    th: `${it.label}${it.quality ? ` (${it.quality})` : ''}`,
    cells: [fmt(it.low), fmt(it.high), it.current === null ? null : fmt(it.current), it.current === null ? null : pct(rangePos(it.low, it.high, it.current))],
  })));
  return frame(ctx, spec, svg, desc, '', wrapTable(spec.table ?? 'details', t, tbl));
}

export const plugin = definePlugin<Range52Spec>({
  type: 'range52',
  names: { ko: '52주 범위 막대', en: '52-week range' },
  validate(input) {
    const o = dict(input, 'spec', [...BASE, 'items', 'period']);
    const out = base(o);
    out.type = 'range52';
    out.items = idList(o.items, 'items', ['label', 'low', 'high', 'current', 'quality'], 60, (it, p, id) => {
      const low = num(it.low, `${p}.low`);
      const high = num(it.high, `${p}.high`, low, 1e15);
      if (it.current === undefined) fail(`${p}.current`, 'is required');
      const current = value(it.current, `${p}.current`);
      if (current !== null && (current < low || current > high)) fail(`${p}.current`, 'must be between low and high');
      const r: Record<string, unknown> = { id, label: str(it.label, `${p}.label`, 60), low, high, current };
      put(r, 'quality', optStr(it.quality, `${p}.quality`, 60));
      return r;
    });
    put(out, 'period', optStr(o.period, 'period', 20));
    return out as unknown as Range52Spec;
  },
  height: (spec, W) => spec.items.length * rowH(W) + 8,
  render,
});
