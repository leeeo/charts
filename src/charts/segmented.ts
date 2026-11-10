// Segmented bar: one horizontal 100% bar split into shares, with label and share under each wide-enough segment.
import type { BaseSpec, Slice } from '../types.ts';
import { definePlugin } from '../plugin.ts';
import { BASE, base, color, dict, idList, optBool, optStr, str, value } from '../check.ts';
import { type Ctx, colorAttrs, empty, focusable, frame, legend, pct, table, wrapTable } from '../kit.ts';
import { esc, makeFmt, n2, truncate, tw } from '../format.ts';

export interface SegmentedSpec extends BaseSpec {
  type: 'segmented';
  /** Segments in order; null value = missing (not drawn, listed as 데이터 없음). */
  items: Slice[];
  /** Label and share text under the segments (default true). */
  showLabels?: boolean;
}

const BAR_Y = 4;
const BAR_H = 26;

export const plugin = definePlugin<SegmentedSpec>({
  type: 'segmented',
  names: { ko: '구성 막대', en: 'Segmented bar' },
  defaultWidth: 480,
  validate(input) {
    const o = dict(input, 'spec', [...BASE, 'items', 'showLabels']);
    const out = base(o) as unknown as SegmentedSpec;
    out.type = 'segmented';
    out.items = idList(o.items, 'items', ['label', 'value', 'color', 'quality'], 12, (it, p, id) => {
      const s: Slice = { id, label: str(it.label, `${p}.label`, 60), value: value(it.value, `${p}.value`, 0) };
      const c = color(it.color, `${p}.color`);
      const q = optStr(it.quality, `${p}.quality`, 60);
      if (c !== undefined) s.color = c;
      if (q !== undefined) s.quality = q;
      return s;
    });
    const sl = optBool(o.showLabels, 'showLabels');
    if (sl !== undefined) out.showLabels = sl;
    return out;
  },
  height(spec) {
    return spec.showLabels === false ? BAR_Y * 2 + BAR_H : 70;
  },
  render(spec, ctx: Ctx) {
    const t = ctx.t;
    const fmt = makeFmt(spec.unit, spec.items.map((s) => s.value));
    const total = spec.items.reduce((a, s) => a + (s.value ?? 0), 0);
    const share = (v: number): string | null => (total > 0 ? pct(v / total) : null);
    const itemText = (s: Slice): string => (s.value === null ? `${s.label}: ${t.na}` : `${s.label}: ${fmt(s.value)}${total > 0 ? ` (${share(s.value)})` : ''}${s.quality ? ` · ${s.quality}` : ''}`);

    let svg = '';
    if (total <= 0) svg = empty(ctx);
    else {
      const x0 = 1;
      const bw = ctx.W - 2;
      const labels = spec.showLabels !== false;
      let x = x0;
      spec.items.forEach((s, i) => {
        if (s.value === null || s.value <= 0) return;
        const w = (s.value / total) * bw;
        let inner = `<rect class="lc-mark lc-seg ${colorAttrs(i, s.color)} data-i="${i}" data-v="${s.value}" x="${n2(x)}" y="${BAR_Y}" width="${n2(w)}" height="${BAR_H}"/>`;
        if (labels && w >= 28) {
          const room = w - 4;
          const sh = share(s.value) as string;
          inner += `<text class="lc-seg-lbl" x="${n2(x + 2)}" y="${BAR_Y + BAR_H + 15}">${esc(truncate(s.label, room, 12))}</text>`;
          if (tw(sh, 11) <= room) inner += `<text class="lc-seg-pct" x="${n2(x + 2)}" y="${BAR_Y + BAR_H + 30}">${esc(sh)}</text>`;
        }
        // At most 12 segments (< MAX_FOCUS): each one is a tab stop.
        svg += focusable(ctx, 'lc-pt-seg', itemText(s), inner, x + w / 2, BAR_Y);
        x += w;
      });
    }

    const missing = spec.items.filter((s) => s.value === null).length;
    const desc = `${t.total} ${fmt(total)}. ${spec.items.map(itemText).join(', ')}.${missing ? ` ${t.missing} ${missing}.` : ''}`;
    const lg = spec.legend === false ? '' : legend(spec.items.map((s, i) => ({
      name: s.label, idx: i, ...(s.color ? { color: s.color } : {}), ...(s.quality ? { quality: s.quality } : {}),
      extra: s.value === null ? t.na : `${fmt(s.value)}${total > 0 ? ` · ${share(s.value)}` : ''}`,
    })));
    const tbl = table(t, spec.title, [t.cat, t.value, t.share], spec.items.map((s) => ({
      th: `${s.label}${s.quality ? ` (${s.quality})` : ''}`,
      cells: s.value === null ? [null, null] : [fmt(s.value), share(s.value)],
    })));
    return frame(ctx, spec, svg, desc, lg, wrapTable(spec.table ?? 'details', t, tbl));
  },
});
