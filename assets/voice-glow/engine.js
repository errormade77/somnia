/* Voice Glow — Copyright (c) 2026 Jakub Antalik. MIT; see LICENSE. Hover-only build for Somnia. */

// scripts/vendor/voice-glow/color.ts
function parseRgb(color) {
  let c = color.trim(), hex = c.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    let h = hex[1].length === 3 ? hex[1].split("").map((ch) => ch + ch).join("") : hex[1];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  let fn = c.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
  return fn ? [Math.round(+fn[1]), Math.round(+fn[2]), Math.round(+fn[3])] : null;
}
function toRgb(color) {
  let t = parseRgb(color);
  return t ? `rgb(${t[0]}, ${t[1]}, ${t[2]})` : null;
}

// scripts/vendor/voice-glow/styles.ts
var themePresets = {
  dark: {
    strokeOpacity: 1.16,
    innerOpacity: 0.47,
    bloomOpacity: 0.89,
    innerShadow: "rgba(255, 255, 255, 0.1)",
    saturation: 1.2,
    brightness: 1.1
  },
  // Light sits on a white surface: the deep light palettes at far higher
  // opacity than the dark preset's pastels need, a touch less saturation
  // and no brightness lift (which would wash them toward white).
  light: {
    strokeOpacity: 1.2,
    innerOpacity: 0.85,
    bloomOpacity: 0.5,
    innerShadow: "rgba(0, 0, 0, 0.08)",
    saturation: 1.6,
    brightness: 0.95,
    // A wider, quicker hue drift on white, nudged 5° warmer.
    hueRange: 40,
    hueDuration: 8.5,
    hueBase: 5,
    // Tuned in the Studio on the chat input.
    strength: 0.8,
    bandStrength: 1.7
  }
}, voiceLobes = [
  { x: 0, w: 74, h: 46, band: 0 },
  { x: -36, w: 54, h: 40, band: 1 },
  { x: 36, w: 54, h: 40, band: 1 },
  { x: -72, w: 48, h: 32, band: 2 },
  { x: 72, w: 48, h: 32, band: 2 },
  { x: -108, w: 42, h: 26, band: 1 },
  { x: 108, w: 42, h: 26, band: 1 }
], LOBE_SPACING = 36, LOBE_SPAN = LOBE_SPACING * voiceLobes.length, voicePalettes = {
  colorful: {
    dark: [
      "rgb(255, 70, 120)",
      "rgb(60, 190, 255)",
      "rgb(175, 70, 255)",
      "rgb(60, 220, 130)",
      "rgb(255, 150, 40)",
      "rgb(90, 100, 255)",
      "rgb(40, 200, 190)"
    ],
    // Candy on white: pinks, sky, lavender, mint, peach, periwinkle,
    // aqua — pastel bodies that the light preset's saturation lifts.
    // Candy on white: gold, sky, violet, rose, peach, periwinkle, aqua —
    // tuned in the Studio; the light preset's saturation lifts them.
    light: [
      "rgb(255, 201, 21)",
      "rgb(126, 196, 255)",
      "rgb(180, 40, 230)",
      "rgb(235, 100, 160)",
      "rgb(255, 176, 122)",
      "rgb(154, 160, 255)",
      "rgb(127, 217, 238)"
    ]
  },
  mono: {
    dark: [
      "rgb(215, 215, 215)",
      "rgb(180, 180, 180)",
      "rgb(190, 190, 190)",
      "rgb(160, 160, 160)",
      "rgb(170, 170, 170)",
      "rgb(150, 150, 150)",
      "rgb(155, 155, 155)"
    ],
    light: [
      "rgb(60, 60, 60)",
      "rgb(90, 90, 90)",
      "rgb(85, 85, 85)",
      "rgb(110, 110, 110)",
      "rgb(105, 105, 105)",
      "rgb(125, 125, 125)",
      "rgb(120, 120, 120)"
    ]
  },
  ocean: {
    dark: [
      "rgb(80, 140, 255)",
      "rgb(40, 200, 230)",
      "rgb(120, 90, 255)",
      "rgb(30, 170, 210)",
      "rgb(160, 80, 240)",
      "rgb(60, 110, 255)",
      "rgb(40, 190, 180)"
    ],
    light: [
      "rgb(40, 100, 240)",
      "rgb(20, 160, 200)",
      "rgb(90, 60, 230)",
      "rgb(20, 130, 180)",
      "rgb(130, 50, 220)",
      "rgb(40, 80, 230)",
      "rgb(20, 150, 150)"
    ]
  },
  sunset: {
    dark: [
      "rgb(255, 110, 60)",
      "rgb(255, 180, 40)",
      "rgb(255, 60, 90)",
      "rgb(255, 210, 80)",
      "rgb(240, 70, 140)",
      "rgb(255, 140, 50)",
      "rgb(230, 50, 110)"
    ],
    light: [
      "rgb(235, 80, 30)",
      "rgb(230, 150, 10)",
      "rgb(230, 30, 70)",
      "rgb(225, 175, 30)",
      "rgb(215, 40, 110)",
      "rgb(235, 110, 20)",
      "rgb(205, 30, 90)"
    ]
  },
  forest: {
    dark: [
      "rgb(70, 220, 120)",
      "rgb(40, 200, 180)",
      "rgb(140, 230, 80)",
      "rgb(30, 170, 140)",
      "rgb(190, 235, 70)",
      "rgb(50, 190, 110)",
      "rgb(30, 150, 120)"
    ],
    light: [
      "rgb(30, 170, 80)",
      "rgb(20, 150, 130)",
      "rgb(90, 180, 30)",
      "rgb(20, 130, 100)",
      "rgb(130, 180, 20)",
      "rgb(30, 150, 80)",
      "rgb(20, 120, 90)"
    ]
  },
  candy: {
    dark: [
      "rgb(255, 90, 170)",
      "rgb(255, 120, 220)",
      "rgb(210, 80, 255)",
      "rgb(255, 150, 190)",
      "rgb(180, 110, 255)",
      "rgb(255, 70, 140)",
      "rgb(230, 100, 240)"
    ],
    light: [
      "rgb(235, 40, 140)",
      "rgb(230, 70, 190)",
      "rgb(180, 40, 230)",
      "rgb(235, 100, 160)",
      "rgb(150, 70, 230)",
      "rgb(230, 30, 110)",
      "rgb(200, 60, 210)"
    ]
  },
  ice: {
    dark: [
      "rgb(150, 230, 255)",
      "rgb(90, 200, 255)",
      "rgb(190, 240, 255)",
      "rgb(120, 190, 255)",
      "rgb(160, 220, 250)",
      "rgb(80, 170, 255)",
      "rgb(200, 235, 255)"
    ],
    light: [
      "rgb(30, 160, 220)",
      "rgb(20, 130, 210)",
      "rgb(60, 180, 230)",
      "rgb(40, 120, 220)",
      "rgb(50, 160, 220)",
      "rgb(20, 110, 220)",
      "rgb(70, 170, 230)"
    ]
  },
  gold: {
    dark: [
      "rgb(255, 200, 70)",
      "rgb(255, 170, 40)",
      "rgb(255, 220, 110)",
      "rgb(240, 150, 30)",
      "rgb(255, 235, 140)",
      "rgb(230, 160, 40)",
      "rgb(250, 210, 90)"
    ],
    light: [
      "rgb(200, 140, 10)",
      "rgb(190, 120, 0)",
      "rgb(210, 160, 30)",
      "rgb(180, 110, 0)",
      "rgb(205, 170, 40)",
      "rgb(175, 115, 5)",
      "rgb(195, 150, 20)"
    ]
  }
};
function withAlpha(color, alpha) {
  let m = color.match(/^rgb\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)$/);
  return m ? `rgba(${m[1]}, ${m[2]}, ${m[3]}, ${alpha.toFixed(2)})` : color;
}
function scaleBlur(px, glowSize = 1) {
  return Math.max(0.5, Math.round(px * glowSize * 100) / 100);
}
function lobeX(index, id) {
  return `calc(50% + (var(--vb-cx-${id}) + var(--vb-x${index}-${id})) * var(--vb-w-${id}) * var(--vb-z-${id}, 1))`;
}
function lobeGradients({ id, colors, alpha, sw, sh, y, fade, count }) {
  return (count ? voiceLobes.slice(0, count) : voiceLobes).map((lobe, i) => {
    let color = alpha >= 1 ? colors[i % colors.length] : withAlpha(colors[i % colors.length], alpha), w = `calc(${Math.round(lobe.w * sw)}px * var(--vb-w-${id}) * var(--vb-z-${id}, 1))`, h = `calc(${Math.round(lobe.h * sh)}px * var(--vb-h-${id}) * var(--vb-l${i}-${id}) * var(--vb-z-${id}, 1))`, yStr = `calc(100% + (${y}px + var(--vb-y${i}-${id})) * var(--vb-z-${id}, 1))`;
    return `radial-gradient(ellipse ${w} ${h} at ${lobeX(i, id)} ${yStr}, ${color} 0%, transparent ${fade}%)`;
  }).join(`,
    `);
}
function generateVoiceBeamCSS(options) {
  let {
    id,
    borderRadius,
    borderWidth,
    strokeOpacity,
    innerOpacity,
    bloomOpacity,
    innerShadow,
    colorVariant,
    colors: customColors,
    brightness,
    saturation,
    theme,
    hueBase = 0,
    glowSize = 1,
    glowWidth = 1,
    glowHeight = 1,
    strokeScale = 1,
    innerScale = 1,
    innerHeight = 1,
    bloomScale = 1,
    bloomHeight = 1,
    coreSize = 1,
    coreLight = 0,
    coreLightWidth = 1,
    coreLightHeight = 1,
    rangeWidth = 1,
    rangeHeight = 1,
    softness = 1,
    distortion = !1,
    scale = 1
  } = options, cornerFade = Math.round(28 * scale * 10) / 10, insetBlur = Math.round(9 * scale * 10) / 10, innerRadius = Math.max(0, borderRadius - borderWidth), fade = Math.round(Math.max(40, Math.min(95, 70 * softness))), gw = (m) => glowWidth * m, gh = (m) => glowHeight * m, px = (v) => Math.round(v * 10) / 10, Z = `var(--vb-z-${id}, 1)`, zpx = (v) => `calc(${px(v)}px * ${Z})`, isDark = theme === "dark", colors = voicePalettes[colorVariant][isDark ? "dark" : "light"].map((c, i) => {
    let custom = customColors?.[i];
    return custom && toRgb(custom) || c;
  }), monoMul = colorVariant === "mono" ? 0.6 : 1, sStroke = (strokeOpacity * monoMul).toFixed(2), sInner = (innerOpacity * monoMul).toFixed(2), sBloom = (bloomOpacity * monoMul).toFixed(2), b = brightness.toFixed(2), s = saturation.toFixed(2), hue = `hue-rotate(calc(var(--voice-hue-base, ${hueBase}deg) + var(--vb-hue-${id})))`, warp = distortion ? ` url(#vb-distort-${id})` : "", layerFilter = `filter: ${hue} brightness(${b}) saturate(${s});`, innerFilter = `filter: ${hue} brightness(${b}) saturate(${s})${warp};`, bloomFilter = `filter: blur(${zpx(scaleBlur(10, glowSize))}) ${hue} brightness(${b}) saturate(${s});`, bloomWarpFilter = `filter: blur(${zpx(scaleBlur(10, glowSize))}) ${hue} brightness(${b}) saturate(${s})${warp};`, beamX = `calc(50% + var(--vb-cx-${id}) * var(--vb-w-${id}) * ${Z})`, coreY = `calc(100% + (2px + var(--vb-cy-${id})) * ${Z})`, highlight = isDark ? `radial-gradient(ellipse calc(${px(30 * coreSize)}px * var(--vb-w-${id}) * ${Z}) calc(${px(30 * coreSize)}px * var(--vb-h-${id}) * ${Z}) at ${beamX} ${coreY}, rgba(255, 255, 255, 0.45) 0%, rgba(255, 255, 255, 0.14) 30%, transparent 65%)` : `radial-gradient(ellipse calc(${px(40 * coreSize)}px * var(--vb-w-${id}) * ${Z}) calc(${px(30 * coreSize)}px * var(--vb-h-${id}) * ${Z}) at ${beamX} ${coreY}, rgba(0, 0, 0, 0.55) 0%, rgba(0, 0, 0, 0.22) 35%, transparent 70%)`, strokeGradients = lobeGradients({ id, colors, alpha: 1, sw: gw(strokeScale), sh: gh(strokeScale), y: 2, fade }), innerGradients = lobeGradients({ id, colors, alpha: 0.46, sw: gw(0.9 * innerScale), sh: gh(0.9 * innerScale * innerHeight), y: 0, fade }), bloomGradients = lobeGradients({ id, colors, alpha: isDark ? 0.9 : 0.7, sw: gw(1.15 * bloomScale), sh: gh(1.5 * bloomScale * bloomHeight), y: 0, fade: Math.min(95, fade + 2) }), edgeMask = (w, h, mid, tail = 0) => `radial-gradient(ellipse calc(${px(w * rangeWidth)}px * var(--vb-w-${id}) * var(--vb-mw-${id}) * ${Z}) calc((${px(h * rangeHeight)}px * var(--vb-h-${id}) + var(--vb-bh-${id})) * ${Z}) at ${beamX} calc(100% + var(--vb-cy-${id}) * ${Z}), white 0%, rgba(255, 255, 255, 0.5) ${mid}%${tail > 0 ? `, rgba(255, 255, 255, ${tail}) 85%` : ""}, transparent 100%)`, opacity = (layer, preset) => `opacity: calc(var(--vb-opacity-${id}, 1) * var(--vb-glow-${id}) * ${preset} * var(--voice-${layer}-opacity, 1) * var(--voice-strength, 1));`, innerRule = (selector, head, clip, filter) => `${selector} {
  ${head}
  position: absolute;
  inset: 0;
  border-radius: ${zpx(borderRadius)};
  background: ${innerGradients};
  box-shadow: inset 0 0 ${zpx(insetBlur)} 1px ${innerShadow};
  -webkit-mask-image:
    ${edgeMask(170, 64, 45, 0.3)},
    linear-gradient(white, transparent ${zpx(cornerFade)}, transparent calc(100% - ${cornerFade}px * ${Z}), white),
    linear-gradient(to right, white, transparent ${zpx(cornerFade)}, transparent calc(100% - ${cornerFade}px * ${Z}), white);
  -webkit-mask-composite: source-in, source-over;
  mask-image:
    ${edgeMask(170, 64, 45, 0.3)},
    linear-gradient(white, transparent ${zpx(cornerFade)}, transparent calc(100% - ${cornerFade}px * ${Z}), white),
    linear-gradient(to right, white, transparent ${zpx(cornerFade)}, transparent calc(100% - ${cornerFade}px * ${Z}), white);
  mask-composite: intersect, add;
  pointer-events: none;
  /* Its own compositing layer: WebKit otherwise re-rasterizes the
     filtered layer into the parent every frame on the CPU (a phone-sized
     host runs at a sixth of the frame rate without this). */
  will-change: transform;
  z-index: 1;
  ${clip}
  ${opacity("inner", sInner)}
  ${filter}
}`;
  return `
@property --vb-opacity-${id} {
  syntax: "<number>";
  initial-value: 0;
  inherits: true;
}

[data-voice-beam="${id}"] {
  position: relative;
  border-radius: ${borderRadius}px;
  overflow: hidden;
  --vb-h-${id}: 0.8;
  --vb-w-${id}: 1;
${voiceLobes.map((lobe, i) => `  --vb-x${i}-${id}: ${lobe.x}px;
  --vb-l${i}-${id}: 1;
  --vb-y${i}-${id}: 0px;`).join(`
`)}
  --vb-glow-${id}: 0.4;
  --vb-z-${id}: 1;
  --vb-cx-${id}: 0px;
  --vb-cy-${id}: 0px;
  --vb-bh-${id}: 0px;
  --vb-bendA-${id}: 0;
  --vb-mw-${id}: 1;
  --vb-hue-${id}: 0deg;
  --vb-level-${id}: 0;
}

[data-voice-beam="${id}"][data-active] {
  animation: vb-fade-in-${id} 0.6s ease forwards;
}

[data-voice-beam="${id}"][data-fading] {
  animation: vb-fade-out-${id} 0.5s ease forwards;
}

/* Stroke \u2014 the colours painted into the 1px edge ring, masked to the centred ellipse. */
[data-voice-beam="${id}"][data-active]::after,
[data-voice-beam="${id}"][data-fading]::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: ${zpx(innerRadius)};
  padding: ${zpx(borderWidth)};
  clip-path: inset(0 round ${zpx(borderRadius)});
  background:
    ${highlight},
    ${strokeGradients};
  -webkit-mask:
    ${edgeMask(170, 64, 45)},
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0);
  -webkit-mask-composite: source-in, xor;
  mask:
    ${edgeMask(170, 64, 45)},
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0);
  mask-composite: intersect, exclude;
  pointer-events: none;
  /* Its own compositing layer: WebKit otherwise re-rasterizes the
     filtered layer into the parent every frame on the CPU (a phone-sized
     host runs at a sixth of the frame rate without this). */
  will-change: transform;
  z-index: 2;
  ${opacity("stroke", sStroke)}
  ${layerFilter}
}

/* Inner glow \u2014 soft light inside the element, faded off at the corners.
   With distortion on, this copy is clipped to ABOVE the band line (the
   polygon the driver writes each frame) and a mirror layer below carries
   the displacement filter, so only the glow under the line warps. */
${innerRule(`[data-voice-beam="${id}"][data-active]::before,
[data-voice-beam="${id}"][data-fading]::before`, 'content: "";', distortion ? `clip-path: var(--vb-clip-above-${id}, inset(0 round ${borderRadius}px));` : `clip-path: inset(0 round ${borderRadius}px);`, layerFilter)}
${distortion ? innerRule(`[data-voice-beam="${id}"][data-active] [data-voice-beam-warp="inner"],
[data-voice-beam="${id}"][data-fading] [data-voice-beam-warp="inner"]`, "display: block;", `clip-path: var(--vb-clip-below-${id}, inset(0 round ${borderRadius}px));`, innerFilter) : ""}

/* Bloom \u2014 the blurred halo, tallest of the three, above the content. */
[data-voice-beam="${id}"] [data-voice-beam-bloom],
[data-voice-beam="${id}"] [data-voice-beam-warp] {
  display: none;
  position: absolute;
  inset: 0;
  border-radius: ${zpx(innerRadius)};
  pointer-events: none;
  /* Its own compositing layer: WebKit otherwise re-rasterizes the
     filtered layer into the parent every frame on the CPU (a phone-sized
     host runs at a sixth of the frame rate without this). */
  will-change: transform;
  opacity: 0;
}

[data-voice-beam="${id}"] [data-voice-beam-bloom],
[data-voice-beam="${id}"] [data-voice-beam-warp="bloom"] {
  -webkit-mask: ${edgeMask(200, 130, 35)};
  mask: ${edgeMask(200, 130, 35)};
  background: ${bloomGradients};
  z-index: 3;
}

[data-voice-beam="${id}"][data-active] [data-voice-beam-bloom],
[data-voice-beam="${id}"][data-fading] [data-voice-beam-bloom] {
  display: block;
  clip-path: ${distortion ? `var(--vb-clip-above-${id}, inset(0 round ${borderRadius}px))` : `inset(0 round ${borderRadius}px)`};
  ${opacity("bloom", sBloom)}
  ${bloomFilter}
}
${distortion ? `
[data-voice-beam="${id}"][data-active] [data-voice-beam-warp="bloom"],
[data-voice-beam="${id}"][data-fading] [data-voice-beam-warp="bloom"] {
  display: block;
  clip-path: var(--vb-clip-below-${id}, inset(0 round ${borderRadius}px));
  ${opacity("bloom", sBloom)}
  ${bloomWarpFilter}
}

/* Processing drops the distortion: the driver marks the wrapper once the
   warp has faded out, the warp layers leave the paint and the base layers
   give up their split at the band line. */
[data-voice-beam="${id}"][data-voice-warp="off"]::before,
[data-voice-beam="${id}"][data-voice-warp="off"] [data-voice-beam-bloom] {
  clip-path: inset(0 round ${borderRadius}px);
}

[data-voice-beam="${id}"][data-voice-warp="off"] [data-voice-beam-warp] {
  display: none;
}` : ""}

/* Epicentre \u2014 a soft white wash at the source, under the band line (the
   driver's clip; unclipped when no line is drawn), sitting above every
   glow layer and the band's halo so the centre reads lighter than the
   band (same z as the band canvases, painted after them). Sized by the voice like the
   other layers; off unless \`coreLight\` is set (the light theme sets it).
   Up to 1 it is the wash's opacity; past 1 the solid white core widens
   too, for a centre that stays lighter than a strong band. It follows the
   glow's presence but not \`strength\`, which would only dim it. */
${coreLight > 0 ? (() => {
    let boost = Math.max(0, Math.min(2, coreLight - 1)), b1 = Math.min(1, boost), b2 = Math.max(0, boost - 1), grow = 1 + 0.3 * boost, solid = px(45 * b1 + 27 * b2), midStop = px(40 + 25 * b1 + 15 * b2), midAlpha = Math.min(1, 0.55 + 0.35 * b1 + 0.1 * b2).toFixed(2), endStop = px(72 + 14 * b1 + 8 * b2);
    return `[data-voice-beam="${id}"] [data-voice-beam-core] {
  display: none;
  position: absolute;
  inset: 0;
  border-radius: ${zpx(innerRadius)};
  overflow: hidden;
  pointer-events: none;
  /* Its own compositing layer: WebKit otherwise re-rasterizes the
     filtered layer into the parent every frame on the CPU (a phone-sized
     host runs at a sixth of the frame rate without this). */
  will-change: transform;
  /* The blur sits on this wrapper and the band-line clip on the child,
     so the cut edge is blurred too rather than left hard. */
  filter: blur(${zpx(scaleBlur(8, glowSize))});
  z-index: 4;
}

[data-voice-beam="${id}"] [data-voice-beam-core] > div {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse calc(${px(120 * coreLightWidth * grow * scale)}px * var(--vb-w-${id}) * ${Z}) calc((${px(70 * coreLightHeight * grow * scale)}px * var(--vb-h-${id}) + var(--vb-bh-${id})) * ${Z}) at ${beamX} calc(100% + var(--vb-cy-${id}) * ${Z}), white 0%, white ${solid}%, rgba(255, 255, 255, ${midAlpha}) ${midStop}%, transparent ${endStop}%);
  clip-path: var(--vb-clip-below-${id}, none);
}

