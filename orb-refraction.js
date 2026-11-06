// Edge lens equations adapted from Orbloom's fragmentShaderSource (MIT).
// Copyright (c) 2026 Ricky Bharti — see assets/Orbloom-LICENSE.txt.
// SVG displacement applies the lens to live media instead of a procedural sky.
// During device flights only, frozen filtered media textures keep scaling cheap.
const namespace = 'http://www.w3.org/2000/svg';
const neutralCorrection = 0.5 - 128 / 255;

function element(name, attributes = {}, parent) {
  const node = document.createElementNS(namespace, name);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  parent?.append(node);
  return node;
}

function supportsCanvasSvgFilter() {
  let probe;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 2;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context || !('filter' in context)) return false;
    probe = element('svg', { width: 0, height: 0, 'aria-hidden': 'true' });
    const test = element('filter', {
      id: 'orb-raster-filter-probe', x: 0, y: 0, width: 2, height: 2,
      filterUnits: 'userSpaceOnUse', 'color-interpolation-filters': 'sRGB',
    }, element('defs', {}, probe));
    element('feColorMatrix', { type: 'matrix', values: '0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0' }, test);
    document.body.append(probe);
    context.filter = 'url(#orb-raster-filter-probe)';
    context.fillStyle = '#0064ff';
    context.fillRect(0, 0, 2, 2);
    const pixel = context.getImageData(0, 0, 1, 1).data;
    return pixel[0] > 250 && pixel[1] < 3 && pixel[2] < 3 && pixel[3] > 250;
  } catch { return false; }
  finally { probe?.remove(); }
}

