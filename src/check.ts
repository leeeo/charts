import type { Series, Unit, Value } from './types.ts';

export class ChartSpecError extends Error {
  readonly path: string;
  constructor(path: string, message: string) {
    super(`${path}: ${message}`);
    this.name = 'ChartSpecError';
    this.path = path;
  }
}

// Shared validation helpers (also used by src/charts/*). Every message here has a Korean translation in site/assets/site.js.
export const SAFE_COLOR = /^(#[0-9a-fA-F]{3,8}|var\(--[A-Za-z0-9_-]+\)|[a-zA-Z]{3,20})$/;
export const SAFE_ID = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
export const MAX_SERIES = 12;
export const MAX_POINTS = 2000;

export type Dict = Record<string, unknown>;

export function fail(path: string, message: string): never {
  throw new ChartSpecError(path, message);
}

export function dict(v: unknown, path: string, allowed: readonly string[]): Dict {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) fail(path, 'must be an object');
  const o = v as Dict;
  for (const k of Object.keys(o)) if (!allowed.includes(k)) fail(`${path}.${k}`, 'unknown property');
  return o;
}

export function str(v: unknown, path: string, max = 200): string {
  if (typeof v !== 'string' || v.trim() === '') fail(path, 'must be a non-empty string');
  if (v.length > max) fail(path, `must be at most ${max} characters`);
  return v;
}

export function optStr(v: unknown, path: string, max = 200): string | undefined {
  return v === undefined ? undefined : str(v, path, max);
}

export function optNum(v: unknown, path: string, min: number, max: number): number | undefined {
  if (v === undefined) return undefined;
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) fail(path, `must be a finite number in [${min}, ${max}]`);
  return v;
}

export function optBool(v: unknown, path: string): boolean | undefined {
  if (v === undefined) return undefined;
  if (typeof v !== 'boolean') fail(path, 'must be a boolean');
  return v;
}

export function oneOf<T extends string>(v: unknown, path: string, options: readonly T[]): T | undefined {
  if (v === undefined) return undefined;
  if (typeof v !== 'string' || !options.includes(v as T)) fail(path, `must be one of ${options.join(', ')}`);
  return v as T;
}

export function color(v: unknown, path: string): string | undefined {
  if (v === undefined) return undefined;
  if (typeof v !== 'string' || !SAFE_COLOR.test(v)) fail(path, 'must be #hex, var(--token) or a colour keyword');
  return v;
}

export function unit(v: unknown, path: string): Unit | undefined {
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

export function labels(v: unknown, path: string): string[] {
  if (!Array.isArray(v) || v.length === 0) fail(path, 'must be a non-empty array of strings');
  if (v.length > MAX_POINTS) fail(path, `must have at most ${MAX_POINTS} entries`);
  return v.map((x, i) => str(x, `${path}[${i}]`, 60));
}

export function values(v: unknown, path: string, n: number, nonNegative: boolean): Value[] {
  if (!Array.isArray(v)) fail(path, 'must be an array');
  if (v.length !== n) fail(path, `must have ${n} entries (one per label), got ${v.length}`);
  return v.map((x, i) => {
    if (x === null) return null;
    if (typeof x !== 'number' || !Number.isFinite(x)) fail(`${path}[${i}]`, 'must be a finite number or null (missing)');
    if (nonNegative && x < 0) fail(`${path}[${i}]`, 'must not be negative for this chart');
    return x;
  });
}

export function seriesList(v: unknown, path: string, n: number, nonNegative: boolean): Series[] {
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

export const BASE = ['type', 'title', 'description', 'unit', 'width', 'height', 'legend', 'lang', 'table', 'id'] as const;

/** Required finite number (null not allowed). */
export function num(v: unknown, path: string, min = -1e15, max = 1e15): number {
  if (v === undefined) fail(path, 'is required');
  const n = optNum(v, path, min, max);
  return n as number;
}

/** Finite number or null (missing). `min` optional lower bound. */
export function value(v: unknown, path: string, min?: number): Value {
  if (v === null) return null;
  if (typeof v !== 'number' || !Number.isFinite(v)) fail(path, 'must be a finite number or null (missing)');
  if (min !== undefined && v < min) fail(path, min === 0 ? 'must be a finite number >= 0 or null (missing)' : `must be a finite number in [${min}, 1000000000000000]`);
  return v;
}

/**
 * Validate a non-empty array of objects that each carry a unique string `id`.
 * `each(o, path)` receives the item already checked by dict(item, path, keys) and returns the clean copy.
 */
export function idList<T>(v: unknown, path: string, keys: readonly string[], max: number, each: (o: Dict, path: string, id: string) => T): T[] {
  if (!Array.isArray(v) || v.length === 0) fail(path, 'must be a non-empty array');
  if (v.length > max) fail(path, `must have at most ${max} entries`);
  const seen = new Set<string>();
  return v.map((item, i) => {
    const p = `${path}[${i}]`;
    const o = dict(item, p, ['id', ...keys]);
    const id = str(o.id, `${p}.id`, 64);
    if (seen.has(id)) fail(`${p}.id`, 'duplicate id');
    seen.add(id);
    return each(o, p, id);
  });
}

/** Set `out[k] = v` only when v is defined (keeps validated copies free of undefined keys). */
export const put = (out: Record<string, unknown>, k: string, v: unknown): void => { if (v !== undefined) out[k] = v; };

export function base(o: Dict) {
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

