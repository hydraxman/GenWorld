import * as THREE from 'three';
import {createBuilder} from '../../shunde/src/builder.js';
import {footprintMetrics} from './geo.js';
import {replaceBuilding} from './model.js';

export const SCIENCE_HALL_ID = 'building:geometry:91ba4cc6c7a0d501736a0fec';
const OSM_ID = 'osm:way:79701310';
const CENTER = [116.32003975, 40.00164005];
const SOURCE_RING = [
  [116.317593455, 40.001829514], [116.317641735, 40.001278869],
  [116.317893863, 40.001291197], [116.317845583, 40.001841842],
  [116.317593455, 40.001829514],
];
const PAGES = [
  'https://www.tsinghua.edu.cn/zjqh/xyfg/xyjg.htm',
  'https://www.tsinghua.edu.cn/info/1360/1394.htm',
  'https://www.tsinghua.org.cn/info/1954/13286.htm',
];
const LOCAL_PHOTO = 'references/science-hall-official-east.png';
const SUMMARY = '1919年科学馆，非生命科学馆：保留冻结四边形基座及东向长立面；'
  + '照片支持的三层红砖、非等距三联/单窗组合、中央双层高圆拱入口与小山墙、石基、'
  + '灰褐色四坡顶及两条低屋顶采光窗；背面仅估算外壳，遮挡窗列、屋顶深度和高度非测绘。';
const UNKNOWNS = [
  '只有一张已成功取得并实际查看的官方完整正面照片；未获得可靠侧后照片或测绘图。',
  '照片透视及高机位未作摄影测量校正，绝对高度、坡度、檐口厚度均为估算。',
  '右翼受树木及爬藤遮挡，采用左翼三联/单窗节奏补全；底层遮挡窗位也是估算。',
  '背面和南北端仅保留全轮廓外壳与石基，不宣称已复原逐窗、后门或室内。',
  '屋顶采光窗进深、中央山墙屋面交接、门扇分格和台阶数量为估算。',
  '入口英文为程序字形示意，保留文献拼写SCIENCE BVILDING；未摹刻原题字及微小雕饰。',
  '不建照片两侧其他建筑、远方天文台、树木、爬藤或施工设施，不把它们并入本ID。',
];

function verifySource(feature, center, origin) {
  const p = feature?.properties, g = feature?.geometry;
  if (feature?.id !== SCIENCE_HALL_ID || p?.kind !== 'building' || p.name !== '科学馆' ||
      p.nameSourceFeatureId !== OSM_ID || p.nameSource !== 'osm-local-extract-building-overlap' ||
      p.nameConfidence !== 0.995 || p.renderHeight !== 5 || p.minHeight !== 0 ||
      p.extrude !== true || g?.type !== 'Polygon' || g.coordinates?.length !== 1 ||
      g.coordinates[0]?.length !== SOURCE_RING.length ||
      g.coordinates[0].some((point, i) => !Array.isArray(point) || point.length !== 2 ||
        point.some((v, j) => !Number.isFinite(v) || Math.abs(v - SOURCE_RING[i][j]) > 1e-10))) {
    throw new Error('Science Hall frozen geometry/OSM identity changed; re-review 科学馆, not a nearby POI.');
  }
  if (!Array.isArray(center) || center.length !== 2 ||
      center.some((v, i) => !Number.isFinite(v) || Math.abs(v - CENTER[i]) > 1e-10)) {
    throw new Error('Science Hall frozen projection center changed.');
  }
  const metrics = footprintMetrics(g, center);
  if (!Array.isArray(origin) || origin.length !== 2 ||
      origin.some((v, i) => !Number.isFinite(v) || Math.abs(v - metrics.origin[i]) > 1e-6)) {
    throw new Error('Science Hall local origin changed.');
  }
  return metrics;
}

