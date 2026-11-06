import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sphereConfig, spherePoints, sphereItemScale, wheelZoom,
  baseAutoVelocity, advanceSphereMotion, sphereDiameter, zoomToScroll, scrollToZoom,
} from '../dream-sphere-geometry.js';

const close = (actual, expected, epsilon = 1e-10) => assert.ok(
  Math.abs(actual - expected) < epsilon, String(actual) + ' differs from ' + String(expected));

test('demo geometry preserves 49 cards, both poles, and the responsive radius', () => {
  for (const [width, radius] of [[1440, 5], [800, 5], [799.98, 2.2], [390, 2.2]]) {
    const config = sphereConfig(width);
    assert.equal(config.itemCount, 49);
    assert.equal(config.radius, radius);
    const points = spherePoints(config.itemCount, config.radius);
    assert.equal(points.length, 49);
    assert.equal(points[0].y, radius);
    assert.equal(points.at(-1).y, -radius);
    assert.equal(points[24].y, 0);
    for (const point of points) close(Math.hypot(point.x, point.y, point.z), radius);
    close(points.reduce((total, point) => total + point.y, 0), 0);
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    close(points[24].x, Math.cos(goldenAngle * 24) * radius);
    close(points[24].z, Math.sin(goldenAngle * 24) * radius);
  }
});

test('site scroll pixels map to sphere diameter without changing camera bounds', () => {
  for (const [radius, height] of [[5, 1000], [2.2, 844]]) {
    for (const zoom of [radius + 2, 15, 25, 40]) {
      close(scrollToZoom(zoomToScroll(zoom, radius, height), radius, height), zoom);
    }
    const initial = zoomToScroll(15, radius, height);
    const zoomed = scrollToZoom(initial + 100, radius, height);
    close(sphereDiameter(15, radius, height) - sphereDiameter(zoomed, radius, height), 100);
    close(scrollToZoom(-100000, radius, height), radius + 2);
    close(scrollToZoom(100000, radius, height), 40);
  }
});

test('card dimensions follow original sphere coverage and gap', () => {
  const desktop = sphereConfig(1440);
  const mobile = sphereConfig(390);
  const size = sphereItemScale(desktop.itemCount, desktop.radius, desktop.gap);
  close(size, Math.sqrt(100 * Math.PI / 49) * .366);
  close(sphereItemScale(49, mobile.radius, mobile.gap), size * 2.2 / 5);
  close(sphereItemScale(196, 5, 73), size / 2);
  assert.ok(sphereItemScale(49, 5, 100) < size);
  assert.equal(sphereItemScale(1, 1000, 0), 10);
  assert.equal(sphereItemScale(100000, .01, 100), .05);
});

test('wheel input zooms the camera with the demo curve and limits', () => {
  close(wheelZoom(15, 100, 0, 5, 15), 15.2025);
  close(wheelZoom(15, -100, 0, 5, 15), 14.7975);
  close(wheelZoom(15, 3, 1, 5, 15), wheelZoom(15, 80, 0, 5, 15));
  assert.equal(wheelZoom(15, -100000, 0, 5, 15), 7);
  assert.equal(wheelZoom(15, -100000, 0, 2.2, 15), 4.2);
  assert.equal(wheelZoom(15, 100000, 0, 5, 15), 40);
  assert.equal(wheelZoom(15, 100, 0, 5, 0), 15);
  close(wheelZoom(15, 100, 0, 5, 30) - 15, (wheelZoom(15, 100, 0, 5, 15) - 15) * 8);
});

test('one frame rotates first, then damps velocity and interpolates zoom', () => {
  const state = {
    rotation: { x: 1, y: 2 }, velocity: { x: .1, y: .2 },
    currentZoom: 25, targetZoom: 15,
  };
  assert.equal(advanceSphereMotion(state, { autoVelocity: .01 }), state);
  close(state.rotation.x, 1.1);
  close(state.rotation.y, 2.2);
  close(state.velocity.x, .092);
  close(state.velocity.y, .1905);
  close(state.currentZoom, 24.6);
  const draggingVelocity = { ...state.velocity };
  advanceSphereMotion(state, { pointerDown: true, autoVelocity: .01 });
  assert.deepEqual(state.velocity, draggingVelocity);
  close(state.currentZoom, 24.216);
});

test('released motion converges to the exact auto-spin and camera target', () => {
  const config = sphereConfig(1440);
  const autoVelocity = baseAutoVelocity(config);
  close(autoVelocity * 200 * 60, Math.PI * 2);
  assert.equal(baseAutoVelocity({ ...config, autoRotation: false }), 0);
  const state = {
    rotation: { x: 0, y: 0 }, velocity: { x: -.07, y: .15 },
    currentZoom: 25, targetZoom: 15,
  };
  let previousZoom = state.currentZoom;
  for (let frame = 0; frame < 700; frame++) {
    advanceSphereMotion(state, { autoVelocity });
    assert.ok(state.currentZoom <= previousZoom && state.currentZoom >= 15);
    previousZoom = state.currentZoom;
  }
  close(state.velocity.x, 0);
  close(state.velocity.y, autoVelocity);
  close(state.currentZoom, 15);
  close(state.rotation.x, -.07 / (1 - .92));
});
