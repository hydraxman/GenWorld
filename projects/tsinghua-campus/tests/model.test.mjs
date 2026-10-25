import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {createCampusModel, replaceBuilding} from '../src/model.js';
import {project, footprintMetrics} from '../src/geo.js';

const center = [116.32, 40.006];
const outer = [[116.32, 40.006], [116.322, 40.006], [116.322, 40.008], [116.32, 40.008], [116.32, 40.006]];
const hole = [[116.3205, 40.0065], [116.3215, 40.0065], [116.3215, 40.0075], [116.3205, 40.0075], [116.3205, 40.0065]];
const feature = {type: 'Feature', id: 'building:test', properties: {
  kind: 'building', name: 'Test building', renderHeight: 24, minHeight: 4,
  heightSource: 'test fixture', refinementStatus: 'base',
}, geometry: {type: 'Polygon', coordinates: [outer, hole]}};
const dataset = () => ({type: 'FeatureCollection', metadata: {center}, features: [structuredClone(feature)]});

test('local projection uses meters, east +X and north -Z', () => {
  assert.deepEqual(project(center, center), [0, -0]);
  const [east, north] = project([116.321, 40.007], center);
  assert.ok(east > 85 && east < 86);
  assert.ok(north < -111 && north > -112);
  assert.throws(() => project([NaN, 40], center), /finite/);
});

test('extrusions preserve courtyard holes and raised base height', () => {
  const data = dataset();
  const original = JSON.stringify(data);
  const result = createCampusModel(data);
  const building = result.buildings.get(feature.id);
  assert.equal(result.objects.get(feature.id), building);
  assert.equal(result.landmarks.size, 0);
  const box = new THREE.Box3().setFromObject(building);
  assert.equal(box.min.y, 4);
  assert.equal(box.max.y, 24);
  const metrics = footprintMetrics(feature.geometry, center);
  const noHole = footprintMetrics({type: 'Polygon', coordinates: [outer]}, center);
  assert.ok(Math.abs(metrics.area / noHole.area - 0.75) < 0.001);
  const [x, z] = project([116.321, 40.007], center);
  const ray = new THREE.Raycaster(new THREE.Vector3(x, 100, z), new THREE.Vector3(0, -1, 0));
  assert.equal(ray.intersectObject(building, true).filter(hit => hit.object.isMesh).length, 0);
  const [wx, wz] = project([116.3202, 40.0062], center);
  ray.set(new THREE.Vector3(wx, 100, wz), new THREE.Vector3(0, -1, 0));
  assert.ok(ray.intersectObject(building, true).some(hit => hit.object.isMesh));
  assert.equal(JSON.stringify(data), original);
});

test('multipolygon is one addressable building, replacement keeps placement and identity', () => {
  const data = dataset();
  data.features[0].geometry = {type: 'MultiPolygon', coordinates: [[outer, hole], [
    outer.map(([x, y]) => [x + 0.003, y]),
  ]]};
  const result = createCampusModel(data);
  assert.equal(result.buildings.size, 1);
  const building = result.buildings.get(feature.id);
  const position = building.position.toArray();
  const detail = new THREE.Group();
  replaceBuilding(result.buildings, feature.id, detail);
  assert.deepEqual(building.position.toArray(), position);
  assert.equal(building.getObjectByName('base').visible, false);
  assert.equal(building.userData.featureId, feature.id);
  assert.equal(building.userData.refinementStatus, 'detailed');
  assert.throws(() => replaceBuilding(result.buildings, 'missing', new THREE.Group()), /Unknown/);
  assert.throws(() => replaceBuilding(result.buildings, feature.id, detail), /unattached/);
});

test('duplicate IDs and inverted heights fail explicitly', () => {
  const data = dataset();
  data.features.push(structuredClone(feature));
  assert.throws(() => createCampusModel(data), /Duplicate/);
  data.features.pop();
  data.features[0].properties.renderHeight = 2;
  assert.throws(() => createCampusModel(data), /Invalid height/);
});

test('upstream hide_3d planning outlines are not extruded', () => {
  const data = dataset();
  Object.assign(data.features[0].properties, {extrude: false, renderHeight: 0, minHeight: 0});
  const {buildings} = createCampusModel(data);
  const box = new THREE.Box3().setFromObject(buildings.get(feature.id));
  assert.ok(box.max.y - box.min.y < 0.001);
});

test('a replacement does not duplicate the exported building identity', () => {
  const campus = createCampusModel(dataset());
  const detail = new THREE.Group();
  detail.userData.featureId = feature.id;
  replaceBuilding(campus.buildings, feature.id, detail);
  const featureNodes = [];
  campus.group.traverse(object => { if (object.userData.featureId) featureNodes.push(object); });
  assert.equal(featureNodes.length, 1);
  assert.equal(detail.userData.featureId, undefined);
  assert.equal(detail.userData.buildingFeatureId, feature.id);
});

test('unreconstructed buildings have readable estimated window bays, not featureless walls or window-covered roofs', () => {
  const {buildings} = createCampusModel(dataset());
  const root = buildings.get(feature.id), mesh = root.getObjectByName('base').children.find(child => child.isMesh);
  const [roof, wall] = mesh.material;
  assert.ok(wall.map?.isDataTexture, 'Baseline facade is windowless: no generated facade texture');
  assert.equal(wall.map.colorSpace, THREE.SRGBColorSpace);
  assert.ok(wall.map.generateMipmaps && wall.map.anisotropy >= 4);
  assert.notEqual(roof.map, wall.map, 'Window patterns must not appear on the roof');
  const pixels = wall.map.image.data;
  const luminance = Array.from({length: pixels.length / 4}, (_, i) =>
    .2126 * pixels[i * 4] + .7152 * pixels[i * 4 + 1] + .0722 * pixels[i * 4 + 2]);
  assert.ok(Math.max(...luminance) - Math.min(...luminance) > 70, 'Glazing and masonry must remain visually distinct');
  assert.equal(root.userData.refinementStatus, 'base');
  assert.match(root.userData.baseFacadeSource, /示意.*非.*照片/);
  const positions = mesh.geometry.attributes.position, uv = mesh.geometry.attributes.uv;
  for (const group of mesh.geometry.groups.filter(group => group.materialIndex === 1)) {
    for (let i = group.start; i < group.start + group.count; i++) {
      assert.ok(Math.abs(uv.getY(i) - (positions.getY(i) - 4) / 4) < 1e-5,
        'Window floors must use a stable meter-scale vertical mapping, including raised buildings');
    }
  }
});

test('estimated facades can be disabled without hiding buildings or affecting reconstruction status', () => {
  const campus = createCampusModel(dataset());
  const root = campus.buildings.get(feature.id), mesh = root.getObjectByName('base').children.find(child => child.isMesh);
  const material = mesh.material[1], originalMap = material.map, originalNormal = material.normalMap;
  campus.showEstimatedFacades(false);
  assert.equal(material.map, null);
  assert.equal(material.normalMap, null);
  assert.equal(root.visible, true);
  assert.equal(root.userData.refinementStatus, 'base');
  campus.showEstimatedFacades(true);
  assert.equal(material.map, originalMap);
  assert.equal(material.normalMap, originalNormal);
  assert.throws(() => campus.showEstimatedFacades(undefined), /boolean/);
});
