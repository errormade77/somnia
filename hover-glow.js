import { generateVoiceBeamCSS, themePresets, resolveVoiceDefaults, registerVoiceInstance } from './assets/voice-glow/engine.js';

// The original Voice Glow visual engine, driven by pointer/focus instead of audio.
const selector = 'button, [role="tab"], .settings-back, .home-device-info';
const root = document.documentElement;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const records = new WeakMap();
const running = new Set();
let sequence = 0;
let pointerHost = null;
let focusHost = null;
let current = null;
let syncFrame = 0;
const canAnimate = () => !document.hidden && !reducedMotion.matches && root.dataset.previewMotion !== 'off';
const excluded = ':disabled, [aria-disabled="true"], [aria-pressed="true"], [aria-selected="true"], [aria-checked="true"], [aria-expanded="true"], [aria-current]:not([aria-current="false"])';
const eligible = host => host && host.isConnected
  && !host.matches(':disabled, [aria-disabled="true"]')
  && (!host.matches(excluded) || host.closest('.segmented'))
  && !host.closest('[inert], [hidden], [data-no-glow]');

function controlAt(target) {
  const control = target instanceof Element ? target.closest(selector) : null;
  return control;
}

function prepare(host) {
  const surface = host.closest('.segmented') || host;
  const group = surface !== host;
  if (records.has(surface)) {
    const record = records.get(surface);
    record.host = host;
    return record;
  }
  const id = `somnia-hover-${++sequence}`;
  const overlay = document.createElement('span');
  overlay.className = 'hover-glow';
  overlay.dataset.voiceBeam = id;
  overlay.setAttribute('data-voice-halfres', '');
  overlay.setAttribute('aria-hidden', 'true');
  // Keep the original layer opacity at 1; the whole effect fades continuously,
  // including when the pointer returns before the previous fade has finished.
  overlay.style.animation = 'none';
  overlay.style.setProperty(`--vb-opacity-${id}`, '1');
  overlay.style.setProperty('--voice-strength', '.85');
  overlay.innerHTML = `<span data-voice-beam-bloom></span>
    <canvas data-voice-beam-band-halo></canvas><canvas data-voice-beam-band></canvas>
    <span data-voice-beam-core><div></div></span>`;
  // Bare labels need their own stacking layer above the light, without changing
  // the flex/grid structure of tabs or replacing their semantic buttons.
  for (const node of group ? [] : [...host.childNodes]) {
    if (node.nodeType !== Node.TEXT_NODE || !node.textContent.trim()) continue;
    const label = document.createElement('span');
    label.className = 'hover-glow-label';
    node.replaceWith(label);
    label.append(node);
  }
  if (getComputedStyle(surface).position === 'static') surface.classList.add('hover-glow-relative');
  surface.classList.add(group ? 'has-hover-glow-group' : 'has-hover-glow');
  surface.append(overlay);
  const style = document.createElement('style');
  document.head.append(style);
  const record = { host, surface, group, overlay, style, id, active: false, release: null, timer: 0, width: 0, height: 0, radius: 0, controlWidth: 0, center: 0, targetCenter: 0, motionAt: 0, started: 0, pointer: 0 };
  records.set(surface, record);
  new ResizeObserver(() => { if (record.active) measure(record); }).observe(surface);
  return record;
}

