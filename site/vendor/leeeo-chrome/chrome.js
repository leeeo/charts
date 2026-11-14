// @leeeo/chrome: shared header, footer and theme switch for leeeo web apps.
// Self-host this module, chrome.css and chrome-boot.js. No network requests, no inline handlers, no dependencies.
export const VERSION = '0.1.0';
export const THEME_KEY = 'leeeo-theme';
export const THEME_CHOICES = ['system', 'light', 'dark'];

export function resolveTheme(choice, dark) {
  return choice === 'light' || choice === 'dark' ? choice : dark ? 'dark' : 'light';
}

function defaultThemeColor(root) {
  return root?.ownerDocument?.querySelector?.('meta[name="theme-color"][data-light][data-dark]') ?? null;
}

export function createChromeTheme({
  root = globalThis.document?.documentElement,
  media = globalThis.matchMedia?.('(prefers-color-scheme: dark)'),
  storage,
  events = globalThis.window,
  storageKey = THEME_KEY,
  legacyKeys = [],
  fallback = 'system',
  themeColor = defaultThemeColor(root),
} = {}) {
  if (!root) throw new TypeError('createChromeTheme needs a root element');
  if (!THEME_CHOICES.includes(fallback)) throw new RangeError(`Unknown fallback theme: ${fallback}`);
  if (storage === undefined) {
    try { storage = globalThis.localStorage; } catch { storage = null; }
  }
  const listeners = new Set();
  let choice = fallback;
  try {
    const saved = storage?.getItem(storageKey);
    if (THEME_CHOICES.includes(saved)) choice = saved;
    else if (saved === null || saved === undefined) {
      // Migrate only an explicitly listed legacy theme key, never game/user data.
      for (const key of legacyKeys) {
        const old = storage.getItem(key);
        if (THEME_CHOICES.includes(old)) {
          choice = old;
          storage.setItem(storageKey, old);
          break;
        }
      }
    }
  } catch { /* The in-memory choice remains available. */ }
  const current = () => resolveTheme(choice, Boolean(media?.matches));
  function apply() {
    const theme = current();
    root.dataset.theme = theme;
    if (themeColor) themeColor.content = theme === 'dark' ? themeColor.dataset.dark : themeColor.dataset.light;
    for (const listener of listeners) listener(choice, theme);
  }
  function onStorage(event) {
    if (event.storageArea && event.storageArea !== storage) return;
    if (event.key !== storageKey && event.key !== null) return;
    choice = THEME_CHOICES.includes(event.newValue) ? event.newValue : fallback;
    apply();
  }
  media?.addEventListener?.('change', apply);
  events?.addEventListener?.('storage', onStorage);
  apply();
  return {
    get choice() { return choice; },
    get theme() { return current(); },
    get storageKey() { return storageKey; },
    set(next) {
      if (!THEME_CHOICES.includes(next)) throw new RangeError(`Unknown theme choice: ${next}`);
      choice = next;
      try { storage?.setItem(storageKey, choice); } catch { /* Keep this visit's choice. */ }
      apply();
    },
    toggle() {
      this.set(current() === 'dark' ? 'light' : 'dark');
    },
    subscribe(listener) {
      listeners.add(listener);
      listener(choice, current());
      return () => listeners.delete(listener);
    },
    destroy() {
      media?.removeEventListener?.('change', apply);
      events?.removeEventListener?.('storage', onStorage);
      listeners.clear();
    },
  };
}

