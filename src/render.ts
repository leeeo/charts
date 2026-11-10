import type { ChartSpec, CoreSpec, DonutSpec, MultiplesSpec, Series, Value } from './types.ts';
import { validateSpec } from './validate.ts';
import { type Fmt, clamp, esc, hash, makeFmt, n2, truncate, tw } from './format.ts';
import { type Ctx, MAX_FOCUS, STR, colorAttrs, empty, frame, legend, pct, present, seriesTable, summarize, table, tip, wrapTable } from './kit.ts';
import { type Domain, domainFor, plot } from './cartesian.ts';
import { plugins } from './charts/index.ts';
import { renderRing } from './radial.ts';

export interface RenderOptions {
  /** Override the viewBox width (e.g. the container width). */
  width?: number;
}

const CORE_NAMES = {
  ko: { line: '선 차트', area: '영역 차트', bar: '막대 차트', sparkline: '스파크라인', donut: '도넛 차트', multiples: '작은 다중 차트' },
  en: { line: 'Line chart', area: 'Area chart', bar: 'Bar chart', sparkline: 'Sparkline', donut: 'Donut chart', multiples: 'Small multiples' },
} as const;

function renderCartesian(spec: Exclude<CoreSpec, DonutSpec | MultiplesSpec>, ctx: Ctx): string {
  const kind = spec.type === 'sparkline' ? 'line' : spec.type;
  const stacked = (spec.type === 'bar' || spec.type === 'area') && spec.stacked === true;
  const horizontal = spec.type === 'bar' && spec.horizontal === true;
  const percent = spec.type === 'bar' && spec.percent === true && stacked;
  const all = spec.series.flatMap((s) => s.values);
  const fmt = makeFmt(spec.unit, all);
  const spark = spec.type === 'sparkline';
  // percent bars: every category is scaled to 100% of its absolute total; raw values stay in the table and value box
  const totals = spec.labels.map((_, i) => spec.series.reduce((a, s) => a + Math.abs(s.values[i] ?? 0), 0));
  const drawn: Series[] = percent
    ? spec.series.map((s) => ({ ...s, values: s.values.map((v, i): Value => (v === null ? null : (totals[i] ?? 0) > 0 ? (v / (totals[i] as number)) * 100 : 0)) }))
    : spec.series;
  const dom = spark ? sparkDomain(all) : percent ? percentDomain(drawn) : domainFor(drawn, kind, stacked, spec.yMin, spec.yMax, 5);
  const total = present(all).length;
  let inner: string;
  if (!dom) inner = empty(ctx);
  else if (spark) inner = renderSpark(spec, ctx, dom, fmt);
  else {
    const extra = percent ? {
      tickFmt: (v: number): string => `${Math.round(v)}%`,
      labelFor: (se: Series, i: number, v: number): string => {
        const raw = spec.series.find((s) => s.id === se.id)?.values[i];
        return `${spec.labels[i] ?? ''}, ${se.name}: ${pct(v / 100)}${raw === null || raw === undefined ? '' : ` (${fmt(raw)})`}${se.quality ? ` · ${se.quality}` : ''}`;
      },
    } : {};
    const r = plot({ ctx, x: 0, y: 0, w: ctx.W, h: ctx.H, kind, horizontal, stacked, series: drawn, sidx: spec.series.map((_, i) => i), labels: spec.labels, fmt, dom, compact: false, bare: false, ...(spec.xLabel ? { xLabel: spec.xLabel } : {}), focus: total <= MAX_FOCUS, ...extra });
    inner = r.shapes + r.points;
  }
  const first = spec.labels[0] ?? ''; const last = spec.labels[spec.labels.length - 1] ?? '';
  const desc = `${spec.labels.length}${ctx.t.items} (${first}–${last}). ${summarize(ctx.t, spec.labels, spec.series, fmt)}`;
  const showLegend = !spark && (spec.legend ?? spec.series.length > 1);
  const lg = showLegend ? legend(spec.series.map((s, i) => ({ name: s.name, idx: i, ...(s.color ? { color: s.color } : {}), ...(s.quality ? { quality: s.quality } : {}) }))) : '';
  const tbl = wrapTable(spec.table ?? (spark ? 'hidden' : 'details'), ctx.t, seriesTable(ctx.t, spec.title, spec.xLabel ?? ctx.t.cat, spec.labels, spec.series, fmt));
  return frame(ctx, spec, inner, desc, lg, tbl, { caption: !spark });
}

function percentDomain(list: Series[]): Domain | null {
  if (!list.some((s) => present(s.values).length)) return null;
  const neg = list.some((s) => s.values.some((v) => v !== null && v < 0));
  return neg ? { min: -100, max: 100, ticks: [-100, -50, 0, 50, 100] } : { min: 0, max: 100, ticks: [0, 25, 50, 75, 100] };
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
  return frame(ctx, spec, shapes + pts, desc, lg, wrapTable(spec.table ?? 'details', t, tables));
}

/** Validate a spec (throws ChartSpecError) and render it to a deterministic SVG-in-<figure> HTML string. */
export function renderChart(input: unknown, options: RenderOptions = {}): string {
  const spec = validateSpec(input);
  const pid = spec.id ?? `lc-${hash(JSON.stringify(spec))}`;
  const lang = spec.lang ?? 'ko';
  const plugin = Object.hasOwn(plugins, spec.type) ? plugins[spec.type] : undefined;
  if (plugin) {
    const Wc = clamp(options.width ?? spec.width ?? plugin.defaultWidth ?? 640, 80, 2400);
    const H = spec.height ?? plugin.height(spec, Wc);
    return plugin.render(spec, { W: Wc, H, pid, t: STR[lang], typeName: plugin.names[lang], lang });
  }
  const core = spec as CoreSpec;
  const W = options.width ?? core.width ?? (core.type === 'sparkline' ? 160 : core.type === 'donut' ? 280 : 640);
  const Wc = clamp(W, 80, 2400);
  let H: number;
  if (core.height !== undefined) H = core.height;
  else if (core.type === 'sparkline') H = 36;
  else if (core.type === 'donut') H = Math.min(260, Math.max(180, Wc * 0.8));
  else if (core.type === 'multiples') {
    const cols = clamp(core.columns ?? Math.floor((Wc + 14) / 230), 1, core.panels.length);
    H = Math.ceil(core.panels.length / cols) * 180;
  } else if (core.type === 'bar' && core.horizontal) H = Math.max(160, core.labels.length * (core.series.length > 1 && !core.stacked ? 14 * core.series.length + 10 : 30) + 50);
  else H = Wc < 420 ? 240 : 300;
  const ctx: Ctx = { W: Wc, H, pid, t: STR[lang], typeName: CORE_NAMES[lang][core.type], lang };
  if (core.type === 'donut') return renderRing(core, ctx);
  if (core.type === 'multiples') return renderMultiples(core, ctx);
  return renderCartesian(core, ctx);
}
