export function createStylePreview() {
  const root = document.documentElement;
  const scene = document.querySelector('.style-preview');
  const orb = document.querySelector('#device-orb');
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  const videos = new Map([...scene.querySelectorAll('video')].map(video => [video.dataset.style, video]));
  const pendingTimes = new Map();
  let active = false;
  let mode = null;
  let speed = Number(getComputedStyle(root).getPropertyValue('--preview-animation-speed')) || 1;
  const canPlay = () => active && !root.dataset.deviceFlight && !document.hidden && !preference.matches && root.dataset.previewMotion !== 'off';

  function seek(video, time) {
    if (video.readyState < 1) { pendingTimes.set(video, time); return; }
    const duration = video.duration;
    const position = Number.isFinite(duration) && duration > 0 ? time % duration : time;
    if (Math.abs(video.currentTime - position) > 1 / 24) video.currentTime = position;
    pendingTimes.delete(video);
  }
  function prepare(video, time) {
    if (!video.getAttribute('src')) {
      video.preload = 'auto';
      video.src = video.dataset.src;
    }
    seek(video, time);
  }
  function playback() {
    for (const [key, video] of videos) {
      video.playbackRate = speed;
      if (key === mode && canPlay() && video.getAttribute('src')) video.play().catch(() => {});
      else video.pause();
    }
  }
  function announce() {
    if (active) orb.setAttribute('aria-label', mode === 'natural'
      ? 'Натуральный стиль: девушка бежит по лугу'
      : 'Абстрактный стиль: плавные формы и градиенты в цветах сна');
  }
  function selection() {
    const next = document.querySelector('[data-choice="style"] [aria-pressed="true"]').dataset.value;
    if (next !== mode) {
      const time = videos.get(mode)?.currentTime || 0;
      mode = next;
      scene.dataset.style = mode;
      const video = videos.get(mode);
      if (active) prepare(video, time);
      else pendingTimes.set(video, time);
    }
    announce();
    playback();
  }
  for (const video of videos.values()) {
    video.muted = true;
    video.addEventListener('loadedmetadata', () => {
      if (pendingTimes.has(video)) seek(video, pendingTimes.get(video));
      playback();
    });
  }
  document.addEventListener('somnia:settings-change', selection);
  document.addEventListener('somnia:device-flight', playback);
  document.addEventListener('somnia:motion-change', () => {
    speed = Number(getComputedStyle(root).getPropertyValue('--preview-animation-speed')) || 1;
    playback();
  });
  document.addEventListener('visibilitychange', playback);
  preference.addEventListener('change', playback);
  selection();
  return {
    setActive(value) {
      if (active === value) return;
      active = value;
      if (active) {
        selection();
        const video = videos.get(mode);
        prepare(video, pendingTimes.get(video) ?? video.currentTime);
        announce();
      }
      playback();
    },
  };
}
