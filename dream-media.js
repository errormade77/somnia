import { dreams, atlas } from './assets/dreams/catalog.js';
import { dreamGridLayout, retentionOpacity } from './dream-grid-layout.js';
export { dreams };

// Both grids share one decoder and one pre-masked atlas. Each visible grid is
// a single composited surface instead of 37 canvases and 37 separate SVG masks.
let sharedAtlas;
export function getDreamAtlas() {
  if (sharedAtlas) return sharedAtlas;
  const subscribers = new Set();
  const video = document.createElement('video');
  video.className = 'dream-atlas-source';
  video.setAttribute('aria-hidden', 'true');
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.preload = 'none';
  document.body.append(video);
  const surface = document.createElement('canvas');
  surface.width = atlas.columns * atlas.tile;
  surface.height = Math.ceil(dreams.length / atlas.columns) * atlas.tile;
  const context = surface.getContext('2d');
  let rawSurface = null, rawContext = null;
  const mask = document.createElement('canvas');
  mask.width = surface.width;
  mask.height = surface.height;
  const maskContext = mask.getContext('2d');
  // Rasterize the Figma soft circle once (r=.4366, Gaussian sigma=.0317).
  for (let i = 0; i < dreams.length; i++) {
    const x = i % atlas.columns * atlas.tile;
    const y = Math.floor(i / atlas.columns) * atlas.tile;
    const half = atlas.tile / 2;
    const gradient = maskContext.createRadialGradient(x + half, y + half, 0, x + half, y + half, half);
    for (const [position, alpha] of [[0, 1], [.746, .977], [.81, .841], [.8732, .5], [.9366, .159], [1, .023]]) {
      gradient.addColorStop(position, 'rgba(255,255,255,' + alpha + ')');
    }
    maskContext.fillStyle = gradient;
    maskContext.beginPath();
    maskContext.arc(x + half, y + half, half, 0, Math.PI * 2);
    maskContext.fill();
  }
  let callback = null;
  let hasFrame = false;
  let lastFrame = -1;
  const frameCallbacks = typeof video.requestVideoFrameCallback === 'function';
  function paint(source) {
    if (rawContext) {
      rawContext.globalCompositeOperation = 'copy';
      rawContext.drawImage(source, 0, 0, surface.width, surface.height);
    }
    context.globalCompositeOperation = 'copy';
    context.drawImage(source, 0, 0, surface.width, surface.height);
    context.globalCompositeOperation = 'destination-in';
    context.drawImage(mask, 0, 0);
    context.globalCompositeOperation = 'source-over';
    hasFrame = true;
  }
  function tick() {
    callback = null;
    if (!subscribers.size) return;
    const currentFrame = Math.floor(video.currentTime * 20);
    if (video.readyState >= 2 && currentFrame !== lastFrame) {
      paint(video);
      lastFrame = currentFrame;
      for (const render of subscribers) render();
    }
    callback = frameCallbacks ? video.requestVideoFrameCallback(tick) : requestAnimationFrame(tick);
  }
  function pause() {
    video.pause();
    if (callback === null) return;
    if (frameCallbacks) video.cancelVideoFrameCallback(callback);
    else cancelAnimationFrame(callback);
    callback = null;
  }
  const poster = new Image();
  const ready = new Promise(resolve => { poster.onload = () => { if (!hasFrame) paint(poster); resolve(); }; });
  poster.src = atlas.poster;
  sharedAtlas = {
    surface, ready,
    // The home gallery applies its adjustable mask/frosting in its shader.
    // Keep the device grids' original mask untouched; allocate raw media lazily.
    get rawSurface() {
      if (!rawSurface) {
        rawSurface = document.createElement('canvas');
        rawSurface.width = surface.width; rawSurface.height = surface.height;
        rawContext = rawSurface.getContext('2d');
        if (video.readyState >= 2) rawContext.drawImage(video, 0, 0, surface.width, surface.height);
        else if (poster.complete && poster.naturalWidth) rawContext.drawImage(poster, 0, 0, surface.width, surface.height);
      }
      return rawSurface;
    },
    playback(render, playing, speed) {
      if (!playing) {
        subscribers.delete(render);
        if (!subscribers.size) pause();
        return;
      }
      const alreadyPlaying = subscribers.has(render);
      subscribers.add(render);
      if (video.playbackRate !== speed) video.playbackRate = speed;
      if (alreadyPlaying && !video.paused) return;
      if (!video.getAttribute('src')) video.src = atlas.src;
      video.play().then(() => {
        if (!subscribers.size) { pause(); return; }
        if (callback === null) tick();
      }).catch(() => {});
    },
  };
  return sharedAtlas;
}

export function createDreamGrid(grid, rows, { dreamIndices } = {}) {
  const cells = dreamGridLayout(rows, dreamIndices, dreams.length);
  const source = getDreamAtlas();
  const canvas = document.createElement('canvas');
  canvas.className = 'storage-dream-media';
  canvas.width = canvas.height = 415;
  canvas.dataset.dreamCount = cells.length;
  grid.append(canvas);
  const context = canvas.getContext('2d');
  let retention = null;
  let speed = 1;
  const now = () => document.timeline.currentTime ?? performance.now();

  function draw() {
    context.setTransform(canvas.width / 415, 0, 0, canvas.height / 415, 0, 0);
    context.clearRect(0, 0, 415, 415);
    const elapsed = retention ? retention.elapsed + (now() - retention.epoch) * speed : 0;
    for (const cell of cells) {
      if (cell.x + cell.size < 0 || cell.x > 415 || cell.y + cell.size < 0 || cell.y > 415) continue;
      context.globalAlpha = retention ? retentionOpacity(elapsed, cell.index, cells.length) : 1;
      if (context.globalAlpha === 0) continue;
      context.fillStyle = '#fff';
      context.beginPath();
      context.arc(cell.x + cell.size / 2, cell.y + cell.size / 2, cell.size / 2, 0, Math.PI * 2);
      context.fill();
      context.drawImage(source.surface, cell.dream % atlas.columns * atlas.tile, Math.floor(cell.dream / atlas.columns) * atlas.tile, atlas.tile, atlas.tile, cell.x, cell.y, cell.size, cell.size);
    }
    context.globalAlpha = 1;
  }
  // Size for the displayed orb, capped at 1.5x. Glass diffuses these thumbnails;
  // extra 2x/3x textures only add uploads without visible detail.
  new ResizeObserver(([entry]) => {
    const pixels = Math.max(128, Math.min(640, Math.round(entry.contentRect.width * Math.min(devicePixelRatio || 1, 1.5))));
    if (canvas.width === pixels) return;
    canvas.width = canvas.height = pixels;
    draw();
  }).observe(document.querySelector('#device-preview'));
  source.ready.then(draw);
  return {
    setRetention(enabled, epoch = now()) {
      retention = enabled ? { epoch, elapsed: 0 } : null;
      draw();
    },
    setPlayback(playing, nextSpeed) {
      if (retention && speed !== nextSpeed) {
        retention.elapsed += (now() - retention.epoch) * speed;
        retention.epoch = now();
      }
      speed = nextSpeed;
      source.playback(draw, playing, speed);
    },
  };
}
