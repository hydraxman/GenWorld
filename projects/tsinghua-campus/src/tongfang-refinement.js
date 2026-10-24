import * as THREE from 'three';
import polygonClipping from 'polygon-clipping';
import {createBuilder} from '../../shunde/src/builder.js';
import {footprintMetrics} from './geo.js';
import {replaceBuilding} from './model.js';

export const TONGFANG_ID = 'building:geometry:767c29087b14fbf65879f219';
const OSM_ID = 'osm:way:226633636';
const CENTER = [116.32003975, 40.00164005];
const RING = [
  [116.318950653, 40.001447351], [116.318966746, 40.001303525],
  [116.319288611, 40.001328181], [116.319272518, 40.001467897],
  [116.318950653, 40.001447351],
];
const PAGES = [
  'https://www.tsinghua.edu.cn/info/1367/81660.htm',
  'https://xsg.tsinghua.edu.cn/info/1005/1128.htm',
  'https://dag.tsinghua.edu.cn/info/1062/2581.htm',
];
const IMAGES = [
  'https://www.tsinghua.edu.cn/_mediafile/qh2021b/publish/thu2018/11499/20180806120755067157037/20180806120918497951616.jpg',
  'https://xsg.tsinghua.edu.cn/__local/7/4B/C7/8468B9281B3B58A7D004CC38BF1_CE0CC824_1925E.jpg?e=.jpg',
];
const LIMITS = '西向山墙及门窗有官方照片；西部高单层、东部两层和朝南门廊由校档案说明支持，但东西分界、南门廊式样、逐窗数量、所有高度与隐藏面尺寸均为推定，非测绘。北侧只保留安静砖墙，不把西门装饰复制到整栋。无室内复原；匾额为简化几何字，不复制书法；照片只作本地参考，绝不作纹理。';
const EPS = 1e-6;
const rect = (x0, z0, x1, z1) => [[[x0, z0], [x1, z0], [x1, z1], [x0, z1], [x0, z0]]];

function verifySource(f) {
  const p = f?.properties, g = f?.geometry;
  if (f?.id !== TONGFANG_ID || p?.kind !== 'building' || p.name !== '同方部' ||
      p.sourceLayer !== 'building' || p.sourceFeatureId !== null ||
      p.idStrategy !== 'canonical-geometry-sha256-96' ||
      p.nameSource !== 'osm-local-extract-building-overlap' ||
      p.nameSourceFeatureId !== OSM_ID || p.nameConfidence !== 0.984 ||
      p.nameRole !== 'building-name' || p.renderHeight !== 5 || p.minHeight !== 0 ||
      p.extrude !== true || p.upstreamProperties?.render_height !== 5 ||
      p.upstreamProperties?.render_min_height !== 0 ||
      g?.type !== 'Polygon' || g.coordinates?.length !== 1 ||
      g.coordinates[0]?.length !== RING.length ||
      g.coordinates[0].some((point, i) => !Array.isArray(point) || point.length !== 2 ||
        point.some((v, j) => !Number.isFinite(v) || Math.abs(v - RING[i][j]) > 1e-10))) {
    throw new Error('Tongfang frozen source identity/geometry mismatch; no nearest-name substitution.');
  }
}

function verifyCoordinates(center, origin) {
  if (!Array.isArray(center) || center.length !== 2 ||
      center.some((v, i) => !Number.isFinite(v) || Math.abs(v - CENTER[i]) > 1e-10)) {
    throw new Error('Tongfang frozen projection center mismatch.');
  }
  if (!Array.isArray(origin) || origin.length !== 2 || !origin.every(Number.isFinite)) {
    throw new Error('Tongfang requires a finite bbox-center local origin.');
  }
}

