import { sphereFlightDuration, sphereFlightPose } from './sphere-flight.js';

const root = document.documentElement;
const home = document.querySelector('#home-view');
const settings = document.querySelector('#settings-view');
const device = document.querySelector('.device');
const orb = document.querySelector('.device-orb');
const deviceInfo = document.querySelector('.home-device-info');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const pageAtLocation = () => /^\/settings\/?$/.test(location.pathname) ? 'settings' : 'home';
let page = pageAtLocation();
let contentAnimation;
let navigationId = 0;
let deviceAnimations = [];

function setDeviceFlight(mode) {
  const previous = root.dataset.deviceFlight;
  if (mode) root.dataset.deviceFlight = mode;
  else delete root.dataset.deviceFlight;
  if (previous === mode || (!previous && !mode)) return;
  document.dispatchEvent(new CustomEvent('somnia:device-flight', { detail: {
    active: Boolean(mode), direction: mode || previous,
    phase: mode ? previous ? 'redirect' : 'start' : 'end',
  } }));
}

function stopDeviceFlight({ resume = true } = {}) {
  deviceAnimations.forEach(animation => animation.cancel());
  deviceAnimations = [];
  if (resume) setDeviceFlight(null);
}

// The home dock stays at the Figma size, shrinking together on narrow screens.
function sizeHomeOrb() {
  settleNavigation();
  const scale = Math.min(1, (innerWidth - 24) / 406);
  const diameter = parseFloat(getComputedStyle(orb).width);
  root.style.setProperty('--home-dock-scale', String(scale));
  root.style.setProperty('--home-orb-size', `${111 * scale}px`);
  root.style.setProperty('--home-orb-scale', String(111 * scale / diameter));
  root.style.setProperty('--home-scene-scale', String(diameter / 111));
}
const resizeObserver = new ResizeObserver(sizeHomeOrb);
resizeObserver.observe(orb);
window.addEventListener('resize', sizeHomeOrb);
sizeHomeOrb();

// Both persistent spheres use the same spring, on opposite curved paths.
function flyDevice(from, entering) {
  const to = orb.getBoundingClientRect();
  const diameter = parseFloat(getComputedStyle(orb).width);
  const start = { x: from.left + from.width / 2, y: from.top + from.height / 2, diameter: from.width };
  const end = { x: to.left + to.width / 2, y: to.top + to.height / 2, diameter: to.width };
  const positionFrames = [], scaleFrames = [];
  for (let frame = 0; frame <= 80; frame++) {
    const time = frame / 80;
    const pose = sphereFlightPose(start, end, time, { expanding: entering });
    const x = pose.x - end.x;
    // The shell scales from its top centre; compensate to follow the arc.
    const y = pose.y - to.top - pose.diameter / 2;
    positionFrames.push({ offset: time, transform: `translateX(-50%) translate3d(${x}px, ${y}px, 0)` });
    scaleFrames.push({ offset: time, transform: `scale(${pose.diameter / diameter})` });
  }
  const options = { duration: sphereFlightDuration(entering), easing: 'linear', fill: 'both' };
  setDeviceFlight(entering ? 'expand' : 'collapse');
  const animations = [device.animate(positionFrames, options), orb.animate(scaleFrames, options)];
  deviceAnimations = animations;
  Promise.all(animations.map(animation => animation.finished)).then(() => {
    if (deviceAnimations === animations) stopDeviceFlight();
  }).catch(() => { /* A newer navigation replaced this flight. */ });
}

function moveSphere(animate) {
  document.dispatchEvent(new CustomEvent('somnia:sphere-route', { detail: {
    docked: page === 'settings', animate, duration: sphereFlightDuration(page === 'settings'),
  } }));
}

function settleNavigation() {
  stopDeviceFlight();
  contentAnimation?.cancel(); contentAnimation = null;
  settings.hidden = page !== 'settings';
  home.hidden = page !== 'home';
  moveSphere(false);
}

function renderPage(next, { animate = true, focus = true } = {}) {
  const id = ++navigationId;
  const entering = next === 'settings';
  const shouldAnimate = animate && !reducedMotion.matches && root.dataset.previewMotion !== 'off';
  const wasHidden = settings.hidden;
  const currentOpacity = getComputedStyle(settings).opacity;
  const currentTransform = getComputedStyle(settings).transform;
  const previousOrb = orb.getBoundingClientRect();
  stopDeviceFlight({ resume: !shouldAnimate });
  contentAnimation?.cancel();
  document.dispatchEvent(new CustomEvent('somnia:navigate', { detail: { from: page, to: next, animate: shouldAnimate } }));
  page = next;
  root.dataset.page = next;
  document.body.dataset.nodeId = entering ? '31:3804' : '46:6125';
  document.title = entering ? 'Настройки — Somnia' : 'Somnia';
  document.querySelector('.home-link').setAttribute('aria-current', entering ? 'false' : 'page');
  if (entering) {
    deviceInfo.removeAttribute('href');
    deviceInfo.setAttribute('aria-disabled', 'true');
    deviceInfo.setAttribute('tabindex', '-1');
  } else {
    deviceInfo.setAttribute('href', '/settings');
    deviceInfo.removeAttribute('aria-disabled');
    deviceInfo.removeAttribute('tabindex');
  }
  home.hidden = entering;
  settings.inert = !entering;
  if (entering) settings.hidden = false;
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  if (focus) {
    const target = entering ? document.querySelector('#settings-title') : document.querySelector('.device-link');
    target.focus({ preventScroll: true });
  }

  if (!shouldAnimate) {
    settings.hidden = !entering;
    moveSphere(false);
    return;
  }

  flyDevice(previousOrb, entering);
  moveSphere(true);

  contentAnimation = settings.animate(entering ? [
    { opacity: wasHidden ? 0 : currentOpacity, transform: wasHidden ? 'translateY(24px)' : currentTransform },
    { opacity: 1, transform: 'translateY(0)' },
  ] : [
    { opacity: currentOpacity, transform: currentTransform },
    { opacity: 0, transform: 'translateY(12px)' },
  ], {
    duration: entering ? 440 : 180,
    delay: entering ? 180 : 0,
    easing: 'cubic-bezier(.22, 1, .36, 1)',
    fill: 'both',
  });
  contentAnimation.finished.then(() => {
    if (id !== navigationId) return;
    settings.hidden = !entering;
    home.hidden = entering;
    contentAnimation.cancel();
    contentAnimation = null;
  }).catch(() => { /* A newer navigation replaced this animation. */ });
}

document.addEventListener('click', event => {
  const link = event.target.closest('a[data-route]');
  if (link?.getAttribute('aria-disabled') === 'true') { event.preventDefault(); return; }
  if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  if (link.dataset.route === page) return;
  history.pushState(null, '', link.getAttribute('href'));
  renderPage(link.dataset.route);
});

window.addEventListener('popstate', () => renderPage(pageAtLocation()));
reducedMotion.addEventListener('change', () => {
  if (reducedMotion.matches) settleNavigation();
});
document.addEventListener('somnia:motion-change', () => {
  if (root.dataset.previewMotion === 'off') settleNavigation();
});
history.scrollRestoration = 'manual';
renderPage(page, { animate: false, focus: false });
requestAnimationFrame(() => { root.dataset.navigationReady = 'true'; });
