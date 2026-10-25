---
name: genworld-3d
description: "Build or refine procedural Three.js geometry, architectural details, PBR materials, lighting, and render quality in GenWorld. Uses the installed img2threejs knowledge, material registry, and staged prompts; reference images are optional."
---

# GenWorld 3D construction

Use img2threejs as a local construction library, not as a required image-conversion pipeline. The upstream checkout is in `.agents/skills/img2threejs`; paths below are relative to that checkout. Its unmodified `SKILL.md` is the separate, image-driven workflow: enter it only when that workflow is explicitly requested.

## Resource preflight

Run `npm run skills:check:3d` from the repository root. If missing, run `npm run skills:install:3d`; it uses authenticated GitHub CLI (`gh`) to retrieve the pinned Apache-2.0 source, preserving its license and all resources. Existing modified installations require preservation before replacement. Knowledge-search scripts use Python 3.10+ with the standard library. Restart the agent to discover newly installed skills; the references are readable immediately.

The base library is enough for geometry, material and lighting work. External vision services, generated meshes and domain plugins are separate opt-ins. Asset catalogs and sponsor links are references, not authorization to download or publish their content.

## Read only the branch needed

Search the local knowledge before inventing a construction technique:

```powershell
python .agents\skills\img2threejs\forge\stage1_intake\search_specs.py --help
python .agents\skills\img2threejs\forge\stage1_intake\search_specs.py --collection core_3d --limit 4 "UV normal roughness PBR"
```

Use focused `core_3d` queries for topology, material channels or component hierarchy. Its vocabulary is generic and is not an architectural catalog. When results are absent, irrelevant or cite unavailable source files, read the relevant reference in the table directly and verify technical claims against the installed Three.js code. The search ranking is not a quality score.

| Task | Upstream references |
|---|---|
| Geometry, repetition, openings, hierarchy or mesh budget | `grimoire/build/geometry_patterns.md`, `grimoire/glossary/3d_vocabulary.md` |
| PBR materials, UVs or texture channels | `docs/materials/THREEJS_MATERIAL_REFERENCE.md`, `docs/materials/material-reference.json`, `grimoire/build/threejs_texture_reference.md` |
| Lighting or flat/plastic-looking surfaces | `grimoire/feedback/shading_realism.md` |
| Plan a new model or improve an existing one | `docs/standard-prompts/build.md` or `docs/standard-prompts/polish.md`; use the construction stages, not their image-only prerequisites |
| Missing details or uncertain visual quality | `grimoire/intake/detail_inventory.md`, `grimoire/review/self_correction.md`, `grimoire/feedback/render_capture.md` |

## Construction loop

1. **Contract.** Read the target project's model and validation conventions. Define the intended view, scale, recognizable features, unknown surfaces and performance budget. A reference image is optional; distinguish observation, provided facts and estimates.
2. **Blockout → structure → form.** Resolve hierarchy, silhouette and proportion before surface work. Represent identity-defining window recesses, frames, openings, columns and roof edges in geometry when their depth or silhouette matters. Finish when every required feature has an implementation location.
3. **Material → lighting.** Specify surface scale, UV projection, independent color/normal/roughness signals and dielectric/metal response. Verify UVs are used, textures have loaded, and channels match the installed Three.js version. Choose map size from the actual close-up and memory budget rather than copying an upstream resolution threshold. Keep existing exporter-compatible representations.
4. **Observe → correct.** Capture the actual browser output at a fixed camera and viewport. Inspect the whole model and feature close-ups. For material changes, examine neutral, grazing and intended presentation light; compare photos only when legally available and relevant. Name the worst identity-defining mismatch, attribute it to one component or material field, and change one cause per cycle. Recapture the same view and retain only demonstrated improvements. Pixel thresholds supplement visual judgment; they do not establish fidelity.
5. **Accept.** Verify required details remain visible on desktop and mobile, preserve performance, and run the affected project's geometry, export and offline checks. Report approximations and unresolved mismatches explicitly.

## Repository constraints

- Preserve existing projects and their Three.js dependency; keep generated evidence and the upstream checkout out of commits and public Pages output.
- For campus models, read `projects/tsinghua-campus/MODELING.md`: preserve frozen identities, footprints, holes, local origins and replacement roots. Estimated windows remain distinguishable from photo-supported reconstructions.
- Reference photos, imported meshes, HDRIs and texture packs retain their own licenses. Prefer original procedural surfaces or clearly authorized assets; copying a recipe does not authorize its example image.
- Reuse the project's actual render, material and GLB seams. Upstream snippets are references, not permission to replace the renderer, bypass export checks, or claim an unobserved surface is known.

## Reusable task prompts

**Construction:** “Use genworld-3d to build {subject} in {project}. Retrieve local geometry and material references first. Preserve the project's scale and model interface. Implement macro form, structural details and material response in separate passes; capture and inspect the actual result before accepting each pass.”

**Look development:** “Use genworld-3d to improve {surface or lighting problem}. Separate geometry, material and illumination causes. Use the material registry as a starting point, verify UV scale and channel handling, and compare neutral, grazing and presentation views. Retain only changes supported by observed renders.”

**Quality repair:** “Use genworld-3d to inspect {model}. Inventory missing or unreadable defining features, trace each to geometry, material or camera behavior, then fix and recapture. Preserve identities and export behavior; distinguish verified structure from estimates.”
