import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import data from '../data/campus.json' with {type: 'json'};
import catalog from '../reference-catalog.json' with {type: 'json'};
import {createCampusModel} from '../src/model.js';
import {footprintMetrics} from '../src/geo.js';
import {DINING_SOURCES, createDiningDetail, refineDining} from '../src/zijing-dining.js';

for (const source of DINING_SOURCES) {
  test(`${source.name}: exact foundation, genuine window bands and photo-supported entrance family`, () => {
    const feature = data.features.find(f => f.id === source.featureId), metrics = footprintMetrics(feature.geometry, data.metadata.center);
    const detail = createDiningDetail(feature, data.metadata.center, metrics.origin);
    assert.equal(detail.userData.footprintArea, metrics.area);
    assert.equal(detail.userData.floorsAboveGround, source.floors);
    assert.equal(detail.userData.noReferencePhotoTextures, true);
    assert.equal(catalog.sites.find(s => s.id === source.referenceSite).images.length, 1);
    let meshes = 0, glazing = 0;
    detail.traverse(object => {
      if (!object.isMesh) return;
      meshes++;
      for (const attribute of Object.values(object.geometry.attributes)) assert.ok(attribute.array.every(Number.isFinite));
      assert.ok(object.geometry.attributes.uv);
      if (/glass/.test(object.material.name)) glazing++;
    });
    assert.ok(meshes >= 5 && meshes <= 12);
    assert.ok(glazing > 0);
    const p = detail.userData.estimatedDimensionsMeters;
    assert.ok(Math.abs(p.meshLocalYMin) < .00001 && p.meshLocalYMax > source.floors * 4 && p.meshLocalYMax < 24);
    assert.ok(detail.getObjectByName(source.referenceSite === 'taoli-dining'
      ? 'Tall round entrance window and open portal' : 'Paired stair towers and open rooftop frames'));
    const base = detail.getObjectByName('Exact source foundation and layered rounded footprint');
    const mesh = base.children.find(child => child.isMesh);
    const vertices = mesh.geometry.attributes.position;
    for (const [x, z] of metrics.projected[0][0]) {
      let found = false;
      for (let i = 0; i < vertices.count; i++) {
        if (Math.abs(vertices.getX(i) - (x - metrics.origin[0])) < .0001 &&
            Math.abs(vertices.getZ(i) - (z - metrics.origin[1])) < .0001 && Math.abs(vertices.getY(i)) < .00001) found = true;
      }
      assert.ok(found, 'Every frozen footprint corner must survive in the foundation');
    }
  });

  test(`${source.name}: source identity, placement and owned-resource lifecycle remain stable`, () => {
    const campus = createCampusModel(data), root = campus.buildings.get(source.featureId), before = root.position.clone();
    refineDining(campus, data, source.featureId);
    const old = root.children.find(child => child.userData.campusDetail), resources = new Set();
    old.traverse(object => {
      if (!object.isMesh) return;
      resources.add(object.geometry); resources.add(object.material);
      for (const value of Object.values(object.material)) if (value?.isTexture) resources.add(value);
    });
    let disposed = 0;
    resources.forEach(resource => resource.addEventListener('dispose', () => disposed++));
    assert.equal(refineDining(campus, data, source.featureId), root);
    assert.equal(disposed, resources.size);
    assert.equal(root.children.filter(child => child.userData.campusDetail).length, 1);
    assert.ok(root.position.equals(before));
    assert.equal(root.userData.baseRenderHeight, source.height);
    const changed = structuredClone(data.features.find(f => f.id === source.featureId));
    changed.geometry.coordinates[0][0][0] += .00001;
    assert.throws(() => createDiningDetail(changed, data.metadata.center, [0, 0]), /frozen/);
    root.position.z += 1;
    assert.throws(() => refineDining(campus, data, source.featureId), /placement/);
    assert.equal(campus.buildings.size, 650);
  });
}
