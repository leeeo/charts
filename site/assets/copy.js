// Copy buttons for the code shown on the page: every gallery card's spec JSON and the start section's usage snippets.
// The button copies exactly the text of the <pre> it sits above. No inline handlers (CSP script-src 'self').

/** Pretty JSON with arrays of primitives kept on one line, so specs stay readable. Used by the build and the page. */
export const specJson = (spec) => JSON.stringify(spec, null, 2)
  .replace(/\[\s+([^[\]{}]*?)\s+\]/g, (_, inner) => '[' + inner.split(/,\s+/).join(', ') + ']');

export const COPIED = '복사했어요';
export const COPY_FAILED = '복사하지 못했어요. 코드를 직접 선택해 복사해 주세요.';
export const STATUS_MS = 1500;

/**
 * Puts text on the clipboard: the async Clipboard API first, then a hidden textarea + execCommand('copy') for
 * browsers without it or when it is refused. Focus returns to where it was. Resolves true when either worked.
 */
export async function copyText(text, env = globalThis) {
  const clipboard = env.navigator?.clipboard;
  if (clipboard?.writeText) {
    try { await clipboard.writeText(text); return true; } catch { /* refused or unavailable: use the textarea */ }
  }
  const doc = env.document;
  if (!doc?.execCommand) return false;
  const before = doc.activeElement;
  const area = doc.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.setAttribute('aria-hidden', 'true');
  area.tabIndex = -1;
  area.className = 'copy-buffer';
  doc.body.append(area);
  area.select();
  try { return doc.execCommand('copy') === true; } catch { return false; } finally {
    area.remove();
    before?.focus?.();
  }
}

/** Adds a bar with a 복사 button and a polite live status right above `pre`. `label` names what is copied. */
export function addCopyButton(pre, label, env = globalThis) {
  const doc = env.document;
  const bar = doc.createElement('div');
  bar.className = 'code-bar';
  const status = doc.createElement('span');
  status.className = 'copy-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  const button = doc.createElement('button');
  button.type = 'button';
  button.className = 'button copy';
  button.textContent = '복사';
  button.setAttribute('aria-label', `${label} 복사`);
  let timer = 0;
  button.addEventListener('click', async () => {
    const ok = await copyText(pre.textContent ?? '', env);
    status.textContent = ok ? COPIED : COPY_FAILED;
    status.classList.toggle('is-error', !ok);
    clearTimeout(timer);
    // a failure stays a little longer: it asks the reader to do something
    timer = setTimeout(() => { status.textContent = ''; status.classList.remove('is-error'); }, ok ? STATUS_MS : 4000);
  });
  bar.append(status, button);
  pre.before(bar);
  return button;
}
