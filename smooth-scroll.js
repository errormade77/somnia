import { initialScrollSettings } from './orb-config.js';

let preferences = { ...initialScrollSettings };
let activeController;
const settingsSubscribers = new Set();
export function configureScroll(settings) {
  preferences = { ...settings };
  activeController?.configure(preferences);
  for (const callback of settingsSubscribers) callback({ ...preferences });
}

export function subscribeScrollSettings(callback) {
  settingsSubscribers.add(callback);
  callback({ ...preferences });
  return () => settingsSubscribers.delete(callback);
}

export function wheelPixels(event, viewportHeight) {
  const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewportHeight : 1;
  return event.deltaY * unit;
}

// Time-based damping gives the same feel at 60 Hz and 120 Hz. Keep the native
// document scroll position, so sticky elements, focus and card geometry work normally.
export function createScrollMotion({ read, write, limit, requestFrame, cancelFrame, now, onInterrupt = () => {} }) {
  let options = { ...initialScrollSettings };
  let frame = 0;
  let current = read();
  let target = current;
  let written = current;
  let previousTime = now();
  const clamp = value => Math.max(0, Math.min(value, limit()));
  function stop() {
    cancelFrame(frame);
    frame = 0;
    current = target = written = read();
  }
  function tick(time) {
    frame = 0;
    if (Math.abs(read() - written) > 2) {
      stop();
      onInterrupt();
      return;
    }
    target = clamp(target);
    const elapsed = Math.max(0, time - previousTime);
    previousTime = time;
    current += (target - current) * (1 - Math.exp(-elapsed / (options.smoothness * 1000 / options.speed)));
    const done = Math.abs(target - current) < 0.5;
    if (done) current = target;
    write(current);
    written = read();
    if (!done) frame = requestFrame(tick);
  }
  function to(value, { instant = false } = {}) {
    if (instant || !options.enabled) {
      stop();
      write(clamp(value));
      current = target = written = read();
      return;
    }
    target = clamp(value);
    if (!frame) {
      current = written = read();
      previousTime = now();
      frame = requestFrame(tick);
    }
  }
  return {
    to, stop,
    by(delta) {
      // A change of direction responds immediately, without paying back old inertia.
      const origin = frame && Math.sign(target - current) === Math.sign(delta) ? target : read();
      to(origin + delta * options.speed);
    },
    configure(value) {
      options = { ...value };
      if (!options.enabled) { stop(); onInterrupt(); }
    },
  };
}

export function createSmoothScroll({ isActive, onInterrupt }) {
  const root = document.documentElement;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const canAnimate = () => preferences.enabled && !reducedMotion.matches && root.dataset.previewMotion !== 'off';
  const motion = createScrollMotion({
    read: () => window.scrollY,
    write: top => window.scrollTo({ top, behavior: 'instant' }),
    limit: () => Math.max(0, root.scrollHeight - innerHeight),
    requestFrame: requestAnimationFrame, cancelFrame: cancelAnimationFrame,
    now: () => performance.now(), onInterrupt,
  });
  motion.configure(preferences);
  activeController = motion;
  let localScrollCache = new WeakMap();
  const invalidateScrollOwners = () => { localScrollCache = new WeakMap(); };
  window.addEventListener('resize', invalidateScrollOwners);
  document.addEventListener('somnia:navigate', invalidateScrollOwners);
  function interrupt() { motion.stop(); onInterrupt(); }
  function localScroll(target) {
    if (!(target instanceof Element)) return false;
    if (target.closest('dialog, input, select, textarea, [contenteditable="true"]')) return true;
    if (localScrollCache.has(target)) return localScrollCache.get(target);
    for (let element = target; element && element !== document.body; element = element.parentElement) {
      const css = getComputedStyle(element);
      if (/(auto|scroll)/.test(css.overflowY) && element.scrollHeight > element.clientHeight) {
        localScrollCache.set(target, true);
        return true;
      }
    }
    localScrollCache.set(target, false);
    return false;
  }
  window.addEventListener('wheel', event => {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.shiftKey || !event.cancelable
      || !isActive() || !canAnimate() || !event.deltaY || Math.abs(event.deltaX) > Math.abs(event.deltaY)
      || localScroll(event.target)) return;
    event.preventDefault();
    // Clear the card destination without stopping accumulated wheel momentum.
    onInterrupt();
    motion.by(wheelPixels(event, innerHeight));
  }, { passive: false });
  window.addEventListener('touchstart', interrupt, { passive: true });
  window.addEventListener('pointerdown', interrupt, { passive: true });
  window.addEventListener('keydown', event => {
    if (event.defaultPrevented || event.target.closest('input, select, textarea, [contenteditable="true"]')) return;
    if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) interrupt();
  });
  document.addEventListener('somnia:navigate', interrupt);
  document.addEventListener('visibilitychange', () => { if (document.hidden) interrupt(); });
  const syncMotion = () => { if (!canAnimate()) interrupt(); };
  document.addEventListener('somnia:motion-change', syncMotion);
  reducedMotion.addEventListener('change', syncMotion);
  return {
    to(value, options = {}) { motion.to(value, { instant: options.instant || !canAnimate() }); },
    stop: interrupt,
  };
}
