import * as THREE from 'three';
import polygonClipping from 'polygon-clipping';
import {createBuilder} from '../../shunde/src/builder.js';
import {footprintMetrics} from './geo.js';
import {replaceBuilding} from './model.js';

export const MAIN_BUILDING_IDS = [
  'building:geometry:1bd7995f9d0628361f56513d',
  'building:geometry:a97815fc8a21ded2d15ea28d',
  'building:geometry:26f898e482da603ab7987308',
];
const SPECS = [
  {name: '中央主楼', way: '79699845', central: true},
  {name: '西主楼', way: '79699846', central: false},
  {name: '东主楼', way: '84653294', central: false},
];
const REFERENCE_PAGES = [
  'https://www.tsinghua.edu.cn/zjqh/xyfg/xyjg.htm',
  'https://www.tsinghua.edu.cn/info/2060/61191.htm',
];

function shape(rings) {
  const points = ring => ring.map(([x, z]) => new THREE.Vector2(x, -z));
  const result = new THREE.Shape(points(rings[0]));
  rings.slice(1).forEach(ring => result.holes.push(new THREE.Path(points(ring))));
  return result;
}

function rectangle(x1, z1, x2, z2) {
  return [[[x1, z1], [x2, z1], [x2, z2], [x1, z2], [x1, z1]]];
}