export function bindChromeHeader(header, {
  root = globalThis.document?.documentElement,
  events = globalThis.window,
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

// `header: true` keeps the v1.1 behaviour of also making the enclosing [data-leeeo-header] sticky.
export function bindChromeTheme(theme, select, { header = true } = {}) {
  const change = () => theme.set(select.value);
  const unsubscribe = theme.subscribe(choice => { select.value = choice; });
  select.addEventListener('change', change);
  select.disabled = false;
  const sticky = header ? select.closest?.('[data-leeeo-header]') : null;
  const unstick = sticky ? bindChromeHeader(sticky) : null;
  return () => { select.removeEventListener('change', change); unsubscribe(); unstick?.(); };
}

export const TOGGLE_LABELS = Object.freeze({ toDark: '다크 모드로 전환', toLight: '라이트 모드로 전환' });

export function bindThemeToggle(theme, button, {
  labels = TOGGLE_LABELS,
  render = (node, dark) => { node.textContent = dark ? '☀' : '☾'; },
} = {}) {
  const click = () => theme.toggle();
  const unsubscribe = theme.subscribe((choice, active) => {
    const dark = active === 'dark';
    button.setAttribute('aria-pressed', String(dark));
    button.setAttribute('aria-label', dark ? labels.toLight : labels.toDark);
    if (render) render(button, dark);
  });
  button.addEventListener('click', click);
  button.disabled = false;
  return () => { button.removeEventListener('click', click); unsubscribe(); };
}

// ---- Configuration -------------------------------------------------------------------------

export const DEFAULT_CONFIG = Object.freeze({
  appName: '',
  homeHref: './',
  homeLabel: '',
  icon: '',
  headerClass: '',
  menuLabel: '서비스 안내',
  menu: [],
  theme: {
    control: 'select',
    id: 'leeeo-theme-select',
    storageKey: THEME_KEY,
    legacyKeys: [],
    label: '테마',
    choices: { system: '시스템', light: '밝게', dark: '어둡게' },
    toggleLabels: { ...TOGGLE_LABELS },
  },
  footer: {
    className: '',
    label: '운영 정보',
    copyright: '© leeeo',
    hubHref: 'https://leeeo.app/',
    hubLabel: 'leeeo의 다른 앱',
    privacyHref: 'https://leeeo.app/privacy/',
    privacyLabel: '개인정보처리방침',
    contactEmail: 'hello@leeeo.app',
    contactLabel: '',
    feedbackLabel: '의견 보내기',
    links: [],
  },
  features: { sticky: true, menu: true, theme: true, hubLink: true, privacy: true, contact: true, feedback: false },
  slots: { headerEnd: '', footerEnd: '' },
});

const isPlain = value => value !== null && typeof value === 'object' && !Array.isArray(value);

function merge(base, override, path) {
  const out = {};
  for (const [key, value] of Object.entries(base)) out[key] = isPlain(value) ? merge(value, {}, `${path}${key}.`) : value;
  for (const [key, value] of Object.entries(override ?? {})) {
    if (value === undefined) continue;
    if (!(key in base)) throw new TypeError(`Unknown @leeeo/chrome option: ${path}${key}`);
    if (isPlain(base[key]) && !isPlain(value)) throw new TypeError(`@leeeo/chrome option ${path}${key} must be an object`);
    out[key] = isPlain(base[key]) && isPlain(value) ? merge(base[key], value, `${path}${key}.`) : value;
  }
  return out;
}

function deepFreeze(value) {
  if (value && typeof value === 'object') {
    for (const inner of Object.values(value)) deepFreeze(inner);
    Object.freeze(value);
  }
  return value;
}

export function resolveChromeConfig(overrides = {}) {
  const config = merge(DEFAULT_CONFIG, overrides, '');
  if (typeof config.appName !== 'string' || !config.appName.trim()) throw new TypeError('appName is required');
  if (!['select', 'toggle'].includes(config.theme.control)) throw new RangeError(`Unknown theme control: ${config.theme.control}`);
  for (const [name, list] of [['menu', config.menu], ['footer.links', config.footer.links]]) {
    if (!Array.isArray(list) || list.some(item => !item?.href || !item?.label)) {
      throw new TypeError(`${name} must be a list of { href, label }`);
    }
  }
  config.homeLabel ||= `${config.appName} 홈`;
  config.footer.contactLabel ||= `문의 ${config.footer.contactEmail}`;
  return deepFreeze(config);
}

// ---- Rendering (pure strings: usable at build time in Node and at run time in the browser) ---

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ESCAPES[c]);
const classes = (...names) => names.filter(Boolean).join(' ');
const link = ({ href, label, current }) =>
  `<a href="${escapeHtml(href)}"${current ? ' aria-current="page"' : ''}>${escapeHtml(label)}</a>`;

function renderIcon(icon) {
  if (!icon) return '';
  // A string is trusted markup from the app's own config (an inline SVG); objects render an image.
  if (typeof icon === 'string') return icon;
  return `<img src="${escapeHtml(icon.src)}" alt="${escapeHtml(icon.alt ?? '')}" width="32" height="32">`;
}

function renderThemeControl({ theme }) {
  if (theme.control === 'toggle') {
    return `<button class="leeeo-theme-toggle" id="${escapeHtml(theme.id)}" type="button" data-leeeo-theme-toggle`
      + ` aria-pressed="false" aria-label="${escapeHtml(theme.toggleLabels.toDark)}" disabled>☾</button>`;
  }
  const options = THEME_CHOICES.map(value => `<option value="${value}">${escapeHtml(theme.choices[value])}</option>`).join('');
  return `<label class="leeeo-theme"><span class="leeeo-theme-label">${escapeHtml(theme.label)}</span>`
    + `<select id="${escapeHtml(theme.id)}" data-leeeo-theme disabled>${options}</select></label>`;
}

export function renderHeader(options, { indent = '' } = {}) {
  const config = Object.isFrozen(options) ? options : resolveChromeConfig(options);
  const { features } = config;
  const inner = [
    `<a class="leeeo-app-brand" href="${escapeHtml(config.homeHref)}" aria-label="${escapeHtml(config.homeLabel)}">`
      + `${renderIcon(config.icon)}<span>${escapeHtml(config.appName)}</span></a>`,
    features.menu && config.menu.length
      ? `<nav aria-label="${escapeHtml(config.menuLabel)}">${config.menu.map(link).join('')}</nav>` : '',
    config.slots.headerEnd,
    features.theme ? renderThemeControl(config) : '',
  ].filter(Boolean);
  const open = `<header class="${classes(config.headerClass, 'leeeo-chrome leeeo-header')}"${features.sticky ? ' data-leeeo-header' : ''}>`;
  return [open, ...inner.map(line => `  ${line}`), '</header>'].map(line => indent + line).join('\n');
}

export function renderFooter(options, { indent = '' } = {}) {
  const config = Object.isFrozen(options) ? options : resolveChromeConfig(options);
  const { footer, features } = config;
  const items = [
    link({ href: footer.hubHref, label: footer.copyright }),
    features.hubLink ? link({ href: footer.hubHref, label: footer.hubLabel }) : '',
    features.privacy ? link({ href: footer.privacyHref, label: footer.privacyLabel }) : '',
    features.contact ? link({ href: `mailto:${footer.contactEmail}`, label: footer.contactLabel }) : '',
    ...footer.links.map(link),
    features.feedback
      ? `<button class="leeeo-feedback-trigger" data-feedback-trigger type="button" aria-haspopup="dialog" hidden>${escapeHtml(footer.feedbackLabel)}</button>`
      : '',
    config.slots.footerEnd,
  ].join('');
  return `${indent}<nav class="${classes(footer.className, 'leeeo-chrome leeeo-footer')}" aria-label="${escapeHtml(footer.label)}">${items}</nav>`;
}

// Replace the content between <!-- leeeo-chrome:header --> ... <!-- /leeeo-chrome:header --> (and footer) markers.
const MARKER = /^([ \t]*)<!-- leeeo-chrome:(header|footer) -->[^\n]*\n[\s\S]*?^[ \t]*<!-- \/leeeo-chrome:\2 -->/gm;

export function injectChrome(html, options) {
  const config = resolveChromeConfig(options);
  let found = 0;
  const out = html.replace(MARKER, (match, indent, part) => {
    found += 1;
    const body = part === 'header' ? renderHeader(config, { indent }) : renderFooter(config, { indent });
    return `${indent}<!-- leeeo-chrome:${part} -->\n${body}\n${indent}<!-- /leeeo-chrome:${part} -->`;
  });
  if (!found) throw new Error('No <!-- leeeo-chrome:header|footer --> markers found');
  return out;
}

// ---- Browser start-up ---------------------------------------------------------------------

let started = null;

// Idempotent: one theme controller per page; binds every unbound control and sticky header.
// storage/media/events/createObserver are injectable for embedding and tests; browsers use the globals.
export function startChrome({
  storageKey, legacyKeys, labels, render, storage, media, events = globalThis.window, createObserver,
} = {}, doc = globalThis.document) {
  if (!doc) throw new TypeError('startChrome needs a document');
  const html = doc.documentElement;
  if (!started) {
    started = {
      theme: createChromeTheme({
        root: html,
        storage,
        events,
        ...(media === undefined ? {} : { media }),
        storageKey: storageKey ?? html.dataset.leeeoThemeKey ?? THEME_KEY,
        legacyKeys: legacyKeys ?? (html.dataset.leeeoThemeLegacy || '').split(' ').filter(Boolean),
      }),
      bound: new WeakSet(),
      releases: [],
    };
  }
  const { theme, bound, releases } = started;
  const once = (node, bind) => { if (!bound.has(node)) { bound.add(node); releases.push(bind(node)); } };
  for (const node of doc.querySelectorAll('[data-leeeo-theme]')) once(node, n => bindChromeTheme(theme, n, { header: false }));
  for (const node of doc.querySelectorAll('[data-leeeo-theme-toggle]')) once(node, n => bindThemeToggle(theme, n, { labels, render }));
  for (const node of doc.querySelectorAll('header[data-leeeo-header]')) once(node, n => bindChromeHeader(n, { root: html, events, ...(createObserver ? { createObserver } : {}) }));
  return theme;
}

export function stopChrome() {
  if (!started) return;
  for (const release of started.releases) release();
  started.theme.destroy();
  started = null;
}

// For apps without a build step: replace [data-leeeo-chrome-slot="header|footer"] placeholders, then start.
export function mountChrome(options, doc = globalThis.document, env = {}) {
  const config = resolveChromeConfig(options);
  doc.querySelector('[data-leeeo-chrome-slot="header"]')?.replaceWith(fragment(doc, renderHeader(config)));
  doc.querySelector('[data-leeeo-chrome-slot="footer"]')?.replaceWith(fragment(doc, renderFooter(config)));
  return startChrome({ ...env, storageKey: config.theme.storageKey, legacyKeys: config.theme.legacyKeys, labels: config.theme.toggleLabels }, doc);
}

function fragment(doc, markup) {
  const template = doc.createElement('template');
  template.innerHTML = markup;
  return template.content;
}

if (typeof document !== 'undefined' && document.documentElement.dataset.leeeoChrome !== 'manual'
    && document.querySelector('[data-leeeo-theme], [data-leeeo-theme-toggle]')) {
  startChrome();
}
