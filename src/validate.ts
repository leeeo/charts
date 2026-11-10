import type { ChartSpec, Panel, Series, Slice, Unit, Value } from './types.ts';

export class ChartSpecError extends Error {
  readonly path: string;
  constructor(path: string, message: string) {
    super(`${path}: ${message}`);
    this.name = 'ChartSpecError';
    this.path = path;
  }
}

const SAFE_COLOR = /^(#[0-9a-fA-F]{3,8}|var\(--[A-Za-z0-9_-]+\)|[a-zA-Z]{3,20})$/;
const SAFE_ID = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
const MAX_SERIES = 12;
const MAX_POINTS = 2000;

type Dict = Record<string, unknown>;

function fail(path: string, message: string): never {
  throw new ChartSpecError(path, message);
}

function dict(v: unknown, path: string, allowed: readonly string[]): Dict {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) fail(path, 'must be an object');
  const o = v as Dict;
  for (const k of Object.keys(o)) if (!allowed.includes(k)) fail(`${path}.${k}`, 'unknown property');
  return o;
}

function str(v: unknown, path: string, max = 200): string {
  if (typeof v !== 'string' || v.trim() === '') fail(path, 'must be a non-empty string');
  if (v.length > max) fail(path, `must be at most ${max} characters`);
  return v;
}

function optStr(v: unknown, path: string, max = 200): string | undefined {
  return v === undefined ? undefined : str(v, path, max);
}

function optNum(v: unknown, path: string, min: number, max: number): number | undefined {
  if (v === undefined) return undefined;
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) fail(path, `must be a finite number in [${min}, ${max}]`);
  return v;
}

function optBool(v: unknown, path: string): boolean | undefined {
  if (v === undefined) return undefined;
  if (typeof v !== 'boolean') fail(path, 'must be a boolean');
  return v;
}

function oneOf<T extends string>(v: unknown, path: string, options: readonly T[]): T | undefined {
  if (v === undefined) return undefined;
  if (typeof v !== 'string' || !options.includes(v as T)) fail(path, `must be one of ${options.join(', ')}`);
  return v as T;
}

function color(v: unknown, path: string): string | undefined {
  if (v === undefined) return undefined;
  if (typeof v !== 'string' || !SAFE_COLOR.test(v)) fail(path, 'must be #hex, var(--token) or a colour keyword');
  return v;
}

function unit(v: unknown, path: string): Unit | undefined {
  if (v === undefined) return undefined;
  const o = dict(v, path, ['label', 'prefix', 'suffix', 'decimals']);
  const out: Unit = {};
  const label = optStr(o.label, `${path}.label`, 40);
  const prefix = o.prefix === undefined ? undefined : String(optStr(o.prefix, `${path}.prefix`, 12));
  const suffix = o.suffix === undefined ? undefined : String(optStr(o.suffix, `${path}.suffix`, 12));
  const decimals = optNum(o.decimals, `${path}.decimals`, 0, 6);
  if (decimals !== undefined && !Number.isInteger(decimals)) fail(`${path}.decimals`, 'must be an integer');
  if (label !== undefined) out.label = label;
  if (prefix !== undefined) out.prefix = prefix;
  if (suffix !== undefined) out.suffix = suffix;
  if (decimals !== undefined) out.decimals = decimals;
  return out;
}

function labels(v: unknown, path: string): string[] {
  if (!Array.isArray(v) || v.length === 0) fail(path, 'must be a non-empty array of strings');
  if (v.length > MAX_POINTS) fail(path, `must have at most ${MAX_POINTS} entries`);
  return v.map((x, i) => str(x, `${path}[${i}]`, 60));
}

