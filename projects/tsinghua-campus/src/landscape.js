import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import polygonClipping from 'polygon-clipping';
import evidence from '../data/landscape-evidence.json' with {type: 'json'};
import {footprintMetrics, lines, project, ringArea} from './geo.js';
import {outlineEdges} from './architecture.js';
import {createCampusTrees} from './campus-trees.js';

export const SPORTS_GROUNDS = evidence.grounds;
const primary = new Set(['osm:way:32954674', 'osm:way:32954848', 'osm:way:32954864']);
const states = new WeakMap();
const COLORS = {grass: '#5e914f', track: '#b75847', court: '#557b80', clay: '#c78d64', lines: '#faf4d9'};

function shapeGeometry(polygons, height) {
  const pieces = polygons.map(rings => {
    const path = ring => ring.map(([x, z]) => new THREE.Vector2(x, -z));
    const shape = new THREE.Shape(path(rings[0]));
    for (const ring of rings.slice(1)) shape.holes.push(new THREE.Path(path(ring)));
    const geometry = new THREE.ShapeGeometry(shape);
    geometry.rotateX(-Math.PI / 2); geometry.translate(0, height, 0);
    return geometry;
  });
  const merged = mergeGeometries(pieces);
  pieces.forEach(piece => piece.dispose());
  return merged;
}

function localFrame(metrics) {
  const edge = metrics.projected.flatMap(polygon => outlineEdges(polygon[0].slice(0, -1)))
    .sort((a, b) => b.length - a.length)[0];
  const u = edge.tangent, v = [-u[1], u[0]], origin = metrics.origin;
  const points = metrics.projected.flatMap(polygon => polygon[0]).map(([x, z]) => [
    (x - origin[0]) * u[0] + (z - origin[1]) * u[1], (x - origin[0]) * v[0] + (z - origin[1]) * v[1]]);
  const min = [0, 1].map(i => Math.min(...points.map(point => point[i])));
  const max = [0, 1].map(i => Math.max(...points.map(point => point[i])));
  const center = min.map((value, i) => (value + max[i]) / 2);
  return {width: max[0] - min[0], depth: max[1] - min[1],
    world: (x, z) => [origin[0] + u[0] * (x + center[0]) + v[0] * (z + center[1]),
      origin[1] + u[1] * (x + center[0]) + v[1] * (z + center[1])]};
}

function inside(point, polygon) {
  const inRing = ring => {
    let result = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[i], b = ring[j];
      if ((a[1] > point[1]) !== (b[1] > point[1]) &&
          point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) result = !result;
    }
    return result;
  };
  return inRing(polygon[0]) && !polygon.slice(1).some(inRing);
}

function segmentDistance(point, a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1], length = dx * dx + dz * dz;
  const t = length ? Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dz) / length)) : 0;
  return Math.hypot(point[0] - a[0] - t * dx, point[1] - a[1] - t * dz);
}

export function treePlacements(data) {
  const polygonsByKind = kind => data.features.filter(feature => feature.properties.kind === kind)
    .flatMap(feature => footprintMetrics(feature.geometry, data.metadata.center).projected);
  const buildings = polygonsByKind('building'), green = polygonsByKind('green');
  const water = data.features.filter(feature => feature.properties.kind === 'water' && feature.geometry.type.includes('Polygon'))
    .flatMap(feature => footprintMetrics(feature.geometry, data.metadata.center).projected);
  const sports = SPORTS_GROUNDS.flatMap(source => footprintMetrics(source.geometry, data.metadata.center).projected);
  const roads = data.features.filter(feature => feature.properties.kind === 'road').flatMap(feature => feature.geometry.type.includes('LineString')
    ? lines(feature.geometry).map(line => line.map(point => project(point, data.metadata.center))) : []);
  const blocked = [...buildings, ...water, ...sports];
  const safe = point => !blocked.some(polygon => inside(point, polygon) || polygon.some(ring =>
    ring.slice(1).some((b, i) => segmentDistance(point, ring[i], b) < 3.5)))
    && !roads.some(line => line.slice(1).some((b, i) => segmentDistance(point, line[i], b) < 7));
  const mapped = evidence.trees.map(tree => ({id: tree.id, position: project(tree.coordinates, data.metadata.center), basis: 'mapped-tree'}));
  const accepted = mapped.filter(tree => safe(tree.position)), trees = [...accepted];
  let attempts = 0;
  for (const [index, polygon] of green.entries()) {
    const xs = polygon[0].map(point => point[0]), zs = polygon[0].map(point => point[1]);
    for (let x = Math.min(...xs) + 7; x < Math.max(...xs) - 5; x += 16) {
      for (let z = Math.min(...zs) + 7; z < Math.max(...zs) - 5; z += 16) {
        const seed = Math.sin((x + index * 17) * 12.9898 + z * 78.233) * 43758.5453;
        const position = [x + (seed - Math.floor(seed) - .5) * 5, z + Math.sin(seed) * 2.5];
        attempts++;
        if (trees.length >= 650 || !inside(position, polygon) || !safe(position) ||
            trees.some(tree => Math.hypot(tree.position[0] - position[0], tree.position[1] - position[1]) < 9)) continue;
        trees.push({id: `illustrative:${index}:${attempts}`, position, basis: 'illustrative-green-area-planting'});
      }
    }
  }
  return {trees, mappedSourceCount: mapped.length, excludedMappedCount: mapped.length - accepted.length,
    mappedCount: accepted.length, illustrativeCount: trees.length - accepted.length};
}

