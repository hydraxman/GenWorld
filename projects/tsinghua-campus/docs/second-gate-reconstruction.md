# 清华二校门 — current-photo geometry correction

## Scope and unchanged interface

This is **二校门, not 西校门**. The correction changes only this model, its
targeted tests, this note and small licensed glyph assets. Parent integration,
catalog, UI, screenshot capture and GLB export remain parent-owned.

```js
import {SECOND_GATE_ID, SECOND_GATE_ANCHOR, createSecondGateModel} from './src/second-gate.js';
const detail = createSecondGateModel(); // unattached THREE.Group
```

- Stable ID: `landmark:osm:node:941370305`.
- WGS84 anchor: `[116.3182903, 39.9997127]`, parent-verified OSM node v5.
- No building footprint in frozen data; the parent registers a separate
  landmark in its `landmarks` / `objects` Maps. This module fabricates no
  geographic footprint and performs no projection.
- Ground-center origin. Local **+X east, −X west, Y up, +Z south/front**.
- Root transform is identity, parent is null, root has **no `featureId`**.
  `referenceSite: 'second-gate'` and Chinese `refinementSummary` are retained.
- The root contains a facade group and a separate pole assembly, distinguished
  by `userData.architecturalRole`. Geometry/materials/metadata are independently
  allocated on each call; glyph geometry may be shared between faces within one
  result. Deduplicate resources when disposing a result.
- Only the two constants and factory are exported. Construction helpers remain
  private. No browser, canvas, runtime network, font loading or texture loading.
- Parent's single-object export filename remains `tsinghua-second-gate.glb`.

## Actually viewed evidence and comparison

### Primary: complete modern front

`references/second-gate-modern-complete.jpg`, **3264 × 2448**, a current
straight-front photograph credited to **贾珺** by the parent-verified source:

- <https://xsg.tsinghua.edu.cn/info/1003/3153.htm>
- <https://xsg.tsinghua.edu.cn/__local/9/E9/9F/95C7625C7EEB88D4E0FAEEFB833_EB0EC5BE_270574.jpg>

This image governs frontal silhouette, passage proportions, relative heights,
paired-column size, pedestal massing and the rectangular top.

### Secondary: complete modern low-oblique

`references/second-gate-gallery-b.jpg`, **1500 × 1000**, current low-oblique
view showing the entire crest, bases, side arch plaster fields and projecting
cornices:

- <https://www.tsinghua.edu.cn/info/1183/94394.htm>
- <https://www.tsinghua.edu.cn/__local/1/63/BE/E6DAC008600170338C51AF67AA2_A30DA786_A857B.jpg>

This image governs depth articulation, the thick tower cornices, separate
lower architrave and exposed brick frieze, high stone pedestals, flattened
scroll discs and the pole behind the center.

### Before-review screenshot

`output/second-gate-before-review.png` was **actually viewed** alongside both
modern references. It showed these significant errors, now geometrically
corrected rather than hidden by a material change:

| Before | Corrected |
|---|---|
| Triangular pediment | Flat parapet and three-level **rectangular** central crest |
| Continuous skinny main beam | Separate projecting tower upper cornices, exposed brick friezes, lower white architraves and recessed connector |
| Low dark feet, long thin shafts | Massive light-grey raised stone pedestals with recessed block panels, shorter thicker paired shafts |
| Oversized side openings / bare surrounding brick | Smaller side passages in complete plaster fields with fan joints up to the beam |
| Thick projecting scroll cylinders | Broad shallow oval scroll discs with thin planar spiral relief |
| Simplified central arch ring | Multiple thin raised tracks, actual recessed triangular spandrels, circular/grooved crown key |
| Oversized generic lettering | Photo-sized coherent OFL LXGW WenKai 園華清 glyphs, recessed panels and faint seams |
| Missing pole and misleading 10 m total | Behind-center pole and round finial; separate 10 m structure / 14 m overall metadata |

