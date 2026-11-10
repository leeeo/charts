import type { ChartSpec } from '../src/types.ts';

/** One gallery entry. `wide` spans the full gallery row (e.g. small multiples, calendar). */
export interface Example { id: string; heading: string; note: string; spec: ChartSpec; wide?: boolean }
