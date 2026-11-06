import test from 'node:test';
import assert from 'node:assert/strict';
import { sphereFlightPose, sphereFlightDuration } from '../sphere-flight.js';

const near = (actual, expected, epsilon = 1e-8) => assert.ok(
  Math.abs(actual - expected) < epsilon, String(actual) + ' != ' + String(expected));

test('flights land exactly on the endpoints and clamp time without mutating poses', () => {
  const from = Object.freeze({ x: 67.5, y: 932.5, diameter: 111 });
  const to = Object.freeze({ x: 720, y: 493, diameter: 415 });
  for (const expanding of [true, false]) for (const bend of [-1, 1]) {
    for (const time of [-Infinity, -1, 0]) {
      assert.deepEqual(sphereFlightPose(from, to, time, { expanding, bend }), from);
    }
    for (const time of [1, 2, Infinity]) {
      assert.deepEqual(sphereFlightPose(from, to, time, { expanding, bend }), to);
    }
  }
  assert.equal(sphereFlightDuration(true), 920);
  assert.equal(sphereFlightDuration(false), 820);
});

test('motion stays finite for horizontal, vertical, diagonal, and same-centre flights', () => {
  for (const [from, to] of [
    [{ x: 0, y: 0, diameter: 111 }, { x: 1440, y: 900, diameter: 700 }],
    [{ x: 20, y: 0, diameter: 800 }, { x: 20, y: 800, diameter: 111 }],
    [{ x: 0, y: 50, diameter: 50 }, { x: 800, y: 50, diameter: 200 }],
    [{ x: 200, y: 200, diameter: 1 }, { x: 200, y: 200, diameter: 1000 }],
    [{ x: 200, y: 200, diameter: 1000 }, { x: 200, y: 200, diameter: 1 }],
  ]) {
    for (const expanding of [true, false]) for (const bend of [-1, 1]) {
      for (let sample = 0; sample <= 200; sample++) {
        const pose = sphereFlightPose(from, to, sample / 200, { expanding, bend });
        assert.ok(Object.values(pose).every(Number.isFinite));
        assert.ok(pose.diameter >= 0);
      }
    }
  }
});

test('opposite bends mirror the original arc across the path without changing its scale', () => {
  const from = { x: 70, y: 800, diameter: 111 };
  const to = { x: 720, y: 450, diameter: 415 };
  const dx = to.x - from.x, dy = to.y - from.y;
  const cross = pose => dx * (pose.y - from.y) - dy * (pose.x - from.x);
  const dot = pose => dx * (pose.x - from.x) + dy * (pose.y - from.y);
  for (const expanding of [true, false]) {
    for (const time of [.05, .15, .3, .5, .8, .95]) {
      const original = sphereFlightPose(from, to, time, { expanding, bend: -1 });
      const mirrored = sphereFlightPose(from, to, time, { expanding, bend: 1 });
      near(cross(original), -cross(mirrored));
      near(dot(original), dot(mirrored));
      assert.equal(original.diameter, mirrored.diameter);
    }
    const original = sphereFlightPose(from, to, .15, { expanding, bend: -1 });
    const mirrored = sphereFlightPose(from, to, .15, { expanding, bend: 1 });
    assert.ok(cross(original) * cross(mirrored) < 0);
    assert.ok(Math.hypot(original.x - mirrored.x, original.y - mirrored.y) > 30);
  }
});

test('scale starts gently, retains the existing spring overshoot, and settles continuously', () => {
  const from = { x: 70, y: 800, diameter: 111 };
  const to = { x: 720, y: 450, diameter: 415 };
  assert.equal(sphereFlightPose(from, to, .035).diameter, 111);
  assert.ok(sphereFlightPose(from, to, .1).diameter > 111);
  assert.ok(sphereFlightPose(from, to, .45).diameter > 415);
  const almostDone = sphereFlightPose(from, to, 1 - 1e-7);
  near(almostDone.x, to.x, .001);
  near(almostDone.y, to.y, .001);
  near(almostDone.diameter, to.diameter, .001);
  const shrinking = sphereFlightPose(to, from, .2, { expanding: false });
  assert.ok(shrinking.diameter < 415 && shrinking.diameter > 111);
});
