import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import evidence from '../data/landscape-evidence.json' with {type: 'json'};
import {footprintMetrics, lines, pointInPolygon, project, roadProfile, segmentDistance} from './geo.js';
import {createQingmingWillow} from './qingming-reuse.js';

export const SCENERY_REFERENCE = {
  url: 'https://github.com/mike007jd/qingming',
  revision: '81f5c0a6e78e67388cc8a978064b88c53621949e',
  basis: 'MIT reuse: original river microtexture, willow Auto1 mesh and baked leaf texture, adapted wave and breeze code. BubuAi 2026; vendor/qingming/LICENSE.txt.',
};
export const SCENERY_LIMITATIONS = '人物、单车、长椅、路灯和石岸为原创示意；垂柳复用Qingming模型。沿冻结道路／水边布置，非实测位置、人数、植栽或河岸工程。';
const limits = {people: 240, bicycles: 70, benches: 65, lamps: 100, banks: 2600, reeds: 240, willows: 16};
const random = value => {
  const n = Math.sin(value * 127.1 + 311.7) * 43758.5453;
  return n - Math.floor(n);
};
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
function boundaryDistance(point, polygon) {
  let minimum = Infinity;
  for (const ring of polygon) for (let i = 1; i < ring.length; i++) {
    minimum = Math.min(minimum, segmentDistance(point, ring[i - 1], ring[i]));
  }
  return minimum;
}
function polygonBounds(polygon) {
  const xs = polygon[0].map(p => p[0]), zs = polygon[0].map(p => p[1]);
  return {polygon, bounds: [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)]};
}
const nearBounds = ([x, z], [x0, z0, x1, z1], radius) =>
  x >= x0 - radius && x <= x1 + radius && z >= z0 - radius && z <= z1 + radius;
function spatialLookup(records, padding) {
  const cells = new Map(), cellSize = 64;
  for (const record of records) {
    const [x0, z0, x1, z1] = record.bounds;
    for (let x = Math.floor((x0 - padding) / cellSize); x <= Math.floor((x1 + padding) / cellSize); x++) {
      for (let z = Math.floor((z0 - padding) / cellSize); z <= Math.floor((z1 + padding) / cellSize); z++) {
        const key = `${x},${z}`;
        if (!cells.has(key)) cells.set(key, []);
        cells.get(key).push(record);
      }
    }
  }
  return ([x, z]) => cells.get(`${Math.floor(x / cellSize)},${Math.floor(z / cellSize)}`) || [];
}
const segmentBounds = (a, b) => [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])];

