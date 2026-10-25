import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {footprintMetrics, lines, polygons, project} from './geo.js';
import {createEstimatedFacade} from './surface-materials.js';

function shapeFromRings(rings, origin = [0, 0]) {
  const path = ring => ring.map(([x, z]) => new THREE.Vector2(x - origin[0], -z + origin[1]));
  const shape = new THREE.Shape(path(rings[0]));
  for (const ring of rings.slice(1)) shape.holes.push(new THREE.Path(path(ring)));
  return shape;
}

function flatGeometry(geometry, center, height) {
  const pieces = polygons(geometry).map(polygon => {
    const rings = polygon.map(ring => ring.map(point => project(point, center)));
    const piece = new THREE.ShapeGeometry(shapeFromRings(rings));
    piece.rotateX(-Math.PI / 2);
    piece.translate(0, height, 0);
    return piece;
  });
  const merged = mergeGeometries(pieces);
  pieces.forEach(piece => piece.dispose());
  return merged;
}

function roadGeometry(feature, center) {
  const p = feature.properties;
  const roadClass = p.class || p.upstreamProperties?.class || p.raw?.class || p.sourceProperties?.class || '';
  const width = feature.properties.kind === 'water' ? 3
    : ['path', 'pedestrian', 'track'].includes(roadClass) ? 2.5
      : ['primary', 'secondary', 'tertiary'].includes(roadClass) ? 9 : 5;
  const vertices = [];
  const bridge = (p.brunnel || p.upstreamProperties?.brunnel) === 'bridge';
  const height = bridge ? 1.1 : feature.properties.kind === 'water' ? 0.11 : 0.24;
  for (const coordinates of lines(feature.geometry)) {
    const points = coordinates.map(point => project(point, center));
    for (let i = 1; i < points.length; i++) {
      const [ax, az] = points[i - 1], [bx, bz] = points[i];
      const length = Math.hypot(bx - ax, bz - az);
      if (length < 0.01) continue;
      const nx = -(bz - az) / length * width / 2, nz = (bx - ax) / length * width / 2;
      const a = [ax + nx, height, az + nz], b = [ax - nx, height, az - nz];
      const c = [bx + nx, height, bz + nz], d = [bx - nx, height, bz - nz];
      vertices.push(...a, ...c, ...b, ...b, ...c, ...d);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.computeVertexNormals();
  return geometry;
}

export function createCampusModel(data) {
  if (data.type !== 'FeatureCollection' || !data.metadata?.center || !data.features?.length) {
    throw new Error('A frozen campus FeatureCollection with projection metadata is required.');
  }
  const center = data.metadata.center;
  const group = new THREE.Group();
  group.name = 'Tsinghua campus - OpenFreeMap base model';
  group.userData = {
    centerWGS84: center, units: 'meters', axes: 'X east, Y up, Z south',
    projection: 'Local equirectangular at center latitude; flat ground, no DEM',
    source: data.metadata, levelOfDetail: 'footprint extrusions, not surveyed architecture',
  };
  const layers = {};
  for (const name of ['campus', 'green', 'water', 'road', 'building', 'landmark']) {
    layers[name] = new THREE.Group();
    layers[name].name = name;
    group.add(layers[name]);
  }
  const facade = createEstimatedFacade();
  const materials = {
    wall: facade.material,
    roof: new THREE.MeshStandardMaterial({color: '#dedbd1', roughness: 0.94}),
    campus: new THREE.MeshStandardMaterial({color: '#bcc5ad', roughness: 1, side: THREE.DoubleSide}),
    green: new THREE.MeshStandardMaterial({color: '#71935e', roughness: 1, side: THREE.DoubleSide}),
    water: new THREE.MeshStandardMaterial({color: '#62a2b2', roughness: 0.62, side: THREE.DoubleSide}),
    road: new THREE.MeshStandardMaterial({color: '#b7b3ab', roughness: 1, side: THREE.DoubleSide}),
    edge: new THREE.LineBasicMaterial({color: '#656960', transparent: true, opacity: 0.38}),
  };
  const buildings = new Map();
  const surfacePieces = {campus: [], green: [], water: [], road: []};
  const ids = new Set();
  for (const feature of data.features) {
    if (!feature.id || ids.has(feature.id)) throw new Error(`Duplicate or missing feature ID: ${feature.id}`);
    ids.add(feature.id);
    const p = feature.properties, kind = p.kind;
    if (kind !== 'building' && !(kind in surfacePieces)) throw new Error(`Unsupported feature kind: ${kind}`);
    if (kind !== 'building') {
      const isLine = feature.geometry.type.includes('LineString');
      if (isLine && (p.brunnel === 'tunnel' || p.upstreamProperties?.brunnel === 'tunnel' || p.raw?.brunnel === 'tunnel')) continue;
      surfacePieces[kind].push(isLine ? roadGeometry(feature, center)
        : flatGeometry(feature.geometry, center, {campus: 0, green: 0.07, water: 0.12, road: 0.2}[kind]));
      continue;
    }
    const {projected, area, bounds, origin} = footprintMetrics(feature.geometry, center);
    const top = p.renderHeight, bottom = p.minHeight;
    if (![top, bottom].every(Number.isFinite) || bottom < 0 || (p.extrude !== false && top <= bottom)) {
      throw new Error(`Invalid height range for ${feature.id}: ${bottom}..${top}`);
    }
    const building = new THREE.Group();
    building.name = p.name || feature.id;
    building.position.set(origin[0], 0, origin[1]);
    building.userData = {
      ...p, featureId: feature.id, footprintArea: area, bounds,
      baseFacadeSource: '程序窗格示意，非照片重建；窗位、楼层与材质未经逐栋核实。',
      localOriginMeters: origin, localAxes: 'X east, Y up, Z south',
    };
    const body = new THREE.Group();
    body.name = 'base';
    for (const rings of projected) {
      const shape = shapeFromRings(rings, origin);
      const geometry = p.extrude === false ? new THREE.ShapeGeometry(shape) : new THREE.ExtrudeGeometry(shape, {
        depth: top - bottom, bevelEnabled: false, steps: 1, curveSegments: 1,
        UVGenerator: facade.uvGenerator(bottom, top),
      });
      geometry.rotateX(-Math.PI / 2);
      geometry.translate(0, p.extrude === false ? 0.3 : bottom, 0);
      const mesh = new THREE.Mesh(geometry, p.extrude === false ? materials.roof : [materials.roof, materials.wall]);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      body.add(mesh);
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 30), materials.edge);
      edges.name = 'footprint edges';
      body.add(edges);
    }
    building.add(body);
    layers.building.add(building);
    buildings.set(feature.id, building);
  }
  for (const [kind, pieces] of Object.entries(surfacePieces)) {
    if (!pieces.length) continue;
    // Use non-indexed geometry because roads and triangulated polygons differ.
    const normalized = pieces.map(piece => piece.index ? piece.toNonIndexed() : piece);
    for (const geometry of normalized) geometry.deleteAttribute('uv');
    const geometry = mergeGeometries(normalized);
    if (!geometry) throw new Error(`Cannot merge ${kind} surface geometry.`);
    const mesh = new THREE.Mesh(geometry, materials[kind]);
    mesh.receiveShadow = true;
    layers[kind].add(mesh);
    new Set([...pieces, ...normalized]).forEach(piece => piece.dispose());
  }
  if (!buildings.size) throw new Error('Campus dataset contains no buildings.');
  group.updateMatrixWorld(true);
  return {group, layers, buildings, landmarks: new Map(), objects: new Map(buildings),
    showEstimatedFacades: visible => facade.setVisible(visible)};
}

export function replaceBuilding(buildings, id, detail) {
  const building = buildings.get(id);
  if (!building) throw new Error(`Unknown building ID: ${id}`);
  if (!detail?.isObject3D || detail.parent) throw new Error('Replacement must be an unattached Three.js Object3D.');
  // Only the addressable parent owns featureId; a detail is not a second building.
  if (detail.userData.featureId) {
    if (detail.userData.featureId !== id) throw new Error(`Detail belongs to a different building: ${detail.userData.featureId}`);
    detail.userData.buildingFeatureId = id;
    delete detail.userData.featureId;
  }
  // Keep the map placement and identity; detailed geometry uses this building's local meter coordinates.
  const base = building.getObjectByName('base');
  if (base) base.visible = false;
  const previous = building.children.find(child => child.userData.campusDetail);
  if (previous) building.remove(previous);
  detail.userData.campusDetail = true;
  building.add(detail);
  building.userData.refinementStatus = 'detailed';
  return building;
}
