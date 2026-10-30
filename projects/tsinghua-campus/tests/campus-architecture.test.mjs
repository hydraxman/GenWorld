import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import data from '../data/campus.json' with {type: 'json'};
import evidence from '../data/architecture-evidence.json' with {type: 'json'};
import catalog from '../src/reference-catalog.js';
import {architectureEvidence} from '../scripts/architecture-evidence.mjs';
import {createCampusModel, disposeOwnedDetail} from '../src/model.js';
import {applyCampusRefinements, REFINEMENT_SITES} from '../src/refinements.js';
import {createCoverage} from '../src/coverage.js';
import {footprintMetrics} from '../src/geo.js';
import {PHOTO_APPEARANCES} from '../src/photo-appearance.js';
import {applyCampusArchitecture, disposeCampusArchitecture, prepareArchitectureExport, architectureSpec,
  createArchitectureResources, createArchitectureDetail} from '../src/campus-architecture.js';

const photoIds = new Set(REFINEMENT_SITES.map(site => site.featureId));
const plainFeatures = data.features.filter(feature => feature.properties.kind === 'building' && !photoIds.has(feature.id));
const subset = (features = plainFeatures.slice(0, 3)) => ({...data, features});
const nearGroup = root => root.children.find(child => child.userData.architectureLOD)?.children.find(child => child.userData.architectureNear);
const nearMeshes = root => {
  const meshes = [];
  nearGroup(root).traverse(object => {if (object.isMesh) meshes.push(object);});
  return meshes;
};

test('architectural evidence is an exact offline replay, not nearest-name or POI borrowing', async () => {
  assert.deepEqual(await architectureEvidence(), evidence);
  assert.equal(evidence.sources.architecture.byteRepresentation,
    'LF line endings as committed; SHA-256 covers the exact file bytes.');
  assert.equal(evidence.buildings.length, 650);
  assert.equal(new Set(evidence.buildings.map(record => record.featureId)).size, 650);
  for (const record of evidence.buildings) {
    if (record.match === 'overlap-verified') {
      assert.ok(record.intersectionOverUnion >= .8 && record.intersectionOverUnion <= 1);
      assert.match(record.sourceId, /^osm:way:\d+$/);
    } else assert.deepEqual(record.tags, {});
    for (const key of Object.keys(record.tags)) assert.ok(
      ['building', 'building:part', 'building:levels', 'roof:shape', 'roof:height', 'height', 'min_height'].includes(key));
  }
});