[data-voice-beam="${id}"][data-active] [data-voice-beam-core],
[data-voice-beam="${id}"][data-fading] [data-voice-beam-core] {
  display: block;
  opacity: calc(var(--vb-opacity-${id}, 1) * min(1, var(--vb-glow-${id}) * ${Math.min(1, coreLight).toFixed(2)} * ${(1.6 + 1.4 * boost).toFixed(2)}) * var(--voice-core-light-opacity, 1));
}
`;
  })() : ""}
/* Band \u2014 the canvas the driver draws the bend's contour on: an organic
   bell with chromatic fringes. Fades with the root, follows the strength
   and turns with the hue drift like the other layers. */
[data-voice-beam="${id}"] [data-voice-beam-band],
[data-voice-beam="${id}"] [data-voice-beam-band-halo] {
  display: none;
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  /* Its own compositing layer: WebKit otherwise re-rasterizes the
     filtered layer into the parent every frame on the CPU (a phone-sized
     host runs at a sixth of the frame rate without this). */
  will-change: transform;
  z-index: 4;
}

[data-voice-beam="${id}"][data-active] [data-voice-beam-band],
[data-voice-beam="${id}"][data-fading] [data-voice-beam-band],
[data-voice-beam="${id}"][data-active] [data-voice-beam-band-halo],
[data-voice-beam="${id}"][data-fading] [data-voice-beam-band-halo] {
  display: block;
  opacity: calc(var(--vb-opacity-${id}, 1) * var(--voice-band-opacity, 1) * var(--voice-strength, 1));
  /* The blur vars are 0 where the canvas blurs its own strokes; where the
     2D context has no filter (WebKit) the driver sets them and the layers
     are blurred here instead \u2014 the ridge on the band canvas, its wider
     halo on the canvas beneath. */
  filter: blur(var(--vb-band-blur-${id}, 0px)) ${hue} brightness(${b}) saturate(${s});
}

[data-voice-beam="${id}"][data-active] [data-voice-beam-band-halo],
[data-voice-beam="${id}"][data-fading] [data-voice-beam-band-halo] {
  filter: blur(var(--vb-band-halo-blur-${id}, 0px)) ${hue} brightness(${b}) saturate(${s});
}

/* Resolution. The soft layers \u2014 inner light and its warp mirror, bloom and
   its mirror, the epicentre \u2014 are rastered at half size and scaled back
   up by the compositor: the box is halved, every length inside rides the
   layer's factor \`--vb-z\` at 0.5 (the driver also writes the band-line
   clips at half scale), and the will-change transform is rastered
   pre-scale where the engine does that (Chromium, Safari 18). For blurred
   gradients that is the same picture at a quarter of the raster and
   filter work, which is what a phone at 3x runs out of. The 1px stroke
   stays full-res on every screen: at half size it is half a CSS pixel,
   which a 3x phone rasters into a faint smear instead of the hairline,
   and the layer is cheap (no blur). The component sets
   \`data-voice-halfres\`. */
[data-voice-beam="${id}"][data-voice-halfres]::before,
[data-voice-beam="${id}"][data-voice-halfres] [data-voice-beam-warp],
[data-voice-beam="${id}"][data-voice-halfres] [data-voice-beam-bloom],
[data-voice-beam="${id}"][data-voice-halfres] [data-voice-beam-core] {
  --vb-z-${id}: 0.5;
  inset: auto;
  left: 0;
  top: 0;
  width: 50%;
  height: 50%;
  transform: translateZ(0) scale(2);
  transform-origin: 0 0;
}
${distortion ? `[data-voice-beam="${id}"][data-voice-halfres][data-active]::before,
[data-voice-beam="${id}"][data-voice-halfres][data-fading]::before,
[data-voice-beam="${id}"][data-voice-halfres][data-active] [data-voice-beam-bloom],
[data-voice-beam="${id}"][data-voice-halfres][data-fading] [data-voice-beam-bloom] {
  clip-path: var(--vb-clip-above-z-${id}, inset(0 round ${zpx(borderRadius)}));
}
[data-voice-beam="${id}"][data-voice-halfres][data-active] [data-voice-beam-warp],
[data-voice-beam="${id}"][data-voice-halfres][data-fading] [data-voice-beam-warp] {
  clip-path: var(--vb-clip-below-z-${id}, inset(0 round ${zpx(borderRadius)}));
}
/* Processing (warp off): the mirrors are gone, so the base layers paint
   the whole box again \u2014 this must outweigh the split above. */
