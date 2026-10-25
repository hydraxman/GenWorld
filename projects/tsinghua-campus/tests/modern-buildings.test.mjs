import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import data from '../data/campus.json' with {type: 'json'};
import catalog from '../reference-catalog.json' with {type: 'json'};
import {footprintMetrics} from '../src/geo.js';
import {createCampusModel} from '../src/model.js';
import {MODERN_BUILDINGS, createModernBuildingDetail, refineModernBuilding} from '../src/modern-buildings.js';

const featureFor = source => data.features.find(f => f.id === source.featureId);
const make = source => {
  const feature = featureFor(source), metrics = footprintMetrics(feature.geometry, data.metadata.center);
  return createModernBuildingDetail(feature, data.metadata.center, metrics.origin);
};
const close = (a, b, epsilon = 1e-4) => assert.ok(Math.abs(a - b) < epsilon, `${a} != ${b}`);
const forSite = site => MODERN_BUILDINGS.find(source => source.referenceSite === site);

for (const source of MODERN_BUILDINGS) {
  test(`${source.referenceSite}: frozen identity and public interface preserve every map root and source byte`, () => {
    const campus = createCampusModel(data), before = JSON.stringify(data);
    const originals = new Map(campus.buildings), root = originals.get(source.featureId);
    const position = root.position.clone(), uuid = root.uuid;
    assert.equal(refineModernBuilding(campus, data, source.featureId), root);
    assert.equal(root.uuid, uuid);
    assert.ok(root.position.equals(position));
    assert.equal(campus.buildings.size, 650);
    assert.deepEqual([...campus.buildings.keys()], [...originals.keys()]);
    for (const [id, object] of originals) {
      assert.equal(campus.buildings.get(id), object);
      if (id !== source.featureId) assert.equal(object.getObjectByName('base').visible, true);
    }
    assert.equal(root.getObjectByName('base').visible, false);
    assert.equal(root.userData.referenceSite, source.referenceSite);
    assert.equal(root.userData.baseRenderHeight, 5);
    assert.equal(root.userData.nameSourceFeatureId, `osm:way:${source.osmWay}`);
    assert.match(root.userData.refinementSummary, /估算/);
    assert.match(root.userData.heightSource, /非测绘/);
    assert.equal(JSON.stringify(data), before);
    const identities = [];
    root.traverse(object => {if (object.userData.featureId) identities.push(object.userData.featureId);});
    assert.deepEqual(identities, [source.featureId]);
  });

  test(`${source.referenceSite}: exact foundation, finite batched geometry and deterministic generated materials`, () => {
    const detail = make(source), repeat = make(source);
    let meshes = 0, triangles = 0;
    const maps = new Set(), copies = new Set();
    for (const [object, textures] of [[detail, maps], [repeat, copies]]) object.traverse(child => {
      if (!child.isMesh) return;
      if (object === detail) {
        meshes++;
        triangles += (child.geometry.index?.count ?? child.geometry.attributes.position.count) / 3;
        for (const [name, attribute] of Object.entries(child.geometry.attributes)) {
          assert.ok(attribute.array.every(Number.isFinite), `${child.name}: ${name}`);
        }
      }
      for (const material of Array.isArray(child.material) ? child.material : [child.material]) {
        assert.equal(material.roughnessMap, null, 'Raw DataTexture roughness maps break GLB export');
        if (material.map) textures.add(material.map);
      }
    });
    assert.ok(meshes <= 24, `Excessive draw calls: ${meshes}`);
    assert.ok(triangles < 65000, `Excessive triangles: ${triangles}`);
    assert.ok(meshes >= 5 && triangles > 500);
    for (const [i, texture] of [...maps].entries()) {
      assert.ok(texture.isDataTexture);
      assert.equal(texture.image.width, 128);
      assert.equal(texture.image.height, 128);
      assert.match(texture.name, /no photograph/);
      assert.deepEqual(texture.image.data, [...copies][i].image.data);
    }
    const foundation = detail.getObjectByName('Exact frozen footprint foundation').children[0].geometry;
    const position = foundation.attributes.position, index = foundation.index;
    let area = 0;
    for (let i = 0; i < index.count; i += 3) {
      const vertices = [0, 1, 2].map(j => new THREE.Vector3().fromBufferAttribute(position, index.getX(i + j)));
      if (!vertices.every(point => Math.abs(point.y - .28) < 1e-5)) continue;
      area += new THREE.Triangle(...vertices).getArea();
    }
    const feature = featureFor(source), metrics = footprintMetrics(feature.geometry, data.metadata.center);
    close(area, metrics.area, .01);
    const points = metrics.projected[0][0].slice(0, -1);
    const boundary = [];
    for (let i = 0; i < position.count; i++) {
      const p = new THREE.Vector3().fromBufferAttribute(position, i).applyMatrix4(detail.matrix);
      boundary.push([p.x + metrics.origin[0], p.z + metrics.origin[1]]);
    }
    for (const point of points) assert.ok(boundary.some(candidate => Math.hypot(...point.map((v, i) => v - candidate[i])) < 1e-4));
    assert.equal(detail.userData.noReferencePhotoTextures, true);
    assert.ok(detail.userData.frontNormalXZ[1] > .99);
    assert.match(detail.userData.directionSource, /推定/);
    const size = new THREE.Box3().setFromObject(detail).getSize(new THREE.Vector3());
    assert.ok(size.y > (source.referenceSite === 'music-hall' ? 10 : 15) && size.y < 35);
  });

  test(`${source.referenceSite}: repeated application disposes only its own old resources and preserves local height`, () => {
    const campus = createCampusModel(data);
    campus.group.position.set(19, 100, -37);
    const root = refineModernBuilding(campus, data, source.featureId);
    const first = root.children.find(child => child.userData.campusDetail), resources = new Set();
    first.traverse(object => {
      if (object.geometry) resources.add(object.geometry);
      if (object.isMesh) for (const mat of Array.isArray(object.material) ? object.material : [object.material]) {
        resources.add(mat);
        for (const value of Object.values(mat)) if (value?.isTexture) resources.add(value);
      }
    });
    const disposed = new Set();
    resources.forEach(resource => resource.addEventListener('dispose', () => disposed.add(resource)));
    refineModernBuilding(campus, data, source.featureId);
    assert.equal(first.parent, null);
    assert.equal(disposed.size, resources.size);
    assert.equal(root.children.filter(child => child.userData.campusDetail).length, 1);
    close(root.userData.renderHeight, make(source).userData.estimatedDimensionsMeters.meshLocalYMax);
    assert.equal(root.userData.baseRenderHeight, 5);
  });

  test(`${source.referenceSite}: source and placement drift fail before hiding the base`, () => {
    const feature = featureFor(source), metrics = footprintMetrics(feature.geometry, data.metadata.center);
    for (const change of [
      f => {f.geometry.coordinates[0][0][0] += .00001;},
      f => {f.geometry.coordinates.push(f.geometry.coordinates[0]);},
      f => {f.properties.nameSourceFeatureId = 'osm:way:wrong';},
      f => {f.properties.name = '相邻建筑';},
      f => {f.properties.renderHeight = 10;},
    ]) {
      const mutated = structuredClone(feature); change(mutated);
      assert.throws(() => createModernBuildingDetail(mutated, data.metadata.center, metrics.origin), /frozen geometry\/identity/);
    }
    assert.throws(() => createModernBuildingDetail(feature, [0, 0], metrics.origin), /projection/);
    assert.throws(() => createModernBuildingDetail(feature, data.metadata.center, [0, 0]), /origin/);
    for (const change of [
      root => {root.position.x += 1;}, root => {root.position.y = 5;},
      root => {root.position.x = NaN;},
      root => {root.rotation.y = .1;}, root => {root.scale.x = 2;},
      root => {root.userData.localOriginMeters = [0, 0];},
    ]) {
      const campus = createCampusModel(data), root = campus.buildings.get(source.featureId); change(root);
      assert.throws(() => refineModernBuilding(campus, data, source.featureId), /mismatch|origin/);
      assert.equal(root.getObjectByName('base').visible, true);
    }
    const campus = createCampusModel(data);
    assert.throws(() => refineModernBuilding(campus, {...data, features: [...data.features, feature]}, source.featureId), /exactly once/);
  });
}