The earlier cropped modern photo remains supplementary detail evidence only.
The sepia historical `second-gate-front-official.jpg` is **historical context,
not a current building photo and no longer a shape/proportion source** where
complete modern views are available. No old short wall remnants are modeled.
The parent reports the official history page confirms destruction in 1966,
rebuilding in 1991 and short-wall removal in the 1950s:
<https://www.tsinghua.edu.cn/info/2116/81037.htm>.
`referenceEvidence` and `history` preserve these distinctions.

The unrelated `second-gate-gallery-a.jpg` was ignored.
No reference was downloaded by this implementer.

## Photo landmarks, normalized targets and tolerances

These are approximate manual readings of the front image, **not an image trace,
calibrated orthophoto or surveyed architectural dimensions**. Perspective,
wide-angle distortion and planter-obscured feet warrant the tolerances.
Absolute height is selected as 10 m; the width follows the photographed ratio
rather than retaining the previous arbitrary 15 m.

Approximate native-image landmarks, in pixels:

| Landmark | Reading |
|---|---:|
| Left / right maximum facade cornice | X 610 / 2562 |
| Highest attic block / estimated ground | Y 658 / 2024 |
| Central aperture left / right | X 1335 / 1839 |
| Central crown / spring | Y 1170 / 1415 |
| Side aperture clear width / crown | 181 px / Y 1570 |
| Representative white shaft diameter | approximately 82 px |
| Pole finial top | Y 153 |

Thus facade width is approximately 1952 px, facade height 1366 px, and central
clear width 504 px. For example, `1952 / 1366 ≈ 1.43`,
`504 / 1952 ≈ 0.259`, `(2024 − 1170) / 1366 ≈ 0.625`.
Do not interpret pixel rounding as survey precision.

| Normalized feature | Photo target | Absolute tolerance | Corrected model |
|---|---:|---:|---:|
| Facade width / structural height | 1.43 | ±0.05 | 1.430 |
| Central clear width / facade width | 0.259 | ±0.025 | 0.259 |
| Side clear width / central clear width | 0.35 | ±0.06 | 0.351 |
| Central crown / structural height | 0.625 | ±0.035 | 0.630 |
| Central spring / structural height | 0.445 | ±0.035 | 0.445 |
| Side crown / structural height | 0.33 | ±0.035 | 0.333 |
| Shaft diameter / central clear width | 0.16 | ±0.025 | 0.157–0.176 |
| Raised pedestal / structural height | 0.18 | ±0.035 | 0.188 including coping |
| Exposed pole / structural height | 0.37 | ±0.05 | 0.400 |
| Three-character span / central opening | about 0.69 | ±0.08 | about 0.70 |

Pedestal feet are partly occluded. The visible raised-block/foot envelope is
approximately 0.15–0.22 of facade height; 0.18 is an estimated massing target,
not an unambiguous measured pixel endpoint.

`userData.photoProportions` records landmarks, targets, tolerances, primary
image and uncertainty. Tests independently observe facade bounds, raycast
aperture boundaries/crowns, shaft bounds and pedestal bounds against literal
photo-derived targets, rather than merely trusting dimension metadata.

## Revised estimated dimensions

| Quantity | Estimate (m) |
|---|---:|
| Maximum facade width | **14.30** |
| Structural gate height, pole excluded | **10.00** |
| Overall height including pole finial | **14.00** |
| Wall core depth | 1.40 |
| Maximum depth including pedestal faces | 2.90 |
| Central clear width / spring / crown | 3.70 / 4.45 / 6.30 |
| Side clear width / spring / crown | 1.30 / 2.68 / 3.33 |
| Side aperture centers | X ±5.33 |
| Shaft diameter, top to bottom | 0.58–0.65 |
| Shaft height, base to neck | 4.56 |
| Pedestal top including coping | 1.88 |
| Side cornice top | 4.50 |
| Exposed tower brick frieze | Y approximately 7.40–7.91 |
| Central flat parapet / middle step / top step | tops 9.58 / 9.74 / 9.89 |
| Raised outer rectangular attic blocks | top 10.00 |