export function sceneryPlacements(data, trees = []) {
  const polygonFeatures = data.features.filter(feature => feature.geometry.type.includes('Polygon'))
    .map(feature => ({id: feature.id, kind: feature.properties.kind, ...footprintMetrics(feature.geometry, data.metadata.center)}));
  const byKind = kind => polygonFeatures.filter(feature => feature.kind === kind).flatMap(feature => feature.projected);
  const water = byKind('water').map(polygonBounds), campus = byKind('campus');
  const blocked = [...byKind('building'), ...evidence.grounds.flatMap(source =>
    footprintMetrics(source.geometry, data.metadata.center).projected)].map(polygonBounds);
  const roads = data.features.filter(feature => feature.properties.kind === 'road').flatMap(feature => {
    const profile = roadProfile(feature);
    if (profile.brunnel === 'tunnel' || profile.roadClass.includes('construction')) return [];
    return lines(feature.geometry).map(line => ({sourceId: feature.id, ...profile,
      points: line.map(point => project(point, data.metadata.center))}));
  });
  const wetLines = data.features.filter(feature => feature.properties.kind === 'water' && feature.geometry.type.includes('LineString'))
    .filter(feature => roadProfile(feature).brunnel !== 'tunnel')
    .flatMap(feature => lines(feature.geometry).map(line => line.map(point => project(point, data.metadata.center))));
  const nearbyBlocked = spatialLookup(blocked, 5), nearbyWater = spatialLookup(water, 4);
  const nearbyRoads = spatialLookup(roads.flatMap(road => road.points.slice(1).map((b, i) =>
    ({a: road.points[i], b, width: road.width, bounds: segmentBounds(road.points[i], b)}))), 9);
  const nearbyWetLines = spatialLookup(wetLines.flatMap(line => line.slice(1).map((b, i) =>
    ({a: line[i], b, bounds: segmentBounds(line[i], b)}))), 5);
  const nearbyTrees = spatialLookup(trees.map(tree => ({...tree, bounds: [...tree.position, ...tree.position]})), 5);
  const clearLand = (point, radius) => campus.some(polygon => pointInPolygon(point, polygon))
    && !nearbyBlocked(point).some(({polygon, bounds}) => nearBounds(point, bounds, radius + 1.2)
      && (pointInPolygon(point, polygon) || boundaryDistance(point, polygon) < radius + 1.2))
    && !nearbyWater(point).some(({polygon, bounds}) => nearBounds(point, bounds, radius)
      && (pointInPolygon(point, polygon) || boundaryDistance(point, polygon) < radius))
    && !nearbyWetLines(point).some(({a, b}) => segmentDistance(point, a, b) < 1.5 + radius)
    && !nearbyTrees(point).some(tree => distance(point, tree.position) < radius + .8);
  const clearRoad = (point, radius) => !nearbyRoads(point).some(({a, b, width}) =>
    segmentDistance(point, a, b) < width / 2 + radius);
  const result = Object.fromEntries(Object.keys(limits).map(key => [key, []]));
  const occupied = [];
  let serial = 0;
  for (const road of roads) {
    if (!['path', 'pedestrian', 'service', 'minor'].includes(road.roadClass) || road.brunnel === 'bridge') continue;
    for (let i = 1; i < road.points.length; i++) {
      const a = road.points[i - 1], b = road.points[i], length = distance(a, b);
      if (length < 8) continue;
      const tx = (b[0] - a[0]) / length, tz = (b[1] - a[1]) / length;
      for (let s = 5; s < length - 3; s += 11) {
        const seed = serial++, center = [a[0] + tx * s, a[1] + tz * s], side = seed % 2 ? 1 : -1;
        const key = seed % 7 < 4 ? 'people' : ['benches', 'bicycles', 'lamps'][seed % 7 - 4];
        const radius = {people: .45, bicycles: 1.1, benches: 1.05, lamps: .35}[key];
        const offset = key === 'people' ? road.width * .26 * side : (road.width / 2 + radius + .5) * side;
        const position = [center[0] - tz * offset, center[1] + tx * offset];
        if (!clearLand(position, radius) || (key !== 'people' && !clearRoad(position, radius)) ||
            occupied.some(item => distance(item.position, position) < item.radius + radius + .7)) continue;
        occupied.push({position, radius});
        result[key].push({position, sourceId: road.sourceId, height: key === 'people' ? road.height : .07,
          yaw: key === 'people' || key === 'bicycles' ? Math.atan2(tx * side, tz * side) : Math.atan2(tz * side, -tx * side),
          scale: key === 'people' ? .94 + random(seed) * .12 : 1, seed, basis: 'illustrative-mapped-road'});
      }
    }
  }
  for (const key of ['people', 'benches', 'bicycles', 'lamps']) {
    result[key].sort((a, b) => random(a.seed + 92) - random(b.seed + 92));
    result[key] = result[key].slice(0, key === 'people' ? 180 : limits[key]);
  }
  for (const person of result.people.slice(0, 60)) {
    const position = [person.position[0] + Math.sin(person.yaw) * 2.4, person.position[1] + Math.cos(person.yaw) * 2.4];
    if (clearLand(position, .45) && !occupied.some(item => distance(item.position, position) < item.radius + .45 + .7)
      && roads.some(road => road.sourceId === person.sourceId &&
      road.points.slice(1).some((b, i) => segmentDistance(position, road.points[i], b) < road.width / 2 - .45))) {
      result.people.push({...person, position, seed: person.seed + 10001, scale: person.scale * .97});
      occupied.push({position, radius: .45});
    }
  }
  for (const feature of polygonFeatures.filter(feature => feature.kind === 'water')) {
    for (const polygon of feature.projected) for (const ring of polygon) for (let i = 1; i < ring.length; i++) {
      const a = ring[i - 1], b = ring[i], length = distance(a, b);
      if (length < .6) continue;
      const tx = (b[0] - a[0]) / length, tz = (b[1] - a[1]) / length;
      const middle = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const side = pointInPolygon([middle[0] - tz * .15, middle[1] + tx * .15], polygon) ? -1 : 1;
      const count = Math.ceil(length / 2.4), step = length / count;
      for (let j = 0; j < count; j++) {
        const s = (j + .5) * step, seed = serial++;
        const position = [a[0] + tx * s - tz * side * .4, a[1] + tz * s + tx * side * .4];
        const ends = [-1, 1].map(sign => [position[0] + tx * step * .5 * sign, position[1] + tz * step * .5 * sign]);
        if (result.banks.length >= limits.banks || ![position, ...ends].every(point => clearLand(point, .18) && clearRoad(point, .6))) continue;
        result.banks.push({position, height: .07, yaw: Math.atan2(-tz, tx), scale: 1, length: step - .035,
          sourceId: feature.id, seed, basis: 'illustrative-mapped-water-bank'});
        const reedPosition = [position[0] - tz * side * .7, position[1] + tx * side * .7];
        if (seed % 7 === 0 && result.reeds.length < limits.reeds && clearLand(reedPosition, .6) && clearRoad(reedPosition, .8)) {
          result.reeds.push({position: reedPosition, height: .07, yaw: seed, scale: .8 + random(seed) * .5,
            sourceId: feature.id, seed, basis: 'illustrative-riparian-planting'});
        }
        const willowPosition = [position[0] - tz * side * 3.8, position[1] + tx * side * 3.8];
        if (result.willows.length < limits.willows && clearLand(willowPosition, 3.3) && clearRoad(willowPosition, 3.3) &&
            !result.willows.some(tree => distance(tree.position, willowPosition) < 24)) {
          result.willows.push({position: willowPosition, height: .07, yaw: seed, scale: .8,
            sourceId: feature.id, seed, basis: 'illustrative-reused-qingming-willow'});
        }
      }
    }
  }
  return result;
}