test('all650 frozen buildings have architectural geometry without increasing photo-verified coverage', () => {
  const campus = createCampusModel(data), frozen = JSON.stringify(data);
  applyCampusRefinements(campus, data, {textured: false});
  const originals = new Map([...photoIds].map(id => [id, campus.buildings.get(id).children.find(child => child.userData.campusDetail)]));
  const ids = applyCampusArchitecture(campus, data);
  assert.equal(ids.length, 610);
  assert.deepEqual(new Set(ids), new Set(plainFeatures.map(feature => feature.id)));
  let triangles = 0, bytes = 0, windows = 0;
  const textures = new Set(), families = new Set();
  for (const [id, root] of campus.buildings) {
    assert.equal(root.userData.featureId, id);
    assert.equal(root.getObjectByName('base').visible, false);
    assert.equal(root.children.filter(child => child.userData.campusDetail).length, 1);
    if (photoIds.has(id)) {
      assert.equal(root.children.find(child => child.userData.campusDetail), originals.get(id));
      assert.equal(root.userData.refinementStatus, 'detailed');
      continue;
    }
    assert.equal(root.userData.refinementStatus, 'procedural');
    assert.equal(root.userData.referenceSite, undefined);
    const detail = root.children.find(child => child.userData.architectureLOD), near = nearGroup(root);
    const d = detail.userData;
    const feature = plainFeatures.find(feature => feature.id === id);
    const metrics = footprintMetrics(feature.geometry, data.metadata.center);
    assert.equal(d.footprintArea, metrics.area);
    assert.equal(d.holeCount, metrics.projected.reduce((sum, polygon) => sum + polygon.length - 1, 0));
    assert.ok(root.position.equals(new THREE.Vector3(metrics.origin[0], 0, metrics.origin[1])));
    assert.match(root.userData.refinementSummary, /程序建筑估算.*非照片/);
    let meshes = 0;
    detail.traverse(object => {
      if (!object.isMesh) return;
      meshes++;
      const geometry = object.geometry;
      for (const attribute of Object.values(geometry.attributes)) {
        assert.ok(attribute.array.every(Number.isFinite), `Nonfinite geometry at ${id}`);
        bytes += attribute.array.byteLength;
      }
      assert.ok(geometry.attributes.uv);
      triangles += (geometry.index?.count ?? geometry.attributes.position.count) / 3;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        assert.equal(material.userData.sharedCampusMaterial, true);
        for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
        if (material.map) {
          const uv = geometry.attributes.uv;
          for (const axis of [0, 1]) {
            const values = Array.from({length: uv.count}, (_, i) => uv.array[i * 2 + axis]);
            assert.ok(Math.max(...values) - Math.min(...values) > .01, `Degenerate texture mapping at ${id}`);
          }
        }
      }
    });
    assert.ok(meshes >= 3 && meshes <= (d.appearanceProfile ? 13 : 12), `Bounded batches required at ${id}: ${meshes}`);
    families.add(d.family);
    near.updateMatrixWorld(true);
    if (!['pavilion', 'grandstand'].includes(d.family)) {
      assert.ok(d.windowCount > 0, `Windowless envelope at ${id}`);
      assert.equal(d.doorwayCount, d.photoFacade?.doorwayCount ?? 1, `Missing entrance at ${id}`);
      windows += d.windowCount;
      for (const probe of [...d.windowProbes.filter((v, i) => i % Math.max(1, Math.floor(d.windowCount / 5)) === 0), ...d.doorProbes]) {
        const hits = new THREE.Raycaster(new THREE.Vector3(...probe.outside),
          new THREE.Vector3(...probe.normal).negate(), 0, d.photoFacade ? 3 : 1.5).intersectObject(near, true)
          .filter(hit => !hit.object.parent.userData.photoAppearanceEntrance);
        assert.ok(hits.length, `Missing physical window/door at ${id}`);
        assert.match(hits[0].object.material.name, /glass/, `Opening blocked by opaque material at ${id}`);
        assert.ok(hits[0].distance > 1.1, `Glass must be recessed, not painted onto a solid wall at ${id}`);
      }
    } else {
      assert.equal(d.windowCount, 0);
      assert.equal(d.doorwayCount, 0);
    }
    const bounds = new THREE.Box3().setFromObject(near);
    assert.ok(Math.abs(bounds.min.y - feature.properties.minHeight) < 1e-4);
    assert.ok(Math.abs(bounds.max.y - root.userData.renderHeight) < 1e-4);
  }
  assert.ok(families.size >= 7);
  assert.ok(windows > 5000);
  assert.ok(triangles < 1000000, `Procedural triangle budget exceeded: ${triangles}`);
  assert.ok(bytes < 100000000, `Procedural geometry memory exceeded: ${bytes}`);
  assert.ok(textures.size <= 16, `Textures must be shared across610 roots, not copied per window/building: ${textures.size}`);
  const report = createCoverage(campus, data, catalog);
  assert.equal(report.counts.architectureModelBuildingObjects, 650);
  assert.equal(report.counts.proceduralArchitectureBuildingObjects, 610);
  assert.equal(report.counts.photoModelBuildingObjects, 40);
  assert.equal(report.counts.photoAppearanceBuildingObjects, 16);
  assert.equal(report.counts.photoAppearanceSites, 15);
  assert.equal(report.counts.remainingBaseBuildingObjects, 0);
  assert.equal(report.counts.remainingWorkBuildingObjects, 638);
  assert.equal(report.allFootprintsHaveArchitecture, true);
  assert.equal(report.allFootprintsHavePhotoModels, false);
  assert.equal(report.completeFaithfulReplication, false);
  assert.equal(JSON.stringify(data), frozen);
  const identities = [];
  campus.group.traverse(object => {if (object.userData.featureId) identities.push(object.userData.featureId);});
  assert.equal(identities.length, 650);
  assert.equal(new Set(identities).size, 650);
  console.log(JSON.stringify({proceduralRoots: ids.length, windows, triangles, geometryBytes: bytes, sharedTextures: textures.size}));
  disposeCampusArchitecture(campus);
});

