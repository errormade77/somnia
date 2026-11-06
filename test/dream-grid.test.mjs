import test from 'node:test';
import assert from 'node:assert/strict';
import { dreamGridLayout, retentionOpacity, retentionTiming } from '../dream-grid-layout.js';

test('storage keeps 37 dreams, alternating centered rows and 24px gutters', () => {
  const rows = [7, 8, 7, 8, 7].map(count => ({ count }));
  const cells = dreamGridLayout(rows);
  assert.equal(cells.length, 37);
  let start = 0;
  for (const { count } of rows) {
    const row = cells.slice(start, start + count);
    assert.equal((row[0].x + row.at(-1).x + 50) / 2, 208);
    for (let i = 1; i < count; i++) assert.equal(row[i].x - row[i - 1].x, 74);
    start += count;
  }
  assert.deepEqual(cells.map(cell => cell.dream), Array.from({ length: 37 }, (_, i) => i % 10));
  assert.equal(cells[0].y, 35);
  assert.equal(cells.at(-1).y + 50, 381);
});

test('four-dream grid fills the 415px sphere with the original gutters', () => {
  const cells = dreamGridLayout([{ count: 2 }, { count: 2 }], [0, 5, 7, 9]);
  assert.deepEqual(cells.map(({ x, y, size, dream }) => ({ x, y, size, dream })), [
    { x: 0, y: 0, size: 195.5, dream: 0 },
    { x: 219.5, y: 0, size: 195.5, dream: 5 },
    { x: 0, y: 219.5, size: 195.5, dream: 7 },
    { x: 219.5, y: 219.5, size: 195.5, dream: 9 },
  ]);
});

test('retention fades in order, holds empty, restores and loops without a jump', () => {
  for (let i = 0; i < 37; i++) {
    assert.equal(retentionOpacity(0, i, 37), 1);
    assert.equal(retentionOpacity(5500, i, 37), 0);
    assert.equal(retentionOpacity(6250, i, 37), 1);
    assert.equal(retentionOpacity(retentionTiming.duration, i, 37), 1);
    assert.ok(Math.abs(retentionOpacity(5925, i, 37) - .5) < 1e-10);
  }
  assert.equal(retentionOpacity(1400, 0, 37), 0);
  assert.equal(retentionOpacity(1400, 36, 37), 1);
  for (let time = 0; time < 7200; time += 37) {
    const values = Array.from({ length: 37 }, (_, i) => retentionOpacity(time, i, 37));
    assert.ok(values.every(value => value >= 0 && value <= 1));
    assert.ok(values.every((value, i) => !i || value >= values[i - 1]));
  }
});
