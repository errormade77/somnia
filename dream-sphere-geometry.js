// Geometry and frame equations from THE DESIGN FUTURIST's SphereGallery3d_v2.
// The original demo has seven CMS items repeated seven times. Keep its 49
// positions; the renderer cycles Somnia's dream videos across those positions.
const goldenAngle = Math.PI * (3 - Math.sqrt(5));

export function sphereConfig(width = 1440) {
  const sphereSize = width < 800 ? 220 : 500;
  return {
    sphereSize,
    radius: sphereSize / 100,
    itemCount: 49,
    repeat: 7,
    gap: 73,
    sensitivity: .7,
    introEnabled: true,
    autoRotation: true,
    autoRotationSpeed: 200,
    scrollEnabled: true,
    scrollSpeed: 15,
    // Original images use 3:4; Somnia's requested circular dreams use 1:1.
    aspectRatio: '1:1',
    fov: 45,
  };
}

export function spherePoints(count = 49, radius = 5) {
  return Array.from({ length: count }, (_, index) => {
    const y = count === 1 ? 1 : 1 - index / (count - 1) * 2;
    const ring = Math.sqrt(1 - y * y);
    const theta = goldenAngle * index;
    return {
      x: Math.cos(theta) * ring * radius,
      y: y * radius,
      z: Math.sin(theta) * ring * radius,
    };
  });
}

export function sphereItemScale(count, radius, gap) {
  const overlapPadding = .95 - gap / 100 * .8;
  return Math.max(.05, Math.min(Math.sqrt(4 * Math.PI * radius ** 2 / (count || 1)) * overlapPadding, 10));
}

export function baseAutoVelocity(config) {
  return config.autoRotation ? Math.PI * 2 / ((config.autoRotationSpeed || 10) * 60) : 0;
}

export function wheelZoom(target, deltaY, deltaMode, radius, speed) {
  const normalizedDelta = deltaY * (deltaMode === 1 ? 40 : 1.5);
  const sensitivity = ((speed ?? 50) / 100) ** 3 * .4;
  return Math.min(Math.max(target + normalizedDelta * sensitivity, radius + 2), 40);
}

// Map the camera onto screen pixels for Somnia's shared scroll controller.
// One scroll pixel changes the sphere's projected diameter by one CSS pixel.
export function sphereDiameter(zoom, radius, height, fov = 45) {
  return height * radius / Math.tan(fov * Math.PI / 360) / Math.sqrt(zoom * zoom - radius * radius);
}
// The updated home layout starts at the device's 415px scale. Only the initial
// camera distance changes; the original gallery geometry and zoom remain intact.
export function initialSphereZoom(config, width, height) {
  const itemSize = sphereItemScale(config.itemCount, config.radius, config.gap);
  const radius = Math.hypot(config.radius, itemSize / Math.SQRT2);
  const diameter = Math.min(415, width - 48, height * .6);
  const projection = height * radius / Math.tan(config.fov * Math.PI / 360) / diameter;
  return Math.max(config.radius + 2, Math.min(40, Math.hypot(radius, projection)));
}
export function zoomToScroll(zoom, radius, height, fov = 45) {
  return sphereDiameter(radius + 2, radius, height, fov) - sphereDiameter(zoom, radius, height, fov);
}
export function scrollToZoom(position, radius, height, fov = 45) {
  const maxDiameter = sphereDiameter(radius + 2, radius, height, fov);
  const minDiameter = sphereDiameter(40, radius, height, fov);
  const diameter = Math.max(minDiameter, Math.min(maxDiameter, maxDiameter - position));
  const projectedRadius = height * radius / Math.tan(fov * Math.PI / 360) / diameter;
  return Math.sqrt(radius * radius + projectedRadius * projectedRadius);
}

// One original animation frame, including its ordering. The renderer schedules
// these at 60Hz so high-refresh displays retain the demo's rotation speed.
export function advanceSphereMotion(state, { pointerDown = false, autoVelocity = 0 } = {}) {
  state.rotation.x += state.velocity.x;
  state.rotation.y += state.velocity.y;
  if (!pointerDown) {
    state.velocity.x *= .92;
    state.velocity.y += (autoVelocity - state.velocity.y) * .05;
  }
  state.currentZoom += ((state.targetZoom || 15) - state.currentZoom) * .04;
  return state;
}
