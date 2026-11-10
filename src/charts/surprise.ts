// Earnings surprise: per period, the reported value (bar from zero) against the estimate (a tick across the bar),
// with the surprise (actual - estimate) / |estimate| written above in text and a ▲/▼ mark, so the result never
// depends on colour alone. A missing estimate is written "미확인" (never treated as zero); a missing actual (not yet
// reported) has no bar.
import type { BaseSpec, Value } from '../types.ts';
import { definePlugin } from '../plugin.ts';
import { BASE, base, dict, labels, oneOf, optStr, values } from '../check.ts';
import { clamp, esc, makeFmt, n2, niceTicks, truncate, tw } from '../format.ts';
import { type Ctx, FS, MAX_FOCUS, empty, focusable, frame, legend, pct, table, wrapTable } from '../kit.ts';
import { CONVENTIONS, type Convention, convCls } from './fin.ts';

export interface SurpriseSpec extends BaseSpec {
  type: 'surprise';
  /** Period labels, e.g. "2025 3Q". */
  labels: string[];
  /** Reported values; null = not reported yet. */
  actual: Value[];
  /** Estimate (consensus or guidance) per period; null = unknown, shown as 미확인. */
  estimate: Value[];
  /** Series names (defaults 실적 / 예상치). */
  actualName?: string;
  estimateName?: string;
  convention?: Convention;
  yLabel?: string;
}

const XS = 10.5;
const SM = 9;
const L = {
  ko: { actual: '실적', estimate: '예상치', beat: '상회', miss: '하회', meet: '부합', unknown: '미확인', surprise: '차이', pending: '발표 전' },
  en: { actual: 'Actual', estimate: 'Estimate', beat: 'beat', miss: 'miss', meet: 'in line', unknown: 'unknown', surprise: 'Surprise', pending: 'not reported' },
};

export type SurpriseState = 'beat' | 'miss' | 'meet' | 'unknown' | 'pending';

/** Surprise ratio (actual - estimate) / |estimate| and its state; null ratio when either side is missing or estimate is 0. */
export function surpriseOf(a: Value, e: Value): { r: number | null; state: SurpriseState } {
  if (a === null) return { r: null, state: 'pending' };
  if (e === null) return { r: null, state: 'unknown' };
  if (e === 0) return { r: null, state: a > 0 ? 'beat' : a < 0 ? 'miss' : 'meet' };
  const r = (a - e) / Math.abs(e);
  const shown = Math.round(r * 1000) / 10;
  return { r, state: shown > 0 ? 'beat' : shown < 0 ? 'miss' : 'meet' };
}

