export type Value = number | null;

export interface Unit {
  /** Human readable unit name shown next to the title, e.g. "원", "%". */
  label?: string;
  prefix?: string;
  suffix?: string;
  /** Fixed decimals for values; inferred (max 2) from data when omitted. */
  decimals?: number;
}

export interface Series {
  id: string;
  name: string;
  /** One value per label. null = missing (drawn as a gap, never as 0). */
  values: Value[];
  /** Optional colour override: #hex, var(--token) or a colour keyword. */
  color?: string;
  /** Data-quality note, e.g. "추정치", shown in legend and table. */
  quality?: string;
}

export interface Slice {
  id: string;
  label: string;
  value: Value;
  color?: string;
  quality?: string;
}

export interface BaseSpec {
  title: string;
  description?: string;
  unit?: Unit;
  width?: number;
  height?: number;
  legend?: boolean;
  /** "ko" (default) or "en" for built-in strings. */
  lang?: 'ko' | 'en';
  /** Data table mode: "details" (default), "hidden" (screen reader only) or "none". */
  table?: 'details' | 'hidden' | 'none';
  /** Stable DOM id prefix; derived from the spec when omitted. */
  id?: string;
}

export interface CartesianBase extends BaseSpec {
  labels: string[];
  xLabel?: string;
  yMin?: number;
  yMax?: number;
  series: Series[];
}

export interface LineSpec extends CartesianBase { type: 'line' }
export interface AreaSpec extends CartesianBase { type: 'area'; stacked?: boolean }
export interface BarSpec extends CartesianBase { type: 'bar'; stacked?: boolean; horizontal?: boolean }
export interface SparklineSpec extends CartesianBase { type: 'sparkline' }
export interface DonutSpec extends BaseSpec { type: 'donut'; slices: Slice[]; centerLabel?: string }

export interface Panel {
  id: string;
  title: string;
  subtitle?: string;
  quality?: string;
  series: Series[];
}

export interface MultiplesSpec extends BaseSpec {
  type: 'multiples';
  panelType: 'line' | 'area' | 'bar';
  labels: string[];
  xLabel?: string;
  panels: Panel[];
  columns?: number;
  /** Share one y domain across panels (default true). */
  sharedY?: boolean;
  yMin?: number;
  yMax?: number;
}

export type ChartSpec = LineSpec | AreaSpec | BarSpec | SparklineSpec | DonutSpec | MultiplesSpec;
