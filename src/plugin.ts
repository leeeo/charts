import type { Ctx } from './kit.ts';

/**
 * One chart type outside the core six. Each lives in src/charts/<type>.ts and is listed in src/charts/index.ts.
 * - validate(): receives the raw (untrusted) spec object; must call dict(input, 'spec', [...BASE, ...own keys]) and
 *   base(o) from validate.ts, and return a clean typed copy. Throw only through fail()/the shared helpers.
 * - height(): default viewBox height for a width when the spec has no `height`.
 * - render(): returns the full <figure> via frame() from kit.ts.
 */
export interface ChartPlugin<S extends { type: string } = { type: string }> {
  type: S['type'];
  names: { ko: string; en: string };
  /** Default viewBox width when neither the spec nor the caller gives one (default 640). */
  defaultWidth?: number;
  validate(input: unknown): S;
  height(spec: S, width: number): number;
  render(spec: S, ctx: Ctx): string;
}

/** Helper so plugin files get full typing without casts. */
export const definePlugin = <S extends { type: string }>(p: ChartPlugin<S>): ChartPlugin<S> => p;
