// Apply the stored theme before the first paint without an inline script.
// Pre-paint only: src/chrome.js owns the select, OS changes and storage sync after load.
(() => {
  let preference = 'system';
  try {
    const stored = localStorage.getItem('leeeo-theme');
    if (stored === 'light' || stored === 'dark') preference = stored;
  } catch { /* Storage can be disabled; the current session still works. */ }
  const dark = preference === 'dark' || (preference === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]').content = dark ? '#1c211b' : '#f7f7f2';
})();