function pattern(kind) {
  const size = 128, pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const joint = kind === 'brick'
      ? y % 16 < 1 || (x + Math.floor(y / 16) % 2 * 16) % 32 < 1
      : y % 32 < 2;
    const shade = kind === 'brick'
      ? ((Math.floor(x / 16) * 13 + Math.floor(y / 16) * 7) % 11) - 5
      : 7 * Math.sin(Math.PI * (x % 16 + 0.5) / 16);
    const base = kind === 'brick' ? (joint ? [157, 151, 131] : [115, 116, 107])
      : (joint ? [142, 75, 49] : [180, 104, 66]);
    const offset = (y * size + x) * 4;
    for (let c = 0; c < 3; c++) pixels[offset + c] = base[c] + shade;
    pixels[offset + 3] = 255;
  }
  const t = new THREE.DataTexture(pixels, size, size);
  t.name = `tongfang generated ${kind}; no photograph`;
  t.userData.procedural = true;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

function shape(rings) {
  const points = r => r.map(([x, z]) => new THREE.Vector2(x, -z));
  const s = new THREE.Shape(points(rings[0]));
  for (const ring of rings.slice(1)) s.holes.push(new THREE.Path(points(ring)));
  return s;
}

function slab(B, group, rings, bottom, top, mat) {
  const g = new THREE.ExtrudeGeometry(shape(rings), {depth: top - bottom, bevelEnabled: false, steps: 1});
  g.rotateX(-Math.PI / 2); g.translate(0, bottom, 0);
  B.worldUV(g, mat); B.add(group, g, mat);
}

function surface(B, group, polygons, atHeight, mat) {
  for (const polygon of polygons) {
    const g = new THREE.ShapeGeometry(shape(polygon));
    g.rotateX(-Math.PI / 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, atHeight(p.getX(i), p.getZ(i)));
    g.computeVertexNormals(); B.worldUV(g, mat); B.add(group, g, mat);
  }
}

// Wall q is horizontal, y is vertical, +z faces outdoors. Apertures are real
// holes, not dark rectangles over a retained solid extrusion.
function wall(B, group, outline, apertures, mat, depth = 0.34) {
  const s = new THREE.Shape(outline.map(p => new THREE.Vector2(...p)));
  for (const hole of apertures) s.holes.push(new THREE.Path(hole.map(p => new THREE.Vector2(...p))));
  const g = new THREE.ExtrudeGeometry(s, {depth, bevelEnabled: false, steps: 1, curveSegments: 20});
  g.translate(0, 0, -depth);
  B.worldUV(g, mat); B.add(group, g, mat);
}
const opening = (x, bottom, width, height) => [
  [x - width / 2, bottom], [x + width / 2, bottom],
  [x + width / 2, bottom + height], [x - width / 2, bottom + height],
];

function stroke(B, group, a, b, thickness, z, mat) {
  const g = new THREE.BoxGeometry(Math.hypot(b[0] - a[0], b[1] - a[1]), thickness, 0.022);
  g.rotateZ(Math.atan2(b[1] - a[1], b[0] - a[0]));
  g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, z);
  B.add(group, g, mat);
}

function plaqueGlyphs(B, group, M) {
  // Original simplified geometrical characters; intentionally not traced handwriting.
  const glyphs = [
    // 部, shown leftmost because the actual west sign reads right-to-left.
    [[[0.1, 0.8], [0.6, 0.8]], [[0.35, 0.98], [0.35, 0.8]],
      [[0.15, 0.7], [0.23, 0.55]], [[0.53, 0.7], [0.45, 0.55]],
      [[0.07, 0.5], [0.63, 0.5]], [[0.18, 0.4], [0.53, 0.4], [0.53, 0.12], [0.18, 0.12], [0.18, 0.4]],
      [[0.72, 0.07], [0.72, 0.92], [0.94, 0.92], [0.82, 0.6], [0.95, 0.36], [0.76, 0.28]]],
    [[[0.48, 0.98], [0.56, 0.84]], [[0.05, 0.73], [0.95, 0.73]],
      [[0.46, 0.71], [0.36, 0.35], [0.1, 0.08]],
      [[0.42, 0.57], [0.79, 0.57], [0.66, 0.12], [0.43, 0.18]]],
    [[[0.12, 0.05], [0.12, 0.94], [0.88, 0.94], [0.88, 0.05], [0.71, 0.08]],
      [[0.25, 0.75], [0.75, 0.75]],
      [[0.3, 0.55], [0.7, 0.55], [0.7, 0.24], [0.3, 0.24], [0.3, 0.55]]],
  ];
  glyphs.forEach((paths, i) => {
    for (const path of paths) for (let j = 1; j < path.length; j++) {
      const at = p => [-0.91 + i * 0.64 + p[0] * 0.5, 3.85 + p[1] * 0.5];
      stroke(B, group, at(path[j - 1]), at(path[j]), 0.034, 0.115, M.dark);
    }
  });
}