[data-voice-beam="${id}"][data-voice-halfres][data-voice-warp="off"]::before,
[data-voice-beam="${id}"][data-voice-halfres][data-voice-warp="off"] [data-voice-beam-bloom] {
  clip-path: inset(0 round ${zpx(borderRadius)});
}` : `[data-voice-beam="${id}"][data-voice-halfres][data-active]::before,
[data-voice-beam="${id}"][data-voice-halfres][data-fading]::before,
[data-voice-beam="${id}"][data-voice-halfres][data-active] [data-voice-beam-bloom],
[data-voice-beam="${id}"][data-voice-halfres][data-fading] [data-voice-beam-bloom] {
  clip-path: inset(0 round ${zpx(borderRadius)});
}`}
[data-voice-beam="${id}"][data-voice-halfres] [data-voice-beam-core] > div {
  clip-path: var(--vb-clip-below-z-${id}, none);
}
@keyframes vb-fade-in-${id} {
  to { --vb-opacity-${id}: 1; }
}

@keyframes vb-fade-out-${id} {
  from { --vb-opacity-${id}: 1; }
  to { --vb-opacity-${id}: 0; }
}

[data-voice-beam="${id}"][data-paused],
[data-voice-beam="${id}"][data-paused]::after,
[data-voice-beam="${id}"][data-paused]::before,
[data-voice-beam="${id}"][data-paused] [data-voice-beam-bloom] {
  animation-play-state: paused !important;
}
`;
}

