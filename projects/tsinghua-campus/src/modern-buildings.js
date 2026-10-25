import * as THREE from 'three';
import {createBuilder} from '../../shunde/src/builder.js';
import {footprintMetrics} from './geo.js';
import {replaceBuilding, disposeOwnedDetail} from './model.js';
import sources from '../data/modern-building-sources.json' with {type: 'json'};
import catalog from '../reference-catalog.json' with {type: 'json'};
import {createMasonryMaterial, createGlazingMaterial} from './surface-materials.js';

export const MODERN_BUILDINGS = sources.buildings;
const LIMITS = {
  'art-museum': '南向柱廊、水平石材分带、悬挑筛墙与屋顶采光阵列受校方照片约束；柱数、退台、采光器数量和高度按比例估算，背面仅轮廓外壳。未复刻雕塑、馆名书法、展览和室内。',
  'sports-center': '校方照片支持椭圆馆体、浅穹顶、白色大跨拱架、上层窗带与入口台阶；矩形地图轮廓保留作平台，不把它改成圆形地图建筑。拱架剖面、后屋面、标高和结构节点为估算，不是工程结构模型。',
  'music-hall': '场馆官网外景支持红砖长墙、倒三角高窗、竖向折面及成组落地门；分格数量、波形檐口、后屋面与背面为估算，仅南立面细化。不是蒙民伟人文楼或学生文化活动中心；题字未摹刻。',
};
const SUMMARIES = {
  'art-museum': '艺术博物馆：保留东侧凹口与原地图根；细化水平石材分带、退入玻璃、通透柱廊、上层筛墙和屋顶采光阵列。背面、构件数量和尺寸为照片比例估算，非测绘。',
  'sports-center': '综合体育馆：矩形平台内重建椭圆馆体、分层窗带、肋纹浅穹顶、通透白色拱架及分段入口台阶；隐蔽面、结构截面和尺寸为估算，非测绘。',
  'music-hall': '蒙民伟音乐厅：保留主厅与西侧附属体原轮廓；南侧红砖折面、倒三角高窗、成组玻璃门和缓弧檐口为照片参照局部重建，背面和尺寸为估算，非测绘。',
};

function sourceFor(feature) {
  const source = MODERN_BUILDINGS.find(item => item.featureId === feature?.id);
  if (!source || feature.properties?.kind !== 'building' || feature.properties.name !== source.name ||
      feature.properties.nameSource !== 'osm-local-extract-building-overlap' ||
      feature.properties.nameSourceFeatureId !== `osm:way:${source.osmWay}` ||
      feature.properties.nameConfidence !== source.nameConfidence ||
      feature.properties.renderHeight !== 5 || feature.properties.minHeight !== 0 ||
      feature.properties.extrude !== true || feature.geometry?.type !== 'Polygon' ||
      JSON.stringify(feature.geometry.coordinates) !== JSON.stringify([source.ring])) {
    throw new Error('Modern campus building frozen geometry/identity changed; re-review the source.');
  }
  return source;
}

function clip(ring, axis, limit, keepBelow = true) {
  const result = [], sign = keepBelow ? 1 : -1;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    const da = (limit - a[axis]) * sign, db = (limit - b[axis]) * sign;
    if (da >= -1e-8) result.push(a);
    if (da * db < 0) {
      const t = da / (da - db);
      result.push(a.map((v, j) => v + (b[j] - v) * t));
    }
  }
  return result;
}

