# 同方部 — isolated photo-informed refinement

Validation-mode update: default tests retain identity, geometry and all SITE
provenance/licensing assertions without reading photographs. Original JPEG
hash, byte-count and dimension assertions run only with
`npm run test:references`; missing or changed images fail, never pass or skip
in that explicit mode. Default builds provide source metadata without copying
photos; `npm run build:references` is an opt-in, strictly verified local gallery.

## Interface and scope

```js
import {TONGFANG_ID, refineTongfang} from './src/tongfang-refinement.js';
const originalRoot = refineTongfang(campus, data);
// Also exported for module-level geometry tests:
// createTongfangDetail(feature, data.metadata.center, originalRoot.userData.localOriginMeters)
```

- `TONGFANG_ID = building:geometry:767c29087b14fbf65879f219`.
- Recommended front camera **offset** `viewDirection: [-1.1, 0.38, 0.38]`: from west-southwest looking toward the building, showing the west plaque facade and south porch. This follows the existing campus `frame` convention, not a camera look vector.
- `referenceSite: 'tongfang'`; `reconstructionExtent: 'partial'`; `reconstructionLevel: 'photo-informed-estimate-not-surveyed'`.
- Returns the **original addressable Group** after `replaceBuilding`. Keeps its original parent, pose, source association and frozen data, hides `base`, and adds exactly one `campusDetail`. No registry/UI/main/coverage/catalog integration is included.
- Detail uses local meters at the frozen geographic bounding-box center; root axes **X east, Y up, Z south**. A nested frame follows the actual south edge. Only the original root owns `featureId`; detail owns `buildingFeatureId`.
- `renderHeight` is computed from a **detail-only Box3 before attachment**. The old hidden base, campus surroundings and root world position do not contribute.
- Reapplication checks the original identity/pose, removes and disposes the previous owned detail's geometry/materials/textures, and never stacks details or disposes shared base materials.

## Identity, location and orientation evidence

The existing frozen `data/campus.json` contains exactly one matching feature, named **同方部**, associated by `osm-local-extract-building-overlap` with **OSM way226633636**, confidence **0.984**, source vector ID `null` and geometry-hash ID strategy. Its closed quadrilateral is:

```text
[116.318950653,40.001447351]
[116.318966746,40.001303525]
[116.319288611,40.001328181]
[116.319272518,40.001467897]
[116.318950653,40.001447351]
```

BBox: `[116.318950653,40.001303525]`–`[116.319288611,40.001467897]`; WGS84 bbox center `[116.319119632,40.001385711]`. Projected local origin at campus center `[116.32003975,40.00164005]`: `[-78.4618010553,28.3128879690]` meters. Footprint area **436.6114 m²**, actual south edge **27.5835 m**; it is not a bbox rectangle.

