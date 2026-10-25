import * as THREE from 'three';
import {createBuilder} from '../../shunde/src/builder.js';
import {footprintMetrics} from './geo.js';
import {replaceBuilding} from './model.js';
import sources from '../data/modern-building-sources.json' with {type: 'json'};
import catalog from '../reference-catalog.json' with {type: 'json'};

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

function courseTexture(rgb, stone = false) {
  const width = 128, height = 128, pixels = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const row = Math.floor(y / 16), joint = y % 16 < 1 || (x + row % 2 * 32) % 64 < 1;
    const delta = stone ? (row % 2 ? 9 : -5) + (joint ? -6 : 0) : joint ? -8 : ((x * 7 + y * 11) % 5) - 2;
    const offset = (y * width + x) * 4;
    for (let c = 0; c < 3; c++) pixels[offset + c] = rgb[c] + delta;
    pixels[offset + 3] = 255;
  }
  const texture = new THREE.DataTexture(pixels, width, height);
  texture.name = `Generated ${stone ? 'stone bands' : 'brick courses'}; no photograph`;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
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
    wall: material('masonry', {color: '#ffffff', map: courseTexture(
      source.referenceSite === 'art-museum' ? [172, 142, 127] : [171, 93, 52], source.referenceSite === 'art-museum')}),
    stone: material('paving', {color: '#c9c3b5'}),
    metal: material('metal', {color: '#d9dbd8', metalness: .25, roughness: .64}),
    dark: material('frame', {color: '#515a58', metalness: .2, roughness: .7}),
    glass: material('glass', {color: '#41666b', metalness: .18, roughness: .38, side: THREE.DoubleSide}),
    roof: material('roof', {color: '#aaa99b', metalness: .25, roughness: .76, side: THREE.DoubleSide}),
  };
  B.textureWorld.set(M.wall.uuid, [source.referenceSite === 'art-museum' ? 9 : 2, source.referenceSite === 'art-museum' ? 4 : 1]);
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
  const rx = w * .43, rz = d * .38, cz = -d * .50, eave = 12.4, rise = 12.4;
  function ellipseWall(bottom, top, material) {
    const geo = new THREE.CylinderGeometry(1, 1, top - bottom, 96, 1, true);
    geo.scale(rx, 1, rz); geo.translate(0, (bottom + top) / 2, cz); B.add(body, geo, material);
  }
  ellipseWall(2.0, 5.6, M.glass);
  ellipseWall(5.6, 9.1, M.stone);
  ellipseWall(9.1, 12.35, M.glass);
  for (const y of [2.1, 5.6, 9.1, 12.35]) {
    const points = Array.from({length: 97}, (_, i) => new THREE.Vector3(rx * Math.sin(i * Math.PI / 48), y,
      cz + rz * Math.cos(i * Math.PI / 48)));
    for (let i = 0; i < points.length - 1; i++) beam(body, points[i].toArray(), points[i + 1].toArray(), .11);
  }
  for (let i = 0; i < 64; i++) {
    const theta = i * Math.PI / 32, x = rx * Math.sin(theta), z = cz + rz * Math.cos(theta);
    beam(body, [x, 2.05, z], [x, 12.4, z], i % 2 ? .12 : .24);
    if (i % 2 === 0) for (const y of [9.5, 10.1]) {
      const next = theta + Math.PI / 32;
      beam(body, [x, y, z], [rx * Math.sin(next), y, cz + rz * Math.cos(next)], .055);
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
  B.worldUV(seams, M.metal); B.add(roof, seams, M.metal);
  const arch = group('Open white parabolic arch and triangulated steel web');
  const archZ = cz - d * .10, archX = w * .485;
  const outer = t => new THREE.Vector3(t * archX, 2.3 + 28 * (1 - t * t), archZ);
  const outerCurve = new THREE.CatmullRomCurve3(Array.from({length: 65}, (_, i) => outer(-1 + i / 32)));
  const shape = new THREE.Shape();
  shape.moveTo(-.75, -.6); shape.lineTo(.75, -.6); shape.lineTo(.75, .6); shape.lineTo(-.75, .6); shape.closePath();
  B.add(arch, new THREE.ExtrudeGeometry(shape, {extrudePath: outerCurve, steps: 64, bevelEnabled: false}), M.metal);
  for (let i = 0; i < 32; i++) {
    const a = outer(-.94 + i * 1.88 / 32), b = outer(-.94 + (i + 1) * 1.88 / 32);
    const lowA = a.clone().add(new THREE.Vector3(0, -1.85, 0)), lowB = b.clone().add(new THREE.Vector3(0, -1.85, 0));
    beam(arch, lowA.toArray(), lowB.toArray(), .10);
    beam(arch, (i % 2 ? a : lowA).toArray(), (i % 2 ? lowB : b).toArray(), .09);
  }
  const entry = group('South entrance glazing canopy and posts');
  const frontZ = cz + rz;
  box(entry, 0, 5.75, frontZ + 1.3, w * .40, .15, 3.5, M.glass);
  for (const x of [-w * .18, 0, w * .18]) beam(entry, [x, 2.1, frontZ + 2.6], [x, 5.7, frontZ + 2.6], .18);
  C.dimensions = {radiusX: rx, radiusZ: rz, arenaCenterZ: cz, eave, roofRise: rise, archCrown: 30.3,
    status: 'photo-proportion-estimate'};
}

function musicHall(C) {
  const {M, ring, width: w, group, box, extrude, B} = C;
  const core = group('Frozen hall and western annex shell; rear estimated');
  extrude(core, clip(ring, 1, -1.1), .28, 16.5, M.wall);
  const facade = group('South brick facade with genuine inverted triangle and door apertures');
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2, .28); shape.lineTo(w / 2, .28);
  for (let i = 0; i <= 32; i++) {
    const x = w / 2 - w * i / 32;
    shape.lineTo(x, 17.2 - .35 * Math.sin(Math.PI * i / 32));
  }
  shape.closePath();
  const windows = group('Recessed inverted triangular glazing and tapered brick reveals');
  const count = 16, spacing = (w - 4) / count;
  for (let i = 0; i < count; i++) {
    const x = -w / 2 + 2 + spacing * (i + .5), half = spacing * .35, top = 14.8, low = 11.7;
    const hole = new THREE.Path();
    hole.moveTo(x - half, top); hole.lineTo(x + half, top); hole.lineTo(x, low); hole.closePath(); shape.holes.push(hole);
    const pane = new THREE.Shape();
    pane.moveTo(x - half, top); pane.lineTo(x, low); pane.lineTo(x + half, top); pane.closePath();
    const geo = new THREE.ShapeGeometry(pane); geo.translate(0, 0, -1.04); B.add(windows, geo, M.glass);
    const vertices = [x - half, top, .03, x, 6.0, .75, x, low, .03,
      x + half, top, .03, x, low, .03, x, 6.0, .75];
    const reveals = new THREE.BufferGeometry();
    reveals.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    reveals.computeVertexNormals(); B.worldUV(reveals, M.wall); B.add(windows, reveals, M.wall);
  }
  const doors = group('Four groups of three recessed glazed doors');
  for (let bay = 0; bay < 4; bay++) for (let leaf = 0; leaf < 3; leaf++) {
    const x = -w * .34 + bay * w * .225 + (leaf - 1) * 1.18, half = .46;
    const hole = new THREE.Path();
    hole.moveTo(x - half, .28); hole.lineTo(x + half, .28); hole.lineTo(x + half, 3.4);
    hole.lineTo(x - half, 3.4); hole.closePath(); shape.holes.push(hole);
    box(doors, x, 1.85, -.94, .90, 3.12, .08, M.glass);
    box(doors, x, 1.85, -.83, .035, 3.12, .06, M.dark);
  }
  const wall = new THREE.ExtrudeGeometry(shape, {depth: .85, bevelEnabled: false, curveSegments: 1});
  wall.translate(0, 0, -.85); B.worldUV(wall, M.wall); B.add(facade, wall, M.wall);
  const parapet = group('Shallow curved parapet coping and quiet roof');
  extrude(parapet, clip(ring, 1, -1.15), 16.5, 16.65, M.roof);
  for (let i = 0; i < 32; i++) {
    const x = -w / 2 + w * (i + .5) / 32, y = 17.2 - .35 * Math.sin(Math.PI * (i + .5) / 32);
    box(parapet, x, y + .03, -.36, w / 32 + .01, .1, .95, M.wall);
  }
  C.dimensions = {frontWidth: w, height: 17.3, triangularWindowCount: count, doorGroups: 4,
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
    if (object.material === C.M.metal) object.castShadow = false;
  });
  const usedMaterials = new Set();
  C.detail.traverse(object => {if (object.isMesh) usedMaterials.add(object.material);});
  for (const mat of Object.values(C.M)) if (!usedMaterials.has(mat)) {
    mat.map?.dispose(); mat.dispose();
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

function disposeOwnedDetail(detail) {
  const geometries = new Set(), materials = new Set(), textures = new Set();
  detail.traverse(object => {
    if (object.geometry) geometries.add(object.geometry);
    if (object.isMesh) for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      materials.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
    }
  });
  geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose());
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
