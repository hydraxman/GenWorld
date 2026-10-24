import * as THREE from 'three';
import polygonClipping from 'polygon-clipping';
import {createBuilder} from '../../shunde/src/builder.js';
import {footprintMetrics} from './geo.js';
import {replaceBuilding} from './model.js';

export const WEST_GYM_ID = 'building:geometry:2e2ee1625f15911b7e00f605';
const OSM_ID = 'osm:way:226623363';
const CENTER = [116.32003975, 40.00164005];
const REFERENCE_PAGES = ['https://www.tsinghua.edu.cn/zjqh/xyfg/xyjg.htm'];
const REFERENCE_IMAGE = 'https://www.tsinghua.edu.cn/__local/9/1E/D7/C040DA1D46F11C38237F81F8EF8_B3CC4C54_149344.jpg';
// Freeze the actual vector outline, not the OSM name-association polygon.
const SOURCE_RING = [
  [116.314557195, 40.003884119], [116.314589381, 40.003567714],
  [116.314659119, 40.003571823], [116.314664483, 40.003522513],
  [116.315297484, 40.003559496], [116.315308213, 40.003432112],
  [116.315512061, 40.003444439], [116.315490603, 40.00363757],
  [116.315544248, 40.00363757], [116.315517426, 40.003908774],
  [116.315469146, 40.003908774], [116.315453053, 40.004077249],
  [116.31524384, 40.004064922], [116.315254569, 40.003966302],
  [116.314959526, 40.003945757], [116.31496489, 40.003908774],
  [116.314557195, 40.003884119],
];

function verifySource(feature, center, localOrigin) {
  const p = feature?.properties, g = feature?.geometry;
  if (feature?.id !== WEST_GYM_ID || p?.kind !== 'building' || p.name !== '西体育馆' ||
      p.nameSourceFeatureId !== OSM_ID || g?.type !== 'Polygon' ||
      g.coordinates?.length !== 1 || g.coordinates[0]?.length !== SOURCE_RING.length ||
      g.coordinates[0].some((point, i) => !Array.isArray(point) || point.length !== 2 ||
        point.some((v, j) => !Number.isFinite(v) || Math.abs(v - SOURCE_RING[i][j]) > 1e-10))) {
    throw new Error('West Gym source geometry/OSM identity changed; re-review the frozen footprint.');
  }
  if (!Array.isArray(center) || center.length !== 2 ||
      center.some((v, i) => !Number.isFinite(v) || Math.abs(v - CENTER[i]) > 1e-10)) {
    throw new Error('West Gym frozen projection center changed; review its map origin.');
  }
  const metrics = footprintMetrics(g, center);
  if (!Array.isArray(localOrigin) || localOrigin.length !== 2 ||
      localOrigin.some((v, i) => !Number.isFinite(v) || Math.abs(v - metrics.origin[i]) > 1e-6)) {
    throw new Error('West Gym local origin changed; do not translate its source outline.');
  }
  return metrics;
}

function rectangle(x0, z0, x1, z1) {
  return [[[x0, z0], [x1, z0], [x1, z1], [x0, z1], [x0, z0]]];
}

function shape(polygon) {
  const result = new THREE.Shape(polygon[0].map(([x, z]) => new THREE.Vector2(x, -z)));
  for (const ring of polygon.slice(1)) result.holes.push(new THREE.Path(
    ring.map(([x, z]) => new THREE.Vector2(x, -z))));
  return result;
}

// Only generated masonry/tile patterns, never the photograph (or its foliage).
function pattern(roof) {
  const side = 64, pixels = new Uint8Array(side * side * 4);
  for (let y = 0; y < side; y++) for (let x = 0; x < side; x++) {
    const row = Math.floor(y / 16);
    const mortar = y % 16 < 1 || (x + (row % 2) * 16) % (roof ? 16 : 32) < 1;
    const base = roof ? [178, 139, 106] : (mortar ? [145, 111, 98] : [132, 73, 62]);
    // Regular clay courses/barrel highlights, not one-pixel dark checker
    // joints plus high-frequency hash noise. Keep contrast subtle when a tile
    // is smaller than a screenshot pixel; mipmaps then average to warm clay.
    const shade = roof
      ? Math.round(5 * Math.sin(Math.PI * ((x % 16 + 0.5) / 16)) -
        (y % 16 < 2 ? 12 : 0) + 2 * ((y % 16 + 0.5) / 16 - 0.5))
      : ((x * 13 + y * 23) % 7) - 3;
    const offset = (y * side + x) * 4;
    for (let c = 0; c < 3; c++) pixels[offset + c] = base[c] + shade;
    pixels[offset + 3] = 255;
  }
  const texture = new THREE.DataTexture(pixels, side, side);
  texture.name = `west-gym generated ${roof ? 'warm tiles' : 'red brick'} — no photo`;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  // DataTexture defaults are NearestFilter + generateMipmaps=false, unlike
  // ordinary loaded image textures. Explicitly support oblique minification.
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = roof ? 8 : 4; // renderer clamps to its supported maximum
  texture.needsUpdate = true;
  return texture;
}

