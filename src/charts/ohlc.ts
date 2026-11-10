// OHLC bars: the candlestick data drawn as a high-low line with an open tick on the left and a close tick on the
// right, so the direction is readable from the shape alone (not only from colour). Same spec and options as
// candlestick (ma, overlays, volume, convention).
import { definePlugin } from '../plugin.ts';
import { type CandlestickSpec, ohlcHeight, renderOhlc, validateOhlcSpec } from './candlestick.ts';

export interface OhlcSpec extends Omit<CandlestickSpec, 'type'> { type: 'ohlc' }

export const plugin = definePlugin<OhlcSpec>({
  type: 'ohlc',
  names: { ko: 'OHLC 차트', en: 'OHLC bars' },
  validate: (input) => validateOhlcSpec(input, 'ohlc') as OhlcSpec,
  height: ohlcHeight,
  render: (spec, ctx) => renderOhlc(spec, ctx, true),
});