function buildContext(source, metrics, origin) {
  const projected = metrics.projected[0][0].slice(0, -1);
  const [a, b] = source.frontEdge.map(index => projected[index]);
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const east = [(b[0] - a[0]) / length, (b[1] - a[1]) / length], south = [-east[1], east[0]];
  const mid = a.map((v, i) => (v + b[i]) / 2);
  const ring = projected.map(p => {
    const dx = p[0] - mid[0], dz = p[1] - mid[1];
    return [dx * east[0] + dz * east[1], dx * south[0] + dz * south[1]];
  });
  const detail = new THREE.Group();
  detail.name = `${source.name} · 照片参照估算`;
  detail.position.set(mid[0] - origin[0], 0, mid[1] - origin[1]);
  detail.rotation.y = -Math.atan2(east[1], east[0]);
  const B = createBuilder(THREE, Number(source.osmWay));
  const group = name => {const g = new THREE.Group(); g.name = name; detail.add(g); return g;};
  const material = (name, options) => new THREE.MeshStandardMaterial({
    name: `${source.referenceSite}:${name}`, roughness: .88, ...options,
  });
  const M = {
    wall: createMasonryMaterial(`${source.referenceSite}:masonry`,
      source.referenceSite === 'art-museum' ? [188, 155, 136] : [174, 96, 56], source.referenceSite === 'art-museum'),
    stone: createMasonryMaterial(`${source.referenceSite}:paving`, [193, 185, 171], true),
    metal: material('metal', {color: '#d9dbd8', metalness: .25, roughness: .64}),
    arch: material('painted-arch', {color: '#fffefa', metalness: 0, roughness: .6}),
    dark: material('frame', {color: '#515a58', metalness: .2, roughness: .7}),
    glass: createGlazingMaterial(`${source.referenceSite}:glass`),
    roof: material('roof', {color: '#b6b0a0', metalness: .3, roughness: .68, side: THREE.DoubleSide}),
    roofSeam: material('roof-seam', {color: '#827c70', metalness: .3, roughness: .7}),
  };
  B.textureWorld.set(M.wall, [source.referenceSite === 'art-museum' ? 9 : 1, source.referenceSite === 'art-museum' ? 4 : .64]);
  B.textureWorld.set(M.stone, [6, 3]);
  function extrude(group, polygon, bottom, top, mat) {
    if (polygon.length < 3 || top <= bottom) throw new Error('Invalid modern building prism.');
    const shape = new THREE.Shape(polygon.map(([x, z]) => new THREE.Vector2(x, -z)));
    const geo = new THREE.ExtrudeGeometry(shape, {depth: top - bottom, bevelEnabled: false, curveSegments: 1});
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, bottom, 0);
    B.worldUV(geo, mat); B.add(group, geo, mat);
  }
  const box = (g, x, y, z, w, h, d, m, yaw = 0) => B.box(g, '', x, y, z, w, h, d, m, yaw);
  const beam = (g, a, b, radius, m = M.metal) => B.cylinder(g, a, b, radius, radius, m, 8);
  const depth = -Math.min(...ring.map(p => p[1]));
  extrude(group('Exact frozen footprint foundation'), ring, 0, .28, M.stone);
  return {detail, B, M, ring, width: length, depth, south, group, extrude, box, beam};
}