function createFlightRaster(preview, media, contentLayers, lens) {
  if (preview.dataset.flightRaster !== 'ready') return { invalidate() {}, resize() {}, warm() {} };
  const root = document.documentElement;
  const plane = document.createElement('div');
  plane.className = 'orb-flight-media';
  plane.setAttribute('aria-hidden', 'true');
  preview.append(plane);
  const source = document.createElement('canvas');
  const context = source.getContext('2d');
  const filtered = document.createElement('canvas');
  const filteredContext = filtered.getContext('2d');
  const tile = document.createElement('canvas');
  const tileContext = tile.getContext('2d');
  tile.width = tile.height = 372;
  const images = new Map();
  const records = contentLayers.map(content => {
    const scene = content.parentElement;
    const name = ['home', 'storage', 'gesture', 'style', 'saving'].find(name => scene.classList.contains(`${name}-preview`));
    const canvas = document.createElement('canvas');
    canvas.className = 'orb-flight-scene';
    canvas.dataset.scene = name;
    canvas.style.opacity = '0';
    plane.append(canvas);
    return { name, scene, content, canvas, context: canvas.getContext('2d'), captured: false, animation: null };
  });
  let pixels = 0;
  let generation = 0;
  let expected = null;
  let blocked = false;
  let active = false;
  let warmed = false;
  let warmScheduled = false;

  function warm() {
    if (warmed || warmScheduled) return;
    warmScheduled = true;
    const run = () => {
      warmScheduled = false;
      if (warmed || active || root.dataset.deviceFlight || !lens.ready() || !pixels) return;
      warmed = true;
      try {
        context.setTransform(1, 0, 0, 1, 0, 0);
        context.clearRect(0, 0, pixels, pixels);
        filteredContext.filter = lens.value() || 'none';
        filteredContext.drawImage(source, 0, 0);
        // Flush the transparent warm-up once while idle, never during a frame.
        filteredContext.getImageData(0, 0, 1, 1);
      } catch { /* Real captures still have the native-filter fallback. */ }
      finally {
        filteredContext.filter = 'none';
        filteredContext.clearRect(0, 0, pixels, pixels);
      }
    };
    if (typeof requestIdleCallback === 'function') requestIdleCallback(run, { timeout: 1200 });
    else setTimeout(run, 200);
  }

  function warmImage(url) {
    if (!url || images.has(url)) return;
    const image = new Image();
    images.set(url, image);
    image.decoding = 'async';
    image.src = url;
  }
  const maskUrl = '/assets/dream-mask.svg';
  warmImage(maskUrl);
  for (const video of media.querySelectorAll('video')) {
    warmImage(video.poster);
    video.addEventListener('loadeddata', () => warmImage(video.poster));
  }
  function videoSource(video) {
    if (video.readyState >= 2 && video.videoWidth > 0) return video;
    warmImage(video.poster);
    const poster = images.get(video.poster);
    return poster?.complete && poster.naturalWidth > 0 ? poster : null;
  }
  function cover(target, image, width, height) {
    const iw = image.videoWidth || image.naturalWidth || image.width;
    const ih = image.videoHeight || image.naturalHeight || image.height;
    if (!iw || !ih) return false;
    const scale = Math.max(width / iw, height / ih);
    const sw = width / scale, sh = height / scale;
    target.drawImage(image, (iw - sw) / 2, (ih - sh) / 2, sw, sh, 0, 0, width, height);
    return true;
  }
  function opacityWithin(element, boundary) {
    let opacity = 1;
    for (let node = element; node && node !== boundary; node = node.parentElement) opacity *= Number(getComputedStyle(node).opacity);
    return opacity;
  }
  function transform(style, target) {
    if (style.transform === 'none') return;
    const matrix = new DOMMatrixReadOnly(style.transform);
    const [x, y] = style.transformOrigin.split(' ').map(parseFloat);
    target.translate(x, y);
    target.transform(matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f);
    target.translate(-x, -y);
  }
  function paintGesture(record) {
    const mask = images.get(maskUrl);
    if (!mask?.complete || !mask.naturalWidth) return false;
    const strip = record.content.querySelector('.dream-strip');
    context.save();
    context.scale(pixels / 415, pixels / 415);
    transform(getComputedStyle(strip), context);
    let painted = false;
    for (const circle of strip.children) {
      const opacity = opacityWithin(circle, record.content);
      if (opacity < .001) continue;
      const video = circle.querySelector('video');
      const image = videoSource(video);
      if (!image) { context.restore(); return false; }
      const style = getComputedStyle(circle);
      const width = parseFloat(style.width), height = parseFloat(style.height);
      tileContext.globalCompositeOperation = 'source-over';
      tileContext.clearRect(0, 0, tile.width, tile.height);
      cover(tileContext, image, tile.width, tile.height);
      tileContext.globalCompositeOperation = 'destination-in';
      tileContext.drawImage(mask, 0, 0, tile.width, tile.height);
      tileContext.globalCompositeOperation = 'source-over';
      context.save();
      context.globalAlpha = opacity;
      context.translate(parseFloat(style.left), parseFloat(style.top));
      transform(style, context);
      context.drawImage(tile, 0, 0, width, height);
      context.restore();
      painted = true;
    }
    context.restore();
    return painted;
  }
  function capture(record) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.globalAlpha = 1;
    context.clearRect(0, 0, pixels, pixels);
    let painted = false;
    if (record.name === 'gesture') painted = paintGesture(record);
    else {
      for (const element of record.content.querySelectorAll('video, canvas')) {
        const opacity = opacityWithin(element, record.content);
        if (opacity < .001) continue;
        const image = element.tagName === 'VIDEO' ? videoSource(element) : element;
        if (!image) return false;
        context.globalAlpha = opacity;
        painted = cover(context, image, pixels, pixels) || painted;
      }
    }
    if (!painted) return false;
    // Reuse the warmed filter context for every scene; output textures only blit.
    filteredContext.filter = 'none';
    filteredContext.clearRect(0, 0, pixels, pixels);
    filteredContext.filter = lens.value() || 'none';
    filteredContext.drawImage(source, 0, 0);
    filteredContext.filter = 'none';
    const output = record.context;
    output.setTransform(1, 0, 0, 1, 0, 0);
    output.filter = 'none';
    output.clearRect(0, 0, pixels, pixels);
    output.drawImage(filtered, 0, 0);
    warmed = true;
    record.captured = true;
    return true;
  }
  function restore() {
    generation++;
    active = false;
    expected = null;
    preview.dataset.flightRaster = 'ready';
    for (const record of records) {
      record.animation?.cancel();
      record.animation = null;
      record.canvas.style.opacity = '0';
      record.captured = false;
    }
  }
  function invalidate() {
    blocked = Boolean(root.dataset.deviceFlight);
    restore();
  }
  function resize() {
    const next = Math.max(1, Math.round(lens.diameter()));
    if (next === pixels) return;
    invalidate();
    pixels = next;
    source.width = source.height = pixels;
    filtered.width = filtered.height = pixels;
    for (const record of records) record.canvas.width = record.canvas.height = pixels;
  }
  function flight(event) {
    if (!root.dataset.deviceFlight) { blocked = false; restore(); return; }
    if (blocked || !lens.ready()) return;
    resize();
    if (blocked) return;
    const destination = root.dataset.page === 'settings' ? 'storage' : 'home';
    expected = destination;
    const id = ++generation;
    // All reads happen before hiding native media. In particular this captures
    // the previous decoded home frame before its controller selects another clip.
    const opacities = records.map(record => Number(getComputedStyle(active ? record.canvas : record.scene).opacity));
    try {
      for (let index = 0; index < records.length; index++) {
        const record = records[index];
        if (opacities[index] < .001 && record.name !== destination) continue;
        if (!record.captured && !capture(record)) { invalidate(); return; }
      }
    } catch { invalidate(); return; }
    for (let index = 0; index < records.length; index++) {
      const record = records[index];
      record.animation?.cancel();
      record.canvas.style.opacity = String(record.captured ? opacities[index] : 0);
    }
    active = true;
    preview.dataset.flightRaster = 'active';
    // Keep the complete scene crossfade, but composite baked textures rather
    // than rerasterizing a growing SVG-filtered DOM subtree on each frame.
    queueMicrotask(() => {
      if (id !== generation || !active) return;
      for (let index = 0; index < records.length; index++) {
        const record = records[index];
        const opacity = record.captured ? opacities[index] : 0;
        const to = record.name === destination ? 1 : 0;
        record.animation = record.canvas.animate([{ opacity }, { opacity: to }], { duration: 420, easing: 'ease', fill: 'forwards' });
      }
    });
  }
  const observer = new MutationObserver(() => {
    const mode = preview.dataset.active === 'retention' ? 'storage' : preview.dataset.active;
    if (active && expected && mode !== expected) invalidate();
  });
  observer.observe(preview, { attributes: true, attributeFilter: ['data-active'] });
  document.addEventListener('somnia:device-flight', flight);
  document.addEventListener('somnia:settings-change', invalidate);
  document.addEventListener('somnia:device-power', invalidate);
  resize();
  return { invalidate, resize, warm };
}