// Generated low-contrast courses, NOT a crop, tracing texture, or photographic texture.
function courseTexture(roof) {
  const size = 64, pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const row = Math.floor(y / 16), joint = y % 16 === 0 || (x + (row % 2) * 16) % 32 === 0;
    const color = roof ? [126, 119, 105] : [151, 87, 69];
    const shade = roof ? 3 * Math.sin((x % 16) / 16 * Math.PI) - (y % 16 < 2 ? 5 : 0)
      : (joint ? 13 : ((x * 7 + y * 11) % 5) - 2);
    const index = (y * size + x) * 4;
    for (let c = 0; c < 3; c++) pixels[index + c] = color[c] + shade;
    pixels[index + 3] = 255;
  }
  const texture = new THREE.DataTexture(pixels, size, size);
  texture.name = `Science Hall generated ${roof ? 'clay roof courses' : 'brick courses'} — no photograph`;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = roof ? 8 : 4;
  texture.needsUpdate = true;
  return texture;
}

function rectanglePath(x, bottom, width, height) {
  const path = new THREE.Path();
  path.moveTo(x - width / 2, bottom);
  path.lineTo(x + width / 2, bottom);
  path.lineTo(x + width / 2, bottom + height);
  path.lineTo(x - width / 2, bottom + height);
  path.closePath();
  return path;
}

function archPath(x, bottom, spring, crown, width) {
  const path = new THREE.Path();
  path.moveTo(x - width / 2, bottom);
  path.lineTo(x + width / 2, bottom);
  path.lineTo(x + width / 2, spring);
  path.absellipse(x, spring, width / 2, crown - spring, 0, Math.PI, false);
  path.closePath();
  return path;
}

