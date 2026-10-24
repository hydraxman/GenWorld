import assert from 'node:assert/strict';
import test from 'node:test';
import {referenceTest} from './reference-mode.mjs';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import polygonClipping from 'polygon-clipping';
import data from '../data/campus.json' with {type: 'json'};
import match from '../data/old-library-match.json' with {type: 'json'};
import route from '../../tsinghua-tour/route.json' with {type: 'json'};
import {createCampusModel} from '../src/model.js';
import {footprintMetrics, project} from '../src/geo.js';
import {OLD_LIBRARY_IDS, createOldLibraryDetail, refineOldLibrary} from '../src/old-library-refinement.js';

const feature = data.features.find(f => f.id === match.featureId);
const subset = {...data, features: [feature]};
const origin = footprintMetrics(feature.geometry, data.metadata.center).origin;
const create = () => createOldLibraryDetail(feature, data.metadata.center, origin);
const detailOf = root => root.children.find(c => c.userData.campusDetail);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

function inRing([x, y], r) {
  let v = false;
  for (let i = 1; i < r.length; i++) {
    const a = r[i - 1], b = r[i];
    if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) v = !v;
  }
  return v;
}
function inPolygon(point, polygon) {
  return inRing(point, polygon[0]) && !polygon.slice(1).some(r => inRing(point, r));
}
function area(mp) {
  return mp.reduce((sum, p) => sum + p.reduce((s, r, i) => s + (i === 0 ? 1 : -1) *
    Math.abs(r.slice(0, -1).reduce((a, v, j) => a + v[0] * r[j + 1][1] - r[j + 1][0] * v[1], 0)) / 2, 0), 0);
}
function facadeRay(detail, x, y, forward = 10) {
  detail.updateWorldMatrix(true, true);
  const a = detail.children[0];
  const ray = new THREE.Raycaster(new THREE.Vector3(x, y, forward).applyMatrix4(a.matrixWorld),
    new THREE.Vector3(0, 0, -1).transformDirection(a.matrixWorld));
  return ray.intersectObject(detail, true).filter(hit => hit.object.isMesh);
}
function facadePoint(detail, hit) {
  return detail.children[0].worldToLocal(hit.point.clone());
}
function mapDownRay(detail, point) {
  detail.updateWorldMatrix(true, true);
  const [x, z] = project(point, data.metadata.center);
  const start = new THREE.Vector3(x - origin[0], 80, z - origin[1]).applyMatrix4(detail.matrixWorld);
  return new THREE.Raycaster(start, new THREE.Vector3(0, -1, 0).transformDirection(detail.matrixWorld))
    .intersectObject(detail, true).filter(hit => hit.object.isMesh);
}

