import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import * as THREE from 'three';
import polygonClipping from 'polygon-clipping';
import {footprintMetrics, ringArea} from '../src/geo.js';
import {createCampusModel} from '../src/model.js';
import {WEST_GYM_ID, createWestGymDetail, refineWestGym} from '../src/west-gym-refinement.js';

const data = JSON.parse(fs.readFileSync(new URL('../data/campus.json', import.meta.url), 'utf8'));
const feature = data.features.find(f => f.id === WEST_GYM_ID);
const metrics = footprintMetrics(feature.geometry, data.metadata.center);
const make = () => createWestGymDetail(feature, data.metadata.center, metrics.origin);
const near = (actual, expected, epsilon = 1e-5) => assert.ok(Math.abs(actual - expected) <= epsilon,
  `${actual} differs from ${expected} by more than ${epsilon}`);
const meshes = object => {
  const list = [];
  object.traverse(child => { if (child.isMesh) list.push(child); });
  return list;
};
const byRole = (object, role) => object.children.find(child => child.userData.surfaceRole === role);

function triangles(mesh) {
  const p = mesh.geometry.attributes.position, index = mesh.geometry.index;
  const count = index?.count ?? p.count, result = [];
  for (let i = 0; i < count; i += 3) result.push([0, 1, 2].map(offset => {
    const j = index ? index.getX(i + offset) : i + offset;
    return [p.getX(j), p.getY(j), p.getZ(j)];
  }));
  return result;
}
const area = polygons => polygons.reduce((sum, polygon) =>
  sum + ringArea(polygon[0]) - polygon.slice(1).reduce((s, ring) => s + ringArea(ring), 0), 0);
function inside(point, polygon) {
  const inRing = r => {
    let hit = false;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const a = r[i], b = r[j];
      const cross = (point[0] - a[0]) * (b[1] - a[1]) - (point[1] - a[1]) * (b[0] - a[0]);
      if (Math.abs(cross) < 0.0002 &&
          point[0] >= Math.min(a[0], b[0]) - 1e-5 && point[0] <= Math.max(a[0], b[0]) + 1e-5 &&
          point[1] >= Math.min(a[1], b[1]) - 1e-5 && point[1] <= Math.max(a[1], b[1]) + 1e-5) return true;
      if ((a[1] > point[1]) !== (b[1] > point[1]) &&
          point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) hit = !hit;
    }
    return hit;
  };
  return inRing(polygon[0]) && !polygon.slice(1).some(inRing);
}
function localRay(detail, x, y, z = 1) {
  detail.updateMatrixWorld(true);
  const start = new THREE.Vector3(x, y, z).applyMatrix4(detail.matrixWorld);
  const direction = new THREE.Vector3(0, 0, -1).transformDirection(detail.matrixWorld);
  return new THREE.Raycaster(start, direction).intersectObject(detail, true);
}

test('uses genuine frozen building, OSM name identity, and actual source origin', () => {
  assert.equal(feature.properties.name, '西体育馆');
  assert.equal(feature.properties.nameSourceFeatureId, 'osm:way:226623363');
  near(metrics.area, 3897.768115, 1e-5);
  near(metrics.bounds[2] - metrics.bounds[0], 84.169591, 1e-5);
  near(metrics.bounds[3] - metrics.bounds[1], 71.816322, 1e-5);
  const detail = make();
  const expected = metrics.projected[0].map(ring => ring.map(([x, z]) => [x - metrics.origin[0], z - metrics.origin[1]]));
  const actual = detail.userData.sourceFootprintFacadeXZ.map(ring => ring.map(([x, z]) => {
    const p = new THREE.Vector3(x, 0, z).applyMatrix4(detail.matrix);
    return [p.x, p.z];
  }));
  for (let i = 0; i < expected[0].length; i++) for (let axis = 0; axis < 2; axis++)
    near(actual[0][i][axis], expected[0][i][axis], 1e-8);
  assert.equal(detail.userData.featureId, undefined);
  assert.equal(detail.userData.referenceSite, 'west-gym');
});

