import type { Unit, Value } from './types.ts';

export const esc = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

/** Round to 2 decimals for compact, deterministic SVG numbers. */
export const n2 = (x: number): string => String(Math.round(x * 100) / 100);

export const clamp = (x: number, lo: number, hi: number): number => Math.min(Math.max(x, lo), hi < lo ? lo : hi);

/** Conservative text width estimate (CJK = 1em) so Korean labels are never clipped. */
export function tw(s: string, size: number): number {
  let w = 0;
  for (const ch of s) {
    const c = ch.codePointAt(0) ?? 0;
    if ((c >= 0x1100 && c <= 0x11ff) || (c >= 0x2e80 && c <= 0xd7ff) || (c >= 0xf900 && c <= 0xfaff) || (c >= 0xff00 && c <= 0xffef)) w += 1.02;
    else if ("il.,:;'|! ".includes(ch)) w += 0.34;
    else if (/[0-9]/.test(ch)) w += 0.6;
    else if (/[A-Z%MW@]/.test(ch)) w += 0.72;
    else w += 0.58;
  }
  return w * size;
}

export function truncate(s: string, max: number, size: number): string {
  if (tw(s, size) <= max) return s;
  let out = '';
  for (const ch of s) {
    if (tw(out + ch + '…', size) > max) break;
    out += ch;
  }
  return out + '…';
}

export function group(v: number, decimals: number): string {
  const [i = '0', d] = Math.abs(v).toFixed(decimals).split('.');
  const g = i.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const body = d ? `${g}.${d}` : g;
  return v < 0 && Number(Math.abs(v).toFixed(decimals)) !== 0 ? `-${body}` : body;
}

function decimalsOf(v: number): number {
  const s = String(Math.abs(v));
  if (s.includes('e')) return 2;
  const p = s.split('.')[1];
  return p ? Math.min(2, p.length) : 0;
}

export function inferDecimals(all: Value[]): number {
  let d = 0;
  for (const v of all) if (v !== null) d = Math.max(d, decimalsOf(v));
  return d;
}

export type Fmt = (v: number) => string;

export function makeFmt(unit: Unit | undefined, all: Value[]): Fmt {
  const dec = unit?.decimals ?? inferDecimals(all);
  const pre = unit?.prefix ?? '';
  const suf = unit?.suffix ?? '';
  return (v) => `${pre}${group(v, dec)}${suf}`;
}

export interface Ticks { ticks: number[]; min: number; max: number }

function niceNum(range: number, round: boolean): number {
  const exp = Math.floor(Math.log10(range));
  const f = range / 10 ** exp;
  const nf = round ? (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) : f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return nf * 10 ** exp;
}

export function niceTicks(minIn: number, maxIn: number, count = 5): Ticks {
  let min = minIn;
  let max = maxIn;
  if (min === max) {
    if (min === 0) max = 1;
    else { const pad = Math.abs(min) * 0.1; min -= pad; max += pad; }
  }
  const step = niceNum(niceNum(max - min, false) / (count - 1), true);
  const lo = Math.floor(min / step + 1e-9) * step;
  const hi = Math.ceil(max / step - 1e-9) * step;
  const dec = Math.max(0, -Math.floor(Math.log10(step)) + 1);
  const ticks: number[] = [];
  for (let t = lo; t <= hi + step / 2; t += step) ticks.push(Number(t.toFixed(dec)));
  return { ticks, min: ticks[0] ?? lo, max: ticks[ticks.length - 1] ?? hi };
}

/** FNV-1a hash -> short base36 id, deterministic across Node and browsers. */
export function hash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}