function measure(record) {
  const { host, surface, overlay, id, style } = record;
  const width = surface.clientWidth, height = surface.clientHeight;
  const controlWidth = host.clientWidth;
  record.pointerRect = host.getBoundingClientRect();
  record.targetCenter = record.group ? host.offsetLeft + controlWidth / 2 - width / 2 : 0;
  if (!record.width || (!record.active && !record.overlay.hasAttribute('data-fading'))) record.center = record.targetCenter;
  const radius = Math.min(parseFloat(getComputedStyle(surface).borderBottomLeftRadius) || 0, width / 2, height / 2);
  if (width === record.width && height === record.height && radius === record.radius && controlWidth === record.controlWidth) return;
  record.width = width; record.height = height; record.radius = radius;
  record.controlWidth = controlWidth;
  const theme = themePresets.light;
  const geometry = {
    ...resolveVoiceDefaults('default', 'light'),
    scale: Math.min(.8, Math.max(.16, controlWidth / 350)),
    reach: 1.35, spread: .75, flow: 30, bend: 34,
    bandOffset: -12, bandTail: .2, bandStrength: 1.1,
    coreLight: .25, distortion: 0, idle: 0,
  };
  style.textContent = generateVoiceBeamCSS({
    ...geometry, id, borderRadius: radius, borderWidth: 1,
    ...theme, strokeOpacity: 0, innerShadow: 'transparent', colorVariant: 'colorful', theme: 'light',
    glowSize: geometry.glowSize * geometry.scale,
    distortion: false, look: 'glow',
  });
  // Inline positioning wins over the library's relative wrapper. The overlay
  // takes no layout space, and follows the host through its own animations.
  overlay.style.position = 'absolute';
  overlay.style.borderRadius = 'inherit';
  record.config = {
    ...geometry, id, radius, width, height, theme: 'light', look: 'glow',
    sensitivity: 1, threshold: 0, attack: .12, release: .24,
    breatheDuration: 4.5, bands: false, paused: false, reducedMotion: false,
    staticColors: false, hueRange: 22, hueDuration: 9,
    bandColors: { core: '197, 139, 255', above: '255, 122, 182', mid: '126, 196, 255', below: '45, 255, 171' },
  };
  if (record.release) { record.release(); record.release = null; drive(record); }
}

function drive(record) {
  if (record.release) return;
  record.release = registerVoiceInstance(record.overlay, record.config, {
    getLevel: () => {
      if (!record.active) return 0;
      const time = (performance.now() - record.started) / 1000;
      return .62 + .09 * Math.sin(time * 2.1) + .04 * Math.sin(time * 4.7);
    },
    getMotion: () => {
      // A tab group shares one background. Move its light source beneath the
      // hovered tab, while the selected white tab stays above and masks it.
      const now = performance.now();
      const elapsed = record.motionAt ? Math.min(80, now - record.motionAt) : 1000 / 60;
      record.motionAt = now;
      const destination = record.targetCenter + record.pointer * record.controlWidth * .08;
      record.center += (destination - record.center) * (1 - Math.exp(-elapsed / 160));
      const spread = Number(record.overlay.style.getPropertyValue(`--vb-w-${record.id}`)) || 1;
      const offset = record.group
        ? record.center / (126 * record.config.lobeSpacing * spread)
        : record.pointer * .2;
      return { gather: 0, offset, stretch: 0, heldLevel: 0, cornerFollow: 0 };
    },
  });
}

function finish(record) {
  clearTimeout(record.timer);
  record.active = false;
  record.release?.(); record.release = null;
  record.overlay.removeAttribute('data-active');
  record.overlay.removeAttribute('data-fading');
  record.host.removeAttribute('data-hover-glow');
  running.delete(record);
}

function hide(record) {
  if (!record) return;
  record.active = false;
  // Fade the last rendered frame on the compositor. Outgoing buttons don't
  // need live canvas/gradient work while the next hover is being drawn.
  record.release?.(); record.release = null;
  record.overlay.removeAttribute('data-active');
  record.overlay.setAttribute('data-fading', '');
  record.host.removeAttribute('data-hover-glow');
  clearTimeout(record.timer);
  record.timer = setTimeout(() => finish(record), 420);
}