function artMuseum(C) {
  const {M, ring, width: w, depth: d, group, extrude, box, B} = C;
  const core = group('Inset museum core and open portico');
  const upper = group('Deep upper facade screen and continuous fascia');
  const columns = group('Open two-stage stone and steel colonnade');
  const roof = group('Estimated roof daylight-monitor array');
  const coreRing = clip(clip(ring, 1, -7.0), 0, w / 2 - 6);
  extrude(core, coreRing, .28, 25.2, M.wall);
  extrude(core, clip(ring, 0, -w * .24), .28, 11.4, M.wall);
  extrude(upper, ring, 22.8, 26, M.wall);
  const frontGlass = group('Recessed south curtain wall');
  box(frontGlass, w * .12, 6.3, -6.85, w * .67, 11.9, .15, M.glass);
  box(frontGlass, 0, 17.7, -6.85, w - 8, 10.0, .15, M.glass);
  for (let x = -w * .20; x < w * .46; x += 3.2) {
    box(frontGlass, x, 6.3, -6.69, .12, 11.9, .18, M.dark);
  }
  for (const y of [3.3, 6.3, 9.3]) box(frontGlass, w * .12, y, -6.68, w * .67, .1, .2, M.dark);
  const bays = 18, pitch = (w - 8) / bays;
  for (let i = 0; i < bays; i++) {
    const x = -w / 2 + 4 + (i + .5) * pitch;
    box(upper, x, 18, -1.4, pitch * .64, 9.6, 2.8, M.wall);
  }
  for (let i = 0; i < 11; i++) {
    const x = -w * .16 + i * w * .06;
    B.cylinder(columns, [x, .28, -2.3], [x, 11.6, -2.3], .8, .8, M.wall, 24);
    B.cylinder(columns, [x, 11.6, -2.3], [x, 22.8, -2.3], .36, .36, M.dark, 16);
  }
  // Clip the eastern portico to the original notch instead of spanning it with a box.
  for (const z of [-6, -12, -42, -48]) {
    if (z < -d + 3) continue;
    B.cylinder(columns, [w / 2 - 3, .28, z], [w / 2 - 3, 11.6, z], .8, .8, M.wall, 24);
    B.cylinder(columns, [w / 2 - 3, 11.6, z], [w / 2 - 3, 22.8, z], .36, .36, M.dark, 16);
  }
  let monitorCount = 0;
  for (let row = 0; row < 5; row++) for (let col = 0; col < 12; col++) {
    const x = -w / 2 + 9 + col * (w - 26) / 11, z = -9 - row * (d - 18) / 4;
    if (x > w * .16 && z < -d * .38 && z > -d * .60) continue;
    monitorCount++;
    box(roof, x, 26.25, z, 2.9, .5, 2.5, M.dark);
    box(roof, x, 26.85, z - .45, 3.25, .8, 1.65, M.metal);
    box(roof, x, 26.78, z + .68, 2.9, .7, .08, M.glass);
    box(roof, x, 27.3, z, 3.4, .12, 2.7, M.metal);
  }
  C.dimensions = {eave: 26, porticoDepth: 7, upperScreenBays: bays,
    roofMonitorCount: monitorCount, status: 'photo-proportion-estimate'};
}

