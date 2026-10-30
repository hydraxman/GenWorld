import * as THREE from 'three';
import {createPBRTools} from '../../../shared/pbr.js';

export function campusGlass(material) {
  return /glass|glazing|玻璃/i.test(material.name)
    && !/frame|bars|bar |iron|shadow|interior/i.test(material.name);
}

export function installCourtyardSurfaces(campus) {
  let seed = 41827;
  const tools = createPBRTools(THREE, {rand: () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296;
  }, stats: {textures: 0}, materials: {}, textureWorld: new Map()});
  const finishes = new Map(['grain', 'granite', 'brick', 'paving'].map(kind => [kind,
    tools.pbr(`Shared original Courtyard ${kind} finish`, kind, [242, 242, 242], [1, 1], 256)]));
  for (const finish of finishes.values()) for (const key of ['map', 'normalMap', 'roughnessMap']) {
    finish[key].userData.sharedCampusSurface = true;
  }
  const originals = new Map(), uvOriginals = new Map();
  function refresh() {
    for (const layer of [campus.layers.building, campus.layers.landmark, campus.layers.road]) layer.traverse(mesh => {
      if (!mesh.isMesh || mesh.isBatchedMesh || mesh.parent?.name === 'base') return;
      for (const material of [].concat(mesh.material)) {
        if (!material.isMeshStandardMaterial || originals.has(material)) continue;
        if (campusGlass(material)) {
          originals.set(material, {roughness: material.roughness, envMapIntensity: material.envMapIntensity});
          material.roughness = Math.min(.16, material.roughness); material.envMapIntensity = 1.4;
          material.userData.courtyardGlassFinish = true;
          continue;
        }
        if (material.map || material.vertexColors || material.metalness > .25) continue;
        const name = material.name.toLowerCase();
        const kind = layer === campus.layers.road ? 'paving'
          : /brick|masonry/.test(name) ? 'brick'
            : /stone|granite|coping|cornice|plinth|foundation|trim/.test(name) ? 'granite'
              : /render|concrete|wall|roof|facade/.test(name) ? 'grain' : null;
        if (!kind) continue;
        const finish = finishes.get(kind);
        originals.set(material, {map: material.map, normalMap: material.normalMap,
          roughnessMap: material.roughnessMap, normalScale: material.normalScale.clone(), roughness: material.roughness});
        material.map = finish.map; material.normalMap = finish.normalMap; material.roughnessMap = finish.roughnessMap;
        material.normalScale.set(.26, .26); material.roughness = .93; material.needsUpdate = true;
        material.userData.courtyardSurface = kind;
      }
      if (layer === campus.layers.road && !mesh.geometry.attributes.uv) {
        const p = mesh.geometry.attributes.position, values = new Float32Array(p.count * 2);
        for (let i = 0; i < p.count; i++) {values[i * 2] = p.getX(i) / 2.4; values[i * 2 + 1] = p.getZ(i) / 2.4;}
        uvOriginals.set(mesh.geometry, null); mesh.geometry.setAttribute('uv', new THREE.BufferAttribute(values, 2));
      }
    });
  }
  refresh();
  return {refresh, stats: () => ({materials: originals.size, sharedMaps: finishes.size * 3,
    source: 'shared/pbr.js: original Courtyard seeded brick, granite, paving and micrograin recipes'}),
  dispose() {
    for (const [material, values] of originals) {
      Object.assign(material, values); delete material.userData.courtyardSurface; delete material.userData.courtyardGlassFinish;
      material.needsUpdate = true;
    }
    for (const geometry of uvOriginals.keys()) geometry.deleteAttribute('uv');
    for (const finish of finishes.values()) {
      finish.map.dispose(); finish.normalMap.dispose(); finish.roughnessMap.dispose(); finish.dispose();
    }
    originals.clear(); uvOriginals.clear();
  }};
}
