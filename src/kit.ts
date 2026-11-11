// Shared rendering helpers used by every chart type (core and src/charts/*). No chart-specific logic here.
import type { BaseSpec, Series, Unit, Value } from './types.ts';
import { type Fmt, clamp, esc, n2, truncate, tw } from './format.ts';

export const STR = {
  ko: { na: '데이터 없음', missing: '결측', unit: '단위', table: '데이터 표', empty: '표시할 데이터가 없습니다', cat: '구분', value: '값', share: '비율', total: '합계', min: '최소', max: '최대', last: '마지막', items: '개 항목', series: '시리즈', quality: '품질', panel: '패널', count: '개수', from: '출발', to: '도착', median: '중앙값', q1: '1사분위', q3: '3사분위', mean: '평균', target: '목표', range: '구간', date: '날짜', start: '시작', end: '끝', rank: '순위', change: '변화', other: '기타' },
  en: { na: 'No data', missing: 'missing', unit: 'Unit', table: 'Data table', empty: 'No data to display', cat: 'Category', value: 'Value', share: 'Share', total: 'Total', min: 'min', max: 'max', last: 'last', items: ' items', series: 'series', quality: 'Quality', panel: 'Panel', count: 'Count', from: 'From', to: 'To', median: 'median', q1: 'Q1', q3: 'Q3', mean: 'mean', target: 'Target', range: 'Range', date: 'Date', start: 'Start', end: 'End', rank: 'Rank', change: 'Change', other: 'Other' },
} as const;
export type Strings = (typeof STR)['ko'] | (typeof STR)['en'];

/** Render context: viewBox size, DOM id prefix, built-in strings and the localised chart-type name. */
export interface Ctx { W: number; H: number; pid: string; t: Strings; typeName: string; lang: 'ko' | 'en' }

export const FS = 12;
/** Above this many marks, per-mark keyboard focus is skipped and the data table is the accessible path. */
export const MAX_FOCUS = 120;
export const cIdx = (i: number): number => (i % 8) + 1;
/**
 * Class list tail for a coloured mark: `lc-cN"` plus an optional validated colour override.
 * Use inside a class attribute: `class="lc-mark lc-bar ${colorAttrs(i, color)}`. Note it closes the quote itself.
 */
export const colorAttrs = (i: number, color?: string): string => `lc-c${cIdx(i)}"${color ? ` style="--c:${color}"` : ''}`;

export function runs(vals: Value[]): number[][] {
  const out: number[][] = [];
  let cur: number[] = [];
  vals.forEach((v, i) => {
    if (v === null) { if (cur.length) out.push(cur); cur = []; } else cur.push(i);
  });
  if (cur.length) out.push(cur);
  return out;
}

export const present = (vs: Value[]): number[] => vs.filter((v): v is number => v !== null);

/** Greedy word wrap to `max` px (characters split when one word is too long), at most `lines` lines; the last is truncated. */
export function wrapText(text: string, max: number, size: number, lines: number): string[] {
  const out: string[] = [];
  let cur = '';
  const push = (s: string): void => { out.push(s); };
  for (const word of text.split(/(\s+)/)) {
    if (word === '') continue;
    if (tw(cur + word, size) <= max) { cur += word; continue; }
    if (cur.trim()) { push(cur.trimEnd()); cur = ''; }
    if (/^\s+$/.test(word)) continue;
    let w = word;
    while (tw(w, size) > max) {
      let part = '';
      for (const ch of w) { if (tw(part + ch, size) > max) break; part += ch; }
      if (!part) part = [...w][0] ?? '';
      push(part); w = w.slice(part.length);
    }
    cur = w;
  }
  if (cur.trim()) push(cur.trimEnd());
  if (out.length <= lines) return out.length ? out : [''];
  const kept = out.slice(0, lines);
  kept[lines - 1] = truncate(out.slice(lines - 1).join(' '), max, size);
  return kept;
}

/**
 * One-dimensional collision resolver for labels: returns a centre for every item (same order as the input) so that
 * neighbours never overlap (`h` = the height each item needs) and everything stays inside [lo, hi] where possible.
 * Items keep their vertical order; the shift is deterministic.
 */
