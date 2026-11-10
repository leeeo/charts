import type { ChartSpec, DonutSpec, MultiplesSpec, Series, Unit, Value } from './types.ts';
import { validateSpec } from './validate.ts';
import { type Fmt, clamp, esc, hash, makeFmt, n2, niceTicks, truncate, tw } from './format.ts';

export interface RenderOptions {
  /** Override the viewBox width (e.g. the container width). */
  width?: number;
}

const STR = {
  ko: { na: '데이터 없음', missing: '결측', unit: '단위', table: '데이터 표', empty: '표시할 데이터가 없습니다', cat: '구분', value: '값', share: '비율', total: '합계', min: '최소', max: '최대', last: '마지막', items: '개 항목', series: '시리즈', quality: '품질', line: '선 차트', area: '영역 차트', bar: '막대 차트', sparkline: '스파크라인', donut: '도넛 차트', multiples: '작은 다중 차트', panel: '패널' },
  en: { na: 'No data', missing: 'missing', unit: 'Unit', table: 'Data table', empty: 'No data to display', cat: 'Category', value: 'Value', share: 'Share', total: 'Total', min: 'min', max: 'max', last: 'last', items: ' items', series: 'series', quality: 'Quality', line: 'Line chart', area: 'Area chart', bar: 'Bar chart', sparkline: 'Sparkline', donut: 'Donut chart', multiples: 'Small multiples', panel: 'Panel' },
} as const;
type Dict = (typeof STR)['ko'] | (typeof STR)['en'];

interface Ctx { W: number; H: number; pid: string; t: Dict }

const FS = 12;
const MAX_FOCUS = 120;
const cIdx = (i: number): number => (i % 8) + 1;
const colorAttrs = (i: number, color?: string): string => `lc-c${cIdx(i)}"${color ? ` style="--c:${color}"` : ''}`;

function runs(vals: Value[]): number[][] {
  const out: number[][] = [];
  let cur: number[] = [];
  vals.forEach((v, i) => {
    if (v === null) { if (cur.length) out.push(cur); cur = []; } else cur.push(i);
  });
  if (cur.length) out.push(cur);
  return out;
}

const present = (vs: Value[]): number[] => vs.filter((v): v is number => v !== null);

function tip(ctx: Ctx, text: string, ax: number, ay: number): string {
  const w = tw(text, FS) + 14;
  const h = FS + 12;
  const x = clamp(ax - w / 2, 2, ctx.W - w - 2);
  let y = ay - h - 8;
  if (y < 2) y = ay + 10;
  y = clamp(y, 2, ctx.H - h - 2);
  return `<g class="lc-tip" aria-hidden="true"><rect x="${n2(x)}" y="${n2(y)}" width="${n2(w)}" height="${n2(h)}" rx="4"/><text x="${n2(x + 7)}" y="${n2(y + h / 2 + FS * 0.36)}">${esc(text)}</text></g>`;
}

interface Domain { min: number; max: number; ticks: number[] }

function domainFor(list: Series[], kind: 'line' | 'area' | 'bar', stacked: boolean, yMin: number | undefined, yMax: number | undefined, count: number): Domain | null {
  const n = list[0]?.values.length ?? 0;
  let lo = Infinity;
  let hi = -Infinity;
  if (stacked) {
    for (let i = 0; i < n; i++) {
      let sum = 0;
      let any = false;
      for (const s of list) { const v = s.values[i]; if (v !== null && v !== undefined) { sum += v; any = true; } }
      if (any) { lo = Math.min(lo, 0); hi = Math.max(hi, sum); }
    }
  } else {
    for (const s of list) for (const v of present(s.values)) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  }
  if (!Number.isFinite(lo)) return null;
  if (kind !== 'line') { lo = Math.min(lo, 0); hi = Math.max(hi, 0); }
  if (yMin !== undefined) lo = yMin;
  if (yMax !== undefined) hi = yMax;
  const t = niceTicks(lo, hi, count);
  return { min: yMin !== undefined ? Math.min(yMin, t.min) : t.min, max: yMax !== undefined ? Math.max(yMax, t.max) : t.max, ticks: t.ticks };
}

