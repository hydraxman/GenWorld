import * as THREE from 'three';
import polygonClipping from 'polygon-clipping';
import {createBuilder} from '../../shunde/src/builder.js';
import {footprintMetrics} from './geo.js';
import {replaceBuilding} from './model.js';

export const CHEMISTRY_HALL_ID = 'building:geometry:ad7b725c774db745829afef8';
const OSM_ID = 'osm:way:83801034';
const CENTER = [116.32003975, 40.00164005];
const PAGES = [
  'https://100.chem.tsinghua.edu.cn/info/1017/1030.htm',
  'https://polymers.chemeng.tsinghua.edu.cn/info/1504/2656.htm',
  'https://commons.wikimedia.org/wiki/File:Chemistry_Building_of_Tsinghua_University.jpg',
  'https://commons.wikimedia.org/wiki/File:%E6%B8%85%E8%8F%AF%E5%A4%A7%E5%AD%B8%E5%8C%96%E5%AD%B8%E9%A4%A8.jpg',
];
const SOURCE_RING = [
  [116.31289959, 40.004742926], [116.312915683, 40.004558016],
  [116.313763261, 40.004599108], [116.313759205, 40.004669016],
  [116.31395638, 40.004677181], [116.313951015, 40.00472649],
  [116.313757896, 40.004718272], [116.313757896, 40.004691562],
  [116.313752532, 40.004784017], [116.31289959, 40.004742926],
];
const SUMMARY = '老化学馆南入口局部照片重建：红砖竖向壁柱、阶梯式女儿墙、三联上下窗、贝壳顶浅壁龛、浅石门额、双扇木门及宽阶梯；完整原始多边形及东细连廊保留，隐蔽侧后立面和女儿墙后屋面仅为估计，不是新化学馆或何添楼。';

function verify(feature, center, root) {
  const p = feature?.properties, g = feature?.geometry;
  if (feature?.id !== CHEMISTRY_HALL_ID || p?.kind !== 'building' || p.name !== '化学馆' ||
      p.nameSourceFeatureId !== OSM_ID || p.nameConfidence !== 0.934 ||
      g?.type !== 'Polygon' || g.coordinates?.length !== 1 ||
      g.coordinates[0]?.length !== SOURCE_RING.length ||
      g.coordinates[0].some((point, i) => !Array.isArray(point) || point.length !== 2 ||
        point.some((v, j) => !Number.isFinite(v) || Math.abs(v - SOURCE_RING[i][j]) > 1e-10))) {
    throw new Error('Old Chemistry Hall frozen source/OSM association changed; re-review evidence.');
  }
  if (!Array.isArray(center) || center.length !== 2 ||
      center.some((v, i) => !Number.isFinite(v) || Math.abs(v - CENTER[i]) > 1e-10)) {
    throw new Error('Old Chemistry Hall projection center changed.');
  }
  const m = footprintMetrics(g, center), origin = root?.userData.localOriginMeters;
  if (!root?.isGroup || root.userData.featureId !== CHEMISTRY_HALL_ID ||
      root.userData.kind !== 'building' || root.userData.name !== '化学馆' ||
      root.userData.nameSourceFeatureId !== OSM_ID || root.userData.nameConfidence !== 0.934 ||
      !root.getObjectByName('base') || !Array.isArray(origin) || origin.length !== 2 ||
      origin.some((v, i) => !Number.isFinite(v) || Math.abs(v - m.origin[i]) > 1e-6) ||
      !root.position.toArray().every(Number.isFinite) ||
      Math.abs(root.position.x - m.origin[0]) > 1e-6 ||
      Math.abs(root.position.z - m.origin[1]) > 1e-6 ||
      root.position.y !== 0 || root.rotation.x !== 0 || root.rotation.y !== 0 ||
      root.rotation.z !== 0 || !root.scale.toArray().every(v => v === 1)) {
    throw new Error('Old Chemistry Hall original root/base placement or identity changed.');
  }
  return m;
}

