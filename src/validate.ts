import type { ChartSpec } from './types.ts';
import { plugins } from './charts/index.ts';
import { ChartSpecError } from './check.ts';
import { validateWith } from './validate-core.ts';

export { ChartSpecError };

/** Validate untrusted input (every chart type) and return a clean, typed copy. Throws ChartSpecError with a JSON path. */
export function validateSpec(input: unknown): ChartSpec {
  return validateWith(input, plugins);
}
