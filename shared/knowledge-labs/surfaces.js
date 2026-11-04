import * as THREE from 'three';
import {createPBRTools} from '../pbr.js';

// The model owns material identities (including mastery colors). Only attach
// maps; do not replace those materials or mutate the shared unit-box UVs.
export function createTeachingSurfaceLibrary() {
  let seed = 7813;
  const tools = createPBRTools(THREE, {rand: () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296;
  }, stats: {textures: 0}, materials: {}, textureWorld: new Map()});
  // Renderer shadow materials can retain color samplers after a room is removed.
  // Keep the two shared atlases alive until the host itself is disposed.
  const templates = new Map(), installations = new Set();
  let released = false;
  function install(root, select) {
    if (released) throw new Error('Teaching surface library has been disposed.');
    const kinds = new Map(), geometries = new Map(), originals = [], materials = [];
    root.traverse(object => {
      if (!object.isMesh || Array.isArray(object.material)) return;
      const kind = select(object);
      if (!kind) return;
      if (!['wood', 'stone'].includes(kind)) throw new Error(`Unknown teaching surface: ${kind}`);
      if (kinds.has(object.material) && kinds.get(object.material) !== kind) throw new Error('A shared material cannot have conflicting surfaces.');
      kinds.set(object.material, kind);
    });
    for (const [material, kind] of kinds) {
      if (!templates.has(kind)) {
        const template = tools.pbr(`Original teaching ${kind}`, kind === 'stone' ? 'granite' : kind,
          [246, 246, 246], kind === 'wood' ? [2.4, 1.2] : [1.2, 1.2], kind === 'wood' ? 512 : 256);
        for (const key of ['map', 'normalMap', 'roughnessMap']) template[key].name = `Original teaching ${kind} ${key}`;
        templates.set(kind, template);
      }
      const template = templates.get(kind);
      materials.push({material, map: material.map, normalMap: material.normalMap, roughnessMap: material.roughnessMap,
        normalScale: material.normalScale.clone(), roughness: material.roughness, metalness: material.metalness});
      for (const key of ['map', 'normalMap', 'roughnessMap']) material[key] = template[key];
      material.normalScale.set(kind === 'wood' ? .18 : .16, kind === 'wood' ? .18 : .16);
      material.roughness = 1; material.metalness = 0; material.needsUpdate = true;
    }
    root.traverse(object => {
      if (!object.isMesh || object.userData.meterUV || !kinds.has(object.material) ||
          !['BoxGeometry', 'RoundedBoxGeometry'].includes(object.geometry.type)) return;
      const template = templates.get(kinds.get(object.material));
      const key = `${object.geometry.uuid}:${object.scale.toArray().join(',')}:${kinds.get(object.material)}`;
      if (!geometries.has(key)) {
        const geometry = object.geometry.clone(), scaled = object.geometry.clone();
        scaled.scale(...object.scale.toArray()); tools.worldUV(scaled, template);
        geometry.setAttribute('uv', scaled.getAttribute('uv').clone()); scaled.dispose();
        geometries.set(key, geometry);
      }
      originals.push([object, object.geometry]); object.geometry = geometries.get(key);
    });
    let disposed = false;
    const installation = {
      stats: {materials: kinds.size, textures: templates.size * 3, uvGeometries: geometries.size},
      dispose() {
        if (disposed) return;
        disposed = true;
        for (const [object, geometry] of originals) object.geometry = geometry;
        for (const {material, ...original} of materials) {Object.assign(material, original); material.needsUpdate = true;}
        for (const geometry of geometries.values()) geometry.dispose();
        installations.delete(installation);
      },
    };
    installations.add(installation);
    return installation;
  }
  return {install,
    dispose() {
      if (released) return;
      released = true;
      for (const installation of installations) installation.dispose();
      for (const material of templates.values()) {
        for (const key of ['map', 'normalMap', 'roughnessMap']) material[key].dispose();
        material.dispose();
      }
      templates.clear();
    },
  };
}
