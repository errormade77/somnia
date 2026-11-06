import test from 'node:test';
import assert from 'node:assert/strict';
import { createScrollMotion, configureScroll, subscribeScrollSettings, wheelPixels } from '../smooth-scroll.js';
import { initialScrollSettings } from '../orb-config.js';

function harness() {
  let position = 0, time = 0, id = 0, interrupted = 0;
  const frames = new Map();
  const motion = createScrollMotion({
    read: () => position, write: value => { position = value; }, limit: () => 1500,
    requestFrame: callback => { frames.set(++id, callback); return id; },
    cancelFrame: key => frames.delete(key), now: () => time,
    onInterrupt: () => interrupted++,
  });
  return {
    motion,
    get position() { return position; }, get pending() { return frames.size; },
    get interrupted() { return interrupted; },
    nativeScroll(value) { position = value; },
    advance(duration, step = 1000 / 60) {
      const end = time + duration;
      while (time < end) {
        time = Math.min(end, time + step);
        const callbacks = [...frames.values()]; frames.clear();
        callbacks.forEach(callback => callback(time));
      }
    },
  };
}

test('scroll damping is frame-rate independent and lands exactly on the centered destination', () => {
  const a = harness(), b = harness();
  a.motion.to(1200.5); b.motion.to(1200.5);
  a.advance(400, 1000 / 60); b.advance(400, 1000 / 120);
  assert.ok(a.position > 0 && a.position < 1200.5);
  assert.ok(Math.abs(a.position - b.position) < .001);
  a.advance(2000); b.advance(2000);
  assert.equal(a.position, 1200.5);
  assert.equal(b.position, 1200.5);
  assert.equal(a.pending, 0);
});

test('wheel input accumulates, reverses immediately, and stays within document bounds', () => {
  const h = harness();
  h.motion.by(200); h.motion.by(200); h.advance(2000);
  assert.equal(h.position, 400);
  h.motion.by(1000); h.advance(80);
  const before = h.position;
  h.motion.by(-100); h.advance(16);
  assert.ok(h.position < before);
  h.motion.by(10000); h.advance(2500);
  assert.equal(h.position, 1500);
  h.motion.by(-10000); h.advance(2500);
  assert.equal(h.position, 0);
});

test('speed and smoothness change the response; disabling stops pending movement', () => {
  const a = harness(), b = harness(), c = harness();
  b.motion.configure({ ...initialScrollSettings, speed: 2 });
  c.motion.configure({ ...initialScrollSettings, smoothness: .4 });
  for (const h of [a,b,c]) { h.motion.by(400); h.advance(100); }
  assert.ok(b.position > a.position && a.position > c.position);
  a.motion.configure({ ...initialScrollSettings, enabled: false });
  const stopped = a.position; a.advance(2000);
  assert.equal(a.position, stopped);
  assert.equal(a.pending, 0);
  a.motion.to(900); assert.equal(a.position, 900);
});

test('native scrolling and route cancellation cannot be overwritten by old animation frames', () => {
  const h = harness();
  h.motion.to(1400); h.advance(100);
  h.nativeScroll(75); h.advance(1000);
  assert.equal(h.position, 75); assert.equal(h.interrupted, 1);
  h.motion.to(1000); h.advance(100); h.motion.stop(); h.nativeScroll(0);
  h.advance(1000); assert.equal(h.position, 0); assert.equal(h.pending, 0);
});

test('scroll settings subscribers receive immediate snapshots, changes, and can unsubscribe', () => {
  let original;
  subscribeScrollSettings(settings => { original = settings; })();
  const received = [];
  const unsubscribe = subscribeScrollSettings(settings => received.push(settings));
  try {
    assert.deepEqual(received, [original]);
    const updated = { ...original, speed: 1.7, smoothness: .24 };
    configureScroll(updated);
    assert.deepEqual(received[1], updated);
    assert.notEqual(received[1], updated);
    updated.speed = 99;
    received[1].smoothness = 99;
    let snapshot;
    subscribeScrollSettings(settings => { snapshot = settings; })();
    assert.equal(snapshot.speed, 1.7);
    assert.equal(snapshot.smoothness, .24);
    unsubscribe();
    configureScroll({ ...original, enabled: false });
    assert.equal(received.length, 2);
  } finally {
    unsubscribe();
    configureScroll(original);
  }
});

test('one subscriber cannot mutate the settings delivered to another subscriber', () => {
  const original = { ...initialScrollSettings };
  const unsubscribeFirst = subscribeScrollSettings(settings => { settings.speed = 999; });
  let second;
  const unsubscribeSecond = subscribeScrollSettings(settings => { second = settings; });
  try {
    configureScroll({ ...original, speed: 1.25 });
    assert.equal(second.speed, 1.25);
  } finally {
    unsubscribeFirst(); unsubscribeSecond();
    configureScroll(original);
  }
});

test('wheel deltas use the same pixel distance for pixels, lines, and pages', () => {
  assert.equal(wheelPixels({ deltaY: 120, deltaMode: 0 }, 900), 120);
  assert.equal(wheelPixels({ deltaY: -3, deltaMode: 1 }, 900), -48);
  assert.equal(wheelPixels({ deltaY: 1, deltaMode: 2 }, 900), 900);
  assert.equal(wheelPixels({ deltaY: -.5, deltaMode: 2 }, 844), -422);
  assert.equal(wheelPixels({ deltaY: 0, deltaMode: 0 }, 900), 0);
});