function rectangle(x0, z0, x1, z1) {
  return [[[x0, z0], [x1, z0], [x1, z1], [x0, z1], [x0, z0]]];
}
function planShape(polygon) {
  const s = new THREE.Shape(polygon[0].map(([x, z]) => new THREE.Vector2(x, -z)));
  for (const r of polygon.slice(1)) s.holes.push(new THREE.Path(r.map(([x, z]) => new THREE.Vector2(x, -z))));
  return s;
}
function pattern(roof) {
  const size = 64, pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const mortar = y % 16 < 1 || (x + Math.floor(y / 16) % 2 * 16) % 32 < 1;
    const base = roof ? [132, 127, 119] : mortar ? [153, 125, 109] : [146, 91, 69];
    const shade = roof ? 3 * Math.sin(x / 12) * Math.cos(y / 16) : (x * 7 + y * 3) % 5 - 2;
    const offset = (y * size + x) * 4;
    for (let c = 0; c < 3; c++) pixels[offset + c] = base[c] + shade;
    pixels[offset + 3] = 255;
  }
  const t = new THREE.DataTexture(pixels, size, size);
  t.name = `Chemistry Hall procedural ${roof ? 'quiet inferred roof' : 'brick courses'} — no photograph`;
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

function buildDetail(feature, m) {
  // u points east along the long SOUTH edge; v points outwards, approximately south.
  const a = m.projected[0][0][1], b = m.projected[0][0][2];
  const width = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const tangent = [(b[0] - a[0]) / width, (b[1] - a[1]) / width];
  const normal = [-tangent[1], tangent[0]];
  const midpoint = a.map((v, i) => (v + b[i]) / 2);
  const footprint = m.projected[0].map(r => r.map(([x, z]) => [
    (x - midpoint[0]) * tangent[0] + (z - midpoint[1]) * tangent[1],
    (x - midpoint[0]) * normal[0] + (z - midpoint[1]) * normal[1],
  ]));
  // Only remove roundoff at the defining frame endpoints, not real outline notches.
  footprint[0][1] = [-width / 2, 0];
  footprint[0][2] = [width / 2, 0];
  // Split at the actual connector attachment vertices, NOT at the east end
  // of the south edge: the skewed main eastern wall is not perpendicular to u.
  // A rectangular clip there incorrectly classifies a thin strip of the
  // twenty-metre main wall as part of the low connector.
  const r = footprint[0];
  const mainPlan = [[[r[0], r[1], r[2], r[3], r[7], r[8], r[0]]]];
  const connectorPlan = [[[r[3], r[4], r[5], r[6], r[7], r[3]]]];
  const wallPlan = polygonClipping.difference(mainPlan, [rectangle(-6.4, -0.6, 6.4, 1)]);
  const detail = new THREE.Group();
  detail.name = '化学馆（1932年老馆）· 南入口局部照片重建';
  detail.position.set(midpoint[0] - m.origin[0], 0, midpoint[1] - m.origin[1]);
  detail.rotation.y = -Math.atan2(tangent[1], tangent[0]);
  const group = (name, surfaceRole, confidence) => {
    const g = new THREE.Group();
    g.name = name;
    g.userData = {surfaceRole, confidence};
    detail.add(g);
    return g;
  };
  const foundation = group('Exact frozen concave footprint including east connector', 'foundation', 'frozen-map');
  const inferred = group('Unseen side rear mass and masked south wings — no invented window rows', 'inferred-mass', 'inferred');
  const connector = group('Skinny eastern connector — map shape only, height unknown', 'east-connector', 'inferred');
  const roof = group('Quiet roof behind observed parapet — topology unverified', 'inferred-roof', 'inferred');
  const front = group('South central brick facade with real apertures and stepped parapet', 'south-front', 'photo-informed');
  const glazing = group('Two tiers of three narrow gridded sash windows and adjacent fragments', 'front-windows', 'photo-informed');
  const ornament = group('Shell-topped shallow niche and simplified inset relief panels', 'front-ornament', 'photo-informed-simplified');
  const portal = group('Pale stone lintel and recessed twin-leaf paneled timber door', 'entrance', 'photo-informed');
  const stairs = group('Broad rising stone stair and low brick cheek walls', 'entry-stair', 'photo-informed-estimate');
  const B = createBuilder(THREE, 83801034);
  const mat = (name, options) => new THREE.MeshStandardMaterial({
    name: `Chemistry Hall ${name}`, roughness: 0.9, ...options,
  });
  const brick = mat('generated warm red brick', {map: pattern(false), color: '#ffffff', side: THREE.DoubleSide});
  const roofMat = mat('generated neutral roof estimate', {map: pattern(true), color: '#ffffff', side: THREE.DoubleSide});
  B.textureWorld.set(brick, [0.96, 0.48]);
  B.textureWorld.set(roofMat, [3, 3]);
  const stone = mat('warm gray stone', {color: '#c1b7a2'});
  const recess = mat('recess shadow', {color: '#20231f'});
  const glass = mat('blue gray glazing', {color: '#45616c', roughness: 0.32, metalness: 0.12, side: THREE.DoubleSide});
  const timber = mat('dark brown window frames and door', {color: '#453a34', roughness: 0.68});
  const panel = mat('recessed door panels', {color: '#352b28'});
  const add = (target, geometry, material) => { B.worldUV(geometry, material); B.add(target, geometry, material); };
  const box = (target, x, y, z, w, h, d, material) => B.box(target, '', x, y, z, w, h, d, material);
  const slab = (target, polys, low, high, material) => {
    for (const poly of polys) {
      const g = new THREE.ExtrudeGeometry(planShape(poly), {depth: high - low, bevelEnabled: false, steps: 1});
      g.rotateX(-Math.PI / 2);
      g.translate(0, low, 0);
      add(target, g, material);
    }
  };
  const ground = 0.2, landing = 2.92, mainEave = 16.2, crest = 19.2, connectorHeight = 5;
  slab(foundation, [footprint], 0.08, ground, stone);
  slab(inferred, wallPlan, ground, mainEave, brick);
  slab(connector, connectorPlan, ground, connectorHeight, brick);
  slab(roof, mainPlan, mainEave, mainEave + 0.12, roofMat);
  slab(connector, connectorPlan, connectorHeight, connectorHeight + 0.12, roofMat);

  // Not a generic window grid: the entrance has three narrow windows on EACH
  // of two upper tiers, separated by full brick spandrels and slender brick ribs.
  const openings = [];
  for (const bottom of [8.1, 12.1]) for (const x of [-1.5, 0, 1.5]) {
    openings.push({x, bottom, width: 1.18, height: 2.48, role: 'central-upper', confidence: 'photo-informed'});
  }
  // Adjacent windows are visible in the 2019 closeup; more distant wing bays
  // remain undetailed because trees cover the current elevations.
  for (const x of [-5.15, 5.15]) for (const bottom of [3.3, 8.1, 12.1]) {
    openings.push({x, bottom, width: 1.45, height: 2.48, role: 'adjacent-fragment', confidence: 'photo-informed-estimate'});
  }
  const door = {x: 0, bottom: landing, width: 2.18, height: 3.32};
  const outline = [
    [-6.4, ground], [6.4, ground], [6.4, 17.2], [4.6, 17.2],
    [4.6, 18.15], [3.15, 18.15], [3.15, crest], [0.45, crest],
    [0.45, crest + 0.12], [-0.45, crest + 0.12], [-0.45, crest],
    [-3.15, crest], [-3.15, 18.15], [-4.6, 18.15], [-4.6, 17.2], [-6.4, 17.2],
  ];
  const facade = new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x, y)));
  for (const o of [...openings, door]) facade.holes.push(new THREE.Path([
    new THREE.Vector2(o.x - o.width / 2, o.bottom),
    new THREE.Vector2(o.x + o.width / 2, o.bottom),
    new THREE.Vector2(o.x + o.width / 2, o.bottom + o.height),
    new THREE.Vector2(o.x - o.width / 2, o.bottom + o.height),
  ]));
  const frontWall = new THREE.ExtrudeGeometry(facade, {depth: 0.42, bevelEnabled: false, steps: 1});
  frontWall.translate(0, 0, -0.42);
  add(front, frontWall, brick);
  // Brick ribs are continuous, not pale classical columns; plaque reliefs are
  // deliberately schematic, not a claim of exact historic sculpture.
  for (const x of [-6.05, -3.6, -2.24, -0.75, 0.75, 2.24, 3.6, 6.05]) {
    const top = Math.abs(x) > 4 ? 17.2 : Math.abs(x) > 3 ? 18.15 : 16.0;
    box(front, x, (top + 7.45) / 2, 0.07, 0.22, top - 7.45, 0.14, brick);
  }
  for (const o of openings) {
    const middle = o.bottom + o.height / 2, left = o.x - o.width / 2, right = o.x + o.width / 2;
    box(glazing, o.x, middle, -0.47, o.width, o.height, 0.03, recess);
    box(glazing, o.x, middle, -0.16, o.width - 0.07, o.height - 0.07, 0.025, glass);
    for (const x of [left + 0.025, right - 0.025]) box(glazing, x, middle, -0.08, 0.05, o.height, 0.08, timber);
    for (const y of [o.bottom + 0.025, o.bottom + o.height - 0.025, o.bottom + o.height - 0.68]) {
      box(glazing, o.x, y, -0.08, o.width, 0.05, 0.08, timber);
    }
    for (const x of [o.x - o.width / 6, o.x + o.width / 6]) box(glazing, x, middle,
      -0.085, 0.028, o.height, 0.055, timber);
    for (const y of [o.bottom + 0.58, o.bottom + 1.17]) box(glazing, o.x, y,
      -0.085, o.width, 0.028, 0.055, timber);
    box(glazing, o.x, o.bottom - 0.055, 0.09, o.width + 0.16, 0.11, 0.26, stone);
  }
  // Flat lintel (NOT an arch), pale base blocks and deep portal reveals.
  box(portal, 0, 6.92, 0.15, 4.9, 1.36, 0.3, stone);
  box(portal, 0, 7.06, 0.315, 4.16, 0.88, 0.03, recess);
  box(portal, 0, 7.06, 0.34, 4.0, 0.72, 0.035, stone);
  // The inset name plaque is intentionally blank: no font/photograph masquerades
  // as the original right-to-left calligraphy. The official title is root.name.
  for (const sign of [-1, 1]) {
    box(portal, sign * 2.55, 4.56, 0.13, 0.48, 4.8, 0.38, brick);
    box(portal, sign * 2.55, 1.56, 0.13, 0.48, 2.72, 0.39, stone);
    box(ornament, sign * 2.55, 6.75, 0.34, 0.5, 0.72, 0.12, stone);
    box(ornament, sign * 2.55, 5.72, 0.5, 0.17, 0.38, 0.18, timber);
    box(ornament, sign * 2.55, 5.72, 0.6, 0.1, 0.27, 0.04, stone);
    for (const y of [4.25, 4.85]) box(portal, sign * 1.8, y, 0.055, 1.03, 0.47, 0.045, stone);
    box(ornament, sign * 2.75, 18.0, 0.035, 0.86, 0.64, 0.065, stone);
    box(ornament, sign * 2.75, 18.0, 0.075, 0.64, 0.43, 0.025, brick);
  }
  box(portal, 0, landing + door.height / 2, -0.38, door.width, door.height, 0.12, timber);
  for (const x of [-door.width / 4, door.width / 4]) {
    for (const [y, h] of [[landing + 0.65, 0.95], [landing + 1.82, 1.22], [landing + 2.91, 0.43]]) {
      box(portal, x, y, -0.305, 0.84, h, 0.025, panel);
    }
  }
  box(portal, 0, landing + door.height / 2, -0.28, 0.05, door.height, 0.05, timber);
  // The shell recess is a rounded-top inset relief, never a roof gable.
  box(ornament, 0, 17.0, 0.015, 1.22, 3.55, 0.04, stone);
  box(ornament, 0, 16.8, 0.055, 0.63, 2.4, 0.035, stone);
  const shellX = 0, shellY = 17.8, radius = 0.66;
  const fan = new THREE.Shape();
  fan.moveTo(shellX, shellY);
  fan.absarc(shellX, shellY, radius, 0, Math.PI, false);
  fan.lineTo(shellX, shellY);
  const shell = new THREE.ExtrudeGeometry(fan, {depth: 0.14, bevelEnabled: false, curveSegments: 24});
  shell.translate(0, 0, 0.09);
  add(ornament, shell, stone);
  for (let i = 0; i <= 10; i++) {
    const angle = Math.PI * i / 10;
    B.cylinder(ornament, [0, shellY, 0.235],
      [0.6 * Math.cos(angle), shellY + 0.6 * Math.sin(angle), 0.235], 0.015, 0.022, stone, 6);
  }
  // 17 risers is an approximate count in the unobstructed 2024 photograph.
  // Width/depth are perspective-sensitive estimates, not map survey dimensions.
  const stepCount = 17, stairDepth = 5.44, bottomWidth = 10.0, topWidth = 6.0;
  for (let i = 0; i < stepCount; i++) {
    const depth = stairDepth * (1 - i / stepCount);
    const w = bottomWidth + (topWidth - bottomWidth) * i / (stepCount - 1);
    box(stairs, 0, ground + (landing - ground) * (i + 1) / stepCount / 2,
      depth / 2 + 0.32, w, (landing - ground) * (i + 1) / stepCount, depth, stone);
    for (const sign of [-1, 1]) {
      const y = ground + (landing - ground) * (i + 1) / stepCount;
      box(stairs, sign * (w / 2 + 0.18), (y + 0.68 + ground) / 2,
        depth - stairDepth / stepCount / 2 + 0.32, 0.32, y + 0.68 - ground,
        stairDepth / stepCount + 0.01, brick);
      box(stairs, sign * (w / 2 + 0.18), y + 0.73,
        depth - stairDepth / stepCount / 2 + 0.32, 0.4, 0.1, stairDepth / stepCount + 0.02, stone);
    }
  }
  box(stairs, 0, landing - 0.09, 0.15, topWidth, 0.18, 0.7, stone);

  B.finish();
  for (const g of detail.children) for (const mesh of g.children) {
    mesh.userData = {...g.userData};
  }
  detail.updateMatrixWorld(true);
  // Unattached detail only: never include the hidden five-metre default base.
  const bounds = new THREE.Box3().setFromObject(detail, true);
  const focus = new THREE.Box3();
  for (const g of [front, glazing, ornament, portal, stairs]) focus.union(new THREE.Box3().setFromObject(g, true));
  const unknowns = [
    '绝对高度、窗宽、阶梯进深、中央块宽度为联合比例估计，非测绘。',
    '当前两翼被树和爬藤遮挡；历史图重复竖窗不用于凭空补齐现状逐窗。',
    '侧面、北背面及地下层开口未知，保留安静体量，不复制南入口。',
    '女儿墙后屋面拓扑、坡度、设备未证实；中性平盖仅封闭估计体量，不声称原屋顶为平屋顶。',
    '东侧细连接体保留精确矢量平面；高度沿用原5米显示值，非现场实测。',
    '贝壳、壁板、门板装饰为简化几何；门额题字留白，不假冒原书法。',
    '2008、2019、2024照片时间不同；不复刻可变告示、空调、爬藤或人群。',
  ];
  detail.userData = {
    referenceSite: 'chemistry-hall', referencePages: [...PAGES], refinementSummary: SUMMARY,
    reconstructionExtent: 'partial', reconstructionLevel: 'photo-informed-front-estimate-not-surveyed',
    heightSource: '南入口照片比例/常规构件尺度估计；非测绘；原5米不是老馆真实高度。',
    estimatedVisibleHeight: bounds.max.y,
    detailBoundsLocal: {min: bounds.min.toArray(), max: bounds.max.toArray()},
    focusBoundsLocal: {min: focus.min.toArray(), max: focus.max.toArray()},
    viewDirection: [normal[0], 0.28, normal[1]],
    facadeNormal: [normal[0], 0, normal[1]], facadeTangentXZ: tangent,
    facadeMapEdgeIndices: [1, 2], facadeMidpointLocal: detail.position.toArray(),
    sourceFootprintFacadeXZ: footprint, mainPlan, connectorPlan,
    sourceOSMNameId: OSM_ID, sourceDisplayHeight: feature.properties.renderHeight,
    dimensions: {mapBoundsMeters: [m.bounds[2] - m.bounds[0], m.bounds[3] - m.bounds[1]],
      mapAreaSquareMeters: m.area, mainFrontWidth: width, focusFacadeWidth: 12.8,
      mainEave, parapetCrest: crest + 0.12, connectorHeight, landing, doorWidth: door.width,
      doorHeight: door.height, centralWindowWidth: 1.18, centralWindowHeight: 2.48,
      upperTierBottoms: [8.1, 12.1], stairDepth, bottomStairWidth: bottomWidth,
      topStairWidth: topWidth, stepCount, stepRise: (landing - ground) / stepCount},
    openings, door, parapetOutline: outline,
    photoSupported: ['南向主入口', '红砖竖向肋柱与阶梯式女儿墙',
      '中央上下两组三联窄格窗', '贝壳顶浅壁龛与嵌板',
      '浅石矩形门额/基脚、双扇深色门和宽石阶'],
    unknowns, noReferencePhotoTextures: true, meshCount: B.stats.batches,
  };
  return detail;
}

