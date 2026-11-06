import { siteDefaults as settings } from './assets/site-defaults.js';
import { configureScroll } from './smooth-scroll.js';
import { configureGalleryAppearance } from './assets/sphere-gallery/appearance.js';

const motionElement = document.querySelector('#device-orb-motion');
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');

function renderOrb() {
  const value = settings.orb;
  document.documentElement.style.setProperty('--orb-size', `${value.size}px`);
  document.documentElement.style.setProperty('--preview-animation-speed', String(value.animationSpeed));
  document.documentElement.style.setProperty('--orb-dot-scale', String(value.dotSize / 100));
  document.documentElement.style.setProperty('--preview-transition-duration', `${900 / value.animationSpeed}ms`);
  document.documentElement.style.setProperty('--orb-top-space', `${Math.max(0, value.ambientFloat ? value.floatDistance - 12 : 0)}px`);
  motionElement.style.setProperty('--orb-shell-blur', `${value.shellBlur}px`);
  motionElement.style.setProperty('--orb-glass-strength', String(value.glass));
  const matte = value.matte / 100;
  motionElement.style.setProperty('--orb-matte', String(value.matte));
  motionElement.style.setProperty('--orb-specular-strength', String(1 - matte * .7));
  motionElement.style.setProperty('--orb-chrome-opacity', String(Math.max(value.glass, matte * .4)));
  motionElement.style.setProperty('--orb-reflection-strength', String(value.glow / 2 * (1 - matte * .8)));
  motionElement.style.setProperty('--orb-motion-distance', `${-value.floatDistance}px`);
  motionElement.style.setProperty('--orb-motion-scale', String(value.floatScale));
  motionElement.style.setProperty('--orb-motion-duration', `${value.floatDuration}s`);
  motionElement.style.setProperty('--orb-motion-delay', `${value.floatDelay}s`);
  const reduceMotion = value.motion === 'off' || (value.motion === 'system' && motionPreference.matches);
  motionElement.dataset.ambientMotion = String(value.ambientFloat && !reduceMotion);
  motionElement.dataset.playbackState = document.hidden ? 'paused' : 'running';
  document.documentElement.dataset.previewMotion = reduceMotion ? 'off' : 'on';
  document.dispatchEvent(new CustomEvent('somnia:motion-change', { detail: { ...value, reducedMotion: reduceMotion } }));
}


motionPreference.addEventListener('change', renderOrb);
document.addEventListener('visibilitychange', renderOrb);
window.addEventListener('pageshow', event => { if (event.persisted) renderOrb(); });

renderOrb();
configureScroll(settings.scroll);
configureGalleryAppearance(settings.gallery);
