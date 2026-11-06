import { initialGallerySettings } from '../../orb-config.js';

let settings = { ...initialGallerySettings };
const listeners = new Set();

export function configureGalleryAppearance(value) {
  settings = { ...value };
  for (const listener of listeners) listener({ ...settings });
}

export function subscribeGalleryAppearance(listener) {
  listeners.add(listener);
  listener({ ...settings });
  return () => listeners.delete(listener);
}
