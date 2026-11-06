import { sphereFlightDuration, sphereFlightPose } from '../../sphere-flight.js';

// Move the existing 3D scene in screen space. No canvas copies, CSS upscaling,
// or route-time buffer resizes: even a zoomed-in sphere can leave the
// viewport and shrink into the dock without being cropped to its old bounds.
export function createSpherePresentation(canvas, camera, renderer, { getDiameter, onChange, docked = false }) {
  const host = canvas.parentElement;
  let viewportWidth = innerWidth, viewportHeight = innerHeight;
  let frameWidth = 0, frameHeight = 0, frameLeft = 0, frameTop = 0;
  let bufferWidth = 0, bufferHeight = 0;
  let flight = null;
  let previousFlightBounds = null;
  const dockSize = () => 111 * Math.min(1, (viewportWidth - 24) / 406);
  const endpoint = mini => mini
    ? { x: 12 + dockSize() / 2, y: viewportHeight - 12 - dockSize() / 2, diameter: dockSize() * .94 }
    : { x: viewportWidth / 2, y: viewportHeight / 2, diameter: getDiameter(viewportHeight) };

  function pose(time) {
    return flight
      ? sphereFlightPose(flight.from, flight.to, (time - flight.start) / flight.duration, { expanding: !docked, bend: 1 })
      : endpoint(docked);
  }
  function frame() {
    const mini = docked && !flight;
    host.toggleAttribute('data-docked', mini);
    host.toggleAttribute('data-flight', Boolean(flight));
    canvas.tabIndex = mini || flight ? -1 : 0;
    canvas.setAttribute('aria-hidden', String(Boolean(mini || flight)));
    const width = mini ? dockSize() : viewportWidth;
    const height = mini ? dockSize() : viewportHeight;
    frameLeft = mini ? 12 : 0;
    frameTop = mini ? viewportHeight - 12 - height : 0;
    frameWidth = width; frameHeight = height;
    previousFlightBounds = null;
    if (bufferWidth !== viewportWidth || bufferHeight !== viewportHeight) {
      bufferWidth = viewportWidth; bufferHeight = viewportHeight;
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
      renderer.setSize(viewportWidth, viewportHeight, false);
    }
    // Keep the allocated canvas; the dock only draws its top-left 111px tile.
    // The host clips the unused pixels, and scissoring avoids clearing them.
    renderer.setViewport(0, viewportHeight - height, width, height);
    renderer.setScissor(0, viewportHeight - height, width, height);
    renderer.setScissorTest(true);
    camera.aspect = width / height;
    onChange();
  }
  function settle() { flight = null; frame(); }

  function scissorFlight(current) {
    // getDiameter includes the tangent planes' diagonal. The small extra pad
    // covers antialiasing and the last hover-scale frames after pointer reset.
    const radius = current.diameter / 2 + 8;
    const clampX = value => Math.max(0, Math.min(viewportWidth, value));
    const clampY = value => Math.max(0, Math.min(viewportHeight, value));
    const bounds = {
      left: clampX(Math.floor(current.x - radius)),
      top: clampY(Math.floor(current.y - radius)),
      right: clampX(Math.ceil(current.x + radius)),
      bottom: clampY(Math.ceil(current.y + radius)),
    };
    if (previousFlightBounds) {
      const left = Math.min(previousFlightBounds.left, bounds.left);
      const top = Math.min(previousFlightBounds.top, bounds.top);
      const right = Math.max(previousFlightBounds.right, bounds.right);
      const bottom = Math.max(previousFlightBounds.bottom, bounds.bottom);
      // Auto-clear erases the previous footprint as well as the next one.
      // Keep the full viewport/projection; only the touched pixels change.
      renderer.setScissor(left, viewportHeight - bottom, right - left, bottom - top);
    }
    // The first project after frame() retains its full-frame scissor. This
    // clears old dock/fullscreen pixels before the host exposes that buffer.
    previousFlightBounds = bounds;
  }

  return {
    get interactive() { return !docked && !flight; },
    get animating() { return Boolean(flight); },
    setDocked(next, { animate = true, duration = sphereFlightDuration(next) } = {}) {
      const now = performance.now();
      const from = pose(now);
      const changed = docked !== next;
      docked = next;
      if (!animate) { settle(); return; }
      if (!changed) return;
      flight = { from, to: endpoint(docked), start: now, duration };
      frame();
    },
    resize() {
      viewportWidth = innerWidth; viewportHeight = innerHeight;
      settle();
    },
    settle,
    project(time) {
      if (flight && time - flight.start >= flight.duration) settle();
      const current = pose(time);
      camera.zoom = current.diameter / getDiameter(viewportHeight) * viewportHeight / frameHeight;
      camera.updateProjectionMatrix();
      camera.projectionMatrix.elements[8] = -2 * (current.x - frameLeft - frameWidth / 2) / frameWidth;
      camera.projectionMatrix.elements[9] = 2 * (current.y - frameTop - frameHeight / 2) / frameHeight;
      camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
      if (flight) scissorFlight(current);
    },
  };
}
