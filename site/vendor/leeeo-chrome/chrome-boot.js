// @leeeo/chrome pre-paint theme. Load as a classic <script src> in <head>, after the theme-color meta and
// before the stylesheets, so the stored theme applies before the first paint without an inline script.
// Options come from <html data-leeeo-theme-key="..." data-leeeo-theme-legacy="old-key ...">;
// <meta name="theme-color" data-light="#..." data-dark="#..."> is updated when both colours are given.
(() => {
  const root = document.documentElement;
  const key = root.dataset.leeeoThemeKey || 'leeeo-theme';
  const legacy = (root.dataset.leeeoThemeLegacy || '').split(' ').filter(Boolean);
  let choice = 'system';
  try {
    let saved = localStorage.getItem(key);
    for (let i = 0; saved === null && i < legacy.length; i += 1) saved = localStorage.getItem(legacy[i]);
    if (saved === 'light' || saved === 'dark') choice = saved;
  } catch { /* Storage can be disabled; the module still applies the theme for this visit. */ }
  const dark = choice === 'dark' || (choice === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  root.dataset.theme = dark ? 'dark' : 'light';
  const meta = document.querySelector('meta[name="theme-color"][data-light][data-dark]');
  if (meta) meta.content = dark ? meta.dataset.dark : meta.dataset.light;
})();
