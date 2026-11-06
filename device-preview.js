import { arcPoints, nearestCardIndex } from './settings-geometry.js';
import { createGesturePreview } from './gesture-preview.js';
import { createOrbRefraction } from './orb-refraction.js';
import { createStorageSphere } from './dream-storage-sphere.js';
import { retentionTiming } from './dream-grid-layout.js';
import { createStylePreview } from './style-preview.js';
import { createHomePreview } from './home-preview.js';
import { createSavingPreview } from './saving-preview.js';
import { createSmoothScroll } from './smooth-scroll.js';

const root = document.documentElement;
const settings = document.querySelector('#settings-view');
const cards = [...settings.querySelectorAll(':scope > .card')];
const preview = document.querySelector('#device-preview');
const orbContent = document.querySelector('#device-orb');
const gesturePreview = createGesturePreview();
const archivePreview = createArchivePreview();
const stylePreview = createStylePreview();
const homePreview = createHomePreview();
const savingPreview = createSavingPreview();
// Controllers first retain their original media/graphic nodes; then separate
// them into one filtered media plane and a crisp overlay plane, without clones.
createOrbRefraction(preview);
const usedStorage = document.querySelector('.amount-used .amount-number').textContent;
const totalStorage = document.querySelector('.amount-total .amount-number').textContent;
const remainingStorage = Math.max(0, Number(totalStorage) - Number(usedStorage)).toFixed(1);
document.querySelector('#preview-storage-remaining').textContent = remainingStorage;
document.querySelector('#preview-storage-caption').textContent = 'осталось';
let active = null;
const orbit = document.querySelector('.settings-orbit');
const buttons = [...orbit.querySelectorAll('.orbit-button')];
const axisMarker = document.querySelector('.settings-axis');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let orbitAnimations = [];
let orbitNavigationId = 0;
let targetCard = null;
let frame = 0;
let scrolling = false;
let settleTimer;
const isSettings = () => root.dataset.page === 'settings' && !settings.hidden;
const axis = () => axisMarker.getBoundingClientRect().top;
const scrollController = createSmoothScroll({ isActive: isSettings, onInterrupt: cancelTarget });

function setActive(key) {
  if (key === active) return;
  active = key;
  // Keep the selected surface stable while the arc folds away on the home route.
  if (buttons.some(button => button.dataset.card === key)) {
    for (const button of buttons) {
      if (button.dataset.card === key) button.setAttribute('aria-current', 'true');
      else button.removeAttribute('aria-current');
    }
  }
  for (const card of cards) card.dataset.active = String(card.dataset.preview === key);
  preview.dataset.active = key || '';
  orbContent.setAttribute('aria-label', key === 'storage'
    ? `Хранилище: осталось ${remainingStorage} гигабайта из ${totalStorage}`
    : 'Прозрачный стеклянный шар Somnia');
  gesturePreview.setActive(key === 'gesture');
  archivePreview.setActive(key);
  stylePreview.setActive(key === 'style');
  homePreview.setActive(key === 'home');
  savingPreview.setActive(key === 'saving');
}

