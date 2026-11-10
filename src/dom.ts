import { renderChart } from './render.ts';

export interface Mounted {
  update(spec: unknown): void;
  destroy(): void;
}

/**
 * Render `spec` into `el` at the element's width and re-render when the width changes.
 * Browser only; use renderChart() for Node / build-time output.
 */
export function mountChart(el: HTMLElement, spec: unknown): Mounted {
  let current = spec;
  let lastWidth = -1;
  let frame = 0;
  const draw = (): void => {
    const w = Math.round(el.clientWidth);
    if (w < 80 && lastWidth !== -1) return;
    lastWidth = w;
    el.innerHTML = renderChart(current, w >= 80 ? { width: w } : {});
  };
  draw();
  const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => { if (Math.round(el.clientWidth) !== lastWidth) draw(); });
  });
  ro?.observe(el);
  return {
    update(next) { current = next; lastWidth = -1; draw(); },
    destroy() { ro?.disconnect(); cancelAnimationFrame(frame); el.innerHTML = ''; },
  };
}