**Height contract:** root `structuralHeight = 10`, `overallWithPole = 14`,
`renderHeight = 14`. `estimatedDimensions.height = 14` is the renderable total,
with explicit `structuralHeight` and `overallWithPole` fields alongside it.
The parent's inspector/catalog should not describe the pole-inclusive object
as only 10 m tall. `heightSource` says both heights are estimated.

## Geometry and material details

All three passages remain genuinely open from ground through the semicircular
crown and the full 1.4 m wall core. Separate jambs, concave-bottom spandrels
and annular soffits leave the opening empty; no slab crosses a passage.
Thin plaster fields, fan joints and archivolt tracks stay outside the opening.
`archApertures` provides clear width, radius, spring/crown, ground, through flag,
semicircular shape and depth range `[-0.7, 0.7]`; arc tessellation uses
`curveSegments: 32`.

Eight white round shafts, four per face, have larger diameters, raised bases,
necking, curved capitals and square abaci. Two separate stone pedestal groups
have actual setback panel floors and projecting border blocks; they are not
a giant shared stone slab. Four inset faces now have **uniform neutral stone
albedo**, without a `color` attribute or material vertex-color interpolation.
Fine deterministic micro-relief uses approximately 2 cm facets, at most 0.4 mm
peak-to-peak depth, and flat edge vertices. There are no grain textures.

Upper tower cornices use independent multilevel projecting blocks; the central
connector is narrower in depth, producing the observed zig-zag plan/profile.
Brick remains visibly exposed between upper cornice and lower architrave.
Top attic blocks have three actual recessed grooves and circular relief.
Side upper piers carry rectangular triglyph/circular ornaments, stepped ledges
and dentils; side jambs have strong layered quoins. Scrolls are broad 0.10 m
deep oval extrusions with 0.015 m planar spiral relief, not forward cylinders.

Eleven opaque `MeshStandardMaterial`s: neutral white trim, off-white plaster,
light cornice shadow, mortar, three lighter desaturated grey brick tones,
warm-grey stone, uniform-albedo micro-grain stone, dark lettering and steel pole. Roughness
is high except on the steel pole. **No photo textures, texture maps or emissive
whitening** are used. Appearance still depends on the parent's lighting,
exposure, color management and tone mapping.

## Inscription fidelity and licensing limits

The front visual order is **園 華 清**, reading right-to-left as **清華園**.
Glyphs have photo-sized widths 0.46 / 0.48 / 0.42 m, height 0.59 m, centers at
−1.08 / 0 / +1.08 m in each face's viewer coordinates. They sit on a genuinely
recessed white field, with faint vertical seams. The north group is rotated
180° about Y, never mirrored, and is explicitly an unverified symmetry inference.

- All three characters now use **LXGW WenKai Regular v1.522**, a coherent
  Kai/brush-style font rather than the earlier mixed families. The parent's
  verified local source is `references/LXGWWenKai-Regular.ttf`, 25,575,676 bytes;
  the embedded font version and cmap coverage for 園、華、清 were checked.
- Only these three font-derived glyphs are bundled in
  `src/second-gate-wenkai.json`, renamed “Second Gate Kai Lettering.”
  The old Noto Serif / Ma Shan Zheng glyph assets have been removed.
  Original size/placement, traditional characters and right-to-left order remain
  unchanged. No image pixels, invented missing strokes or simplified substitutes.
- This coherent font approximation is **not a faithful reproduction of the
  original brush silhouettes** and explicitly **not a tracing of 那桐**.
  Exact historic calligraphic fidelity remains unresolved.
- No unknown small signature/date characters are fabricated. Small geometric
  panel fasteners are not substitute text. `unknownSmallTextOmitted` is true.
- Copyright 2021–2026 LXGW and 2020 The Klee Project Authors, attribution and
  full SIL OFL 1.1 are in `src/second-gate-font-OFL.txt`.
  The 25 MB full font is not a runtime asset; original font binaries are not
  redistributed. Parent-provided source/license URLs:
  <https://github.com/lxgw/LxgwWenKai/releases/download/v1.522/LXGWWenKai-Regular.ttf>
  and <https://raw.githubusercontent.com/lxgw/LxgwWenKai/v1.522/OFL.txt>.
