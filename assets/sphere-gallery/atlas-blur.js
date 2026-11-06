import * as THREE from './three.js';

// A separable Gaussian convolution of the atlas, once per VIDEO frame.
// Pair neighbouring kernel taps through bilinear filtering; unlike widely
// spaced samples, this integrates every texel and cannot create a square grid.
export function createAtlasBlur(renderer, texture, { width, height, columns, rows }) {
  const targetOptions = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, stencilBuffer: false };
  function targets(targetWidth, targetHeight, sampleWidth, sampleHeight) {
    const horizontal = new THREE.WebGLRenderTarget(targetWidth, targetHeight, targetOptions);
    const vertical = new THREE.WebGLRenderTarget(targetWidth, targetHeight, targetOptions);
    horizontal.texture.generateMipmaps = vertical.texture.generateMipmaps = false;
    return {
      horizontal, vertical, sampleWidth, sampleHeight,
      weights: new Float32Array(13), offsets: new Float32Array(13), pairs: 0,
    };
  }
  const full = targets(width * 2, height * 2, width, height);
  const medium = targets(width, height, width, height);
  const mini = targets(columns * 64, rows * 64, columns * 64, rows * 64);
  let selected = full;
  // Allocate all framebuffer pairs once, before the first gallery frame.
  // Route changes only select a pair; they never resize an active texture.
  const initialTarget = renderer.getRenderTarget();
  for (const pair of [full, medium, mini]) {
    renderer.setRenderTarget(pair.horizontal);
    renderer.setRenderTarget(pair.vertical);
  }
  renderer.setRenderTarget(initialTarget);
  const uniforms = {
    tInput: { value: texture },
    uDirection: { value: new THREE.Vector2() },
    uGrid: { value: new THREE.Vector2(columns, rows) },
    uHalfPixel: { value: new THREE.Vector2(.5 / width, .5 / height) },
    uWeights: { value: new Float32Array(13) },
    uOffsets: { value: new Float32Array(13) },
    uPairs: { value: 0 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms, depthTest: false, depthWrite: false,
    vertexShader: `varying vec2 vUv;
      void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: `precision highp float;
      varying vec2 vUv;
      uniform sampler2D tInput;
      uniform vec2 uDirection, uGrid, uHalfPixel;
      uniform float uWeights[13], uOffsets[13];
      uniform int uPairs;
      void main() {
        vec2 low = floor(min(vUv, vec2(0.999999)) * uGrid) / uGrid;
        vec2 high = low + 1.0 / uGrid - uHalfPixel;
        low += uHalfPixel;
        vec3 color = texture2D(tInput, clamp(vUv, low, high)).rgb * uWeights[0];
        for (int i = 1; i < 13; i++) {
          if (i > uPairs) break;
          vec2 offset = uDirection * uOffsets[i];
          color += texture2D(tInput, clamp(vUv + offset, low, high)).rgb * uWeights[i];
          color += texture2D(tInput, clamp(vUv - offset, low, high)).rgb * uWeights[i];
        }
        gl_FragColor = vec4(color, 1.0);
      }`,
  });
  const scene = new THREE.Scene();
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  quad.frustumCulled = false;
  scene.add(quad);
  const camera = new THREE.Camera();
  let amount = -1;

  return {
    get texture() { return selected.vertical.texture; },
    get tilePixel() { return columns / selected.sampleWidth; },
    configure(next) {
      if (next === amount) return;
      amount = next;
      for (const target of [full, medium, mini]) {
        const sigma = Math.max(.55, next * (target.sampleWidth / columns) * .06);
        const radius = Math.min(24, Math.ceil(3 * sigma));
        const kernel = Array.from({ length: radius + 1 }, (_, i) => Math.exp(-i * i / (2 * sigma * sigma)));
        const total = kernel[0] + kernel.slice(1).reduce((sum, value) => sum + 2 * value, 0);
        const { weights, offsets } = target;
        weights.fill(0); offsets.fill(0); weights[0] = kernel[0] / total;
        let pair = 0;
        for (let i = 1; i <= radius; i += 2) {
          const first = kernel[i], second = kernel[i + 1] || 0;
          weights[++pair] = (first + second) / total;
          offsets[pair] = i + second / (first + second);
        }
        target.pairs = pair;
      }
    },
    render({ compact = false, quality = compact ? 'compact' : 'full' } = {}) {
      selected = quality === 'compact' ? mini : quality === 'medium' ? medium : full;
      const { horizontal, vertical, sampleWidth, sampleHeight, weights, offsets, pairs } = selected;
      const previous = renderer.getRenderTarget();
      uniforms.uWeights.value = weights;
      uniforms.uOffsets.value = offsets;
      uniforms.uPairs.value = pairs;
      // The compact pass clamps to a half pixel of its own atlas so bilinear
      // sampling cannot pull colour from a neighbouring dream tile.
      uniforms.uHalfPixel.value.set(.5 / sampleWidth, .5 / sampleHeight);
      uniforms.tInput.value = texture;
      uniforms.uDirection.value.set(1 / sampleWidth, 0);
      renderer.setRenderTarget(horizontal);
      renderer.render(scene, camera);
      uniforms.tInput.value = horizontal.texture;
      uniforms.uDirection.value.set(0, 1 / sampleHeight);
      renderer.setRenderTarget(vertical);
      renderer.render(scene, camera);
      renderer.setRenderTarget(previous);
    },
  };
}
