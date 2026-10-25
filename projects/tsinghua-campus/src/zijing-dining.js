import * as THREE from 'three';
import {createBuilder} from '../../shunde/src/builder.js';
import {footprintMetrics} from './geo.js';
import {addFootprintPrism, outlineEdges} from './architecture.js';
import {createMasonryMaterial, createGlazingMaterial} from './surface-materials.js';
import {replaceBuilding, disposeOwnedDetail} from './model.js';
import catalog from '../reference-catalog.json' with {type: 'json'};

export const DINING_SOURCES = [
  {featureId: 'building:geometry:2fdef392d2887d29d23de389', name: '紫荆园餐厅',
    osmWay: '79696970', referenceSite: 'zijing-dining', floors: 4, height: 19, signature: '649550df'},
  {featureId: 'building:geometry:640356e14bcb51ae2b2f9dde', name: '桃李园餐厅',
    osmWay: '79696971', referenceSite: 'taoli-dining', floors: 3, height: 15, signature: 'a6bdb4e6'},
];

function sourceFor(feature) {
  const source = DINING_SOURCES.find(s => s.featureId === feature?.id), p = feature?.properties;
  let signature = 2166136261;
  for (const c of JSON.stringify(feature?.geometry) || '') signature = Math.imul(signature ^ c.charCodeAt(0), 16777619) >>> 0;
  if (!source || p?.kind !== 'building' || p.name !== source.name ||
      p.nameSourceFeatureId !== `osm:way:${source.osmWay}` || p.nameSource !== 'osm-local-extract-building-overlap' ||
      p.renderHeight !== source.height || p.minHeight !== 0 || p.extrude !== true ||
      signature.toString(16).padStart(8, '0') !== source.signature) {
    throw new Error('Dining frozen footprint/identity changed; re-review the source.');
  }
  return source;
}

export function createDiningDetail(feature, center, origin) {
  const source = sourceFor(feature), metrics = footprintMetrics(feature.geometry, center);
  if (!center.every((v, i) => v === [116.32003975, 40.00164005][i]) ||
      !origin?.every((v, i) => Number.isFinite(v) && Math.abs(v - metrics.origin[i]) < 1e-6)) {
    throw new Error('Dining frozen projection/local origin changed.');
  }
  const ring = metrics.projected[0][0].slice(0, -1).map(p => p.map((v, i) => v - origin[i]));
  const edges = outlineEdges(ring), detail = new THREE.Group(), B = createBuilder(THREE, Number(source.osmWay));
  detail.name = source.name;
  const group = name => {const g = new THREE.Group(); g.name = name; detail.add(g); return g;};
  const shell = group('Exact source foundation and layered rounded footprint');
  const glass = group('Continuous recessed glazing and vertical mullions');
  const roof = group('Quiet estimated rear roof');
  const entrance = group(source.referenceSite === 'taoli-dining' ? 'Tall round entrance window and open portal' : 'Paired stair towers and open rooftop frames');
  const wall = createMasonryMaterial('dining: pale stone bands', [219, 209, 185], true);
  const metal = new THREE.MeshStandardMaterial({name: 'dining: cream painted metal', color: '#e8e9de', roughness: .62, metalness: .15});
  const dark = new THREE.MeshStandardMaterial({name: 'dining: bronze window frames', color: '#736a54', roughness: .6, metalness: .35});
  const glazing = createGlazingMaterial('dining: recessed dielectric glass');
  B.textureWorld.set(wall, [4, 2]);
  const height = source.floors * 4.4, base = .22;
  addFootprintPrism(B, shell, ring, 0, base, wall);
  for (let floor = 0; floor < source.floors; floor++) {
    const y = base + floor * 4.4;
    addFootprintPrism(B, shell, ring, y, y + .65, wall);
    addFootprintPrism(B, shell, ring, y + 3.95, y + 4.4, wall);
    for (const {a, tangent: t, normal: n, length: L, yaw} of edges) {
      B.box(glass, '', a[0] + t[0] * L / 2 - n[0] * .22, y + 2.3,
        a[1] + t[1] * L / 2 - n[1] * .22, L, 3.3, .10, glazing, yaw);
      const bays = Math.max(1, Math.ceil(L / 2.8));
      for (let bay = 0; bay <= bays; bay++) {
        const x = L * bay / bays;
        B.box(glass, '', a[0] + t[0] * x, y + 2.3, a[1] + t[1] * x, .075, 3.3, .14, dark, yaw);
      }
      for (const h of [1.3, 2.7, 3.7]) {
        B.box(glass, '', a[0] + t[0] * L / 2 + n[0] * .12, y + h,
          a[1] + t[1] * L / 2 + n[1] * .12, L, .09, .3, metal, yaw);
      }
    }
  }
  addFootprintPrism(B, roof, ring, height + base, height + base + .18, metal);
  const front = edges.filter(e => e.normal[1] > .7 && e.length > 8)
    .sort((a, b) => (b.a[1] + b.b[1]) - (a.a[1] + a.b[1]))[0];
  if (!front) throw new Error('Dining entrance needs a mapped south-facing front segment.');
  const {a, tangent: t, normal: n, length: L, yaw} = front, x = L / 2;
  const position = (dx, y, offset) => [a[0] + t[0] * (x + dx) + n[0] * offset,
    y, a[1] + t[1] * (x + dx) + n[1] * offset];
  const box = (dx, y, z, w, h, d, m) => B.box(entrance, '', ...position(dx, y, z), w, h, d, m, yaw);
  box(0, height / 2, .36, 7.7, height, .12, glazing);
  box(0, height / 2, .58, .12, height, .2, metal);
  for (let floor = 1; floor <= source.floors; floor++) box(0, base + floor * 4.4, .58, 7.8, .15, .2, metal);
  for (const dx of [-2.6, 2.6]) box(dx, 1.5, .64, .1, 2.8, .15, metal);
  for (const dx of [-.25, .25]) box(dx, 1.4, .72, .035, .5, .05, dark);
  for (const dx of [-4.2, 4.2]) {
    box(dx, height / 2 + .5, .5, .8, height + 1, .8, wall);
    for (let floor = 0; floor < source.floors; floor++) box(dx, 2.3 + floor * 4.4, .94, .42, 1.8, .08, glazing);
  }
  box(0, 3.25, 1.1, 10, .25, 2.5, metal);
  if (source.referenceSite === 'taoli-dining') {
    const cy = height - 1.0, radius = 3.5;
    const torus = new THREE.TorusGeometry(radius, .16, 8, 48);
    torus.rotateY(yaw); torus.translate(...position(0, cy, .58)); B.add(entrance, torus, metal);
    box(0, cy, .61, .18, radius * 2, .22, metal);
    box(0, cy, .61, radius * 2, .18, .22, metal);
    for (const y of [4.4, 7.2]) box(0, y, .61, 7, .12, .2, metal);
  } else {
    for (const dx of [-4.2, 4.2]) {
      box(dx, height + 2.2, .4, .65, 3.4, .8, wall);
      box(dx, height + 3.9, .4, 3.2, .2, 1.4, metal);
      const start = position(dx - 1.4, height + 2.4, .4), end = position(dx + 1.4, height + 3.7, .4);
      B.cylinder(entrance, start, end, .065, .065, dark, 8);
    }
  }
  B.finish(); detail.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(detail), reference = catalog.sites.find(site => site.id === source.referenceSite);
  if (!reference?.images.length) throw new Error('Missing dining exterior reference provenance.');
  detail.userData = {buildingFeatureId: source.featureId, referenceSite: source.referenceSite,
    noReferencePhotoTextures: true, footprintArea: metrics.area, floorsAboveGround: source.floors,
    referencePages: reference.images.map(image => image.pageUrl), referenceImages: reference.images.map(image => image.imageUrl),
    estimatedDimensionsMeters: {meshLocalYMin: bounds.min.y, meshLocalYMax: bounds.max.y},
    limits: '官方食堂介绍明确含地下一层，本模型只做地上层；官方识别卡中的小幅外景仅支持弧形分带与入口构图。轮廓不变，窗格、朝向、圆窗/构架尺寸、后立面与高度为估算，非测绘；无室内、地下模型和照片纹理。'};
  return detail;
}