function prototype(key, variant = 0) {
  const parts = [], up = new THREE.Vector3(0, 1, 0);
  const add = (geometry, color, position = [0, 0, 0], rotation = [0, 0, 0]) => {
    geometry.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...position),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)), new THREE.Vector3(1, 1, 1)));
    const tint = new THREE.Color(color), colors = new Float32Array(geometry.attributes.position.count * 3);
    for (let i = 0; i < colors.length; i += 3) tint.toArray(colors, i);
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.deleteAttribute('uv');
    parts.push(geometry);
  };
  const box = (size, position, color, rotation) => add(new THREE.BoxGeometry(...size), color, position, rotation);
  const sphere = (size, position, color) => {
    const geometry = new THREE.SphereGeometry(1, 8, 6); geometry.scale(...size); add(geometry, color, position);
  };
  const tube = (a, b, radius, color) => {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), direction = end.clone().sub(start);
    const geometry = new THREE.CylinderGeometry(radius * .85, radius, direction.length(), 6);
    geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up, direction.normalize()));
    add(geometry, color, start.add(end).multiplyScalar(.5).toArray());
  };
  const iron = '#37464a', wood = '#99704b', pale = '#bdb5a0', rubber = '#303635';
  if (key === 'people') {
    const skin = ['#d3a782', '#bc8965', '#e1b695'][variant], shirt = ['#477c8e', '#a65344', '#e0cf9e'][variant];
    const trouser = ['#3d4c61', '#435044', '#626c7c'][variant], stride = variant === 1 ? -.13 : .14;
    sphere([.135, .17, .13], [0, 1.58, .015], skin);
    sphere([.139, .095, .135], [0, 1.68, -.01], '#343331');
    tube([0, 1.35, 0], [0, 1.46, 0], .065, skin);
    const torso = new THREE.CylinderGeometry(.16, .145, .48, 8); torso.scale(1, 1, .66);
    add(torso, shirt, [0, 1.16, 0]);
    box([.27, .16, .18], [0, .87, 0], trouser);
    box([.22, .29, .12], [0, 1.18, -.14], ['#bc8d51', '#576c7b', '#a65b48'][variant]);
    for (const sign of [-1, 1]) {
      tube([sign * .085, .88, 0], [sign * .085, .47, stride * sign], .072, trouser);
      tube([sign * .085, .47, stride * sign], [sign * .09, .11, -stride * sign], .054, trouser);
      box([.12, .09, .23], [sign * .09, .055, .045 - stride * sign], '#e2ded1');
      tube([sign * .18, 1.36, 0], [sign * .22, 1.08, -stride * sign], .056, shirt);
      tube([sign * .22, 1.08, -stride * sign], [sign * .2, .86, stride * sign], .04, skin);
      sphere([.043, .065, .04], [sign * .2, .84, stride * sign], skin);
    }
  } else if (key === 'bicycles') {
    for (const z of [-.54, .54]) {
      add(new THREE.TorusGeometry(.31, .035, 5, 16), rubber, [0, .34, z], [0, Math.PI / 2, 0]);
      add(new THREE.TorusGeometry(.275, .014, 4, 16), pale, [0, .34, z], [0, Math.PI / 2, 0]);
      for (let i = 0; i < 6; i++) {
        const a = i * Math.PI / 3;
        tube([0, .34, z], [0, .34 + Math.sin(a) * .27, z + Math.cos(a) * .27], .008, pale);
      }
    }
    const rear = [0, .34, -.54], pedal = [0, .34, -.06], seat = [0, .82, -.2], fork = [0, .81, .38], front = [0, .34, .54];
    for (const [a, b] of [[rear, pedal], [rear, seat], [pedal, seat], [seat, fork], [pedal, fork], [fork, front]]) tube(a, b, .026, '#748c84');
    tube(seat, [0, .95, -.2], .025, iron); box([.18, .055, .25], [0, .96, -.2], rubber);
    tube(fork, [0, 1.02, .38], .023, iron); tube([-.24, 1.02, .38], [.24, 1.02, .38], .023, iron);
    tube([0, .4, -.1], [.2, .03, -.2], .018, iron);
  } else if (key === 'benches') {
    for (let i = 0; i < 5; i++) box([1.8, .055, .075], [0, .47, -.16 + i * .085], wood);
    for (let i = 0; i < 3; i++) box([1.8, .075, .05], [0, .66 + i * .1, -.21], wood);
    for (const x of [-.64, .64]) {
      box([.055, .82, .055], [x, .41, -.23], iron);
      box([.065, .44, .065], [x, .22, .18], iron);
      box([.08, .045, .48], [x, .42, -.02], iron);
    }
  } else if (key === 'lamps') {
    tube([0, 0, 0], [0, 3.65, 0], .045, iron);
    tube([0, 3.58, 0], [0, 3.58, .5], .035, iron);
    box([.3, .075, .55], [0, 3.57, .45], iron);
    box([.25, .02, .47], [0, 3.52, .45], '#f4e3b1');
    box([.18, .13, .18], [0, .065, 0], pale);
  } else if (key === 'banks') {
    box([1, .16, .4], [0, .08, 0], '#777b68');
    box([1, .11, .46], [0, .215, 0], pale);
  } else if (key === 'reeds') {
    for (let i = 0; i < 9; i++) {
      const angle = i * 2.4, height = .55 + random(i) * .65, x = Math.sin(angle), z = Math.cos(angle);
      const vertices = [0, 0, 0, x * .25 - z * .035, height * .6, z * .25 + x * .035,
        x * .42, height, z * .42, 0, 0, 0, x * .42, height, z * .42,
        x * .25 + z * .035, height * .6, z * .25 - x * .035];
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      geometry.setIndex([0, 1, 2, 3, 4, 5]); geometry.computeVertexNormals();
      add(geometry, i % 3 ? '#6d8050' : '#9a965a');
    }
  } else throw new Error(`Unknown scenery prototype: ${key}`);
  const merged = mergeGeometries(parts);
  parts.forEach(part => part.dispose());
  if (!merged) throw new Error(`Cannot merge scenery prototype: ${key}`);
  merged.computeBoundingSphere();
  return merged;
}