function glazing(B, group, M, x, bottom, width, height, {cols = 3, rows = 3, decorative = false} = {}) {
  const box = (...args) => B.box(group, '', ...args);
  box(x, bottom + height / 2, -0.14, width, height, 0.035, M.glass);
  for (const q of [-1, 1]) box(x + q * width / 2, bottom + height / 2, -0.018, 0.09, height + 0.14, 0.10, M.frame);
  for (const y of [bottom, bottom + height]) box(x, y, -0.018, width + 0.16, 0.10, 0.10, M.frame);
  for (let i = 1; i < cols; i++) box(x - width / 2 + i * width / cols, bottom + height / 2,
    -0.022, 0.05, height, 0.085, M.frame);
  for (let i = 1; i < rows; i++) box(x, bottom + i * height / rows, -0.022, width, 0.055, 0.085, M.frame);
  if (decorative) for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
    const cx = x - width / 2 + (c + 0.5) * width / cols;
    const cy = bottom + (r + 0.5) * height / rows;
    const w = width / cols * 0.34, h = height / rows * 0.45;
    for (const q of [-1, 1]) box(cx + q * w / 2, cy, 0.04, 0.022, h, 0.023, M.dark);
    for (const q of [-1, 1]) box(cx, cy + q * h / 2, 0.04, w, 0.022, 0.023, M.dark);
    // The rectangular motifs connect to the surrounding pane, as in the close-up.
    box(cx, cy - (h / 2 + height / rows / 2) / 2, 0.04, 0.019,
      (height / rows - h) / 2, 0.023, M.dark);
    box(cx, cy + (h / 2 + height / rows / 2) / 2, 0.04, 0.019,
      (height / rows - h) / 2, 0.023, M.dark);
  }
}

