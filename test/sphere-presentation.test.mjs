import test from 'node:test';
import assert from 'node:assert/strict';
import { PerspectiveCamera, Vector3, Matrix4 } from '../assets/sphere-gallery/three.js';
import { createSpherePresentation } from '../assets/sphere-gallery/presentation.js';
import { sphereDiameter } from '../dream-sphere-geometry.js';

const near = (actual, expected, epsilon = 1e-8) => assert.ok(
  Math.abs(actual - expected) < epsilon, String(actual) + ' differs from ' + String(expected));
const nearMatrix = (actual, expected) => actual.forEach((value, index) => near(value, expected[index]));

function fixture(t, { docked = false, zoom = 15 } = {}) {
  const originals = new Map(['innerWidth', 'innerHeight', 'devicePixelRatio', 'performance']
    .map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  let time = 0;
  for (const [key, value] of Object.entries({ innerWidth: 1440, innerHeight: 1000, devicePixelRatio: 2,
    performance: { now: () => time } })) {
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  t.after(() => {
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  const attributes = new Set();
  const canvasAttributes = new Map();
  const host = { toggleAttribute(name, enabled) { enabled ? attributes.add(name) : attributes.delete(name); } };
  const canvas = { parentElement: host, tabIndex: 0,
    setAttribute(name, value) { canvasAttributes.set(name, value); } };
  const sizes = [];
  const renderer = {
    pixelRatio: 1, width: 0, height: 0,
    viewport: { x: 0, y: 0, width: 0, height: 0 },
    scissor: { x: 0, y: 0, width: 0, height: 0 },
    scissorTest: false,
    setPixelRatio(value) { this.pixelRatio = value; },
    setSize(width, height, updateStyle) {
      this.width = width; this.height = height;
      sizes.push({ width, height, updateStyle });
    },
    setViewport(x, y, width, height) { this.viewport = { x, y, width, height }; },
    setScissor(x, y, width, height) { this.scissor = { x, y, width, height }; },
    setScissorTest(enabled) { this.scissorTest = enabled; },
  };
  const camera = new PerspectiveCamera(45, 1440 / 1000, .1, 1000);
  camera.position.z = zoom;
  const radius = 5;
  const presentation = createSpherePresentation(canvas, camera, renderer, {
    docked, getDiameter: height => sphereDiameter(camera.position.z, radius, height), onChange() {},
  });
  presentation.resize();
  return {
    presentation, camera, renderer, canvas, attributes, canvasAttributes, sizes,
    project(nextTime = time) { time = nextTime; presentation.project(time); camera.updateMatrixWorld(); },
    screenCenter() {
      const ndc = new Vector3(0, 0, 0).project(camera);
      return { x: (ndc.x + 1) * renderer.viewport.width / 2, y: (1 - ndc.y) * renderer.viewport.height / 2 };
    },
    resize(width, height) { globalThis.innerWidth = width; globalThis.innerHeight = height; presentation.resize(); },
  };
}

test('home projection equals the original camera and keeps its stored distance', t => {
  const h = fixture(t, { zoom: 8.5 });
  h.project();
  const expected = new PerspectiveCamera(45, 1.44, .1, 1000);
  nearMatrix(h.camera.projectionMatrix.elements, expected.projectionMatrix.elements);
  assert.equal(h.camera.zoom, 1);
  assert.equal(h.camera.position.z, 8.5);
  assert.deepEqual(h.screenCenter(), { x: 720, y: 500 });
  assert.deepEqual(h.sizes, [{ width: 1440, height: 1000, updateStyle: false }]);
  assert.deepEqual(h.renderer.viewport, { x: 0, y: 0, width: 1440, height: 1000 });
  assert.deepEqual(h.renderer.scissor, h.renderer.viewport);
  assert.equal(h.presentation.interactive, true);
  assert.equal(h.canvas.tabIndex, 0);
  assert.equal(h.canvasAttributes.get('aria-hidden'), 'false');
});

test('docking uses a 111px viewport in the stable full-size buffer', t => {
  const h = fixture(t, { zoom: 9 });
  h.project();
  h.presentation.setDocked(true, { animate: false });
  h.project();
  assert.equal(h.renderer.width, 1440);
  assert.equal(h.renderer.height, 1000);
  assert.deepEqual(h.renderer.viewport, { x: 0, y: 889, width: 111, height: 111 });
  assert.deepEqual(h.renderer.scissor, h.renderer.viewport);
  assert.equal(h.renderer.scissorTest, true);
  assert.equal(h.renderer.pixelRatio, 1.5);
  assert.deepEqual(h.screenCenter(), { x: 55.5, y: 55.5 });
  assert.equal(h.camera.position.z, 9);
  assert.equal(h.attributes.has('data-docked'), true);
  assert.equal(h.attributes.has('data-flight'), false);
  assert.equal(h.presentation.interactive, false);
  assert.equal(h.canvas.tabIndex, -1);
  const identity = new Matrix4().multiplyMatrices(h.camera.projectionMatrix, h.camera.projectionMatrixInverse);
  nearMatrix(identity.elements, new Matrix4().elements);
  h.presentation.setDocked(false, { animate: false });
  h.project();
  assert.equal(h.camera.zoom, 1);
  assert.equal(h.camera.position.z, 9);
  assert.deepEqual(h.renderer.viewport, { x: 0, y: 0, width: 1440, height: 1000 });
  assert.equal(h.sizes.length, 1);
});

test('reversing mid-flight preserves the current projection and lands at home', t => {
  const h = fixture(t, { zoom: 12 });
  h.project();
  h.presentation.setDocked(true);
  h.project(280);
  const before = [...h.camera.projectionMatrix.elements];
  assert.equal(h.presentation.animating, true);
  assert.equal(h.presentation.interactive, false);
  assert.equal(h.attributes.has('data-flight'), true);
  h.presentation.setDocked(false);
  h.project(280);
  nearMatrix(h.camera.projectionMatrix.elements, before);
  h.project(1100);
  assert.equal(h.presentation.animating, false);
  assert.equal(h.presentation.interactive, true);
  assert.equal(h.attributes.has('data-flight'), false);
  assert.equal(h.attributes.has('data-docked'), false);
  assert.equal(h.renderer.width, 1440);
  assert.deepEqual(h.renderer.viewport, { x: 0, y: 0, width: 1440, height: 1000 });
  assert.equal(h.camera.zoom, 1);
  assert.equal(h.camera.position.z, 12);
  assert.deepEqual(h.screenCenter(), { x: 720, y: 500 });
  // The full viewport is retained throughout both paths; no per-frame buffer resize.
  assert.equal(h.sizes.length, 1);
});

test('resize during a flight settles at the new dock without changing scene distance', t => {
  const h = fixture(t, { zoom: 7 });
  h.project();
  h.presentation.setDocked(true);
  h.project(200);
  h.resize(390, 844);
  h.project(200);
  const size = 111 * (390 - 24) / 406;
  assert.equal(h.renderer.width, 390);
  assert.equal(h.renderer.height, 844);
  near(h.renderer.viewport.width, size);
  near(h.renderer.viewport.height, size);
  near(h.renderer.viewport.y, 844 - size);
  assert.deepEqual(h.renderer.scissor, h.renderer.viewport);
  near(h.screenCenter().x, size / 2);
  near(h.screenCenter().y, size / 2);
  assert.equal(h.camera.position.z, 7);
  assert.equal(h.presentation.animating, false);
  assert.equal(h.attributes.has('data-docked'), true);
  h.presentation.setDocked(false, { animate: false });
  h.project();
  assert.equal(h.renderer.width, 390);
  assert.equal(h.renderer.height, 844);
  assert.equal(h.camera.zoom, 1);
  assert.equal(h.camera.position.z, 7);
  assert.deepEqual(h.screenCenter(), { x: 195, y: 422 });
  // Only the actual browser resize reallocates the render buffer.
  assert.deepEqual(h.sizes, [
    { width: 1440, height: 1000, updateStyle: false },
    { width: 390, height: 844, updateStyle: false },
  ]);
});

test('motion-off settles either destination and direct settings starts in the small frame', t => {
  const h = fixture(t, { docked: true, zoom: 21 });
  h.project();
  assert.deepEqual(h.sizes, [{ width: 1440, height: 1000, updateStyle: false }]);
  assert.deepEqual(h.renderer.viewport, { x: 0, y: 889, width: 111, height: 111 });
  h.presentation.setDocked(false);
  h.project(130);
  h.presentation.settle();
  h.project();
  assert.equal(h.presentation.animating, false);
  assert.equal(h.presentation.interactive, true);
  assert.equal(h.camera.zoom, 1);
  h.presentation.setDocked(true);
  h.project(280);
  h.presentation.setDocked(true, { animate: false });
  h.project();
  assert.equal(h.presentation.animating, false);
  assert.equal(h.renderer.width, 1440);
  assert.equal(h.renderer.viewport.width, 111);
  assert.deepEqual(h.renderer.scissor, h.renderer.viewport);
  assert.equal(h.sizes.length, 1);
  assert.equal(h.canvas.tabIndex, -1);
  assert.equal(h.camera.position.z, 21);
});

function projectedBounds(h) {
  const { x, y } = h.screenCenter();
  const radius = h.camera.zoom * sphereDiameter(h.camera.position.z, 5, h.renderer.height) / 2 + 8;
  return {
    left: Math.max(0, Math.floor(x - radius)),
    top: Math.max(0, Math.floor(y - radius)),
    right: Math.min(h.renderer.width, Math.ceil(x + radius)),
    bottom: Math.min(h.renderer.height, Math.ceil(y + radius)),
  };
}

function unionScissor(first, second, height) {
  const left = Math.min(first.left, second.left), top = Math.min(first.top, second.top);
  const right = Math.max(first.right, second.right), bottom = Math.max(first.bottom, second.bottom);
  return { x: left, y: height - bottom, width: right - left, height: bottom - top };
}

test('flight clears the full first frame, then both old and new sphere footprints', t => {
  const h = fixture(t);
  h.project();
  h.presentation.setDocked(true);
  h.project(0);
  assert.deepEqual(h.renderer.scissor, h.renderer.viewport);
  let previous = projectedBounds(h);
  for (const time of [200, 400, 600, 800]) {
    h.project(time);
    const current = projectedBounds(h);
    assert.deepEqual(h.renderer.scissor, unionScissor(previous, current, 1000));
    assert.deepEqual(h.renderer.viewport, { x: 0, y: 0, width: 1440, height: 1000 });
    previous = current;
  }
  assert.ok(h.renderer.scissor.width * h.renderer.scissor.height < 1440 * 1000 / 5);
  h.project(920);
  assert.equal(h.presentation.animating, false);
  assert.deepEqual(h.renderer.scissor, { x: 0, y: 889, width: 111, height: 111 });
  assert.equal(h.sizes.length, 1);
});

test('reversal invalidates the old scissor and home endpoint clears any flight residue', t => {
  const h = fixture(t, { docked: true });
  h.project();
  h.presentation.setDocked(false);
  h.project(0);
  assert.deepEqual(h.renderer.scissor, { x: 0, y: 0, width: 1440, height: 1000 });
  h.project(160);
  h.presentation.setDocked(true);
  h.project(160);
  assert.deepEqual(h.renderer.scissor, h.renderer.viewport);
  const previous = projectedBounds(h);
  h.project(320);
  assert.deepEqual(h.renderer.scissor, unionScissor(previous, projectedBounds(h), 1000));
  h.presentation.setDocked(false);
  h.project(320);
  assert.deepEqual(h.renderer.scissor, h.renderer.viewport);
  h.project(1140);
  assert.equal(h.presentation.interactive, true);
  assert.equal(h.camera.zoom, 1);
  assert.deepEqual(h.renderer.scissor, { x: 0, y: 0, width: 1440, height: 1000 });
  assert.equal(h.sizes.length, 1);
});

test('flight scissor clamps large zoomed spheres to the stable viewport', t => {
  const h = fixture(t, { zoom: 7 });
  h.project();
  h.presentation.setDocked(true);
  for (const time of [0, 90, 200, 300, 450, 600, 810]) {
    h.project(time);
    const { x, y, width, height } = h.renderer.scissor;
    assert.ok(x >= 0 && y >= 0 && width >= 0 && height >= 0);
    assert.ok(x + width <= 1440 && y + height <= 1000);
  }
  assert.equal(h.camera.position.z, 7);
  assert.equal(h.sizes.length, 1);
});