test('exact unnamed merged outline is matched by OSM relation overlap, not the out-of-outline tour POI', () => {
  assert.deepEqual(OLD_LIBRARY_IDS, [match.featureId]);
  assert.ok(Object.isFrozen(OLD_LIBRARY_IDS));
  assert.equal(feature.properties.name, '');
  assert.deepEqual(feature.geometry, match.sourceGeometry);
  assert.equal(match.expectedOSMId, 'osm:relation:20779765');
  assert.equal(match.outerWay, 'osm:way:852646109');
  assert.equal(match.innerWay, 'osm:way:1524715356');
  const stop = route.stops.find(s => s.name === '老图书馆');
  assert.deepEqual(stop.point, match.routeStop.point);
  assert.equal(stop.osm, match.routeStop.osm);
  assert.equal(inPolygon(stop.point, feature.geometry.coordinates), false);
  assert.equal(inPolygon(match.label.point, feature.geometry.coordinates), true);
  assert.equal(inPolygon(match.label.point, match.osmGeometry.coordinates), true);
  const cache = JSON.parse(readFileSync(new URL('../data/source-cache.json', import.meta.url)));
  const label = cache.records.find(r => r.layer === 'poi' && r.sourceFeatureId === match.label.sourceFeatureId);
  assert.deepEqual(label.geometry.coordinates, match.label.tilePoint);
  assert.equal(label.properties['name:en'], 'Old Library');
  const extent = 2 ** cache.zoom * cache.extent;
  const [x, y] = label.geometry.coordinates;
  const decoded = [x / extent * 360 - 180, Math.atan(Math.sinh(Math.PI * (1 - 2 * y / extent))) * 180 / Math.PI];
  decoded.forEach((v, i) => assert.ok(Math.abs(v - match.label.point[i]) < 1e-10));
  const shift = mp => mp.map(p => p.map(r => r.map(pt => pt.map((v, i) => v - match.label.point[i]))));
  const merged = shift([feature.geometry.coordinates]), osm = shift([match.osmGeometry.coordinates]);
  const intersection = area(polygonClipping.intersection(merged, osm));
  assert.ok(Math.abs(intersection / area(osm) - match.overlap.OSMCoveredByFrozenOutline) < 1e-6);
  assert.ok(Math.abs(intersection / area(polygonClipping.union(merged, osm)) - match.overlap.IoUWithMergedOutline) < 1e-6);
  assert.ok(match.overlap.OSMCoveredByFrozenOutline > 0.99);
  // Explicitly do not pretend the whole merged map address is the original library.
  assert.ok(match.overlap.IoUWithMergedOutline < 0.4);
});

test('small Interface builds unattached west-facing detail at the original WGS84 placement', () => {
  const snapshot = JSON.stringify(feature);
  const campus = createCampusModel(subset), root = campus.buildings.get(match.featureId);
  const position = root.position.toArray(), rootData = structuredClone(root.userData);
  const standalone = create();
  assert.equal(standalone.parent, null);
  const refined = refineOldLibrary(campus, subset, match.featureId);
  assert.equal(refined, root);
  assert.equal(campus.objects.get(match.featureId), root);
  assert.deepEqual(root.position.toArray(), position);
  assert.deepEqual(root.userData.localOriginMeters, origin);
  for (const key of ['name', 'nameSource', 'sourceFeatureId', 'nameConfidence', 'sourceTiles',
    'upstreamProperties', 'upstreamBatchFeatureIds', 'poiLabels', 'idStrategy']) {
    assert.deepEqual(root.userData[key], rootData[key], `source ${key} must not be erased`);
  }
  assert.equal(JSON.stringify(feature), snapshot);
  assert.deepEqual(root.userData.sourceFootprintGeometry, feature.geometry);
  assert.equal(root.userData.referenceSite, 'old-library');
  assert.match(root.userData.heightSource, /非测绘/);
  assert.match(root.userData.refinementSummary, /三个庭院/);
  assert.ok(root.userData.facadeNormal[0] < -0.99);
  assert.ok(root.userData.facadeNormal[1] > 0.05 && root.userData.facadeNormal[1] < 0.06);
  const detail = detailOf(root), projected = project([116.319052577, 40.003187615], data.metadata.center);
  const world = detail.children[0].getWorldPosition(new THREE.Vector3());
  assert.ok(Math.abs(world.x - projected[0]) < 1e-6);
  assert.ok(Math.abs(world.z - projected[1]) < 1e-6);
  let identities = 0;
  root.traverse(o => { if (o.userData.featureId) identities++; });
  assert.equal(identities, 1);
  assert.equal(detail.userData.sourceMatch.expectedOSMId, match.expectedOSMId);
  assert.match(detail.userData.limitations, /1931/);
});