interface PlotOpts {
  ctx: Ctx; x: number; y: number; w: number; h: number;
  kind: 'line' | 'area' | 'bar'; horizontal: boolean; stacked: boolean;
  series: Series[]; sidx: number[]; labels: string[]; fmt: Fmt; dom: Domain;
  compact: boolean; bare: boolean; xLabel?: string; focus: boolean; panelId?: string; panelName?: string;
}

/** Draw one cartesian plot. `shapes` go below, `points` (focusable) are emitted last so tips stay on top. */
function plot(o: PlotOpts): { shapes: string; points: string } {
  const { ctx, kind, horizontal, stacked, series, labels, dom, fmt, compact, bare } = o;
  const fs = compact ? 10.5 : FS;
  const N = labels.length;
  const tickLabels = dom.ticks.map(fmt);
  const maxTick = Math.max(0, ...tickLabels.map((t) => tw(t, fs)));
  const catMax = Math.max(0, ...labels.map((l) => tw(l, fs)));
  let left: number; let right: number; let top: number; let bottom: number;
  if (bare) { left = 4; right = 6; top = 4; bottom = 4; }
  else if (horizontal) {
    left = Math.min(o.w * 0.4, catMax + 12); right = Math.ceil(tw(tickLabels[tickLabels.length - 1] ?? '', fs) / 2) + 6; top = 6;
    bottom = fs + 12 + (o.xLabel ? fs + 6 : 0);
  } else {
    left = maxTick + 12; right = 10; top = 8; bottom = fs + 12 + (o.xLabel ? fs + 6 : 0);
  }
  const px = o.x + left; const py = o.y + top; const pw = Math.max(10, o.w - left - right); const ph = Math.max(10, o.h - top - bottom);
  const span = dom.max - dom.min || 1;
  const vv = (v: number): number => (horizontal ? px + ((v - dom.min) / span) * pw : py + ph - ((v - dom.min) / span) * ph);
  const band = (horizontal ? ph : pw) / N;
  const cc = (i: number): number => (horizontal ? py : px) + (i + 0.5) * band;
  const zero = vv(clamp(0, dom.min, dom.max));
  let s = '';
  let pts = '';

  if (!bare) {
    for (const [ti, t] of dom.ticks.entries()) {
      const p = vv(t);
      const label = tickLabels[ti] ?? '';
      if (horizontal) {
        s += `<line class="lc-grid" x1="${n2(p)}" y1="${n2(py)}" x2="${n2(p)}" y2="${n2(py + ph)}"/>`;
        const lw = tw(label, fs);
        s += `<text class="lc-tick" x="${n2(clamp(p - lw / 2, o.x, o.x + o.w - lw))}" y="${n2(py + ph + fs + 5)}">${esc(label)}</text>`;
      } else {
        s += `<line class="lc-grid" x1="${n2(px)}" y1="${n2(p)}" x2="${n2(px + pw)}" y2="${n2(p)}"/>`;
        s += `<text class="lc-tick" x="${n2(px - 6)}" y="${n2(p + fs * 0.35)}" text-anchor="end">${esc(label)}</text>`;
      }
    }
    // category labels, thinned by estimated width
    const lw = horizontal ? fs + 4 : catMax + 8;
    // all labels when they fit; truncate (never drop) for few categories; otherwise thin out by width
    const fitAll = !horizontal && (catMax + 6 <= band || N <= 6);
    const step = fitAll ? 1 : Math.max(1, Math.ceil(lw / band));
    for (let i = 0; i < N; i += step) {
      const raw = labels[i] ?? '';
      if (horizontal) {
        const t = truncate(raw, left - 12, fs);
        s += `<text class="lc-tick" x="${n2(px - 6)}" y="${n2(cc(i) + fs * 0.35)}" text-anchor="end">${esc(t)}</text>`;
      } else {
        const t = truncate(raw, Math.max(24, (fitAll ? band : step * band) - 4), fs);
        const w = tw(t, fs);
        s += `<text class="lc-tick" x="${n2(clamp(cc(i) - w / 2, o.x, o.x + o.w - w))}" y="${n2(py + ph + fs + 6)}">${esc(t)}</text>`;
      }
    }
    s += horizontal
      ? `<line class="lc-axis" x1="${n2(zero)}" y1="${n2(py)}" x2="${n2(zero)}" y2="${n2(py + ph)}"/>`
      : `<line class="lc-axis" x1="${n2(px)}" y1="${n2(zero)}" x2="${n2(px + pw)}" y2="${n2(zero)}"/>`;
    if (o.xLabel) {
      s += `<text class="lc-axis-title" x="${n2(px + pw / 2)}" y="${n2(o.y + o.h - 3)}" text-anchor="middle">${esc(truncate(o.xLabel, pw, fs))}</text>`;
    }
  }

  const sid = (j: number): number => o.sidx[j] ?? j;
  const cum: number[][] = [];
  if (stacked) {
    let acc: number[] = new Array<number>(N).fill(0);
    series.forEach((se) => {
      acc = acc.map((a, i) => a + (se.values[i] ?? 0));
      cum.push(acc);
    });
  }
  const pointLabel = (se: Series, i: number, v: number): string =>
    `${labels[i] ?? ''}, ${se.name}${o.panelName ? ` (${o.panelName})` : ''}: ${fmt(v)}${se.quality ? ` · ${se.quality}` : ''}`;
  const group = (cls: string, aria: string, inner: string, t: string): string =>
    `<g class="lc-pt ${cls}" tabindex="0" aria-label="${esc(aria)}">${inner}${t}</g>`;

  if (kind === 'bar') {
    const nS = stacked ? 1 : series.length;
    const gw = band * 0.76;
    const bw = gw / nS;
    series.forEach((se, j) => {
      se.values.forEach((v, i) => {
        if (v === null) return;
        let a: number; let b: number;
        if (stacked) { b = vv(cum[j]?.[i] ?? 0); a = vv((cum[j]?.[i] ?? 0) - v); } else { a = zero; b = vv(v); }
        const off = cc(i) - gw / 2 + (stacked ? 0 : j * bw);
        const wid = Math.max(1, bw - (nS > 1 ? 1.5 : 0));
        let rect: string;
        if (horizontal) {
          const x0 = Math.min(a, b); const w0 = Math.max(Math.abs(b - a), 1);
          rect = `<rect class="lc-mark lc-bar ${colorAttrs(sid(j), se.color)} data-s="${j}" data-i="${i}" data-v="${v}" x="${n2(x0)}" y="${n2(off)}" width="${n2(w0)}" height="${n2(wid)}"/>`;
        } else {
          const y0 = Math.min(a, b); const h0 = Math.max(Math.abs(b - a), 1);
          rect = `<rect class="lc-mark lc-bar ${colorAttrs(sid(j), se.color)} data-s="${j}" data-i="${i}" data-v="${v}" x="${n2(off)}" y="${n2(y0)}" width="${n2(wid)}" height="${n2(h0)}"/>`;
        }
        if (o.focus) {
          const ax = horizontal ? Math.max(a, b) : off + wid / 2;
          const ay = horizontal ? off + wid / 2 : Math.min(a, b);
          pts += group('lc-pt-bar', pointLabel(se, i, v), rect, tip(ctx, pointLabel(se, i, v), ax, ay));
        } else s += rect;
      });
    });
  } else {
    series.forEach((se, j) => {
      const c = colorAttrs(sid(j), se.color);
      const top = (i: number): number => vv(stacked ? (cum[j]?.[i] ?? 0) : (se.values[i] ?? 0));
      const bot = (i: number): number => (stacked ? vv(j > 0 ? (cum[j - 1]?.[i] ?? 0) : 0) : zero);
      const xs = (i: number): number => cc(i);
      for (const r of runs(se.values)) {
        if (r.length < 2) continue;
        if (kind === 'area') {
          const up = r.map((i) => `${n2(xs(i))} ${n2(top(i))}`).join(' L');
          const dn = [...r].reverse().map((i) => `${n2(xs(i))} ${n2(bot(i))}`).join(' L');
          s += `<path class="lc-area ${c} data-s="${j}" d="M${up} L${dn} Z"/>`;
        }
      }
      const d = runs(se.values).filter((r) => r.length > 1).map((r) => 'M' + r.map((i) => `${n2(xs(i))} ${n2(top(i))}`).join(' L')).join(' ');
      if (d) s += `<path class="lc-line ${c} data-s="${j}" pathLength="1" d="${d}"/>`;
      const total = present(se.values).length;
      const visible = total <= 24;
      const solo = new Set(runs(se.values).filter((r) => r.length === 1).map((r) => r[0]));
      se.values.forEach((v, i) => {
        if (v === null) return;
        const cx = xs(i); const cy = top(i);
        const dot = `<circle class="lc-mark lc-dot${visible || solo.has(i) ? ' lc-dot-vis' : ''} ${c} data-s="${j}" data-i="${i}" data-v="${v}" cx="${n2(cx)}" cy="${n2(cy)}" r="${compact ? 3 : 3.5}"/>`;
        if (o.focus) {
          pts += group('lc-pt-dot', pointLabel(se, i, v), `<circle class="lc-hit" cx="${n2(cx)}" cy="${n2(cy)}" r="9"/>${dot}`, tip(ctx, pointLabel(se, i, v), cx, cy));
        } else if (solo.has(i) || visible) s += dot;
      });
    });
  }
  return { shapes: s, points: pts };
}

