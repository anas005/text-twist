/**
 * Visual effects helpers: CSS animation toggles and theme-aware confetti.
 * Requires jQuery (loaded before this file).
 */
/* eslint-env browser */
/* eslint-env jquery */
window.FX = {
  animate($el, cls) {
    $el.addClass(cls).one('animationend', function onEnd() {
      $(this).removeClass(cls);
    });
  },

  /**
   * Confetti burst using the active theme's palette.
   */
  confettiBurst(x, y, count) {
    const style = getComputedStyle(document.documentElement);
    const colors = ['--primary', '--success', '--accent', '--danger', '--bonus']
      .map((v) => style.getPropertyValue(v).trim())
      .filter(Boolean);
    for (let i = 0; i < count; i += 1) {
      const piece = document.createElement('div');
      piece.className = 'confetti-piece';
      const size = 6 + Math.random() * 8;
      piece.style.width = `${size}px`;
      piece.style.height = `${size * (Math.random() > 0.5 ? 1 : 0.5)}px`;
      piece.style.left = `${x}px`;
      piece.style.top = `${y}px`;
      piece.style.background = colors[Math.floor(Math.random() * colors.length)];
      piece.style.setProperty('--dx', `${(Math.random() - 0.5) * 320}px`);
      piece.style.setProperty('--dy', `${-80 - Math.random() * 240}px`);
      piece.style.setProperty('--rot', `${(Math.random() - 0.5) * 720}deg`);
      document.body.appendChild(piece);
      setTimeout(piece.remove.bind(piece), 1300);
    }
  },

  celebrateBoard() {
    const offset = $('#wordArea').offset();
    const x = offset
      ? offset.left + ($('#wordArea').width() / 2)
      : window.innerWidth / 2;
    const y = offset ? offset.top + 60 : window.innerHeight / 3;
    window.FX.confettiBurst(x, y, 36);
    setTimeout(() => window.FX.confettiBurst(
      window.innerWidth / 2,
      window.innerHeight / 2,
      24,
    ), 220);
  },
};
