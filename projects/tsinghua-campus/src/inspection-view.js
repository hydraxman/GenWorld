import * as THREE from 'three';

function corners(box) {
  if (box.isEmpty() || ![...box.min.toArray(), ...box.max.toArray()].every(Number.isFinite)) {
    throw new Error('Campus inspection requires finite, nonempty bounds.');
  }
  return [box.min.x, box.max.x].flatMap(x =>
    [box.min.y, box.max.y].flatMap(y => [box.min.z, box.max.z].map(z => new THREE.Vector3(x, y, z))));
}

export function fitInspectionView(camera, box, {width, height, region, padding = 1.15, direction = [0.33, 0.92, 1.1]}) {
  if (![width, height, padding].every(v => Number.isFinite(v) && v > 0) ||
      !region || ![region.x, region.y, region.width, region.height].every(Number.isFinite) ||
      region.width <= 0 || region.height <= 0 || region.x < 0 || region.y < 0 ||
      region.x + region.width > width + 1e-6 || region.y + region.height > height + 1e-6 ||
      !Array.isArray(direction) || direction.length !== 3 || !direction.every(Number.isFinite) ||
      Math.hypot(...direction) === 0) {
    throw new Error('Invalid campus inspection viewport or direction.');
  }
  const points = corners(box), center = box.getCenter(new THREE.Vector3());
  const axis = new THREE.Vector3(...direction).normalize();
  camera.position.copy(center).add(axis);
  camera.lookAt(center);
  const inverse = camera.quaternion.clone().invert();
  const local = points.map(point => point.sub(center).applyQuaternion(inverse));
  if (camera.isPerspectiveCamera) {
    camera.aspect = width / height;
    const tangent = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const tanX = tangent * camera.aspect * region.width / width;
    const tanY = tangent * region.height / height;
    const distance = Math.max(12, ...local.map(p =>
      p.z + padding * Math.max(Math.abs(p.x) / tanX, Math.abs(p.y) / tanY)));
    camera.position.copy(center).addScaledVector(axis, distance);
  } else if (camera.isOrthographicCamera) {
    camera.position.copy(center).addScaledVector(axis, 6000);
    const halfX = Math.max(4, ...local.map(p => Math.abs(p.x)));
    const halfY = Math.max(4, ...local.map(p => Math.abs(p.y)));
    camera.zoom = Math.min((camera.right - camera.left) * region.width / width / (2 * halfX),
      (camera.top - camera.bottom) * region.height / height / (2 * halfY)) / padding;
  } else throw new Error('Unsupported campus inspection camera.');
  // Shift the optical centre, not the model, into the unobstructed canvas region.
  camera.setViewOffset(width, height,
    width / 2 - region.x - region.width / 2, height / 2 - region.y - region.height / 2, width, height);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  return center;
}

export function fitInspectionShadow(light, box) {
  corners(box);
  const size = box.getSize(new THREE.Vector3());
  const extent = Math.max(24, size.length() * .7);
  const center = box.getCenter(new THREE.Vector3());
  light.target.position.copy(center);
  light.position.copy(center).addScaledVector(new THREE.Vector3(-.55, .9, -.35).normalize(), extent * 3);
  Object.assign(light.shadow.camera, {
    left: -extent, right: extent, top: extent, bottom: -extent,
    near: extent * .1, far: extent * 6,
  });
  light.shadow.normalBias = Math.max(.012, Math.min(.6, extent / light.shadow.mapSize.x * .65));
  light.shadow.bias = -.00005;
  light.shadow.camera.updateProjectionMatrix();
  light.target.updateMatrixWorld(true);
  light.shadow.needsUpdate = true;
  return {extent, texelMeters: extent * 2 / light.shadow.mapSize.x};
}
