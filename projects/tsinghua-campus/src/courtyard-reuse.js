import * as THREE from 'three';
import {createModel} from '../../courtyard/src/model.js';

const ARCHITECTURE = new Set(['Building shell', 'Windows and facade joinery', 'Terrace balustrade']);
const FORECOURT = new Set(['Three empty stone cascade basins', 'Twin pergolas']);

export function createCourtyardReuse({textured = false} = {}) {
  const {group, stats} = createModel(THREE, {architectureOnly: true, textured});
  const retainedMaterials = new Set(), retainedGeometries = new Set(), retainedTextures = new Set();
  const removedMaterials = new Set(), removedGeometries = new Set();
  for (const child of [...group.children]) {
    const keep = ARCHITECTURE.has(child.name) || FORECOURT.has(child.name);
    child.traverse(object => {
      if (object.geometry) (keep ? retainedGeometries : removedGeometries).add(object.geometry);
      for (const material of (Array.isArray(object.material) ? object.material : object.material ? [object.material] : [])) {
        (keep ? retainedMaterials : removedMaterials).add(material);
      }
    });
    if (!keep) group.remove(child);
    else child.userData.role = ARCHITECTURE.has(child.name) ? 'legacy-library-architecture' : 'legacy-library-forecourt';
  }
  for (const material of retainedMaterials) {
    for (const value of Object.values(material)) if (value?.isTexture) retainedTextures.add(value);
  }
  for (const geometry of removedGeometries) if (!retainedGeometries.has(geometry)) geometry.dispose();
  const disposedTextures = new Set();
  for (const material of removedMaterials) {
    if (retainedMaterials.has(material)) continue;
    for (const value of Object.values(material)) {
      if (value?.isTexture && !retainedTextures.has(value) && !disposedTextures.has(value)) {
        value.dispose();
        disposedTextures.add(value);
      }
    }
    material.dispose();
  }
  group.name = 'GenWorld courtyard source geometry · reusable architecture and dry stone basins';
  Object.assign(group.userData, {
    reusedSource: 'projects/courtyard/src/model.js',
    sourceUnits: 'metres',
    sourceFront: '+Z',
    noReferencePhotoTextures: true,
    landscapeLimit: 'Original three basins are dry; previously added water is not proof of surveyed campus water.',
    placementStatus: 'unplaced-source-model',
  });
  group.updateMatrixWorld(true);
  const architectureBounds = new THREE.Box3();
  let meshes = 0;
  for (const child of group.children) {
    if (ARCHITECTURE.has(child.name)) architectureBounds.union(new THREE.Box3().setFromObject(child));
    child.traverse(object => { if (object.isMesh) meshes++; });
  }
  return {group, architectureBounds, stats: {sourceWindows: stats.windows, basins: stats.basins,
    pergolas: stats.pergolas, meshes, sourceSeed: stats.seed}};
}