export function createWestGymDetail(feature, center, localOrigin) {
  const metrics = verifySource(feature, center, localOrigin);
  const ring = metrics.projected[0][0], a = ring[3], b = ring[4];
  const width = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const tangent = [(b[0] - a[0]) / width, (b[1] - a[1]) / width];
  const normal = [-tangent[1], tangent[0]];
  const midpoint = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const footprint = metrics.projected[0].map(r => r.map(([x, z]) => [
    (x - midpoint[0]) * tangent[0] + (z - midpoint[1]) * tangent[1],
    (x - midpoint[0]) * normal[0] + (z - midpoint[1]) * normal[1],
  ]));
  // These are the defining frame endpoints, mathematically v=0 and u=±w/2.
  // Remove only their ~1e-15 round-off; otherwise coincident clipping edges
  // can become microscopic self-intersections. Do not snap the source outline.
  footprint[0][3] = [-width / 2, 0];
  footprint[0][4] = [width / 2, 0];
  const clip = polygon => polygonClipping.intersection([footprint], [polygon]);
  const detail = new THREE.Group();
  detail.name = '西体育馆 · 官方正面照片比例重建';
  detail.position.set(midpoint[0] - localOrigin[0], 0, midpoint[1] - localOrigin[1]);
  detail.rotation.y = -Math.atan2(tangent[1], tangent[0]);
  const group = (name, surfaceRole, confidence) => {
    const result = new THREE.Group();
    result.name = name;
    result.userData = {surfaceRole, confidence};
    detail.add(result);
    return result;
  };
  const base = group('Exact concave source footprint foundation', 'foundation', 'frozen-map');
  const facade = group('Three arch gables and two-storey low wings', 'front-facade', 'photo-informed');
  const roofGroup = group('Raised hall roof and lower hipped wings', 'historic-roof', 'photo-informed-front/inferred-depth');
  const skylight = group('Long continuous roof-light strip', 'skylight', 'photo-informed');
  const porch = group('Open pale stone colonnade and balustrade', 'colonnade', 'photo-informed');
  const inferred = group('Unseen western eastern northern additions and rear', 'inferred-additions', 'inferred-not-visible-in-front-photo');
  const B = createBuilder(THREE, 226623363);
  const material = (name, settings) => new THREE.MeshStandardMaterial({
    name: `West Gym ${name}`, roughness: 0.9, ...settings,
  });
  const brick = material('generated red brick', {color: '#ffffff', map: pattern(false), side: THREE.DoubleSide});
  const tiles = material('generated warm tiled roof', {color: '#ffffff', map: pattern(true), side: THREE.DoubleSide});
  B.textureWorld.set(brick, [0.9, 0.42]);
  B.textureWorld.set(tiles, [0.65, 0.65]);
  const stone = material('pale stone', {color: '#d5d0be'});
  const floor = material('foundation and balcony paving', {color: '#aaa796'});
  const glass = material('recessed glazing', {color: '#314e51', roughness: 0.28, metalness: 0.18, side: THREE.DoubleSide});
  const frame = material('slender dark frames', {color: '#3e4841', roughness: 0.6});
  const shadow = material('dark recessed interiors', {color: '#222c29'});
  const unseenRoof = material('inferred addition roof', {color: '#8d8275', side: THREE.DoubleSide});
  const add = (target, geometry, mat) => { B.worldUV(geometry, mat); B.add(target, geometry, mat); };
  const box = (target, x, y, z, w, h, d, mat) => B.box(target, '', x, y, z, w, h, d, mat);
  const slab = (target, polygons, bottom, top, mat) => {
    for (const polygon of polygons) {
      const geometry = new THREE.ExtrudeGeometry(shape(polygon), {depth: top - bottom, bevelEnabled: false, steps: 1});
      geometry.rotateX(-Math.PI / 2);
      geometry.translate(0, bottom, 0);
      add(target, geometry, mat);
    }
  };
  // Every roof is triangulated *after* clipping, including addition caps.
  // This is deliberately not a bounding rectangle across re-entrant notches.
  const surface = (target, polygons, height, mat) => {
    for (const polygon of polygons) {
      const geometry = new THREE.ShapeGeometry(shape(polygon));
      geometry.rotateX(-Math.PI / 2);
      const positions = geometry.attributes.position;
      for (let i = 0; i < positions.count; i++) positions.setY(i,
        height(positions.getX(i), positions.getZ(i)));
      geometry.computeVertexNormals();
      add(target, geometry, mat);
    }
  };

  // Approximate image landmarks in the viewed 1920x900 official photograph.
  // Front width anchors a proportion study, NOT a photogrammetric survey.
  const photo = {
    size: [1920, 900], silhouetteX: [152, 1717], centerBlockX: [588, 1296],
    groundY: 640, wingEaveY: 462, wingRidgeY: 352, hallRidgeY: 298,
    gablePeakY: 379, gableValleyY: 421, archBottomY: 490, archSpringY: 465,
    archCrownY: 423, archWidthPixels: 116, balconyTopY: 549, railTopY: 525,
    caveat: 'Approximate visible pixel landmarks; perspective, foliage and depth prevent surveyed heights.',
  };
  const scale = width / (photo.silhouetteX[1] - photo.silhouetteX[0]);
  const atY = y => 0.2 + (photo.groundY - y) * scale;
  const centralWidth = (photo.centerBlockX[1] - photo.centerBlockX[0]) * scale;
  const half = centralWidth / 2, sideWidth = width / 2 - half;
  const eave = atY(photo.wingEaveY), wingRidge = atY(photo.wingRidgeY);
  const hallRidge = atY(photo.hallRidgeY), gablePeak = atY(photo.gablePeakY);
  const gableValley = atY(photo.gableValleyY), deck = atY(photo.balconyTopY);
  const archBottom = atY(photo.archBottomY), archSpring = atY(photo.archSpringY);
  const archCrown = atY(photo.archCrownY), archWidth = photo.archWidthPixels * scale;
  const wallZ = -2.7, rearZ = -40.8, wingDepth = 15.5, hallRidgeZ = (rearZ + wallZ) / 2;
  const historic = clip(rectangle(-width / 2, rearZ, width / 2, 0));
  const additions = polygonClipping.difference([footprint], historic);
  slab(base, [footprint], 0.08, 0.2, floor);

  // Photo-invisible plan parts keep their map outline with deliberately quiet detail.
  slab(inferred, additions, 0.2, eave, brick);
  surface(inferred, additions, () => eave + 0.16, unseenRoof);
  const rearWings = [-1, 1].flatMap(sign => clip(rectangle(
    sign < 0 ? -width / 2 : half, rearZ, sign < 0 ? -half : width / 2, -wingDepth)));
  slab(inferred, rearWings, 0.2, eave, brick);
  surface(inferred, rearWings, () => eave + 0.16, unseenRoof);
  // Rear and side walls of the tall hall: no invented front-like rows of arch windows.
  box(inferred, 0, gableValley / 2 + 0.1, rearZ + 0.2, centralWidth, gableValley - 0.2, 0.4, brick);
  for (const sign of [-1, 1]) box(inferred, sign * (half - 0.2), gableValley / 2 + 0.1,
    (rearZ + wallZ) / 2, 0.4, gableValley - 0.2, wallZ - rearZ, brick);

  // Openings are cut out of real wall geometry; recessed glazing is behind them.
  const opening = (x, bottom, spring, crown, w) => {
    const path = new THREE.Path();
    path.moveTo(x - w / 2, bottom);
    path.lineTo(x + w / 2, bottom);
    path.lineTo(x + w / 2, spring);
    path.absellipse(x, spring, w / 2, crown - spring, 0, Math.PI, false);
    path.lineTo(x - w / 2, bottom);
    return path;
  };
  const archCenters = [-centralWidth / 3, 0, centralWidth / 3];
  for (const x of archCenters) {
    const bay = centralWidth / 3;
    const wall = new THREE.Shape([
      new THREE.Vector2(x - bay / 2, deck), new THREE.Vector2(x + bay / 2, deck),
      new THREE.Vector2(x + bay / 2, gableValley), new THREE.Vector2(x, gablePeak),
      new THREE.Vector2(x - bay / 2, gableValley),
    ]);
    wall.holes.push(opening(x, archBottom, archSpring, archCrown, archWidth));
    const geometry = new THREE.ExtrudeGeometry(wall, {depth: 0.42, bevelEnabled: false, curveSegments: 16});
    geometry.translate(0, 0, wallZ - 0.42);
    add(facade, geometry, brick);
    const aperture = new THREE.Shape(opening(x, archBottom, archSpring, archCrown, archWidth).getPoints(32));
    for (const [targetZ, mat] of [[wallZ - 0.55, shadow], [wallZ - 0.22, glass]]) {
      const pane = new THREE.ShapeGeometry(aperture, 16);
      pane.translate(0, 0, targetZ);
      add(facade, pane, mat);
    }
    // Brick arch ring with real empty center, not a rectangle around a painted arch.
    const surround = new THREE.Shape(opening(x, archBottom - 0.12, archSpring,
      archCrown + 0.16, archWidth + 0.32).getPoints(32));
    surround.holes.push(opening(x, archBottom, archSpring, archCrown, archWidth));
    const rim = new THREE.ExtrudeGeometry(surround, {depth: 0.12, bevelEnabled: false, curveSegments: 16});
    rim.translate(0, 0, wallZ - 0.02);
    add(facade, rim, brick);
    box(facade, x, archBottom - 0.09, wallZ + 0.07, archWidth + 0.28, 0.16, 0.55, stone);
    for (let column = -2; column <= 2; column++) {
      const dx = column * archWidth / 6;
      const top = archSpring + (archCrown - archSpring) * Math.sqrt(1 - (dx / (archWidth / 2)) ** 2);
      box(facade, x + dx, (archBottom + top) / 2, wallZ - 0.13, 0.055, top - archBottom, 0.06, frame);
    }
    for (const y of [archBottom + 0.46, archSpring, archSpring + 0.48]) {
      const halfSpan = y <= archSpring ? archWidth / 2
        : archWidth / 2 * Math.sqrt(1 - ((y - archSpring) / (archCrown - archSpring)) ** 2);
      box(facade, x, y, wallZ - 0.13, 2 * halfSpan, 0.055, 0.06, frame);
    }
  }

  // Low wings: two floors, a few relatively broad photo-supported window bays.
  const wingWindowCenters = [];
  for (const sign of [-1, 1]) {
    const x0 = sign < 0 ? -width / 2 : half, x1 = sign < 0 ? -half : width / 2;
    const wall = new THREE.Shape([
      new THREE.Vector2(x0, 0.2), new THREE.Vector2(x1, 0.2),
      new THREE.Vector2(x1, eave), new THREE.Vector2(x0, eave),
    ]);
    for (let bay = 0; bay < 4; bay++) for (let level = 0; level < 2; level++) {
      const x = x0 + sideWidth * (bay + 0.5) / 4;
      const bottom = level === 0 ? 1.25 : 3.65, top = level === 0 ? 2.55 : 5.65;
      const w = 1.18;
      wall.holes.push(new THREE.Path([
        new THREE.Vector2(x - w / 2, bottom), new THREE.Vector2(x + w / 2, bottom),
        new THREE.Vector2(x + w / 2, top), new THREE.Vector2(x - w / 2, top),
      ]));
      box(facade, x, (bottom + top) / 2, -0.51, w, top - bottom, 0.035, shadow);
      box(facade, x, (bottom + top) / 2, -0.24, w - 0.06, top - bottom - 0.06, 0.035, glass);
      for (const dx of [-w / 2, 0, w / 2]) box(facade, x + dx, (bottom + top) / 2,
        -0.12, 0.055, top - bottom, 0.09, frame);
      for (const y of [bottom, top]) box(facade, x, y, -0.12, w, 0.06, 0.09, frame);
      box(facade, x, bottom - 0.08, 0.03, w + 0.15, 0.13, 0.48, stone);
      wingWindowCenters.push({x, bottom, top});
    }
    const geometry = new THREE.ExtrudeGeometry(wall, {depth: 0.42, bevelEnabled: false});
    geometry.translate(0, 0, -0.42);
    add(facade, geometry, brick);
    box(facade, (x0 + x1) / 2, 3.2, -0.13, sideWidth, 0.12, 0.5, stone);
    box(facade, (x0 + x1) / 2, eave, -0.05, sideWidth, 0.18, 0.65, stone);
    for (const x of [x0 + 0.2, x1 - 0.2]) box(facade, x, (eave + 0.2) / 2,
      -wingDepth / 2, 0.4, eave - 0.2, wingDepth, brick);
    // Four independently clipped planar hip faces. Ridge is not computed by
    // lifting only rectangle corner vertices, which would leave a flat roof.
    const middleX = (x0 + x1) / 2, middleZ = -wingDepth / 2;
    const inset = Math.min(sideWidth, wingDepth) / 2;
    const lo = x0 + inset, hi = x1 - inset;
    const slope = (wingRidge - eave) / inset;
    const faces = [
      {ring: [[x0, 0], [x1, 0], [hi, middleZ], [lo, middleZ], [x0, 0]],
        h: (x, z) => eave - z * slope},
      {ring: [[x0, -wingDepth], [lo, middleZ], [hi, middleZ], [x1, -wingDepth], [x0, -wingDepth]],
        h: (x, z) => eave + (z + wingDepth) * slope},
      {ring: [[x0, 0], [lo, middleZ], [x0, -wingDepth], [x0, 0]],
        h: (x, z) => eave + (x - x0) * slope},
      {ring: [[x1, 0], [x1, -wingDepth], [hi, middleZ], [x1, 0]],
        h: (x, z) => eave + (x1 - x) * slope},
    ];
    // If depth is slightly larger than the wing width, the short ridge runs
    // north/south instead. Here photo ratios give sideWidth < wingDepth.
    const ridgeHalf = Math.max(0, (wingDepth - sideWidth) / 2);
    if (sideWidth < wingDepth) {
      const frontRidgeZ = middleZ + ridgeHalf, rearRidgeZ = middleZ - ridgeHalf;
      faces.splice(0, faces.length,
        {ring: [[x0, 0], [x1, 0], [middleX, frontRidgeZ], [x0, 0]], h: (x, z) => eave - z * slope},
        {ring: [[x0, -wingDepth], [middleX, rearRidgeZ], [x1, -wingDepth], [x0, -wingDepth]],
          h: (x, z) => eave + (z + wingDepth) * slope},
        {ring: [[x0, 0], [middleX, frontRidgeZ], [middleX, rearRidgeZ], [x0, -wingDepth], [x0, 0]],
          h: (x, z) => eave + (x - x0) * slope},
        {ring: [[x1, 0], [x1, -wingDepth], [middleX, rearRidgeZ], [middleX, frontRidgeZ], [x1, 0]],
          h: (x, z) => eave + (x1 - x) * slope});
    }
    for (const face of faces) surface(roofGroup, clip([face.ring]), face.h, tiles);
  }

  const hallHeight = (x, z) => gableValley + (hallRidge - gableValley) *
    (z >= hallRidgeZ ? (wallZ - z) / (wallZ - hallRidgeZ) : (z - rearZ) / (hallRidgeZ - rearZ));
  for (const [z0, z1] of [[rearZ, hallRidgeZ], [hallRidgeZ, wallZ]]) {
    surface(roofGroup, clip(rectangle(-half, z0, half, z1)), hallHeight, tiles);
  }
  // Front lower roof apron between gables and recessed arch wall.
  surface(roofGroup, clip(rectangle(-half, wallZ, half, 0)), () => gableValley - 0.12, tiles);
  const skyWidth = centralWidth * 0.76, skyFront = hallRidgeZ + 4.7, skyRear = hallRidgeZ + 1.35;
  surface(skylight, clip(rectangle(-skyWidth / 2, skyRear, skyWidth / 2, skyFront)),
    (x, z) => hallHeight(x, z) + 0.12, glass);
  const beam = (target, from, to, radius, mat) => B.cylinder(target, from, to, radius, radius, mat, 6);
  for (let pane = 0; pane <= 36; pane++) {
    const x = -skyWidth / 2 + skyWidth * pane / 36;
    beam(skylight, [x, hallHeight(x, skyRear) + 0.15, skyRear],
      [x, hallHeight(x, skyFront) + 0.15, skyFront], 0.024, frame);
  }
  for (const z of [skyRear, skyFront]) box(skylight, 0, hallHeight(0, z) + 0.15, z,
    skyWidth, 0.065, 0.10, frame);
  box(roofGroup, 0, hallRidge + 0.045, hallRidgeZ, centralWidth, 0.09, 0.18, tiles);

  // A genuinely open front: only columns at v=-0.38, back wall at v=-2.7.
  // No transparent front box, fake wall texture or foliage hiding the arches.
  const porchWidth = centralWidth * 0.95, columnXs = [];
  slab(porch, clip(rectangle(-half, wallZ - 0.42, half, 0)), deck - 0.30, deck, floor);
  box(porch, 0, deck - 0.17, -0.17, centralWidth, 0.34, 0.34, stone);
  for (let i = 0; i < 12; i++) {
    const x = -porchWidth / 2 + porchWidth * i / 11;
    columnXs.push(x);
    B.cylinder(porch, [x, 0.34, -0.38], [x, deck - 0.4, -0.38], 0.16, 0.135, stone, 12);
    box(porch, x, 0.29, -0.38, 0.47, 0.18, 0.47, stone);
    box(porch, x, deck - 0.36, -0.38, 0.47, 0.18, 0.47, stone);
    const railTop = atY(photo.railTopY);
    box(porch, x, (deck + railTop) / 2, -0.22, 0.19, railTop - deck, 0.22, stone);
    box(porch, x, railTop, -0.22, 0.3, 0.09, 0.32, stone);
  }
  const railTop = atY(photo.railTopY);
  for (const y of [deck + 0.22, railTop - 0.13]) box(porch, 0, y, -0.22, porchWidth, 0.04, 0.05, frame);
  for (let i = 0; i < 55; i++) box(porch, -porchWidth / 2 + porchWidth * (i + 0.5) / 55,
    (deck + railTop) / 2, -0.22, 0.025, railTop - deck - 0.26, 0.025, frame);
  // Solid rear wall is set well back, with a recessed central entrance.
  for (const sign of [-1, 1]) box(porch, sign * (centralWidth / 4 + 0.45), (deck + 0.2) / 2,
    wallZ - 0.2, centralWidth / 2 - 0.9, deck - 0.2, 0.4, brick);
  box(porch, 0, 1.5, wallZ - 0.38, 1.8, 2.6, 0.04, shadow);
  for (const x of [-0.9, 0, 0.9]) box(porch, x, 1.5, wallZ - 0.18, 0.065, 2.6, 0.08, frame);
  box(porch, 0, deck - 0.24, wallZ - 0.2, 1.8, 0.48, 0.4, brick);
  // Entry steps remain inside the mapped front envelope.
  for (let step = 0; step < 2; step++) slab(porch,
    clip(rectangle(-half, -1.0 + step * 0.28, half, 0)), 0.2, 0.24 + step * 0.06, stone);

  B.finish();
  for (const parent of detail.children) for (const mesh of parent.children) {
    mesh.userData.surfaceRole = parent.userData.surfaceRole;
  }
  detail.updateMatrixWorld(true);
  const visibleBounds = new THREE.Box3().setFromObject(detail);
  detail.userData = {
    referenceSite: 'west-gym', referencePages: [...REFERENCE_PAGES], referenceImage: REFERENCE_IMAGE,
    referenceLocalPhoto: 'projects/tsinghua-tour/photos/west-gymnasium.jpg',
    refinementSummary: '保留凹入地图轮廓；按官方正面照片重建三座红砖山墙及宽拱窗、两层低侧翼暖色坡瓦屋顶、抬高馆顶和长天窗、浅色石柱开放柱廊与栏杆；侧后增建与屋顶深度明确为推定。',
    heightSource: '官方正面照片像素比例与地图正立面边长联合估算；5米仅原显示默认高，非实测；照片透视与遮挡未校正。',
    facadeNormal: [normal[0], 0, normal[1]], frontNormalXZ: normal,
    facadeTangentXZ: tangent, facadeMapEdgeIndices: [3, 4], facadeMidpointLocal: detail.position.toArray(),
    estimatedVisibleHeight: visibleBounds.max.y,
    dimensions: {
      mapBoundsMeters: [metrics.bounds[2] - metrics.bounds[0], metrics.bounds[3] - metrics.bounds[1]],
      mapAreaSquareMeters: metrics.area, historicFrontWidth: width, centralWidth, sideWingWidth: sideWidth,
      wingEave: eave, wingRidge, hallRidge, gablePeak, gableValley, archWidth, archBottom, archSpring,
      archCrown, colonnadeDeck: deck, balustradeTop: railTop, porchDepth: -wallZ,
      historicDepthEstimate: -rearZ, wingDepthEstimate: wingDepth, skylightWidth: skyWidth,
      skylightSlopeDepthEstimate: skyFront - skyRear,
    },
    photoProportions: {...photo, estimatedMetersPerPixel: scale, centralFraction: centralWidth / width},
    arches: archCenters.map(x => ({x, bottom: archBottom, spring: archSpring, crown: archCrown,
      width: archWidth, wallZ, glassZ: wallZ - 0.22})),
    colonnade: {columnXs, columnRadius: 0.16, columnZ: -0.38, backWallZ: wallZ,
      clearBayWidth: porchWidth / 11 - 0.32, deck, railTop},
    wingWindows: wingWindowCenters,
    sourceFootprintFacadeXZ: footprint, historicRoofEnvelope: historic, inferredAdditionPolygons: additions,
    sourceOSMNameId: OSM_ID, sourceDisplayHeight: feature.properties.renderHeight,
    photoSupported: ['三宽拱窗与三红砖山墙', '两层低侧翼及暖瓦坡顶', '抬高中馆顶和连续天窗', '浅石开放柱廊与栏杆'],
    unknowns: ['绝对标高非测绘', '历史馆体与增建分界未经档案平面核实',
      '西侧、北侧及东侧突出增建不在正面照片内，体量和简化屋面为推定',
      '后立面、屋脊进深、天窗进深与侧翼被树遮住的窗数为推定',
      '未建照片中后方圆顶/远处楼体；其所属与坐标未核实'],
    noReferencePhotoTextures: true, meshCount: B.stats.batches, reconstructionLevel: 'photo-informed-estimate-not-surveyed',
  };
  return detail;
}

