import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import data from '../data/campus.json' with {type: 'json'};
import {createCampusModel} from '../src/model.js';
import {refineBiologyHall, BIOLOGY_HALL_ID} from '../src/biology-hall.js';
import {createCourtyardReuse} from '../src/courtyard-reuse.js';
import {disposeOwnedDetail} from '../src/model.js';
import {isOriginalRearTriangle} from '../src/biology-north.js';

test('old biology hall reuses the actual courtyard without taking the modern life-sciences identity', () => {
  const campus = createCampusModel(data), ids = [...campus.buildings.keys()], frozen = JSON.stringify(data);
  const modern = campus.buildings.get('building:geometry:7eda8a792829e49a6e8a2833');
  const root = refineBiologyHall(campus, data), detail = root.children.find(child => child.userData.campusDetail);
  assert.equal(root, campus.buildings.get(BIOLOGY_HALL_ID));
  assert.equal(root.userData.name, '生物学馆');
  assert.equal(root.userData.referenceSite, 'biology-hall');
  assert.equal(modern.userData.refinementStatus, 'base');
  assert.deepEqual([...campus.buildings.keys()], ids);
  assert.equal(JSON.stringify(data), frozen);
  assert.equal(detail.userData.sourceStats.basins, 3); assert.equal(detail.userData.sourceStats.pergolas, 2);
  assert.equal(detail.userData.reusedSource, 'projects/courtyard/src/model.js');
  assert.match(detail.userData.evidence.orientation, /用户/);
  assert.equal(detail.children[0].userData.placementStatus, 'old-biology-hall-source-root-bound');
  let triangles = 0, meshes = 0;
  detail.traverse(object => {
    if (!object.isMesh) return;
    meshes++; triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3;
    for (const attr of Object.values(object.geometry.attributes)) assert.ok(attr.array.every(Number.isFinite));
    assert.ok(object.geometry.attributes.uv);
  });
  assert.ok(meshes < 60 && triangles < 65000);
  assert.ok(Math.abs(detail.userData.modelHeight - 11.78) < 1e-5);
  assert.equal(detail.children.length, 1, 'No newly coded wing, foundation or north shell can cover the original model');
  assert.equal(detail.userData.directOriginalGeometry, true);
  assert.deepEqual(detail.children[0].scale.toArray(), [1, 1, 1]);
  assert.ok(root.userData.focusBoundsLocal.max[0] - root.userData.focusBoundsLocal.min[0] < 40,
    'Frame the original courtyard, not the larger hidden map extrusion');
  assert.ok(root.userData.referencePages.length >= 3);
  const {shoreline, shorelineSetback} = detail.userData.placement;
  assert.ok(shoreline > 20 && shoreline < 100);
  assert.equal(shorelineSetback, 3);
  detail.updateMatrixWorld(true);
  const inverse = detail.matrixWorld.clone().invert();
  for (const child of detail.children[0].children.filter(child => child.userData.role === 'legacy-library-forecourt')) {
    child.traverse(mesh => {
      if (!mesh.geometry) return;
      const positions = mesh.geometry.attributes.position, point = new THREE.Vector3();
      const transform = inverse.clone().multiply(mesh.matrixWorld);
      for (let i = 0; i < positions.count; i++) {
        point.fromBufferAttribute(positions, i).applyMatrix4(transform);
        assert.ok(point.z <= shoreline - shorelineSetback + 1e-5, 'Every court vertex preserves the three-metre shoreline setback');
      }
    });
  }
});