function sportsCenter(C) {
  const {M, width: w, depth: d, group, box, B, beam} = C;
  const platform = group('Raised rectangular platform and split entrance stair banks');
  box(platform, 0, 1.15, -d / 2, w * .94, 1.74, d * .88, M.stone);
  for (const side of [-1, 1]) for (let i = 0; i < 10; i++) {
    box(platform, side * w * .25, .28 + (10 - i) * .087, -2.2 + i * .24,
      w * .38, (10 - i) * .174, .27, M.stone);
  }
  const body = group('Elliptical arena with continuous clerestory and stone spandrels');
  const piers = group('Upper clerestory stone piers and open balcony rails');
  const rx = w * .43, rz = d * .38, cz = -d * .50;
  const photo = {bodyWidthPixels: 1200, groundY: 518, eaveY: 310, roofPeakY: 148,
    archPeakY: 94, archBeamBottomY: 122, archWebBottomY: 146,
    lowerBandTopY: 443, upperBandBottomY: 383,
    caveat: 'Approximate official-photo landmarks, not calibrated camera coordinates or surveyed heights.'};
  const scale = 2 * rx / photo.bodyWidthPixels, atY = y => 2 + (photo.groundY - y) * scale;
  const archCenterY = (photo.archPeakY + photo.archBeamBottomY) / 2;
  const eave = atY(photo.eaveY), rise = atY(photo.roofPeakY) - eave, archCrown = atY(archCenterY);
  const archBeamHalfHeight = (photo.archBeamBottomY - photo.archPeakY) * scale / 2;
  const archWebDepth = (photo.archWebBottomY - archCenterY) * scale;
  const lowerTop = atY(photo.lowerBandTopY), upperBottom = atY(photo.upperBandBottomY);
  function ellipseWall(bottom, top, material) {
    const geo = new THREE.CylinderGeometry(1, 1, top - bottom, 96, 1, true);
    geo.scale(rx, 1, rz); geo.translate(0, (bottom + top) / 2, cz);
    if (material.map) {
      const uv = geo.attributes.uv, perimeter = Math.PI * (3 * (rx + rz) - Math.sqrt((3 * rx + rz) * (rx + 3 * rz)));
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * perimeter / 6, (bottom + uv.getY(i) * (top - bottom)) / 3);
    }
    B.add(body, geo, material);
  }
  ellipseWall(2.0, lowerTop, M.glass);
  ellipseWall(lowerTop, upperBottom, M.stone);
  ellipseWall(upperBottom, eave - .05, M.glass);
  for (const y of [2.1, lowerTop, upperBottom, eave - .05]) {
    const points = Array.from({length: 97}, (_, i) => new THREE.Vector3(rx * Math.sin(i * Math.PI / 48), y,
      cz + rz * Math.cos(i * Math.PI / 48)));
    for (let i = 0; i < points.length - 1; i++) beam(body, points[i].toArray(), points[i + 1].toArray(), .11);
  }
  for (let i = 0; i < 64; i++) {
    const theta = i * Math.PI / 32, x = rx * Math.sin(theta), z = cz + rz * Math.cos(theta);
    beam(body, [x, 2.05, z], [x, eave, z], .09, M.dark);
    const outward = new THREE.Vector2(Math.sin(theta) / rx, Math.cos(theta) / rz).normalize();
    const yaw = Math.atan2(outward.x, outward.y);
    box(piers, x + outward.x * .25, (upperBottom + eave) / 2, z + outward.y * .25,
      .95, eave - upperBottom, .8, M.stone, yaw);
    box(piers, x + outward.x * .45, upperBottom - .1, z + outward.y * .45, 1.5, .22, 1.1, M.stone, yaw);
    if (i % 8 === 0) box(piers, x, (2 + lowerTop) / 2, z, 1.1, lowerTop - 2, 1.0, M.stone, yaw);
    for (const y of [upperBottom + .35, upperBottom + .8, upperBottom + 1.25]) {
      const next = theta + Math.PI / 32;
      const nextOutward = new THREE.Vector2(Math.sin(next) / rx, Math.cos(next) / rz).normalize();
      beam(piers, [x + outward.x * .8, y, z + outward.y * .8],
        [rx * Math.sin(next) + nextOutward.x * .8, y, cz + rz * Math.cos(next) + nextOutward.y * .8], .055);
    }
  }
  const roof = group('Shallow elliptical ribbed metal roof');
  const curveY = r => eave + rise * Math.sqrt(Math.max(0, 1 - r * r));
  const profile = Array.from({length: 33}, (_, i) => {
    const r = 1 - i / 32; return new THREE.Vector2(r, curveY(r));
  });
  const cap = new THREE.LatheGeometry(profile, 96);
  cap.scale(rx, 1, rz); cap.translate(0, 0, cz); B.add(roof, cap, M.roof);
  const seamVertices = [];
  for (let i = 0; i < 80; i++) {
    const angle = i * Math.PI / 40;
    const section = j => {
      const r = .04 + j * .96 / 32;
      return [-.0017, .0017].map(offset =>
        [rx * r * Math.sin(angle + offset), curveY(r) + .08, cz + rz * r * Math.cos(angle + offset)]);
    };
    for (let j = 0; j < 32; j++) {
      const [a, b] = section(j), [d, c] = section(j + 1);
      for (const point of [a, c, b, a, d, c]) seamVertices.push(...point);
    }
  }
  const seams = new THREE.BufferGeometry();
  seams.setAttribute('position', new THREE.Float32BufferAttribute(seamVertices, 3));
  seams.computeVertexNormals();
  B.worldUV(seams, M.roofSeam); B.add(roof, seams, M.roofSeam);
  const arch = group('Open white parabolic arch and triangulated steel web');
  const archZ = cz + d * .18, archX = w * .53;
  const outer = t => new THREE.Vector3(t * archX, 2.3 + (archCrown - 2.3) * (1 - t * t), archZ);
  const outerCurve = new THREE.CatmullRomCurve3(Array.from({length: 65}, (_, i) => outer(-1 + i / 32)));
  const shape = new THREE.Shape();
  shape.moveTo(-.75, -archBeamHalfHeight); shape.lineTo(.75, -archBeamHalfHeight);
  shape.lineTo(.75, archBeamHalfHeight); shape.lineTo(-.75, archBeamHalfHeight); shape.closePath();
  B.add(arch, new THREE.ExtrudeGeometry(shape, {extrudePath: outerCurve, steps: 64, bevelEnabled: false}), M.arch);
  for (let i = 0; i < 32; i++) {
    const a = outer(-.94 + i * 1.88 / 32), b = outer(-.94 + (i + 1) * 1.88 / 32);
    const lowA = a.clone().add(new THREE.Vector3(0, -archWebDepth, 0)), lowB = b.clone().add(new THREE.Vector3(0, -archWebDepth, 0));
    beam(arch, lowA.toArray(), lowB.toArray(), .10, M.arch);
    beam(arch, (i % 2 ? a : lowA).toArray(), (i % 2 ? lowB : b).toArray(), .09, M.arch);
  }
  const entry = group('South entrance glazing canopy and posts');
  const frontZ = cz + rz;
  const canopyY = lowerTop + .2;
  box(entry, 0, canopyY, frontZ + 1.3, w * .40, .15, 3.5, M.glass);
  for (const x of [-w * .18, 0, w * .18]) beam(entry, [x, 2.1, frontZ + 2.6], [x, canopyY - .05, frontZ + 2.6], .18);
  C.dimensions = {radiusX: rx, radiusZ: rz, arenaCenterZ: cz, eave, roofRise: rise, archCrown,
    archHalfSpan: archX, archBeamHalfHeight, archWebDepth,
    upperBandBottom: upperBottom, lowerBandTop: lowerTop, photoLandmarks: photo,
    status: 'photo-proportion-estimate'};
}