function createArchivePreview() {
  const grid = document.querySelector('.storage-dream-grid');
  const number = document.querySelector('#preview-retention-days');
  const caption = document.querySelector('.retention-preview-data .storage-preview-caption');
  const shadow = document.querySelector('.retention-preview-data .orb-graphic-shadow');
  const media = createStorageSphere(grid);
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  const digits = new Map();
  let mode = null;
  let days = '';
  let animations = [];
  let speed = Number(getComputedStyle(root).getPropertyValue('--preview-animation-speed')) || 1;
  const motionOff = () => preference.matches || root.dataset.previewMotion === 'off';
  let wasMotionOff = motionOff();
  function syncPlayback() {
    const playing = ['storage', 'retention'].includes(mode) && !root.dataset.deviceFlight && !document.hidden && !motionOff();
    media.setPlayback(playing, speed);
    for (const animation of animations) {
      if (playing && animation.playState === 'paused') animation.play();
      else if (!playing && animation.playState !== 'paused') animation.pause();
    }
  }
  function stop() {
    animations.forEach(animation => animation.cancel());
    animations = [];
  }
  function renderNumber() {
    const selected = document.querySelector('[data-choice="retention"] [aria-pressed="true"]').dataset.value;
    if (days !== selected || (digits.has(selected) && !number.querySelector('svg'))) {
      days = selected;
      if (digits.has(days)) number.replaceChildren(digits.get(days).cloneNode(true));
      else number.textContent = days;
      number.dataset.days = days;
    }
    if (mode === 'retention') orbContent.setAttribute('aria-label', `Срок хранения: ${days} дней. Сны постепенно исчезают`);
  }
  function start() {
    stop();
    media.setRetention(false);
    renderNumber();
    syncPlayback();
    if (mode !== 'retention' || document.hidden || motionOff() || !digits.has(days)) return;
    // One shared timeline: hold → staggered disappearance → empty → restore.
    // The grid is never rebuilt or reflowed when a dream disappears.
    const { duration, hold, disappearSpan, fade, restore, restoreDuration } = retentionTiming;
    const epoch = document.timeline.currentTime;
    media.setRetention(true, epoch);
    for (const items of [[...number.querySelectorAll('path')], [caption], [shadow]]) {
      items.forEach((item, index) => {
        // The caption and its white halo fade with the final dots, then return together.
        const progress = items.length === 1 ? 1 : index / (items.length - 1);
        const begin = hold + progress * (disappearSpan - fade);
        const animation = item.animate([
          { opacity: 1, offset: 0 },
          { opacity: 1, offset: begin / duration, easing: 'ease-in-out' },
          { opacity: 0, offset: (begin + fade) / duration },
          { opacity: 0, offset: restore / duration, easing: 'ease-in-out' },
          { opacity: 1, offset: (restore + restoreDuration) / duration },
          { opacity: 1, offset: 1 },
        ], { duration, iterations: Infinity });
        animation.playbackRate = speed;
        animation.startTime = epoch;
        animations.push(animation);
      });
    }
    syncPlayback();
  }
  function syncMotion() {
    speed = Number(getComputedStyle(root).getPropertyValue('--preview-animation-speed')) || 1;
    const reduced = motionOff();
    if (reduced !== wasMotionOff) {
      wasMotionOff = reduced;
      start();
    } else {
      animations.forEach(animation => animation.updatePlaybackRate(speed));
      syncPlayback();
    }
  }
  document.addEventListener('visibilitychange', start);
  document.addEventListener('somnia:settings-change', () => {
    const selected = document.querySelector('[data-choice="retention"] [aria-pressed="true"]').dataset.value;
    if (selected !== days) start();
  });
  document.addEventListener('somnia:motion-change', syncMotion);
  document.addEventListener('somnia:device-flight', syncPlayback);
  preference.addEventListener('change', syncMotion);
  Promise.all(['7', '14', '30'].map(async value => {
    const response = await fetch(`/assets/retention-${value}.svg`);
    if (!response.ok) throw new Error('Не удалось загрузить точки срока хранения');
    const svg = new DOMParser().parseFromString(await response.text(), 'image/svg+xml').documentElement;
    svg.setAttribute('aria-hidden', 'true');
    digits.set(value, svg);
  })).then(start).catch(error => console.warn(error.message));
  return { setActive(value) {
    mode = value;
    // Leaving a retention scene keeps its partially faded last frame during
    // the route crossfade; restarting it here would make deleted dreams flash.
    if (['storage', 'retention'].includes(mode)) start();
    else syncPlayback();
  } };
}

function layoutArc() {
  const first = getComputedStyle(buttons[0]);
  const last = getComputedStyle(buttons.at(-1));
  const points = arcPoints(parseFloat(first.left) - parseFloat(last.left), parseFloat(last.top) - parseFloat(first.top), buttons.length);
  buttons.forEach((button, index) => {
    button.style.setProperty('--arc-x', points[index].x);
    button.style.setProperty('--arc-y', points[index].y);
  });
}

