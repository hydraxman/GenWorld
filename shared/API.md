# Shared architectural rendering API (stable)

Imports are ESM, bundled with Three.js 0.181.2. Shared source lives at `shared/`; each project serves the CC0 leaf files as `./assets/leaves/` (copy or symlink). Dependencies must resolve `three` from workspace root or shared/node_modules.

- `leaves.js`: `await loadLeafTextures(THREE,{baseUrl='./assets/leaves/'}={})`; `createLeafGeometry(THREE,scale=1)`; `createLeafMaterial(THREE,name)`. Same V6 photographed MapleLeaf01 lobed outline, curvature, normal handedness and texture pipeline. Load before model creation.
- `illumination.js`: `createLightingPipeline(renderer,scene,camera)` → `{composer,ao,render()}`. V6 seeded GTAO + output pass, 1920×1080 output.
- `environment.js`: `makeEnvironment(THREE,renderer)` → `{background,environment}`; `addCampusLights(THREE,scene)` → `{hemi,sun,fill}`. V6 IBL sky and lighting unchanged.
- `pbr.js`: `createPBRTools(THREE,{rand,stats,materials,textureWorld})` → `{pbr,worldUV,texture}`. Does not consume rand until pbr() is called. Supply seeded rand in existing call order to preserve all geometry.
- `glass-reflections.js`: `installGlassReflections(THREE,renderer,scene,root,options={})` → `{update(camera),setEnabled(bool),stats,beginExport()}`. Call after scene.add(root) and updateMatrixWorld(true). Call update(camera) BEFORE each beauty render, never from onBeforeRender. beginExport() returns restoration function; use try/finally around GLTFExporter.

## Reflection design and options

Real local cubemap capture of scene sky/trees/architecture, cached for static scenes; no screen-space-only illusion and no surrogate tree texture. Default one 256-pixel cubemap (six capture renders once), shared by glazing; bounded draw calls. Options: `resolution=256`, `position=[x,y,z]` (recommended at exterior facade height; otherwise inferred from glass bounds on +Z facade), `getRevision=()=>0` (return a different value when geometry moves), `isGlass=(material,mesh)=>...` (default material name contains glass/glazing/玻璃), `intensity=1.1`, `roughness=0.1`, `metalness=0.5`.

Courtyard verified settings: `{position:[0,5,5],intensity:2.2,roughness:.025,metalness:.85,getRevision:()=>time>=36?time:0}`. These stronger mirror settings expose recognizable mapped trees in the approved 18.5-second view; defaults are intentionally subtler.

Lazy consumers can call `refresh()` after adding meshes, `setPosition(Vector3)` to relocate the one probe, and `invalidate()` after scene changes. `prepareExport(clone)` removes live cube textures from an export clone without mutating the viewer. `dispose()` restores originals and releases cloned materials and the target. Callers own capture scheduling; the campus uses one low-resolution, rate-limited near-view probe rather than a probe per building. Courtyard's `createWaterShader(THREE)` exposes its unchanged water shader for the campus's single merged mapped-water reflector.

Optional `physical:true` adds a dielectric clearcoat finish while retaining the source's standard material fields; `colorScale` (default1) tunes the live tint only. The campus uses these with `metalness:0`; exports and disabled reflection restore the original material. Default Courtyard behavior is unchanged.

All glass and existing water Reflectors are hidden during capture. scene.overrideMaterial and recursive calls skip capture. Shadow state is preserved; the probe itself is unshadowed to avoid cached prior-frame shadows on nonsequential seeks (beauty pass retains all V6 shadows). No capture from GTAO normal/depth passes. Disabled/export state restores original PBR materials; GLB cannot embed the live scene capture. Render with scene background/environment initialized before install.

Approximation boundary: one local probe is exact only at its sample position, so distant windows have parallax approximation, not raytraced per-pane reflection. Transparent glass-to-glass and water-in-glass recursion are deliberately excluded. For static scenes, probe is independent of viewing camera and captured once; pass getRevision for moving/exploded scenes. Material geometry and camera files are not changed.
