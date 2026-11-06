// A quarter ellipse preserves both Figma endpoints, whose radii differ by 10 px.
// Sampling by arc length keeps the three intermediate buttons evenly spaced.
export function arcPoints(radiusX, radiusY, count = 5) {
  const steps = 512;
  const samples = [{ angle: 0, length: 0 }];
  let previous = { x: 0, y: -radiusY };
  for (let i = 1; i <= steps; i++) {
    const angle = i / steps * Math.PI / 2;
    const point = { x: -radiusX * Math.sin(angle), y: -radiusY * Math.cos(angle) };
    samples.push({ angle, length: samples[i - 1].length + Math.hypot(point.x - previous.x, point.y - previous.y) });
    previous = point;
  }
  return Array.from({ length: count }, (_, index) => {
    if (index === 0) return { x: 0, y: -1 };
    if (index === count - 1) return { x: -1, y: 0 };
    const distance = samples[steps].length * index / (count - 1);
    const upper = samples.findIndex(sample => sample.length >= distance);
    const before = samples[upper - 1];
    const after = samples[upper];
    const angle = before.angle + (after.angle - before.angle) * (distance - before.length) / (after.length - before.length);
    return { x: -Math.sin(angle), y: -Math.cos(angle) };
  });
}

export function nearestCardIndex(rectangles, axis) {
  let nearest = 0;
  let distance = Infinity;
  rectangles.forEach((rect, index) => {
    const next = Math.abs(rect.top + rect.height / 2 - axis);
    if (next < distance) { distance = next; nearest = index; }
  });
  return nearest;
}
