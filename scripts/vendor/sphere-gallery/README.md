# SphereGallery3d_v2 source port

Author: THE DESIGN FUTURIST. The user confirmed separate permission to port this component outside Framer on 2026-11-05. The original component is not an open-source dependency.

Reference: https://vast-author-374088.framer.app/
Original module: https://framerusercontent.com/modules/bNS0SLUsqn8sygA3oBJ5/AMbQIfCALbnIhG0ZFaFI/SphereGallery3d_v2.js
Published bundle: https://framerusercontent.com/sites/6sS1BaDfnLZpJ9qKF0MvkQ/SphereGallery3d_v2.Cd-rwnDZ.mjs
Source map: the published bundle URL plus `.map`.

`SphereGallery3d_v2.original.js` is the unmodified `sourcesContent[21]` from that map. It is kept outside the public server's allowlist. The map also contains the exact Three.js 0.149.0 and GSAP 3.12.2 modules, now served locally under `assets/sphere-gallery/`. Their original attribution headers remain intact.

## Runtime mapping

- Original `SphereGallery` geometry, sizing and frame equations → `dream-sphere-geometry.js`.
- Original `Item` placement, world-centre lookAt, GSAP intro, hover interpolation and `SphereGallery` camera/input physics → `assets/sphere-gallery/gallery.js`.
- React/Framer CMS data collection and lifecycle → `dream-sphere.js` and native Three.js scene setup.
- Published page overrides: sphereSize 500 desktop, 220 below 800px, gap73, sensitivity0.7, autoRotationSpeed200, scrollSpeed15. Seven CMS items repeated seven times give49 positions.
- Only content/material changes: ten Somnia videos cycle across those49 positions; 1:1 feathered circles replace3:4 image rectangles. One shared video atlas replaces per-image progressive textures. The gallery uses an adjustable GPU mask; the device grids retain their original mask. Transparent corners neither intercept clicks nor occlude rear circles.
- Integration adaptations: canvas-local inputs avoid intercepting the persistent device/header; existing Somnia video dialog replaces the image lightbox; keyboard support and reduced-motion fallback are retained. Fixed60Hz physics preserves the original60Hz behavior on high-refresh monitors. Hidden tabs and the dream viewer pause gallery work. Settings retains a live dock preview.

This is a source port, not the earlier Canvas2D approximation. Do not restore the affine projection or depth-dependent opacity from that implementation.

## Later user-requested changes

Removed the visible hint and full-canvas focus outline. Zoom now uses Somnia's shared `createScrollMotion` and subscribes to the persisted site scroll settings (enabled, speed, smoothness). Projected diameter is mapped to CSS pixels, matching the document scroll distance; original camera limits and intro remain. The original wheel curve is retained only in the source/reference helper, not used by the runtime.

Gallery appearance is persisted separately as edgeBlur, edgeFade, matte. `atlas-blur.js` performs a separable Gaussian convolution once per new video frame into a 2× intermediate atlas. This replaces sparse offset sampling that produced visible grid artifacts when zoomed. No additional video files or decoders are used.

The persistent gallery and device now swap places on curved, spring-based paths (`sphere-flight.js`). `presentation.js` moves the same camera projection in screen space, retaining the gallery orientation and zoom. The settings dock renders a scissored 111px viewport in the existing canvas, avoiding buffer reallocations during route transitions; the canvas is never cloned or replaced.