export function spread(items: { y: number; h: number }[], lo: number, hi: number): number[] {
  const order = items.map((it, k) => ({ ...it, k })).sort((a, b) => a.y - b.y || a.k - b.k);
  const ys = order.map((it) => clamp(it.y, lo + it.h / 2, Math.max(lo + it.h / 2, hi - it.h / 2)));
  for (let i = 1; i < order.length; i++) {
    const need = ((order[i - 1] as { h: number }).h + (order[i] as { h: number }).h) / 2;
    ys[i] = Math.max(ys[i] as number, (ys[i - 1] as number) + need);
  }
  for (let i = order.length - 1; i >= 0; i--) {
    const it = order[i] as { h: number };
    const cap = i === order.length - 1 ? hi - it.h / 2 : (ys[i + 1] as number) - (it.h + (order[i + 1] as { h: number }).h) / 2;
    ys[i] = Math.max(lo + it.h / 2, Math.min(ys[i] as number, cap));
  }
  const out = new Array<number>(items.length);
  order.forEach((it, i) => { out[it.k] = Math.round((ys[i] as number) * 100) / 100; });
  return out;
}

/**
 * Value box (tooltip) anchored at (ax, ay). The part after the last ": " (the value) is bold on one-line boxes. Never wider than the viewBox: long text wraps (up to 3 lines, then …).
 * Sits above the anchor, flips below it near the top, and is clamped inside the viewBox on every side.
 */
export function tip(ctx: Ctx, text: string, ax: number, ay: number): string {
  const maxW = Math.max(24, ctx.W - 4);
  const lines = wrapText(text, maxW - 14, FS, 3);
  const w = Math.min(maxW, Math.max(...lines.map((l) => tw(l, FS))) + 14);
  const lh = FS + 4;
  const h = FS + 12 + (lines.length - 1) * lh;
  const x = clamp(ax - w / 2, 2, ctx.W - w - 2);
  let y = ay - h - 8;
  if (y < 2) y = ay + 10;
  y = clamp(y, 2, ctx.H - h - 2);
  const base = y + 12 + FS * 0.36;
  const one = lines[0] ?? '';
  const cut = one.lastIndexOf(': ');
  const body = lines.length === 1
    ? `<text x="${n2(x + 7)}" y="${n2(y + h / 2 + FS * 0.36)}">${cut > 0 ? `${esc(one.slice(0, cut + 2))}<tspan class="lc-tip-v">${esc(one.slice(cut + 2))}</tspan>` : esc(one)}</text>`
    : `<text x="${n2(x + 7)}" y="${n2(base)}">${lines.map((l, i) => `<tspan x="${n2(x + 7)}"${i ? ` dy="${lh}"` : ''}>${esc(l)}</tspan>`).join('')}</text>`;
  return `<g class="lc-tip" aria-hidden="true"><rect x="${n2(x)}" y="${n2(y)}" width="${n2(w)}" height="${n2(h)}" rx="4"/>${body}</g>`;
}

/** A keyboard-focusable mark group: `inner` is the visible shape(s), the value box is added from `label` at (ax, ay). */
export function focusable(ctx: Ctx, cls: string, label: string, inner: string, ax: number, ay: number): string {
  return `<g class="lc-pt ${cls}" tabindex="0" aria-label="${esc(label)}">${inner}${tip(ctx, label, ax, ay)}</g>`;
}

export interface LegendItem { name: string; idx: number; color?: string; quality?: string; extra?: string }

export function legend(items: LegendItem[]): string {
  return `<ul class="lc-legend">${items.map((it) => `<li><span class="lc-sw ${colorAttrs(it.idx, it.color)}></span><span class="lc-ln">${esc(it.name)}</span>${it.extra ? `<span class="lc-lv">${esc(it.extra)}</span>` : ''}${it.quality ? `<span class="lc-q">${esc(it.quality)}</span>` : ''}</li>`).join('')}</ul>`;
}