function musicHall(C) {
  const {M, ring, width: w, group, box, extrude, B} = C;
  const photo = {frontX: [202, 706], groundY: 272, parapetY: 70, windowHeadY: 108, windowTipY: 136,
    foldTipY: 219, doorHeadY: 232, endWindowCentersX: [278, 661], doorCentersX: [302, 405, 507, 610],
    caveat: 'Approximate official-photo landmarks; perspective is not a camera calibration or survey.'};
  const scale = w / (photo.frontX[1] - photo.frontX[0]), atY = y => .28 + (photo.groundY - y) * scale;
  const atX = x => -w / 2 + (x - photo.frontX[0]) * scale;
  const eave = atY(photo.parapetY), windowHead = atY(photo.windowHeadY), windowTip = atY(photo.windowTipY);
  const foldTip = atY(photo.foldTipY), doorHead = atY(photo.doorHeadY), doorHeight = doorHead - .28;
  const core = group('Frozen hall and western annex shell; rear estimated');
  extrude(core, clip(ring, 1, -1.1), .28, eave - .7, M.wall);
  const facade = group('South brick facade with genuine inverted triangle and door apertures');
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2, .28); shape.lineTo(w / 2, .28);
  for (let i = 0; i <= 32; i++) {
    const x = w / 2 - w * i / 32;
    shape.lineTo(x, eave - .18 * Math.sin(Math.PI * i / 32));
  }
  shape.closePath();
  const windows = group('Recessed inverted triangular glazing and tapered brick reveals');
  const frames = group('Triangular metal window frames and recessed door frames');
  const count = 16, windowCenters = Array.from({length: count}, (_, i) =>
    atX(photo.endWindowCentersX[0] + i * (photo.endWindowCentersX[1] - photo.endWindowCentersX[0]) / (count - 1)));
  const spacing = windowCenters[1] - windowCenters[0];
  for (let i = 0; i < count; i++) {
    const x = windowCenters[i], half = spacing * .32, top = windowHead, low = windowTip;
    const hole = new THREE.Path();
    hole.moveTo(x - half, top); hole.lineTo(x + half, top); hole.lineTo(x, low); hole.closePath(); shape.holes.push(hole);
    const pane = new THREE.Shape();
    pane.moveTo(x - half, top); pane.lineTo(x, low); pane.lineTo(x + half, top); pane.closePath();
    const geo = new THREE.ShapeGeometry(pane); geo.translate(0, 0, -1.04); B.add(windows, geo, M.glass);
    const vertices = [x - half, top, .03, x, foldTip, .75, x, low, .03,
      x + half, top, .03, x, low, .03, x, foldTip, .75];
    const reveals = new THREE.BufferGeometry();
    reveals.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    reveals.computeVertexNormals(); B.worldUV(reveals, M.wall); B.add(windows, reveals, M.wall);
    const perimeter = [[x - half, top, -.12], [x + half, top, -.12], [x, low, -.12]];
    for (let edge = 0; edge < 3; edge++) C.beam(frames, perimeter[edge], perimeter[(edge + 1) % 3], .045, M.dark);
  }
  const doors = group('Four groups of three recessed glazed doors');
  const doorCenters = photo.doorCentersX.map(atX), doorLeafSpacing = 1.18;
  for (let bay = 0; bay < 4; bay++) for (let leaf = 0; leaf < 3; leaf++) {
    const x = doorCenters[bay] + (leaf - 1) * doorLeafSpacing, half = .46;
    const hole = new THREE.Path();
    hole.moveTo(x - half, .28); hole.lineTo(x + half, .28); hole.lineTo(x + half, doorHead);
    hole.lineTo(x - half, doorHead); hole.closePath(); shape.holes.push(hole);
    const centerY = (.28 + doorHead) / 2;
    box(doors, x, centerY, -.94, .90, doorHeight, .08, M.glass);
    box(doors, x, centerY, -.83, .035, doorHeight, .06, M.dark);
    for (const side of [-1, 1]) box(frames, x + side * .49, centerY, -.14, .065, doorHeight + .08, .1, M.dark);
    box(frames, x, doorHead + .03, -.14, 1.04, .07, .1, M.dark);
    box(doors, x + .25, centerY, -.77, .025, .55, .04, M.metal);
  }
  const wall = new THREE.ExtrudeGeometry(shape, {depth: .85, bevelEnabled: false, curveSegments: 1});
  wall.translate(0, 0, -.85); B.worldUV(wall, M.wall); B.add(facade, wall, M.wall);
  const parapet = group('Shallow curved parapet coping and quiet roof');
  extrude(parapet, clip(ring, 1, -1.15), eave - .7, eave - .55, M.roof);
  const coping = new THREE.Shape();
  for (let i = 0; i <= 32; i++) {
    const x = -w / 2 + w * i / 32, y = eave - .18 * Math.sin(Math.PI * i / 32) + .1;
    if (i === 0) coping.moveTo(x, y); else coping.lineTo(x, y);
  }
  for (let i = 32; i >= 0; i--) coping.lineTo(-w / 2 + w * i / 32, eave - .18 * Math.sin(Math.PI * i / 32));
  coping.closePath();
  const copingGeometry = new THREE.ExtrudeGeometry(coping, {depth: .95, bevelEnabled: false, curveSegments: 1});
  copingGeometry.translate(0, 0, -.835); B.worldUV(copingGeometry, M.wall); B.add(parapet, copingGeometry, M.wall);
  C.dimensions = {frontWidth: w, height: eave + .1, triangularWindowCount: count, doorGroups: 4,
    windowCenters, windowHead, windowTip, doorCenters, doorLeafSpacing, doorHead, photoLandmarks: photo,
    status: 'photo-proportion-estimate'};
}

