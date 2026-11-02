import * as THREE from 'three';

// Widths of decorative rods/joints, not wall thicknesses or opening dimensions.
const detailWidths = new Map([
  ['zijing: aluminium frames and rails', .09],
  ['Main building slender window frames', .07],
  ['Warm silver anodized mullions', .08],
  ['old-library slender pale metal mullions', .08],
  ['Science Hall slender dark window bars', .06],
  ['West Gym slender dark frames', .07],
  ['Terracotta panel joint', .025],
]);
const sourceVisibility = 'campusDisplaySourceVisible';

export function projectedScale(camera, point, outputHeight, radius = 0) {
  const depth = Math.max(camera.near, -point.clone().applyMatrix4(camera.matrixWorldInverse).z - radius);
  return outputHeight * Math.abs(camera.projectionMatrix.elements[5]) / 2 /
    (camera.isOrthographicCamera ? 1 : depth);
}

export function displayTier(pixels, previous = 0) {
  if (!Number.isFinite(pixels) || pixels < 0) throw new RangeError('Projected size must be finite and non-negative.');
  for (const [level, threshold] of [600, 160].entries()) {
    if (pixels > threshold * (previous > level ? 1.2 : 1)) return level;
  }
  return 2;
}

function batchKey(mesh) {
  const g = mesh.geometry;
  if (mesh.isInstancedMesh || mesh.isSkinnedMesh || Array.isArray(mesh.material) ||
      mesh.material.transparent || Object.keys(g.morphAttributes).length || mesh.customDepthMaterial ||
      mesh.customDistanceMaterial || g.drawRange.start || g.drawRange.count !== Infinity) return null;
  return [mesh.material.uuid, mesh.castShadow, mesh.receiveShadow, mesh.layers.mask, mesh.renderOrder,
    Boolean(g.index), ...Object.entries(g.attributes).map(([name, a]) =>
      `${name}:${a.itemSize}:${a.normalized}:${a.array.constructor.name}`)].join('|');
}

