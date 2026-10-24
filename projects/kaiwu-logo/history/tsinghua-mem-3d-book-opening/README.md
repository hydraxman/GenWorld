# Tsinghua MEM — 3D Book Opening

A separate 12-second true-3D composition, not a replacement for any of the eight previous studies.

## Play offline
Open `deliverables/Tsinghua-MEM-3D-Book-Opening.html` in a current WebGL-capable browser. Everything needed is embedded. Play, pause, replay and seek work without a server or network. The offline player is a live Three.js scene, not the MP4 as a texture.

## Build / render
Requires Node 22+, Python 3, FFmpeg and Chromium. The production CLI is pinned at HyperFrames 0.8.38; the attempted newer CLI in the parent workflow was unavailable, so this project does not silently upgrade it.

```
npm install --ignore-scripts
npm run build
npm run check
npm run render
```

Three.js r181 is bundled locally with its MIT license. `SelectiveExtrudeGeometry.js` is an attributed local derivative of r181's ExtrudeGeometry: source-boundary bevels are retained, while artificial assembly-cut vertices have zero bevel displacement. This avoids coincident expanded mating surfaces and dark seam artifacts.

## Geometry preparation (optional)
The prepared polygon assets are already included. To regenerate them from the unchanged source SVG:

```
python3 -m venv .venv
.venv/bin/pip install shapely Pillow
npm install --no-save puppeteer-core
export CHROME_EXECUTABLE=/absolute/path/to/chrome-headless-shell
node scripts/export-polygons.mjs
.venv/bin/python scripts/split_geometry.py
npm run build
node scripts/prototype.mjs qa/review
.venv/bin/python scripts/compare_masks.py qa/review
```

No external source graphic, font, sky image or network service is needed for the film. Aurora and stars are authored deterministic background graphics; the badge is actual extruded 3D geometry with PBR lights/reflections.

## Verification and limitations
- 53 original SVG paths / 164 holes are sampled through SVGLoader with transforms preserved, then partitioned by book/letter-band/rope-ring geometry. This is a source-derived geometric approximation, not a claim of bit-identical curves.
- Real scene objects are exposed as `window.__sceneDebug`; scalar state is `sceneMetrics`. One paused GSAP timeline controls absolute `renderAt(t)`; `hf-seek` is supported.
- The raw union boundary Hausdorff of 7.2196 source pixels comes from a numerical zero-width seam at (319,461), inside the original filled solid. At precision 1e-12, the union Hausdorff is ~8.7e-13. Raw diagnostics are retained.
- Actual unlit orthographic mesh alpha masks were compared with the original SVG raster. No missing pixels exceed 1 px. The strict alpha>=128 comparison finds 27 extra pixels from existing subpixel circuit strokes (source alpha 48–122); with an explicit antialiased-edge 1 px allowance, extra and missing counts are both 0. Do not describe the result as exact pixel identity.
- HyperFrames DOM contrast audits cannot read typography cut into WebGL geometry. Full-size rendered-frame inspection and source-mask comparison are the relevant evidence.

The source package intentionally excludes virtual environments, node_modules, caches and credentials. `qa/` records measurements, not fabricated guarantees. The parent reviewed the revised t8/t10 images before final rendering.