function values(v: unknown, path: string, n: number, nonNegative: boolean): Value[] {
  if (!Array.isArray(v)) fail(path, 'must be an array');
  if (v.length !== n) fail(path, `must have ${n} entries (one per label), got ${v.length}`);
  return v.map((x, i) => {
    if (x === null) return null;
    if (typeof x !== 'number' || !Number.isFinite(x)) fail(`${path}[${i}]`, 'must be a finite number or null (missing)');
    if (nonNegative && x < 0) fail(`${path}[${i}]`, 'must not be negative for this chart');
    return x;
  });
}

function seriesList(v: unknown, path: string, n: number, nonNegative: boolean): Series[] {
  if (!Array.isArray(v) || v.length === 0) fail(path, 'must be a non-empty array');
  if (v.length > MAX_SERIES) fail(path, `must have at most ${MAX_SERIES} series`);
  const seen = new Set<string>();
  return v.map((s, i) => {
    const p = `${path}[${i}]`;
    const o = dict(s, p, ['id', 'name', 'values', 'color', 'quality']);
    const id = str(o.id, `${p}.id`, 64);
    if (seen.has(id)) fail(`${p}.id`, 'duplicate id');
    seen.add(id);
    const out: Series = { id, name: str(o.name, `${p}.name`, 80), values: values(o.values, `${p}.values`, n, nonNegative) };
    const c = color(o.color, `${p}.color`);
    const q = optStr(o.quality, `${p}.quality`, 60);
    if (c !== undefined) out.color = c;
    if (q !== undefined) out.quality = q;
    return out;
  });
}

const BASE = ['type', 'title', 'description', 'unit', 'width', 'height', 'legend', 'lang', 'table', 'id'] as const;

function base(o: Dict) {
  const out: Record<string, unknown> = { title: str(o.title, 'title', 120) };
  const put = (k: string, v: unknown) => { if (v !== undefined) out[k] = v; };
  put('description', optStr(o.description, 'description', 600));
  put('unit', unit(o.unit, 'unit'));
  put('width', optNum(o.width, 'width', 80, 2400));
  put('height', optNum(o.height, 'height', 24, 2400));
  put('legend', optBool(o.legend, 'legend'));
  put('lang', oneOf(o.lang, 'lang', ['ko', 'en'] as const));
  put('table', oneOf(o.table, 'table', ['details', 'hidden', 'none'] as const));
  if (o.id !== undefined) {
    if (typeof o.id !== 'string' || !SAFE_ID.test(o.id)) fail('id', 'must match /^[A-Za-z][A-Za-z0-9_-]{0,63}$/');
    out.id = o.id;
  }
  return out;
}

