# Tsinghua MEM — Awakening / 星河开悟

1920×1080, 30 fps, 12 seconds, silent. Entry composition: `index.html`.

## Deliverables
- `deliverables/Tsinghua-MEM-Awakening-Wide-12s.mp4`
- `deliverables/Tsinghua-MEM-Awakening-Wide.html` — one-file offline player with play/replay/scrub; no CDN, fonts, fetches or server required.

## Build
`npm install --ignore-scripts` then `npm run build` (Python 3, Node.js, esbuild).
`npm run check` uses HyperFrames 0.8.38. The installed check reported no lint/runtime/layout findings. Canvas-internal lettering is visually inspected rather than WCAG DOM text-tested.

Source inputs and SelectiveExtrudeGeometry retain the previous verified semantic polygon partition, original 53 SVG paths and real apertures. Natural-source contours have 0.55-source-pixel bevel width; semantic artificial cuts remain unbeveled. Side walls are silver-purple polished metal; faces are cast-purple clear-coated PBR with subtle procedural normal curvature and roughness variation.

`galaxy.js`: six-octave domain-warped nebula with absolute-time rotational shear and outward expansion coupled to book opening; three advected star-depth layers; twelve deterministic rapid meteors restricted to the wings. Background remains live through 12 seconds. No captions/titles/audio.

## Inspection interfaces
`window.animationReady`, `renderAt(seconds)`, `__timelines['tsinghua-mem-awakening-wide']`, `sceneMetrics`, `__sceneDebug` (actual camera, badge, groups, renderer, galaxy).

## Rendering
Production uses deterministic absolute-time Chromium PNG capture and FFmpeg encoding, not screen recording. `scripts/capture.mjs` includes local-machine browser/tool paths; adapt those two paths on another machine. `qa/render-input-freeze.json` binds all authored source/assets used by the render. Never resume captured frames with a different source hash. The conventional HF CLI render remains available in package scripts but was not run for this deliverable.