// scripts/vendor/voice-glow/audio.ts
var acquireAnalyser = () => null;

// scripts/vendor/voice-glow/voiceDriver.ts
var REST = { gather: 0, offset: 0, stretch: 0, heldLevel: 0, cornerFollow: 0 }, stateByElement = /* @__PURE__ */ new WeakMap();
function stateFor(el) {
  let s = stateByElement.get(el);
  return s || (s = { level: 0, bands: [0, 0, 0], phase: 0, motion: { ...REST }, t: 0, lastTs: 0, warp: 1, drift: 0, fast: 0, fastBands: [0, 0, 0] }, stateByElement.set(el, s)), s;
}
var instances = /* @__PURE__ */ new Set(), surfaceLobeX = new Float32Array(voiceLobes.length), surfaceLobeL = new Float32Array(voiceLobes.length), rafId = null, lastFrame = 0, FRAME_INTERVAL = 1e3 / 60 - 2, PACE_SLOW_GAP = 22, PACE_SLOW_FOR = 500, PACE_PROBE_EVERY = 4e3, lastRaf = 0, paceHalf = !1, paceSkip = !1, slowSince = 0, probeAt = 0, TWO_PI = Math.PI * 2, BASE_GAIN = 5, BAND_GAIN = 1.7, BANDS = [
  [80, 300],
  [300, 2e3],
  [2e3, 6e3]
];
function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
function wrapX(x, span) {
  let half = span / 2;
  return ((x + half) % span + span) % span - half;
}
function edgeEnvelope(x, span) {
  let t = x / (span / 2 + 4);
  return Math.max(0, 1 - t * t);
}
function shape(raw, threshold) {
  if (raw <= threshold) return 0;
  let t = (raw - threshold) / Math.max(1e-3, 1 - threshold);
  return clamp01((1 - Math.exp(-3 * t)) / (1 - Math.exp(-3)));
}
function follow(prev, target, dt, attack, release) {
  let tau = target > prev ? attack : release, a = 1 - Math.exp(-dt / Math.max(1e-3, tau));
  return prev + (target - prev) * a;
}
var BAND_DPR_MAX = 2, WARP_OUT_TAU = 0.06, WARP_IN_TAU = 0.35, WARP_OFF_BELOW = 0.03, FAST_RELEASE = 0.03, FILTER_REGION_OK = !(typeof navigator < "u" && /AppleWebKit/.test(navigator.userAgent) && !/Chrome\/|Chromium\/|Edg\/|OPR\//.test(navigator.userAgent)), FILTER_TOP_STEP = 0.05, FILTER_TOP_MARGIN = 6, FILTER_BOTTOM_MARGIN = 12, FILTER_BOTTOM_FRACTION = 0.1, FILTER_SIDE = 0.1, CEILING_HALF_WIDTH = 170, CEILING_HEIGHT = 64, BAND_SAMPLES = 56;
function bell(t, p, sigma, skew) {
  let side = t < 0 ? 1 - skew : 1 + skew, s = Math.max(0.05, sigma * side), v = Math.exp(-Math.pow(Math.abs(t) / s, p)), tail = Math.exp(-Math.pow(1 / s, p));
  return Math.max(0, (v - tail) / (1 - tail));
}
function tailLift(dist, edge, lift, position, curve) {
  if (lift <= 0 || edge <= 0) return 0;
  let start = edge * Math.max(0, Math.min(0.98, position));
  if (dist <= start) return 0;
  let u = Math.min(1, (dist - start) / Math.max(1, edge - start));
  return lift * Math.pow(u, Math.max(0.5, curve));
}
function paintedRadius(radius, cw, ch) {
  return Math.max(0, Math.min(radius, cw / 2, ch / 2));
}
function cornerLift(x, cw, radius, influence = 0) {
  if (radius <= 0) return 0;
  let d = Math.min(x, cw - x) - influence;
  if (d >= radius) return 0;
  if (d <= 0) return radius;
  let dx = radius - d;
  return radius - Math.sqrt(Math.max(0, radius * radius - dx * dx));
}
function bandPoints(config, f, cw, ch) {
  let centre = cw / 2 + f.cx * f.w, half = CEILING_HALF_WIDTH * config.rangeWidth * f.w * f.mw, apexCap = ch * 0.82 * Math.min(1, config.scale), apex = Math.min(apexCap, (CEILING_HEIGHT * config.rangeHeight * f.h + f.lift) * config.bandPosition), base = ch - config.bandOffset, tailT = Math.min(1, f.corner * 4), tail = config.bandTail * (1 - tailT * tailT * (3 - 2 * tailT)), withTail = tail > 1e-3, over = withTail ? config.bandTailOverflow : 0, x0 = withTail ? -over : centre - half, x1 = withTail ? cw + over : centre + half, pts = [];
  for (let i = 0; i <= BAND_SAMPLES; i++) {
    let x = x0 + (x1 - x0) * i / BAND_SAMPLES, t = Math.max(-1, Math.min(1, (x - centre) / Math.max(1, half))), edge = (x < centre ? centre : cw - centre) + over, y = bell(t, config.bandCurve, config.bandSpread, config.bandSkew) + tailLift(Math.abs(x - centre), edge, tail, config.bandTailPosition, config.bandTailCurve), arc = f.corner > 0 ? cornerLift(x, cw, paintedRadius(config.radius, cw, ch)) * f.corner : 0;
    pts.push([x, base - apex * y - arc]);
  }
  return pts;
}
function writeClips(el, id, pts, cw, ch) {
  for (let [suffix, k] of [["", 1], ["-z", 0.5]]) {
    let px = (v) => (v * k).toFixed(1) + "px", line = pts.map(([x, y]) => `${px(x)} ${px(y)}`), below = `polygon(0 ${px(ch)}, ${line.join(", ")}, ${px(cw)} ${px(ch)})`, above = `polygon(0 0, ${px(cw)} 0, ${px(cw)} ${px(ch)}, ${line.slice().reverse().join(", ")}, 0 ${px(ch)})`;
    el.style.setProperty(`--vb-clip-below${suffix}-${id}`, below), el.style.setProperty(`--vb-clip-above${suffix}-${id}`, above);
  }
}
function fitFilterRegion(inst, pts, ch) {
  let minY = ch;
  for (let i = 0; i < pts.length; i++) pts[i][1] < minY && (minY = pts[i][1]);
  let top = Math.max(0, Math.min(0.9, Math.floor((minY - FILTER_TOP_MARGIN) / ch / FILTER_TOP_STEP) * FILTER_TOP_STEP));
  if (top === inst.filterTop) return;
  inst.filterTop = top;
  let bottom = 1 + Math.max(FILTER_BOTTOM_FRACTION, FILTER_BOTTOM_MARGIN / ch), f = inst.filter;
  f.setAttribute("x", `${-FILTER_SIDE * 100}%`), f.setAttribute("width", `${(1 + 2 * FILTER_SIDE) * 100}%`), f.setAttribute("y", `${(top * 100).toFixed(0)}%`), f.setAttribute("height", `${((bottom - top) * 100).toFixed(1)}%`);
}
function drawBand(inst, f, pts) {
  let { canvas, ctx, el, config } = inst;
  if (!canvas || !ctx) return;
  let cw = config.width ?? el.clientWidth, ch = config.height ?? el.clientHeight;
  if (!cw || !ch) return;
  let dpr = Math.min(BAND_DPR_MAX, typeof window < "u" && window.devicePixelRatio || 1), pw = Math.round(cw * dpr), ph = Math.round(ch * dpr);
  (canvas.width !== pw || canvas.height !== ph) && (canvas.width = pw, canvas.height = ph), ctx.setTransform(dpr, 0, 0, dpr, 0, 0), ctx.clearRect(0, 0, cw, ch);
  let haloCanvas = inst.haloCanvas, haloCtx = inst.haloCtx;
  haloCanvas && haloCtx && ((haloCanvas.width !== pw || haloCanvas.height !== ph) && (haloCanvas.width = pw, haloCanvas.height = ph), haloCtx.setTransform(dpr, 0, 0, dpr, 0, 0), haloCtx.clearRect(0, 0, cw, ch));
  let alpha = Math.min(1, 0.6 * config.bandStrength * f.strength);
  if (alpha < 5e-3 || config.bandWidth <= 0) return;
  let isDark = config.theme === "dark", bw = config.bandWidth * (1 + 0.35 * f.level), split = config.bandAberration * (0.35 + 0.65 * f.level), dy = (4 + 12 * split) * config.scale, dx = 4 * split * config.scale, trace = (ox, oy) => {
    ctx.beginPath(), ctx.moveTo(pts[0][0] + ox, pts[0][1] + oy);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0] + ox, pts[i][1] + oy);
  }, colours = { r: config.bandColors.above, g: config.bandColors.mid, c: config.bandColors.core, b: config.bandColors.below }, base = (isDark ? 0.42 : 0.4) * alpha, thickness = 14 * bw, blurCss = 3.5 * config.bandWidth / 2, blurPx = blurCss * dpr, canBlur = typeof ctx.filter == "string", cssBlur = canBlur ? "0px" : `${blurCss.toFixed(2)}px`;
  inst.cssBlur !== cssBlur && (el.style.setProperty(`--vb-band-blur-${config.id}`, cssBlur), el.style.setProperty(`--vb-band-halo-blur-${config.id}`, canBlur ? "0px" : `${(blurCss * 3).toFixed(2)}px`), inst.cssBlur = cssBlur);
  let ramp = [
    [1, 0.16],
    [0.72, 0.2],
    [0.46, 0.26],
    [0.22, 0.34]
  ], ridges = [
    { rgb: colours.r, a: 1, ox: dx, oy: -dy },
    { rgb: colours.g, a: 0.55, ox: dx * 0.35, oy: -dy * 0.35 },
    { rgb: colours.b, a: 1, ox: -dx, oy: dy },
    { rgb: colours.c, a: 0.9, ox: 0, oy: 0 }
  ];
  ctx.lineCap = "round", ctx.lineJoin = "round", ctx.globalCompositeOperation = "source-over";
  let x0 = pts[0][0], x1 = pts[pts.length - 1][0], endsFaded = (rgb, a) => {
    let grad = ctx.createLinearGradient(x0, 0, x1, 0), fade = config.bandTail > 0 ? 0.015 : 0.18;
    return grad.addColorStop(0, `rgba(${rgb}, 0)`), grad.addColorStop(fade, `rgba(${rgb}, ${a.toFixed(3)})`), grad.addColorStop(1 - fade, `rgba(${rgb}, ${a.toFixed(3)})`), grad.addColorStop(1, `rgba(${rgb}, 0)`), grad;
  }, hc = !canBlur && haloCtx ? haloCtx : ctx;
  canBlur && (ctx.filter = `blur(${(blurPx * 3).toFixed(1)}px)`), hc.lineCap = "round", hc.lineJoin = "round", hc.strokeStyle = endsFaded(colours.c, base * 0.3), hc.lineWidth = thickness * 2.2, hc.beginPath(), hc.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) hc.lineTo(pts[i][0], pts[i][1]);
  hc.stroke(), canBlur && (ctx.filter = `blur(${blurPx.toFixed(1)}px)`);
  for (let ridge of ridges)
    for (let [widthMul, alphaMul] of ramp)
      ctx.strokeStyle = endsFaded(ridge.rgb, base * ridge.a * alphaMul), ctx.lineWidth = Math.max(0.6, thickness * widthMul), trace(ridge.ox, ridge.oy), ctx.stroke();
  canBlur && (ctx.filter = "none"), ctx.globalCompositeOperation = "source-over";
}
function pingPong(phase) {
  return (1 - Math.cos(TWO_PI * phase)) / 2;
}
function readAnalyser(inst, out) {
  let analyser = inst.analyser, time = inst.time, freq = inst.freq;
  analyser.getFloatTimeDomainData(time);
  let sum = 0;
  for (let i = 0; i < time.length; i++) sum += time[i] * time[i];
  out.level = Math.sqrt(sum / time.length) * BASE_GAIN * inst.config.sensitivity, analyser.getByteFrequencyData(freq);
  let binHz = analyser.context.sampleRate / analyser.fftSize;
  for (let b = 0; b < 3; b++) {
    let [lo, hi] = BANDS[b], from = Math.max(0, Math.floor(lo / binHz)), to = Math.min(freq.length - 1, Math.ceil(hi / binHz)), acc = 0;
    for (let i = from; i <= to; i++) acc += freq[i];
    let avg = to >= from ? acc / (to - from + 1) / 255 : 0;
    out.bands[b] = avg * BAND_GAIN * inst.config.sensitivity;
  }
}
var scratch = { level: 0, bands: [0, 0, 0] };
function frame(ts) {
  rafId = requestAnimationFrame(frame);
  let gap = lastRaf ? ts - lastRaf : 0;
  if (lastRaf = ts, paceHalf) {
    if (paceSkip = !paceSkip, paceSkip) return;
    ts >= probeAt && (paceHalf = !1, slowSince = 0);
  } else gap > PACE_SLOW_GAP ? slowSince ? ts - slowSince > PACE_SLOW_FOR && (paceHalf = !0, paceSkip = !1, probeAt = ts + PACE_PROBE_EVERY) : slowSince = ts : slowSince = 0;
  ts - lastFrame < FRAME_INTERVAL || (lastFrame = ts, instances.forEach((inst) => {
    let { el, config, source, s } = inst, paused = config.paused;
    if (paused && inst.paintedConfig === config) return;
    let dt = paused ? 0 : s.lastTs ? Math.min(0.05, (ts - s.lastTs) / 1e3) : 1 / 60;
    s.lastTs = ts, s.t += dt;
    let tSec = s.t;
    if (!paused)
      if (inst.analyser)
        readAnalyser(inst, scratch);
      else {
        let raw = source.getLevel ? clamp01(source.getLevel()) : 0;
        scratch.level = raw, scratch.bands[0] = raw, scratch.bands[1] = raw * (0.72 + 0.28 * Math.sin(tSec * 9.1)), scratch.bands[2] = raw * (0.6 + 0.4 * Math.sin(tSec * 13.7 + 2));
      }
    let target = shape(scratch.level, config.threshold);
    s.level = follow(s.level, target, dt, config.attack, config.release);
    for (let b = 0; b < 3; b++) {
      let bt = shape(scratch.bands[b], config.threshold * 0.6);
      s.bands[b] = follow(s.bands[b], bt, dt, config.attack, config.release * 1.15), inst.surface && (s.fastBands[b] = follow(s.fastBands[b], bt, dt, config.attack * 0.6, FAST_RELEASE));
    }
    inst.surface && (s.fast = follow(s.fast, target, dt, config.attack * 0.6, FAST_RELEASE));
    let span = LOBE_SPAN * config.lobeSpacing;
    if (!paused) {
      let m = source.getMotion?.();
      s.motion = m ? {
        gather: clamp01(m.gather),
        offset: m.offset ?? 0,
        stretch: clamp01(m.stretch ?? 0),
        heldLevel: clamp01(m.heldLevel ?? 0),
        cornerFollow: clamp01(m.cornerFollow ?? 0)
      } : REST;
    }
    let motion = s.motion, morph = motion.gather, cw = config.width ?? el.clientWidth, ch = config.height ?? el.clientHeight, cx = config.reducedMotion ? 0 : motion.offset * span / 2, gather = 1 - morph * 0.6, maskWidth = 1 - morph * 0.45, passWidth = 1 + morph * 0.3 * motion.stretch, breathe = config.reducedMotion ? 0.5 : 0.5 + 0.5 * Math.sin(TWO_PI * tSec / config.breatheDuration), voiced = s.level + (1 - s.level) * config.idle * breathe, heldT = Math.max(0, Math.min(1, (morph - 0.25) / 0.75)), held = heldT * heldT * (3 - 2 * heldT), eff = Math.max(voiced, motion.heldLevel * held), glow = 0.15 + 0.85 * eff, h = 0.5 + config.reach * eff, w = (0.85 + config.spread * eff) * passWidth;
    config.flow !== 0 && !config.reducedMotion && (s.phase = ((s.phase + config.flow * eff * dt) % span + span) % span, s.drift += config.flow * eff * dt), el.style.setProperty(`--vb-level-${config.id}`, s.level.toFixed(3)), el.style.setProperty(`--vb-cx-${config.id}`, `${cx.toFixed(1)}px`), el.style.setProperty(`--vb-mw-${config.id}`, maskWidth.toFixed(3));
    let lift = config.bend * eff;
    el.style.setProperty(`--vb-bh-${config.id}`, `${Math.max(0, lift).toFixed(1)}px`);
    let bendA = config.bend > 0 ? Math.min(1, lift / config.bend) : 0;
    el.style.setProperty(`--vb-bendA-${config.id}`, bendA.toFixed(3));
    let frame2 = { cx, w, h, mw: maskWidth, lift, strength: bendA, level: s.level, corner: morph }, beamAbsX = cw / 2 + cx * w, lobeReach = 30 * config.scale * w, arcRadius = paintedRadius(config.radius, cw, ch), cornerBlend = morph * motion.cornerFollow;
    el.style.setProperty(`--vb-cy-${config.id}`, `${(-cornerLift(beamAbsX, cw, arcRadius, lobeReach * 1.4) * cornerBlend).toFixed(1)}px`), s.warp = follow(s.warp, morph > 0.02 ? 0 : 1, dt, WARP_IN_TAU, WARP_OUT_TAU);
    let warp = s.warp, warpOff = inst.displace != null && warp < WARP_OFF_BELOW;
    if (warpOff !== inst.warpOff && (inst.warpOff = warpOff, warpOff ? el.setAttribute("data-voice-warp", "off") : el.removeAttribute("data-voice-warp")), cw && ch && (inst.ctx || inst.displace)) {
      let pts = bandPoints(config, frame2, cw, ch);
      (inst.displace && !warpOff || config.coreLight > 0) && writeClips(el, config.id, pts, cw, ch), inst.filter && !warpOff && FILTER_REGION_OK && fitFilterRegion(inst, pts, ch), inst.ctx && drawBand(inst, frame2, pts);
    }
    if (inst.displace && !warpOff) {
      let amount = config.reducedMotion ? 0 : config.distortion * 120 * config.scale * (0.15 + 0.85 * eff) * warp;
      inst.displace.scale.baseVal = amount, inst.noiseShift && (inst.noiseShift.dx.baseVal = 8 * config.scale * Math.sin(tSec * 0.9), inst.noiseShift.dy.baseVal = 4 * config.scale * Math.sin(tSec * 0.6 + 1.3));
    }
    el.style.setProperty(`--vb-glow-${config.id}`, glow.toFixed(3)), el.style.setProperty(`--vb-h-${config.id}`, h.toFixed(3)), el.style.setProperty(`--vb-w-${config.id}`, w.toFixed(3));
    for (let i = 0; i < voiceLobes.length; i++) {
      let lobe = voiceLobes[i], x = wrapX(lobe.x * config.lobeSpacing + s.phase, span), bandLift = config.bands ? 0.6 + 0.7 * s.bands[lobe.band] : 1;
      el.style.setProperty(`--vb-x${i}-${config.id}`, `${(x * gather).toFixed(1)}px`), el.style.setProperty(`--vb-l${i}-${config.id}`, (bandLift * edgeEnvelope(x, span)).toFixed(3));
      let lobeAbsX = cw / 2 + (cx + x * gather) * w;
      el.style.setProperty(`--vb-y${i}-${config.id}`, `${(-cornerLift(lobeAbsX, cw, arcRadius, lobeReach) * cornerBlend).toFixed(1)}px`);
    }
    let hue = config.staticColors || config.reducedMotion || config.hueRange === 0 ? 0 : -config.hueRange + 2 * config.hueRange * pingPong(tSec / config.hueDuration);
    el.style.setProperty(`--vb-hue-${config.id}`, `${hue.toFixed(2)}deg`), inst.onLevel?.(s.level), inst.paintedConfig = config;
  }));
}
function startLoop() {
  rafId == null && (lastFrame = 0, lastRaf = 0, slowSince = 0, rafId = requestAnimationFrame(frame));
}
function stopLoopIfIdle() {
  instances.size === 0 && rafId != null && (cancelAnimationFrame(rafId), rafId = null);
}
function registerVoiceInstance(el, config, source, onLevel) {
  let inst = {
    el,
    config,
    source,
    onLevel,
    analyser: null,
    releaseAnalyser: null,
    time: null,
    freq: null,
    canvas: null,
    ctx: null,
    haloCanvas: null,
    haloCtx: null,
    displace: null,
    noiseShift: null,
    filter: null,
    filterTop: -1,
    s: stateFor(el),
    paintedConfig: null,
    cssBlur: null,
    // Match the mark a previous registration may have left on the element.
    warpOff: el.hasAttribute("data-voice-warp"),
    surface: null
  };
  config.distortion > 0 && (inst.displace = el.querySelector(":scope > svg feDisplacementMap"), inst.noiseShift = el.querySelector(":scope > svg feOffset"), inst.filter = el.querySelector(":scope > svg filter"));
  let canvas = el.querySelector(":scope > [data-voice-beam-band]");
  if (canvas) {
    inst.canvas = canvas, inst.ctx = canvas.getContext("2d");
    let halo = el.querySelector(":scope > [data-voice-beam-band-halo]");
    halo && (inst.haloCanvas = halo, inst.haloCtx = halo.getContext("2d"));
  }
  if (inst.s.lastTs = 0, source.stream) {
    let lease = acquireAnalyser(source.stream);
    lease && (inst.analyser = lease.analyser, inst.releaseAnalyser = lease.release, inst.time = new Float32Array(lease.analyser.fftSize), inst.freq = new Uint8Array(lease.analyser.frequencyBinCount));
  }
  return instances.add(inst), startLoop(), () => {
    instances.delete(inst), inst.releaseAnalyser?.(), stopLoopIfIdle();
  };
}