test('geometry, source association, projection and origin drift fail explicitly', () => {
  for (const mutate of [
    f => { f.id += '-other'; },
    f => { f.properties.nameSourceFeatureId = 'osm:way:123'; },
    f => { f.properties.name = '东体育馆'; },
    f => { f.geometry.coordinates[0][0][0] += 0.000001; },
    f => { f.geometry.coordinates.push(f.geometry.coordinates[0]); },
    f => { f.geometry.type = 'MultiPolygon'; },
    f => { f.geometry.coordinates[0][0][1] = NaN; },
  ]) {
    const changed = structuredClone(feature);
    mutate(changed);
    assert.throws(() => createWestGymDetail(changed, data.metadata.center, metrics.origin), /source geometry\/OSM identity/);
  }
  for (const origin of [[metrics.origin[0] + 0.01, metrics.origin[1]], [NaN, 0], [], null])
    assert.throws(() => createWestGymDetail(feature, data.metadata.center, origin), /local origin/);
  for (const center of [[data.metadata.center[0] + 0.001, data.metadata.center[1]], [NaN, 0], null])
    assert.throws(() => createWestGymDetail(feature, center, metrics.origin), /projection center/);
});

test('front is source-edge-derived south, facing the frozen green sports area', () => {
  const detail = make(), normal = detail.userData.facadeNormal;
  near(normal[0], 0.0760492076, 1e-8);
  near(normal[1], 0);
  near(normal[2], 0.9971040658, 1e-8);
  assert.deepEqual(detail.userData.facadeMapEdgeIndices, [3, 4]);
  const green = data.features.find(f => f.id === 'landcover:11785304122');
  assert.ok(green, 'frozen sports-side green feature exists');
  const greenOrigin = footprintMetrics(green.geometry, data.metadata.center).origin;
  const midpoint = metrics.projected[0][0][3].map((v, i) => (v + metrics.projected[0][0][4][i]) / 2);
  const toGreen = greenOrigin.map((v, i) => v - midpoint[i]);
  assert.ok(toGreen[0] * normal[0] + toGreen[1] * normal[2] > 15);
});

test('photo proportions give three broad arch gables and separately pitched taller hall', () => {
  const detail = make(), d = detail.userData.dimensions, p = detail.userData.photoProportions;
  assert.deepEqual(p.size, [1920, 900]);
  near(d.historicFrontWidth, 54.135064074, 1e-8);
  near(d.centralWidth / d.historicFrontWidth, 708 / 1565, 1e-10);
  near(d.archWidth / d.historicFrontWidth, 116 / 1565, 1e-10);
  near(d.wingEave - 0.2, (640 - 462) * d.historicFrontWidth / 1565);
  near(d.hallRidge - 0.2, (640 - 298) * d.historicFrontWidth / 1565);
  assert.equal(detail.userData.arches.length, 3);
  assert.ok(d.archWidth > 3.8 && d.archWidth < 4.3);
  assert.ok(d.hallRidge > d.wingRidge && d.wingRidge > d.gablePeak && d.gablePeak > d.wingEave);
  assert.ok(d.skylightWidth > 18 && d.skylightWidth < 20);
  const roof = byRole(detail, 'historic-roof');
  const heights = meshes(roof).flatMap(mesh => Array.from(mesh.geometry.attributes.position.array)
    .filter((_, i) => i % 3 === 1));
  assert.ok(heights.some(y => Math.abs(y - d.wingRidge) < 1e-5), 'hip ridge is real geometry');
  assert.ok(heights.some(y => Math.abs(y - d.hallRidge) < 1e-5), 'hall ridge is real geometry');
  assert.ok(detail.userData.unknowns.some(text => text.includes('增建')));
  assert.ok(detail.userData.heightSource.includes('非实测'));
  assert.equal(detail.userData.sourceDisplayHeight, 5);
});