function sync() {
  const candidate = eligible(pointerHost) ? pointerHost : focusHost;
  const host = canAnimate() && eligible(candidate) ? candidate : null;
  if (host === current?.host) return;
  if (host && current?.group && host.closest('.segmented') === current.surface) {
    current.host.removeAttribute('data-hover-glow');
    current.host = host;
    current.pointer = 0;
    host.setAttribute('data-hover-glow', '');
    measure(current);
    return;
  }
  if (current && !eligible(current.host) && !current.host.classList.contains('action-option')) finish(current);
  else hide(current);
  current = null;
  if (!host || !host.isConnected || !host.getClientRects().length) return;
  const record = prepare(host);
  clearTimeout(record.timer);
  measure(record);
  record.active = true;
  record.pointer = 0;
  record.started = performance.now();
  record.overlay.removeAttribute('data-fading');
  record.overlay.setAttribute('data-active', '');
  host.setAttribute('data-hover-glow', '');
  running.add(record);
  // Rapid movement across a row never leaves dozens of fading renderers alive.
  for (const old of running) { if (running.size <= 3) break; if (old !== record) finish(old); }
  drive(record);
  current = record;
}

// Pointer, focus and selection events from a click settle before one render.
// Do not tear down and recreate the same light between those events.
function scheduleSync() {
  if (syncFrame) return;
  syncFrame = requestAnimationFrame(() => { syncFrame = 0; sync(); });
}

document.addEventListener('pointerover', event => {
  if (event.pointerType === 'touch') return;
  pointerHost = controlAt(event.target);
  scheduleSync();
});
document.addEventListener('pointerout', event => {
  if (event.pointerType === 'touch') return;
  pointerHost = controlAt(event.relatedTarget);
  scheduleSync();
});
document.addEventListener('pointermove', event => {
  if (!current || current.host !== pointerHost) return;
  const rect = current.pointerRect ||= current.host.getBoundingClientRect();
  current.pointer = Math.max(-1, Math.min(1, (event.clientX - rect.left) / rect.width * 2 - 1));
}, { passive: true });
window.addEventListener('scroll', () => { if (current) current.pointerRect = null; }, { passive: true });
document.addEventListener('focusin', event => {
  const host = controlAt(event.target);
  focusHost = host?.matches(':focus-visible') ? host : null;
  scheduleSync();
});
document.addEventListener('focusout', () => { focusHost = null; scheduleSync(); });
document.addEventListener('click', scheduleSync);
// Selection can also change through keyboard navigation or scrolling the cards.
new MutationObserver(scheduleSync).observe(document.body, {
  subtree: true, attributes: true,
  attributeFilter: ['aria-pressed', 'aria-selected', 'aria-current', 'aria-checked', 'aria-expanded', 'aria-disabled', 'disabled'],
});

function stop() {
  cancelAnimationFrame(syncFrame);
  syncFrame = 0;
  pointerHost = focusHost = current = null;
  for (const record of running) finish(record);
}
document.addEventListener('somnia:navigate', stop);
document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
document.addEventListener('somnia:motion-change', () => { if (!canAnimate()) stop(); });
reducedMotion.addEventListener('change', () => { if (!canAnimate()) stop(); });
window.addEventListener('blur', stop);
window.addEventListener('pagehide', stop);

// The original storage fill uses the hover palette, with its own soft flow.
// It is independent of pointer/focus and only runs while visible on settings.
const meter = document.querySelector('.storage-meter-fill');
if (meter) {
  let visible = false;
  function syncMeter() {
    const speed = Number(getComputedStyle(root).getPropertyValue('--preview-animation-speed')) || 1;
    const playing = visible && canAnimate() && root.dataset.page === 'settings';
    meter.dataset.playing = String(playing);
    meter.style.setProperty('--storage-flow-duration', `${12 / speed}s`);
    meter.style.setProperty('--storage-play-state', playing ? 'running' : 'paused');
  }
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; syncMeter(); }).observe(meter);
  document.addEventListener('somnia:navigate', syncMeter);
  document.addEventListener('somnia:motion-change', syncMeter);
  document.addEventListener('visibilitychange', syncMeter);
  reducedMotion.addEventListener('change', syncMeter);
  window.addEventListener('pagehide', () => meter.style.setProperty('--storage-play-state', 'paused'));
  syncMeter();
}