// scripts/vendor/voice-glow/presets.ts
var voiceDefaults = {
  scale: 1,
  glowSize: 1,
  strokeOpacity: 1,
  innerOpacity: 1,
  bloomOpacity: 1,
  idle: 0.18,
  reach: 1.2,
  spread: 1.05,
  flow: 48,
  bend: 60,
  bandStrength: 1.55,
  bandWidth: 2.15,
  bandPosition: 0.35,
  bandCurve: 1.75,
  bandSpread: 0.87,
  bandSkew: 0.12,
  bandOffset: -27,
  bandTail: 0.59,
  bandTailPosition: 0.67,
  bandTailCurve: 2.4,
  bandTailOverflow: 15,
  bandAberration: 0.89,
  distortion: 0.62,
  distortionDetail: 2.3,
  glowWidth: 0.65,
  glowHeight: 1.25,
  lobeSpacing: 0.85,
  rangeWidth: 0.75,
  rangeHeight: 1,
  softness: 1.07,
  coreSize: 1,
  coreLight: 0,
  coreLightWidth: 1,
  coreLightHeight: 1,
  strokeScale: 1,
  innerScale: 1,
  innerHeight: 1,
  bloomScale: 1,
  bloomHeight: 1
}, voiceTypePresets = {
  default: {},
  pill: {
    scale: 0.45,
    glowSize: 0.95,
    strokeOpacity: 1.2,
    innerOpacity: 0.85,
    reach: 1.35,
    spread: 1.1,
    flow: 0,
    bend: 23,
    bandStrength: 1.55,
    bandWidth: 1.85,
    bandCurve: 1.95,
    bandSpread: 0.38,
    bandOffset: -16,
    bandTail: 0,
    distortion: 0.45,
    distortionDetail: 3,
    glowWidth: 0.65,
    glowHeight: 0.95,
    lobeSpacing: 0.45,
    rangeWidth: 0.8,
    rangeHeight: 0.7,
    softness: 0.88,
    coreSize: 0.25,
    strokeScale: 1.25,
    innerScale: 0.95,
    bloomScale: 1.05,
    bloomHeight: 2.25
  },
  mobile: {
    scale: 1.25,
    spread: 0.45,
    reach: 3,
    flow: 60,
    bend: 70,
    bandWidth: 2.4,
    bandCurve: 1.55,
    bandSpread: 0.9,
    bandOffset: -50,
    bandTail: 0.62,
    bandTailPosition: 0.42,
    bandTailCurve: 2.7,
    bandTailOverflow: 22,
    bandStrength: 1.8,
    distortionDetail: 2,
    glowWidth: 1.15,
    glowHeight: 2.1,
    lobeSpacing: 1.35,
    rangeWidth: 1.25,
    rangeHeight: 1.2,
    softness: 1.1
  }
};
var lightTypeOverrides = {
  // The band on white, whatever the dark strengths: 1.7 for the chat
  // input and the phone, 2 for the pill.
  default: { bandStrength: 1.7 },
  pill: { bandStrength: 2 },
  mobile: { bandStrength: 1.7 }
};
function resolveVoiceDefaults(type = "default", theme = "dark") {
  let typePreset = voiceTypePresets[type], themeOverrides = {};
  return theme === "light" && (typePreset.reach === void 0 && (themeOverrides.reach = 1.8), typePreset.spread === void 0 && (themeOverrides.spread = 0.8), typePreset.coreLight === void 0 && (themeOverrides.coreLight = 1.8)), { ...voiceDefaults, ...themeOverrides, ...typePreset, ...theme === "light" ? lightTypeOverrides[type] : void 0 };
}
export {
  generateVoiceBeamCSS,
  registerVoiceInstance,
  resolveVoiceDefaults,
  themePresets
};
