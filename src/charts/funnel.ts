// Funnel: ordered stages as centred bars whose width is proportional to the value, with the step conversion
// (value / previous value) between stages. A null stage is shown as missing and breaks the chain on both sides.
import type { BaseSpec, Value } from '../types.ts';
import { definePlugin } from '../plugin.ts';
import { BASE, base, color, dict, idList, optStr, str, value } from '../check.ts';
import { type Ctx, colorAttrs, empty, focusable, frame, pct, present, table, wrapTable } from '../kit.ts';
import { esc, makeFmt, n2, truncate, tw } from '../format.ts';

export interface FunnelStage { id: string; label: string; value: Value; quality?: string }
export interface FunnelSpec extends BaseSpec {
  type: 'funnel';
  stages: FunnelStage[];
  /** Bar colour override (default series colour 1). */
  color?: string;
}

const ROW = 30;
const GAP = 20;
const L = {
  ko: { step: '이전 단계 대비', ofFirst: '첫 단계 대비', overall: '전체 전환율', stages: '단계' },
  en: { step: 'From previous', ofFirst: 'Of first stage', overall: 'Overall conversion', stages: ' stages' },
};

/** Step conversion into stage i, or null when either side is missing or the previous value is 0. */
const stepConv = (st: FunnelStage[], i: number): number | null => {
  const a = st[i - 1]?.value; const b = st[i]?.value;
  return a === null || a === undefined || b === null || b === undefined || a <= 0 ? null : b / a;
};

export const plugin = definePlugin<FunnelSpec>({
  type: 'funnel',
  names: { ko: '퍼널 차트', en: 'Funnel chart' },
  validate(input) {
    const o = dict(input, 'spec', [...BASE, 'stages', 'color']);
    const out = base(o) as unknown as FunnelSpec;
    out.type = 'funnel';
    out.stages = idList(o.stages, 'stages', ['label', 'value', 'quality'], 30, (it, p, id) => {
      const s: FunnelStage = { id, label: str(it.label, `${p}.label`, 60), value: value(it.value, `${p}.value`, 0) };
      const q = optStr(it.quality, `${p}.quality`, 60);
      if (q !== undefined) s.quality = q;
      return s;
    });
    const c = color(o.color, 'color');
    if (c !== undefined) out.color = c;
    return out;
  },
  height(spec) {
    return spec.stages.length * ROW + (spec.stages.length - 1) * GAP + 8;
  },
  render(spec, ctx: Ctx) {
    const t = ctx.t;
    const L2 = L[ctx.lang];
    const st = spec.stages;
    const fmt = makeFmt(spec.unit, st.map((s) => s.value));
    const vals = present(st.map((s) => s.value));
    const first = st[0]?.value ?? null;
    const last = st[st.length - 1]?.value ?? null;
    const ofFirst = (v: Value): number | null => (v === null || first === null || first <= 0 ? null : v / first);

    const stageText = (s: FunnelStage, i: number): string => {
      if (s.value === null) return `${s.label}: ${t.na}`;
      const c = i > 0 ? stepConv(st, i) : null; const f = i > 0 ? ofFirst(s.value) : null;
      return `${s.label}: ${fmt(s.value)}${c !== null ? ` · ${L2.step} ${pct(c)}` : ''}${f !== null ? ` · ${L2.ofFirst} ${pct(f)}` : ''}${s.quality ? ` · ${s.quality}` : ''}`;
    };

    let svg = '';
    if (!vals.length) svg = empty(ctx);
    else {
      const maxV = Math.max(...vals);
      const labelW = Math.min(ctx.W * 0.32, 160, Math.max(48, ...st.map((s) => tw(s.label, 12) + 10)));
      const valW = Math.min(ctx.W * 0.22, Math.max(36, ...vals.map((v) => tw(fmt(v), 12) + 8)));
      const ax0 = labelW; const aw = Math.max(10, ctx.W - labelW - valW);
      const cx = ax0 + aw / 2;
      st.forEach((s, i) => {
        const y = 4 + i * (ROW + GAP);
        const ty = n2(y + ROW / 2 + 4);
        svg += `<text class="lc-funnel-lbl" x="0" y="${ty}">${esc(truncate(s.label, labelW - 8, 12))}</text>`;
        if (i > 0) {
          const c = stepConv(st, i);
          if (c !== null) svg += `<text class="lc-funnel-conv" x="${n2(cx)}" y="${n2(y - GAP / 2 + 4)}" text-anchor="middle">${esc(`↓ ${pct(c)}`)}</text>`;
        }
        if (s.value === null) {
          svg += `<text class="lc-funnel-na" x="${n2(cx)}" y="${ty}" text-anchor="middle">${esc(truncate(t.na, aw, 12))}</text>`;
          return;
        }
        const w = maxV > 0 ? Math.max(s.value > 0 ? 1 : 0, (aw * s.value) / maxV) : 0;
        const inner = `<rect class="lc-mark lc-funnel ${colorAttrs(0, spec.color)} data-i="${i}" data-v="${s.value}" x="${n2(cx - w / 2)}" y="${n2(y)}" width="${n2(w)}" height="${ROW}" rx="2"/>` +
          `<text class="lc-funnel-val" x="${n2(ctx.W - 2)}" y="${ty}" text-anchor="end">${esc(truncate(fmt(s.value), valW - 4, 12))}</text>`;
        // At most 30 stages (< MAX_FOCUS): every present stage is a tab stop.
        svg += focusable(ctx, 'lc-pt-funnel', stageText(s, i), inner, cx, y);
      });
    }

    const missing = st.filter((s) => s.value === null).length;
    const overall = last !== null && first !== null && first > 0 && st.length > 1 ? last / first : null;
    const desc = `${st.length}${ctx.lang === 'ko' ? '개 ' : ''}${L2.stages}.${overall !== null ? ` ${L2.overall} ${pct(overall)}.` : ''} ${st.map(stageText).join(', ')}.${missing ? ` ${t.missing} ${missing}.` : ''}`;
    const tbl = table(t, spec.title, [t.cat, t.value, L2.step, L2.ofFirst], st.map((s, i) => {
      const c = i > 0 ? stepConv(st, i) : null; const f = ofFirst(s.value);
      return { th: `${s.label}${s.quality ? ` (${s.quality})` : ''}`, cells: [s.value === null ? null : fmt(s.value), i === 0 ? '–' : c === null ? null : pct(c), f === null ? null : pct(f)] };
    }));
    return frame(ctx, spec, svg, desc, '', wrapTable(spec.table ?? 'details', t, tbl));
  },
});