test('courtyard holes remain open from ground to sky on every procedural courtyard', () => {
  const features = plainFeatures.filter(feature => footprintMetrics(feature.geometry, data.metadata.center).projected.some(polygon => polygon.length > 1));
  assert.ok(features.length > 0);
  const campus = createCampusModel(subset(features));
  applyCampusArchitecture(campus, subset(features));
  for (const feature of features) {
    const root = campus.buildings.get(feature.id), near = nearGroup(root);
    near.updateMatrixWorld(true);
    const metrics = footprintMetrics(feature.geometry, data.metadata.center);
    for (const polygon of metrics.projected) for (const ring of polygon.slice(1)) {
      const points = ring.slice(0, -1).map(p => new THREE.Vector2(...p));
      const triangles = THREE.ShapeUtils.triangulateShape(points, []);
      const indices = triangles.sort((a, b) => {
        const area = triangle => Math.abs(points[triangle[1]].clone().sub(points[triangle[0]])
          .cross(points[triangle[2]].clone().sub(points[triangle[0]])));
        return area(b) - area(a);
      })[0];
      const point = indices.reduce((p, i) => p.add(points[i]), new THREE.Vector2()).multiplyScalar(1 / 3);
      const hits = new THREE.Raycaster(new THREE.Vector3(point.x - metrics.origin[0], 100, point.y - metrics.origin[1]),
        new THREE.Vector3(0, -1, 0)).intersectObject(near, true);
      assert.deepEqual(hits, [], `A courtyard was roofed over at ${feature.id}`);
    }
  }
  disposeCampusArchitecture(campus);
});

test('near/far display is exclusive, while exports always contain full architectural geometry', () => {
  const d = subset(), campus = createCampusModel(d);
  applyCampusArchitecture(campus, d);
  const root = campus.buildings.values().next().value, detail = root.children.find(child => child.userData.architectureLOD);
  const near = nearGroup(root), far = detail.children.find(child => child.userData.architectureFar);
  const camera = new THREE.PerspectiveCamera();
  camera.position.copy(root.position).add(new THREE.Vector3(0, 10, 30));
  campus.updateArchitectureLOD(camera);
  assert.equal(near.visible, true); assert.equal(far.visible, false);
  camera.position.set(0, 10000, 10000); campus.updateArchitectureLOD(camera);
  assert.equal(near.visible, false); assert.equal(far.visible, true);
  const clone = prepareArchitectureExport(root.clone(true));
  assert.equal(nearGroup(clone).visible, true);
  assert.equal(clone.children.find(child => child.userData.architectureLOD).children.find(child => child.userData.architectureFar).visible, false);
  assert.equal(near.visible, false, 'Preparing an export must not change the on-screen LOD');
  camera.position.copy(root.position); campus.updateArchitectureLOD(camera, false);
  assert.equal(near.visible, false); assert.equal(far.visible, true);
  disposeCampusArchitecture(campus);
});

test('lazy architecture restores exactly the eager geometry without changing identity or duplicating far batches', () => {
  const facadeIds = new Set(PHOTO_APPEARANCES.filter(profile => profile.facade).map(profile => profile.featureId));
  assert.equal(facadeIds.size, 5);
  const d = subset([...plainFeatures.slice(0, 3), ...plainFeatures.filter(feature => facadeIds.has(feature.id))]);
  const campus = createCampusModel(d), eager = createCampusModel(d);
  applyCampusArchitecture(campus, d, {deferNear: true});
  applyCampusArchitecture(eager, d);
  const geometrySignature = root => {
    const result = [];
    nearGroup(root).traverse(object => {
      if (!object.isMesh) return;
      result.push({name: object.name, materials: (Array.isArray(object.material) ? object.material : [object.material]).map(material => material.name),
        groups: object.geometry.groups, index: object.geometry.index?.array,
        attributes: Object.fromEntries(Object.entries(object.geometry.attributes).map(([key, attribute]) => [key, attribute.array]))});
    });
    return result;
  };
  for (const [id, root] of campus.buildings) {
    assert.equal(nearMeshes(root).length, 0);
    const metadata = structuredClone(root.userData);
    assert.throws(() => prepareArchitectureExport(root.clone(true)), /complete architectural details/);
    const detail = campus.ensureArchitectureDetail(id);
    assert.equal(detail.userData.architectureNearPending, false);
    assert.deepEqual(root.userData, metadata);
    assert.deepEqual(geometrySignature(root), geometrySignature(eager.buildings.get(id)));
    assert.equal(campus.ensureArchitectureDetail(id), detail);
    assert.ok(detail.children.find(child => child.userData.architectureFar).children.every(mesh => !mesh.visible));
    assert.doesNotThrow(() => prepareArchitectureExport(root.clone(true)));
  }
  disposeCampusArchitecture(campus); disposeCampusArchitecture(eager);
});