function disposeDetail(detail) {
  const materials = new Set(), geometries = new Set(), textures = new Set();
  detail.traverse(o => {
    if (!o.isMesh) return;
    geometries.add(o.geometry);
    for (const mat of Array.isArray(o.material) ? o.material : [o.material]) materials.add(mat);
  });
  for (const g of geometries) g.dispose();
  for (const mat of materials) { if (mat.map) textures.add(mat.map); mat.dispose(); }
  for (const texture of textures) texture.dispose();
}

/** Refine only the frozen OLD hall; return its original addressable building root. */
export function refineChemistryHall(campus, data) {
  const feature = data?.features?.find(f => f.id === CHEMISTRY_HALL_ID);
  const root = campus?.buildings?.get(CHEMISTRY_HALL_ID);
  const m = verify(feature, data?.metadata?.center, root);
  const detail = buildDetail(feature, m);
  const previous = root.children.find(child => child.userData.campusDetail);
  const baseRenderHeight = root.userData.baseRenderHeight ?? root.userData.renderHeight;
  replaceBuilding(campus.buildings, CHEMISTRY_HALL_ID, detail);
  const {campusDetail, ...metadata} = detail.userData;
  Object.assign(root.userData, {
    ...metadata, baseRenderHeight, renderHeight: detail.userData.estimatedVisibleHeight,
    // Full footprint identity, source properties and original placement stay on root.
    refinementStatus: 'detailed',
  });
  if (previous) disposeDetail(previous);
  root.name = '化学馆';
  root.updateWorldMatrix(true, true);
  return root;
}