test('three main semicircular windows are real recessed apertures with clipped fan mullions', () => {
  const detail = create();
  assert.equal(detail.userData.mainArchedWindows.length, 3);
  for (const {x, spring, radius} of detail.userData.mainArchedWindows) {
    const hits = facadeRay(detail, x + 0.46, 7.4);
    assert.match(hits[0].object.material.name, /recessed muted glazing/);
    assert.ok(Math.abs(facadePoint(detail, hits[0]).z + 0.86) < 1e-4);
    // Inside rounded fan: glass, not a full rectangular shell behind it.
    const fan = facadeRay(detail, x + 0.46, spring + 0.8);
    assert.match(fan[0].object.material.name, /recessed muted glazing/);
    // Outside the semicircle but inside its bounding rectangle: solid arch ring.
    const outside = facadeRay(detail, x + radius * 0.89, spring + radius * 0.78);
    assert.doesNotMatch(outside[0].object.material.name, /glazing/);
    // An authored slender vertical mullion remains separate from the glass.
    const mullion = facadeRay(detail, x + radius * 0.2, 7.4);
    assert.match(mullion[0].object.material.name, /mullions/);
    assert.ok(facadePoint(detail, mullion[0]).z > -0.86);
  }
});

test('ground entrance is deep and open, corner windows and upper tier follow the frontal photo', () => {
  const detail = create();
  const hits = facadeRay(detail, 0.12, 3.3);
  assert.match(hits[0].object.material.name, /deep entrance interior/);
  assert.ok(facadePoint(detail, hits[0]).z < -1.5);
  assert.equal(detail.userData.projectingCorners, 2);
  assert.equal(detail.userData.upperRectangularWindows, 3);
  for (const side of [-1, 1]) {
    const corner = facadeRay(detail, side * 6.9, 6.05);
    assert.match(corner[0].object.material.name, /glazing/);
    assert.ok(Math.abs(facadePoint(detail, corner[0]).z + 0.31) < 1e-4);
  }
  for (const x of [-3.2, 0, 3.2]) {
    assert.match(facadeRay(detail, x + 0.23, 12.0)[0].object.material.name, /glazing/);
  }
  assert.ok(detail.userData.wingArches >= 8);
  assert.equal(detail.userData.eaveBrackets, 19);
  const eave = facadeRay(detail, 0.1, 13.96);
  assert.match(eave[0].object.material.name, /timber/);
});

test('source area partitions without filling any of the three courtyard holes or open lawn', () => {
  const detail = create(), {photoRefinedPlanFacadeMeters: photo, unrefinedPlanFacadeMeters: rest} = detail.userData;
  assert.equal(detail.userData.sourceCourtyardCount, 3);
  assert.ok(Math.abs(area(photo) + area(rest) - detail.userData.sourceFootprintArea) < 1e-4);
  assert.ok(area(photo) < detail.userData.sourceFootprintArea * 0.2, 'do not photo-refine the entire complex');
  const sourceHoles = feature.geometry.coordinates.slice(1);
  const samples = [[116.3174, 40.00404], [116.31743, 40.003455], [116.31931, 40.00336],
    [116.319257, 40.003388], [116.319251, 40.00331]];
  for (const point of samples) {
    assert.ok(sourceHoles.some(r => inRing(point, r)));
    assert.equal(mapDownRay(detail, point).length, 0, `source courtyard ${point} must remain empty`);
  }
  assert.equal(mapDownRay(detail, match.routeStop.point).length, 0);
  const neutralHit = mapDownRay(detail, [116.3171, 40.00411])[0];
  assert.ok(neutralHit);
  assert.match(neutralHit.object.material.name, /UNREFINED/);
  assert.ok(Math.abs(neutralHit.point.y - 5) < 1e-4);
});

test('hipped roof slope, thin eaves and nine stepped treads are geometry, not facade decals', () => {
  const detail = create(), a = detail.children[0];
  detail.updateMatrixWorld(true);
  const down = (u, v) => {
    const p = new THREE.Vector3(u, 40, v).applyMatrix4(a.matrixWorld);
    const hit = new THREE.Raycaster(p, new THREE.Vector3(0, -1, 0)).intersectObject(detail, true)[0];
    return hit && a.worldToLocal(hit.point.clone()).y;
  };
  assert.ok(down(0, -10) > 16.2);
  assert.ok(down(4, -10) < down(0, -10) - 0.6);
  assert.ok(down(0, -1.0) < down(0, -10) - 1.5);
  for (let i = 0; i < 9; i++) {
    assert.ok(Math.abs(down(0, 1.22 + i * 0.36) - (1.62 - i * 0.18)) < 1e-4);
  }
  assert.ok(down(4.6, 2.5) > 1.0, 'sloping staircase sidewall/cap');
});

