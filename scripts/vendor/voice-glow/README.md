# Voice Glow for Somnia

Original: https://github.com/Jakubantalik/Libraries.dev/tree/main/packages/voice-glow
Copyright (c) 2026 Jakub Antalik, MIT. License: `assets/voice-glow/LICENSE`.
Upstream source blob hashes are in `provenance.json`.

The original styles, palette, geometry presets and visual driver are preserved.
The React wrapper is replaced by `hover-glow.js`. Audio acquisition and unused
dots/lines surface renderers are replaced by inert adapters. No microphone,
AudioContext, React runtime, remote asset or network request is used at runtime.
The built engine is checked in; normal local startup needs no build tools.

Somnia performance patch: the driver accepts ResizeObserver-cached width/height
from the host, so drawing the band does not force layout after CSS variable writes.

Rebuild from the project root:

```sh
npm exec --yes --package=esbuild@0.25.11 -- esbuild scripts/vendor/voice-glow/entry.ts --bundle --define:__VOICE_SURFACE__=false --format=esm --target=es2020 --minify-syntax --legal-comments=inline --banner:js='/* Voice Glow — Copyright (c) 2026 Jakub Antalik. MIT; see LICENSE. Hover-only build for Somnia. */' --outfile=assets/voice-glow/engine.js
```