/** Validate untrusted input and return a clean, typed copy. Throws ChartSpecError with a JSON path. */
export function validateSpec(input: unknown): ChartSpec {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) fail('spec', 'must be an object');
  const probe = (typeof input === 'object' && input !== null ? (input as Dict).type : undefined);
  const put = (out: Record<string, unknown>, k: string, v: unknown) => { if (v !== undefined) out[k] = v; };
  switch (probe) {
    case 'line':
    case 'area':
    case 'bar':
    case 'sparkline': {
      const extra = probe === 'area' ? ['stacked'] : probe === 'bar' ? ['stacked', 'horizontal'] : [];
      const o = dict(input, 'spec', [...BASE, 'labels', 'xLabel', 'yMin', 'yMax', 'series', ...extra]);
      const out = base(o);
      out.type = probe;
      const ls = labels(o.labels, 'labels');
      const stacked = optBool(o.stacked, 'stacked');
      out.labels = ls;
      put(out, 'xLabel', optStr(o.xLabel, 'xLabel', 60));
      const yMin = optNum(o.yMin, 'yMin', -1e15, 1e15);
      const yMax = optNum(o.yMax, 'yMax', -1e15, 1e15);
      if (yMin !== undefined && yMax !== undefined && yMin >= yMax) fail('yMax', 'must be greater than yMin');
      put(out, 'yMin', yMin);
      put(out, 'yMax', yMax);
      out.series = seriesList(o.series, 'series', ls.length, stacked === true);
      if (probe === 'sparkline' && (out.series as Series[]).length !== 1) fail('series', 'sparkline takes exactly one series');
      put(out, 'stacked', stacked);
      put(out, 'horizontal', optBool(o.horizontal, 'horizontal'));
      return out as unknown as ChartSpec;
    }
    case 'donut': {
      const o = dict(input, 'spec', [...BASE, 'slices', 'centerLabel']);
      const out = base(o);
      out.type = 'donut';
      const sl = o.slices;
      if (!Array.isArray(sl) || sl.length === 0) fail('slices', 'must be a non-empty array');
      if (sl.length > MAX_SERIES) fail('slices', `must have at most ${MAX_SERIES} entries`);
      const seen = new Set<string>();
      out.slices = sl.map((s, i): Slice => {
        const p = `slices[${i}]`;
        const d = dict(s, p, ['id', 'label', 'value', 'color', 'quality']);
        const id = str(d.id, `${p}.id`, 64);
        if (seen.has(id)) fail(`${p}.id`, 'duplicate id');
        seen.add(id);
        const v = d.value;
        if (v !== null && (typeof v !== 'number' || !Number.isFinite(v) || v < 0)) fail(`${p}.value`, 'must be a finite number >= 0 or null (missing)');
        const r: Slice = { id, label: str(d.label, `${p}.label`, 80), value: v as Value };
        const c = color(d.color, `${p}.color`);
        const q = optStr(d.quality, `${p}.quality`, 60);
        if (c !== undefined) r.color = c;
        if (q !== undefined) r.quality = q;
        return r;
      });
      put(out, 'centerLabel', optStr(o.centerLabel, 'centerLabel', 40));
      return out as unknown as ChartSpec;
    }
    case 'multiples': {
      const o = dict(input, 'spec', [...BASE, 'panelType', 'labels', 'xLabel', 'panels', 'columns', 'sharedY', 'yMin', 'yMax']);
      const out = base(o);
      out.type = 'multiples';
      const pt = oneOf(o.panelType, 'panelType', ['line', 'area', 'bar'] as const);
      if (pt === undefined) fail('panelType', 'is required');
      out.panelType = pt;
      const ls = labels(o.labels, 'labels');
      out.labels = ls;
      put(out, 'xLabel', optStr(o.xLabel, 'xLabel', 60));
      const cols = optNum(o.columns, 'columns', 1, 12);
      if (cols !== undefined && !Number.isInteger(cols)) fail('columns', 'must be an integer');
      put(out, 'columns', cols);
      put(out, 'sharedY', optBool(o.sharedY, 'sharedY'));
      put(out, 'yMin', optNum(o.yMin, 'yMin', -1e15, 1e15));
      put(out, 'yMax', optNum(o.yMax, 'yMax', -1e15, 1e15));
      const ps = o.panels;
      if (!Array.isArray(ps) || ps.length === 0) fail('panels', 'must be a non-empty array');
      if (ps.length > 48) fail('panels', 'must have at most 48 entries');
      const seen = new Set<string>();
      out.panels = ps.map((p, i): Panel => {
        const path = `panels[${i}]`;
        const d = dict(p, path, ['id', 'title', 'subtitle', 'quality', 'series']);
        const id = str(d.id, `${path}.id`, 64);
        if (seen.has(id)) fail(`${path}.id`, 'duplicate id');
        seen.add(id);
        const r: Panel = { id, title: str(d.title, `${path}.title`, 80), series: seriesList(d.series, `${path}.series`, ls.length, false) };
        const st = optStr(d.subtitle, `${path}.subtitle`, 80);
        const q = optStr(d.quality, `${path}.quality`, 60);
        if (st !== undefined) r.subtitle = st;
        if (q !== undefined) r.quality = q;
        return r;
      });
      return out as unknown as ChartSpec;
    }
    default:
      return fail('type', 'must be one of line, area, bar, sparkline, donut, multiples');
  }
}