test('finite attributes, bounded draw calls and deterministic procedural textures, no photo pixels', t => {
  const detail = create(), again = create(), materials = new Set();
  let meshes = 0, vertices = 0;
  detail.traverse(o => {
    if (!o.isMesh) return;
    meshes++;
    materials.add(o.material);
    assert.ok(o.geometry.attributes.position.count > 0);
    vertices += o.geometry.attributes.position.count;
    for (const attribute of Object.values(o.geometry.attributes)) {
      assert.ok(attribute.array.every(Number.isFinite), `${o.name} has non-finite attributes`);
    }
    assert.ok(o.geometry.attributes.normal);
    assert.ok(o.geometry.attributes.uv);
  });
  assert.equal(meshes, detail.userData.meshCount);
  assert.ok(meshes <= 20, `${meshes} meshes must remain batched`);
  assert.ok(vertices < 100000, `${vertices} vertices must stay reasonable`);
  const textures = [...materials].map(m => m.map).filter(Boolean);
  assert.equal(textures.length, 2);
  for (const tex of textures) {
    assert.ok(tex.isDataTexture);
    assert.ok(tex.image.data instanceof Uint8Array);
    assert.match(tex.name, /NOT photo pixels/);
    const other = [];
    again.traverse(o => { if (o.isMesh && o.material.map?.name === tex.name) other.push(o.material.map); });
    assert.equal(sha(tex.image.data), sha(other[0].image.data));
  }
  const source = readFileSync(new URL('../src/old-library-refinement.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /TextureLoader|ImageLoader|fetch\s*\(|readFileSync|\.jpg['"]/);
  assert.equal(detail.userData.noReferencePhotoTextures, true);
  t.diagnostic(JSON.stringify({meshes, vertices, facadeNormal: detail.userData.facadeNormal,
    dimensions: detail.userData.estimatedDimensionsMeters, wingArches: detail.userData.wingArches}));
});

test('root roof texture uses mipmapped anisotropic minification and subtle periodic joints, not dark stipple', t => {
  const campus = createCampusModel(subset), root = refineOldLibrary(campus, subset, match.featureId);
  const textures = new Set();
  root.traverse(o => {
    if (o.isMesh && o.material.map?.name === 'old-library authored roof tile rows, NOT photo pixels') {
      textures.add(o.material.map);
    }
  });
  assert.equal(textures.size, 1, 'all roof surfaces share one authored texture');
  const tex = [...textures][0];
  assert.ok(tex.isDataTexture);
  assert.equal(tex.magFilter, THREE.LinearFilter);
  assert.equal(tex.minFilter, THREE.LinearMipmapLinearFilter);
  assert.equal(tex.generateMipmaps, true);
  assert.equal(tex.anisotropy, 8);
  assert.equal(tex.wrapS, THREE.RepeatWrapping);
  assert.equal(tex.wrapT, THREE.RepeatWrapping);
  assert.equal(tex.colorSpace, THREE.SRGBColorSpace);
  const {width, height, data: pixels} = tex.image;
  assert.equal(width, 64);
  assert.equal(height, 64);
  const rgbMin = [255, 255, 255], rgbMax = [0, 0, 0];
  let maxAdjacentContrast = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const offset = (y * width + x) * 4;
    assert.equal(pixels[offset + 3], 255);
    for (let c = 0; c < 3; c++) {
      const value = pixels[offset + c];
      rgbMin[c] = Math.min(rgbMin[c], value);
      rgbMax[c] = Math.max(rgbMax[c], value);
      // Include repeat boundaries: no abrupt wrap seam or isolated black noise.
      for (const next of [(y * width + (x + 1) % width) * 4,
        (((y + 1) % height) * width + x) * 4]) {
        maxAdjacentContrast = Math.max(maxAdjacentContrast, Math.abs(value - pixels[next + c]));
      }
      assert.equal(value, pixels[(y * width + (x + 8) % width) * 4 + c]);
      assert.equal(value, pixels[(((y + 16) % height) * width + x) * 4 + c]);
    }
  }
  assert.ok(rgbMin.every(v => v >= 80), 'no near-black high-frequency joint texels');
  assert.ok(rgbMax.every((v, c) => v - rgbMin[c] <= 12), 'keep the tile pattern low contrast');
  assert.ok(maxAdjacentContrast <= 12, 'no gross single-pixel contrasts to alias under minification');
  assert.equal(root.userData.name, feature.properties.name);
  assert.equal(root.userData.nameSource, feature.properties.nameSource);
  assert.ok([...root.userData.focusBoundsLocal.min, ...root.userData.focusBoundsLocal.max].every(Number.isFinite));
  t.diagnostic(JSON.stringify({generateMipmaps: tex.generateMipmaps, anisotropy: tex.anisotropy,
    minFilter: 'LinearMipmapLinearFilter', magFilter: 'LinearFilter', rgbMin, rgbMax, maxAdjacentContrast}));
});

test('height uses unattached visible geometry, hidden base cannot leak into even non-visible exports', () => {
  const campus = createCampusModel(subset), root = campus.buildings.get(match.featureId);
  campus.group.position.set(100, 250, -70);
  campus.group.scale.setScalar(2);
  const phantom = new THREE.Mesh(new THREE.BoxGeometry(10, 300, 10), new THREE.MeshBasicMaterial());
  phantom.position.y = 200;
  root.getObjectByName('base').add(phantom);
  const refined = refineOldLibrary(campus, subset, match.featureId);
  const expected = create().userData.estimatedDimensionsMeters.visibleHeight;
  assert.equal(refined.userData.renderHeight, expected);
  assert.ok(expected > 16.2 && expected < 16.5);
  assert.equal(refined.userData.baseRenderHeight, 5);
  assert.equal(refined.userData.baseHeightSource, 'openfreemap-render-height');
  const base = refined.getObjectByName('base');
  assert.equal(base.visible, false);
  assert.equal(base.children.length, 0);
  const exported = refined.toJSON().object;
  const meshes = object => (object.type === 'Mesh' ? 1 : 0) + (object.children || []).reduce((s, c) => s + meshes(c), 0);
  assert.equal(meshes(exported), detailOf(refined).userData.meshCount);
  assert.equal(campus.buildings.size, 1);
});

test('historic focus bounds use original root-local axes and exclude neutral merged areas without geometry changes', t => {
  const geometryHash = detail => {
    const hash = createHash('sha256');
    detail.traverse(o => {
      if (!o.isMesh) return;
      for (const attribute of [...Object.values(o.geometry.attributes), o.geometry.index].filter(Boolean)) {
        const a = attribute.array;
        hash.update(Buffer.from(a.buffer, a.byteOffset, a.byteLength));
      }
    });
    return hash.digest('hex');
  };
  const originalGeometryHash = geometryHash(create()), campus = createCampusModel(subset);
  const root = campus.buildings.get(match.featureId), originalPosition = root.position.toArray();
  root.userData.reconstructionExtent = 'partial';
  // Deliberately move/rotate/non-uniformly scale the campus ancestor before
  // refinement: focus metadata must still be original building-local meters.
  campus.group.position.set(1000, 250, -700);
  campus.group.rotation.set(0.2, 0.5, -0.1);
  campus.group.scale.set(1.4, 2, 0.7);
  refineOldLibrary(campus, subset, match.featureId);
  const bounds = root.userData.focusBoundsLocal, detail = detailOf(root), architecture = detail.children[0];
  assert.deepEqual(Object.keys(bounds).sort(), ['max', 'min']);
  for (const key of ['min', 'max']) {
    assert.equal(bounds[key].length, 3);
    assert.ok(bounds[key].every(Number.isFinite));
  }
  assert.ok(bounds.min.every((v, i) => v < bounds.max[i]));
  const box = new THREE.Box3(new THREE.Vector3(...bounds.min), new THREE.Vector3(...bounds.max));
  const expected = new THREE.Box3(), rootInverse = root.matrixWorld.clone().invert(), point = new THREE.Vector3();
  const seenRoles = new Set();
  for (const group of architecture.children) {
    if (!['facade', 'roofs', 'entrance'].includes(group.userData.role)) continue;
    seenRoles.add(group.userData.role);
    group.traverseVisible(object => {
      if (!object.isMesh) return;
      const relative = rootInverse.clone().multiply(object.matrixWorld), positions = object.geometry.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        point.fromBufferAttribute(positions, i).applyMatrix4(relative);
        expected.expandByPoint(point);
        assert.ok(point.toArray().every((v, axis) => v >= bounds.min[axis] - 1e-6 &&
          v <= bounds.max[axis] + 1e-6), `${group.userData.role} vertex must be included`);
      }
    });
  }
  assert.equal(seenRoles.size, 3);
  const relative = rootInverse.clone().multiply(architecture.matrixWorld);
  for (const polygon of detail.userData.photoRefinedPlanFacadeMeters) for (const ring of polygon) {
    for (const [u, v] of ring) expected.expandByPoint(point.set(u, 0.12, v).applyMatrix4(relative));
  }
  assert.ok(box.min.distanceTo(expected.min) < 1e-6);
  assert.ok(box.max.distanceTo(expected.max) < 1e-6);
  const size = box.getSize(new THREE.Vector3());
  assert.ok(size.z > 56 && size.z < 60, 'the supported facade span is mainly north/south, not local X');
  assert.ok(size.x > 20 && size.x < 30, 'do not retain the huge east/west merged complex extent');
  assert.ok(Math.abs(box.max.y - root.userData.renderHeight) < 1e-6);
  const [x, z] = project([116.3171, 40.00411], data.metadata.center);
  assert.equal(box.containsPoint(new THREE.Vector3(x - origin[0], 2.5, z - origin[1])), false);
  assert.deepEqual(root.position.toArray(), originalPosition);
  assert.equal(root.userData.featureId, match.featureId);
  assert.equal(root.userData.reconstructionExtent, 'partial');
  assert.equal(geometryHash(detail), originalGeometryHash);
  assert.equal(detail.userData.meshCount, 13);
  const snapshot = structuredClone(bounds);
  campus.group.position.set(-900, -500, 800);
  campus.group.rotation.set(-0.3, -1.2, 0.4);
  refineOldLibrary(campus, subset, match.featureId);
  assert.deepEqual(root.userData.focusBoundsLocal, snapshot);
  assert.equal(geometryHash(detailOf(root)), originalGeometryHash);
  t.diagnostic(JSON.stringify({focusBoundsLocal: bounds, sizeMeters: size.toArray()}));
});

