import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {footprintMetrics, project} from './geo.js';
import {replaceBuilding} from './model.js';

export const AUDITORIUM_ID = 'building:geometry:ba46ccc8cc43f04fe38fc0ba';
const REFERENCE_PAGE = 'https://www.tsinghua.edu.cn/zjqh/xyfg/xyjg.htm';
const REFERENCE_IMAGE = 'https://www.tsinghua.edu.cn/__local/E/C5/CB/171B5114C0D43E853B94AA5CE46_0BACEE5A_191A51.jpg';
// Frozen OpenFreeMap outline, NOT a new image trace or replacement OSM outline.
const SOURCE_RING = [
  [116.318086982, 40.002536305], [116.318103075, 40.00234728],
  [116.318156719, 40.00234728], [116.318162084, 40.002236331],
  [116.318414211, 40.002248659], [116.318403482, 40.002359608],
  [116.318451762, 40.002363717], [116.318441033, 40.002544524],
  [116.318371296, 40.002544524], [116.318365932, 40.002643145],
  [116.318129897, 40.002634927], [116.318140626, 40.002536305],
  [116.318086982, 40.002536305],
];

function verifySource(feature) {
  const rings = feature?.geometry?.coordinates;
  if (feature?.id !== AUDITORIUM_ID || feature.properties?.kind !== 'building' ||
      feature.properties.name !== '大礼堂' || feature.geometry?.type !== 'Polygon' ||
      !Array.isArray(rings) || rings.length !== 1 || !Array.isArray(rings[0]) ||
      rings[0].length !== SOURCE_RING.length ||
      rings[0].some((point, i) => !Array.isArray(point) || point.length !== 2 ||
        point.some((value, axis) => !Number.isFinite(value) ||
          Math.abs(value - SOURCE_RING[i][axis]) > 1e-10)) ||
      feature.properties.extrude === false || feature.properties.minHeight !== 0) {
    throw new Error('Auditorium source geometry/identity mismatch: review the frozen outline before reconstruction.');
  }
}

// Convex half-plane clipping is applied to triangles, not the concave footprint's
// bounding box. This retains its four reentrant corners and never bridges a notch.
function clip(poly, a, b, c, positive = true) {
  const out = [], sign = positive ? 1 : -1;
  const distance = p => sign * (a * p[0] + b * p[1] + c);
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    const dp = distance(p), dq = distance(q);
    if (dp >= -1e-8) out.push(p);
    if ((dp > 1e-8 && dq < -1e-8) || (dp < -1e-8 && dq > 1e-8)) {
      const t = dp / (dp - dq);
      out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
    }
  }
  return out.filter((p, i) => i === 0 || Math.hypot(p[0] - out[i - 1][0], p[1] - out[i - 1][1]) > 1e-7);
}

function triangulate(ring) {
  return THREE.ShapeUtils.triangulateShape(ring.map(p => new THREE.Vector2(...p)), [])
    .map(face => face.map(index => ring[index]));
}

