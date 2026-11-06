// Port of THE DESIGN FUTURIST's SphereGallery3d_v2 (with the user's permission).
// Original source + the narrow Somnia adaptations: scripts/vendor/sphere-gallery/.
import * as THREE from './three.js';
import gsap from './gsap.js';
import { sphereConfig, spherePoints, sphereItemScale, sphereDiameter, initialSphereZoom, zoomToScroll, scrollToZoom, baseAutoVelocity, advanceSphereMotion } from '../../dream-sphere-geometry.js';
import { createScrollMotion, subscribeScrollSettings, wheelPixels } from '../../smooth-scroll.js';
import { subscribeGalleryAppearance } from './appearance.js';
import { createAtlasBlur } from './atlas-blur.js';
import { createSpherePresentation } from './presentation.js';

const IMAGE_VERTEX_SHADER = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
// Adjustable circular masking/frosting stays on the GPU, over one raw atlas.
const DREAM_FRAGMENT_SHADER = `
  precision highp float;
  uniform sampler2D tDreams;
  uniform vec4 uTile;
  uniform float uTilePixel;
  uniform float uEdgeBlur;
  uniform float uEdgeFade;
  uniform float uMatte;
  varying vec2 vUv;
  vec3 sampleDream(vec2 uv) {
    uv = clamp(uv, vec2(uTilePixel * 0.5), vec2(1.0 - uTilePixel * 0.5));
    return texture2D(tDreams, uTile.xy + uv * uTile.zw).rgb;
  }
  void main() {
    float edgeDistance = 0.5 - length(vUv - 0.5);
    float feather = mix(0.003, 0.3, uEdgeBlur);
    float alpha = pow(smoothstep(0.0, feather, edgeDistance), mix(0.35, 4.0, uEdgeFade));
    if (alpha < 0.0001) discard;
    vec3 color = sampleDream(vUv);
    if (uMatte > 0.001) {
      color = mix(color, vec3(dot(color, vec3(0.2126, 0.7152, 0.0722))), uMatte * 0.12);
      color = mix(color, vec3(0.98), uMatte * 0.4);
    }
    gl_FragColor = vec4(color, alpha);
  }
`;