test('north-only adaptation preserves every other source triangle, material, roof and courtyard proportion', () => {
  const campus = createCampusModel(data), root = refineBiologyHall(campus, data);
  const detail = root.children.find(child => child.userData.campusDetail);
  const original = createCourtyardReuse({textured: false});
  const imported = detail.children[0];
  assert.equal(imported.children.length, original.group.children.length + 1);
  for (let i = 0; i < original.group.children.length; i++) {
    const a = imported.children[i], b = original.group.children[i];
    assert.equal(a.name, b.name);
    assert.deepEqual(a.scale.toArray(), b.scale.toArray());
    assert.deepEqual(a.position.toArray(), b.position.toArray());
    assert.equal(a.children.length, b.children.length);
    for (let j = 0; j < a.children.length; j++) {
      const mesh = a.children[j], source = b.children[j];
      assert.deepEqual(Object.keys(mesh.geometry.attributes), Object.keys(source.geometry.attributes));
      const geometry = source.geometry.index ? source.geometry.toNonIndexed() : source.geometry;
      const keep = [];
      for (let offset = 0; offset < geometry.attributes.position.count; offset += 3) {
        if (!isOriginalRearTriangle(b.name, geometry.attributes.position, geometry.attributes.normal, offset)) {
          keep.push(offset, offset + 1, offset + 2);
        } else {
          assert.ok(['Building shell', 'Windows and facade joinery'].includes(b.name));
          for (let vertex = offset; vertex < offset + 3; vertex++) {
            assert.ok(geometry.attributes.position.getZ(vertex) < -8.98, 'No southern, side or courtyard triangle may be removed');
            if (b.name === 'Building shell') assert.ok(geometry.attributes.position.getY(vertex) < 9.12,
              'Original roof and clerestory shell must remain intact');
          }
        }
      }
      for (const [name, attribute] of Object.entries(mesh.geometry.attributes)) {
        const expected = new attribute.array.constructor(keep.length * attribute.itemSize), sourceValues = geometry.attributes[name].array;
        for (const [index, from] of keep.entries()) expected.set(
          sourceValues.subarray(from * attribute.itemSize, (from + 1) * attribute.itemSize), index * attribute.itemSize);
        assert.deepEqual(attribute.array, expected);
      }
      assert.equal(mesh.material.name, source.material.name);
      assert.equal(mesh.material.color.getHex(), source.material.color.getHex());
      assert.equal(mesh.material.roughness, source.material.roughness);
      assert.equal(mesh.material.metalness, source.material.metalness);
    }
  }
  disposeOwnedDetail(original.group);
});

test('photographed north has actual recessed openings, bounded stairs and a joined stepped crown', () => {
  const campus = createCampusModel(data), root = refineBiologyHall(campus, data);
  const source = root.children.find(child => child.userData.campusDetail).children[0];
  source.position.set(0, 0, 0); source.parent.rotation.set(0, 0, 0); source.parent.position.set(0, 0, 0);
  root.position.set(0, 0, 0); root.updateMatrixWorld(true);
  const north = source.getObjectByName('Photo-refined north bridge entrance');
  assert.equal(north.userData.openings.length, 39);
  assert.ok(north.userData.removedOriginalRearTriangles > 100);
  for (const opening of north.userData.openings) {
    const hits = new THREE.Raycaster(new THREE.Vector3(...opening.outside), new THREE.Vector3(0, 0, 1), 0, 2)
      .intersectObject(source, true);
    assert.ok(hits.length, 'Every real aperture leads to a glass/door plane');
    assert.match(hits[0].object.material.name, /glass/, JSON.stringify(opening));
    assert.ok(hits[0].distance >= 1.25, 'Glazing lies behind a genuine wall opening, not a painted panel');
  }
  const bounds = new THREE.Box3().setFromObject(north);
  assert.ok(bounds.max.y <= 11.61 && bounds.min.z >= -13.41 && bounds.max.z <= -7.93);
});

test('source drift fails before replacement, and repeated application releases owned resources', () => {
  for (const change of [
    f => {f.properties.name = '生命科学馆';},
    f => {f.properties.nameSourceFeatureId = 'osm:way:226666846';},
    f => {f.geometry.coordinates[0][0][0] += .00001;},
  ]) {
    const d = structuredClone(data); change(d.features.find(f => f.id === BIOLOGY_HALL_ID));
    const campus = createCampusModel(d);
    assert.throws(() => refineBiologyHall(campus, d), /identity\/footprint/);
    assert.equal(campus.buildings.get(BIOLOGY_HALL_ID).getObjectByName('base').visible, true);
  }
  const campus = createCampusModel(data), root = refineBiologyHall(campus, data);
  const first = root.children.find(child => child.userData.campusDetail);
  let disposed = 0; first.traverse(o => {if (o.geometry) o.geometry.addEventListener('dispose', () => disposed++);});
  refineBiologyHall(campus, data);
  assert.ok(disposed > 20);
  assert.equal(root.children.filter(child => child.userData.campusDetail).length, 1);
});