function planarMesh(polys, height, material, name, uvScale = 1, upward = true) {
  const vertices = [], uv = [];
  for (const poly of polys) {
    for (let i = 1; i < poly.length - 1; i++) {
      // The projected rings run clockwise in X/Z; normals must point up.
      const points = [poly[0], poly[i], poly[i + 1]];
      const cross = (points[1][0] - points[0][0]) * (points[2][1] - points[0][1]) -
        (points[1][1] - points[0][1]) * (points[2][0] - points[0][0]);
      if (Math.abs(cross) < 1e-9) continue;
      if ((cross > 0) === upward) points.reverse();
      for (const p of points) {
        vertices.push(p[0], typeof height === 'function' ? height(p) : height, p[1]);
        uv.push(p[0] / uvScale, p[1] / uvScale);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}

function wallMesh(ring, bottom, top, material, name) {
  const vertices = [], uv = [];
  let run = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    const length = Math.hypot(a[0] - b[0], a[1] - b[1]);
    const ya = typeof top === 'function' ? top(a) : top;
    const yb = typeof top === 'function' ? top(b) : top;
    const points = [[a[0], bottom, a[1]], [b[0], bottom, b[1]],
      [b[0], yb, b[1]], [a[0], ya, a[1]]];
    const tex = [[run / 1.2, bottom / 0.6], [(run + length) / 1.2, bottom / 0.6],
      [(run + length) / 1.2, yb / 0.6], [run / 1.2, ya / 0.6]];
    for (const j of [0, 1, 2, 0, 2, 3]) {
      vertices.push(...points[j]);
      uv.push(...tex[j]);
    }
    run += length;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}

// Deterministic CPU pixels: works in Node, uses no Canvas and no reference image
// as a facade texture. A single repeating material replaces per-brick meshes.
function masonryTexture(roof = false) {
  const width = 256, height = 128, pixels = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    const row = Math.floor(y / 32);
    for (let x = 0; x < width; x++) {
      const shifted = x + (row % 2) * 32;
      const mortar = roof ? y % 32 < 3 || shifted % 32 < 3 : y % 32 < 2 || shifted % 64 < 2;
      const variation = ((Math.floor(shifted / (roof ? 32 : 64)) * 17 + row * 31) % 19) - 9;
      const noise = ((x * 19 + y * 37) % 13) - 6;
      const base = roof ? (mortar ? [85, 52, 40] : [142, 72, 45])
        : (mortar ? [115, 97, 84] : [148, 85, 64]);
      const offset = (y * width + x) * 4;
      for (let k = 0; k < 3; k++) pixels[offset + k] = base[k] + variation + noise;
      pixels[offset + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(pixels, width, height);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  texture.name = roof ? 'procedural terracotta tiles (not photograph)' : 'procedural red masonry (not photograph)';
  return texture;
}

function solid(group, geometry, material, name, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.position.set(x, y, z);
  mesh.castShadow = mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function instances(group, geometry, material, name, positions, rotate = 0) {
  const mesh = new THREE.InstancedMesh(geometry, material, positions.length);
  mesh.name = name;
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotate);
  positions.forEach((position, i) => mesh.setMatrixAt(i,
    matrix.compose(new THREE.Vector3(...position), quaternion, new THREE.Vector3(1, 1, 1))));
  mesh.castShadow = mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function beam(group, a, b, radius, material, name) {
  const from = new THREE.Vector3(...a), to = new THREE.Vector3(...b);
  const mesh = solid(group, new THREE.CylinderGeometry(radius, radius, from.distanceTo(to), 6),
    material, name, ...(from.clone().add(to).multiplyScalar(0.5).toArray()));
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.sub(from).normalize());
  return mesh;
}

function arch(group, x, z, rotation, width, bottom, height, materials, name) {
  const unit = new THREE.Group();
  unit.name = name;
  unit.position.set(x, bottom, z);
  unit.rotation.y = rotation;
  const radius = width / 2, spring = height - radius;
  const shape = new THREE.Shape();
  shape.moveTo(-radius, 0);
  shape.lineTo(radius, 0);
  shape.lineTo(radius, spring);
  shape.absarc(0, spring, radius, 0, Math.PI, false);
  shape.lineTo(-radius, 0);
  const pane = solid(unit, new THREE.ShapeGeometry(shape, 12), materials.glass, 'arched recessed facade panel');
  pane.userData.isFacadePanel = true; // A modeled inset appearance, not a boolean-cut surveyed opening.
  for (const px of [-radius, 0, radius]) {
    beam(unit, [px, 0, 0.04], [px, spring, 0.04], 0.055, materials.frame, 'window vertical frame');
  }
  beam(unit, [-radius, spring, 0.04], [radius, spring, 0.04], 0.055, materials.frame, 'window spring rail');
  beam(unit, [-radius, 1.45, 0.04], [radius, 1.45, 0.04], 0.038, materials.frame, 'window horizontal rail');
  const curve = new THREE.EllipseCurve(0, spring, radius + 0.07, radius + 0.07, 0, Math.PI);
  const path = new THREE.CatmullRomCurve3(curve.getPoints(16).map(p => new THREE.Vector3(p.x, p.y, 0.04)));
  solid(unit, new THREE.TubeGeometry(path, 16, 0.075, 5, false), materials.frame, 'arched lintel');
  group.add(unit);
}

export function createAuditoriumDetail(feature, center, localOriginMeters) {
  verifySource(feature);
  if (!Array.isArray(localOriginMeters) || localOriginMeters.length !== 2 || !localOriginMeters.every(Number.isFinite)) {
    throw new Error('Auditorium requires a finite two-coordinate local origin in meters.');
  }
  const metrics = footprintMetrics(feature.geometry, center);
  const projected = SOURCE_RING.slice(0, -1).map(point => project(point, center));
  const dx = projected[4][0] - projected[3][0], dz = projected[4][1] - projected[3][1];
  const length = Math.hypot(dx, dz), east = [dx / length, dz / length], south = [-east[1], east[0]];
  const ring = projected.map(([x, z]) => {
    x -= metrics.origin[0]; z -= metrics.origin[1];
    return [x * east[0] + z * east[1], x * south[0] + z * south[1]];
  });
  const front = ring[3][1], rear = (ring[9][1] + ring[10][1]) / 2;
  const cx = (ring[3][0] + ring[4][0] + ring[9][0] + ring[10][0]) / 4;
  const cz = (ring[1][1] + ring[6][1] + ring[0][1] + ring[7][1]) / 4;
  const halfX = (ring[4][0] - ring[3][0]) / 2;
  const halfZ = ((ring[1][1] + ring[6][1]) - (ring[0][1] + ring[7][1])) / 4;
  const entryWall = front - 3.9, eave = 9.2, ridge = 14.4;
  const wallRing = clip(ring, 0, -1, entryWall);
  const cuts = [[1, 0, -cx], [0, 1, -cz],
    [1 / halfX, -1 / halfZ, -cx / halfX + cz / halfZ],
    [1 / halfX, 1 / halfZ, -cx / halfX - cz / halfZ]];
  const roofHeight = ([u, v]) => eave + (ridge - eave) * Math.max(0,
    1 - Math.min(Math.abs(u - cx) / halfX, Math.abs(v - cz) / halfZ));
  let roofPolys = triangulate(wallRing);
  for (const cut of cuts) roofPolys = roofPolys.flatMap(poly =>
    [clip(poly, ...cut, true), clip(poly, ...cut, false)].filter(p => p.length >= 3));
  // Split the wall perimeter at the same roof slope changes, so the gables
  // meet the roof instead of cutting straight across its peaks.
  const gableRing = [];
  for (let i = 0; i < wallRing.length; i++) {
    const a = wallRing[i], b = wallRing[(i + 1) % wallRing.length], times = [0];
    for (const [x, z, c] of cuts) {
      const da = x * a[0] + z * a[1] + c, db = x * b[0] + z * b[1] + c;
      const t = da / (da - db);
      if (t > 1e-7 && t < 1 - 1e-7) times.push(t);
    }
    [...new Set(times)].sort((a, b) => a - b).forEach(t =>
      gableRing.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]));
  }

  const materials = {
    brick: new THREE.MeshStandardMaterial({color: '#ffffff', map: masonryTexture(), roughness: 0.95, side: THREE.DoubleSide}),
    tile: new THREE.MeshStandardMaterial({color: '#ffffff', map: masonryTexture(true), roughness: 0.9, side: THREE.DoubleSide}),
    stone: new THREE.MeshStandardMaterial({color: '#d5cfc0', roughness: 0.87}),
    ring: new THREE.MeshStandardMaterial({color: '#77756d', roughness: 0.84}),
    dome: new THREE.MeshStandardMaterial({color: '#738b83', metalness: 0.32, roughness: 0.72}),
    rib: new THREE.MeshStandardMaterial({color: '#abb3a4', metalness: 0.3, roughness: 0.68}),
    frame: new THREE.MeshStandardMaterial({color: '#665548', roughness: 0.92}),
    glass: new THREE.MeshStandardMaterial({color: '#303c38', metalness: 0.08, roughness: 0.68, side: THREE.DoubleSide}),
  };
  const detail = new THREE.Group();
  detail.name = '大礼堂 · 官方照片参照重建';
  const architecture = new THREE.Group();
  architecture.name = 'footprint-aligned architecture';
  architecture.position.set(metrics.origin[0] - localOriginMeters[0], 0, metrics.origin[1] - localOriginMeters[1]);
  architecture.rotation.y = Math.atan2(-east[1], east[0]);
  detail.add(architecture);
  const foundation = planarMesh(triangulate(ring), 0.45, materials.stone, 'exact cross footprint foundation');
  architecture.add(foundation, wallMesh(ring, 0, 0.45, materials.stone, 'footprint plinth'));
  architecture.add(wallMesh(wallRing, 0.45, eave, materials.brick, 'footprint brick shell'));
  architecture.add(wallMesh(gableRing, eave, roofHeight, materials.brick, 'four cross gables'));
  architecture.add(planarMesh(roofPolys, roofHeight, materials.tile, 'intersecting red pitched roofs', 0.8));
  for (let i = 0; i < gableRing.length; i++) {
    const a = gableRing[i], b = gableRing[(i + 1) % gableRing.length];
    beam(architecture, [a[0], roofHeight(a) + 0.05, a[1]],
      [b[0], roofHeight(b) + 0.05, b[1]], 0.13, materials.stone, 'gable/eave stone coping');
  }

  // The forward four meters are OPEN below the portico, not a solid box with
  // decorative columns pasted on it. Its slab follows the original front arm.
  const porchRing = clip(ring, 0, 1, -entryWall);
  architecture.add(planarMesh(triangulate(porchRing), 9.45, materials.stone, 'portico roof slab'));
  architecture.add(planarMesh(triangulate(porchRing), 9.12, materials.stone, 'portico slab underside', 1, false));
  architecture.add(wallMesh(porchRing, 9.12, 9.45, materials.stone, 'portico slab edges'));
  const porchWidth = length, porchMidX = (ring[3][0] + ring[4][0]) / 2, colZ = front - 0.65;
  const columnX = [-0.375, -0.125, 0.125, 0.375].map(ratio => porchMidX + porchWidth * ratio);
  const shaft = new THREE.CylinderGeometry(0.47, 0.58, 7.72, 80, 1);
  const pos = shaft.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const angle = Math.atan2(pos.getZ(i), pos.getX(i));
    const scale = 1 + 0.035 * Math.cos(angle * 20);
    pos.setXYZ(i, pos.getX(i) * scale, pos.getY(i), pos.getZ(i) * scale);
  }
  shaft.computeVertexNormals();
  instances(architecture, shaft, materials.stone, 'four fluted white portico columns',
    columnX.map(x => [x, 4.7, colZ]));
  const base = new THREE.LatheGeometry([
    [0.73, 0], [0.73, 0.12], [0.68, 0.15], [0.68, 0.26], [0.60, 0.39],
  ].map(p => new THREE.Vector2(...p)), 40);
  instances(architecture, base, materials.stone, 'four column bases', columnX.map(x => [x, 0.45, colZ]));
  const capital = new THREE.LatheGeometry([
    [0.47, 0], [0.50, 0.12], [0.68, 0.26], [0.70, 0.38], [0.70, 0.49],
  ].map(p => new THREE.Vector2(...p)), 40);
  instances(architecture, capital, materials.stone, 'four column capitals', columnX.map(x => [x, 8.56, colZ]));
  instances(architecture, new THREE.BoxGeometry(1.5, 0.16, 1.5), materials.stone,
    'column abaci', columnX.map(x => [x, 9.02, colZ]));
  for (const [y, h, depth, width] of [
    [9.64, 1.12, 0.83, porchWidth], [10.25, 0.18, 1.05, porchWidth + 0.35],
    [10.42, 0.16, 0.93, porchWidth + 0.12], [10.96, 0.94, 0.52, porchWidth * 0.79],
    [11.48, 0.15, 0.69, porchWidth * 0.80],
  ]) solid(architecture, new THREE.BoxGeometry(width, h, depth), materials.stone,
    'white entablature / stepped central parapet', porchMidX, y, colZ);
  // Short parapet returns along the open porch, using its actual tapered edges.
  for (const side of [-1, 1]) {
    const x = porchMidX + side * (porchWidth / 2 - 0.16);
    solid(architecture, new THREE.BoxGeometry(0.32, 0.65, 3.4), materials.brick,
      'brick portico parapet return', x, 9.78, front - 2.0);
    solid(architecture, new THREE.BoxGeometry(0.43, 0.14, 3.52), materials.stone,
      'portico return coping', x, 10.16, front - 2.0);
  }
  for (let i = 0; i < 6; i++) {
    solid(architecture, new THREE.BoxGeometry(porchWidth * 0.94, (6 - i) * 0.075, 0.47),
      materials.stone, 'six entrance stair treads', porchMidX, (6 - i) * 0.075 / 2, front + 0.24 + i * 0.47);
  }
  for (const x of [-5.6, 0, 5.6]) arch(architecture, cx + x, entryWall + 0.035, 0,
    2.4, 0.55, 6.6, materials, 'inferred front arched doorway');
  // Window faces are placed on actual side edges (including their slight skew).
  for (const [aIndex, bIndex, facing] of [[0, 1, -1], [7, 6, 1]]) {
    const a = ring[aIndex], b = ring[bIndex], angle = Math.atan2(b[0] - a[0], b[1] - a[1]);
    const rotation = angle + facing * Math.PI / 2;
    for (const t of [0.16, 0.39, 0.62, 0.85]) {
      arch(architecture, a[0] + (b[0] - a[0]) * t + facing * 0.04,
        a[1] + (b[1] - a[1]) * t, rotation, 1.9, 3.0, 4.5, materials,
        'side arched window (spacing inferred)');
    }
  }
  for (const x of [-5.1, 0, 5.1]) arch(architecture, cx + x, rear - 0.13, Math.PI,
    1.9, 3.0, 4.5, materials, 'hidden north elevation window (estimated)');

  const drumBottom = 9.15, drumTop = 18.2, drumRadius = 12.0;
  const drumGeo = new THREE.CylinderGeometry(drumRadius, drumRadius, drumTop - drumBottom, 8, 1);
  drumGeo.rotateY(Math.PI / 8);
  const drumUV = drumGeo.getAttribute('uv');
  for (let i = 0; i < drumUV.count; i++) drumUV.setXY(i,
    drumUV.getX(i) * (16 * drumRadius * Math.sin(Math.PI / 8)) / 1.2,
    drumUV.getY(i) * (drumTop - drumBottom) / 0.6);
  solid(architecture, drumGeo, materials.brick, 'octagonal red brick drum',
    cx, (drumTop + drumBottom) / 2, cz);
  const bands = [
    [[12.03, 17.98], [12.03, 18.19], [12.45, 18.25], [12.45, 18.48]],
    [[12.36, 18.48], [12.36, 18.65], [12.11, 18.78], [12.11, 18.91]],
    [[12.00, 18.91], [12.00, 19.10], [11.73, 19.23], [11.73, 19.34]],
  ];
  bands.forEach((profile, i) => solid(architecture,
    new THREE.LatheGeometry(profile.map(p => new THREE.Vector2(...p)), 8, Math.PI / 8),
    materials.ring, `tiered octagonal cornice ${i + 1}`, cx, 0, cz));
  solid(architecture, new THREE.LatheGeometry([
    [11.67, 19.30], [11.67, 19.46], [11.47, 19.48],
  ].map(p => new THREE.Vector2(...p)), 96), materials.rib, 'circular dome springing rim', cx, 0, cz);
  const insets = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.24, 0.24), materials.stone, 32);
  insets.name = 'drum frieze diamond insets (count approximated)';
  const matrix = new THREE.Matrix4(), quat = new THREE.Quaternion();
  for (let i = 0; i < 8; i++) {
    const angle = i * Math.PI / 4, normal = [Math.sin(angle), Math.cos(angle)];
    for (let j = 0; j < 4; j++) {
      const tangent = (j - 1.5) * 1.8, radius = drumRadius * Math.cos(Math.PI / 8) + 0.02;
      quat.setFromEuler(new THREE.Euler(0, angle, Math.PI / 4));
      insets.setMatrixAt(i * 4 + j, matrix.compose(
        new THREE.Vector3(cx + normal[0] * radius + normal[1] * tangent, 17.35,
          cz + normal[1] * radius - normal[0] * tangent), quat, new THREE.Vector3(1, 1, 1)));
    }
  }
  architecture.add(insets);

  // A SHALLOW SPHERICAL CAP, not a hemisphere. Its rise/diameter is 0.212.
  const radius = 11.45, rise = 4.85, springY = 19.48;
  const sphereRadius = (radius * radius + rise * rise) / (2 * rise);
  const capY = r => springY + Math.sqrt(sphereRadius * sphereRadius - r * r) - (sphereRadius - rise);
  const profile = Array.from({length: 25}, (_, i) => {
    const r = radius * (1 - i / 24);
    return new THREE.Vector2(r, capY(r));
  });
  const dome = solid(architecture, new THREE.LatheGeometry(profile, 96), materials.dome,
    'shallow green-grey metal dome', cx, 0, cz);
  dome.userData = {shape: 'shallow spherical cap', radius, rise, springY, riseToDiameter: rise / (2 * radius)};
  const ribs = [];
  for (let i = 0; i < 64; i++) {
    const angle = i * Math.PI * 2 / 64;
    const points = Array.from({length: 19}, (_, j) => {
      const r = radius * (1 - j / 19);
      return new THREE.Vector3(Math.sin(angle) * r, capY(r) + 0.04, Math.cos(angle) * r);
    });
    ribs.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 24, 0.034, 5, false));
  }
  solid(architecture, mergeGeometries(ribs), materials.rib, '64 batched radial dome standing seams', cx, 0, cz);
  ribs.forEach(geometry => geometry.dispose());
  solid(architecture, new THREE.SphereGeometry(0.16, 12, 6), materials.rib,
    'small dome apex cap', cx, springY + rise - 0.06, cz);
  detail.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(detail);
  detail.userData = {
    featureId: AUDITORIUM_ID, referenceSite: 'auditorium',
    referencePages: [REFERENCE_PAGE], referenceImages: [REFERENCE_IMAGE],
    localReference: 'references/auditorium-oblique.jpg',
    localAxes: 'X east, Y up, Z south',
    footprintArea: metrics.area, footprintBounds: metrics.bounds,
    directionSource: '南侧草坪 landcover:807161562 + 南侧凸出轮廓边 + 官方照片入口；方向推定，非测绘',
    frontNormalXZ: south, frontYawDegrees: Math.atan2(south[0], south[1]) * 180 / Math.PI,
    estimatedDimensionsMeters: {
      footprintBBoxWidth: metrics.bounds[2] - metrics.bounds[0],
      footprintBBoxDepth: metrics.bounds[3] - metrics.bounds[1],
      wallEave: eave, crossRoofRidge: ridge, drumTop, domeDiameter: radius * 2,
      domeRise: rise, frontPorticoWidth: porchWidth, openPorticoDepth: front - entryWall,
      meshLocalYMin: bounds.min.y, meshLocalYMax: bounds.max.y,
    },
    observed: ['十字形红砖体量与交叉红色坡屋顶', '低矮灰绿色肋纹穹顶', '砖鼓座与多层环檐', '白色柱廊、横向额枋和中央高起矩形栏板'],
    limits: '轮廓为冻结地图数据；高度与屋顶坡度按单张斜俯照片比例推定，非测绘。入口朝南略偏东由南侧草坪与凸出边推定；背面、门窗间距、柱槽、穹顶肋数及细部简化。窗为立面嵌板外观，不是布尔开洞；不建内部空间。照片仅本地参照，未作纹理。',
    noReferencePhotoTextures: true,
  };
  return detail;
}