function ray(detail, point, direction) {
  detail.updateMatrixWorld(true);
  return new THREE.Raycaster(new THREE.Vector3(...point).applyMatrix4(detail.matrixWorld),
    new THREE.Vector3(...direction).transformDirection(detail.matrixWorld)).intersectObject(detail, true);
}

test('art museum has a real open colonnade, recessed glass, elevated screen and independent roof monitors', () => {
  const detail = make(forSite('art-museum')), dimensions = detail.userData.estimatedDimensionsMeters;
  assert.ok(dimensions.roofMonitorCount >= 40 && dimensions.roofMonitorCount <= 60);
  for (const name of ['Open two-stage stone and steel colonnade', 'Recessed south curtain wall',
    'Deep upper facade screen and continuous fascia', 'Estimated roof daylight-monitor array']) {
    assert.ok(detail.getObjectByName(name)?.children.length > 0, name);
  }
  const hits = ray(detail, [10, 3, -4.8], [0, 1, 0]);
  assert.ok(hits.length && hits[0].distance > 9, 'A solid full-footprint extrusion would fill the portico');
  const feature = featureFor(forSite('art-museum')), metrics = footprintMetrics(feature.geometry, data.metadata.center);
  const points = metrics.projected[0][0].map(([x, z]) => new THREE.Vector3(x - metrics.origin[0], 40, z - metrics.origin[1]));
  for (const u of [.2, .5, .8]) for (const v of [.2, .5, .8]) {
    const front = points[4].clone().lerp(points[3], u), back = points[5].clone().lerp(points[6], u);
    const notchHits = new THREE.Raycaster(front.lerp(back, v), new THREE.Vector3(0, -1, 0)).intersectObject(detail, true);
    assert.equal(notchHits.length, 0, 'No foundation, roof monitor or column may fill the original eastern notch');
  }
  assert.match(detail.userData.limits, /雕塑/);
});

