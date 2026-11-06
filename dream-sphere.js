import { dreams, getDreamAtlas } from './dream-media.js';
import { atlas } from './assets/dreams/catalog.js';

const root = document.documentElement;
const scene = document.querySelector('.dream-sphere');
const canvas = scene.querySelector('canvas');
const preference = matchMedia('(prefers-reduced-motion: reduce)');
const motion = () => !preference.matches && root.dataset.previewMotion !== 'off';
const canShow = () => !document.hidden;
let gallery = null, loading = false;

async function sync() {
  if (!gallery && !loading && canShow()) {
    loading = true;
    try {
      // One persistent scene serves both the full gallery and its dock preview.
      const { createSphereGallery } = await import('./assets/sphere-gallery/gallery.js');
      gallery = createSphereGallery(canvas, getDreamAtlas(), {
        count: dreams.length, columns: atlas.columns, docked: root.dataset.page === 'settings',
      });
    } catch (error) {
      console.warn('Dream gallery unavailable:', error);
      showFallback();
    }
  }
  gallery?.setActive(canShow(), motion());
}
document.addEventListener('somnia:sphere-route', event => {
  if (gallery) gallery.setDocked(event.detail.docked, event.detail);
  else scene.toggleAttribute('data-docked', event.detail.docked);
  sync();
});
document.addEventListener('somnia:navigate', () => queueMicrotask(sync));
document.addEventListener('somnia:motion-change', sync);
document.addEventListener('somnia:sphere-restored', sync);
preference.addEventListener('change', sync);
document.addEventListener('visibilitychange', sync);

// A usable poster gallery when WebGL is unavailable.
function showFallback() {
  canvas.hidden = true;
  const list = document.createElement('div');
  list.className = 'dream-sphere-fallback';
  dreams.forEach((dream, index) => {
    const poster = document.createElement('div');
    const image = document.createElement('img');
    image.src = dream.poster; image.alt = 'Сон ' + (index + 1); image.loading = 'lazy';
    poster.append(image); list.append(poster);
  });
  scene.prepend(list);
}
scene.toggleAttribute('data-docked', root.dataset.page === 'settings');
sync();