test('lazy geometry is not constructed for hidden roots, hidden layers or disabled details, and filtered export skips them', () => {
  const d = subset(), campus = createCampusModel(d);
  applyCampusArchitecture(campus, d, {deferNear: true});
  const [first, second] = [...campus.buildings.values()];
  const camera = new THREE.PerspectiveCamera();
  camera.position.copy(first.position);
  first.visible = false;
  campus.layers.building.visible = false;
  campus.updateArchitectureLOD(camera);
  assert.ok([...campus.buildings.values()].every(root => nearMeshes(root).length === 0));
  assert.doesNotThrow(() => prepareArchitectureExport(campus.group.clone(true)));
  campus.layers.building.visible = true;
  campus.updateArchitectureLOD(camera, false);
  assert.equal(nearMeshes(first).length, 0); assert.equal(nearMeshes(second).length, 0);
  first.visible = true; campus.updateArchitectureLOD(camera);
  assert.ok(nearMeshes(first).length > 0);
  disposeCampusArchitecture(campus);
  assert.equal(campus.ensureArchitectureDetail, undefined);
  assert.equal(first.getObjectByName('base').visible, true);
});

test('raised multipolygon architecture preserves disconnected components and courtyard holes', () => {
  const source = plainFeatures.find(feature => feature.geometry.coordinates.length > 1);
  const feature = structuredClone(source);
  feature.id = 'building:raised-multipart-fixture';
  feature.geometry = {type: 'MultiPolygon', coordinates: [
    feature.geometry.coordinates,
    [feature.geometry.coordinates[0].map(([x, y]) => [x + .005, y])],
  ]};
  Object.assign(feature.properties, {renderHeight: 12, minHeight: 4});
  const metrics = footprintMetrics(feature.geometry, data.metadata.center), palette = createArchitectureResources();
  let detail;
  try {
    detail = createArchitectureDetail(feature, data.metadata.center, metrics.origin, palette);
    assert.equal(detail.userData.polygonCount, 2);
    assert.ok(detail.userData.holeCount > 0);
    assert.equal(detail.userData.footprintArea, metrics.area);
    assert.equal(detail.userData.sourceEvidence, null);
    assert.equal(detail.userData.family, 'neutral');
    const bounds = new THREE.Box3().setFromObject(detail);
    assert.ok(Math.abs(bounds.min.y - 4) < 1e-4 && Math.abs(bounds.max.y - 12) < 1e-4);
    const near = detail.children.find(child => child.userData.architectureNear);
    for (const polygon of metrics.projected) {
      const points = polygon[0].slice(0, -1).map(point => new THREE.Vector2(...point));
      const triangle = THREE.ShapeUtils.triangulateShape(points, polygon.slice(1).map(ring =>
        ring.slice(0, -1).map(point => new THREE.Vector2(...point))))[0];
      const allPoints = [...points, ...polygon.slice(1).flatMap(ring => ring.slice(0, -1).map(point => new THREE.Vector2(...point)))];
      const point = triangle.reduce((sum, i) => sum.add(allPoints[i]), new THREE.Vector2()).multiplyScalar(1 / 3);
      const hits = new THREE.Raycaster(new THREE.Vector3(point.x - metrics.origin[0], 100, point.y - metrics.origin[1]),
        new THREE.Vector3(0, -1, 0)).intersectObject(near, true);
      assert.ok(hits.length, 'Each disconnected component must have its own exact-outline roof and foundation');
    }
    assert.throws(() => createArchitectureDetail(feature, data.metadata.center, [0, 0], palette), /origin changed/);
  } finally {
    if (detail) disposeOwnedDetail(detail);
    palette.dispose();
  }
});

test('far batches retain original per-building picking and filtering and never enter exported geometry', () => {
  const d = subset(), campus = createCampusModel(d);
  applyCampusArchitecture(campus, d);
  const camera = new THREE.PerspectiveCamera(); camera.position.set(0, 10000, 10000);
  campus.updateArchitectureLOD(camera); campus.group.updateMatrixWorld(true);
  const batches = campus.layers.building.children.filter(object => object.userData.architectureFarBatch);
  assert.ok(batches.length >= 2 && batches.length <= 3);
  for (const feature of d.features) {
    const metrics = footprintMetrics(feature.geometry, d.metadata.center);
    const points = metrics.projected[0][0].slice(0, -1).map(point => new THREE.Vector2(...point));
    const triangle = THREE.ShapeUtils.triangulateShape(points, [])[0];
    const point = triangle.reduce((sum, index) => sum.add(points[index]), new THREE.Vector2()).multiplyScalar(1 / 3);
    const ray = new THREE.Raycaster(new THREE.Vector3(point.x, 100, point.y), new THREE.Vector3(0, -1, 0));
    const hits = ray.intersectObjects(batches);
    assert.ok(hits.length);
    assert.equal(hits[0].object.userData.featureIds[hits[0].batchId], feature.id);
    campus.buildings.get(feature.id).visible = false;
    campus.updateArchitectureLOD(camera);
    assert.ok(!ray.intersectObjects(batches).some(hit => hit.object.userData.featureIds[hit.batchId] === feature.id));
    campus.buildings.get(feature.id).visible = true;
    campus.updateArchitectureLOD(camera);
  }
  const clone = prepareArchitectureExport(campus.group.clone(true));
  const exportedBatches = [];
  clone.traverse(object => {if (object.isBatchedMesh) exportedBatches.push(object);});
  assert.deepEqual(exportedBatches, []);
  for (const root of campus.buildings.values()) assert.equal(nearGroup(root).visible, false);
  assert.throws(() => campus.updateArchitectureLOD(camera, 'yes'), /must be a boolean/);
  disposeCampusArchitecture(campus);
  assert.equal(campus.layers.building.children.filter(object => object.isBatchedMesh).length, 0);
});

