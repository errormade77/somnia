import { createDreamGrid } from './dream-media.js';

export function createSavingPreview() {
  const root = document.documentElement;
  const scene = document.querySelector('.saving-preview');
  const orb = document.querySelector('#device-orb');
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  const grid = createDreamGrid(scene.querySelector('.saving-dream-grid'), [{ count: 2 }, { count: 2 }], {
    dreamIndices: [0, 5, 7, 9],
  });
  const videos = new Map([...scene.querySelectorAll('video')].map(video => [video.dataset.saving, video]));
  const labels = {
    all: 'Все сны: четыре сна в круглой сетке',
    pleasant: 'Приятные сны: салют',
    ask: 'Похоже вам приснился тревожный сон. Сохраним его? На фоне сон с шариками в бассейне',
  };
  let active = false;
  let mode = 'ask';

  function playback() {
    const speed = Number(getComputedStyle(root).getPropertyValue('--preview-animation-speed')) || 1;
    const playing = active && !root.dataset.deviceFlight && !document.hidden && !preference.matches && root.dataset.previewMotion !== 'off';
    grid.setPlayback(playing && mode === 'all', speed);
    for (const [key, video] of videos) {
      video.playbackRate = speed;
      if (active && key === mode && !video.getAttribute('src')) video.src = video.dataset.src;
      if (playing && key === mode) video.play().catch(() => {});
      else video.pause();
    }
  }
  function selection() {
    mode = document.querySelector('[data-choice="saving"] [aria-pressed="true"]').dataset.value;
    scene.dataset.saving = mode;
    if (active) orb.setAttribute('aria-label', labels[mode]);
    playback();
  }
  for (const video of videos.values()) {
    video.muted = true;
    video.addEventListener('loadedmetadata', playback);
  }
  document.addEventListener('somnia:settings-change', selection);
  document.addEventListener('somnia:motion-change', playback);
  document.addEventListener('somnia:device-flight', playback);
  document.addEventListener('visibilitychange', playback);
  preference.addEventListener('change', playback);
  selection();
  return {
    setActive(value) {
      if (active === value) return;
      active = value;
      selection();
    },
  };
}
