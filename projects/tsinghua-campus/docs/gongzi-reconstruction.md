# 工字厅＋水木清华：独立门房与主工字厅北后厦

## Scope and interface

This batch adds only:

- `src/gongzi-refinement.js`
- `tests/gongzi.test.mjs`
- `docs/gongzi-reconstruction.md`
- `data/gongzi-source.json`

No registry, UI, catalog, campus data, shared builder, other module, OneDrive,
browser QA or GLB output was changed. No commits or nested agents were used.
Parent integration and whole-campus visual/export QA remain outstanding.

The module exposes three public interface entries:

```js
import {GONGZI_IDS, createGongziDetail, refineGongzi} from './gongzi-refinement.js';

// GONGZI_IDS is the frozen [main I-shaped hall, separate south entrance] array.
// Pure construction: unattached geometry, meters relative to this exact root.
const detail = createGongziDetail(feature, data.metadata.center, root.userData.localOriginMeters);

// Attach through the existing replacement seam; returns the SAME addressable root.
const existingRoot = refineGongzi(campus, data, featureId);
```

`featureId` is required and must be one of the two IDs. An independently
addressable 水木清华 building or POI passed as a building ID is rejected.
The module accepts the existing shared Three.js/builder pattern, not a separate
rendering runtime. Construction uses `createBuilder(THREE, seed)` and installed
`polygon-clipping`. No canvas, font/image loading, browser dependency or network
request is needed at runtime.

### Stable identities and labels

| Role | Frozen ID | Source association | Display |
|---|---|---|---|
| Main two-hall I-shaped building | `building:6598261612` | `p.nameSourceFeatureId = osm:way:659826161` | 工字厅, associated alias 水木清华 |
| Separate southern entrance | `building:geometry:1a6c5da45bceef88407b194f` | Reviewed geometric match to `osm:way:1059165164`, v1; **not** an upstream name association | 工字厅门房 |

For the gate, `root.name` and `userData.displayName` are 工字厅门房.
The frozen source `userData.name` stays `''`, `nameSource` stays `unknown`,
`sourceFeatureId` stays `null`, and no `nameSourceFeatureId` is fabricated.
Use `displayName` for the interpreted label. `labelSource` explicitly records
photo/map interpretation, not an OSM name.

Only existing roots own `userData.featureId`. Details own `buildingFeatureId`
and are not additional buildings. Both roots and details carry
`referenceSite: 'gongzi-shuimu'`, distinct `refinementSummary`, `referencePages`,
`heightSource`, `dimensions` / `estimatedDimensionsMeters`, `facadeNormal`
(`[X,0,Z]`) / `facadeNormalXZ`,
`sourceMatchMetadata` and `knownUnknowns`.

The 水木清华 node `osm:node:2354348604` v4 at
`[116.3168682, 40.0019264]` is source metadata only. Parent verified its position
about six meters beyond the north edge of the I-shaped hall. There is no third
root, extra footprint or duplicate rear hall. Parent can add a **north-view
shortcut targeting the main hall root**.

## Evidence and what was actually verified

Both full-size 1920×900 local photos were viewed before modeling:

