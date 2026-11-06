import test from 'node:test';
import assert from 'node:assert/strict';
import { createOrbRefraction } from '../orb-refraction.js';

test('persistent scene lenses retain matte and cached frames across routes, leaving graphics outside', t => {
  const nodes = [];
  const listeners = new Map();
  const observers = [];
  const root = { dataset: { page: 'settings' } };
  function makeNode(tag = 'div', className = '') {
    const node = {
      tag, className, children: [], dataset: {}, style: { filter: '' }, attributes: {}, parentElement: null,
      setAttribute(key, value) { this.attributes[key] = value; },
      append(...children) {
        for (const child of children) {
          if (child.parentElement) {
            const siblings = child.parentElement.children;
            siblings.splice(siblings.indexOf(child), 1);
          }
          child.parentElement = this;
          this.children.push(child);
        }
      },
      contains(target) { return this === target || this.children.some(child => child.contains(target)); },
    };
    node.classList = { contains: value => node.className.split(' ').includes(value) };
    nodes.push(node);
    return node;
  }
  const preview = makeNode('div', 'device-preview');
  preview.dataset.active = 'storage';
  const scenes = ['home', 'storage', 'gesture', 'style', 'saving'].map(mode => {
    const scene = makeNode('div', `${mode}-preview`);
    const content = makeNode('div', 'refracted-content');
    const graphic = mode === 'style' ? null : makeNode('div', `${mode}-graphic`);
    scene.append(content);
    if (graphic) scene.append(graphic);
    preview.append(scene);
    return { scene, content, graphic };
  });
  let image;
  let resize;
  const mocks = {
    document: {
      documentElement: root, body: { append() {} }, querySelector: () => ({}),
      createElement: tag => makeNode(tag),
      createElementNS: (_, tag) => makeNode(tag),
      addEventListener(type, callback) { listeners.set(type, callback); },
    },
    getComputedStyle: () => ({ getPropertyValue: key => ({ '--orb-glass-strength': '1', '--orb-matte': '70' }[key] || '') }),
    ResizeObserver: class { constructor(callback) { resize = callback; } observe() {} },
    MutationObserver: class { constructor(callback) { observers.push(callback); } observe() {} },
    Image: class { constructor() { image = this; } },
  };
  const originals = Object.keys(mocks).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]);
  for (const [key, value] of Object.entries(mocks)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  t.after(() => {
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });

  createOrbRefraction(preview);
  const media = preview.children.find(node => node.className === 'device-media');
  const overlays = preview.children.find(node => node.className === 'device-overlays');
  assert.ok(media && overlays);
  assert.equal(media.children.length, 5);
  for (const { scene, content, graphic } of scenes) {
    // Existing controller references still point to the same live media nodes.
    assert.equal(scene.parentElement, media);
    assert.equal(content.parentElement, scene);
    if (graphic) {
      assert.ok(overlays.contains(graphic));
      assert.ok(!media.contains(graphic));
    }
  }
  resize([{ contentRect: { width: 415 } }]);
  image.onload();
  const blur = nodes.find(node => node.tag === 'feGaussianBlur');
  const originalBlur = blur.attributes.stdDeviation;
  assert.ok(Number(originalBlur) > 0);
  // Rapid changes can leave several scenes partially visible at once.
  for (const mode of ['gesture', 'style', 'saving', 'retention', 'storage', 'home']) {
    root.dataset.page = mode === 'home' ? 'home' : 'settings';
    preview.dataset.active = mode;
    observers.forEach(callback => callback());
    assert.equal(media.style.filter, '');
    assert.equal(nodes.filter(node => node.style.filter).length, scenes.length);
    scenes.forEach(({ content, graphic }) => {
      assert.equal(content.style.filter, 'url(#orb-content-refraction)');
      if (graphic) assert.equal(graphic.style.filter, '');
    });
    assert.equal(blur.attributes.stdDeviation, originalBlur);
  }
  // Flying crossfades cached, paused scene frames outside the lens. A rapid
  // reversal keeps the same matte value, with no unfiltered or doubled layer.
  for (const direction of ['expand', 'collapse', 'expand']) {
    root.dataset.deviceFlight = direction;
    listeners.get('somnia:device-flight')?.();
    assert.equal(media.style.filter, '');
    scenes.forEach(({ content, graphic }) => {
      assert.equal(content.style.filter, 'url(#orb-content-refraction)');
      if (graphic) assert.ok(!content.contains(graphic));
    });
    assert.equal(blur.attributes.stdDeviation, originalBlur);
  }
  delete root.dataset.deviceFlight;
  listeners.get('somnia:device-flight')?.();
  assert.equal(media.style.filter, '');
  assert.equal(nodes.filter(node => node.style.filter).length, scenes.length);
  // A deliberate surface-setting change still removes or reapplies the glass.
  listeners.get('somnia:motion-change')({ detail: { glass: 0, matte: 0 } });
  assert.equal(media.style.filter, '');
  assert.equal(Number(blur.attributes.stdDeviation), 0);
  scenes.forEach(({ content }) => assert.equal(content.style.filter, ''));
  listeners.get('somnia:motion-change')({ detail: { glass: 0, matte: 70 } });
  assert.equal(media.style.filter, '');
  assert.equal(nodes.filter(node => node.style.filter).length, scenes.length);
  assert.equal(blur.attributes.stdDeviation, originalBlur);
});