test('repeat refinement replaces and disposes previous geometry/materials without accumulation', () => {
  const campus = createCampusModel(subset);
  const root = refineOldLibrary(campus, subset, match.featureId);
  const first = detailOf(root);
  const geometry = [], materials = new Set(), textures = new Set();
  first.traverse(o => {
    if (o.isMesh) { geometry.push(o.geometry); materials.add(o.material); if (o.material.map) textures.add(o.material.map); }
  });
  let disposedGeometry = 0, disposedMaterials = 0, disposedTextures = 0;
  geometry.forEach(g => g.addEventListener('dispose', () => disposedGeometry++));
  materials.forEach(m => m.addEventListener('dispose', () => disposedMaterials++));
  textures.forEach(t => t.addEventListener('dispose', () => disposedTextures++));
  const height = root.userData.renderHeight;
  assert.equal(refineOldLibrary(campus, subset, match.featureId), root);
  assert.equal(first.parent, null);
  assert.equal(root.children.filter(c => c.userData.campusDetail).length, 1);
  assert.equal(root.children.length, 2, 'only empty base marker and one detail');
  assert.equal(root.userData.renderHeight, height);
  assert.equal(disposedGeometry, geometry.length);
  assert.equal(disposedMaterials, materials.size);
  assert.equal(disposedTextures, textures.size);
  assert.equal(detailOf(root).userData.meshCount, first.userData.meshCount);
});