export function createMainBuildingDetail(feature, center, localOrigin) {
  const index = MAIN_BUILDING_IDS.indexOf(feature?.id), spec = SPECS[index];
  if (!spec || feature.properties.nameSourceFeatureId !== `osm:way:${spec.way}` ||
      feature.geometry.type !== 'Polygon' || feature.properties.name !== spec.name) {
    throw new Error('Main-building footprint identity changed; re-match its named OSM source.');
  }
  const metrics = footprintMetrics(feature.geometry, center);
  if (localOrigin.some((value, axis) => Math.abs(value - metrics.origin[axis]) > 1e-6)) {
    throw new Error('Main-building local origin does not match the source outline.');
  }
  const ring = metrics.projected[0][0];
  // Official description establishes south-facing orientation; the long south edge gives its slight yaw.
  const southEdges = ring.slice(0, -1).map((a, i) => ({a, b: ring[i + 1]}))
    .filter(({a, b}) => (a[1] + b[1]) / 2 > metrics.bounds[3] - 12);
  southEdges.sort((a, b) => Math.hypot(b.b[0] - b.a[0], b.b[1] - b.a[1]) -
    Math.hypot(a.b[0] - a.a[0], a.b[1] - a.a[1]));
  if (!southEdges.length) throw new Error('Main-building source has no recognizable south edge.');
  let {a, b} = southEdges[0];
  if (a[0] > b[0]) [a, b] = [b, a];
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const tangent = [(b[0] - a[0]) / length, (b[1] - a[1]) / length];
  const normal = [-tangent[1], tangent[0]];
  const toFacade = ([x, z]) => {
    x -= localOrigin[0]; z -= localOrigin[1];
    return [x * tangent[0] + z * tangent[1], x * normal[0] + z * normal[1]];
  };
  const footprint = metrics.projected[0].map(points => points.map(toFacade));
  const allPoints = footprint[0], xmin = Math.min(...allPoints.map(p => p[0]));
  const xmax = Math.max(...allPoints.map(p => p[0])), front = Math.max(...allPoints.map(p => p[1]));
  const rear = Math.min(...allPoints.map(p => p[1]));
  const width = xmax - xmin;
  const pieces = [];
  if (spec.central) {
    const middle = (xmin + xmax) / 2;
    for (const [lo, hi, height] of [
      [xmin - 1, middle - width * 0.32, 35],
      [middle - width * 0.32, middle - width * 0.18, 32],
      [middle - width * 0.18, middle + width * 0.18, 41],
      [middle + width * 0.18, middle + width * 0.32, 32],
      [middle + width * 0.32, xmax + 1, 35],
    ]) {
      const polygons = polygonClipping.intersection([footprint], [rectangle(lo, rear - 1, hi, front + 1)]);
      if (polygons.length) pieces.push({polygons, height, centralTop: height === 41});
    }
  } else {
    // The plan's upper/lower wings remain separate; no box fills their open courtyards.
    const towerCut = rear + 17;
    for (const [lo, hi, height] of [[rear - 1, towerCut, 20], [towerCut, front + 1, 16.7]]) {
      const polygons = polygonClipping.intersection([footprint], [rectangle(xmin - 1, lo, xmax + 1, hi)]);
      if (polygons.length) pieces.push({polygons, height, centralTop: false});
    }
  }
  const detail = new THREE.Group();
  detail.name = `${spec.name} · 照片参照重建`;
  detail.rotation.y = -Math.atan2(tangent[1], tangent[0]);
  const architecture = new THREE.Group();
  architecture.name = 'Map-footprint main-building architecture';
  detail.add(architecture);
  const B = createBuilder(THREE, 12061966);
  const material = (name, color, roughness = 0.8, metalness = 0) =>
    new THREE.MeshStandardMaterial({name, color, roughness, metalness});
  const stone = material('Main building pale sandstone estimate', '#cfc7ac');
  const trim = material('Main building pale projecting cornices', '#ece2c9');
  const shadow = material('Main building recessed interiors', '#263335');
  const glass = material('Main building muted reflective glazing', '#617c82', 0.22, 0.35);
  const frame = material('Main building slender window frames', '#535b57', 0.48, 0.2);
  const roof = material('Main building flat roof and paving', '#a4a79a');
  const joint = material('Main building subtle pilaster lines', '#b5ae96');
  let windowCount = 0, colonnadeBays = 0;
  const slab = (rings, y, thickness, mat) => {
    const geometry = new THREE.ExtrudeGeometry(shape(rings), {depth: thickness, bevelEnabled: false, steps: 1});
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(0, y, 0);
    B.worldUV(geometry, mat);
    B.add(architecture, geometry, mat);
  };
  for (const polygon of [footprint]) slab(polygon, 0.12, 0.35, roof);
  for (const piece of pieces) {
    const top = piece.height;
    for (const polygon of piece.polygons) {
      slab(polygon, top, 0.25, roof);
      for (const r of polygon) {
        const signedArea = r.slice(0, -1).reduce((sum, p, i) => sum + p[0] * r[i + 1][1] - r[i + 1][0] * p[1], 0);
        for (let i = 0; i < r.length - 1; i++) {
          const pa = r[i], pb = r[i + 1], dx = pb[0] - pa[0], dz = pb[1] - pa[1];
          const run = Math.hypot(dx, dz);
          if (run < 0.08) continue;
          const edge = [dx / run, dz / run];
          const outward = [edge[1] * Math.sign(signedArea), -edge[0] * Math.sign(signedArea)];
          const yaw = -Math.atan2(edge[1], edge[0]);
          const box = (name, u, y, w, h, depth, mat, offset = 0) => {
            B.box(architecture, name, pa[0] + edge[0] * u + outward[0] * offset, y,
              pa[1] + edge[1] * u + outward[1] * offset, w, h, depth, mat, yaw);
          };
          const bays = Math.max(1, Math.round(run / (spec.central ? 3.05 : 3.6)));
          const bay = run / bays;
          const frontEntry = spec.central && Math.abs(pa[1] - front) < 0.2 &&
            Math.abs(pb[1] - front) < 0.2 && outward[1] > 0.9;
          const floorBands = [{bottom: 0.47, top: 5, tall: false}];
          const ceiling = piece.centralTop ? top - 6.3 : top - 0.7;
          const levels = Math.max(1, Math.round((ceiling - 5) / (spec.central ? 3.2 : 3.7)));
          for (let level = 0; level < levels; level++) {
            floorBands.push({bottom: 5 + (ceiling - 5) * level / levels,
              top: 5 + (ceiling - 5) * (level + 1) / levels, tall: false});
          }
          if (piece.centralTop) floorBands.push({bottom: ceiling, top: top - 0.7, tall: true});
          for (const floor of floorBands) {
            const entry = frontEntry && floor.bottom === 0.47;
            const recess = entry ? -2.5 : 0;
            const bottom = floor.bottom + (floor.tall ? 0.75 : 0.55);
            const head = floor.top - 0.52;
            const opening = Math.min(bay * (floor.tall ? 0.66 : 0.58), 2.25);
            if (run < 1.1) {
              box('short return', run / 2, (floor.top + floor.bottom) / 2, run,
                floor.top - floor.bottom, 0.35, stone);
              continue;
            }
            for (let n = 0; n < bays; n++) {
              const u = (n + 0.5) * bay, pier = (bay - opening) / 2;
              for (const side of [-1, 1]) box('true opening jamb', u + side * (opening + pier) / 2,
                (floor.top + floor.bottom) / 2, pier + 0.01, floor.top - floor.bottom, 0.4, stone, recess);
              box('spandrel', u, (floor.bottom + bottom) / 2, opening, bottom - floor.bottom, 0.4, stone, recess);
              box('lintel', u, (head + floor.top) / 2, opening, floor.top - head, 0.4, stone, recess);
              box('recess shadow', u, (bottom + head) / 2, opening, head - bottom, 0.03, shadow, recess - 0.28);
              box('recessed glazing', u, (bottom + head) / 2, opening - 0.12, head - bottom - 0.12,
                0.035, glass, recess - 0.12);
              for (const side of [-1, 1]) {
                box('window side frame', u + side * opening / 2, (bottom + head) / 2,
                  0.07, head - bottom, 0.10, frame, recess + 0.04);
                box('window rail', u, side === 1 ? head : bottom, opening + 0.07, 0.07, 0.10, frame, recess + 0.04);
              }
              box('window mullion', u, (bottom + head) / 2, 0.07, head - bottom, 0.09, frame, recess + 0.03);
              box('projecting sill', u, bottom - 0.1, opening + 0.2, 0.13, 0.57, trim, recess + 0.1);
              if (entry) {
                box('open colonnade pier', u - bay / 2 + 0.25, 2.6, 0.48, 4.65, 0.7, stone, 0.55);
                colonnadeBays++;
              }
              windowCount++;
            }
            box('horizontal stone band', run / 2, floor.top, run, 0.12, 0.5, trim, 0.08);
          }
          for (let n = 0; n <= bays; n++) {
            box('continuous subtle pilaster', n * bay, (top + 5) / 2, 0.09, top - 5, 0.08, joint, 0.22);
          }
          box('parapet', run / 2, top + 0.29, run + 0.03, 0.55, 0.33, stone);
          box('roof coping', run / 2, top + 0.56, run + 0.3, 0.16, 0.7, trim);
        }
      }
    }
  }
  if (spec.central) {
    for (let step = 0; step < 4; step++) {
      B.box(architecture, 'broad entrance step', (xmin + xmax) / 2, 0.13 + step * 0.13,
        front + 2.8 - step * 0.45, width * 0.73, 0.26, 5.6 - step * 0.9, trim);
    }
  }
  B.finish();
  detail.updateMatrixWorld(true);
  const meshBounds = new THREE.Box3().setFromObject(detail);
  detail.userData = {
    referenceSite: 'main-building', referencePages: REFERENCE_PAGES,
    role: spec.central ? 'central main building' : 'supporting main-building wing',
    frontNormalXZ: normal, estimatedHeight: meshBounds.max.y,
    windows: windowCount, colonnadeBays,
    footprintBasedArea: metrics.area,
    noReferencePhotoTextures: true,
    limitations: 'Facade proportions, stepped heights and repeated bay counts are interpreted from a frontal official photograph. Side and rear facades are generic inferred continuations. The 41m map display height is not certified survey data. No invented four bridge connections are added.',
  };
  return detail;
}

