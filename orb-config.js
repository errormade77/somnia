// One schema for the editor and the defaults saved by the local server.
export const numericControls = Object.freeze({
  size: { label: 'Размер', min: 80, max: 560, step: 1, unit: 'px' },
  animationSpeed: { label: 'Скорость анимации', min: 0.25, max: 3, step: 0.05, unit: '×' },
  dotSize: { label: 'Размер точек', min: 50, max: 200, step: 5, unit: '%' },
  intensity: { label: 'Интенсивность', min: 0.25, max: 2, step: 0.01 },
  detail: { label: 'Детализация', min: 0, max: 1, step: 0.01 },
  glass: { label: 'Стекло', min: 0, max: 1, step: 0.01 },
  matte: { label: 'Матовость стекла', min: 0, max: 100, step: 1, unit: '%' },
  glow: { label: 'Свечение', min: 0, max: 2, step: 0.01 },
  seed: { label: 'Рисунок', min: 0, max: 6.28, step: 0.001 },
  speed: { label: 'Скорость вращения', min: 0, max: 2, step: 0.01 },
  drift: { label: 'Плавность дрейфа', min: 0, max: 2, step: 0.01 },
  floatDistance: { label: 'Амплитуда парения', min: 0, max: 24, step: 0.5, unit: 'px' },
  floatScale: { label: 'Масштаб при парении', min: 0.95, max: 1.08, step: 0.001 },
  floatDuration: { label: 'Период парения', min: 2, max: 16, step: 0.1, unit: 'с' },
  floatDelay: { label: 'Смещение фазы', min: -4, max: 4, step: 0.1, unit: 'с' },
  shellBlur: { label: 'Мягкость оболочки', min: 0, max: 24, step: 0.1, unit: 'px' },
});
export const colorControls = Object.freeze({
  base: 'Основа', interior: 'Глубина', accent1: 'Акцент 1', accent2: 'Акцент 2', accent3: 'Акцент 3',
});
export const initialOrbSettings = Object.freeze({
  preset: 'core-teal-01', size: 415, seed: 4.6, animationSpeed: 1, dotSize: 100,
  base: '#07262B', interior: '#000000', accent1: '#00C2A8', accent2: '#38E1FF', accent3: '#FFC65C',
  intensity: 1, detail: 1, glass: 0.4, matte: 0, glow: 1,
  speed: 1, drift: 1, ambientFloat: true,
  floatDistance: 10, floatScale: 1, floatDuration: 7, floatDelay: 0,
  shellBlur: 15.8, quality: 'balanced', motion: 'system',
});
export const scrollControls = Object.freeze({
  speed: { label: 'Скорость прокрутки', min: 0.5, max: 2, step: 0.1, unit: '×' },
  smoothness: { label: 'Плавность прокрутки', min: 0.06, max: 0.45, step: 0.01, unit: 'с' },
});
export const initialScrollSettings = Object.freeze({ enabled: true, speed: 1, smoothness: 0.16 });
export const galleryControls = Object.freeze({
  edgeBlur: { label: 'Размытие края', min: 0, max: 100, step: 1, unit: '%' },
  edgeFade: { label: 'Сила растворения', min: 0, max: 100, step: 1, unit: '%' },
  matte: { label: 'Матовость снов', min: 0, max: 100, step: 1, unit: '%' },
});
export const initialGallerySettings = Object.freeze({ edgeBlur: 32, edgeFade: 70, matte: 0 });
export function presetSettings(id, definition) {
  return {
    preset: id, seed: definition.phase,
    base: definition.baseColor.toUpperCase(), interior: '#000000',
    accent1: definition.accentColors[0].toUpperCase(),
    accent2: definition.accentColors[1].toUpperCase(),
    accent3: definition.accentColors[2].toUpperCase(),
    intensity: 1, detail: 1, glass: definition.lensStrength, glow: 1,
    speed: 1, drift: 1, ambientFloat: definition.ambientMotion.enabled,
    floatDistance: definition.ambientMotion.verticalTravel,
    floatScale: definition.ambientMotion.scale,
    floatDuration: definition.ambientMotion.durationSeconds || 7,
    floatDelay: definition.ambientMotion.delaySeconds,
  };
}
export function validateSiteSettings(value, presetIds) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || value.version !== 1) throw new TypeError('Неверный формат настроек сайта.');
  if (Object.keys(value).some(key => !['version', 'orb', 'scroll', 'gallery'].includes(key))) throw new TypeError('Неизвестный раздел настроек.');
  if (!value.orb || typeof value.orb !== 'object' || Array.isArray(value.orb)) throw new TypeError('Нет настроек шара.');
  // Older saved files retain every existing value and acquire only the new controls.
  const orb = { animationSpeed: initialOrbSettings.animationSpeed, dotSize: initialOrbSettings.dotSize, matte: initialOrbSettings.matte, ...value.orb };
  const keys = Object.keys(initialOrbSettings);
  if (Object.keys(orb).length !== keys.length || Object.keys(orb).some(key => !keys.includes(key))) throw new TypeError('Неверный набор параметров шара.');
  if (!presetIds.includes(orb.preset)) throw new TypeError('Неизвестный пресет шара.');
  for (const [key, { min, max }] of Object.entries(numericControls)) {
    if (typeof orb[key] !== 'number' || !Number.isFinite(orb[key]) || orb[key] < min || orb[key] > max) throw new RangeError(`Параметр «${numericControls[key].label}» вне допустимого диапазона.`);
  }
  for (const key of Object.keys(colorControls)) {
    if (typeof orb[key] !== 'string' || !/^#[0-9a-f]{6}$/i.test(orb[key])) throw new TypeError('Цвет должен быть в формате #RRGGBB.');
  }
  if (typeof orb.ambientFloat !== 'boolean') throw new TypeError('Неверный параметр парения.');
  if (!['low', 'balanced', 'high'].includes(orb.quality)) throw new TypeError('Неверное качество.');
  if (!['system', 'on', 'off'].includes(orb.motion)) throw new TypeError('Неверный режим анимации.');
  const scroll = Object.hasOwn(value, 'scroll') ? value.scroll : { ...initialScrollSettings };
  if (!scroll || typeof scroll !== 'object' || Array.isArray(scroll)
    || Object.keys(scroll).length !== 3 || Object.keys(scroll).some(key => !Object.hasOwn(initialScrollSettings, key))
    || typeof scroll.enabled !== 'boolean') throw new TypeError('Неверные настройки прокрутки.');
  for (const [key, { min, max, label }] of Object.entries(scrollControls)) {
    if (typeof scroll[key] !== 'number' || !Number.isFinite(scroll[key]) || scroll[key] < min || scroll[key] > max) throw new RangeError(`Параметр «${label}» вне допустимого диапазона.`);
  }
  const gallery = Object.hasOwn(value, 'gallery') ? value.gallery : { ...initialGallerySettings };
  const galleryKeys = Object.keys(initialGallerySettings);
  if (!gallery || typeof gallery !== 'object' || Array.isArray(gallery)
    || Object.keys(gallery).length !== galleryKeys.length
    || Object.keys(gallery).some(key => !Object.hasOwn(initialGallerySettings, key))) throw new TypeError('Неверные настройки галереи снов.');
  for (const [key, { min, max, label }] of Object.entries(galleryControls)) {
    if (typeof gallery[key] !== 'number' || !Number.isFinite(gallery[key]) || gallery[key] < min || gallery[key] > max) throw new RangeError(`Параметр «${label}» вне допустимого диапазона.`);
  }
  return {
    version: 1,
    orb: Object.fromEntries(keys.map(key => [key, Object.hasOwn(colorControls, key) ? orb[key].toUpperCase() : orb[key]])),
    scroll: { enabled: scroll.enabled, speed: scroll.speed, smoothness: scroll.smoothness },
    gallery: Object.fromEntries(galleryKeys.map(key => [key, gallery[key]])),
  };
}
