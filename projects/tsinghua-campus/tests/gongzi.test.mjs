import assert from 'node:assert/strict';
import test from 'node:test';
import {referenceTest} from './reference-mode.mjs';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import polygonClipping from 'polygon-clipping';
import {XMLParser} from 'fast-xml-parser';
import data from '../data/campus.json' with {type: 'json'};
import source from '../data/gongzi-source.json' with {type: 'json'};
import {footprintMetrics, project, ringArea} from '../src/geo.js';
import {createCampusModel} from '../src/model.js';
import {GONGZI_IDS, createGongziDetail, refineGongzi} from '../src/gongzi-refinement.js';

const center = data.metadata.center;
const subset = {...data, features: data.features.filter(f => GONGZI_IDS.includes(f.id))};
const feature = id => subset.features.find(f => f.id === id);
const detailFor = root => root.children.find(c => c.userData.campusDetail);
const fresh = (index = 0) => {
  const campus = createCampusModel(subset), root = refineGongzi(campus, subset, GONGZI_IDS[index]);
  return {campus, root, detail: detailFor(root)};
};
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const meshesOf = detail => {
  const meshes = [];
  detail.traverse(o => {if (o.isMesh) meshes.push(o);});
  return meshes;
};
const area = polygons => polygons.reduce((sum, polygon) =>
  sum + ringArea(polygon[0]) - polygon.slice(1).reduce((s, ring) => s + ringArea(ring), 0), 0);
function cast(detail, point, direction, far = Infinity, objects = [detail]) {
  detail.updateWorldMatrix(true, true);
  const from = new THREE.Vector3(...point).applyMatrix4(detail.matrixWorld);
  const vector = new THREE.Vector3(...direction).transformDirection(detail.matrixWorld);
  return new THREE.Raycaster(from, vector, 0, far).intersectObjects(objects, true);
}
function roofMeshes(detail) {
  return meshesOf(detail).filter(m => m.userData.surfaceRole === 'roof');
}
function topAt(detail, x, z, objects = [detail]) {
  const hits = cast(detail, [x, 20, z], [0, -1, 0], 30, objects);
  return hits[0] ? detail.worldToLocal(hits[0].point.clone()).y : undefined;
}