test('actual foundation and roof triangles preserve concavity, cover the exact polygon, and leave notches empty', () => {
  const detail = make(), polygon = detail.userData.sourceFootprintFacadeXZ;
  const foundation = meshes(byRole(detail, 'foundation'))[0];
  const capTriangles = triangles(foundation).filter(triangle => triangle.every(p => Math.abs(p[1] - 0.2) < 1e-6));
  near(capTriangles.reduce((sum, tri) => sum + ringArea(tri.map(p => [p[0], p[2]])), 0), metrics.area, 0.002);
  const projectedRoofs = [];
  const roofMeshes = [
    ...meshes(byRole(detail, 'historic-roof')),
    ...meshes(byRole(detail, 'inferred-additions')).filter(mesh => /inferred addition roof/.test(mesh.material.name)),
  ];
  for (const mesh of [foundation, ...roofMeshes]) for (const triangle of triangles(mesh)) {
    const projected = triangle.map(p => [p[0], p[2]]);
    if (ringArea(projected) < 1e-7) continue;
    for (const [wa, wb, wc] of [[1 / 3, 1 / 3, 1 / 3], [0.8, 0.1, 0.1], [0.1, 0.8, 0.1], [0.1, 0.1, 0.8]]) {
      const point = [0, 1].map(axis => projected[0][axis] * wa + projected[1][axis] * wb + projected[2][axis] * wc);
      assert.ok(inside(point, polygon), `actual ${mesh.name} triangle bridged a concavity at ${point}`);
    }
    if (mesh !== foundation) projectedRoofs.push([[...projected, projected[0]]]);
  }
  const union = polygonClipping.union(...projectedRoofs);
  near(area(union), metrics.area, 0.01);
  // Explicit southern west notch, western-front setback and northern recess.
  for (const [x, z] of [[0, 7], [-30, -2], [15, -49], [-15, -44]]) {
    assert.equal(inside([x, z], polygon), false);
    assert.equal(inside([x, z], union[0]), false);
    const ray = new THREE.Raycaster(
      new THREE.Vector3(x, 30, z).applyMatrix4(detail.matrixWorld),
      new THREE.Vector3(0, -1, 0));
    assert.equal(ray.intersectObjects([foundation, ...roofMeshes], false).length, 0,
      `roof/base closes source notch ${x},${z}`);
  }
});

test('arch apertures really expose recessed glazing instead of brick/photo planes', () => {
  const detail = make();
  for (const arch of detail.userData.arches) {
    const hit = localRay(detail, arch.x + 0.23, arch.spring + 0.24)[0];
    assert.ok(hit);
    assert.match(hit.object.material.name, /recessed glazing/);
    const local = detail.worldToLocal(hit.point.clone());
    near(local.z, arch.glassZ, 1e-5);
    assert.ok(local.z < arch.wallZ - 0.15);
    const solid = localRay(detail, arch.x + arch.width / 2 + 0.4, arch.spring)[0];
    assert.match(solid.object.material.name, /red brick/);
  }
});

test('colonnade bays and balcony railing are open geometry, not a solid porch wall', () => {
  const detail = make(), p = detail.userData.colonnade;
  assert.equal(p.columnXs.length, 12);
  assert.ok(p.clearBayWidth > 1.7 && p.clearBayWidth < 1.9);
  for (let i = 0; i < p.columnXs.length - 1; i++) {
    const x = (p.columnXs[i] + p.columnXs[i + 1]) / 2;
    const hit = localRay(detail, x, 1.75)[0];
    assert.ok(hit);
    const local = detail.worldToLocal(hit.point.clone());
    assert.ok(local.z <= p.backWallZ + 0.01, `bay ${i} is obstructed by ${hit.object.name} at ${local.z}`);
  }
  const column = localRay(detail, p.columnXs[3], 1.75)[0];
  assert.match(column.object.material.name, /pale stone/);
  const colPoint = detail.worldToLocal(column.point.clone());
  assert.ok(colPoint.z > -0.55 && colPoint.z < -0.1);
  const railing = meshes(byRole(detail, 'colonnade')).filter(mesh => /slender dark frames|pale stone/.test(mesh.material.name));
  const y = (p.deck + p.railTop) / 2 + 0.05;
  const x = p.columnXs[0] + 0.23;
  detail.updateMatrixWorld(true);
  const ray = new THREE.Raycaster(new THREE.Vector3(x, y, 0.5).applyMatrix4(detail.matrixWorld),
    new THREE.Vector3(0, 0, -1).transformDirection(detail.matrixWorld), 0, 1.5);
  assert.equal(ray.intersectObjects(railing).length, 0, 'railing has actual open spaces');
});

