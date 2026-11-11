// Segmented bar: one horizontal 100% bar split into shares, with the name and the bold share under every segment.
// Labels are centred under their segment and pushed sideways (with a leader line) when neighbours would collide, so
// narrow segments keep a readable name instead of a truncated one.
import type { BaseSpec, Slice } from '../types.ts';
import { definePlugin } from '../plugin.ts';
import { BASE, base, color, dict, idList, optBool, optStr, str, value } from '../check.ts';
import { type Ctx, colorAttrs, empty, focusable, frame, legend, pct, table, wrapTable } from '../kit.ts';
import { makeFmt, n2 } from '../format.ts';
import { LBL, LINE, blockW, labelLayer, leader, nameValue, spread } from './cmp.ts';

export interface SegmentedSpec extends BaseSpec {
  type: 'segmented';
  /** Segments in order; null value = missing (not drawn, listed as 데이터 없음). */
  items: Slice[];
  /** Label and share text under the segments (default true). */
  showLabels?: boolean;
}

const BAR_Y = 4;
const BAR_H = 26;
/** Gap between the bar and the label block (room for the leader line). */
const LBL_GAP = 8;

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
    return spec.showLabels === false ? BAR_Y * 2 + BAR_H : BAR_Y + BAR_H + LBL_GAP + LBL + LINE + 6;
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
      const blocks: { i: number; cx: number; w: number; name: string; sh: string; cls: string }[] = [];
      spec.items.forEach((s, i) => {
        if (s.value === null || s.value <= 0) return;
        const w = (s.value / total) * bw;
        const inner = `<rect class="lc-mark lc-seg ${colorAttrs(i, s.color)} data-i="${i}" data-v="${s.value}" x="${n2(x)}" y="${BAR_Y}" width="${n2(w)}" height="${BAR_H}"/>`;
        const sh = share(s.value) as string;
        blocks.push({ i, cx: x + w / 2, w: blockW(s.label, sh) + 4, name: s.label, sh, cls: colorAttrs(i, s.color) });
        // At most 12 segments (< MAX_FOCUS): each one is a tab stop.
        svg += focusable(ctx, 'lc-pt-seg', itemText(s), inner, x + w / 2, BAR_Y);
        x += w;
      });
      if (labels && blocks.length) {
        // Label blocks are centred under their segment, capped at a third of the width, and pushed apart when they
        // would collide; when even that cannot fit, every block gets an equal share and the names are truncated.
        const cap = Math.max(36, Math.min(ctx.W / 3, 180));
        let widths = blocks.map((b) => Math.min(b.w, cap));
        const need = widths.reduce((a, b) => a + b, 0) + 6 * (blocks.length - 1);
        if (need > bw) widths = blocks.map(() => Math.max(24, (bw - 6 * (blocks.length - 1)) / blocks.length));
        const centres = spread(blocks.map((b) => b.cx), widths, x0, x0 + bw, 6);
        const top = BAR_Y + BAR_H + LBL_GAP;
        let lbl = '';
        blocks.forEach((b, k) => {
          const lx = centres[k] as number;
          if (Math.abs(lx - b.cx) > 4) lbl += leader(b.cx, BAR_Y + BAR_H + 1, lx, top - 2);
          lbl += nameValue(lx, top + LBL, b.name, b.sh, b.cls, 'middle', (widths[k] as number) - 2);
        });
        svg += labelLayer(lbl);
      }
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