export function* buildCampusLandscape(campus, data) {
  if (states.has(campus)) throw new Error('Dispose the existing landscape before rebuilding.');
  const sports = new THREE.Group(), trees = new THREE.Group();
  sports.name = 'Mapped sports grounds'; trees.name = 'Mapped and explicitly illustrative campus trees';
  campus.layers.sports = sports; campus.layers.trees = trees; campus.group.add(sports, trees);
  const materials = Object.fromEntries(Object.entries(COLORS).map(([name, color], index) => [name,
    new THREE.MeshStandardMaterial({name: `Original procedural sports ${name}`, color, roughness: .94,
      side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -24 - index * 4})]));
  const grounds = new Map(), pieces = new Map(Object.keys(materials).map(key => [key, []]));
  const addSurface = (key, polygons, height) => {
    if (polygons.length) pieces.get(key).push(shapeGeometry(polygons, height));
  };
  const buildingPolygons = data.features.filter(feature => feature.properties.kind === 'building')
    .flatMap(feature => footprintMetrics(feature.geometry, data.metadata.center).projected);
  const sportsMetrics = new Map(SPORTS_GROUNDS.map(source => [source.id, footprintMetrics(source.geometry, data.metadata.center)]));
  const enclosedBy = (source, outer) => {
    const inner = sportsMetrics.get(source.id);
    return polygonClipping.intersection(inner.projected, outer).reduce((sum, polygon) =>
      sum + ringArea(polygon[0]) - polygon.slice(1).reduce((s, ring) => s + ringArea(ring), 0), 0) > inner.area * .8;
  };
  for (const source of SPORTS_GROUNDS) {
    const metrics = sportsMetrics.get(source.id);
    const footprint = polygonClipping.difference(metrics.projected, buildingPolygons);
    if (!footprint.length) continue;
    const frame = localFrame(metrics);
    const athletics = primary.has(source.id);
    const key = athletics || source.sport?.includes('soccer') ? 'grass'
      : source.leisure === 'track' ? 'track' : source.sport === 'baseball' ? 'clay' : 'court';
    if (source.leisure === 'track') {
      const inset = footprint.map(polygon => polygon.map(ring => ring.map(([x, z]) => [
        metrics.origin[0] + (x - metrics.origin[0]) * .91, metrics.origin[1] + (z - metrics.origin[1]) * .91])));
      addSurface('track', polygonClipping.difference(footprint, inset), .3);
    } else addSurface(key, footprint, .28);
    const linePolygons = [];
    const line = (points, width = .18, world = false) => {
      for (let i = 1; i < points.length; i++) {
        const a = world ? points[i - 1] : frame.world(...points[i - 1]);
        const b = world ? points[i] : frame.world(...points[i]);
        const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (length < 1e-6) continue;
        const nx = -(b[1] - a[1]) / length * width / 2, nz = (b[0] - a[0]) / length * width / 2;
        const ring = [[a[0] + nx, a[1] + nz], [b[0] + nx, b[1] + nz],
          [b[0] - nx, b[1] - nz], [a[0] - nx, a[1] - nz]];
        linePolygons.push([[...ring, ring[0]]]);
      }
    };
    const rectangle = (w, d) => [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2], [-w / 2, -d / 2]];
    if (athletics) {
      const alongX = frame.width > frame.depth, length = Math.max(frame.width, frame.depth) * .9;
      const radius = Math.min(frame.width, frame.depth) * .43, straight = length / 2 - radius;
      const capsule = r => {
        const points = [];
        for (let i = 0; i <= 32; i++) {
          const angle = -Math.PI / 2 + i * Math.PI / 32;
          points.push([straight + Math.cos(angle) * r, Math.sin(angle) * r]);
        }
        for (let i = 0; i <= 32; i++) {
          const angle = Math.PI / 2 + i * Math.PI / 32;
          points.push([-straight + Math.cos(angle) * r, Math.sin(angle) * r]);
        }
        points.push(points[0]);
        return points.map(([x, z]) => alongX ? [x, z] : [z, x]);
      };
      const mappedTrack = SPORTS_GROUNDS.find(candidate => candidate.leisure === 'track' && enclosedBy(candidate, footprint));
      if (mappedTrack) {
        const track = sportsMetrics.get(mappedTrack.id);
        for (let lane = 0; lane <= 6; lane++) line(track.projected[0][0].map(([x, z]) => [
          track.origin[0] + (x - track.origin[0]) * (1 - lane * .09 / 6),
          track.origin[1] + (z - track.origin[1]) * (1 - lane * .09 / 6)]), .18, true);
      } else {
        const outer = capsule(radius).map(point => frame.world(...point));
        const inner = capsule(radius - 8).map(point => frame.world(...point)).reverse();
        addSurface('track', polygonClipping.intersection(footprint, [[outer, inner]]), .3);
        for (let lane = 0; lane <= 6; lane++) line(capsule(radius - lane * 8 / 6), .18);
      }
      const mappedField = SPORTS_GROUNDS.some(candidate => candidate.sport === 'soccer' && enclosedBy(candidate, footprint));
      if (!mappedField) {
        const w = alongX ? length * .63 : (radius - 10) * 1.65;
        const d = alongX ? (radius - 10) * 1.65 : length * .63;
        line(rectangle(w, d)); line(w > d ? [[0, -d / 2], [0, d / 2]] : [[-w / 2, 0], [w / 2, 0]]);
        line(Array.from({length: 49}, (_, i) => [Math.cos(i * Math.PI / 24) * 8, Math.sin(i * Math.PI / 24) * 8]));
      }
    } else if (['tennis', 'basketball', 'volleyball', 'soccer', 'futsal', 'handball'].includes(source.sport)) {
      const football = ['soccer', 'futsal'].includes(source.sport);
      const w = frame.width * (football ? .94 : .78), d = frame.depth * (football ? .94 : .78);
      line(rectangle(w, d)); line(w > d ? [[0, -d / 2], [0, d / 2]] : [[-w / 2, 0], [w / 2, 0]]);
      if (['basketball', 'soccer', 'futsal'].includes(source.sport)) {
        const r = Math.min(w, d) * .12;
        line(Array.from({length: 33}, (_, i) => [Math.cos(i * Math.PI / 16) * r, Math.sin(i * Math.PI / 16) * r]));
      }
      if (football) for (const sign of [-1, 1]) {
        if (w > d) line([[sign * w / 2, -d * .3], [sign * w * .34, -d * .3], [sign * w * .34, d * .3], [sign * w / 2, d * .3]]);
        else line([[-w * .3, sign * d / 2], [-w * .3, sign * d * .34], [w * .3, sign * d * .34], [w * .3, sign * d / 2]]);
      }
    }
    if (linePolygons.length) addSurface('lines', polygonClipping.intersection(
      polygonClipping.union(...linePolygons), footprint), .32);
    grounds.set(source.id, {...source, bounds: metrics.bounds, origin: metrics.origin,
      estimatedMarkings: true, limitations: '位置与外边界来自冻结OSM；跑道宽度、道数、场内标线和颜色为展示估算，非场地测绘。'});
    yield source.id;
  }
  for (const [key, geometries] of pieces) {
    if (!geometries.length) continue;
    const mesh = new THREE.Mesh(mergeGeometries(geometries), materials[key]);
    mesh.name = `Mapped sports surfaces: ${key}`; mesh.receiveShadow = true; mesh.renderOrder = key === 'lines' ? 8 : key === 'track' ? 7 : 6;
    sports.add(mesh); geometries.forEach(geometry => geometry.dispose());
  }
  const placements = treePlacements(data);
  const treeRenderer = createCampusTrees(trees, placements.trees);
  Object.assign(trees.userData, placements, {limitations: evidence.limitations});
  campus.updateTreeLOD = (camera, mobile) => treeRenderer.update(camera, mobile);
  sports.userData = {source: evidence.source, limitations: evidence.limitations, grounds: [...grounds.values()]};
  campus.sports = grounds;
  states.set(campus, {sports, trees, treeRenderer, materials: [...Object.values(materials), ...treeRenderer.materials]});
  return {grounds: grounds.size, trees: placements.trees.length, mappedTrees: placements.mappedCount,
    illustrativeTrees: placements.illustrativeCount, excludedMappedTrees: placements.excludedMappedCount};
}

export function applyCampusLandscape(campus, data) {
  const stages = buildCampusLandscape(campus, data);
  let next = stages.next();
  while (!next.done) next = stages.next();
  return next.value;
}

export function disposeCampusLandscape(campus) {
  const state = states.get(campus);
  if (!state) return;
  for (const group of [state.sports, state.trees]) {
    group.traverse(object => {if (object.geometry) object.geometry.dispose(); if (object.isInstancedMesh) object.dispose();});
    group.removeFromParent();
  }
  state.materials.forEach(material => material.dispose());
  state.treeRenderer.extraGeometry.dispose();
  delete campus.layers.sports; delete campus.layers.trees; delete campus.sports; delete campus.updateTreeLOD;
  states.delete(campus);
}