function cancelOrbitMotion() {
  orbitAnimations.forEach(animation => animation.cancel());
  orbitAnimations = [];
  delete orbit.dataset.entering;
  delete orbit.dataset.exiting;
}

function settleOrbit(open = isSettings()) {
  cancelOrbitMotion();
  orbit.inert = !open;
  if (open) orbit.removeAttribute('aria-hidden');
  else orbit.setAttribute('aria-hidden', 'true');
}

function animateOrbit(entering) {
  const interrupted = orbitAnimations.length > 0;
  const anchors = buttons.map(button => {
    const style = getComputedStyle(button);
    return { x: parseFloat(style.left), y: parseFloat(style.top) };
  });
  const origin = { x: anchors[0].x, y: anchors.at(-1).y };
  const rx = origin.x - anchors.at(-1).x;
  const ry = origin.y - anchors[0].y;
  const bounds = orbit.getBoundingClientRect();
  // Sample before cancellation, so a quick return reverses the visible arc
  // instead of jumping to either endpoint. Selection scales an inner surface.
  const starts = buttons.map(button => {
    if (entering && !interrupted) return { angle: 0, scale: .28, opacity: 0 };
    const rect = button.getBoundingClientRect();
    const x = rect.left + rect.width / 2 - bounds.left;
    const y = rect.top + rect.height / 2 - bounds.top;
    return {
      angle: Math.atan2((origin.x - x) / rx, (origin.y - y) / ry),
      scale: rect.width / button.offsetWidth,
      opacity: Number(getComputedStyle(button).opacity),
    };
  });
  cancelOrbitMotion();
  orbit.inert = !entering;
  if (entering) orbit.removeAttribute('aria-hidden');
  else orbit.setAttribute('aria-hidden', 'true');
  const spring = (time, damping, frequency) => {
    const response = t => 1 - Math.exp(-damping * t) * (Math.cos(frequency * t) + damping / frequency * Math.sin(frequency * t));
    return response(time) / response(1);
  };
  orbit.dataset[entering ? 'entering' : 'exiting'] = 'true';
  // Entrance opens 1→5. Exit folds 5→1 back along the same mathematical arc.
  const animations = buttons.map((button, index) => {
    const anchor = anchors[index];
    const from = starts[index];
    const endAngle = entering ? Math.atan2((origin.x - anchor.x) / rx, (origin.y - anchor.y) / ry) : 0;
    const endScale = entering ? 1 : .18;
    const frames = Array.from({ length: 61 }, (_, frame) => {
      const time = frame / 60;
      const travel = spring(time, 7, 6);
      const angle = from.angle + (endAngle - from.angle) * travel;
      const scale = from.scale + (endScale - from.scale) * spring(time, 6.8, 8.5);
      const x = origin.x - rx * Math.sin(angle) - anchor.x;
      const y = origin.y - ry * Math.cos(angle) - anchor.y;
      const fade = Math.max(0, Math.min(1, (time - .15) / .7));
      return {
        offset: time,
        transform: `translate(-50%, -50%) translate3d(${x}px, ${y}px, 0) scale(${scale})`,
        opacity: entering ? from.opacity + (1 - from.opacity) * Math.min(1, time / .25) : from.opacity * (1 - fade * fade * (3 - 2 * fade)),
      };
    });
    return button.animate(frames, {
      duration: interrupted ? 480 : entering ? 640 : 460,
      delay: interrupted ? 0 : entering ? 220 + index * 75 : (buttons.length - 1 - index) * 55,
      easing: 'linear', fill: 'both',
    });
  });
  orbitAnimations = animations;
  Promise.all(animations.map(animation => animation.finished)).then(() => {
    if (orbitAnimations === animations) settleOrbit();
  }).catch(() => { /* A new route, interaction or viewport interrupted the entrance. */ });
}

function revealOrbit() {
  if (!isSettings() || document.hidden || reducedMotion.matches || root.dataset.previewMotion === 'off') {
    settleOrbit();
    return;
  }
  animateOrbit(true);
}

