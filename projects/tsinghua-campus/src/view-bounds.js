import * as THREE from 'three';

export function viewBounds(object) {
  const local = object.userData.focusBoundsLocal;
  if (local === undefined) return new THREE.Box3().setFromObject(object);
  if (!local || ![local.min, local.max].every(point =>
    Array.isArray(point) && point.length === 3 && point.every(Number.isFinite)) ||
      local.min.some((value, index) => value >= local.max[index])) {
    throw new Error(`Invalid local photo-focus bounds: ${object.userData.featureId || object.name}`);
  }
  object.updateWorldMatrix(true, false);
  return new THREE.Box3(new THREE.Vector3(...local.min), new THREE.Vector3(...local.max))
    .applyMatrix4(object.matrixWorld);
}
