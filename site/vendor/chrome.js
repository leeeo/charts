// Self-host this module and chrome.css. No network requests or inline handlers.
export const THEME_KEY = 'leeeo-theme';
export const THEME_CHOICES = ['system', 'light', 'dark'];

export function resolveTheme(choice, dark) {
  return choice === 'light' || choice === 'dark' ? choice : dark ? 'dark' : 'light';
}

export function createChromeTheme({
  root = document.documentElement,
  media = matchMedia('(prefers-color-scheme: dark)'),
  storage,
  events = window,
  legacyKeys = [],
} = {}) {
  if (storage === undefined) {
    try { storage = globalThis.localStorage; } catch { storage = null; }
  }
  const listeners = new Set();
  let choice = 'system';
  try {
    const saved = storage?.getItem(THEME_KEY);
    if (THEME_CHOICES.includes(saved)) choice = saved;
    else if (saved === null) {
      // Migrate only an explicitly listed legacy theme key, never game/user data.
      for (const key of legacyKeys) {
        const old = storage.getItem(key);
        if (THEME_CHOICES.includes(old)) {
          choice = old;
          storage.setItem(THEME_KEY, old);
          break;
        }
      }
    }
  } catch { /* The in-memory choice remains available. */ }
  function apply() {
    root.dataset.theme = resolveTheme(choice, media.matches);
    for (const listener of listeners) listener(choice);
  }
  function onStorage(event) {
    if (event.storageArea && event.storageArea !== storage) return;
    if (event.key !== THEME_KEY && event.key !== null) return;
    choice = THEME_CHOICES.includes(event.newValue) ? event.newValue : 'system';
    apply();
  }
  media.addEventListener('change', apply);
  events.addEventListener('storage', onStorage);
  apply();
  return {
    get choice() { return choice; },
    set(next) {
      if (!THEME_CHOICES.includes(next)) throw new RangeError('Unknown theme choice');
      choice = next;
      try { storage?.setItem(THEME_KEY, choice); } catch { /* Keep this visit's choice. */ }
      apply();
    },
    subscribe(listener) {
      listeners.add(listener);
      listener(choice);
      return () => listeners.delete(listener);
    },
    destroy() {
      media.removeEventListener('change', apply);
      events.removeEventListener('storage', onStorage);
      listeners.clear();
    },
  };
}

export function bindChromeHeader(header, {
  root = document.documentElement,
  events = window,
  createObserver = callback => new ResizeObserver(callback),
} = {}) {
  function measure() {
    root.style.setProperty('--lc-header-height', `${Math.ceil(header.getBoundingClientRect().height)}px`);
  }
  const observer = createObserver(measure);
  const scroll = () => header.toggleAttribute('data-scrolled', events.scrollY > 0);
  observer.observe(header);
  events.addEventListener('scroll', scroll, { passive: true });
  measure();
  scroll();
  return () => {
    observer.disconnect();
    events.removeEventListener('scroll', scroll);
    root.style.removeProperty('--lc-header-height');
    header.removeAttribute('data-scrolled');
  };
}

export function bindChromeTheme(theme, select) {
  const change = () => theme.set(select.value);
  const unsubscribe = theme.subscribe(choice => { select.value = choice; });
  select.addEventListener('change', change);
  select.disabled = false;
  const header = select.closest?.('[data-leeeo-header]');
  const unstick = header ? bindChromeHeader(header) : null;
  return () => { select.removeEventListener('change', change); unsubscribe(); unstick?.(); };
}

if (typeof document !== 'undefined') {
  const controls = document.querySelectorAll('[data-leeeo-theme]');
  if (controls.length) {
    const legacyKeys = (document.documentElement.dataset.leeeoThemeLegacy || '').split(' ').filter(Boolean);
    const theme = createChromeTheme({ legacyKeys });
    for (const select of controls) bindChromeTheme(theme, select);
  }
}