export function createCampusScenery(campus, data, trees) {
  const placements = sceneryPlacements(data, trees), batches = [];
  const counts = Object.fromEntries(Object.entries(placements).map(([key, entries]) => [key, entries.length]));
  const material = new THREE.MeshStandardMaterial({name: 'Original campus-life vertex palette',
    vertexColors: true, roughness: .82, metalness: 0, side: THREE.DoubleSide});
  for (const name of ['streetscape', 'riverbanks']) {
    const group = new THREE.Group(); group.name = name;
    group.userData = {limitations: SCENERY_LIMITATIONS, reference: SCENERY_REFERENCE};
    campus.layers[name] = group; campus.group.add(group);
  }
  const dummy = new THREE.Object3D(), willow = createQingmingWillow();
  for (const [key, entries] of Object.entries(placements)) {
    for (let variant = 0; variant < (key === 'people' ? 3 : key === 'willows' ? willow.parts.length : 1); variant++) {
      const items = entries.filter(entry => key !== 'people' || entry.seed % 3 === variant);
      const source = key === 'willows' ? willow.parts[variant] : null;
      const mesh = new THREE.InstancedMesh(source?.geometry || prototype(key, variant), source?.material || material, Math.max(1, items.length));
      if (source) mesh.customDepthMaterial = source.depthMaterial;
      mesh.name = `Illustrative campus ${key} ${variant}`;
      mesh.userData = {sceneryKind: key, illustrative: true};
      mesh.count = 0; mesh.frustumCulled = false; mesh.receiveShadow = true;
      const parent = ['banks', 'reeds', 'willows'].includes(key) ? 'riverbanks' : 'streetscape';
      campus.layers[parent].add(mesh);
      const matrices = items.map(entry => {
        dummy.position.set(entry.position[0], entry.height, entry.position[1]); dummy.rotation.set(0, entry.yaw, 0);
        dummy.scale.set(entry.length ?? entry.scale, entry.scale, entry.scale); dummy.updateMatrix();
        return dummy.matrix.clone();
      });
      batches.push({mesh, items, matrices, key, parent, visible: []});
    }
  }
  const sphere = new THREE.Sphere(), frustum = new THREE.Frustum(), vp = new THREE.Matrix4();
  const views = {
    riverside: {center: [-585, 1, 220], size: [24, 6, 18], direction: [.7, .3, 1]},
    'campus-life': {center: [-340, .3, 420], size: [10, 3, 8], direction: [.15, .12, 1]},
  };
  const streetScore = entry => ['benches', 'bicycles', 'people'].reduce((sum, key) =>
    sum + placements[key].filter(other => distance(other.position, entry.position) < 22).length * (key === 'people' ? 1 : 3), 0)
    - distance(entry.position, [-340, 420]) / 1200;
  const pairs = placements.people.filter(entry => placements.people.some(other =>
    other !== entry && distance(other.position, entry.position) < 3));
  const nearest = (pairs.length ? pairs : placements.people).reduce((best, entry) =>
    !best || streetScore(entry) > streetScore(best) ? entry : best, null);
  if (nearest) views['campus-life'].center = [nearest.position[0], 1, nearest.position[1]];
  return {placements, counts, views,
    setTime(time) {
      if (!Number.isFinite(time) || time < 0) throw new RangeError('Scenery time must be finite and non-negative.');
      willow.setTime(time);
    },
    update(camera, mobile) {
      camera.updateMatrixWorld(true);
      vp.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); frustum.setFromProjectionMatrix(vp);
      for (const batch of batches) {
        const {key, mesh, items, parent} = batch;
        const far = key === 'banks' ? 550 : key === 'willows' ? 450 : key === 'reeds' ? 220 : key === 'lamps' ? 220 : 160;
        const cap = key === 'banks' ? 1000 : key === 'people' ? 24 : key === 'willows' ? 12 : 80;
        const enabled = camera.isPerspectiveCamera && campus.layers[parent].visible
          && campus.layers[parent === 'riverbanks' ? 'water' : 'road'].visible;
        const candidates = enabled ? items.map((item, index) => {
          sphere.center.set(item.position[0], item.height + (key === 'willows' ? 3.3 : key === 'lamps' ? 1.8 : .9), item.position[1]);
          sphere.radius = key === 'willows' ? 5 : key === 'lamps' ? 2 : 1.8;
          return {index, distance: sphere.center.distanceTo(camera.position), visible: frustum.intersectsSphere(sphere)};
        }).filter(item => item.visible && item.distance < far * (mobile ? .75 : 1))
          .sort((a, b) => a.distance - b.distance).slice(0, mobile ? Math.ceil(cap / 2) : cap).map(item => item.index) : [];
        if (candidates.length !== batch.visible.length || candidates.some((index, i) => index !== batch.visible[i])) {
          candidates.forEach((index, i) => mesh.setMatrixAt(i, batch.matrices[index]));
          mesh.count = candidates.length; mesh.instanceMatrix.needsUpdate = true; batch.visible = candidates;
        }
        mesh.castShadow = !mobile && key !== 'reeds' && key !== 'banks';
      }
    },
    stats: () => ({counts, visible: Object.fromEntries(Object.keys(counts).map(key =>
      [key, batches.filter(batch => batch.key === key).reduce((sum, batch) => sum + batch.mesh.count, 0) / (key === 'willows' ? willow.parts.length : 1)])),
    drawCalls: batches.filter(batch => batch.mesh.count > 0).length}),
    dispose() {
      batches.forEach(({mesh}) => {mesh.geometry.dispose(); mesh.dispose();});
      material.dispose(); willow.dispose();
      for (const name of ['streetscape', 'riverbanks']) {campus.layers[name].removeFromParent(); delete campus.layers[name];}
    }};
}