export function refineWestGym(campus, data) {
  const feature = data?.features?.find(item => item.id === WEST_GYM_ID);
  const root = campus?.buildings?.get(WEST_GYM_ID);
  if (!root || root.userData.featureId !== WEST_GYM_ID || !root.getObjectByName('base')) {
    throw new Error('West Gym existing building root/base identity is missing.');
  }
  const origin = root.userData.localOriginMeters;
  verifySource(feature, data.metadata?.center, origin);
  if (Math.abs(root.position.x - origin[0]) > 1e-6 || Math.abs(root.position.z - origin[1]) > 1e-6 ||
      root.position.y !== 0 || root.rotation.x !== 0 || root.rotation.y !== 0 || root.rotation.z !== 0 ||
      root.scale.x !== 1 || root.scale.y !== 1 || root.scale.z !== 1) {
    throw new Error('West Gym root placement/orientation changed; review the frozen origin.');
  }
  const detail = createWestGymDetail(feature, data.metadata.center, origin);
  const previous = root.children.find(child => child.userData.campusDetail);
  const baseRenderHeight = root.userData.baseRenderHeight ?? root.userData.renderHeight;
  // Measure the unattached detail: Box3(root) would include the hidden default base.
  // Height metadata must be correct BEFORE replaceBuilding attaches the new detail.
  Object.assign(root.userData, {
    baseRenderHeight, renderHeight: detail.userData.estimatedVisibleHeight,
    estimatedVisibleHeight: detail.userData.estimatedVisibleHeight,
    referenceSite: 'west-gym', referencePages: [...REFERENCE_PAGES],
    refinementSummary: detail.userData.refinementSummary, heightSource: detail.userData.heightSource,
    facadeNormal: detail.userData.facadeNormal, dimensions: detail.userData.dimensions,
    photoProportions: detail.userData.photoProportions, unknowns: detail.userData.unknowns,
    reconstructionLevel: 'photo-informed-estimate-not-surveyed',
  });
  replaceBuilding(campus.buildings, WEST_GYM_ID, detail);
  if (previous) {
    const materials = new Set();
    previous.traverse(object => {
      if (!object.isMesh) return;
      object.geometry.dispose();
      for (const mat of Array.isArray(object.material) ? object.material : [object.material]) materials.add(mat);
    });
    for (const mat of materials) { mat.map?.dispose(); mat.dispose(); }
  }
  root.name = '西体育馆';
  root.updateWorldMatrix(true, true);
  return root;
}
