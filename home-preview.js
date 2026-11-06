import { dreams } from './assets/dreams/catalog.js';

export function createHomePreview() {
  const root = document.documentElement;
  const video = document.querySelector('.home-dream');
  const clock = document.querySelector('.home-clock');
  const orb = document.querySelector('#device-orb');
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  const formatter = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  let active = false;
  let viewerOpen = false;
  let previous = null;
  let timer;
  video.muted = true;
  const powered = () => root.dataset.devicePower !== 'off';

  function chooseDream() {
    const choices = dreams.length > 1 ? dreams.filter(dream => dream !== previous) : dreams;
    const dream = choices[Math.floor(Math.random() * choices.length)];
    previous = dream;
    video.poster = dream.poster;
    video.preload = 'auto';
    video.src = dream.src;
  }

  function updateClock() {
    clearTimeout(timer);
    if (!active || document.hidden) return;
    if (!powered()) { orb.setAttribute('aria-label', 'Сфера устройства выключена'); return; }
    const now = new Date();
    clock.textContent = formatter.format(now);
    clock.dateTime = now.toISOString();
    orb.setAttribute('aria-label', `Случайный сон. Текущее время ${clock.textContent}`);
    // Align to the next wall-clock minute; refresh immediately after tab sleep.
    timer = setTimeout(updateClock, 60000 - now.getTime() % 60000 + 20);
  }

  function playback() {
    video.playbackRate = Number(getComputedStyle(root).getPropertyValue('--preview-animation-speed')) || 1;
    if (active && powered() && !viewerOpen && !root.dataset.deviceFlight && !document.hidden && !preference.matches && root.dataset.previewMotion !== 'off') video.play().catch(() => {});
    else video.pause();
  }

  document.addEventListener('somnia:motion-change', playback);
  document.addEventListener('somnia:device-flight', playback);
  document.addEventListener('somnia:device-power', () => {
    if (active && powered() && !video.getAttribute('src')) chooseDream();
    updateClock();
    playback();
  });
  document.addEventListener('somnia:dream-viewer', event => { viewerOpen = event.detail.open; playback(); });
  document.addEventListener('visibilitychange', () => { updateClock(); playback(); });
  window.addEventListener('pageshow', () => { updateClock(); playback(); });
  preference.addEventListener('change', playback);

  return {
    setActive(value) {
      if (active === value) return;
      active = value;
      if (active && powered()) chooseDream();
      updateClock();
      playback();
    },
  };
}