export function createSphereGallery(canvas, source, { count, columns, onOpen, docked = false }) {
  const selectable = typeof onOpen === 'function';
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  // Same renderer defaults as the reference's React Three Fiber Canvas.
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.setClearColor(0xffffff, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, .1, 1000);
  camera.position.set(0, 0, 25);
  const group = new THREE.Group();
  scene.add(group);
  const sharedPlane = new THREE.PlaneGeometry(1, 1);
  const centerVec = new THREE.Vector3(0, 0, 0);
  const tempVec = new THREE.Vector3();
  const texture = new THREE.CanvasTexture(source.rawSurface);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const rows = Math.ceil(count / columns);
  const blur = createAtlasBlur(renderer, texture, { width: source.rawSurface.width, height: source.rawSurface.height, columns, rows });
  let blurDirty = true, blurQuality = null;
  const blurViewport = new THREE.Vector4();
  const appearanceUniforms = {
    tDreams: { value: texture },
    uEdgeBlur: { value: .32 }, uEdgeFade: { value: .7 }, uMatte: { value: 0 },
    uTilePixel: { value: columns / source.rawSurface.width },
  };
  let config = sphereConfig(innerWidth);
  const restingZoom = () => initialSphereZoom(config, innerWidth, innerHeight);
  const introZoom = () => Math.min(40, restingZoom() * 1.35);
  let points = spherePoints(config.itemCount, config.radius);
  const items = points.map((point, index) => {
    const dream = index % count;
    const material = new THREE.ShaderMaterial({
      transparent: true, side: THREE.DoubleSide, depthWrite: false,
      uniforms: {
        ...appearanceUniforms,
        uTile: { value: new THREE.Vector4(dream % columns / columns, 1 - (Math.floor(dream / columns) + 1) / rows, 1 / columns, 1 / rows) },
      },
      vertexShader: IMAGE_VERTEX_SHADER, fragmentShader: DREAM_FRAGMENT_SHADER,
    });
    const item = new THREE.Group();
    item.position.copy(point);
    const mesh = new THREE.Mesh(sharedPlane, material);
    mesh.userData = { index, dream };
    item.add(mesh);
    group.add(item);
    return { item, mesh, point, index, dream };
  });
  const meshes = items.map(item => item.mesh);
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const state = {
    rotation: group.rotation,
    velocity: { x: 0, y: config.introEnabled ? .15 : baseAutoVelocity(config) },
    currentZoom: config.introEnabled ? introZoom() : restingZoom(),
    targetZoom: config.introEnabled ? introZoom() : restingZoom(),
  };
  let active = false, motion = true, ready = false, contextLost = false, introStarted = false, introActive = config.introEnabled;
  let frame = 0, previous = 0, accumulator = 0, hovered = null, dirty = true;
  let nextFlightDraw = 0, wasAnimating = false;
  let introTimeline = null, width = 0, height = 0, pointerDown = false, dragging = false;
  let pointerPos = { x: 0, y: 0 }, startPointer = { x: 0, y: 0 };
  let pressedItem = null, pinchDistance = null, pinchZoom = 15;
  const pointers = new Map();
  const presentation = createSpherePresentation(canvas, camera, renderer, {
    docked,
    getDiameter: viewportHeight => {
      const size = sphereItemScale(config.itemCount, config.radius, config.gap);
      // Include the tangent image planes, not just their centres.
      return sphereDiameter(state.currentZoom, Math.hypot(config.radius, size / Math.SQRT2), viewportHeight);
    },
    onChange: () => { dirty = true; wake(); },
  });
  // Same controller, speed, damping, direction reversal and persistence as
  // settings-card scrolling. The camera is expressed in projected CSS pixels.
  let scrollSettings;
  const zoomMotion = createScrollMotion({
    read: () => zoomToScroll(state.currentZoom, config.radius, height || 1),
    write: position => {
      state.currentZoom = state.targetZoom = scrollToZoom(position, config.radius, height || 1);
      dirty = true; wake();
    },
    limit: () => zoomToScroll(40, config.radius, height || 1),
    requestFrame: requestAnimationFrame, cancelFrame: cancelAnimationFrame,
    now: () => performance.now(),
  });
  function configureZoom() {
    zoomMotion.configure({ ...scrollSettings, enabled: scrollSettings.enabled && motion });
  }
  subscribeScrollSettings(settings => { scrollSettings = settings; configureZoom(); });
  subscribeGalleryAppearance(settings => {
    appearanceUniforms.uEdgeBlur.value = settings.edgeBlur / 100;
    appearanceUniforms.uEdgeFade.value = settings.edgeFade / 100;
    appearanceUniforms.uMatte.value = settings.matte / 100;
    blur.configure(settings.matte / 100);
    blurDirty = true;
    dirty = true; wake();
  });

  function updateCursor() {
    canvas.style.cursor = pointerDown ? 'grabbing' : selectable && hovered ? 'pointer' : 'grab';
  }
  function orientItems(animateHover = true) {
    group.updateMatrixWorld(true);
    for (const { item, index } of items) {
      // Exact Item.useFrame behavior: face the sphere's WORLD centre.
      item.lookAt(centerVec);
      const targetScale = hovered?.index === index && !dragging ? 1.12 : 1;
      if (animateHover && Math.abs(item.scale.x - targetScale) > .001) {
        item.scale.lerp(tempVec.set(targetScale, targetScale, 1), .15);
      }
    }
  }
  function draw() {
    camera.position.z = state.currentZoom;
    presentation.project(performance.now());
    const compact = !presentation.interactive && !presentation.animating;
    let quality = 'off';
    if (appearanceUniforms.uMatte.value > .001) {
      quality = 'compact';
      if (!compact) {
        renderer.getViewport(blurViewport);
        const tileSize = sphereItemScale(config.itemCount, config.radius, config.gap);
        // Bound the nearest tile in actual render pixels, including the
        // original hover scale. Camera.zoom already includes the flight scale.
        const tilePixels = tileSize * 1.12 * camera.projectionMatrix.elements[5]
          * blurViewport.w / (2 * Math.max(.1, camera.position.z - config.radius))
          * renderer.getPixelRatio();
        // Native 128px tiles are enough until zoom makes them larger on screen.
        // Hysteresis prevents repeated target switching around the threshold.
        quality = tilePixels > 128 || (blurQuality === 'full' && tilePixels > 112) ? 'full' : 'medium';
      }
    }
    if (blurQuality !== quality) {
      blurQuality = quality;
      blurDirty = true;
      canvas.dataset.blurQuality = quality;
    }
    if (appearanceUniforms.uMatte.value > .001) {
      if (blurDirty) { blur.render({ quality }); blurDirty = false; }
      appearanceUniforms.tDreams.value = blur.texture;
      appearanceUniforms.uTilePixel.value = blur.tilePixel;
    } else {
      appearanceUniforms.tDreams.value = texture;
      appearanceUniforms.uTilePixel.value = columns / source.rawSurface.width;
    }
    renderer.render(scene, camera);
    dirty = false;
  }
  function tick(time) {
    frame = 0;
    if (!active || !ready) return;
    // Original useFrame equations, at their 60 Hz reference rate. Fixed steps
    // keep the same inertia/rotation on 120 Hz displays without extra GPU work.
    accumulator += previous ? Math.min(time - previous, 50) : 1000 / 60;
    previous = time;
    let advanced = false;
    const compact = !presentation.interactive && !presentation.animating;
    while (motion && accumulator >= 1000 / 60 - .01) {
      advanceSphereMotion(state, { pointerDown, autoVelocity: baseAutoVelocity(config) });
      if (!compact) orientItems();
      accumulator -= 1000 / 60;
      advanced = true;
    }
    if (advanced && compact) orientItems();
    if (!motion) { accumulator = 0; orientItems(false); }
    const animating = presentation.animating;
    // WAAPI and RAF can run at 120/144Hz. Keep this GPU scene at its 60Hz
    // budget during flight too; media dirtiness stays queued until that frame.
    // Paint the first flight frame immediately after changing the viewport.
    const interval = 1000 / 60;
    const flightFrameDue = time >= nextFlightDraw - .5;
    if ((advanced || dirty || animating) && (!animating || !wasAnimating || flightFrameDue)) {
      // Carry the cadence across refresh rates such as 144Hz instead of
      // rounding every interval up to three RAFs (which would yield only 48fps).
      nextFlightDraw = animating && wasAnimating
        ? nextFlightDraw + Math.max(1, Math.floor((time - nextFlightDraw) / interval) + 1) * interval
        : time + interval;
      draw();
    }
    wasAnimating = presentation.animating;
    // The 111px dock has no pointer interaction. Its shared 20fps video atlas
    // wakes the renderer; a separate 60fps loop only redraws identical pixels.
    if ((motion && presentation.interactive || presentation.animating) && !frame) frame = requestAnimationFrame(tick);
  }
  function wake() { if (active && ready && !frame) frame = requestAnimationFrame(tick); }
  function mediaFrame() { texture.needsUpdate = true; blurDirty = true; dirty = true; wake(); }

  function startIntro() {
    if (introStarted || !ready || !active) return;
    introStarted = true;
    if (!motion || !config.introEnabled || !presentation.interactive) { finishIntro(); return; }
    introTimeline = gsap.timeline();
    // Original Item intro: positions explode out; scale settles with back.out.
    items.forEach(({ item, point, index }) => {
      item.position.set(0, 0, 0);
      item.scale.set(0, 0, 0);
      introTimeline.to(item.position, { x: point.x, y: point.y, z: point.z, duration: 1.4, ease: 'power4.out' }, index * .008);
      introTimeline.to(item.scale, { x: 1, y: 1, z: 1, duration: 1, ease: 'back.out(1.7)' }, index * .008 + .1);
    });
    // Original SphereGallery intro kinematics, including the zoom interpolation.
    introTimeline.to(state, { targetZoom: restingZoom(), duration: 2.2, ease: 'expo.inOut', onComplete: () => { introActive = false; } }, 0);
    introTimeline.to(state.velocity, { y: baseAutoVelocity(config), duration: 2.5, ease: 'power3.out' }, 0);
  }
  function finishIntro() {
    introTimeline?.kill(); introTimeline = null; introActive = false;
    state.currentZoom = state.targetZoom = restingZoom();
    state.velocity.x = 0; state.velocity.y = baseAutoVelocity(config);
    items.forEach(({ item, point }) => { item.position.copy(point); item.scale.set(1, 1, 1); });
    dirty = true;
  }
  function resetPointers() {
    for (const pointerId of pointers.keys()) {
      if (canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId);
    }
    pointers.clear(); pointerDown = dragging = false; pinchDistance = null;
    hovered = null; pressedItem = null; updateCursor();
  }
  function setActive(visible, animate = true) {
    motion = animate;
    active = visible && !contextLost;
    configureZoom();
    source.playback(mediaFrame, active && motion, 1);
    if (!active) {
      presentation.settle();
      cancelAnimationFrame(frame); frame = 0; previous = accumulator = 0;
      introTimeline?.pause(); zoomMotion.stop(); resetPointers();
      return;
    }
    if (!motion) presentation.settle();
    if (!motion && introActive) finishIntro();
    else introTimeline?.resume();
    startIntro(); dirty = true; wake();
  }
  function resize() {
    zoomMotion.stop();
    width = innerWidth; height = innerHeight;
    const next = sphereConfig(width);
    if (next.radius !== config.radius || !introStarted) {
      config = next;
      points = spherePoints(config.itemCount, config.radius);
      const size = sphereItemScale(config.itemCount, config.radius, config.gap);
      items.forEach((entry, index) => {
        entry.point = points[index];
        entry.item.position.copy(entry.point);
        entry.mesh.scale.set(size, size, 1);
      });
      if (introStarted && introActive) finishIntro();
      state.targetZoom = Math.max(state.targetZoom, config.radius + 2);
      state.currentZoom = Math.max(state.currentZoom, config.radius + 2);
    }
    presentation.resize();
    dirty = true; wake();
  }
  window.addEventListener('resize', resize);
  source.ready.then(() => {
    ready = true; texture.needsUpdate = true; blurDirty = true;
    canvas.parentElement.dataset.ready = '';
    startIntro(); dirty = true; wake();
  });

  function hitAt(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    pointer.set((clientX - rect.left) / width * 2 - 1, -(clientY - rect.top) / height * 2 + 1);
    camera.updateMatrixWorld(); group.updateMatrixWorld(true);
    raycaster.setFromCamera(pointer, camera);
    // The original raycast hits a rectangle. Adapt hit testing to visible circles.
    const hit = raycaster.intersectObjects(meshes).find(hit => hit.uv && Math.hypot(hit.uv.x - .5, hit.uv.y - .5) <= .48);
    return hit ? items[hit.object.userData.index] : null;
  }
  function markHover(next) {
    if (next === hovered) return;
    hovered = next;
    if (!motion) {
      items.forEach(({ item, index }) => item.scale.set(hovered?.index === index ? 1.12 : 1, hovered?.index === index ? 1.12 : 1, 1));
    }
    updateCursor(); dirty = true; wake();
  }
  function screenRect(entry) {
    const world = entry.item.getWorldPosition(new THREE.Vector3());
    const distance = camera.position.distanceTo(world);
    const projected = world.clone().project(camera);
    const rect = canvas.getBoundingClientRect();
    const size = entry.mesh.scale.y / (2 * Math.tan(camera.fov * Math.PI / 360) * distance) * height;
    return { x: rect.left + (projected.x * .5 + .5) * width, y: rect.top + (-projected.y * .5 + .5) * height, w: size, h: size };
  }
  function open(entry) { if (selectable && entry) onOpen(entry.dream, screenRect(entry)); }

  canvas.addEventListener('pointerdown', event => {
    if (!active || !presentation.interactive || (event.pointerType === 'mouse' && event.button !== 0)) return;
    canvas.focus({ preventScroll: true });
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    canvas.setPointerCapture(event.pointerId);
    pointerDown = true; dragging = false;
    startPointer = pointerPos = { x: event.clientX, y: event.clientY };
    pressedItem = selectable ? hitAt(event.clientX, event.clientY) : null;
    if (pointers.size === 2) {
      zoomMotion.stop();
      const [a, b] = [...pointers.values()];
      pinchDistance = Math.hypot(a.x - b.x, a.y - b.y); pinchZoom = state.targetZoom; pressedItem = null; dragging = true;
    }
    updateCursor();
  });
  canvas.addEventListener('pointermove', event => {
    if (!active || !presentation.interactive) return;
    if (!pointerDown || !pointers.has(event.pointerId)) {
      if (selectable) markHover(hitAt(event.clientX, event.clientY));
      return;
    }
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 2 && pinchDistance !== null && !introActive) {
      const [a, b] = [...pointers.values()];
      const distance = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
      const nextZoom = Math.min(Math.max(pinchZoom * pinchDistance / distance, config.radius + 2), 40);
      state.targetZoom = state.currentZoom;
      zoomMotion.to(zoomToScroll(nextZoom, config.radius, height));
    } else {
      const dx = event.clientX - pointerPos.x, dy = event.clientY - pointerPos.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragging = true;
      state.velocity.y = dx * config.sensitivity * .004;
      state.velocity.x = dy * config.sensitivity * .004;
      pointerPos = { x: event.clientX, y: event.clientY };
    }
    if (!motion) { advanceSphereMotion(state, { pointerDown: true }); state.currentZoom = state.targetZoom; }
    dirty = true; wake();
  });
  function release(event, cancelled = false) {
    if (!pointers.has(event.pointerId)) return;
    const clicked = !cancelled && !dragging && pointers.size === 1 && pressedItem &&
      Math.hypot(event.clientX - startPointer.x, event.clientY - startPointer.y) < 10;
    pointers.delete(event.pointerId);
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    pinchDistance = null;
    if (pointers.size) { pointerPos = [...pointers.values()][0]; return; }
    pointerDown = false;
    const selected = pressedItem; pressedItem = null;
    if (clicked) open(selected);
    dragging = false; updateCursor(); dirty = true; wake();
  }
  canvas.addEventListener('pointerup', event => release(event));
  canvas.addEventListener('pointercancel', event => release(event, true));
  canvas.addEventListener('lostpointercapture', event => release(event, true));
  canvas.addEventListener('pointerleave', () => { if (!pointerDown) markHover(null); });
  canvas.addEventListener('wheel', event => {
    if (!active || !presentation.interactive || !config.scrollEnabled || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    if (introActive) return;
    state.targetZoom = state.currentZoom;
    zoomMotion.by(wheelPixels(event, height));
  }, { passive: false });
  canvas.addEventListener('keydown', event => {
    if (!active || !presentation.interactive) return;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
      event.preventDefault();
      state.velocity.y = event.key === 'ArrowLeft' ? -.03 : event.key === 'ArrowRight' ? .03 : 0;
      state.velocity.x = event.key === 'ArrowUp' ? -.03 : event.key === 'ArrowDown' ? .03 : 0;
      if (!motion) advanceSphereMotion(state, { pointerDown: true });
      dirty = true; wake();
    } else if (selectable && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      const front = items.reduce((best, entry) => {
        entry.item.getWorldPosition(tempVec);
        return !best || tempVec.z > best.z ? { entry, z: tempVec.z } : best;
      }, null);
      open(hovered || front?.entry);
    }
  });
  canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); contextLost = true; setActive(false, motion); });
  canvas.addEventListener('webglcontextrestored', () => { contextLost = false; texture.needsUpdate = true; blurDirty = true; document.dispatchEvent(new Event('somnia:sphere-restored')); });
  resize();
  if (docked) { introStarted = true; finishIntro(); }
  return {
    setActive,
    setDocked(value, options) {
      if (introActive) { gsap.killTweensOf(state); introActive = false; }
      zoomMotion.stop(); state.targetZoom = state.currentZoom;
      resetPointers();
      presentation.setDocked(value, { ...options, animate: options?.animate !== false && active && ready && motion });
    },
  };
}