function legend(items: { name: string; idx: number; color?: string; quality?: string; extra?: string }[]): string {
  return `<ul class="lc-legend">${items.map((it) => `<li><span class="lc-sw ${colorAttrs(it.idx, it.color)}></span><span class="lc-ln">${esc(it.name)}</span>${it.extra ? `<span class="lc-lv">${esc(it.extra)}</span>` : ''}${it.quality ? `<span class="lc-q">${esc(it.quality)}</span>` : ''}</li>`).join('')}</ul>`;
}

function seriesTable(t: Dict, caption: string, xHead: string, labels: string[], list: Series[], fmt: Fmt): string {
  const head = `<tr><th scope="col">${esc(xHead)}</th>${list.map((s) => `<th scope="col">${esc(s.name)}${s.quality ? ` (${esc(s.quality)})` : ''}</th>`).join('')}</tr>`;
  const rows = labels.map((l, i) => `<tr><th scope="row">${esc(l)}</th>${list.map((s) => { const v = s.values[i]; return v === null || v === undefined ? `<td class="lc-na">${t.na}</td>` : `<td>${esc(fmt(v))}</td>`; }).join('')}</tr>`).join('');
  return `<table><caption>${esc(caption)}</caption><thead>${head}</thead><tbody>${rows}</tbody></table>`;
}