export function createModernBuildingDetail(feature, center, origin) {
  const source = sourceFor(feature);
  if (!Array.isArray(center) || center.length !== 2 ||
      center.some((v, i) => !Number.isFinite(v) || Math.abs(v - sources.projectionCenter[i]) > 1e-10)) {
    throw new Error('Modern campus frozen projection center changed.');
  }
  const metrics = footprintMetrics(feature.geometry, center);
  if (!Array.isArray(origin) || origin.length !== 2 ||
      origin.some((v, i) => !Number.isFinite(v) || Math.abs(v - metrics.origin[i]) > 1e-6)) {
    throw new Error('Modern campus building local origin changed.');
  }
  const C = buildContext(source, metrics, origin);
  ({'art-museum': artMuseum, 'sports-center': sportsCenter, 'music-hall': musicHall})[source.referenceSite](C);
  C.B.finish();
  const arenaRoof = C.detail.getObjectByName('Shallow elliptical ribbed metal roof');
  if (arenaRoof) arenaRoof.traverse(object => {
    if (!object.isMesh) return;
    // Convex metal and sub-texel seams need no self-shadowing; it produces dotted acne.
    object.receiveShadow = false;
    if (object.material === C.M.roofSeam) object.castShadow = false;
  });
  const usedMaterials = new Set();
  C.detail.traverse(object => {if (object.isMesh) usedMaterials.add(object.material);});
  for (const mat of Object.values(C.M)) if (!usedMaterials.has(mat)) {
    for (const value of Object.values(mat)) if (value?.isTexture) value.dispose();
    mat.dispose();
  }
  C.detail.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(C.detail);
  const reference = catalog.sites.find(site => site.id === source.referenceSite);
  if (!reference?.images.length) throw new Error(`Missing modern building photo provenance: ${source.referenceSite}`);
  C.detail.userData = {
    buildingFeatureId: source.featureId, referenceSite: source.referenceSite, noReferencePhotoTextures: true,
    referencePages: [...new Set(reference.images.map(image => image.pageUrl))],
    referenceImages: reference.images.map(image => image.imageUrl),
    frontNormalXZ: C.south, directionSource: source.directionSource,
    footprintArea: metrics.area, estimatedDimensionsMeters: {...C.dimensions,
      meshLocalYMin: bounds.min.y, meshLocalYMax: bounds.max.y},
    limits: LIMITS[source.referenceSite], localAxes: 'X east, Y up, Z south',
  };
  return C.detail;
}