// Minimal independent procedural glyphs, no font/image download at runtime.
const GLYPHS = {
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  N: ['10001', '11001', '11001', '10101', '10011', '10011', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  V: ['10001', '10001', '10001', '10001', '01010', '01010', '00100'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  G: ['01111', '10000', '10000', '10111', '10001', '10001', '01111'],
};

function makeDetail(feature, center, origin, metrics) {
  const r = metrics.projected[0][0], a = r[2], b = r[3];
  const width = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const tangent = [(b[0] - a[0]) / width, (b[1] - a[1]) / width];
  const normal = [-tangent[1], tangent[0]];
  const midpoint = a.map((v, i) => (v + b[i]) / 2);
  const footprint = r.map(p => {
    const x = p[0] - midpoint[0], z = p[1] - midpoint[1];
    return [x * tangent[0] + z * tangent[1], x * normal[0] + z * normal[1]];
  });
  const depth = -(footprint[0][1] + footprint[1][1]) / 2;
  const skew = (footprint[0][0] + footprint[1][0]) / 2;
  const detail = new THREE.Group();
  detail.name = '科学馆（1919）· 东立面照片参考估算';
  detail.position.set(midpoint[0] - origin[0], 0, midpoint[1] - origin[1]);
  detail.rotation.y = -Math.atan2(tangent[1], tangent[0]);
  const group = (name, role, confidence) => {
    const g = new THREE.Group();
    g.name = name;
    g.userData = {surfaceRole: role, confidence};
    detail.add(g);
    return g;
  };
  const foundation = group('Exact frozen quadrilateral foundation', 'foundation', 'frozen-map');
  const facade = group('Three-storey clustered east facade', 'east-facade', 'photo-informed/occluded-bays-estimated');
  const entry = group('Double-height round-arched entry and small brick gable', 'central-entry', 'photo-informed/detail-estimate');
  const roof = group('Broad grey-brown hipped roof', 'hipped-roof', 'photo-informed-front/estimated-depth-and-height');
  const lights = group('Two long low shed roof lights', 'roof-lights', 'photo-informed-front/estimated-depth');
  const back = group('Quiet western and end shells — NOT verified rear elevations', 'estimated-back', 'estimate-no-back-photo');
  const B = createBuilder(THREE, 79701310);
  const mat = (name, opts) => new THREE.MeshStandardMaterial({
    name: `Science Hall ${name}`, roughness: 0.9, ...opts,
  });
  const brick = mat('procedural muted red brick', {color: '#ffffff', map: courseTexture(false), side: THREE.DoubleSide});
  const tiles = mat('procedural quiet grey-brown tiles', {color: '#ffffff', map: courseTexture(true), side: THREE.DoubleSide});
  B.textureWorld.set(brick, [0.64, 0.3]);
  B.textureWorld.set(tiles, [0.72, 0.72]);
  const stone = mat('grey pale plinth and sills', {color: '#b9b6a6'});
  const glass = mat('dark recessed steel-window glazing', {color: '#304341', roughness: 0.3, metalness: 0.14, side: THREE.DoubleSide});
  const steel = mat('slender dark window bars', {color: '#434c43', roughness: 0.65});
  const bronze = mat('aged bronze door and sign', {color: '#776748', roughness: 0.65, metalness: 0.45});
  const lettering = mat('approximate pale sign lettering', {color: '#c4bc9e'});
  const add = (g, geometry, material) => { B.worldUV(geometry, material); B.add(g, geometry, material); };
  const box = (g, x, y, z, w, h, d, m) => B.box(g, '', x, y, z, w, h, d, m);
  const surface = (g, vertices, m) => {
    const geometry = new THREE.BufferGeometry();
    const values = [];
    for (let i = 1; i < vertices.length - 1; i++) values.push(...vertices[0], ...vertices[i], ...vertices[i + 1]);
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(values, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(new Array(values.length / 3 * 2).fill(0), 2));
    geometry.computeVertexNormals();
    add(g, geometry, m);
  };
  const solid = (g, shape, bottom, top, material) => {
    const geometry = new THREE.ExtrudeGeometry(shape, {depth: top - bottom, steps: 1, bevelEnabled: false});
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(0, bottom, 0);
    add(g, geometry, material);
  };
  const plan = new THREE.Shape(footprint.map(([x, z]) => new THREE.Vector2(x, -z)));
  solid(foundation, plan, 0.08, 0.2, stone);

  // Approximate landmarks actually viewed in the locally saved 1920x900 image.
  // Width is the MAP edge. Only wall-level y differences are used as a rough scale.
  // Roof ridge is NOT (groundY-imageRidgeY)*scale: the elevated camera shows roof depth.
  const photo = {
    size: [1920, 900], wallExtentX: [354, 1544], centralAxisX: 960,
    groundY: 734, eaveY: 489, centralGablePeakY: 429,
    windowBottomYs: [708, 632, 549], windowHeightPixels: 47, windowWidthPixels: 21,
    leftWindowXs: [419, 454, 486, 546, 607, 640, 672, 730, 789, 822, 855],
    portalX: [927, 993], portalBottomY: 710, portalSpringY: 618, portalCrownY: 586,
    roofLightXExtents: [[644, 844], [1074, 1273]],
    caveat: 'Approximate pixel landmarks, no camera calibration; mirrored/occluded bays are estimates.',
  };
  const scale = width / (photo.wallExtentX[1] - photo.wallExtentX[0]);
  const atY = y => 0.2 + (photo.groundY - y) * scale;
  const eave = atY(photo.eaveY), gablePeak = atY(photo.centralGablePeakY);
  const plinth = 1.35, half = width / 2, gableWidth = 160 * scale;
  const windowWidth = photo.windowWidthPixels * scale, windowHeight = photo.windowHeightPixels * scale;
  const frontZ = -0.55, centralZ = 0.04;
  const leftXs = photo.leftWindowXs.map(x => (x - photo.centralAxisX) * scale);
  const wingXs = [...leftXs, ...leftXs.map(x => -x)];
  const windowRecords = [];

  const wall = (target, x0, x1, face, openings, peaked = false) => {
    const outline = [[x0, 0.2], [x1, 0.2], [x1, eave]];
    if (peaked) outline.push([0, gablePeak]);
    outline.push([x0, eave]);
    const shape = new THREE.Shape(outline.map(p => new THREE.Vector2(...p)));
    shape.holes.push(...openings);
    const geometry = new THREE.ExtrudeGeometry(shape, {depth: 0.46, bevelEnabled: false, curveSegments: 24});
    geometry.translate(0, 0, face - 0.46);
    add(target, geometry, brick);
  };
  const wingOpenings = [[], []], centerOpenings = [];
  for (let row = 0; row < 3; row++) {
    const bottom = atY(photo.windowBottomYs[row]);
    const xs = row === 2 ? [...wingXs, -24 * scale, 24 * scale] : wingXs;
    for (const x of xs) {
      const central = Math.abs(x) < gableWidth / 2;
      const z = central ? centralZ : frontZ;
      const target = central ? entry : facade;
      const opening = rectanglePath(x, bottom, windowWidth, windowHeight);
      (central ? centerOpenings : wingOpenings[x < 0 ? 0 : 1]).push(opening);
      // Real holes, glazing recessed 14 cm, slender 3-column x 6-row steel lattice.
      box(target, x, bottom + windowHeight / 2, z - 0.14, windowWidth, windowHeight, 0.025, glass);
      for (const dx of [-windowWidth / 2, -windowWidth / 6, windowWidth / 6, windowWidth / 2])
        box(target, x + dx, bottom + windowHeight / 2, z - 0.085, 0.034, windowHeight, 0.055, steel);
      for (let bar = 0; bar <= 6; bar++)
        box(target, x, bottom + bar * windowHeight / 6, z - 0.085, windowWidth, 0.035, 0.055, steel);
      box(target, x, bottom - 0.06, z + 0.045, windowWidth + 0.14, 0.12, 0.28, stone);
      box(target, x, bottom + windowHeight + 0.045, z + 0.014, windowWidth + 0.14, 0.09, 0.13, brick);
      windowRecords.push({x, bottom, width: windowWidth, height: windowHeight, faceZ: z,
        confidence: x < 0 && row > 0 ? 'visible-photo-layout' : 'occluded-or-mirrored-estimate'});
    }
  }
  const portal = {
    x: 0, width: (photo.portalX[1] - photo.portalX[0]) * scale,
    bottom: atY(photo.portalBottomY), spring: atY(photo.portalSpringY),
    crown: atY(photo.portalCrownY), faceZ: centralZ, glassZ: centralZ - 0.24,
  };
  centerOpenings.push(archPath(0, portal.bottom, portal.spring, portal.crown, portal.width));
  wall(facade, -half, -gableWidth / 2, frontZ, wingOpenings[0]);
  wall(facade, gableWidth / 2, half, frontZ, wingOpenings[1]);
  wall(entry, -gableWidth / 2, gableWidth / 2, centralZ, centerOpenings, true);
  // Close the two 59 cm risalit returns, not a fake detached portico.
  for (const sign of [-1, 1])
    box(entry, sign * (gableWidth / 2 - 0.09), (eave + 0.2) / 2,
      (centralZ + frontZ) / 2 - 0.15, 0.18, eave - 0.2, centralZ - frontZ + 0.3, brick);
  for (const sign of [-1, 1]) {
    const start = portal.width / 2 + 0.12, end = half;
    box(facade, sign * (start + end) / 2, (plinth + 0.2) / 2,
      frontZ + 0.05, end - start, plinth - 0.2, 0.5, stone);
  }

  // Non-front shell follows the real skew quadrilateral, rather than a bbox.
  for (const [i, j] of [[0, 1], [1, 2], [3, 0]]) {
    const [x0, z0] = footprint[i], [x1, z1] = footprint[j];
    surface(back, [[x0, 0.2, z0], [x1, 0.2, z1], [x1, eave, z1], [x0, eave, z0]], brick);
    const length = Math.hypot(x1 - x0, z1 - z0);
    B.box(back, '', (x0 + x1) / 2, (plinth + 0.2) / 2, (z0 + z1) / 2,
      length, plinth - 0.2, 0.22, stone, -Math.atan2(z1 - z0, x1 - x0));
  }
  // Only quiet interior darkness; no invented rooms or rear window schedule.
  solid(back, plan, 0.2, 0.24, steel);

  const aperture = new THREE.Shape(archPath(0, portal.bottom, portal.spring, portal.crown, portal.width).getPoints(48));
  const pane = new THREE.ShapeGeometry(aperture, 24);
  pane.translate(0, 0, portal.glassZ);
  add(entry, pane, glass);
  const rim = new THREE.Shape(archPath(0, portal.bottom, portal.spring, portal.crown + 0.23, portal.width + 0.46).getPoints(48));
  rim.holes.push(archPath(0, portal.bottom, portal.spring, portal.crown, portal.width));
  const archRing = new THREE.ExtrudeGeometry(rim, {depth: 0.16, bevelEnabled: false, curveSegments: 24});
  archRing.translate(0, 0, centralZ - 0.05);
  add(entry, archRing, brick);
  const doorTop = 4.05, signY = 4.37;
  for (const sign of [-1, 1]) {
    box(entry, sign * portal.width / 4, (doorTop + portal.bottom) / 2, centralZ - 0.19,
      portal.width / 2 - 0.1, doorTop - portal.bottom, 0.07, bronze);
    for (let bar = 1; bar < 4; bar++)
      box(entry, sign * portal.width / 4, portal.bottom + bar * (doorTop - portal.bottom) / 4,
        centralZ - 0.145, portal.width / 2 - 0.17, 0.05, 0.06, steel);
    for (const dx of [-0.48, 0.48])
      box(entry, sign * portal.width / 4 + dx, (doorTop + portal.bottom) / 2,
        centralZ - 0.145, 0.05, doorTop - portal.bottom, 0.06, steel);
    box(entry, sign * 0.16, 2.58, centralZ - 0.095, 0.05, 0.38, 0.065, bronze);
    // Small paired lanterns seen beside the entrance.
    box(entry, sign * (portal.width / 2 + 1.05), 3.25, centralZ + 0.08, 0.13, 0.55, 0.2, steel);
  }
  box(entry, 0, signY, centralZ - 0.1, portal.width - 0.08, 0.43, 0.12, bronze);
  const text = 'SCIENCE BVILDING', cell = 0.027, textWidth = (text.length * 6 - 1) * cell;
  for (let i = 0; i < text.length; i++) {
    const glyph = GLYPHS[text[i]];
    if (!glyph) continue;
    for (let y = 0; y < 7; y++) for (let x = 0; x < 5; x++) if (glyph[y][x] === '1')
      box(entry, -textWidth / 2 + (i * 6 + x + 0.5) * cell,
        signY + (3 - y) * cell, centralZ - 0.027, cell * 0.82, cell * 0.82, 0.015, lettering);
  }
  // Round-arched fanlight bars actually follow the arch, not a rectangular decal.
  for (let bar = -4; bar <= 4; bar++) {
    const x = bar * portal.width / 10;
    const top = portal.spring + (portal.crown - portal.spring) * Math.sqrt(1 - (2 * x / portal.width) ** 2);
    box(entry, x, (4.64 + top) / 2, centralZ - 0.175, 0.041, top - 4.64, 0.06, steel);
  }
  for (const y of [4.65, 5.18, 5.72, portal.spring, 6.7, 7.2]) {
    const span = y <= portal.spring ? portal.width
      : portal.width * Math.sqrt(1 - ((y - portal.spring) / (portal.crown - portal.spring)) ** 2);
    box(entry, 0, y, centralZ - 0.175, span, 0.041, 0.06, steel);
  }
  const steps = 8, stairDepth = 2.2, stairWidth = portal.width + 1.65;
  for (let step = 0; step < steps; step++) {
    const top = 0.2 + (portal.bottom - 0.2) * (step + 1) / steps;
    const run = stairDepth * (steps - step) / steps;
    box(entry, 0, (0.2 + top) / 2, centralZ + run / 2, stairWidth, top - 0.2, run, stone);
  }
  // Small plain pale gable medallion; unreadable carving is deliberately not fabricated.
  const badge = new THREE.CircleGeometry(0.29, 20);
  badge.translate(0, gablePeak - 1.65, centralZ + 0.025);
  add(entry, badge, stone);

  // A broad hip roof, not a gable-ended rectangle and not a noisy photo texture.
  const overhang = 0.55, roofRise = depth * 0.245, ridgeHeight = eave + roofRise;
  const ridgeZ = -depth / 2, ridgeHalf = half - depth / 2;
  const roofFront = overhang, roofBack = -depth - overhang;
  const leftFront = [-half - overhang, eave, roofFront];
  const rightFront = [half + overhang, eave, roofFront];
  const leftBack = [-half + skew - overhang, eave, roofBack];
  const rightBack = [half + skew + overhang, eave, roofBack];
  const ridgeLeft = [-ridgeHalf + skew / 2, ridgeHeight, ridgeZ];
  const ridgeRight = [ridgeHalf + skew / 2, ridgeHeight, ridgeZ];
  const facets = [
    [leftFront, rightFront, ridgeRight, ridgeLeft],
    [rightBack, leftBack, ridgeLeft, ridgeRight],
    [leftBack, leftFront, ridgeLeft], [rightFront, rightBack, ridgeRight],
  ];
  for (const face of facets) surface(roof, face, tiles);
  box(roof, skew / 2, ridgeHeight + 0.07, ridgeZ, ridgeHalf * 2 + 0.16, 0.14, 0.18, tiles);
  for (const [x, z, length] of [[0, roofFront, width + overhang * 2], [skew, roofBack, width + overhang * 2]])
    box(roof, x, eave - 0.1, z, length, 0.19, 0.18, stone);
  // The little central brick gable terminates into the big front roof slope.
  const slope = roofRise / (depth / 2 + overhang);
  const gableMeetZ = overhang - (gablePeak - eave) / slope;
  for (const sign of [-1, 1]) {
    surface(roof, [[sign * gableWidth / 2, eave, centralZ + 0.12],
      [0, gablePeak, centralZ + 0.12], [0, gablePeak, gableMeetZ],
      [sign * gableWidth / 2, gablePeak, gableMeetZ]], tiles);
  }
  const roofY = z => eave + (overhang - z) * slope;
  const lightWidth = 199.5 * scale, lightXs = [-215.5 * scale, 215.5 * scale];
  const lightFrontZ = -5.05, lightBackZ = -6.25, lightHeight = 0.63;
  for (const x of lightXs) {
    const bottom = roofY(lightFrontZ) + 0.06, top = bottom + lightHeight;
    box(lights, x, (bottom + top) / 2, lightFrontZ, lightWidth, lightHeight, 0.08, glass);
    for (const y of [bottom, top])
      box(lights, x, y, lightFrontZ + 0.05, lightWidth + 0.2, 0.08, 0.15, stone);
    for (let bar = 0; bar <= 7; bar++)
      box(lights, x - lightWidth / 2 + bar * lightWidth / 7, (bottom + top) / 2,
        lightFrontZ + 0.05, 0.075, lightHeight, 0.12, stone);
    const rearTop = roofY(lightBackZ) + 0.13;
    surface(lights, [[x - lightWidth / 2, top + 0.06, lightFrontZ],
      [x + lightWidth / 2, top + 0.06, lightFrontZ],
      [x + lightWidth / 2, rearTop, lightBackZ], [x - lightWidth / 2, rearTop, lightBackZ]], tiles);
    for (const sign of [-1, 1])
      surface(lights, [[x + sign * lightWidth / 2, bottom, lightFrontZ],
        [x + sign * lightWidth / 2, top, lightFrontZ],
        [x + sign * lightWidth / 2, rearTop, lightBackZ]], tiles);
  }
  B.finish();
  let triangles = 0, vertices = 0;
  detail.traverse(object => {
    if (!object.isMesh) return;
    object.userData.surfaceRole = object.parent.userData.surfaceRole;
    object.userData.confidence = object.parent.userData.confidence;
    const position = object.geometry.attributes.position;
    if (!position.array.every(Number.isFinite)) throw new Error('Science Hall produced non-finite detail geometry.');
    vertices += position.count;
    triangles += (object.geometry.index?.count ?? position.count) / 3;
  });
  detail.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(detail);
  detail.userData = {
    referenceSite: 'science-hall', referencePages: [...PAGES], referenceLocalPhotos: [LOCAL_PHOTO],
    refinementSummary: SUMMARY, unknowns: [...UNKNOWNS],
    sourceOSMNameId: OSM_ID, sourceDisplayHeight: feature.properties.renderHeight,
    sourceNameOverlapConfidence: feature.properties.nameConfidence,
    facadeNormal: [normal[0], 0, normal[1]], viewDirection: [normal[0], 0, normal[1]],
    facadeTangentXZ: tangent, facadeMapEdgeIndices: [2, 3],
    sourceFootprintFacadeXZ: footprint, facadeMidpointLocal: detail.position.toArray(),
    reconstructionExtent: 'whole-footprint-estimate',
    reconstructionLevel: 'photo-informed-estimate-not-surveyed',
    heightSource: '东立面照片窗墙像素比例+冻结地图长边联合估算；坡顶按地图进深推定；非测绘、非实测，原5米为底模显示高度。',
    estimatedVisibleHeight: bounds.max.y, detailBoundsLocal: {min: bounds.min.toArray(), max: bounds.max.toArray()},
    dimensions: {
      frontWidth: width, footprintDepth: depth, footprintSkew: skew,
      mapAreaSquareMeters: metrics.area,
      mapBoundsMeters: [metrics.bounds[2] - metrics.bounds[0], metrics.bounds[3] - metrics.bounds[1]],
      eave, ridgeHeight, roofRise, gableWidth, gablePeak, plinth,
      windowWidth, windowHeight, roofOverhang: overhang, frontRecess: -frontZ,
      stairWidth, stairDepth, lightWidth, lightXs, lightFrontZ, lightBackZ, lightHeight,
    },
    photoProportions: {...photo, estimatedWallMetersPerPixel: scale},
    frontWindows: windowRecords, portal, stairCountEstimate: steps,
    roofFacets: facets, roofLightCount: lightXs.length, englishSign: text,
    noReferencePhotoTextures: true, meshCount: B.stats.batches, geometryMetrics: {vertices, triangles},
  };
  return detail;
}

function disposeDetail(detail) {
  const materials = new Set(), textures = new Set();
  detail.traverse(object => {
    if (!object.isMesh) return;
    object.geometry.dispose();
    for (const m of Array.isArray(object.material) ? object.material : [object.material]) materials.add(m);
  });
  for (const m of materials) { if (m.map) textures.add(m.map); m.dispose(); }
  for (const t of textures) t.dispose();
}

export function refineScienceHall(campus, data) {
  const matches = data?.features?.filter(f => f.id === SCIENCE_HALL_ID) ?? [];
  const root = campus?.buildings?.get(SCIENCE_HALL_ID);
  if (matches.length !== 1 || !root || root.userData.featureId !== SCIENCE_HALL_ID ||
      root.userData.nameSourceFeatureId !== OSM_ID || root.userData.name !== '科学馆' ||
      !root.children.some(child => child.name === 'base')) {
    throw new Error('Science Hall unique existing frozen building root/base identity is missing.');
  }
  const origin = root.userData.localOriginMeters;
  const metrics = verifySource(matches[0], data.metadata?.center, origin);
  if (root.position.x !== origin[0] || root.position.z !== origin[1] || root.position.y !== 0 ||
      root.rotation.x !== 0 || root.rotation.y !== 0 || root.rotation.z !== 0 ||
      root.scale.x !== 1 || root.scale.y !== 1 || root.scale.z !== 1) {
    throw new Error('Science Hall root placement/orientation changed.');
  }
  const previous = root.children.filter(child => child.userData.campusDetail);
  if (previous.length > 1) throw new Error('Science Hall root already has duplicate details.');
  const detail = makeDetail(matches[0], data.metadata.center, origin, metrics);
  // Measure unattached DETAIL only; hidden base geometry must never set renderHeight.
  const height = new THREE.Box3().setFromObject(detail).max.y;
  replaceBuilding(campus.buildings, SCIENCE_HALL_ID, detail);
  Object.assign(root.userData, {
    baseRenderHeight: matches[0].properties.renderHeight,
    renderHeight: height, estimatedVisibleHeight: height,
    referenceSite: 'science-hall', referencePages: [...PAGES], referenceLocalPhotos: [LOCAL_PHOTO],
    refinementSummary: SUMMARY, unknowns: [...UNKNOWNS],
    heightSource: detail.userData.heightSource, facadeNormal: detail.userData.facadeNormal,
    viewDirection: detail.userData.viewDirection, dimensions: detail.userData.dimensions,
    reconstructionExtent: 'whole-footprint-estimate',
    reconstructionLevel: 'photo-informed-estimate-not-surveyed',
  });
  if (previous[0]) disposeDetail(previous[0]);
  root.updateWorldMatrix(true, true);
  return root;
}