function wrapTable(mode: 'details' | 'hidden' | 'none', t: Dict, tables: string): string {
  if (mode === 'none') return '';
  if (mode === 'hidden') return `<div class="lc-sr">${tables}</div>`;
  return `<details class="lc-data"><summary>${t.table}</summary><div class="lc-scroll">${tables}</div></details>`;
}

function summarize(t: Dict, labels: string[], list: Series[], fmt: Fmt): string {
  return list.map((s) => {
    const vs = present(s.values);
    const miss = s.values.length - vs.length;
    if (!vs.length) return `${s.name}: ${t.na}.`;
    const lastIdx = s.values.reduce<number>((a, v, i) => (v === null ? a : i), -1);
    return `${s.name}: ${t.min} ${fmt(Math.min(...vs))}, ${t.max} ${fmt(Math.max(...vs))}, ${t.last} ${fmt(s.values[lastIdx] as number)} (${labels[lastIdx] ?? ''})${miss ? `, ${t.missing} ${miss}` : ''}.${s.quality ? ` ${t.quality}: ${s.quality}.` : ''}`;
  }).join(' ');
}

function unitLabel(u: Unit | undefined): string | undefined {
  return u?.label ?? (u?.suffix && u.suffix.trim() ? u.suffix.trim() : undefined);
}