export function createTongfangDetail(feature, center, origin) {
  verifySource(feature); verifyCoordinates(center, origin);
  const metrics = footprintMetrics(feature.geometry, center);
  if (origin.some((v, i) => Math.abs(v - metrics.origin[i]) > EPS)) {
    throw new Error('Tongfang local origin is not the frozen footprint bbox-center.');
  }
  const localRing = metrics.projected[0][0].map(([x, z]) => [x - origin[0], z - origin[1]]);
  const a = localRing[1], b = localRing[2], length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const east = [(b[0] - a[0]) / length, (b[1] - a[1]) / length], south = [-east[1], east[0]];
  const ring = localRing.map(([x, z]) => [x * east[0] + z * east[1], x * south[0] + z * south[1]]);
  const footprint = [ring];
  const detail = new THREE.Group();
  detail.name = '同方部 · 西向山墙照片细化与推定东西体量';
  // Root coordinates stay bbox-centered geographic meters; the nested frame
  // follows the exact south edge (5.71 degrees north of east), not an arbitrary yaw.
  const frame = new THREE.Group();
  frame.name = 'Tongfang footprint-aligned meter frame';
  frame.rotation.y = -Math.atan2(east[1], east[0]);
  detail.add(frame);
  const group = (parent, name, surfaceRole, confidence) => {
    const g = new THREE.Group(); g.name = name; g.userData = {surfaceRole, confidence}; parent.add(g); return g;
  };
  const foundation = group(frame, 'Exact frozen quadrilateral stone foundation', 'foundation', 'frozen-map');
  const shell = group(frame, 'Quiet rear and eastern walls', 'context-shell', 'inferred-not-photographed');
  const roofs = group(frame, 'East-west red tiled gable roofs', 'roof', 'west-photo/east-inferred');
  const B = createBuilder(THREE, 226633636);
  const mat = (name, color, extras = {}) => new THREE.MeshStandardMaterial({
    name: `Tongfang ${name}`, color, roughness: 0.9, ...extras,
  });
  const M = {
    brick: mat('generated grey brick', '#ffffff', {map: pattern('brick')}),
    tile: mat('generated terracotta tiles', '#ffffff', {map: pattern('tile'), side: THREE.DoubleSide}),
    stone: mat('pale stone sills and steps', '#cfccbc'),
    frame: mat('blue-grey painted joinery', '#729196', {roughness: 0.72}),
    glass: mat('muted recessed glass', '#496066', {roughness: 0.34, metalness: 0.12}),
    dark: mat('dark glazing bars and lamp iron', '#2f3532', {roughness: 0.7}),
    timber: mat('dark exposed eaves', '#4c4639'),
    sign: mat('untextured pale sign panel', '#e8e6dc'),
  };
  B.textureWorld.set(M.brick, [1.08, 0.52]);
  B.textureWorld.set(M.tile, [0.96, 0.92]);
  slab(B, foundation, footprint, 0.02, 0.34, M.stone);
  const split = 4.0, westEave = 6.35, westRidge = 9.9, eastEave = 7.25, eastRidge = 10.55;
  const roofMid = -0.15;
  const clip = (x0, z0, x1, z1) => polygonClipping.intersection([footprint], [rect(x0, z0, x1, z1)]);
  const roofHeight = (eave, ridge, v) => eave + (ridge - eave) * Math.max(0, 1 - Math.abs(v - roofMid) / 8.0);
  for (const [x0, x1, eave, ridge] of [[-20, split, westEave, westRidge], [split, 20, eastEave, eastRidge]]) {
    for (const [z0, z1] of [[-20, roofMid], [roofMid, 20]]) {
      surface(B, roofs, clip(x0, z0, x1, z1), (u, v) => roofHeight(eave, ridge, v), M.tile);
    }
    const lo = Math.max(x0, -13.77), hi = Math.min(x1, 13.79);
    B.cylinder(roofs, [lo, ridge + 0.025, roofMid], [hi, ridge + 0.025, roofMid], 0.095, 0.095, M.tile, 12);
  }

  // Unseen north: restrained solid shell with a real height transition. No
  // fabricated parade of the photographed ornamental windows on the rear.
  const lineWall = (p, q, bottom, top, material, target = shell, depth = 0.34) => {
    B.box(target, '', (p[0] + q[0]) / 2, (bottom + top) / 2, (p[1] + q[1]) / 2,
      Math.hypot(q[0] - p[0], q[1] - p[1]), top - bottom, depth, material,
      -Math.atan2(q[1] - p[1], q[0] - p[0]));
  };
  const northAt = u => ring[0][1] + (ring[3][1] - ring[0][1]) * (u - ring[0][0]) / (ring[3][0] - ring[0][0]);
  lineWall(ring[0], [split, northAt(split)], 0.34, westEave, M.brick);
  lineWall([split, northAt(split)], ring[3], 0.34, eastEave, M.brick);
  lineWall([split, northAt(split)], [split, ring[2][1]], westEave, eastEave, M.brick);
  for (const [p, q] of [[ring[0], ring[3]], [ring[1], ring[2]]]) {
    const n = Math.max(1, Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) / 0.6));
    for (let i = 0; i < n; i++) {
      const at = t => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
      const u = at(i / n), v = at((i + 1) / n), eave = (u[0] + v[0]) / 2 < split ? westEave : eastEave;
      lineWall(u, v, eave - 0.14, eave, M.timber, roofs, 0.45);
    }
  }

  const facadeFrame = (p, q, name, role, confidence) => {
    const g = group(frame, name, role, confidence);
    const width = Math.hypot(q[0] - p[0], q[1] - p[1]);
    g.position.set((p[0] + q[0]) / 2, 0, (p[1] + q[1]) / 2);
    g.rotation.y = -Math.atan2(q[1] - p[1], q[0] - p[0]);
    return {g, width};
  };
  const {g: west, width: westWidth} = facadeFrame(ring[0], ring[1],
    'Photo-informed west plaque doorway and tall flank windows', 'west-photo-facade', 'photo-informed');
  const holeList = [opening(-4.2, 0.72, 2.25, 4.62), opening(4.2, 0.72, 2.25, 4.62),
    opening(0, 0.34, 2.22, 3.30), opening(0, 3.70, 2.22, 0.76), opening(0, 4.52, 2.22, 0.82)];
  const ventCenter = [0, 8.70], ventRadius = 0.20;
  holeList.push(Array.from({length: 24}, (_, i) => {
    const angle = i / 24 * Math.PI * 2;
    return [ventCenter[0] + Math.cos(angle) * ventRadius, ventCenter[1] + Math.sin(angle) * ventRadius];
  }));
  wall(B, west, [[-westWidth / 2, 0.34], [westWidth / 2, 0.34],
    [westWidth / 2, westEave], [0, westRidge], [-westWidth / 2, westEave]], holeList, M.brick);
  for (const x of [-4.2, 4.2]) {
    glazing(B, west, M, x, 0.72, 2.25, 3.73, {decorative: true});
    glazing(B, west, M, x, 4.52, 2.25, 0.82, {rows: 1, decorative: true});
    B.box(west, '', x, 0.63, 0.07, 2.62, 0.18, 0.38, M.stone);
  }
  glazing(B, west, M, 0, 0.34, 2.22, 3.30, {cols: 2, rows: 2});
  // Opaque lower blue-grey door panels, not an invented open interior.
  for (const x of [-0.55, 0.55]) B.box(west, '', x, 0.75, -0.02, 0.98, 0.73, 0.09, M.frame);
  glazing(B, west, M, 0, 4.52, 2.22, 0.82, {rows: 1, decorative: true});
  B.box(west, '', 0, 4.08, 0.025, 2.16, 0.70, 0.13, M.sign);
  for (const q of [-1, 1]) B.box(west, '', q * 1.13, 4.08, 0.015, 0.10, 0.86, 0.14, M.frame);
  for (const y of [3.66, 4.48]) B.box(west, '', 0, y, 0.015, 2.36, 0.10, 0.14, M.frame);
  plaqueGlyphs(B, west, M);

  // The observed lintels are shallow fan/jack arches, NOT full semicircular arches.
  for (const x of [-4.2, 0, 4.2]) {
    const width = x === 0 ? 2.22 : 2.25;
    for (let i = 0; i < 13; i++) {
      const q = (i + 0.5) / 13 * 2 - 1, dx = q * (width / 2 + 0.18);
      const g = new THREE.BoxGeometry((width + 0.36) / 13 - 0.014, 0.37, 0.14);
      g.rotateZ(-q * 0.28); g.translate(x + dx, 5.58, 0.035);
      B.worldUV(g, M.brick); B.add(west, g, M.brick);
    }
  }
  const pierXs = [-westWidth / 2 + 0.40, -2.05, 2.05, westWidth / 2 - 0.40];
  for (const x of pierXs) for (let i = 0; i < 13; i++) {
    B.box(west, '', x, 0.52 + i * 0.445, 0.015, 0.85, 0.15, 0.16, M.brick);
  }
  // Two observed lantern-shaped fixtures flanking the WEST doorway.
  for (const x of [-1.57, 1.57]) {
    B.box(west, '', x, 2.99, 0.09, 0.13, 0.63, 0.16, M.dark);
    B.box(west, '', x, 3.06, 0.28, 0.19, 0.41, 0.18, M.glass);
    for (const q of [-1, 1]) B.box(west, '', x + q * 0.11, 3.06, 0.39, 0.027, 0.43, 0.025, M.dark);
    for (const y of [2.83, 3.27]) B.box(west, '', x, y, 0.29, 0.27, 0.055, 0.24, M.dark);
  }
  const vent = new THREE.CylinderGeometry(0.17, 0.17, 0.06, 24);
  vent.rotateX(Math.PI / 2); vent.translate(0, 8.70, -0.22); B.add(west, vent, M.dark);
  for (let i = 0; i < 3; i++) B.box(west, '', 0, (i + 1) * 0.34 / 3 / 2,
    (3 - i) * 0.40 / 2, 3.25, (i + 1) * 0.34 / 3, (3 - i) * 0.40, M.stone);
  // Dark sloping bargeboards close the red-tile west gable silhouette.
  for (const q of [-1, 1]) stroke(B, west,
    [q * westWidth / 2, westEave], [0, westRidge], 0.16, 0.04, M.timber);

  // South entrance porch is text-attested only: explicitly segregated from
  // the observed west sign. Its square brick piers and plain small roof are estimates.
  const {g: southFacade, width: southWidth} = facadeFrame(ring[1], ring[2],
    'Inferred south porch and independent east door', 'south-inferred-facade', 'archive-text/not-photo');
  const southMid = (ring[1][0] + ring[2][0]) / 2;
  const sx = u => u - southMid;
  const southHoles = [
    ...[-9.5, -6.4, 1.0].map(u => opening(sx(u), 1.0, 1.50, 3.45)),
    opening(sx(-3.5), 0.34, 1.60, 2.60),
    opening(sx(6.0), 0.34, 1.40, 2.40),
    opening(sx(9.0), 1.05, 1.40, 1.70),
    ...[6.0, 9.0, 12.0].map(u => opening(sx(u), 4.25, 1.25, 1.70)),
  ];
  wall(B, southFacade, [[-southWidth / 2, 0.34], [southWidth / 2, 0.34],
    [southWidth / 2, eastEave], [sx(split), eastEave], [sx(split), westEave], [-southWidth / 2, westEave]],
  southHoles, M.brick);
  for (const u of [-9.5, -6.4, 1.0]) glazing(B, southFacade, M, sx(u), 1.0, 1.50, 3.45, {cols: 2});
  for (const [u, bottom, w, h] of [[-3.5, 0.34, 1.6, 2.6], [6, 0.34, 1.4, 2.4],
    [9, 1.05, 1.4, 1.7], ...[6, 9, 12].map(u => [u, 4.25, 1.25, 1.7])]) {
    glazing(B, southFacade, M, sx(u), bottom, w, h, {cols: 2, rows: 2});
  }
  const porch = group(southFacade, 'Text-attested south porch with inferred plain brick piers', 'porch', 'inferred-form/archive-location');
  for (const q of [-1, 1]) B.box(porch, '', sx(-3.5) + q * 1.56, 1.74, 1.48, 0.38, 2.80, 0.38, M.brick);
  B.box(porch, '', sx(-3.5), 3.15, 1.0, 3.60, 0.20, 2.08, M.timber);
  const porchShape = rect(sx(-3.5) - 1.88, 0.0, sx(-3.5) + 1.88, 2.12);
  for (const [z0, z1] of [[0, 1.06], [1.06, 2.12]]) {
    const polygons = polygonClipping.intersection([porchShape],
      [rect(sx(-3.5) - 2, z0, sx(-3.5) + 2, z1)]);
    surface(B, porch, polygons, (u, v) => 3.27 + 0.55 * (1 - Math.abs(v - 1.06) / 1.06), M.tile);
  }
  B.box(porch, '', sx(-3.5), 0.17, 1.12, 3.65, 0.34, 2.24, M.stone);

  const {g: eastFacade, width: eastWidth} = facadeFrame(ring[2], ring[3],
    'Unseen east end plain two-storey gable', 'east-inferred-facade', 'inferred-not-photographed');
  wall(B, eastFacade, [[-eastWidth / 2, 0.34], [eastWidth / 2, 0.34],
    [eastWidth / 2, eastEave], [0, eastRidge], [-eastWidth / 2, eastEave]], [], M.brick);
  const {g: junction, width: junctionWidth} = facadeFrame([split, northAt(split)], [split, ring[2][1]],
    'Inferred raised eastern gable at volume junction', 'roof-junction', 'inferred-not-photographed');
  wall(B, junction, [[-junctionWidth / 2, westEave], [junctionWidth / 2, westEave],
    [junctionWidth / 2, eastEave], [0, eastRidge], [-junctionWidth / 2, eastEave]], [], M.brick);
  B.finish();
  detail.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(detail);
  const counts = {meshes: 0, triangles: 0, materials: new Set(), textures: new Set()};
  detail.traverse(o => {
    if (!o.isMesh) return;
    o.geometry.computeBoundingBox(); o.geometry.computeBoundingSphere();
    counts.meshes++;
    counts.triangles += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3;
    counts.materials.add(o.material);
    for (const v of Object.values(o.material)) if (v?.isTexture) counts.textures.add(v);
  });
  const westNormal = [-(localRing[1][1] - localRing[0][1]) / westWidth,
    (localRing[1][0] - localRing[0][0]) / westWidth];
  detail.userData = {
    buildingFeatureId: TONGFANG_ID, referenceSite: 'tongfang',
    referencePages: [...PAGES], referenceImages: [...IMAGES],
    footprintAxisEastXZ: east, footprintAxisSouthXZ: south, frontNormalXZ: westNormal,
    viewDirection: [-1.1, 0.38, 0.38], directionSource: '校档案确认匾额在西门、正门廊朝南；本地轴来自冻结南边线，不用最近建筑猜朝向。',
    reconstructionExtent: 'partial', reconstructionLevel: 'photo-informed-estimate-not-surveyed',
    estimatedDimensionsMeters: {
      frozenArea: metrics.area, southEdgeLength: length, westGableWidth: westWidth,
      westEave, westRidge, eastEave, eastRidge, inferredSplitU: split,
      detailBoundsMin: bounds.min.toArray(), detailBoundsMax: bounds.max.toArray(),
      meshLocalYMin: bounds.min.y, meshLocalYMax: bounds.max.y,
    },
    componentCounts: {westTallWindows: 2, westDoor: 1, westTransoms: 3, jackArchLintels: 3,
      rusticatedPiers: 4, westLanterns: 2, smallGableVent: 1, plaqueGlyphs: 3,
      inferredSouthWindows: 7, inferredSouthDoors: 2, inferredPorchPiers: 2},
    plaque: {text: '同方部', visualLeftToRight: '部方同', readingDirection: 'right-to-left',
      glyphSource: 'simplified original geometry, not a calligraphic facsimile', facade: 'west'},
    modelMetrics: {meshes: counts.meshes, triangles: counts.triangles,
      materials: counts.materials.size, textures: counts.textures.size},
    limits: LIMITS, noReferencePhotoTextures: true,
  };
  return detail;
}