Independent research checked the [OSM primary API](https://api.openstreetmap.org/api/0.6/way/226633636/full): `name=同方部`, `name:en=Tong Fang Bu`, `building=university`; current OSM bbox differs from frozen vector quantization by approximately 0.10–0.22 m. **The OSM polygon was not substituted for the frozen outline.**

Official [Tsinghua article](https://www.tsinghua.edu.cn/info/1367/81660.htm) places the building east of the lawn before 大礼堂. The [university archive](https://dag.tsinghua.edu.cn/info/1062/2581.htm) independently describes it north of 清华学堂, with a larger single-storey western portion and smaller two-storey eastern portion. Both parts have south-facing entrances; the principal porch is on the western portion's south side. Crucially, the **同方部 plaque is over the separate west doorway facing the lawn, not over the principal south entrance**. These are archive descriptions, not bearings read from the photograph. The archive page could not be re-fetched by the parent tool; its citation and text were verified by the independent primary-source researcher.

Exact frozen south-edge unit tangent in local XZ: `[0.9950370692,-0.0995049287]`; south normal `[0.0995049287,0.9950370692]`, approximately **5.71° north of east**. West facade follows the actual short west edge, not an arbitrary ninety-degree compass rectangle. No nearest-neighbor name guess or similarly named company is used.

## Original local photographs and provenance

Original published bytes saved **inside this project**, not OneDrive, on **2026-10-12**. Catalog entry: `data/tongfang-references.json`, a **single site object** with the same keys used by the shared catalog's `sites[]`, not a replacement catalog or wrapper.

### A. West doorway detail, 1920 × 900

- Local: `references/tongfang-official-2018.jpg`, **2,468,341 bytes**.
- [Owning page: 清华第一个礼堂——同方部, 2018-08-06](https://www.tsinghua.edu.cn/info/1367/81660.htm).
- [Original published JPEG](https://www.tsinghua.edu.cn/_mediafile/qh2021b/publish/thu2018/11499/20180806120755067157037/20180806120918497951616.jpg).
- SHA256: `01ea63bab7a5cd9a39a6537b750a486e5a3705311be30adcc688b9d565a1b04a`.
- Credits on owning page: photography **李派**, material **校史馆**, image design **任帅**. This is the untouched downloaded **published file**, not a proven raw camera original.
- Rights: university website copyright statement; **no image-specific free licence established**. Local modeling reference only; no texture or online redistribution; watermark retained.
- Direct visual inspection: cropped west door and two flanking tall windows; blue-grey painted joinery; pale rectangular plaque reading visually left-to-right **部方同** (traditional right-to-left reading 同方部); three-light transoms; slender rectangular glazing ornaments; shallow fan/jack-arch brick headers; alternating projecting brick pier bands; pale stone sills and two dark lantern-shaped wall lights. The roof and complete steps are cropped. Do not infer roof height from this crop.

### B. West gable and adjoining long side, 551 × 396

- Local: `references/tongfang-history-massing.jpg`, **103,006 bytes**.
- [Owning page: 校史馆《看得见的历史》, section 4 同方部的故事](https://xsg.tsinghua.edu.cn/info/1005/1128.htm).
- [Original published JPEG](https://xsg.tsinghua.edu.cn/__local/7/4B/C7/8468B9281B3B58A7D004CC38BF1_CE0CC824_1925E.jpg?e=.jpg).
- SHA256: `3d0cea9e54c8fe0c8993ad38f898a6482d5324133d80e56aa89be034e1b633d6`.
- Rights: university history museum website copyright statement; **no image-specific free licence or photographer established**. 邓浩鑫 is the section author, not a verified photographer. Local reference only.
- Direct visual inspection: the same west plaque doorway in a grey-brick **gable end**, red/orange clay double-pitched roof, dark narrow bargeboard/eaves, small round upper-gable vent, two tall flanking windows, low entrance steps, and adjoining long brick side wall. Trees obscure the far eastern portion. The adjoining side's compass orientation is not established from the photo alone.

These are **two scales of the same west facade**, not two verified opposite-side photo surveys. Dimensions and hashes were checked against saved originals. Official sources support grey brick / red tile and west-low / east-two-storey massing; they do not supply measured dimensions or modern rear elevations. Searches for unobscured south/east photographs did not establish additional usable primary-source views.

## Reconstruction decisions

| Element | Implementation | Evidence / confidence |
|---|---|---|
| Foundation | Exact frozen quadrilateral extruded 0.02–0.34 m | Frozen map; no coordinate edits |
| West wall | Actual openings in extruded gable wall, two tall windows and central door | Photos A/B |
| Joinery | Blue-grey frames, three-light transoms, fine repeated inset rectangular bars | Photo A; geometry, not painted photograph |
| Brick detail | Shallow fan/jack-arch headers, four piers with alternating horizontal projection | Photo A; no invented semicircular arches |
| West plaque | Pale panel, original simplified geometric glyphs visually 部方同 | Photo A; not a calligraphic facsimile |
| Lights / vent | Two small iron/glass fixtures and actual circular gable opening | A lights / B vent |
| Roof | Red-tile **gable** roof ridge east–west, thin dark bargeboards; separate east roof | B west roof; eastern roof inferred |
| Two massings | West larger high single-storey hall, east smaller two-storey block | Archive text; split and heights estimated |
| South porch / east door | Plain small porch with square brick piers; separate eastern door | Location text-attested; form/dimensions/windows inferred |
| North/east end | Quiet brick walls, no copied ornamental west window arrays | Unseen; intentionally restrained |

Estimated values, **not surveyed**: west eave **6.35 m**, ridge **9.90 m**; east eave **7.25 m**, ridge **10.55 m**; west gable width approximately **16.07 m**; internal east/west split at footprint-frame `u=4 m`. Tiny ridge caps/bargeboards extend slightly above nominal roof heights. Roof surfaces are clipped to the frozen polygon, not a geographic bounding box. Porch and west steps are local facade appurtenances and may project beyond that polygon; they are not new building IDs.

### Metadata and limits

Root supplies its own `refinementSummary`, `referencePages`, `referenceImages`, `sourceFootprintGeometry`, `estimatedDimensionsMeters`, `frontNormalXZ`, `directionSource`, `viewDirection`, `modelMetrics`, `limits`, `baseRenderHeight`, `baseHeightSource`, `noReferencePhotoTextures` and the partial reconstruction flags.

**Partial** means photo fidelity is focused on the identifiable west facade. Geometry covers the original building outline, but that does **not** claim complete photo verification. Eastern roof/type division, south porch treatment, all window dimensions/counts outside the west facade, all heights/pitches, northern wall, hidden details and interior are unmeasured/inferred. The two photographs do not prove the building's precise current state. No dormers, grand classical portico, copied north-face ornaments, landscaping from photos, signage microtext or full interior was invented.

Textures are deterministic **128 × 128 DataTextures**, only generated grey-brick and clay-tile patterns. Both use sRGB, repeat, generated mipmaps, `LinearMipmapLinearFilter`, `LinearFilter`, **anisotropy 8**. No image loader, canvas, browser/document access or original photograph texture. Meshes are merged by material per architectural confidence group using the existing `createBuilder` helper.

## Module validation

Run **only**:

```powershell
node --test projects/tsinghua-campus/tests/tongfang-refinement.test.mjs
```

Tests cover identity and exact bbox/area, original-root return and all 650 original feature IDs, no data/neighbor mutation, repeat disposal without stacked details, fail-closed invalid identities/geometry/poses, finite indexed merged geometry and bounds, proportion limits, generated texture filtering, actual west wall apertures, distinct sign/lantern/lintel/window motifs, source-oriented west/south separation, honest partial metadata, and original local JPEG hashes/dimensions/licences.

No server, browser render, shared test suite, build or full-campus visual QA is part of this change.