function frame(ctx: Ctx, spec: ChartSpec, svgInner: string, descText: string, legendHtml: string, tableHtml: string, width: number, extraCls = ''): string {
  const t = ctx.t;
  const ul = unitLabel(spec.unit);
  const desc = [spec.description, `${t[spec.type]}.`, ul ? `${t.unit}: ${ul}.` : '', descText].filter(Boolean).join(' ');
  const cap = `<figcaption class="lc-cap"><span class="lc-title">${esc(spec.title)}</span>${ul ? `<span class="lc-unit">${t.unit}: ${esc(ul)}</span>` : ''}${spec.description ? `<span class="lc-note">${esc(spec.description)}</span>` : ''}</figcaption>`;
  const svg = `<svg class="lc-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n2(ctx.W)} ${n2(ctx.H)}" width="${n2(ctx.W)}" height="${n2(ctx.H)}" role="img" aria-labelledby="${ctx.pid}-t ${ctx.pid}-d" focusable="false"><title id="${ctx.pid}-t">${esc(spec.title)}</title><desc id="${ctx.pid}-d">${esc(desc)}</desc>${svgInner}</svg>`;
  void width;
  return `<figure class="lc lc-t-${spec.type}${extraCls}" id="${ctx.pid}" lang="${spec.lang ?? 'ko'}" data-lc-type="${spec.type}">${spec.type === 'sparkline' ? '' : cap}${svg}${legendHtml}${tableHtml}</figure>`;
}

const empty = (ctx: Ctx): string => `<text class="lc-empty" x="${n2(ctx.W / 2)}" y="${n2(ctx.H / 2)}" text-anchor="middle">${esc(ctx.t.empty)}</text>`;

function renderCartesian(spec: Exclude<ChartSpec, DonutSpec | MultiplesSpec>, ctx: Ctx): string {
  const kind = spec.type === 'sparkline' ? 'line' : spec.type;
  const stacked = (spec.type === 'bar' || spec.type === 'area') && spec.stacked === true;
  const horizontal = spec.type === 'bar' && spec.horizontal === true;
  const all = spec.series.flatMap((s) => s.values);
  const fmt = makeFmt(spec.unit, all);
  const spark = spec.type === 'sparkline';
  const dom = spark ? sparkDomain(all) : domainFor(spec.series, kind, stacked, spec.yMin, spec.yMax, 5);
  const total = present(all).length;
  let inner: string;
  if (!dom) inner = empty(ctx);
  else if (spark) inner = renderSpark(spec, ctx, dom, fmt);
  else {
    const r = plot({ ctx, x: 0, y: 0, w: ctx.W, h: ctx.H, kind, horizontal, stacked, series: spec.series, sidx: spec.series.map((_, i) => i), labels: spec.labels, fmt, dom, compact: false, bare: false, ...(spec.xLabel ? { xLabel: spec.xLabel } : {}), focus: total <= MAX_FOCUS });
    inner = r.shapes + r.points;
  }
  const first = spec.labels[0] ?? ''; const last = spec.labels[spec.labels.length - 1] ?? '';
  const desc = `${spec.labels.length}${ctx.t.items} (${first}–${last}). ${summarize(ctx.t, spec.labels, spec.series, fmt)}`;
  const showLegend = !spark && (spec.legend ?? spec.series.length > 1);
  const lg = showLegend ? legend(spec.series.map((s, i) => ({ name: s.name, idx: i, ...(s.color ? { color: s.color } : {}), ...(s.quality ? { quality: s.quality } : {}) }))) : '';
  const tbl = wrapTable(spec.table ?? (spark ? 'hidden' : 'details'), ctx.t, seriesTable(ctx.t, spec.title, spec.xLabel ?? ctx.t.cat, spec.labels, spec.series, fmt));
  return frame(ctx, spec, inner, desc, lg, tbl, ctx.W);
}

