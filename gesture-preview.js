import { dreams } from './dream-media.js';
const gestureGapMs = 80;
const resultHoldMs = 1000;
const resetMs = 900;
const settleMs = 250;
const slideMs = 1050;
// Each resting dream fills the 415 px scene; neighbours wait outside the orb.
const slideStep = 415;
const gestureNames = { left: 'Жест влево', up: 'Жест вверх', right: 'Жест вправо', down: 'Жест вниз', tap: 'Касание' };

export function createGesturePreview() {
  const root = document.documentElement;
  const scene = document.querySelector('.gesture-preview');
  const gallery = scene.querySelector('.dream-gallery');
  const strip = scene.querySelector('.dream-strip');
  const volume = scene.querySelector('.dream-volume');
  const orb = document.querySelector('#device-orb');
  const gestureButtons = [...document.querySelectorAll('.gesture-option')];
  const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
  const icons = new Map();
  const timers = new Set();
  const animations = new Set();
  const flightAnimations = new Set();
  let orbIcon;
  let active = false;
  let currentDream = 0;
  let enteringSlot = null;
  let gesture = 'left';
  let action = 'next';
  let generation = 0;
  let animationSpeed = Number(getComputedStyle(root).getPropertyValue('--preview-animation-speed')) || 1;
  let wasReduced = reducedMotion();
  function reducedMotion() { return motionPreference.matches || root.dataset.previewMotion === 'off'; }

  const slots = [-1, 0, 1].map(slot => {
    const circle = document.createElement('div');
    circle.className = 'dream-circle';
    circle.dataset.slot = slot;
    circle.style.setProperty('--dream-x', `${slot * slideStep}px`);
    const crop = document.createElement('div');
    crop.className = 'dream-crop';
    circle.append(crop);
    strip.append(circle);
    const media = document.createElement('video');
    media.className = 'dream-media';
    media.muted = true;
    media.loop = true;
    media.playsInline = true;
    media.preload = 'none';
    crop.append(media);
    return { slot, circle, media };
  });
  // Clockwise from twelve o'clock; the ring itself stays in screen pixels.
  const volumeDots = Array.from({ length: 48 }, (_, index) => {
    const dot = volume.appendChild(document.createElement('i'));
    const angle = index / 48 * Math.PI * 2;
    dot.style.left = `${50 + Math.sin(angle) * 50}%`;
    dot.style.top = `${50 - Math.cos(angle) * 50}%`;
    return dot;
  });
  let litVolumeDots = 0;

  function setVolume(level) {
    litVolumeDots = Math.round(Math.max(0, Math.min(1, level)) * volumeDots.length);
    volumeDots.forEach((dot, index) => { dot.dataset.lit = String(index < litVolumeDots); });
    volume.dataset.level = String(Math.round(level * 100));
  }

  async function changeVolume(level) {
    const target = Math.round(level * volumeDots.length);
    const steps = Math.abs(target - litVolumeDots);
    const direction = Math.sign(target - litVolumeDots);
    if (reducedMotion() || !steps) { setVolume(level); return true; }
    for (let step = 0; step < steps; step++) {
      setVolume((litVolumeDots + direction) / volumeDots.length);
      if (!await wait(400 / steps)) return false;
    }
    return true;
  }

  function renderDreams() {
    for (const slot of slots) {
      const index = (currentDream + slot.slot + dreams.length) % dreams.length;
      const dream = dreams[index];
      slot.circle.dataset.slot = slot.slot;
      slot.circle.style.setProperty('--dream-x', `${slot.slot * slideStep}px`);
      slot.media.poster = dream.poster;
      // Posters suffice until the gesture card is opened. Only three neighbouring clips load.
      if (active) {
        slot.media.preload = slot.slot === 0 ? 'auto' : 'metadata';
        if (slot.media.getAttribute('src') !== dream.src) { slot.media.pause(); slot.media.src = dream.src; }
      }
      slot.media.dataset.dream = index;
    }
    scene.dataset.dream = String(currentDream);
  }

  function wait(delay, scaleWithSpeed = true) {
    const token = generation;
    return new Promise(resolve => {
      const timer = { remaining: scaleWithSpeed ? delay / animationSpeed : delay, started: 0, handle: null, resolve, token };
      timers.add(timer);
      scheduleTimer(timer);
    });
  }

  function scheduleTimer(timer) {
    if (root.dataset.deviceFlight || timer.handle !== null) return;
    timer.started = performance.now();
    timer.handle = setTimeout(() => {
      timers.delete(timer);
      timer.handle = null;
      timer.resolve(timer.token === generation);
    }, timer.remaining);
  }

  function pauseForFlight(animation) {
    if (animation.playState === 'finished' || animation.playState === 'idle') return;
    animation.pause();
    flightAnimations.add(animation);
  }

  function animate(element, frames, options) {
    const animation = element.animate(frames, { ...options, duration: options.duration / animationSpeed, delay: (options.delay || 0) / animationSpeed });
    animations.add(animation);
    animation.addEventListener('finish', () => animations.delete(animation), { once: true });
    if (root.dataset.deviceFlight) pauseForFlight(animation);
    return animation;
  }

  function stop() {
    generation++;
    timers.forEach(timer => { clearTimeout(timer.handle); timer.resolve(false); });
    timers.clear();
    animations.forEach(animation => animation.cancel());
    animations.clear();
    flightAnimations.forEach(animation => animation.cancel());
    flightAnimations.clear();
    enteringSlot = null;
    slots.forEach(slot => slot.media?.pause?.());
    scene.dataset.phase = 'idle';
  }

  function readSelection() {
    gesture = document.querySelector('[data-choice="gesture"] [aria-pressed="true"]').dataset.value;
    action = document.querySelector('[data-choice="action"] [aria-pressed="true"]').dataset.value;
    scene.dataset.gesture = gesture;
    scene.dataset.action = action;
    for (const [key, icon] of icons) {
      for (const dot of icon.querySelectorAll('circle')) {
        dot.dataset.lit = String(key === gesture && dot.dataset.arm === gesture);
        dot.setAttribute('fill-opacity', dot.dataset.arm === key ? (key === gesture ? '1' : '.5') : '.1');
      }
    }
    if (orbIcon) {
      for (const dot of orbIcon.querySelectorAll('circle')) {
        dot.setAttribute('fill-opacity', dot.dataset.arm === gesture ? '1' : '.1');
      }
    }
    if (active) {
      const label = document.querySelector('[data-choice="action"] [aria-pressed="true"]').textContent;
      orb.setAttribute('aria-label', `${gestureNames[gesture]} — ${label}. Превью сна`);
    }
  }

  async function pulse() {
    if (reducedMotion()) return true;
    const pulses = [];
    for (const icon of [icons.get(gesture), orbIcon].filter(Boolean)) {
      const centerX = Number(icon.dataset.centerX);
      const centerY = Number(icon.dataset.centerY);
      const dots = [...icon.querySelectorAll(`circle[data-arm="${gesture}"]`)];
      dots.sort((a, b) => distance(a) - distance(b));
      function distance(dot) {
        return Math.hypot(Number(dot.getAttribute('cx')) - centerX, Number(dot.getAttribute('cy')) - centerY);
      }
      dots.forEach((dot, index) => pulses.push(animate(dot, [
        { transform: 'scale(1)', offset: 0 },
        { transform: `scale(${gesture === 'tap' ? 1.35 : 1.65})`, offset: .42 },
        { transform: 'scale(1)', offset: 1 },
      ], { duration: 520, delay: index * 85, easing: 'ease-in-out' })));
    }
    // Await the last dot in both icons before starting the pause.
    const finished = await Promise.all(pulses.map(animation => animation.finished.then(() => true, () => false)));
    return finished.every(Boolean);
  }

  function updateVideos() {
    for (const slot of slots) {
      slot.media.playbackRate = animationSpeed;
      if (active && !root.dataset.deviceFlight && !document.hidden && !reducedMotion() && (slot.slot === 0 || slot.slot === enteringSlot) && gallery.dataset.paused !== 'true') slot.media.play().catch(() => {});
      else slot.media.pause();
    }
  }

  function syncFlight() {
    if (root.dataset.deviceFlight) {
      const now = performance.now();
      for (const timer of timers) {
        if (timer.handle === null) continue;
        clearTimeout(timer.handle);
        timer.remaining = Math.max(0, timer.remaining - (now - timer.started));
        timer.handle = null;
      }
      animations.forEach(pauseForFlight);
      // Freeze only internal gesture transitions; route/scene opacity keeps
      // crossfading normally, and the glass retains the last complete frame.
      for (const element of [...slots.map(slot => slot.circle), volume, ...volumeDots]) {
        element.getAnimations().forEach(pauseForFlight);
      }
    } else if (active && !document.hidden && !reducedMotion()) {
      for (const animation of flightAnimations) {
        if (animation.playState === 'paused') animation.play();
      }
      flightAnimations.clear();
      timers.forEach(scheduleTimer);
    } else if (!root.dataset.deviceFlight && !active) {
      stop();
    }
    updateVideos();
  }

  async function performAction() {
    if (action === 'next' || action === 'previous') {
      const direction = action === 'next' ? 1 : -1;
      const commit = () => {
        // Recycle the offscreen slot; the incoming video keeps its decoded frame and time.
        strip.dataset.reordering = 'true';
        currentDream = (currentDream + direction + dreams.length) % dreams.length;
        for (const slot of slots) {
          slot.slot -= direction;
          if (slot.slot < -1) slot.slot = 1;
          if (slot.slot > 1) slot.slot = -1;
        }
        enteringSlot = null;
        renderDreams();
        updateVideos();
      };
      if (reducedMotion()) { commit(); void strip.offsetWidth; delete strip.dataset.reordering; return true; }
      const token = generation;
      enteringSlot = direction;
      updateVideos();
      const slide = animate(strip, [
        { transform: 'translateX(0)' },
        { transform: `translateX(${-direction * slideStep}px)` },
      ], { duration: slideMs, easing: 'cubic-bezier(.22, 1, .36, 1)', fill: 'forwards' });
      const finished = await slide.finished.then(() => true, () => false);
      if (finished && token === generation) commit();
      slide.cancel();
      void strip.offsetWidth;
      delete strip.dataset.reordering;
      return finished && token === generation;
    } else if (action === 'stop' || action === 'play') {
      gallery.dataset.paused = String(action === 'stop');
      updateVideos();
      return reducedMotion() || wait(resetMs);
    } else {
      scene.dataset.volume = 'true';
      return changeVolume(action === 'volume-up' ? .8 : .3);
    }
  }

  function prepareAction(instant = false) {
    if (instant) scene.dataset.preparing = 'true';
    gallery.dataset.mode = ['next', 'previous'].includes(action) ? 'carousel' : 'player';
    gallery.dataset.paused = String(action === 'play');
    scene.dataset.volume = String(action === 'volume-up' || action === 'volume-down');
    setVolume(.5);
    updateVideos();
    if (instant) {
      // Set the starting pose before the first cross pulse, without a competing transition.
      void scene.offsetWidth;
      delete scene.dataset.preparing;
    }
  }

  async function cycle() {
    const token = generation;
    while (token === generation && active && !document.hidden && !reducedMotion()) {
      scene.dataset.phase = 'gesture';
      if (!await pulse() || token !== generation) return;
      scene.dataset.phase = 'gap';
      // A brief handoff keeps the dream responsive immediately after the cross.
      if (!await wait(gestureGapMs, false)) return;
      scene.dataset.phase = 'action';
      if (!await performAction() || token !== generation) return;
      scene.dataset.phase = 'hold';
      if (!await wait(resultHoldMs)) return;
      if (!['next', 'previous'].includes(action)) {
        scene.dataset.phase = 'reset';
        prepareAction();
        if (!await wait(resetMs)) return;
      }
      scene.dataset.phase = 'settle';
      if (!await wait(settleMs)) return;
    }
  }

  function start() {
    stop();
    readSelection();
    if (!active || document.hidden) return;
    renderDreams();
    prepareAction(true);
    if (reducedMotion()) void performAction();
    else void cycle();
  }

  async function inlineIcon(img, spacing = 1) {
    const response = await fetch(img.getAttribute('src'));
    if (!response.ok) throw new Error('Не удалось загрузить иконку жеста');
    const svg = new DOMParser().parseFromString(await response.text(), 'image/svg+xml').documentElement;
    svg.classList.add('gesture-dots');
    svg.setAttribute('aria-hidden', 'true');
    // The updated Figma icon is rectangular and its tap dot is slightly off-centre.
    // Use that dot as the origin so vertical gestures remain on their own arm.
    const center = [...svg.querySelectorAll('circle')].reduce((largest, dot) =>
      !largest || Number(dot.getAttribute('r')) > Number(largest.getAttribute('r')) ? dot : largest, null);
    const centerX = Number(center.getAttribute('cx'));
    const centerY = Number(center.getAttribute('cy'));
    svg.dataset.centerX = centerX;
    svg.dataset.centerY = centerY;
    for (const dot of svg.querySelectorAll('circle')) {
      dot.dataset.baseRadius = dot.getAttribute('r');
      const dx = Number(dot.getAttribute('cx')) - centerX;
      const dy = Number(dot.getAttribute('cy')) - centerY;
      dot.setAttribute('cx', centerX + dx * spacing);
      dot.setAttribute('cy', centerY + dy * spacing);
      dot.dataset.arm = Math.abs(dx) > .1 ? (dx < 0 ? 'left' : 'right') : Math.abs(dy) > .1 ? (dy < 0 ? 'up' : 'down') : 'tap';
    }
    img.replaceWith(svg);
    return svg;
  }

  function syncAppearance() {
    const nextSpeed = Number(getComputedStyle(root).getPropertyValue('--preview-animation-speed')) || 1;
    const dotScale = Number(getComputedStyle(root).getPropertyValue('--orb-dot-scale')) || 1;
    orbIcon?.querySelectorAll('circle').forEach(dot => dot.setAttribute('r', Number(dot.dataset.baseRadius) * dotScale));
    const restart = nextSpeed !== animationSpeed || wasReduced !== reducedMotion();
    animationSpeed = nextSpeed;
    wasReduced = reducedMotion();
    if (restart) start();
  }

  // Inline the original circles so each dot can grow without scaling the whole icon.
  Promise.all([
    ...gestureButtons.map(async button => icons.set(button.dataset.value, await inlineIcon(button.querySelector('img')))),
    inlineIcon(scene.querySelector('.gesture-orb-icon img:not(.orb-graphic-shadow)'), .85).then(svg => { orbIcon = svg; }),
  ]).then(() => { syncAppearance(); start(); }).catch(error => console.warn(error.message));

  document.addEventListener('somnia:settings-change', event => {
    const next = event.detail;
    if (next.gesture !== gesture || next.actions[next.gesture] !== action) start();
  });
  document.addEventListener('somnia:gesture-replay', start);
  document.addEventListener('somnia:device-flight', syncFlight);
  document.addEventListener('somnia:motion-change', syncAppearance);
  document.addEventListener('visibilitychange', () => document.hidden ? stop() : start());
  motionPreference.addEventListener('change', start);
  renderDreams();
  readSelection();
  return {
    setActive(value) {
      if (active === value) return;
      active = value;
      if (active) start();
      else if (root.dataset.deviceFlight) syncFlight();
      else stop();
    },
  };
}
