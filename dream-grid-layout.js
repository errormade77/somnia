// Both grid variants use the same 415 px design space.
export function dreamGridLayout(rows, indices, dreamCount = 10) {
  const large = Boolean(indices);
  const gap = 24;
  const size = large ? (415 - gap) / 2 : 50;
  const center = large ? 207.5 : 208;
  const height = rows.length * size + (rows.length - 1) * gap;
  const cells = [];
  for (const [row, { count }] of rows.entries()) {
    const width = count * size + (count - 1) * gap;
    for (let column = 0; column < count; column++) {
      const index = cells.length;
      const x = center - width / 2 + column * (size + gap);
      const y = center - height / 2 + row * (size + gap);
      cells.push({ x, y, size, dream: indices ? indices[index % indices.length] : index % dreamCount, index });
    }
  }
  return cells;
}

export const retentionTiming = { duration: 7200, hold: 900, disappearSpan: 4300, fade: 420, restore: 5600, restoreDuration: 650 };

export function retentionOpacity(elapsed, index, count) {
  const { duration, hold, disappearSpan, fade, restore, restoreDuration } = retentionTiming;
  const time = ((elapsed % duration) + duration) % duration;
  const begin = hold + (count === 1 ? 1 : index / (count - 1)) * (disappearSpan - fade);
  const ease = value => (1 - Math.cos(Math.PI * Math.max(0, Math.min(1, value)))) / 2;
  if (time < begin) return 1;
  if (time < begin + fade) return 1 - ease((time - begin) / fade);
  if (time < restore) return 0;
  return ease((time - restore) / restoreDuration);
}
