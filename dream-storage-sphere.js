import { getDreamAtlas, dreams } from './dream-media.js';
import { atlas } from './assets/dreams/catalog.js';
import { spherePoints, sphereItemScale } from './dream-sphere-geometry.js';
import { retentionOpacity } from './dream-grid-layout.js';

const designSize = 415;

// The home sphere's positions and inward-facing tangent planes, projected once
// into the device's design space. Keeping the layout still avoids another
// animation loop: only the shared video atlas and retention change each frame.
export function storageSphereLayout() {
  const radius = 5;
  const camera = 15;
  const count = 49;
  const size = sphereItemScale(count, radius, 73);
  const focal = (designSize / 2 - 2) * Math.sqrt(camera * camera - radius * radius) / radius;
  const yaw = .32;
  const cosine = Math.cos(yaw), sine = Math.sin(yaw);
  const rotate = ({ x, y, z }) => ({ x: x * cosine + z * sine, y, z: z * cosine - x * sine });
  return spherePoints(count, radius).map((point, index) => {
    const normal = { x: -point.x / radius, y: -point.y / radius, z: -point.z / radius };
    const horizontal = Math.hypot(normal.x, normal.z);
    const right = horizontal > 1e-8
      ? { x: normal.z / horizontal, y: 0, z: -normal.x / horizontal }
      : { x: 1, y: 0, z: 0 };
    const up = {
      x: normal.y * right.z,
      y: normal.z * right.x - normal.x * right.z,
      z: -normal.y * right.x,
    };
    const position = rotate(point);
    const u = rotate(right), v = rotate(up);
    const depth = camera - position.z;
    const projectAxis = axis => ({
      x: size * focal * (axis.x / depth + position.x * axis.z / (depth * depth)),
      y: -size * focal * (axis.y / depth + position.y * axis.z / (depth * depth)),
    });
    const horizontalAxis = projectAxis(u), verticalAxis = projectAxis(v);
    return {
      index,
      dream: index % dreams.length,
      depth,
      x: designSize / 2 + focal * position.x / depth,
      y: designSize / 2 - focal * position.y / depth,
      a: horizontalAxis.x, b: horizontalAxis.y,
      c: verticalAxis.x, d: verticalAxis.y,
    };
  }).sort((a, b) => b.depth - a.depth);
}

export function createStorageSphere(grid) {
  const cells = storageSphereLayout();
  const source = getDreamAtlas();
  const canvas = document.createElement('canvas');
  canvas.className = 'storage-dream-media';
  canvas.width = canvas.height = designSize;
  canvas.dataset.dreamCount = cells.length;
  canvas.dataset.layout = 'sphere';
  grid.append(canvas);
  const context = canvas.getContext('2d', { alpha: false });
  let retention = null;
  let playing = false;
  let speed = 1;
  let disposed = false;
  const now = () => document.timeline.currentTime ?? performance.now();

  function draw() {
    if (disposed) return;
    const scale = canvas.width / designSize;
    const elapsed = retention
      ? retention.elapsed + (playing ? (now() - retention.epoch) * speed : 0)
      : 0;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.globalAlpha = 1;
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    for (const cell of cells) {
      const opacity = retention ? retentionOpacity(elapsed, cell.index, cells.length) : 1;
      if (opacity <= 0) continue;
      context.globalAlpha = opacity;
      context.setTransform(scale * cell.a, scale * cell.b, scale * cell.c, scale * cell.d, scale * cell.x, scale * cell.y);
      // The atlas already includes the soft edge. Do not fill an opaque circle
      // underneath it: that creates a visible rim over the dreams behind it.
      context.drawImage(source.surface,
        cell.dream % atlas.columns * atlas.tile,
        Math.floor(cell.dream / atlas.columns) * atlas.tile,
        atlas.tile, atlas.tile, -.5, -.5, 1, 1);
    }
    context.globalAlpha = 1;
  }

  const observer = new ResizeObserver(([entry]) => {
    const pixels = Math.max(128, Math.min(640,
      Math.round(entry.contentRect.width * Math.min(devicePixelRatio || 1, 1.5))));
    if (canvas.width === pixels) return;
    canvas.width = canvas.height = pixels;
    draw();
  });
  observer.observe(grid.closest('.device-preview') || grid);
  source.ready.then(draw);

  return {
    setRetention(enabled, epoch = now()) {
      retention = enabled ? { epoch, elapsed: 0 } : null;
      draw();
    },
    setPlayback(nextPlaying, nextSpeed = speed) {
      const time = now();
      if (retention) {
        if (playing) retention.elapsed += (time - retention.epoch) * speed;
        retention.epoch = time;
      }
      playing = Boolean(nextPlaying);
      speed = Number.isFinite(nextSpeed) && nextSpeed > 0 ? nextSpeed : 1;
      source.playback(draw, playing, speed);
      draw();
    },
    dispose() {
      disposed = true;
      source.playback(draw, false, speed);
      observer.disconnect();
      canvas.remove();
    },
  };
}
