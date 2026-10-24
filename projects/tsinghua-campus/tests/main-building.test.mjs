import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import data from '../data/campus.json' with {type: 'json'};
import {createCampusModel} from '../src/model.js';
import {MAIN_BUILDING_IDS, createMainBuildingDetail, refineMainBuilding} from '../src/main-building-refinement.js';

const subset = {...data, features: data.features.filter(feature => MAIN_BUILDING_IDS.includes(feature.id))};

test('main complex retains three distinct map identities and its real placement', () => {
  const campus = createCampusModel(subset);
  for (const id of MAIN_BUILDING_IDS) {
    const target = campus.buildings.get(id);
    const originalPosition = target.position.toArray();
    refineMainBuilding(campus, subset, id);
    assert.deepEqual(target.position.toArray(), originalPosition);
    assert.equal(target.userData.featureId, id);
    assert.equal(target.getObjectByName('base').visible, false);
    assert.equal(target.userData.referenceSite, 'main-building');
    assert.ok(target.userData.heightSource.includes('非测绘'));
    const detail = target.children.find(child => child.userData.campusDetail);
    const box = new THREE.Box3().setFromObject(detail);
    assert.ok(box.max.y > 20 && box.max.y < 43);
    assert.ok(detail.userData.windows > 100);
    let meshes = 0;
    detail.traverse(object => {
      if (object.isMesh) {
        meshes++;
        assert.ok(object.geometry.attributes.position.array.every(Number.isFinite));
        assert.equal(object.material.map, null);
      }
    });
    assert.ok(meshes < 15, 'Facade details should be batched, not one drawcall per window');
    refineMainBuilding(campus, subset, id);
    assert.equal(target.children.filter(child => child.userData.campusDetail).length, 1);
  }
  assert.equal(campus.buildings.size, 3);
});

test('central main building has stepped roof silhouette and an open entrance colonnade', () => {
  const campus = createCampusModel(subset);
  const target = refineMainBuilding(campus, subset, MAIN_BUILDING_IDS[0]);
  const detail = target.children.find(child => child.userData.campusDetail);
  assert.ok(detail.userData.colonnadeBays > 20);
  assert.equal(target.userData.baseRenderHeight, 41);
  const topAt = x => {
    const ray = new THREE.Raycaster(new THREE.Vector3(x, 100, 25).applyMatrix4(target.matrixWorld),
      new THREE.Vector3(0, -1, 0));
    return ray.intersectObject(detail, true).find(hit => hit.object.isMesh)?.point.y;
  };
  // Detail remains in local coordinates; only its footprint yaw is applied.
  detail.updateMatrixWorld(true);
  assert.ok(topAt(0) > 41 && topAt(0) < 42);
  assert.ok(topAt(-26) > 32 && topAt(-26) < 33);
  assert.ok(topAt(-44) > 35 && topAt(-44) < 36);
});

test('western main-building courtyard is not replaced by a rectangular solid', () => {
  const campus = createCampusModel(subset);
  const target = refineMainBuilding(campus, subset, MAIN_BUILDING_IDS[1]);
  const detail = target.children.find(child => child.userData.campusDetail);
  // Test in building-local coordinates, outside the concave western outline.
  const ray = new THREE.Raycaster(new THREE.Vector3(-25, 100, -20).applyMatrix4(target.matrixWorld),
    new THREE.Vector3(0, -1, 0));
  detail.updateMatrixWorld(true);
  assert.equal(ray.intersectObject(detail, true).filter(hit => hit.object.isMesh).length, 0);
});

test('wrong OSM source or local anchor cannot attach main-building geometry', () => {
  const campus = createCampusModel(subset);
  const feature = structuredClone(subset.features.find(item => item.id === MAIN_BUILDING_IDS[0]));
  feature.properties.nameSourceFeatureId = 'osm:way:158112141';
  const origin = campus.buildings.get(MAIN_BUILDING_IDS[0]).userData.localOriginMeters;
  assert.throws(() => createMainBuildingDetail(feature, data.metadata.center, origin), /identity changed/);
  feature.properties.nameSourceFeatureId = 'osm:way:79699845';
  assert.throws(() => createMainBuildingDetail(feature, data.metadata.center, [0, 0]), /origin/);
});
