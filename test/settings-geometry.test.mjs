import test from 'node:test';
import assert from 'node:assert/strict';
import { arcPoints, nearestCardIndex } from '../settings-geometry.js';

test('arc retains the two Figma anchors and divides the curved distance evenly', () => {
  for (const [rx, ry] of [[267, 277], [136, 136], [100, 160]]) {
    const points = arcPoints(rx, ry);
    assert.deepEqual(points[0], { x: 0, y: -1 });
    assert.deepEqual(points[4], { x: -1, y: 0 });
    const lengths = [];
    for (let index = 1; index < points.length; index++) {
      const start = Math.atan2(-points[index - 1].x, -points[index - 1].y);
      const end = Math.atan2(-points[index].x, -points[index].y);
      let length = 0;
      for (let step = 0; step < 200; step++) {
        const angle = start + (end - start) * (step + .5) / 200;
        length += Math.hypot(rx * Math.cos(angle), ry * Math.sin(angle)) * (end - start) / 200;
      }
      lengths.push(length);
    }
    assert.ok(Math.max(...lengths) - Math.min(...lengths) < .001);
  }
});

test('selection follows the closest card center, including gaps and unequal heights', () => {
  const cards = [{ top: 505, height: 317 }, { top: 834, height: 176 }, { top: 1022, height: 414 }];
  const atScroll = scroll => cards.map(card => ({ ...card, top: card.top - scroll }));
  assert.equal(nearestCardIndex(atScroll(0), 505), 0);
  assert.equal(nearestCardIndex(atScroll(417), 505), 1);
  assert.equal(nearestCardIndex(atScroll(724), 505), 2);
  assert.equal(nearestCardIndex(atScroll(323), 505), 1);
  assert.equal(nearestCardIndex(atScroll(2000), 505), 2);
});