function prepareMediaPlane(preview) {
  const contentLayers = [];
  const media = document.createElement('div');
  media.className = 'device-media';
  const overlays = document.createElement('div');
  overlays.className = 'device-overlays';
  for (const scene of [...preview.children]) {
    const name = ['home', 'storage', 'gesture', 'style', 'saving'].find(name => scene.classList.contains(`${name}-preview`));
    if (!name) continue;
    const content = [...scene.children].find(child => child.classList.contains('refracted-content'));
    if (!content) continue;
    const graphics = [...scene.children].filter(child => child !== content);
    if (graphics.length) {
      const overlay = document.createElement('div');
      overlay.className = 'device-overlay-scene';
      overlay.dataset.scene = name;
      overlay.append(...graphics);
      overlays.append(overlay);
    }
    content.style.filter = '';
    contentLayers.push(content);
    media.append(scene);
  }
  preview.append(media, overlays);
  return { media, contentLayers };
}

export function createOrbRefraction(preview) {
  preview.dataset.flightRaster = supportsCanvasSvgFilter() ? 'ready' : 'unsupported';
  const { media, contentLayers } = prepareMediaPlane(preview);
  const svg = element('svg', { width: 0, height: 0, 'aria-hidden': 'true', focusable: 'false' });
  svg.style.position = 'absolute';
  svg.style.pointerEvents = 'none';
  const filter = element('filter', {
    id: 'orb-content-refraction', x: 0, y: 0, width: 415, height: 415,
    filterUnits: 'userSpaceOnUse', primitiveUnits: 'userSpaceOnUse',
    'color-interpolation-filters': 'sRGB',
  }, element('defs', {}, svg));
  // Flatten transparent media onto the neutral interior before splitting RGB.
  // The scene's outer opacity and circular clip still apply after the filter.
  element('feFlood', { 'flood-color': '#f7f7f7', result: 'interior' }, filter);
  element('feComposite', { in: 'SourceGraphic', in2: 'interior', operator: 'over', result: 'content' }, filter);
  const map = element('feImage', { x: 0, y: 0, width: 415, height: 415, preserveAspectRatio: 'none', result: 'encoded-map' }, filter);
  const corrected = element('feComponentTransfer', { in: 'encoded-map', result: 'lens-map' }, filter);
  for (const channel of ['R', 'G']) element(`feFunc${channel}`, { type: 'linear', slope: 1, intercept: neutralCorrection }, corrected);
  const displacements = ['red', 'green', 'blue'].map((channel, index) => {
    const displacement = element('feDisplacementMap', {
      in: 'content', in2: 'lens-map', xChannelSelector: 'R', yChannelSelector: 'G',
      scale: 0, result: `${channel}-shift`,
    }, filter);
    const matrix = Array(20).fill(0);
    matrix[index * 5 + index] = 1;
    matrix[18] = 1;
    element('feColorMatrix', { in: `${channel}-shift`, type: 'matrix', values: matrix.join(' '), result: channel }, filter);
    return displacement;
  });
  element('feComposite', { in: 'red', in2: 'green', operator: 'arithmetic', k2: 1, k3: 1, result: 'red-green' }, filter);
  element('feComposite', { in: 'red-green', in2: 'blue', operator: 'arithmetic', k2: 1, k3: 1, result: 'color' }, filter);
  // Surface roughness diffuses the live media after refraction. Device text/dots stay legible.
  const diffusion = element('feGaussianBlur', { in: 'color', stdDeviation: 0, edgeMode: 'duplicate', result: 'diffused' }, filter);
  const scattering = element('feColorMatrix', { in: 'diffused', type: 'matrix' }, filter);
  document.body.append(svg);

  let diameter = 415;
  let glass = 0;
  let matte = 0;
  let seed = 4.6;
  let ready = false;
  let measured = false;
  let flightRaster;

  function render() {
    // The glass is a stable lens. Moving media already provides live refraction;
    // changing SVG primitives every frame re-rasterized the entire video again.
    const lensPulse = 1 + .16 * (.6 * Math.sin(seed) + .4 * Math.sin(seed * 1.3));
    [1.4, 1.2, 1].forEach((shift, index) => {
      const chromaticShift = shift * (1 + .06 * Math.sin(seed + index * 2.1));
      displacements[index].setAttribute('scale', (diameter * glass * lensPulse * chromaticShift).toFixed(4));
    });
  }

  function renderSurface() {
    diffusion.setAttribute('stdDeviation', (diameter * .028 * Math.pow(matte, 1.4)).toFixed(3));
    const haze = matte * .18;
    const transmission = 1 - haze;
    scattering.setAttribute('values', `${transmission} 0 0 0 ${haze} 0 ${transmission} 0 0 ${haze} 0 0 ${transmission} 0 ${haze} 0 0 0 1 0`);
  }

  function sync() {
    // Keep each scene's surface attached throughout its lifetime. Crossfading
    // happens outside these filters, so cached glass frames can be composited
    // without rebuilding a filtered layer on every route or opacity change.
    // Hidden scenes don't paint; media pauses for the device flight.
    const value = ready && (glass > 0 || matte > 0) ? 'url(#orb-content-refraction)' : '';
    for (const layer of contentLayers) {
      if (layer.style.filter !== value) layer.style.filter = value;
    }
  }

  function syncSettings(event) {
    flightRaster?.invalidate();
    const style = getComputedStyle(document.querySelector('#device-orb-motion'));
    glass = event?.detail?.glass ?? (Number(style.getPropertyValue('--orb-glass-strength')) || 0);
    matte = (event?.detail?.matte ?? (Number(style.getPropertyValue('--orb-matte')) || 0)) / 100;
    seed = event?.detail?.seed ?? seed;
    renderSurface();
    render();
    sync();
  }

  new ResizeObserver(([entry]) => {
    diameter = entry.contentRect.width;
    measured = diameter > 0;
    for (const node of [filter, map]) {
      node.setAttribute('width', diameter);
      node.setAttribute('height', diameter);
    }
    renderSurface();
    render();
    flightRaster?.resize();
    if (ready && measured) flightRaster?.warm();
  }).observe(preview);
  document.addEventListener('somnia:motion-change', syncSettings);
  // Precomputed from the same Orbloom lens equations; no startup pixel loop/PNG encoding.
  const mapUrl = '/assets/orb-displacement.png';
  map.setAttribute('href', mapUrl);
  const image = new Image();
  image.onload = () => { ready = true; sync(); if (measured) flightRaster?.warm(); };
  image.src = mapUrl;
  syncSettings();
  flightRaster = createFlightRaster(preview, media, contentLayers, {
    ready: () => ready,
    diameter: () => diameter,
    value: () => ready && (glass > 0 || matte > 0) ? 'url(#orb-content-refraction)' : '',
  });
  if (ready && measured) flightRaster.warm();
}
