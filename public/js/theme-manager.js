/**
 * Applies themes defined in js/themes/ (pure data).
 * The game code never references concrete colors — switching a
 * theme is pure CSS variable substitution on :root.
 */
/* eslint-env browser */
window.ThemeManager = {
  current: null,

  init() {
    if (!window.TextTwistThemes) return;
    this.apply(
      window.localStorage.getItem('tt-theme')
        || Object.keys(window.TextTwistThemes)[0],
    );
  },

  apply(id) {
    const theme = window.TextTwistThemes && window.TextTwistThemes[id];
    if (!theme) return;
    this.current = id;
    window.localStorage.setItem('tt-theme', id);
    Object.keys(theme.vars).forEach((prop) => {
      document.documentElement.style.setProperty(prop, theme.vars[prop]);
    });
    // Expose the active theme for theme-specific structural CSS
    document.body.classList.remove(
      ...Array.from(document.body.classList).filter((c) => c.startsWith('theme-')),
    );
    document.body.classList.add(`theme-${id}`);
  },

  cycle() {
    const ids = Object.keys(window.TextTwistThemes);
    const next = ids[(ids.indexOf(this.current) + 1) % ids.length];
    this.apply(next);
    return window.TextTwistThemes[next].label;
  },
};