export function createDetailedDisplay(campus, {batching = true} = {}) {
  const entries = [], groups = new Map(), batches = [];
  campus.group.updateMatrixWorld(true);
  for (const [id, root] of campus.objects) {
    if (root.userData.refinementStatus !== 'detailed') continue;
    const box = new THREE.Box3();
    const meshes = [];
    root.traverseVisible(mesh => {
      if (!mesh.isMesh) return;
      box.expandByObject(mesh);
      let apartmentNumber = null;
      for (let ancestor = mesh; ancestor && ancestor !== root; ancestor = ancestor.parent) {
        apartmentNumber ||= ancestor.userData.apartmentNumber || null;
      }
      const item = {mesh, root, id, apartmentNumber, visible: mesh.visible, shown: true,
        width: detailWidths.get(mesh.material.name) || 0};
      meshes.push(item);
      const key = batchKey(mesh);
      if (batching && key) {
        const layer = campus.layers[root.userData.kind];
        const scoped = `${layer.uuid}|${key}`;
        if (!groups.has(scoped)) groups.set(scoped, {layer, items: []});
        groups.get(scoped).items.push(item);
      }
    });
    if (box.isEmpty()) throw new Error(`Detailed display has no geometry: ${id}`);
    entries.push({id, root, meshes, sphere: box.getBoundingSphere(new THREE.Sphere()), tier: 0});
  }
  let bytes = 0;
  for (const {layer, items} of groups.values()) {
    // Already-merged large meshes stay shared; don't duplicate megabytes to save one call.
    const geometries = [...new Set(items.map(item => item.mesh.geometry))];
    const vertices = geometries.reduce((n, g) => n + g.attributes.position.count, 0);
    const geometryBytes = geometries.reduce((n, g) => n + (g.index?.array.byteLength || 0) +
      Object.values(g.attributes).reduce((sum, a) => sum + a.array.byteLength, 0), 0);
    if (items.length < 4 || vertices > 180000 || geometryBytes / (items.length - 1) > 65536) continue;
    const indices = geometries.reduce((n, g) => n + (g.index?.count || 0), 0);
    const source = items[0].mesh;
    const batch = new THREE.BatchedMesh(items.length, vertices, indices, source.material);
    batch.name = `Display-only refined material batch: ${source.material.name}`;
    batch.userData = {campusDetailedBatch: true, identities: []};
    batch.castShadow = source.castShadow; batch.receiveShadow = source.receiveShadow;
    batch.layers.mask = source.layers.mask; batch.renderOrder = source.renderOrder;
    batch.sortObjects = false; batch.perObjectFrustumCulled = true;
    const ids = new Map();
    for (const geometry of geometries) {
      ids.set(geometry, batch.addGeometry(geometry));
    }
    bytes += geometryBytes;
    const inverse = layer.matrixWorld.clone().invert();
    for (const item of items) {
      const instance = batch.addInstance(ids.get(item.mesh.geometry));
      batch.setMatrixAt(instance, new THREE.Matrix4().multiplyMatrices(inverse, item.mesh.matrixWorld));
      batch.userData.identities[instance] = {featureId: item.id, apartmentNumber: item.apartmentNumber};
      item.batch = batch; item.instance = instance;
    }
    layer.add(batch); batch.computeBoundingSphere(); batches.push(batch);
  }
  for (const entry of entries) for (const item of entry.meshes) {
    if (item.batch || item.width) item.mesh.userData[sourceVisibility] = item.visible;
  }
  const stats = {roots: entries.length, batches: batches.length, batchGeometryBytes: bytes, batching,
    tiers: [0, 0, 0], omittedSubpixelMeshes: 0, enabled: true};
  let enabled = true;
  return {
    stats: () => ({...stats, tiers: [...stats.tiers]}),
    setEnabled(value) {
      if (typeof value !== 'boolean') throw new TypeError('Detailed display enablement must be a boolean.');
      enabled = value;
    },
    update(camera, outputHeight) {
      if (!(outputHeight > 0) || !Number.isFinite(outputHeight)) throw new RangeError('Display LOD needs output pixel height.');
      camera.updateWorldMatrix(true, false);
      stats.enabled = enabled; stats.tiers.fill(0); stats.omittedSubpixelMeshes = 0;
      for (const entry of entries) {
        const scale = projectedScale(camera, entry.sphere.center, outputHeight, entry.sphere.radius);
        entry.tier = displayTier(entry.sphere.radius * 2 * scale, entry.tier);
        stats.tiers[entry.tier]++;
        for (const item of entry.meshes) {
          let visible = item.visible;
          if (enabled && item.width && entry.tier > 0) {
            const threshold = entry.tier === 1 ? .3 : .65;
            visible = item.width * scale >= threshold * (item.shown ? 1 : 1.2);
            if (!visible) stats.omittedSubpixelMeshes++;
          }
          item.shown = visible;
          if (item.batch) {
            item.mesh.visible = enabled ? false : item.visible;
            item.batch.setVisibleAt(item.instance, enabled && visible && entry.root.visible);
          } else if (item.width) item.mesh.visible = enabled ? visible : item.visible;
        }
      }
      for (const batch of batches) batch.visible = enabled;
    },
    dispose() {
      for (const entry of entries) for (const item of entry.meshes) {
        item.mesh.visible = item.visible;
        delete item.mesh.userData[sourceVisibility];
      }
      for (const batch of batches) {batch.removeFromParent(); batch.dispose();}
    },
  };
}

export function prepareDetailedExport(object) {
  const proxies = [];
  object.traverse(mesh => {
    if (mesh.userData.campusDetailedBatch) proxies.push(mesh);
    if (Object.hasOwn(mesh.userData, sourceVisibility)) {
      mesh.visible = mesh.userData[sourceVisibility];
      delete mesh.userData[sourceVisibility];
    }
  });
  // Clones share GPU buffers with the live viewer; never dispose them here.
  for (const proxy of proxies) proxy.removeFromParent();
  return object;
}