export function refineAuditorium(campus, data) {
  const matches = data?.features?.filter(feature => feature.id === AUDITORIUM_ID) || [];
  if (matches.length !== 1) throw new Error('Auditorium frozen feature must occur exactly once.');
  const feature = matches[0];
  verifySource(feature);
  const target = campus?.buildings?.get(AUDITORIUM_ID);
  const metrics = footprintMetrics(feature.geometry, data.metadata.center);
  if (!target || target.userData.featureId !== AUDITORIUM_ID || !target.getObjectByName('base') ||
      !target.userData.localOriginMeters?.every((value, axis) => Math.abs(value - metrics.origin[axis]) < 1e-6) ||
      Math.abs(target.position.x - metrics.origin[0]) > 1e-6 ||
      Math.abs(target.position.z - metrics.origin[1]) > 1e-6 || target.position.y !== 0 ||
      target.rotation.x !== 0 || target.rotation.y !== 0 || target.rotation.z !== 0 ||
      !target.scale.equals(new THREE.Vector3(1, 1, 1))) {
    throw new Error('Auditorium source building placement/identity mismatch.');
  }
  const detail = createAuditoriumDetail(feature, data.metadata.center, target.userData.localOriginMeters);
  const baseRenderHeight = target.userData.baseRenderHeight ?? target.userData.renderHeight;
  replaceBuilding(campus.buildings, AUDITORIUM_ID, detail);
  target.name = '大礼堂';
  Object.assign(target.userData, {
    name: '大礼堂', baseRenderHeight,
    renderHeight: Number(detail.userData.estimatedDimensionsMeters.meshLocalYMax.toFixed(3)),
    heightSource: '照片比例推定，非测绘',
    refinementSummary: '依据官方斜俯照片重建十字形红砖外壳、交叉红色坡屋顶、砖鼓座、多层环檐、浅灰绿肋纹穹顶与南向白色四柱廊；保留冻结轮廓，隐蔽面和尺寸为估算。',
    referenceSite: 'auditorium', referencePages: detail.userData.referencePages,
    referenceImages: detail.userData.referenceImages, limits: detail.userData.limits,
    refinementSource: '官方照片参照 + 冻结 OpenFreeMap 轮廓',
    estimatedDimensionsMeters: detail.userData.estimatedDimensionsMeters,
  });
  return target;
}