test('reapplying releases old geometry, shares owned materials and can restore original bases cleanly', () => {
  const d = subset(), campus = createCampusModel(d);
  const root = campus.buildings.values().next().value, original = {...root.userData};
  const ids = applyCampusArchitecture(campus, d), first = nearGroup(root), geometries = new Set(), materials = new Set(), textures = new Set();
  root.children.find(child => child.userData.architectureLOD).traverse(object => {
    if (object.geometry) geometries.add(object.geometry);
    if (object.isMesh) for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      materials.add(material); for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
    }
  });

  let geometryDisposals = 0, materialDisposals = 0, textureDisposals = 0;
  geometries.forEach(geometry => geometry.addEventListener('dispose', () => geometryDisposals++));
  materials.forEach(material => material.addEventListener('dispose', () => materialDisposals++));
  textures.forEach(texture => texture.addEventListener('dispose', () => textureDisposals++));
  assert.deepEqual(applyCampusArchitecture(campus, d), ids);
  assert.notEqual(nearGroup(root), first);
  assert.equal(geometryDisposals, geometries.size);
  assert.equal(materialDisposals, 0); assert.equal(textureDisposals, 0);
  disposeCampusArchitecture(campus);
  assert.equal(materialDisposals, materials.size); assert.equal(textureDisposals, textures.size);
  assert.deepEqual(root.userData, original);
  assert.equal(root.getObjectByName('base').visible, true);
  assert.equal(root.children.filter(child => child.userData.campusDetail).length, 0);
  disposeCampusArchitecture(campus);
});

test('footprint, height, projection or origin drift fails before any building is replaced', () => {
  for (const change of [
    d => {d.features[1].geometry.coordinates[0][0][0] += .000001;},
    d => {d.features[1].properties.renderHeight++;},
    d => {d.metadata.center = [116.32, 40];},
  ]) {
    const d = structuredClone(subset()); change(d);
    const campus = createCampusModel(d);
    assert.throws(() => applyCampusArchitecture(campus, d), /footprint\/evidence changed/);
    assert.ok([...campus.buildings.values()].every(root => root.getObjectByName('base').visible));
    disposeCampusArchitecture(campus);
  }
  const d = subset(), campus = createCampusModel(d);
  campus.buildings.values().next().value.position.y++;
  assert.throws(() => applyCampusArchitecture(campus, d), /placement mismatch/);
  disposeCampusArchitecture(campus);
});

test('only explicit community floor tags or documented photo proportions change map display heights', () => {
  const tagged = plainFeatures.filter(feature => architectureSpec(feature).taggedFloors);
  assert.ok(tagged.length > 10);
  for (const feature of tagged) {
    const spec = architectureSpec(feature);
    assert.equal(spec.top, feature.properties.minHeight + spec.floors * 3.2);
    assert.match(spec.heightSource, /estimated.*not measured/);
  }
  for (const feature of plainFeatures.filter(feature => !architectureSpec(feature).taggedFloors && !architectureSpec(feature).appearance?.estimatedHeight)) {
    assert.equal(architectureSpec(feature).top, feature.properties.renderHeight);
  }
  for (const feature of plainFeatures.filter(feature => architectureSpec(feature).appearance?.estimatedHeight)) {
    const spec = architectureSpec(feature);
    assert.equal(spec.top, feature.properties.minHeight + spec.appearance.estimatedHeight);
    assert.match(spec.heightSource, /photo-guided.*estimated.*not measured/);
  }
  const unknown = evidence.buildings.find(record => record.match !== 'overlap-verified');
  assert.equal(architectureSpec(data.features.find(feature => feature.id === unknown.featureId)).family, 'neutral');
});