function disposeOwnedDetail(detail) {
  const geometries = new Set(), materials = new Set(), textures = new Set();
  detail.traverse(o => {
    if (o.geometry) geometries.add(o.geometry);
    for (const mat of [].concat(o.material || [])) {
      materials.add(mat);
      for (const value of Object.values(mat)) if (value?.isTexture) textures.add(value);
    }
  });
  geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose());
}

export function refineTongfang(campus, data) {
  const matches = data?.features?.filter(f => f.id === TONGFANG_ID) || [];
  if (matches.length !== 1) throw new Error('Tongfang frozen feature must occur exactly once.');
  const feature = matches[0]; verifySource(feature);
  const center = data?.metadata?.center, target = campus?.buildings?.get(TONGFANG_ID);
  const p = target?.userData, origin = p?.localOriginMeters;
  verifyCoordinates(center, origin);
  const metrics = footprintMetrics(feature.geometry, center);
  if (!target?.isGroup || p.featureId !== TONGFANG_ID || p.name !== '同方部' ||
      p.nameSourceFeatureId !== OSM_ID || p.nameSource !== feature.properties.nameSource ||
      p.nameConfidence !== 0.984 || p.sourceFeatureId !== null ||
      p.idStrategy !== feature.properties.idStrategy || p.kind !== 'building' ||
      (p.baseRenderHeight ?? p.renderHeight) !== 5 ||
      !target.children.some(c => c.name === 'base') ||
      origin.some((v, i) => Math.abs(v - metrics.origin[i]) > EPS) ||
      Math.abs(target.position.x - origin[0]) > EPS || Math.abs(target.position.z - origin[1]) > EPS ||
      target.position.y !== 0 || target.rotation.x !== 0 || target.rotation.y !== 0 || target.rotation.z !== 0 ||
      !target.scale.equals(new THREE.Vector3(1, 1, 1)) ||
      (campus.objects && campus.objects.get(TONGFANG_ID) !== target)) {
    throw new Error('Tongfang original root placement/source identity mismatch.');
  }
  const previous = target.children.filter(c => c.userData.campusDetail);
  if (previous.length > 1 || previous.some(c => c.userData.referenceSite !== 'tongfang')) {
    throw new Error('Tongfang root already has an unexpected detail; refusing to stack or replace foreign work.');
  }
  const detail = createTongfangDetail(feature, center, origin);
  // This Box3 is detail-only, before attachment; not the hidden 5m base or campus.
  const bounds = new THREE.Box3().setFromObject(detail);
  const baseHeightSource = p.baseHeightSource ?? p.heightSource;
  const result = replaceBuilding(campus.buildings, TONGFANG_ID, detail);
  Object.assign(result.userData, {
    referenceSite: 'tongfang', baseRenderHeight: 5, baseHeightSource,
    renderHeight: bounds.max.y, heightSource: '照片比例及档案体量推定，非测绘',
    refinementSummary: '同方部：保留冻结四边形与原根身份，照片重建西向红瓦山墙、灰砖扁券／层叠砖墩、蓝灰高窗及矩形窗棂、西门右起同方部匾额和双灯；西部高单层、东部两层及南门廊按档案作局部推定，隐藏面和标高未经测绘，非整栋照片验证。',
    referencePages: [...PAGES], referenceImages: [...IMAGES],
    reconstructionExtent: 'partial', reconstructionLevel: detail.userData.reconstructionLevel,
    estimatedDimensionsMeters: structuredClone(detail.userData.estimatedDimensionsMeters),
    frontNormalXZ: [...detail.userData.frontNormalXZ], viewDirection: [...detail.userData.viewDirection],
    directionSource: detail.userData.directionSource, modelMetrics: {...detail.userData.modelMetrics},
    sourceFootprintGeometry: structuredClone(feature.geometry), limits: LIMITS, noReferencePhotoTextures: true,
  });
  if (previous[0]) disposeOwnedDetail(previous[0]);
  result.updateWorldMatrix(true, true);
  return result;
}