function sparkDomain(all: Value[]): Domain | null {
  const vs = present(all);
  if (!vs.length) return null;
  const lo = Math.min(...vs); const hi = Math.max(...vs);
  const pad = (hi - lo || Math.abs(hi) || 1) * 0.12;
  return { min: lo - pad, max: hi + pad, ticks: [] };
}

function renderSpark(spec: Extract<ChartSpec, { type: 'sparkline' }>, ctx: Ctx, dom: Domain, fmt: Fmt): string {
  const se = spec.series[0] as Series;
  const r = plot({ ctx, x: 0, y: 0, w: ctx.W, h: ctx.H, kind: 'area', horizontal: false, stacked: false, series: [se], sidx: [0], labels: spec.labels, fmt, dom: { ...dom, min: dom.min }, compact: true, bare: true, focus: false });
  // keep area subtle for sparkline: re-use plot output, then add focusable first/min/max/last markers
  const vs = present(se.values);
  const lo = Math.min(...vs); const hi = Math.max(...vs);
  const idx = new Set<number>();
  const firstI = se.values.findIndex((v) => v !== null);
  const lastI = se.values.reduce<number>((a, v, i) => (v === null ? a : i), -1);
  idx.add(firstI); idx.add(lastI); idx.add(se.values.indexOf(lo)); idx.add(se.values.indexOf(hi));
  const N = spec.labels.length; const pw = ctx.W - 10; const span = dom.max - dom.min || 1;
  let pts = '';
  for (const i of [...idx].sort((a, b) => a - b)) {
    const v = se.values[i] as number;
    const cx = 4 + ((i + 0.5) / N) * pw; const cy = 4 + (ctx.H - 8) - ((v - dom.min) / span) * (ctx.H - 8);
    const text = `${spec.labels[i] ?? ''}, ${se.name}: ${fmt(v)}`;
    pts += `<g class="lc-pt lc-pt-dot" tabindex="0" aria-label="${esc(text)}"><circle class="lc-hit" cx="${n2(cx)}" cy="${n2(cy)}" r="8"/><circle class="lc-dot${i === lastI ? ' lc-dot-vis' : ''} lc-c1" cx="${n2(cx)}" cy="${n2(cy)}" r="3"/>${tip(ctx, text, cx, cy)}</g>`;
  }
  return r.shapes + pts;
}