| Local photo | Supported architecture | Official image |
|---|---|---|
| `references/gongzi-entrance.jpg` | True **south entrance gate**: gray curved tiles, gray bricks, red timber columns, painted beam, two side screens, central open entry, framed plaster wing panels | [Gate photograph](https://www.tsinghua.edu.cn/__local/6/EE/80/9A065A38DF72F3F9F59F642B3BD_50D53E6D_1CB05C.jpg) |
| `references/shuimu-pond-facade.png` | **North pond-facing rear hall (后厦)** of main 工字厅: gray hip roof, red colonnade, wood lattice windows, white stone landing, pierced balustrade, steps to pond, pale return enclosures | [North rear-hall photograph](https://www.tsinghua.edu.cn/__local/D/AA/A5/A74F70F8B9CC639E5E2A3D1107B_5E7C943D_E7C63.png) |

Official source page:
<https://www.tsinghua.edu.cn/zjqh/xyfg/xyjg.htm>.
The page/image association and explicit rear-hall interpretation were verified
by the parent and supplied with this task. A fetch of that page in this
implementation session was **blocked**; this batch does not claim fresh live-page
verification. Local image SHA-256 values are recorded in `gongzi-source.json`
and checked only by the explicit `npm run test:references` image-byte mode.
The campus-local copies replace the earlier sibling-project photo paths without
changing their expected hashes. Default tests retain all photo provenance,
ID/ring and XML assertions, and explicitly skip only local image-byte checks.
No photographs are distributed or fetched by these commands.

The downloaded `data/gongzi-entrance-osm.xml` is now a distributable frozen
fixture, preserving its original SHA-256 and LF bytes via `.gitattributes`.
Its OSM copyright, attribution and ODbL license remain in the XML; it is not
an ignored photograph or an optional fixture. The exact
way `1059165164` v1 references these nodes' coordinates:

```text
[[116.3167384,40.0014137],
 [116.3167455,40.0013426],
 [116.3170215,40.0013587],
 [116.3170144,40.0014298],
 [116.3167384,40.0014137]]
```

Its only tag is `building=office`, not a name. XML byte hash, way version, tags
and referenced node coordinates are checked in tests. Polygon IoU with the
frozen gate outline was independently recalculated here:
`0.9663509490462932`, agreeing with parent's `0.9663509490462833` to roundoff.
**Those reviewed OSM coordinates never replace frozen campus geometry.**

Before construction/attachment the module checks the exact reviewed frozen
coordinate sequence, feature identity, name association, upstream height and
min-height provenance. It also checks the projection center, footprint-derived
meter origin, root position/identity/rotation/scale and original base height.
Failures occur before hiding the base or replacing any previous detail.

## Geometry decisions

### Main I-shaped hall

- Decompose the **original ring vertices**, not its bounding box, into exactly
  three disjoint polygons: north hall, short central spine and south hall.
  Their union is the frozen I footprint; both reentrant courtyard cutouts stay
  empty. Foundation and gray-brick perimeter follow this same footprint.
- North hall is the photo-supported rear waterfront facade. Seven estimated
  bays/eight red columns are actual cylinder geometry. The porch remains air
  in front of recessed windows; wood lattice members are real narrow geometry,
  not a window photograph or painted crosshatch plane.
- White stone terrace has separate capped pillars, thin upper/lower rails and
  pierced fret geometry, **not a continuous fence box**. Six actual ascending
  treads and separate flanking posts/handrails lead toward the existing pond.
- Low pale return enclosures and plain dark lozenge motifs suggest the photo's
  side walls, not additional building wings or exact historical stone reliefs.
- The north photo does **not** document the southern hall or central spine.
  Their roofs, modest window rhythm, unseen wall faces and roof junctions are
  explicitly inferred, not measured or claimed as complete reconstruction.

### Separate south gate

- One central canopy and two lower return roofs fit the separate frozen gate
  polygon. Gray masonry walls follow its skewed wing edges.
- Actual red columns, a simplified blue/ochre beam frieze, two framed pale
  side screens and two framed plaster panels on each southern wing are modeled.
- Central passage remains open through the gate at body height, about
  3.90 m clear width and at least 2.95 m clear height. No opaque door, fake
  opening texture, lion placeholder or center wall blocks it.
- Side/rear depth and return roof arrangement are inferred from the frozen
  outline and partly occluded image, not a surveyed plan.

### Roofs and materials

All three roof domains on each building use four hipped sectors subdivided
into **32 curved contour bands**. Their concave-up pitch includes a modest
turned eave lip. Each band is intersected with its exact footprint domain
before triangulation. Thin edge closures lie on that domain; one modest
rounded ridge per roof is batched with its tiles.

The roof is gray traditional pan/lap tile, not a straight triangular metal
roof. Small, deterministic byte textures provide fine tile caps/course laps
and gray brick joints; the tile microheight is a small bump map. There are
no photograph textures, vertex-color roof patches, per-tile scene objects,
imaginary sculpted ridge animals or oversized eaves spanning courtyards.
Maps may already encode roof projection, so roofs do not expand the footprint.

## Coordinates, estimates and actual mesh bounds

Axes are the existing campus convention: **X east, Y up, Z south**, meters.
The main facade is oriented from its exact long north edge; the gate uses its
exact long south edge. Slight map skew is preserved, not snapped to cardinal
axes.

| Quantity | Main 工字厅 | Separate south gate |
|---|---:|---:|
| Frozen east/south bbox (m) | 28.818905 × 31.106117 | 23.787079 × 9.606315 |
| Frozen area (m²) | 624.413443 | 187.492211 |
| Bbox in each facade frame (m) | 27.541738 × 29.289192 | 23.396816 × 8.246625 |
| Facade outward normal `[X,Z]` | `[-0.083047831,-0.996545562]` | `[0.058722580,0.998274340]` |
| Cardinal description | North, ~4.76° west of north | South, ~3.37° east of south |
| Estimated principal eave / ridge (m) | 4.50 / 7.00 | 3.50 / 5.70 |
| Estimated secondary roofs (m) | Spine eave 4.00 / ridge 6.00 | Return eave 2.90 / ridge 4.15 |
| Actual detail max Y, including ridge cap (m) | 7.135106 | 5.835105 |
| Visible east/south bbox incl. terrace/trim (m) | 30.107650 × 36.241681 | 24.136661 × 9.968897 |
| Base source height preserved (m) | 4 | 5 |
| Source min-height preserved (m) | 0 | 0 |

Main north terrace landing is an estimated 0.74 m above flat ground; six treads
are modeled at 0.15, 0.25, 0.35, 0.45, 0.55 and 0.65 m. Column and lattice
counts are **modeled estimates**, not photo-derived surveys.

All architectural dimensions above, except the frozen map bounds/area, are
photo-proportion inferences. The 4 m upstream main height is not a measurement.
Root `renderHeight` is captured from the newly constructed detail geometry
alone; `baseRenderHeight` and `baseHeightSource` retain the upstream value.
A hidden-base geometry test ensures even an 80+ m hidden base cannot inflate
the reported visible height.

### Actual batches after construction

| Detail | Materials | Meshes | Procedural textures | Triangles |
|---|---:|---:|---:|---:|
| Main I hall + north terrace | 9 | 15 | 3 | 12,392 |
| South entrance gate | 9 | 11 | 3 | 3,526 |

The nine materials are gray stone, gray masonry, pale plaster, white stone,
redwood, dark recessed wood, gray roof tiles, blue frieze and ochre ornament.
Meshes are merged per material/semantic group by the shared builder. All
textures are 128×128 local RGBA `DataTexture` bytes: roof albedo, roof
microheight and brick albedo. Repeated replacement detaches and disposes the
old owned geometries/materials/textures and leaves exactly one current detail.

## Explicit omissions / known unknowns

- **Stone lions are omitted entirely.** No cartoon substitutes or invented
  lion geometry; no claim that all photo features are complete.
- Sculpted roof beasts, finials, precise reliefs and stone carving are omitted.
- Plaque, couplet and other inscription text is omitted. No fake Chinese
  glyphs or invented unreadable inscription texture.
- Painted beams use clearly simplified geometric motifs, not exact murals.
- Perspective, trees and other occlusions prevent measurement of heights,
  opening count, hidden roof slopes, decorative detail and side/rear surfaces.
- Main south hall/spine, roof junctions and unseen elevations are inferred.
  Gate's side/rear depths and low roof allocation are likewise inferred.
- No interiors, survey/DEM, pond geometry or willow trees are added here.
  Existing parent water/context layers remain responsible for those.
- No parent catalog/UI integration or rendered visual matching was performed.
  Passing geometry tests is not a claim of photographic visual equivalence.

## Actual targeted test results

Run from repository root:

```powershell
node --test projects/tsinghua-campus/tests/gongzi.test.mjs
node --check projects/tsinghua-campus/src/gongzi-refinement.js
node --check projects/tsinghua-campus/tests/gongzi.test.mjs
```

**15 tests passed; 0 failed, skipped or cancelled.** Syntax checks passed.
Coverage:

1. Exact real IDs, frozen ring/photo hashes, gate XML way/nodes/tags and IoU.
2. Preservation of all **650** existing roots, maps, local origins, positions,
   min-heights and untouched source data; only roots own addressable feature IDs.
3. Distinct hall/gate source labels and no independent 水木清华 identity.
4. Atomic rejection of identity, OSM association, ring and height mismatches.
5. Invalid projection center, local origin and root transform rejection.
6. Correct local orientation under a translated projection center.
7. Exact disjoint I roof partition union, sky-open protected courtyard samples.
8. Every roof triangle, including ridge caps, stays inside the frozen polygon
   (only Float32 boundary slivers allowed, total <0.001 m²).
9. Curved cross-section, turned lip, ridge and lower gate return roof tests.
10. Open through-gate passage and actual side screen/column geometry.
11. Open north colonnade before actual wood lattice members.
12. Six ascending real stair treads and pierced balustrade gaps.
13. Finite positions/normals/UVs; deterministic procedural-only textures,
    no vertex-color patches; actual batch/material/triangle limits.
14. New-visible-geometry height capture, excluding hidden base geometry.
15. Repeated-detail deduplication, resource disposal and root identity retention.

No browser, full-campus render/export, GLB QA or broad test suite was run.