/** Generic data table. `cells` may contain null (rendered as "데이터 없음"). All text is escaped here. */
export function table(t: Strings, caption: string, head: string[], rows: { th: string; cells: (string | null)[] }[]): string {
  const h = `<tr>${head.map((c) => `<th scope="col">${esc(c)}</th>`).join('')}</tr>`;
  const b = rows.map((r) => `<tr><th scope="row">${esc(r.th)}</th>${r.cells.map((c) => (c === null ? `<td class="lc-na">${t.na}</td>` : `<td>${esc(c)}</td>`)).join('')}</tr>`).join('');
  return `<table><caption>${esc(caption)}</caption><thead>${h}</thead><tbody>${b}</tbody></table>`;
}

export function seriesTable(t: Strings, caption: string, xHead: string, labels: string[], list: Series[], fmt: Fmt): string {
  return table(t, caption, [xHead, ...list.map((s) => `${s.name}${s.quality ? ` (${s.quality})` : ''}`)],
    labels.map((l, i) => ({ th: l, cells: list.map((s) => { const v = s.values[i]; return v === null || v === undefined ? null : fmt(v); }) })));
}

export function wrapTable(mode: 'details' | 'hidden' | 'none', t: Strings, tables: string): string {
  if (mode === 'none') return '';
  if (mode === 'hidden') return `<div class="lc-sr">${tables}</div>`;
  return `<details class="lc-data"><summary>${t.table}</summary><div class="lc-scroll">${tables}</div></details>`;
}

export function summarize(t: Strings, labels: string[], list: Series[], fmt: Fmt): string {
  return list.map((s) => {
    const vs = present(s.values);
    const miss = s.values.length - vs.length;
    if (!vs.length) return `${s.name}: ${t.na}.`;
    const lastIdx = s.values.reduce<number>((a, v, i) => (v === null ? a : i), -1);
    return `${s.name}: ${t.min} ${fmt(Math.min(...vs))}, ${t.max} ${fmt(Math.max(...vs))}, ${t.last} ${fmt(s.values[lastIdx] as number)} (${labels[lastIdx] ?? ''})${miss ? `, ${t.missing} ${miss}` : ''}.${s.quality ? ` ${t.quality}: ${s.quality}.` : ''}`;
  }).join(' ');
}

export function unitLabel(u: Unit | undefined): string | undefined {
  return u?.label ?? (u?.suffix && u.suffix.trim() ? u.suffix.trim() : undefined);
}

/**
 * Wrap a rendered SVG body into the standard accessible figure: caption, <svg role="img"> with <title>/<desc>,
 * legend and data table. `descText` is the generated summary (values, missing count, quality notes).
 */
export function frame(ctx: Ctx, spec: BaseSpec & { type: string }, svgInner: string, descText: string, legendHtml: string, tableHtml: string, opts: { caption?: boolean; cls?: string } = {}): string {
  const t = ctx.t;
  const ul = unitLabel(spec.unit);
  const desc = [spec.description, `${ctx.typeName}.`, ul ? `${t.unit}: ${ul}.` : '', descText].filter(Boolean).join(' ');
  const cap = opts.caption === false ? '' : `<figcaption class="lc-cap"><span class="lc-title">${esc(spec.title)}</span>${ul ? `<span class="lc-unit">${t.unit}: ${esc(ul)}</span>` : ''}${spec.description ? `<span class="lc-note">${esc(spec.description)}</span>` : ''}</figcaption>`;
  const svg = `<svg class="lc-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n2(ctx.W)} ${n2(ctx.H)}" width="${n2(ctx.W)}" height="${n2(ctx.H)}" role="img" aria-labelledby="${ctx.pid}-t ${ctx.pid}-d" focusable="false"><title id="${ctx.pid}-t">${esc(spec.title)}</title><desc id="${ctx.pid}-d">${esc(desc)}</desc>${svgInner}</svg>`;
  return `<figure class="lc lc-t-${spec.type}${opts.cls ? ' ' + opts.cls : ''}" id="${ctx.pid}" lang="${ctx.lang}" data-lc-type="${spec.type}">${cap}${svg}${legendHtml}${tableHtml}</figure>`;
}

export const empty = (ctx: Ctx): string => `<text class="lc-empty" x="${n2(ctx.W / 2)}" y="${n2(ctx.H / 2)}" text-anchor="middle">${esc(ctx.t.empty)}</text>`;

/** Percentage text with up to 1 decimal, e.g. 12.5%. */
export const pct = (x: number): string => `${Math.round(x * 1000) / 10}%`;
