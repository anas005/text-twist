/* PWA update manager: auto-check + "update available" toast.
 *
 * Flow:
 *  - sw.js installs the new worker but waits (no skipWaiting on install).
 *  - when the new worker reaches "installed" while an old one still
 *    controls the page, we show #updateBar with an Update button.
 *  - Update posts SKIP_WAITING, then controllerchange reloads once.
 *  - re-checks run on load, on return to foreground, on reconnect,
 *    and hourly while open.
 */
/* eslint-env browser */
window.PWAUpdate = (function PWAUpdate() {
  const CHECK_INTERVAL_MS = 60 * 60 * 1000;
  let registration = null;
  let waitingWorker = null;
  let reloaded = false;

  function ensureBar() {
    let bar = document.getElementById('updateBar');
    if (bar) return bar;
    bar = document.createElement('div');
    bar.id = 'updateBar';
    bar.hidden = true;
    const label = document.createElement('span');
    label.id = 'updateBarText';
    label.textContent = 'New version available';
    const updateBtn = document.createElement('button');
    updateBtn.id = 'updateBarBtn';
    updateBtn.type = 'button';
    updateBtn.textContent = 'Update';
    const laterBtn = document.createElement('button');
    laterBtn.id = 'updateBarLater';
    laterBtn.type = 'button';
    laterBtn.textContent = 'Later';
    laterBtn.setAttribute('aria-label', 'Dismiss update');
    bar.appendChild(label);
    bar.appendChild(updateBtn);
    bar.appendChild(laterBtn);
    document.body.appendChild(bar);
    updateBtn.addEventListener('click', applyUpdate);
    laterBtn.addEventListener('click', () => {
      bar.hidden = true;
    });
    return bar;
  }

  function showBar() {
    ensureBar().hidden = false;
  }

  function trackWorker(worker) {
    if (!worker) return;
    worker.addEventListener('statechange', () => {
      // A fresh install (no controller yet) is not an "update".
      if (worker.state === 'installed' && navigator.serviceWorker.controller) {
        waitingWorker = worker;
        showBar();
      }
    });
  }

  function applyUpdate() {
    const bar = document.getElementById('updateBar');
    const btn = document.getElementById('updateBarBtn');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Updating…';
    }
    if (waitingWorker) {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    } else if (registration && registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    } else {
      window.location.reload();
    }
    if (bar) bar.hidden = false;
  }

  function check() {
    if (!registration || !registration.update) return Promise.resolve(false);
    return registration.update().catch(() => false);
  }

  function init() {
    if (!('serviceWorker' in navigator)) return;
    ensureBar();
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    });
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('sw.js')
        .then((reg) => {
          registration = reg;
          if (reg.waiting && navigator.serviceWorker.controller) {
            waitingWorker = reg.waiting;
            showBar();
          }
          if (reg.installing) trackWorker(reg.installing);
          reg.addEventListener('updatefound', () => {
            trackWorker(reg.installing);
          });
          check();
          setInterval(check, CHECK_INTERVAL_MS);
        })
        .catch(() => {});
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') check();
    });
    window.addEventListener('online', check);
  }

  return { init, check, applyUpdate };
}());
