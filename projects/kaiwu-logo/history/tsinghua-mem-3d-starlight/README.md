# 08 · Starsea / 3D Metal

960×960, 30 fps, 6 seconds, silent. This is the simple whole-badge tilt version in the eight-variant comparison. The separate complex opening-book film is NOT this project.

## Play
Open `deliverables/Tsinghua-MEM-3D-Starlight.html` directly in a WebGL-capable browser. It contains all dependencies and assets; no server or network is required. Controls play/pause/replay/scrub.

## Source
- `inputs/Tsinghua-MEM-2023-Transparent.svg`: original, byte-identical, SHA256 `89bdad7d41062bf6b2cf4ed340d79ba62499126fb1f785b725ed4c76813c038c`.
- `scripts/scene.js`: actual Three.js SVGLoader → Shape/holes → ExtrudeGeometry scene. 53 original paths, 53 extruded meshes, 164 through-holes; depth 14 source pixels, bevel .22 source pixels.
- `vendor/three`: local Three.js 0.181.2 with license and SVGLoader. `assets/gsap.min.js` is the original project's dependency.
- `assets/nebula-0.jpg`: deterministic procedural local cloud texture, generated with `scripts/nebula.py`; no stock footage or generative API.
- `assets/scene.bundle.js`: prebuilt IIFE including Three, original source SVG and nebula data URL.

The lettering and circuitry are geometry holes, not image textures. White/lavender strips in the PBR environment are actual reflected environment geometry. No surface-applied sweep image. Camera is fixed; badge rotates smoothly within ±17.48° Y and ±4.3° X. Star detail is excluded from the badge's projected region so it cannot obscure its letters.

## Build / render
Prebuilt HTML needs no install. To edit and rebuild, install package.json build dependencies and run `python3 scripts/build.py` (Python stdlib only for this step). The script finds local esbuild or `ESBUILD_BIN`. Nebula regeneration separately needs NumPy/Pillow.

`npm run check` and `npm run render` use pinned HyperFrames 0.8.38. Local production used the existing cached CLI directly; no upgrades or cloud services.

## Inspection
`window.animationReady`, `window.renderAt(t)`, `window.sceneMetrics`, single-key `window.__timelines` and `window.__sceneDebug={THREE,scene,camera,badge,renderer,native,face,side,source,parsed}` are exposed. Geometry groups expose sourcePathIndex and hole count. `qa/browser-verification.json` is actual browser evidence, `qa/hyperframes-check.json` is the HF gate, and final video QA is in `qa/video-verification.json`. Freeze manifest is `qa/input-freeze.json`.

Original delivered 18-second project and unfinished four-variant draft were not modified. No external publication, delivery or OneDrive copy was performed.
