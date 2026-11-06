// Shared screen-space flight for the device and the dream gallery.
// The default bend preserves the device's existing trajectory and spring.
function springProgress(time, damping, frequency) {
  const response = value => 1 - Math.exp(-damping * value) * (
    Math.cos(frequency * value) + damping / frequency * Math.sin(frequency * value)
  );
  return response(time) / response(1);
}

export function sphereFlightDuration(entering) {
  return entering ? 920 : 820;
}

export function sphereFlightPose(from, to, time, { expanding = true, bend = -1 } = {}) {
  const progress = Math.min(1, Math.max(0, Number.isNaN(time) ? 0 : time));
  if (progress === 0) return { x: from.x, y: from.y, diameter: from.diameter };
  if (progress === 1) return { x: to.x, y: to.y, diameter: to.diameter };

  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy);
  const lift = Math.min(120, Math.max(32, distance * .12));
  const first = expanding
    ? { x: from.x + dx * .15, y: from.y + dy * .72 - lift }
    : { x: from.x + dx * .18, y: from.y - lift * .18 };
  const second = expanding
    ? { x: to.x - dx * .18, y: to.y - lift * .18 }
    : { x: to.x - dx * .15, y: to.y - dy * .72 - lift };

  // Mirror the deviation across the line joining the two centres. Using that
  // line instead of the screen's Y axis also separates vertical/diagonal swaps.
  const ux = distance ? dx / distance : 1;
  const uy = distance ? dy / distance : 0;
  const control = point => {
    if (bend === -1) return point;
    const projection = (point.x - from.x) * ux + (point.y - from.y) * uy;
    const baseline = { x: from.x + projection * ux, y: from.y + projection * uy };
    return {
      x: baseline.x - bend * (point.x - baseline.x),
      y: baseline.y - bend * (point.y - baseline.y),
    };
  };
  const a = control(first);
  const b = control(second);
  const travel = springProgress(progress, 7.5, 5);
  const rest = 1 - travel;
  const coordinate = key => rest ** 3 * from[key]
    + 3 * rest ** 2 * travel * a[key]
    + 3 * rest * travel ** 2 * b[key]
    + travel ** 3 * to[key];
  const growth = springProgress(Math.max(0, (progress - .035) / .965),
    expanding ? 7 : 8.8, expanding ? 8 : 7);
  return {
    x: coordinate('x'),
    y: coordinate('y'),
    // Extremely large shrink ratios must not turn the sphere inside out.
    diameter: Math.max(0, from.diameter + (to.diameter - from.diameter) * growth),
  };
}