function targetScroll(card) {
  // Layout coordinates remain stable while the route's entry transform runs.
  const desired = settings.offsetTop + card.offsetTop + card.offsetHeight / 2 - axis();
  return Math.max(0, Math.min(desired, document.documentElement.scrollHeight - innerHeight));
}

function announceCard(card) {
  document.querySelector('#announcement').textContent = `Раздел: ${card.querySelector('h2').textContent}`;
}

function updateFromScroll() {
  frame = 0;
  if (!isSettings()) return;
  if (targetCard) {
    if (Math.abs(scrollY - targetScroll(targetCard)) <= 1) {
      announceCard(targetCard);
      targetCard = null;
    }
    return;
  }
  const index = nearestCardIndex(cards.map(card => card.getBoundingClientRect()), axis());
  setActive(cards[index].dataset.preview);
}

function scheduleScrollUpdate() {
  if (!frame) frame = requestAnimationFrame(updateFromScroll);
}

function goToCard(index) {
  const card = cards[index];
  if (!card || !isSettings()) return;
  targetCard = card;
  setActive(card.dataset.preview);
  scrollController.to(targetScroll(card));
  scheduleScrollUpdate();
}

function cancelTarget() {
  if (!targetCard) return;
  targetCard = null;
  scheduleScrollUpdate();
}

buttons.forEach((button, index) => {
  button.addEventListener('click', () => goToCard(index));
  button.addEventListener('keydown', event => {
    let next;
    if (['ArrowRight', 'ArrowDown'].includes(event.key)) next = Math.min(index + 1, buttons.length - 1);
    if (['ArrowLeft', 'ArrowUp'].includes(event.key)) next = Math.max(index - 1, 0);
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = buttons.length - 1;
    if (next === undefined) return;
    event.preventDefault();
    buttons[next].focus({ preventScroll: true });
    goToCard(next);
  });
});

// Smooth document scrolling; only selection follows the shared center line.
window.addEventListener('scroll', () => {
  scrolling = true;
  clearTimeout(settleTimer);
  settleTimer = setTimeout(() => { scrolling = false; }, 140);
  scheduleScrollUpdate();
}, { passive: true });

cards.forEach(card => {
  const activate = () => {
    if (isSettings() && !targetCard) setActive(card.dataset.preview);
  };
  card.addEventListener('pointermove', event => {
    if (!scrolling && (event.movementX || event.movementY)) activate();
  });
  card.addEventListener('focusin', activate);
  card.addEventListener('click', activate);
});
document.addEventListener('somnia:navigate', event => {
  const id = ++orbitNavigationId;
  const entering = event.detail.to === 'settings';
  const animate = event.detail.animate && !document.hidden && !reducedMotion.matches && root.dataset.previewMotion !== 'off';
  targetCard = null;
  // This event precedes the route attribute change, allowing a visible exit.
  if (!entering) {
    if (animate) animateOrbit(false);
    else settleOrbit(false);
  }
  queueMicrotask(() => {
    if (id !== orbitNavigationId) return;
    layoutArc();
    setActive(entering ? 'storage' : 'home');
    if (entering && animate) revealOrbit();
    else if (entering) settleOrbit(true);
  });
});
new ResizeObserver(([entry]) => {
  settleOrbit();
  root.style.setProperty('--device-design-scale', String(entry.contentRect.width / 415));
  layoutArc();
  if (targetCard && isSettings()) scrollController.to(targetScroll(targetCard), { instant: true });
}).observe(document.querySelector('.device-orb'));
window.addEventListener('resize', () => { settleOrbit(); layoutArc(); scheduleScrollUpdate(); });
document.addEventListener('somnia:motion-change', () => {
  if (root.dataset.previewMotion === 'off') settleOrbit();
});
reducedMotion.addEventListener('change', () => { if (reducedMotion.matches) settleOrbit(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) settleOrbit(); });
layoutArc();
setActive(root.dataset.page === 'settings' ? 'storage' : 'home');
// Run after the initial ResizeObserver measurement so it cannot cancel startup.
requestAnimationFrame(() => requestAnimationFrame(revealOrbit));