function renderDonut(spec: DonutSpec, ctx: Ctx): string {
  const t = ctx.t;
  const fmt = makeFmt(spec.unit, spec.slices.map((s) => s.value));
  const valid = spec.slices.filter((s) => s.value !== null && s.value > 0);
  const total = spec.slices.reduce((a, s) => a + (s.value ?? 0), 0);
  const R = Math.max(20, Math.min(ctx.W, ctx.H) / 2 - 8);
  const r0 = R * 0.62;
  const cx = ctx.W / 2; const cy = ctx.H / 2;
  let inner = '';
  let pts = '';
  if (!valid.length) inner = empty(ctx);
  else {
    let a0 = -Math.PI / 2;
    const P = (rad: number, a: number): string => `${n2(cx + rad * Math.cos(a))} ${n2(cy + rad * Math.sin(a))}`;
    spec.slices.forEach((s, i) => {
      if (s.value === null || s.value <= 0) return;
      const frac = s.value / total;
      const a1 = a0 + frac * Math.PI * 2;
      let d: string;
      if (frac > 0.9999) {
        d = `M${P(R, a0)} A${n2(R)} ${n2(R)} 0 1 1 ${P(R, a0 + Math.PI)} A${n2(R)} ${n2(R)} 0 1 1 ${P(R, a0)} M${P(r0, a0)} A${n2(r0)} ${n2(r0)} 0 1 0 ${P(r0, a0 + Math.PI)} A${n2(r0)} ${n2(r0)} 0 1 0 ${P(r0, a0)} Z`;
      } else {
        const big = a1 - a0 > Math.PI ? 1 : 0;
        d = `M${P(R, a0)} A${n2(R)} ${n2(R)} 0 ${big} 1 ${P(R, a1)} L${P(r0, a1)} A${n2(r0)} ${n2(r0)} 0 ${big} 0 ${P(r0, a0)} Z`;
      }
      const mid = (a0 + a1) / 2;
      const text = `${s.label}: ${fmt(s.value)} (${n2(frac * 100)}%)${s.quality ? ` · ${s.quality}` : ''}`;
      const path = `<path class="lc-mark lc-slice ${colorAttrs(i, s.color)} data-i="${i}" data-v="${s.value}" fill-rule="evenodd" d="${d}"/>`;
      pts += `<g class="lc-pt lc-pt-slice" tabindex="0" aria-label="${esc(text)}">${path}${tip(ctx, text, cx + R * Math.cos(mid), cy + R * Math.sin(mid))}</g>`;
      a0 = a1;
    });
    const big = fmt(total);
    const fsz = clamp((r0 * 1.7) / Math.max(1, tw(big, 1)), 11, 24);
    inner += `<text class="lc-center" x="${n2(cx)}" y="${n2(cy + (spec.centerLabel ? 0 : fsz * 0.35))}" text-anchor="middle" style="font-size:${n2(fsz)}px">${esc(big)}</text>`;
    if (spec.centerLabel) inner += `<text class="lc-center-sub" x="${n2(cx)}" y="${n2(cy + 16)}" text-anchor="middle">${esc(truncate(spec.centerLabel, r0 * 1.7, 11))}</text>`;
  }
  const missing = spec.slices.filter((s) => s.value === null).length;
  const desc = `${t.total} ${fmt(total)}. ` + spec.slices.map((s) => (s.value === null ? `${s.label}: ${t.na}` : `${s.label}: ${fmt(s.value)}${total > 0 ? ` (${n2((s.value / total) * 100)}%)` : ''}`)).join(', ') + (missing ? `. ${t.missing} ${missing}.` : '.');
  const lg = spec.legend === false ? '' : legend(spec.slices.map((s, i) => ({ name: s.label, idx: i, ...(s.color ? { color: s.color } : {}), ...(s.quality ? { quality: s.quality } : {}), extra: s.value === null ? t.na : `${fmt(s.value)}${total > 0 ? ` · ${n2((s.value / total) * 100)}%` : ''}` })));
  const rows = spec.slices.map((s) => `<tr><th scope="row">${esc(s.label)}${s.quality ? ` (${esc(s.quality)})` : ''}</th>${s.value === null ? `<td class="lc-na">${t.na}</td><td class="lc-na">${t.na}</td>` : `<td>${esc(fmt(s.value))}</td><td>${total > 0 ? n2((s.value / total) * 100) + '%' : t.na}</td>`}</tr>`).join('');
  const tbl = wrapTable(spec.table ?? 'details', t, `<table><caption>${esc(spec.title)}</caption><thead><tr><th scope="col">${t.cat}</th><th scope="col">${t.value}</th><th scope="col">${t.share}</th></tr></thead><tbody>${rows}</tbody></table>`);
  return frame(ctx, spec, inner + pts, desc, lg, tbl, ctx.W);
}