export function refineModernBuilding(campus, data, featureId) {
  const matches = data.features.filter(feature => feature.id === featureId);
  if (matches.length !== 1) throw new Error('Modern campus source identity must occur exactly once.');
  const source = sourceFor(matches[0]), root = campus.buildings.get(featureId);
  const metrics = footprintMetrics(matches[0].geometry, data.metadata.center);
  if (!root || root.userData.featureId !== featureId || !root.getObjectByName('base') ||
      root.userData.nameSourceFeatureId !== `osm:way:${source.osmWay}` ||
      !root.position.toArray().every(Number.isFinite) ||
      root.position.y !== 0 || Math.abs(root.position.x - metrics.origin[0]) > 1e-6 ||
      Math.abs(root.position.z - metrics.origin[1]) > 1e-6 ||
      !root.scale.equals(new THREE.Vector3(1, 1, 1)) ||
      root.rotation.x !== 0 || root.rotation.y !== 0 || root.rotation.z !== 0) {
    throw new Error('Modern campus building root placement/identity mismatch.');
  }
  const previous = root.children.find(child => child.userData.campusDetail);
  if (previous && previous.userData.referenceSite !== source.referenceSite) {
    throw new Error('Refusing to replace a foreign modern campus detail.');
  }
  const detail = createModernBuildingDetail(matches[0], data.metadata.center, root.userData.localOriginMeters);
  const baseRenderHeight = root.userData.baseRenderHeight ?? root.userData.renderHeight;
  replaceBuilding(campus.buildings, featureId, detail);
  Object.assign(root.userData, {baseRenderHeight, referenceSite: source.referenceSite,
    refinementSummary: SUMMARIES[source.referenceSite], limits: detail.userData.limits,
    referencePages: detail.userData.referencePages, referenceImages: detail.userData.referenceImages,
    heightSource: '照片比例推定，非测绘', renderHeight: detail.userData.estimatedDimensionsMeters.meshLocalYMax,
    estimatedDimensionsMeters: detail.userData.estimatedDimensionsMeters,
  });
  if (previous) disposeOwnedDetail(previous);
  return root;
}