export function refineDining(campus, data, featureId) {
  const matches = data.features.filter(f => f.id === featureId);
  if (matches.length !== 1) throw new Error('Dining identity must occur exactly once.');
  const source = sourceFor(matches[0]), root = campus.buildings.get(featureId);
  const metrics = footprintMetrics(matches[0].geometry, data.metadata.center);
  if (!root || root.userData.featureId !== featureId || !root.getObjectByName('base') ||
      root.position.y !== 0 || Math.abs(root.position.x - metrics.origin[0]) > 1e-6 || Math.abs(root.position.z - metrics.origin[1]) > 1e-6 ||
      !root.scale.equals(new THREE.Vector3(1, 1, 1)) || !root.rotation.toArray().slice(0, 3).every(v => v === 0)) {
    throw new Error('Dining root placement/identity mismatch.');
  }
  const previous = root.children.find(child => child.userData.campusDetail);
  if (previous && previous.userData.referenceSite !== source.referenceSite) throw new Error('Refusing to replace a foreign dining detail.');
  const detail = createDiningDetail(matches[0], data.metadata.center, root.userData.localOriginMeters);
  const baseRenderHeight = root.userData.baseRenderHeight ?? root.userData.renderHeight;
  replaceBuilding(campus.buildings, featureId, detail);
  Object.assign(root.userData, {baseRenderHeight, referenceSite: source.referenceSite,
    renderHeight: detail.userData.estimatedDimensionsMeters.meshLocalYMax, heightSource: '官方地上层数／外景比例估算，非测绘',
    refinementSummary: `${source.name}：水平分带、退入窗带和${source.floors}层地上体量；${detail.userData.limits}`,
    referencePages: detail.userData.referencePages, referenceImages: detail.userData.referenceImages,
    estimatedDimensionsMeters: detail.userData.estimatedDimensionsMeters});
  if (previous) disposeOwnedDetail(previous);
  return root;
}