function render(spec: SurpriseSpec, ctx: Ctx): string {
  const t = ctx.t;
  const S = L[ctx.lang];
  const an = spec.actualName ?? S.actual;
  const en = spec.estimateName ?? S.estimate;
  const n = spec.labels.length;
  const fmt = makeFmt(spec.unit, [...spec.actual, ...spec.estimate]);
  const rows = spec.labels.map((_, i) => ({ a: spec.actual[i] ?? null, e: spec.estimate[i] ?? null, ...surpriseOf(spec.actual[i] ?? null, spec.estimate[i] ?? null) }));
  const signed = (r: number): string => `${r > 0 ? '+' : ''}${pct(r)}`;
  const stateText = (x: (typeof rows)[number]): string =>
    x.state === 'pending' ? S.pending : x.state === 'unknown' ? S.unknown : `${S[x.state]}${x.r !== null ? ` ${signed(x.r)}` : ''}`;
  const mark = (x: (typeof rows)[number]): string => (x.state === 'beat' ? '▲' : x.state === 'miss' ? '▼' : x.state === 'meet' ? '=' : '');
  const aria = (i: number): string => {
    const x = rows[i]!;
    return `${spec.labels[i]}: ${an} ${x.a === null ? t.na : fmt(x.a)}, ${en} ${x.e === null ? S.unknown : fmt(x.e)} · ${stateText(x)}`;
  };
  const vals = rows.flatMap((x) => [x.a, x.e]).filter((v): v is number => v !== null);
  let svg = '';
  if (!vals.length) svg = empty(ctx);
  else {
    const dom = niceTicks(Math.min(0, ...vals), Math.max(0, ...vals), ctx.H < 240 ? 4 : 5);
    const tl = dom.ticks.map(fmt);
    const yT = spec.yLabel ? FS + 8 : 0;
    const left = Math.max(...tl.map((l) => tw(l, FS))) + 10 + yT;
    const top = XS + 14;
    const bottom = FS + 14;
    const pw = Math.max(20, ctx.W - left - 8);
    const ph = Math.max(20, ctx.H - top - bottom);
    const sy = (v: number): number => top + ph - ((v - dom.min) / (dom.max - dom.min || 1)) * ph;
    const band = pw / n;
    const cx = (i: number): number => left + band * (i + 0.5);
    dom.ticks.forEach((tk, k) => {
      const y = sy(tk);
      svg += `<line class="lc-grid" x1="${n2(left)}" x2="${n2(left + pw)}" y1="${n2(y)}" y2="${n2(y)}"/>`;
      svg += `<text class="lc-tick" x="${n2(left - 6)}" y="${n2(y + FS * 0.36)}" text-anchor="end">${esc(tl[k]!)}</text>`;
    });
    if (spec.yLabel) svg += `<text class="lc-axis-title" transform="translate(${n2(FS)} ${n2(top + ph / 2)}) rotate(-90)" text-anchor="middle">${esc(truncate(spec.yLabel, ph, FS))}</text>`;
    const zero = sy(0);
    svg += `<line class="lc-axis" x1="${n2(left)}" x2="${n2(left + pw)}" y1="${n2(zero)}" y2="${n2(zero)}"/>`;
    const xl = spec.labels.map((l) => truncate(l, Math.max(40, band * 3), FS));
    const lw = Math.max(...xl.map((l) => tw(l, FS))) + 8;
    const step = Math.max(1, Math.ceil(lw / band));
    xl.forEach((l, i) => {
      if (i % step) return;
      const w = tw(l, FS);
      svg += `<text class="lc-tick" x="${n2(clamp(cx(i), w / 2 + 2, ctx.W - w / 2 - 2))}" y="${n2(top + ph + FS + 6)}" text-anchor="middle">${esc(l)}</text>`;
    });
    const bw = clamp(band * 0.5, 2, 44);
    const canFocus = n <= MAX_FOCUS;
    let marks = '';
    rows.forEach((x, i) => {
      const c = cx(i);
      let g = '';
      if (x.a !== null) {
        const y = sy(Math.max(0, x.a));
        g += `<rect class="lc-mark lc-sp-bar lc-sp-${x.state}" data-i="${i}" data-v="${x.a}" x="${n2(c - bw / 2)}" y="${n2(y)}" width="${n2(bw)}" height="${n2(Math.max(x.a !== 0 ? 1 : 0, Math.abs(sy(x.a) - zero)))}"/>`;
      }
      if (x.e !== null) {
        const ey = sy(x.e);
        g += `<line class="lc-mark lc-sp-est" data-i="${i}" data-v="${x.e}" x1="${n2(c - bw / 2 - 4)}" x2="${n2(c + bw / 2 + 4)}" y1="${n2(ey)}" y2="${n2(ey)}"/>`;
      }
      // label above the column: full text, then without the word, then the mark only; skipped if nothing fits
      const full = x.state === 'pending' ? '' : x.state === 'unknown' ? S.unknown : `${mark(x)}${x.r !== null ? pct(Math.abs(x.r)) : S[x.state]}`;
      const short = x.state === 'unknown' ? '?' : mark(x);
      const small = tw(full, XS) > band - 2 && tw(full, SM) <= band - 2;
      const lab = tw(full, XS) <= band - 2 || small ? full : tw(short, XS) <= band - 2 ? short : '';
      const topV = Math.max(0, ...[x.a, x.e].filter((v): v is number => v !== null));
      if (lab) g += `<text class="lc-sp-lbl lc-sp-t-${x.state}${small ? ' lc-sp-sm' : ''}" x="${n2(c)}" y="${n2(Math.max(XS + 2, sy(topV) - 5))}" text-anchor="middle" aria-hidden="true">${esc(lab)}</text>`;
      if (!canFocus) { marks += g; return; }
      const hit = `<rect class="lc-hit" x="${n2(c - band / 2)}" y="${n2(top)}" width="${n2(band)}" height="${n2(ph)}"/>`;
      marks += focusable(ctx, 'lc-pt-sp', aria(i), hit + g, c, sy(topV));
    });
    svg += marks;
  }
  const count = (s: SurpriseState): number => rows.filter((x) => x.state === s).length;
  const lastI = rows.reduce<number>((a, x, i) => (x.a !== null ? i : a), -1);
  let desc = `${n}${t.items} (${spec.labels[0]}–${spec.labels[n - 1]}). ${S.beat} ${count('beat')}, ${S.miss} ${count('miss')}, ${S.meet} ${count('meet')}, ${en} ${S.unknown} ${count('unknown')}.`;
  if (lastI >= 0) desc += ` ${spec.labels[lastI]}: ${aria(lastI).slice(spec.labels[lastI]!.length + 2)}.`;
  if (count('pending')) desc += ` ${S.pending} ${count('pending')}.`;
  const lg = spec.legend === false ? '' : `<ul class="lc-legend lc-sp-legend">` +
    `<li><span class="lc-sw lc-sp-sw lc-sp-beat"></span><span class="lc-ln">${esc(an)} ▲ ${S.beat}</span></li>` +
    `<li><span class="lc-sw lc-sp-sw lc-sp-miss"></span><span class="lc-ln">${esc(an)} ▼ ${S.miss}</span></li>` +
    `<li><span class="lc-sw lc-sp-sw lc-sp-unknown"></span><span class="lc-ln">${esc(an)} (${en} ${S.unknown})</span></li>` +
    `<li><span class="lc-sw lc-sp-sw-est"></span><span class="lc-ln">${esc(en)}</span></li></ul>`;
  const tbl = table(t, spec.title, [t.cat, an, en, S.surprise], rows.map((x, i) => ({
    th: spec.labels[i]!,
    cells: [x.a === null ? null : fmt(x.a), x.e === null ? S.unknown : fmt(x.e), x.state === 'pending' ? null : stateText(x)],
  })));
  const cls = convCls(spec.convention);
  return frame(ctx, spec, svg, desc, lg, wrapTable(spec.table ?? 'details', t, tbl), cls ? { cls } : {});
}

export const plugin = definePlugin<SurpriseSpec>({
  type: 'surprise',
  names: { ko: '실적 서프라이즈 차트', en: 'Earnings surprise' },
  validate(input) {
    const o = dict(input, 'spec', [...BASE, 'labels', 'actual', 'estimate', 'actualName', 'estimateName', 'convention', 'yLabel']);
    const out = base(o) as unknown as SurpriseSpec;
    out.type = 'surprise';
    out.labels = labels(o.labels, 'labels');
    const n = out.labels.length;
    out.actual = values(o.actual, 'actual', n, false);
    out.estimate = values(o.estimate, 'estimate', n, false);
    const a = optStr(o.actualName, 'actualName', 40);
    const e = optStr(o.estimateName, 'estimateName', 40);
    if (a !== undefined) out.actualName = a;
    if (e !== undefined) out.estimateName = e;
    const cv = oneOf(o.convention, 'convention', CONVENTIONS);
    if (cv !== undefined) out.convention = cv;
    const yl = optStr(o.yLabel, 'yLabel', 60);
    if (yl !== undefined) out.yLabel = yl;
    return out;
  },
  height: (_s, W) => (W < 420 ? 250 : 300),
  render,
});