export function refineMainBuilding(campus, data, featureId) {
  const feature = data.features.find(item => item.id === featureId);
  const target = campus.buildings.get(featureId);
  if (!target || !feature || !target.getObjectByName('base')) throw new Error('Main-building replacement target is missing.');
  const position = target.userData.localOriginMeters;
  if (Math.abs(target.position.x - position[0]) > 1e-6 || Math.abs(target.position.z - position[1]) > 1e-6 ||
      target.position.y !== 0) throw new Error('Main-building placement has changed; review its map anchor.');
  const detail = createMainBuildingDetail(feature, data.metadata.center, position);
  const baseRenderHeight = target.userData.baseRenderHeight ?? target.userData.renderHeight;
  replaceBuilding(campus.buildings, featureId, detail);
  const spec = SPECS[MAIN_BUILDING_IDS.indexOf(featureId)];
  target.name = spec.name;
  Object.assign(target.userData, {
    name: spec.name, aliases: ['清华主楼', '主楼组团', ...(spec.central ? ['主楼'] : [])],
    baseRenderHeight, renderHeight: Number(detail.userData.estimatedHeight.toFixed(3)),
    heightSource: spec.central ? '上游显示高41米为比例基准；阶梯高度、窗列和柱廊按官方照片推定，非测绘'
      : '主楼正面照片的低侧翼比例推定；侧后立面为示意，非测绘',
    refinementSummary: spec.central
      ? '保留中央主楼原轮廓与后部突出体量，重建阶梯式浅色石墙、顶部高窗、凹进窗列、底层开放柱廊和宽台阶；隐藏立面、窗数及标高为比例推定。'
      : '保留独立东西主楼的开放平面与地图位置，补低层石墙、端部较高体量、成列凹窗及平顶檐线；正面照片外的侧后细节为示意，未虚构未核对的过街连接。',
    referenceSite: 'main-building', referencePages: REFERENCE_PAGES,
    limits: detail.userData.limitations, reconstructionBatch: 3,
    reconstructionLevel: 'photo-informed-estimate-not-surveyed',
  });
  target.updateWorldMatrix(true, true);
  return target;
}