function renderMultiples(spec: MultiplesSpec, ctx: Ctx): string {
  const t = ctx.t;
  const all = spec.panels.flatMap((p) => p.series.flatMap((s) => s.values));
  const fmt = makeFmt(spec.unit, all);
  const idxById = new Map<string, number>();
  const defs: { name: string; idx: number; color?: string; quality?: string }[] = [];
  for (const p of spec.panels) for (const s of p.series) {
    if (!idxById.has(s.id)) { idxById.set(s.id, idxById.size); defs.push({ name: s.name, idx: idxById.size - 1, ...(s.color ? { color: s.color } : {}) }); }
  }
  const gap = 14;
  const cols = clamp(spec.columns ?? Math.floor((ctx.W + gap) / 230), 1, spec.panels.length);
  const pw = (ctx.W - gap * (cols - 1)) / cols;
  const rowsN = Math.ceil(spec.panels.length / cols);
  const hdr = 34;
  const total = present(all).length;
  const shared = spec.sharedY !== false;
  const gdom = shared ? domainFor(spec.panels.flatMap((p) => p.series), spec.panelType, false, spec.yMin, spec.yMax, 3) : null;
  let shapes = ''; let pts = '';
  spec.panels.forEach((p, k) => {
    const col = k % cols; const row = Math.floor(k / cols);
    const x = col * (pw + gap); const y = row * (ctx.H / rowsN);
    const ph = ctx.H / rowsN - gap;
    const dom = shared ? gdom : domainFor(p.series, spec.panelType, false, spec.yMin, spec.yMax, 3);
    shapes += `<g class="lc-panel" data-panel="${esc(p.id)}"><text class="lc-ptitle" x="${n2(x + 2)}" y="${n2(y + 13)}">${esc(truncate(p.title, pw - 4, 13))}</text>`;
    const sub = [p.subtitle, p.quality ? `${t.quality}: ${p.quality}` : ''].filter(Boolean).join(' · ');
    if (sub) shapes += `<text class="lc-psub${p.quality ? ' lc-psub-q' : ''}" x="${n2(x + 2)}" y="${n2(y + 27)}">${esc(truncate(sub, pw - 4, 10.5))}</text>`;
    if (!dom || present(p.series.flatMap((s) => s.values)).length === 0) shapes += `<text class="lc-empty" x="${n2(x + pw / 2)}" y="${n2(y + hdr + (ph - hdr) / 2)}" text-anchor="middle">${esc(t.na)}</text>`;
    else {
      const r = plot({ ctx, x, y: y + hdr, w: pw, h: ph - hdr, kind: spec.panelType, horizontal: false, stacked: false, series: p.series, sidx: p.series.map((s) => idxById.get(s.id) ?? 0), labels: spec.labels, fmt, dom, compact: true, bare: false, focus: total <= MAX_FOCUS, panelName: p.title });
      shapes += r.shapes; pts += r.points;
    }
    shapes += '</g>';
  });
  const desc = `${spec.panels.length} ${t.panel}. ${spec.panels.map((p) => `${p.title}${p.quality ? ` (${t.quality}: ${p.quality})` : ''} — ${summarize(t, spec.labels, p.series, fmt)}`).join(' ')}`;
  const lg = (spec.legend ?? defs.length > 1) ? legend(defs) : '';
  const tables = spec.panels.map((p) => seriesTable(t, `${spec.title} · ${p.title}${p.quality ? ` (${p.quality})` : ''}`, spec.xLabel ?? t.cat, spec.labels, p.series, fmt)).join('');
  return frame(ctx, spec, shapes + pts, desc, lg, wrapTable(spec.table ?? 'details', t, tables), ctx.W);
}

/** Validate a spec (throws ChartSpecError) and render it to a deterministic SVG-in-<figure> HTML string. */
export function renderChart(input: unknown, options: RenderOptions = {}): string {
  const spec = validateSpec(input);
  const pid = spec.id ?? `lc-${hash(JSON.stringify(spec))}`;
  const W = options.width ?? spec.width ?? (spec.type === 'sparkline' ? 160 : spec.type === 'donut' ? 280 : 640);
  const Wc = clamp(W, 80, 2400);
  let H: number;
  if (spec.height !== undefined) H = spec.height;
  else if (spec.type === 'sparkline') H = 36;
  else if (spec.type === 'donut') H = Math.min(260, Math.max(180, Wc * 0.8));
  else if (spec.type === 'multiples') {
    const cols = clamp(spec.columns ?? Math.floor((Wc + 14) / 230), 1, spec.panels.length);
    H = Math.ceil(spec.panels.length / cols) * 180;
  } else if (spec.type === 'bar' && spec.horizontal) H = Math.max(160, spec.labels.length * (spec.series.length > 1 && !spec.stacked ? 14 * spec.series.length + 10 : 30) + 50);
  else H = Wc < 420 ? 240 : 300;
  const ctx: Ctx = { W: Wc, H, pid, t: STR[spec.lang ?? 'ko'] };
  if (spec.type === 'donut') return renderDonut(spec, ctx);
  if (spec.type === 'multiples') return renderMultiples(spec, ctx);
  return renderCartesian(spec, ctx);
}