test('exact two real IDs, source rings, photo provenance and frozen gate OSM XML match', () => {
  assert.deepEqual(GONGZI_IDS, ['building:6598261612', 'building:geometry:1a6c5da45bceef88407b194f']);
  for (const [i, spec] of [source.main, source.gate].entries()) {
    assert.deepEqual(feature(GONGZI_IDS[i]).geometry.coordinates, [spec.ring]);
    assert.equal(hash(JSON.stringify(feature(GONGZI_IDS[i]).geometry.coordinates)), spec.frozenRingSha256);
  }
  for (const photo of Object.values(source.photos)) {
    assert.match(photo.localPath, /^projects\/tsinghua-campus\/references\//);
    assert.match(photo.sha256, /^[a-f0-9]{64}$/);
    assert.deepEqual(photo.pixels, [1920, 900]);
    assert.ok(photo.url.startsWith('https://www.tsinghua.edu.cn/__local/'));
  }
  const match = source.gate.osmMatch;
  const xml = fs.readFileSync(new URL(`../${match.xmlPath}`, import.meta.url));
  assert.equal(hash(xml), match.xmlSha256);
  const osm = new XMLParser({ignoreAttributes: false, attributeNamePrefix: ''}).parse(xml).osm;
  const way = osm.way.find(w => String(w.id) === '1059165164');
  assert.equal(Number(way.version), 1);
  const tags = Object.fromEntries([].concat(way.tag).map(t => [t.k, t.v]));
  assert.deepEqual(tags, {building: 'office'});
  assert.equal(tags.name, undefined, 'Do not invent an upstream gate name');
  const nodes = new Map(osm.node.map(n => [String(n.id), [Number(n.lon), Number(n.lat)]]));
  assert.deepEqual(way.nd.map(n => nodes.get(String(n.ref))), match.ring);
  assert.equal(match.polygonIoU, 0.9663509490462833);
  const projected = ring => [[ring.map(p => project(p, source.gate.ring[0]))]];
  const frozen = projected(source.gate.ring), reviewed = projected(match.ring);
  const measuredIoU = area(polygonClipping.intersection(frozen, reviewed)) /
    area(polygonClipping.union(frozen, reviewed));
  assert.ok(Math.abs(measuredIoU - match.polygonIoU) < 1e-10);
  assert.notDeepEqual(match.ring, source.gate.ring, 'Reviewed OSM match must not replace frozen vector outline');
});

referenceTest('gongzi and shuimu original official photograph bytes', () => {
  const projectRoot = new URL('../../../', import.meta.url);
  for (const photo of Object.values(source.photos)) {
    const bytes = fs.readFileSync(new URL(photo.localPath, projectRoot));
    assert.equal(hash(bytes), photo.sha256);
  }
});

test('all 650 stable campus roots/maps/origins and frozen source remain unchanged', () => {
  const originalData = JSON.stringify(data), campus = createCampusModel(data);
  const buildingsMap = campus.buildings, objectsMap = campus.objects;
  const entries = [...buildingsMap].map(([id, root]) => ({
    id, root, position: root.position.toArray(), origin: [...root.userData.localOriginMeters],
    minHeight: root.userData.minHeight, minHeightSource: root.userData.minHeightSource,
  }));
  assert.equal(entries.length, 650);
  const originalRoots = [...campus.layers.building.children];
  for (const id of GONGZI_IDS) {
    const root = buildingsMap.get(id);
    assert.equal(refineGongzi(campus, data, id), root);
    assert.equal(root.getObjectByName('base').visible, false);
    assert.equal(root.userData.baseRenderHeight, id === GONGZI_IDS[0] ? 4 : 5);
    assert.equal(root.userData.baseHeightSource, 'openfreemap-render-height');
  }
  assert.equal(campus.buildings, buildingsMap);
  assert.equal(campus.objects, objectsMap);
  assert.equal(campus.buildings.size, 650);
  assert.deepEqual(campus.layers.building.children, originalRoots);
  for (const e of entries) {
    assert.equal(buildingsMap.get(e.id), e.root);
    assert.equal(objectsMap.get(e.id), e.root);
    assert.deepEqual(e.root.position.toArray(), e.position);
    assert.deepEqual(e.root.userData.localOriginMeters, e.origin);
    assert.equal(e.root.userData.minHeight, e.minHeight);
    assert.equal(e.root.userData.minHeightSource, e.minHeightSource);
    if (!GONGZI_IDS.includes(e.id)) assert.equal(e.root.getObjectByName('base').visible, true);
  }
  const owners = [];
  campus.group.traverse(o => {if (o.userData.featureId && GONGZI_IDS.includes(o.userData.featureId)) owners.push(o);});
  assert.deepEqual(owners, GONGZI_IDS.map(id => campus.buildings.get(id)));
  assert.equal(JSON.stringify(data), originalData);
});

test('main hall alias and gate interpretation are distinct; no independent Shuimu identity', () => {
  for (let i = 0; i < 2; i++) {
    const {root, detail} = fresh(i), u = root.userData;
    assert.equal(u.referenceSite, 'gongzi-shuimu');
    assert.equal(detail.userData.referenceSite, 'gongzi-shuimu');
    assert.equal(detail.userData.featureId, undefined);
    assert.equal(detail.userData.buildingFeatureId, GONGZI_IDS[i]);
    assert.equal(root.name, i === 0 ? '工字厅' : '工字厅门房');
    assert.equal(u.displayName, root.name);
    assert.equal(u.name, feature(GONGZI_IDS[i]).properties.name, 'Keep frozen source name separate from display name');
    assert.deepEqual(u.aliases, i === 0 ? ['水木清华'] : []);
    assert.deepEqual(u.referencePages, [source.referencePage]);
    assert.equal(u.sourceMatchMetadata.sourceGeometryReplaced, false);
    assert.equal(u.sourceMatchMetadata.independentShuimuBuilding, false);
    assert.deepEqual(u.facadeNormal, [u.facadeNormalXZ[0], 0, u.facadeNormalXZ[1]]);
    assert.match(u.heightSource, /推定.*非测绘/);
    assert.ok(u.knownUnknowns.some(s => s.includes('石狮')));
    assert.ok(u.knownUnknowns.some(s => s.includes('文字未制作')));
    assert.ok(u.knownUnknowns.some(s => s.includes('非测绘')));
    if (i === 0) {
      assert.match(u.refinementSummary, /北后厦/);
      assert.equal(u.sourceMatchMetadata.associatedPoi.id, 'osm:node:2354348604');
    } else {
      assert.match(u.refinementSummary, /南入口/);
      assert.match(u.labelSource, /上游 OSM 无 name/);
      assert.equal(u.nameSource, 'unknown');
      assert.equal(u.sourceMatchMetadata.nameSourceFeatureId, null);
    }
    assert.equal(detail.userData.componentCounts.lions, 0);
    assert.equal(detail.userData.componentCounts.inscriptions, 0);
  }
});

test('source/association/height failures are atomic before hiding base or attaching details', () => {
  const cases = [
    [0, f => {f.id = 'building:fake-shuimu';}],
    [0, f => {f.properties.nameSourceFeatureId = 'osm:node:2354348604';}],
    [0, f => {f.properties.sourceFeatureId = '659826161';}],
    [0, f => {f.properties.name = '水木清华';}],
    [1, f => {f.properties.name = '工字厅';}],
    [1, f => {f.properties.nameSourceFeatureId = 'osm:way:1059165164';}],
    [1, f => {f.properties.sourceFeatureId = '1059165164';}],
    [1, f => {f.geometry.coordinates = [structuredClone(source.gate.osmMatch.ring)];}],
    [0, f => {f.geometry.coordinates[0][2][0] += 0.000001;}],
    [0, f => {f.geometry.coordinates[0][0][1] = NaN;}],
    [0, f => {f.geometry.coordinates.push(structuredClone(f.geometry.coordinates[0]));}],
    [1, f => {f.properties.minHeight = 1;}],
    [0, f => {f.properties.renderHeight = 7;}],
    [0, f => {f.properties.upstreamProperties.render_height = 7;}],
  ];
  for (const [i, mutate] of cases) {
    const campus = createCampusModel(subset), id = GONGZI_IDS[i], root = campus.buildings.get(id);
    const f = structuredClone(feature(id)), origin = root.userData.localOriginMeters;
    mutate(f);
    assert.throws(() => createGongziDetail(f, center, origin), /source/);
    const changed = {...subset, features: subset.features.map(old => old.id === id ? f : old)};
    assert.throws(() => refineGongzi(campus, changed, id), /source|exactly once/);
    assert.equal(root.children.length, 1);
    assert.equal(root.getObjectByName('base').visible, true);
    assert.equal(root.userData.renderHeight, i === 0 ? 4 : 5);
  }
  const campus = createCampusModel(subset);
  assert.throws(() => refineGongzi(campus, {...subset, features: [...subset.features, subset.features[0]]}, GONGZI_IDS[0]), /exactly once/);
  assert.throws(() => refineGongzi(campus, subset, 'osm:node:2354348604'), /Unsupported/);
  assert.throws(() => refineGongzi(campus, subset, undefined), /Unsupported/);
});

test('projection/local origin and root placement are validated before mutation', () => {
  const id = GONGZI_IDS[0], f = feature(id), origin = footprintMetrics(f.geometry, center).origin;
  for (const bad of [[0, 0], [origin[0] + 0.01, origin[1]], [NaN, 1], [1], null]) {
    assert.throws(() => createGongziDetail(f, center, bad), /origin/);
  }
  for (const bad of [[NaN, 40], [116, 90], [181, 40], [116], null]) {
    assert.throws(() => createGongziDetail(f, bad, origin), /projection center/);
  }
  const mutations = [
    r => {r.position.x += 0.01;},
    r => {r.position.y = 0.1;},
    r => {r.rotation.y = 0.01;},
    r => {r.scale.z = 2;},
    r => {r.userData.localOriginMeters = [0, 0];},
    r => {r.userData.featureId = GONGZI_IDS[1];},
    r => {r.userData.nameSourceFeatureId = 'osm:way:1';},
    r => {r.userData.renderHeight = 99;},
    r => {r.userData.minHeightSource = 'guessed';},
  ];
  for (const mutate of mutations) {
    const campus = createCampusModel(subset), root = campus.buildings.get(id);
    mutate(root);
    assert.throws(() => refineGongzi(campus, subset, id), /origin|identity\/placement/);
    assert.equal(root.children.length, 1);
    assert.equal(root.getObjectByName('base').visible, true);
  }
});

test('alternate projection center changes only local anchor, not dimensions or geographic orientation', () => {
  for (let i = 0; i < 2; i++) {
    const id = GONGZI_IDS[i], f = feature(id), origin = footprintMetrics(f.geometry, center).origin;
    const shiftedCenter = [center[0] + 0.01, center[1]];
    const shiftedOrigin = footprintMetrics(f.geometry, shiftedCenter).origin;
    const a = createGongziDetail(f, center, origin), b = createGongziDetail(f, shiftedCenter, shiftedOrigin);
    assert.ok(Math.abs(shiftedOrigin[0] - origin[0]) > 800);
    assert.ok(Math.abs(a.userData.dimensions.orientedFootprintWidth - b.userData.dimensions.orientedFootprintWidth) < 1e-6);
    a.userData.facadeNormalXZ.forEach((v, axis) => assert.ok(Math.abs(v - b.userData.facadeNormalXZ[axis]) < 1e-12));
    const expected = i === 0 ? [-0.0830478305, -0.9965455624] : [0.0587225801, 0.9982743403];
    a.userData.facadeNormalXZ.forEach((v, axis) => assert.ok(Math.abs(v - expected[axis]) < 1e-8));
    const localFacing = new THREE.Vector3(0, 0, i === 0 ? -1 : 1).applyQuaternion(a.quaternion);
    assert.ok(Math.abs(localFacing.x - expected[0]) < 1e-8);
    assert.ok(Math.abs(localFacing.z - expected[1]) < 1e-8);
    assert.equal(a.position.length(), 0, 'Only existing root owns map translation');
  }
});

test('roof partitions are the exact I-shaped two halls and short corridor, with no filled cutouts', () => {
  const {detail} = fresh();
  const footprint = detail.userData.footprintInFacadeFrame, partitions = detail.userData.roofPartitions;
  assert.equal(partitions.length, 3);
  assert.match(partitions[0].name, /north rear hall/);
  assert.match(partitions[1].name, /hidden inferred/);
  assert.match(partitions[2].name, /hidden inferred/);
  const union = polygonClipping.union(...partitions.map(p => [p.polygon]));
  assert.ok(area(polygonClipping.xor([footprint], union)) < 1e-7);
  for (let i = 0; i < partitions.length; i++) for (let j = i + 1; j < partitions.length; j++) {
    assert.ok(area(polygonClipping.intersection([partitions[i].polygon], [partitions[j].polygon])) < 1e-7);
  }
  assert.ok(Math.abs(area(union) - 624.4134428077969) < 1e-6);
  for (const x of [-10, -7, -4.5, 7.5, 10]) for (const z of [-2.5, 0, 2.5]) {
    assert.equal(topAt(detail, x, z), undefined, `I courtyard ${x},${z} must remain sky-open, not a roof-box`);
  }
  const spine = partitions[1].polygon[0];
  const spineX = (Math.min(...spine.map(p => p[0])) + Math.max(...spine.map(p => p[0]))) / 2;
  const spineZ = (Math.min(...spine.map(p => p[1])) + Math.max(...spine.map(p => p[1]))) / 2;
  assert.ok(topAt(detail, spineX, spineZ, roofMeshes(detail)) > 6.0, 'Short connecting corridor is still roofed');
});

test('every roof triangle stays inside its frozen concave footprint (including ridge caps)', () => {
  for (let i = 0; i < 2; i++) {
    const {detail} = fresh(i), footprint = detail.userData.footprintInFacadeFrame;
    let projectedTriangleCount = 0, outsideArea = 0;
    for (const mesh of roofMeshes(detail)) {
      const g = mesh.geometry, p = g.attributes.position;
      const n = g.index?.count ?? p.count, at = j => g.index ? g.index.getX(j) : j;
      for (let j = 0; j < n; j += 3) {
        const tri = [0, 1, 2].map(k => [p.getX(at(j + k)), p.getZ(at(j + k))]);
        tri.push(tri[0]);
        if (ringArea(tri) < 1e-10) continue;
        projectedTriangleCount++;
        outsideArea += area(polygonClipping.difference([[tri]], [footprint]));
      }
      assert.equal(mesh.userData.footprintClipped, true);
    }
    assert.ok(projectedTriangleCount > 250, 'Curves must not be two crude colored roof triangles');
    // Float32 storage introduces sub-mm polygon slivers at exact boundary edges.
    assert.ok(outsideArea < 0.001, `Roof must be clipped; outside triangle area=${outsideArea}`);
  }
});

test('traditional grey hip roofs have curved cross-sections, turned lips and lower gate return roofs', () => {
  for (let i = 0; i < 2; i++) {
    const {detail} = fresh(i), roof = roofMeshes(detail);
    const part = detail.userData.roofPartitions[0], bounds = part.polygon[0];
    const x0 = Math.min(...bounds.map(p => p[0])), x1 = Math.max(...bounds.map(p => p[0]));
    const z0 = Math.min(...bounds.map(p => p[1])), z1 = Math.max(...bounds.map(p => p[1]));
    const x = (x0 + x1) / 2, half = Math.min(x1 - x0, z1 - z0) / 2;
    // Gate's reviewed SOUTH edge is straight in its frame; its skewed north
    // edge is clipped inward from the bbox. Main hall's NORTH edge is straight.
    const sectionAt = t => topAt(detail, x, i === 0 ? z0 + half * t : z1 - half * t, roof);
    const edge = sectionAt(0.001), lip = sectionAt(0.05);
    const low = sectionAt(0.25), mid = sectionAt(0.50), high = sectionAt(0.75);
    assert.ok(lip < edge, 'Slight turned eave is geometrically visible');
    assert.ok(high - mid > (mid - low) * 1.20, 'Pitch is concave-up, not a single triangular steel plane');
    assert.ok(high < part.ridge);
    assert.ok(topAt(detail, x, (z0 + z1) / 2, roof) > part.ridge);
    assert.equal(detail.userData.roofPartitions.length, 3);
    if (i === 1) assert.ok(topAt(detail, -8.8, 0, roof) < 4.4, 'Gate side returns stay lower than center');
  }
});

test('gate entry is a genuinely open passage with two side screens, not a painted black door', () => {
  const {detail} = fresh(1), f = detail.userData.facade;
  assert.equal(detail.userData.componentCounts.sideScreens, 2);
  assert.equal(detail.userData.componentCounts.columns, 8);
  assert.ok(f.centralEntryClearWidth >= 3.8);
  for (const x of [-1.4, 0, 1.4]) for (const y of [0.4, 1.3, 2.65]) {
    assert.equal(cast(detail, [x, y, f.passageFront + 1], [0, 0, -1],
      f.passageFront - f.passageRear + 2).length, 0, `Open south gate passage at ${x},${y}`);
  }
  for (const x of [-4.05, 4.05]) {
    assert.ok(cast(detail, [x, 1.68, f.z + 1], [0, 0, -1], 3).length > 0, 'Two actual side-screen panels');
  }
  assert.ok(cast(detail, [2.12, 1.6, f.z + 1], [0, 0, -1], 2).length > 0, 'Real front column geometry');
});

test('north porch is open before actual lattice and the pond facade faces north, not the south gate photo', () => {
  const {detail} = fresh(), f = detail.userData.facade, counts = detail.userData.componentCounts;
  assert.equal(counts.northLatticeBays, 7);
  assert.equal(counts.columns, 8);
  assert.ok(f.clearPorchDepth > 1.5);
  const bay = (f.porchRight - f.porchLeft) / 7;
  for (let i = 0; i < 7; i++) {
    const x = f.porchLeft + (i + 0.5) * bay;
    assert.equal(cast(detail, [x, 2.2, f.z - 0.1], [0, 0, 1], f.screenZ - f.z - 0.25).length, 0,
      'Between columns, the north porch is actual air before the rear screen');
    assert.ok(cast(detail, [x, 2.2, f.z - 0.1], [0, 0, 1], f.screenZ - f.z + 0.3).length > 0,
      'Recessed lattice is real geometry beyond the open colonnade');
  }
  const wood = detail.getObjectByName('real red columns screens and lattice');
  const redMesh = meshesOf(wood).find(m => m.material.name.includes('redwood'));
  assert.ok(redMesh.geometry.attributes.position.count > 6000, 'Batched real lattice members, not just a window plane');
});

test('north waterfront terrace has six genuine ascending treads, separate posts and pierced rail gaps', () => {
  const {detail} = fresh(), terrace = detail.userData.terrace;
  const group = detail.getObjectByName('north white stone landing open balustrade and stairs');
  assert.equal(terrace.steps.length, 6);
  assert.equal(terrace.posts, 26);
  assert.equal(detail.userData.componentCounts.stairs, 6);
  let previous = -Infinity;
  for (const step of terrace.steps) {
    const y = topAt(detail, step.x, step.z, [group]);
    assert.ok(Math.abs(y - step.treadY) < 1e-5, `Actual stair tread at ${step.z}`);
    assert.ok(y > previous); previous = y;
  }
  assert.ok(Math.abs(topAt(detail, 0.5, terrace.northEdge + 0.2, [group]) - 0.74) < 1e-5);
  const open = cast(detail, [0.5, 1.15, terrace.northEdge - 0.3], [0, 0, 1], 0.6, [group]);
  assert.equal(open.length, 0, 'Balustrade does not cross the stair opening');
  // Search the central band between lower/top rails: both stone posts and air must occur.
  let gaps = 0, solids = 0;
  for (let x = -11; x < -3; x += 0.13) {
    const hits = cast(detail, [x, 1.27, terrace.northEdge - 0.3], [0, 0, 1], 0.6, [group]);
    if (hits.length) solids++; else gaps++;
  }
  assert.ok(gaps > 20 && solids >= 6, `Real pierced stone railing, gaps=${gaps}, solids=${solids}`);
});

test('geometry/UV/normals are finite and textures are small deterministic procedural bytes, never photos', () => {
  for (let i = 0; i < 2; i++) {
    const {detail} = fresh(i), meshes = meshesOf(detail), mats = new Set(), textures = new Set();
    for (const mesh of meshes) {
      mats.add(mesh.material);
      for (const attribute of Object.values(mesh.geometry.attributes)) {
        assert.ok(attribute.array.every(Number.isFinite), `${mesh.name}: finite geometry attributes`);
      }
      assert.equal(mesh.geometry.attributes.color, undefined);
      assert.equal(mesh.material.vertexColors, false, 'No vertex-color two-triangle roof patches');
      assert.ok(mesh.geometry.boundingBox.min.toArray().every(Number.isFinite));
      assert.ok(Number.isFinite(mesh.geometry.boundingSphere.radius));
      for (const value of Object.values(mesh.material)) if (value?.isTexture) {
        textures.add(value);
        assert.equal(value.isDataTexture, true);
        assert.equal(value.userData.procedural, true);
        assert.ok(value.image.data instanceof Uint8Array);
        assert.equal(value.image.width, 128); assert.equal(value.image.height, 128);
        assert.equal(value.image.src, undefined);
      }
    }
    assert.equal(meshes.length, i === 0 ? 15 : 11);
    assert.equal(mats.size, 9);
    assert.equal(textures.size, 3);
    assert.deepEqual(detail.userData.materialMeshCounts, {
      materials: 9, meshes: meshes.length, textures: 3,
      triangles: meshes.reduce((n, m) => n + m.geometry.index.count / 3, 0),
    });
    assert.ok(detail.userData.materialMeshCounts.triangles < 14000);
    assert.equal(detail.userData.noReferencePhotoTextures, true);
    const another = createGongziDetail(feature(GONGZI_IDS[i]), center, footprintMetrics(feature(GONGZI_IDS[i]).geometry, center).origin);
    const nextTextures = new Set();
    for (const mesh of meshesOf(another)) for (const value of Object.values(mesh.material)) if (value?.isTexture) nextTextures.add(value);
    assert.deepEqual([...textures].map(t => hash(t.image.data)), [...nextTextures].map(t => hash(t.image.data)));
  }
});

test('visible mesh height is captured from new detail only; hidden base cannot inflate UI height', () => {
  for (let i = 0; i < 2; i++) {
    const campus = createCampusModel(subset), id = GONGZI_IDS[i], root = campus.buildings.get(id);
    const tallHiddenBase = new THREE.Mesh(new THREE.BoxGeometry(1, 80, 1), new THREE.MeshBasicMaterial());
    tallHiddenBase.position.y = 50; root.getObjectByName('base').add(tallHiddenBase);
    refineGongzi(campus, subset, id);
    const detail = detailFor(root), actual = new THREE.Box3().setFromObject(detail);
    assert.equal(root.userData.renderHeight, actual.max.y);
    assert.equal(detail.userData.dimensions.meshLocalYMax, actual.max.y);
    assert.ok(actual.max.y > (i === 0 ? 7.1 : 5.8) && actual.max.y < (i === 0 ? 7.2 : 5.9));
    assert.ok(new THREE.Box3().setFromObject(root).max.y > 80, 'This verifies the hidden-base Box3 trap');
    assert.equal(root.userData.baseRenderHeight, i === 0 ? 4 : 5);
    assert.equal(root.userData.minHeight, 0);
  }
});

test('repeated refinements deduplicate nodes, preserve addressable roots and dispose superseded owned resources', () => {
  const campus = createCampusModel(subset);
  for (const id of GONGZI_IDS) {
    const root = refineGongzi(campus, subset, id), old = detailFor(root);
    const meshes = meshesOf(old), geometries = new Set(meshes.map(m => m.geometry));
    const mats = new Set(meshes.map(m => m.material)), textures = new Set();
    for (const mat of mats) for (const value of Object.values(mat)) if (value?.isTexture) textures.add(value);
    let disposedGeometry = 0, disposedMaterial = 0, disposedTexture = 0;
    for (const g of geometries) g.addEventListener('dispose', () => disposedGeometry++);
    for (const m of mats) m.addEventListener('dispose', () => disposedMaterial++);
    for (const t of textures) t.addEventListener('dispose', () => disposedTexture++);
    assert.equal(refineGongzi(campus, subset, id), root);
    assert.equal(old.parent, null);
    assert.equal(disposedGeometry, geometries.size);
    assert.equal(disposedMaterial, mats.size);
    assert.equal(disposedTexture, textures.size);
    assert.equal(root.children.filter(c => c.userData.campusDetail).length, 1);
    assert.equal(root.children.length, 2);
    assert.equal(root.userData.featureId, id);
    let identities = 0;
    root.traverse(o => {if (o.userData.featureId) identities++;});
    assert.equal(identities, 1);
    assert.equal(campus.objects.get(id), root);
  }
  assert.equal(campus.buildings.size, 2);
});
