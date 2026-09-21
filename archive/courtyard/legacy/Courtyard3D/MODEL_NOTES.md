# Architectural model notes

## Contract and provenance

`src/model.js` exports `createModel(THREE) -> { group, stats }`.

- Metres, **Y up**, front toward **+Z**, building centered at **X = 0**.
- Browser canvas is required for procedural texture creation. The function does not create a renderer, camera, light, animation clock, network request, or persistent global state.
- Based on direct inspection of both supplied photos. This is an approximate visual reconstruction, **not a measured survey**. No building name is assigned.
- The tall central polygonal bay, stone basement and projecting terrace cornice, oxide-red rails and roof fascia, mullioned brown windows, raised clerestory, gray roof, blue-gray rainwater pipes, twin brick pergolas, dry cascade basins, and broad foreground steps are photo-derived features.
- The hidden rear elevation, exact dimensions, concealed roof construction, entrance position, and planting distribution are inferred. Rear windows are deliberately finished for oblique/overhead use, not asserted as surveyed facts.

## Modeled detail

### Building

- Buff running-bond brick wall masses with lower flanking wings.
- Solid chamfered central projecting bay, with front and diagonal window panels aligned to their actual wall angles.
- Stone basement; thick speckled-granite terrace cornice, coping and terrace paving.
- Three front tall windows, angled side windows, basement lights, side/rear fenestration, narrow upper clerestory panes. Window assemblies have actual projecting brown jambs, mullions, transoms, stone heads and sills, dark reveals, and varied opaque reflective glass.
- Red terrace guardrails have posts, post bases and three horizontal rails; raised rear clerestory has a shallow gray hipped roof, hip caps, red fascia and three roof vents.
- Blue-gray downpipes with clips, hoppers and outlet bends; timber/glazed double entrance door with handles; facade medallions and low terrace planters.

### Courtyard

- **Three EMPTY rectangular stone basins**, widening and descending away from the building. No water plane, spray, flowing fountain or water animation exists.
- Dry interior floors, narrow weathering strips, recessed slotted drains, thick walls and individually jointed coping stones; dry cascade aprons/overflow lips between levels.
- Gray modular paving, narrow red-brick inlays, granite curbs and four shallow broad foreground steps with jointed nosings.
- **Two long pergolas**, each with two column rows, pale continuous girders and close-spaced transverse slats. **32 red-brick square pillars total**.
- Dark slatted timber benches with steel supports, masonry planters, raised planting beds, climbing vine stems, overhead vines and hanging leaf groups.
- **17 trees**, including two tiered conifer-like forms and four slender near-facade trees. Canopies comprise branched wood and many small separately oriented leaf blades, not large green sphere meshes. Shrubs and vines use the same small-leaf approach.

## Materials, texture scale and export

- **22 MeshStandardMaterials**; **30 generated 512 × 512 CanvasTextures**.
- Ten procedural textured material families: buff brick, red brick, gray granite, pale concrete, dressed coping, gray roof tile, paving, dry basin stone, bark and earth.
- Each family includes albedo, height-derived tangent-space normal and roughness maps. Albedo uses `SRGBColorSpace`; scalar/normal maps remain linear. All textures use repeat wrapping and **anisotropy 8**.
- UVs are dimensioned in metres before mesh batching rather than stretched once across each object. Brick repeats are 1.08 × 1.16 m with four bricks across and sixteen courses vertically; paving and roof repeats cover 2.4 × 2.4 m. Speckled stone repeats at 1.2–1.5 m according to material.
- Glass is opaque reflective PBR rather than transmission glass, avoiding depth-order/export instability. No shader injection, procedural GPU-only shader, external asset or photo plane is used.
- Like-material static geometry is merged **within semantic groups**. Foliage uses three `InstancedMesh` batches. Cast/receive shadows are configured; broad paving does not cast a giant ground shadow.
- Compatible export uses `GLTFExporter`; foliage is retained through **EXT_mesh_gpu_instancing**. Choose a viewer supporting that extension. Instance colors are exported by Three.js.

