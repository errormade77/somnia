import test from 'node:test';
import assert from 'node:assert/strict';
import { storageSphereLayout } from '../dream-storage-sphere.js';

test('storage sphere retains all 49 stable positions and ten shared dream tiles', () => {
  const cells = storageSphereLayout();
  assert.equal(cells.length, 49);
  assert.equal(new Set(cells.map(cell => cell.index)).size, 49);
  assert.equal(new Set(cells.map(cell => cell.dream)).size, 10);
  for (const cell of cells) {
    assert.equal(cell.dream, cell.index % 10);
    for (const key of ['depth', 'x', 'y', 'a', 'b', 'c', 'd']) assert.ok(Number.isFinite(cell[key]));
    assert.ok(Math.hypot(cell.x - 207.5, cell.y - 207.5) <= 205.5 + 1e-8);
  }
  assert.ok(cells.every((cell, index) => !index || cells[index - 1].depth >= cell.depth));
});

test('tangent planes foreshorten at the silhouette and keep perspective depth', () => {
  const cells = storageSphereLayout();
  const aspect = cell => {
    const xx = cell.a * cell.a + cell.b * cell.b;
    const yy = cell.c * cell.c + cell.d * cell.d;
    const xy = cell.a * cell.c + cell.b * cell.d;
    const discriminant = Math.sqrt((xx - yy) ** 2 + 4 * xy * xy);
    return Math.sqrt(Math.max(0, xx + yy - discriminant) / (xx + yy + discriminant));
  };
  const nearCenter = cells.filter(cell => Math.hypot(cell.x - 207.5, cell.y - 207.5) < 80);
  const edge = cells.filter(cell => Math.hypot(cell.x - 207.5, cell.y - 207.5) > 200);
  assert.ok(nearCenter.length >= 2);
  assert.ok(edge.length >= 4);
  assert.ok(nearCenter.every(cell => aspect(cell) > .8));
  assert.ok(edge.every(cell => aspect(cell) < .3));
  const sizes = cells.map(cell => Math.max(Math.hypot(cell.a, cell.b), Math.hypot(cell.c, cell.d)));
  assert.ok(Math.max(...sizes) / Math.min(...sizes) > 1.8);
});