test('every vertex/transform/metadata number is finite; geometry is merged; textures are generated only', () => {
  const detail = make(), all = meshes(detail);
  assert.equal(all.length, detail.userData.meshCount);
  assert.ok(all.length <= 24 && all.length >= 8, `unexpected mesh count ${all.length}`);
  detail.traverse(object => {
    assert.ok(object.matrixWorld.elements.every(Number.isFinite));
    if (!object.isMesh) return;
    for (const attribute of Object.values(object.geometry.attributes))
      assert.ok(Array.from(attribute.array).every(Number.isFinite), `${object.name} has nonfinite attribute`);
    const material = object.material;
    if (material.map) {
      assert.equal(material.map.isDataTexture, true);
      assert.ok(material.map.image.data instanceof Uint8Array);
      assert.match(material.map.name, /generated.*no photo/);
      assert.equal(material.map.image.src, undefined);
    }
  });
  const finiteMetadata = value => {
    if (typeof value === 'number') assert.ok(Number.isFinite(value));
    else if (value && typeof value === 'object') for (const child of Object.values(value)) finiteMetadata(child);
  };
  finiteMetadata(detail.userData);
  assert.equal(detail.userData.noReferencePhotoTextures, true);
  assert.equal(byRole(detail, 'inferred-additions').userData.confidence, 'inferred-not-visible-in-front-photo');
});

test('roof texture minification is mipmapped and anisotropic rather than nearest-sampled checker noise', () => {
  const detail = make(), roof = meshes(byRole(detail, 'historic-roof'))[0];
  const texture = roof.material.map;
  assert.equal(texture.minFilter, THREE.LinearMipmapLinearFilter, 'oblique roof needs trilinear minification');
  assert.equal(texture.magFilter, THREE.LinearFilter);
  assert.equal(texture.generateMipmaps, true, 'DataTexture defaults must be overridden');
  assert.ok(texture.anisotropy >= 4, 'oblique roof needs anisotropic filtering');
  assert.equal(roof.material.emissive.getHex(), 0, 'do not hide texture artifacts with emissive');
  const pixels = texture.image.data;
  const colors = [0, 1, 2].map(channel => Array.from(pixels).filter((_, i) => i % 4 === channel));
  for (const channel of colors) assert.ok(Math.max(...channel) - Math.min(...channel) <= 40,
    'regular warm roof tiles must not contain high-contrast fine checker joints');
});

test('roof UVs stay a continuous affine X/Z mapping across every clipped slope triangle', () => {
  const detail = make(), roof = meshes(byRole(detail, 'historic-roof'))[0];
  const g = roof.geometry, p = g.attributes.position, uv = g.attributes.uv;
  let checked = 0;
  for (let i = 0; i < g.index.count; i += 3) {
    const indices = [0, 1, 2].map(offset => g.index.getX(i + offset));
    // The small ridge-cap box is deliberately not a pitched roof surface.
    if (indices.every(j => p.getY(j) >= detail.userData.dimensions.hallRidge - 1e-4)) continue;
    const projected = indices.map(j => [p.getX(j), p.getZ(j)]);
    if (ringArea(projected) < 1e-7) continue;
    // Same existing world period; do not change roof UVs/massing to hide aliasing.
    const period = [0.65, 0.65];
    for (const j of indices) {
      near(uv.getX(j), p.getX(j) / period[0], 2e-5);
      near(uv.getY(j), p.getZ(j) / period[1], 2e-5);
    }
    checked++;
  }
  assert.ok(checked >= 18, 'checks actual hall/hip/apron triangles, not metadata alone');
});