## Measured bounds from the constructed scene

Bounds include projecting trim and leaf blade extents, not just nominal dimensions. Values below are rounded for readability; unrounded overall bounds are returned in `stats.bounds`.

| Object/group | X extent | Y extent | Z extent |
|---|---:|---:|---:|
| Building shell | -17.025 … 17.025 | 0 … 11.780 | -9.525 … 3.960 |
| Window/joinery extents | -17.150 … 17.150 | 0 … 10.810 | -9.435 … 3.835 |
| Terrace balustrade | -8.090 … 8.090 | 7.825 … 8.863 | -0.740 … 3.760 |
| Three basins including coping | -4.490 … 4.490 | -0.060 … 1.990 | 9.860 … 32.690 |
| Twin pergolas, excluding vines | -14.225 … 14.225 | 0 … 4.155 | 7.965 … 35.315 |
| Courtyard foundation / paving | -28.500 … 28.500 | -0.820 … 0.280 | -19.000 … 47.000 |
| Entire scene, including foliage | -28.500 … 28.737 | -0.820 … 13.191 | -19.257 … 47.000 |

Nominal basin interior specs, ordered building → foreground:

| Basin | Center Z | Interior width | Interior depth | Dry floor Y |
|---|---:|---:|---:|---:|
| Upper | 12.80 | 5.10 | 5.00 | 1.02 |
| Middle | 19.25 | 6.45 | 7.35 | 0.57 |
| Lower | 27.70 | 8.10 | 9.10 | 0.14 |

Pergola column X positions are ±10.0 and ±13.5 m; column stations run Z = 9.2 through 34.05 m. The clear center of each walk-through pergola is X = ±11.75 m. Slats reach Y = 4.155 m; brick column capitals are around Y = 3.43 m. Near-building trees are centered at X = ±8.7, Z = 4.4/6.6; large trees are predominantly outside |X| = 18 or behind the building.

## Verification evidence

Performed on the owned model module with the installed Three.js 0.181.2:

- `node --check src/model.js`: **passed**.
- Real browser `createModel(THREE)` execution: **passed**, no non-finite geometry attribute values.
- Material/texture audit: every mesh uses `MeshStandardMaterial`; all 30 expected maps are 512 px and have anisotropy 8.
- Constructed totals: **52 mesh batches**, **437,826 rendered triangles**, **94,840 instanced leaves**, **70 window assemblies**, **32 pillars**, **17 trees**, **3 basins**, **2 pergolas**.
- A second fresh build produced identical statistics and identical geometry/instance-transform signatures (`3577268682` for both), verifying deterministic generation from seed `41827`.
- In-memory binary `GLTFExporter` verification succeeded: **24,406,992 bytes**, **51 unique glTF mesh definitions**, **22 materials**, **30 textures**, extension `EXT_mesh_gpu_instancing`. The unique mesh count differs from scene mesh nodes because leaf geometry is shared. This was a verification buffer, **not a saved deliverable GLB**.
- Temporary browser previews inspected front and elevated oblique views. The final renderer, light rig, camera sequence, exported GLB file and video are the parent task's responsibility; this module does not claim a completed video render.
- The existing three camera tests passed during the check. The first project build attempt was blocked by the then-missing parent-owned `src/main.js`; no out-of-scope source files were changed to bypass that integration stage.

## Integration cautions

- Budget a shadow camera for approximately X ±29, Z -20…47, Y 0…14 if lighting the whole composition; tighter per-shot shadow framing can improve definition.
- Dispose generated geometries/materials/textures when replacing the model; a fresh call intentionally creates its own complete resources.
- Keep the foreground basin dry in lighting/color choices: avoid adding a reflective water plane or blue transparent material.
- Low walkthrough cameras fit between column rows. High/wide views reveal inferred rear/roof features and the finite landscape platform; compose within the documented extents or add background environment in the parent renderer.
