/* PWA update manager: auto-check + "update available" toast.
 *
 * Flow:
 *  - sw.js installs the new worker but waits (no skipWaiting on install).
 *  - when the new worker reaches "installed" while an old one still
 *    controls the page, we show #updateBar with an Update button.
 *  - Update posts SKIP_WAITING, then controllerchange reloads once.
 *  - re-checks run on load, on return to foreground, and on reconnect;
 *    the ⋮ menu also offers a manual "Check for updates" entry.
 */
/* eslint-env browser */
window.PWAUpdate = (function PWAUpdate() {
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

  // True while a new worker is downloaded (installing) or parked (waiting).
  function pending() {
    return !!(
      waitingWorker
      || (registration && (registration.waiting || registration.installing))
    );
  }

  function showTransient(text) {
    const bar = ensureBar();
    const label = document.getElementById('updateBarText');
    const updateBtn = document.getElementById('updateBarBtn');
    label.textContent = text;
    if (updateBtn) updateBtn.hidden = true;
    bar.hidden = false;
    setTimeout(() => {
      bar.hidden = true;
      label.textContent = 'New version available';
      if (updateBtn) updateBtn.hidden = false;
    }, 2500);
  }

  // Manual "Check for updates": surfaces the update bar when a new
  // version is found, otherwise flashes a transient status instead.
  function checkManual() {
    if (!registration) {
      showTransient('Updates unavailable');
      return Promise.resolve(false);
    }
    if (navigator.onLine === false) {
      showTransient('No connection');
      return Promise.resolve(false);
    }
    if (pending()) {
      showBar();
      return Promise.resolve(true);
    }
    return check().then(() => {
      // Give updatefound/statechange a beat to report a fresh worker;
      // the bar appears on its own once it reaches "installed".
      setTimeout(() => {
        if (!pending()) showTransient('Up to date');
      }, 1500);
      return pending();
    });
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
        })
        .catch(() => {});
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') check();
    });
    window.addEventListener('online', check);
  }

  return { init, check, checkManual, pending, applyUpdate };
}());