test('roof faces have no coplanar area overlap with each other or masonry top caps', () => {
  const detail = make();
  const roofs = [
    ...meshes(byRole(detail, 'historic-roof')),
    ...meshes(byRole(detail, 'inferred-additions')).filter(mesh => /inferred addition roof/.test(mesh.material.name)),
  ].flatMap(mesh => triangles(mesh).map(points => ({points, kind: 'roof'})));
  const caps = meshes(detail).filter(mesh => /red brick/.test(mesh.material.name))
    .flatMap(mesh => triangles(mesh)).filter(points =>
      Math.max(...points.map(p => p[1])) - Math.min(...points.map(p => p[1])) < 1e-5)
    .map(points => ({points, kind: 'masonry-cap'}));
  const all = [...roofs, ...caps].filter(({points}) => ringArea(points.map(p => [p[0], p[2]])) > 1e-6);
  let comparisons = 0;
  for (let i = 0; i < roofs.length; i++) {
    const a = roofs[i], vectors = a.points.map(p => new THREE.Vector3(...p));
    const plane = new THREE.Plane().setFromCoplanarPoints(...vectors);
    if (ringArea(a.points.map(p => [p[0], p[2]])) < 1e-6) continue;
    for (const b of all) {
      if (b === a || !b.points.every(p => Math.abs(plane.distanceToPoint(new THREE.Vector3(...p))) < 0.003)) continue;
      const closed = points => {
        const ring = points.map(p => [p[0], p[2]]);
        return [[...ring, ring[0]]];
      };
      const overlap = polygonClipping.intersection(closed(a.points), closed(b.points));
      assert.ok(area(overlap) < 0.001, `roof overlaps ${b.kind} at the same depth`);
      comparisons++;
    }
  }
  assert.ok(comparisons > 0, 'compares actual adjacent/coplanar triangles');
});

test('refining preserves root UUID/ID/position, height ignores hidden base, and repeats without duplicates', () => {
  // Target-only fixture: no browser, complete-campus build, export or registry QA.
  const targetData = {...data, features: [structuredClone(feature)]};
  const campus = createCampusModel(targetData), root = campus.buildings.get(WEST_GYM_ID);
  const uuid = root.uuid, position = root.position.clone(), base = root.getObjectByName('base');
  // A deliberately huge base proves that root Box3 is not used as visible height.
  base.scale.y = 100;
  const returned = refineWestGym(campus, targetData);
  assert.equal(returned, root);
  assert.equal(root.uuid, uuid);
  assert.deepEqual(root.position, position);
  assert.equal(root.userData.featureId, WEST_GYM_ID);
  assert.equal(base.visible, false);
  assert.equal(root.userData.baseRenderHeight, 5);
  assert.equal(root.userData.referenceSite, 'west-gym');
  const first = root.children.find(child => child.userData.campusDetail);
  const visibleHeight = new THREE.Box3().setFromObject(first).max.y;
  near(root.userData.renderHeight, visibleHeight, 1e-8);
  assert.ok(root.userData.renderHeight > 12 && root.userData.renderHeight < 12.2);
  assert.ok(new THREE.Box3().setFromObject(root).max.y > 400, 'hidden base would contaminate a root measurement');
  let identities = 0;
  root.traverse(object => { if (object.userData.featureId) identities++; });
  assert.equal(identities, 1);
  const count = meshes(root).length;
  assert.equal(refineWestGym(campus, targetData), root);
  assert.equal(first.parent, null);
  assert.equal(root.children.filter(child => child.userData.campusDetail).length, 1);
  assert.equal(meshes(root).length, count);
  assert.deepEqual(root.position, position);
  near(root.userData.renderHeight, visibleHeight, 1e-8);
  root.position.x += 0.01;
  assert.throws(() => refineWestGym(campus, targetData), /placement\/orientation changed/);
  root.position.copy(position);
  root.userData.localOriginMeters[0] += 0.01;
  assert.throws(() => refineWestGym(campus, targetData), /local origin changed/);
});