test('sports center retains a rectangular map platform but has an elliptical arena, curved roof and open arch web', () => {
  const detail = make(forSite('sports-center')), p = detail.userData.estimatedDimensionsMeters;
  assert.ok(p.archCrown > p.eave + p.roofRise);
  assert.ok(p.roofRise / (2 * p.radiusX) < .18);
  assert.ok(p.roofRise / (p.eave - 2) > .7 && p.roofRise / (p.eave - 2) < .9,
    'Photo proportions require a taller facade rather than a squat UFO-shaped arena');
  assert.ok(p.archHalfSpan / p.radiusX > 1.2 && p.archHalfSpan / p.radiusX < 1.3);
  const roof = detail.getObjectByName('Shallow elliptical ribbed metal roof');
  assert.ok(roof.children.every(mesh => !mesh.receiveShadow), 'Convex roof must not show dotted self-shadow acne');
  const seams = roof.children.find(mesh => mesh.material.name.endsWith(':roof-seam'));
  const normals = seams.geometry.attributes.normal;
  assert.ok(Array.from({length: normals.count}, (_, i) => normals.getY(i)).every(y => y > 0),
    'Roof seam winding must face up, otherwise the front-sided metal disappears');
  const bounds = new THREE.Box3().setFromObject(roof);
  assert.ok(bounds.max.y - bounds.min.y >= p.roofRise && bounds.max.y - bounds.min.y < p.roofRise + .15);
  assert.ok(detail.getObjectByName('Open white parabolic arch and triangulated steel web').children.length >= 1);
  assert.ok(detail.getObjectByName('Upper clerestory stone piers and open balcony rails').children.length >= 1);
  const hit = ray(detail, [p.radiusX * .95, 15, p.arenaCenterZ + p.radiusZ * .95], [0, 1, 0]);
  assert.equal(hit.length, 0, 'The roof must not be a box filling the map footprint corners');
  assert.match(detail.userData.limits, /不是工程结构/);
});

test('music hall triangular windows and grouped doors are apertures with recessed glazing, not dark decals', () => {
  const detail = make(forSite('music-hall')), p = detail.userData.estimatedDimensionsMeters;
  assert.ok(p.height / p.frontWidth > .38 && p.height / p.frontWidth < .44,
    'Official facade photo does not support the previously over-tall wall');
  assert.ok((p.windowHead - p.windowTip) / p.frontWidth > .05 && (p.windowHead - p.windowTip) / p.frontWidth < .065);
  const x = p.windowCenters[0], y = p.windowHead - (p.windowHead - p.windowTip) * .2;
  const windowHit = ray(detail, [x, y, 2], [0, 0, -1])[0];
  assert.ok(windowHit);
  assert.match(windowHit.object.parent.name, /Recessed inverted triangular/);
  assert.ok(windowHit.distance > 2.9, 'Glass must be recessed behind a genuine triangular aperture');
  const doorX = p.doorCenters[0] - p.doorLeafSpacing;
  const doorHit = ray(detail, [doorX, 2, 2], [0, 0, -1])[0];
  assert.match(doorHit.object.parent.name, /Four groups/);
  assert.ok(doorHit.distance > 2.8);
  const folds = detail.getObjectByName('Recessed inverted triangular glazing and tapered brick reveals')
    .children.find(mesh => mesh.material.name.endsWith(':masonry'));
  folds.geometry.computeBoundingBox();
  assert.ok(folds.geometry.boundingBox.max.z > .7, 'Brick facets must project out of the wall, not be hidden inside it');
  assert.ok(folds.geometry.attributes.uv, 'A mapped brick material without UVs still renders as an untextured facet');
  const facade = detail.getObjectByName('South brick facade with genuine inverted triangle and door apertures').children[0].geometry;
  const positions = facade.attributes.position, normals = facade.attributes.normal, uv = facade.attributes.uv;
  for (let i = 0; i < positions.count; i++) if (Math.abs(normals.getZ(i)) > .99) {
    close(uv.getX(i), positions.getX(i), 1e-4);
    close(uv.getY(i), positions.getY(i) / .64, 1e-4);
  }
  assert.ok(detail.getObjectByName('Triangular metal window frames and recessed door frames').children.length >= 1);
  assert.match(detail.userData.limits, /仅南立面/);
});

test('new sites retain original official photo metadata and licensing, never an adjacent-building identity', () => {
  for (const source of MODERN_BUILDINGS) {
    const site = catalog.sites.find(site => site.id === source.referenceSite);
    assert.ok(site?.images.length);
    for (const image of site.images) {
      assert.match(image.sha256, /^[a-f0-9]{64}$/);
      assert.ok(image.width >= 750 && image.height >= 300);
      assert.match(image.license, /不作纹理|不作纹理或在线再发布/);
      assert.ok(new URL(image.imageUrl).hostname.endsWith('tsinghua.edu.cn'));
    }
  }
});