- Installed Python `fontTools` extracted font curves via `BasePen`; runtime
  Three `FontLoader.parse` uses only bundled JSON, with no font/network load.
  Glyph contours/counters and their negative space remain geometric.

## Targeted validation and remaining limits

Run only:

```powershell
node --test projects/tsinghua-campus/tests/second-gate.test.mjs
```

Twelve tests cover:

1. Stable constants, unattached local root, identity ownership and metadata.
2. Primary modern reference classification, historical exclusions and OSM
   anchor/history provenance.
3. Bidirectional rays through each aperture at ground, jamb edges and crown;
   rays must also hit real curved spandrels, piers and lintels.
4. Photo-derived normalized proportions using scene bounds and ray-measured
   aperture widths/crowns; raised shafts/bases and pole-inclusive heights.
5. Rectangular top steps (rejecting a triangle), projecting tower cornices and
   visible brick friezes, complete side plaster, genuinely recessed stone and
   inscription fields, and broad shallow scroll discs.
6. Readable traditional vector glyph order/orientation, measured glyph sizes,
   coherent WenKai provenance for all three glyphs, omitted unknown text and
   ray-tested 園 whitespace.
7. Finite geometry/indices/instance transforms/bounds/materials; neutral white,
   no emissive cheat and no maps. Diagnostics print all resource counts.
8. Independent deterministic factory results, geometry/material mutation
   isolation and attachment independence.
9. Empty space above the curved shoulders, preventing the removed unsupported
   diagonal strips from returning.
10. A single visible inset surface on each pedestal face, rather than an
    overlaid panel and uncut solid box front. This checks layering only; it does
    **not** prove that a visible colour artifact is eliminated.
11. Uniform inset albedo with vertex colors disabled and no exportable
    `COLOR_0`, no texture map, fine facets no larger than 3 cm, and sub-millimetre
    relief. These are model-data regressions, not screenshot assertions.
12. A licensed WenKai v1.522 subset containing exactly 園、華、清, real font curves
    and both upstream copyright notices; no full-font runtime asset.

### Pedestal diagonal-patch diagnosis correction

The parent's refreshed captures and `output/second-gate-shadow-diagnostic.png`
were viewed. The diagnostic disabled `receiveShadow` on **all gate meshes**,
yet the large diagonal patches persisted. The earlier shadow-map explanation
was therefore **wrong**. Removing the solid front overlap was a valid geometry
cleanup, but its passing ray tests did not demonstrate visual removal.

The remaining implementation encoded brightness **0.88–1.00** as interpolated
vertex colors using `((i * 73 + (i % 17) * 19) % 31) / 250`. This modular pattern
was not random fine grain: it repeats exactly at an index offset of 527,
equivalent on the 37-vertex-wide grid to **9 columns / 14 rows**, or approximately
**0.39 m / 0.642 m** diagonally across the panel. That introduces a macroscopic
periodic albedo pattern susceptible to interpolation/aliasing.

Inspection of the available exported GLB confirmed each panel retained **925
positions, normals and `COLOR_0` values**, with **5184 indices / 1728 triangles**.
It had **not** collapsed to a two-triangle plane. Oblique ray probes found only
the inset surface; no separate decorative triangle overlay was detected.

The correction removes the brightness field and disables vertex colors, so the
panel cannot export/interpolate those color gradients. Subtle stone character
comes only from bounded micro-relief and roughness under normal lighting.
All facade proportions, pedestal massing, rims, apertures and heights remain
unchanged. Final visual acceptance remains with the parent's new export/capture;
unit tests alone are not evidence that the screenshot artifact is gone.

Absolute size/depth and hidden rear construction are still estimates.
North-face details are inferred, exact masonry/capital profiles are simplified,
and authentic 那桐 lettering is not reproduced. No claim of final screenshot
match is made without the parent's new capture.

No browser/full-campus/GLB QA, parent-file changes, downloads, OneDrive access
or git commits were performed for this correction.