test('changed source geometry, unnamed-name assignment, provenance or anchors fail before mutation', () => {
  const mutations = [
    f => { f.id = 'building:made-up-neighbor'; },
    f => { f.properties.name = '老图书馆'; },
    f => { f.properties.kind = 'landmark'; },
    f => { f.properties.sourceFeatureId = '207797653'; },
    f => { f.properties.nameSourceFeatureId = 'osm:way:207797653'; },
    f => { f.properties.poiLabels[0].sourceFeatureId = '8526461082'; },
    f => { f.properties.upstreamBatchFeatureIds = ['new']; },
    f => { f.geometry.coordinates[0][32][0] += 1e-7; },
    f => { f.geometry.coordinates.pop(); },
    f => { f.geometry.coordinates[1][1][0] = NaN; },
  ];
  for (const mutate of mutations) {
    const altered = structuredClone(feature);
    mutate(altered);
    assert.throws(() => createOldLibraryDetail(altered, data.metadata.center, origin), /source identity/);
  }
  for (const bad of [[NaN, 0], [0], [0, Infinity]]) {
    assert.throws(() => createOldLibraryDetail(feature, bad, origin), /finite WGS84/);
    assert.throws(() => createOldLibraryDetail(feature, data.metadata.center, bad), /finite WGS84/);
  }
  assert.throws(() => createOldLibraryDetail(feature, data.metadata.center, [0, 0]), /local origin/);
  const campus = createCampusModel(subset), root = campus.buildings.get(match.featureId);
  const bad = structuredClone(subset);
  bad.features[0].properties.name = '老馆';
  assert.throws(() => refineOldLibrary(campus, bad, match.featureId), /source identity/);
  assert.equal(root.getObjectByName('base').visible, true);
  assert.equal(root.children.length, 1);
  assert.throws(() => refineOldLibrary(campus, subset, 'wrong-id'), /Unknown/);
  assert.throws(() => refineOldLibrary(campus, {...subset, features: [feature, feature]}, match.featureId), /exactly once/);
  root.position.x += 0.1;
  assert.throws(() => refineOldLibrary(campus, subset, match.featureId), /placement/);
  root.position.x -= 0.1;
  root.scale.x = 2;
  assert.throws(() => refineOldLibrary(campus, subset, match.featureId), /placement/);
  root.scale.x = 1;
  root.userData.name = '老图书馆';
  assert.throws(() => refineOldLibrary(campus, subset, match.featureId), /identity changed/);
  assert.equal(root.getObjectByName('base').visible, true);
});

referenceTest('old library photographs retain their original watermark-bearing bytes', () => {
  const files = {
    'old-library-front.jpg': '5e2e0a90bed2c98b349c92c3c3e072ba27d9a30de1aba0ae625cf10f442952f7',
    'old-library-arch-snow.jpg': 'f32582e4270719e6e7c45fd2005291fbfba1728f58d0a20fc91a1c6541689b3a',
    'old-library-night.jpg': '3b0ad1ad785138248ac97dd806240f6185c0d96b75c85fbae89f24bb578a8530',
  };
  for (const [file, hash] of Object.entries(files)) {
    assert.equal(sha(readFileSync(new URL(`../references/${file}`, import.meta.url))), hash);
  }
});
