import * as THREE from 'three';
import polygonClipping from 'polygon-clipping';
import {createBuilder} from '../../shunde/src/builder.js';
import {footprintMetrics, ringArea} from './geo.js';
import {replaceBuilding, disposeOwnedDetail} from './model.js';
import {createMasonryMaterial, createGlazingMaterial} from './surface-materials.js';
import {ZIJING_APARTMENTS, zijingPartitions, verifyZijingSource} from './zijing-sources.js';
import {addFootprintPrism as prism, addTriangle as triangle, outlineEdges as edgesOf} from './architecture.js';
import catalog from '../reference-catalog.json' with {type: 'json'};

const PROJECTION_CENTER = [116.32003975, 40.00164005];
export const ZIJING_LIMITS = '已对齐地图和独立楼号1–23；14–17在一个原地图根内分区，未新增地图身份。'
  + '外观以校方组团照片和W楼外景约束类型，不是逐栋逐面照片复刻。'
  + '窗数、阳台、入口朝向、屋顶颜色分配、标高及隐蔽面含推定；楼层中1–13/20有OSM标注，19/21/22/23有官方11层说明，14–18仅估算。'
  + '1–23是本轮有来源的编号范围，不证明不存在更新楼号。无室内、地下层、住户资料或照片纹理。';

function validateOrigin(feature, center, origin) {
  verifyZijingSource(feature);
  const metrics = footprintMetrics(feature.geometry, center);
  if (!Array.isArray(center) || center.length !== 2 || !center.every((v, i) => v === PROJECTION_CENTER[i]) ||
      !Array.isArray(origin) || origin.length !== 2 ||
      !origin.every((v, i) => Number.isFinite(v) && Math.abs(v - metrics.origin[i]) < 1e-6)) {
    throw new Error('Zijing frozen projection/local origin changed.');
  }
  return metrics;
}

function materials() {
  return {
    wall: createMasonryMaterial('zijing: pale exterior masonry', [215, 218, 211], true),
    plinth: createMasonryMaterial('zijing: terracotta plinth', [146, 85, 66]),
    white: new THREE.MeshStandardMaterial({name: 'zijing: painted concrete', color: '#eeeade', roughness: .82}),
    frame: new THREE.MeshStandardMaterial({name: 'zijing: aluminium frames and rails', color: '#a5adb0', metalness: .28, roughness: .53}),
    glass: createGlazingMaterial('zijing: recessed dielectric glass'),
    roof: new THREE.MeshStandardMaterial({name: 'zijing: gray standing-seam roof', color: '#718693',
      metalness: .25, roughness: .71, side: THREE.DoubleSide}),
    redRoof: new THREE.MeshStandardMaterial({name: 'zijing: estimated red roof assignment', color: '#9e4355',
      metalness: .15, roughness: .76, side: THREE.DoubleSide}),
  };
}

export function pitchedRoof(B, roof, ring, edges, eave, M, material, {rise = 3.1, edgeRadius = .055} = {}) {
  const eaves = edges.filter(edge => edge.length > 28);
  if (!eaves.length) throw new Error('A pitched dormitory roof needs long eave edges.');
  const heightAt = p => eave + Math.min(rise, ...eaves.map(edge => {
    const d = [p[0] - edge.a[0], p[1] - edge.a[1]];
    const t = Math.max(0, Math.min(edge.length, d[0] * edge.tangent[0] + d[1] * edge.tangent[1]));
    return Math.hypot(d[0] - t * edge.tangent[0], d[1] - t * edge.tangent[1]) * .32;
  }));
  const minX = Math.min(...ring.map(p => p[0])), maxX = Math.max(...ring.map(p => p[0]));
  const minZ = Math.min(...ring.map(p => p[1])), maxZ = Math.max(...ring.map(p => p[1]));
  const closed = [...ring, ring[0]];
  const step = 1.5;
  for (let x = minX; x < maxX; x += step) for (let z = minZ; z < maxZ; z += step) {
    const clipped = polygonClipping.intersection([[closed]], [[[[x, z], [x + step, z], [x + step, z + step], [x, z + step], [x, z]]]]);
    for (const polygon of clipped) {
      const contour = polygon[0].slice(0, -1), points = contour.map(p => new THREE.Vector2(...p));
      for (const indices of THREE.ShapeUtils.triangulateShape(points, [])) {
        const vertices = indices.map(i => [contour[i][0], heightAt(contour[i]), contour[i][1]]);
        if (new THREE.Vector3(...vertices[1]).sub(new THREE.Vector3(...vertices[0]))
          .cross(new THREE.Vector3(...vertices[2]).sub(new THREE.Vector3(...vertices[0]))).y < 0) vertices.reverse();
        triangle(B, roof, vertices, material);
      }
    }
  }
  for (const edge of edges) {
    const steps = Math.ceil(edge.length / 3);
    for (let i = 0; i < steps; i++) {
      const a = edge.a.map((v, j) => v + edge.tangent[j] * edge.length * i / steps);
      const b = edge.a.map((v, j) => v + edge.tangent[j] * edge.length * (i + 1) / steps);
      const ha = heightAt(a), hb = heightAt(b);
      if (Math.max(ha, hb) > eave + .01) {
        triangle(B, roof, [[a[0], eave, a[1]], [b[0], eave, b[1]], [b[0], hb, b[1]]], M.white);
        triangle(B, roof, [[a[0], eave, a[1]], [b[0], hb, b[1]], [a[0], ha, a[1]]], M.white);
      }
      if (edgeRadius > 0) B.cylinder(roof, [a[0], ha, a[1]], [b[0], hb, b[1]], edgeRadius, edgeRadius, M.frame, 6);
    }
  }
}

function makeApartment(B, parent, part, origin, M) {
  const {number} = part, family = ZIJING_APARTMENTS.find(p => p.number === number).family;
  const ring = part.ring.map(p => p.map((v, i) => v - origin[i]));
  const group = new THREE.Group(); group.name = `紫荆学生公寓${number}号楼`; parent.add(group);
  const subgroup = name => {const g = new THREE.Group(); g.name = name; group.add(g); return g;};
  const structure = subgroup('Exact outline slabs and perforated masonry walls');
  const windows = subgroup('Recessed windows and divided frames');
  const balconies = subgroup('Open balconies, guardrails and pale vertical piers');
  const roof = subgroup(family === 'pitched-low-rise' ? 'Pitched roof and gable closures'
    : family === 'w-doctoral' ? 'W roof and glazed linking hall' : 'High-rise roof frames and stair cores');
  const low = family === 'pitched-low-rise', doctoral = family === 'w-doctoral';
  const floors = low ? 7 : doctoral ? 14 : 11, storey = low ? 3.12 : 3.18, base = .22, eave = base + floors * storey;
  const edges = edgesOf(ring), windowOpenings = [];
  const entry = edges.filter(edge => edge.length > 25 && edge.normal[1] > .5).sort((a, b) => b.length - a.length)[0];
  prism(B, structure, ring, 0, base, M.plinth);
  for (let level = 1; level <= floors; level++) prism(B, structure, ring, base + level * storey - .16, base + level * storey, M.white);
  let facadeSample, doorwayProbe;
  for (const edge of edges) {
    const {a, tangent: t, normal: n, length: L, yaw} = edge;
    const place = (g, x, y, offset, width, height, depth, mat) => B.box(g, '',
      a[0] + t[0] * x + n[0] * offset, y, a[1] + t[1] * x + n[1] * offset, width, height, depth, mat, yaw);
    if (!low && !doctoral && L > 8 && L < 28) {
      place(roof, L / 2, eave / 2, -.17, L, eave, .34, M.white);
      for (let level = 0; level < floors; level++) {
        place(roof, L / 2, base + level * storey + 1.7, .03, L * .62, .65, .07, M.glass);
      }
      place(roof, L / 2, eave + 1.4, -.17, L * .8, 2.8, .4, M.white);
      for (const x of [L * .15, L * .85]) place(roof, x, eave + 2.4, 0, .3, 4.8, .45, M.white);
      place(roof, L / 2, eave + 4.7, 0, L * .76, .25, .55, M.white);
      B.cylinder(roof, [a[0] + t[0] * L * .15, eave + 3.0, a[1] + t[1] * L * .15],
        [a[0] + t[0] * L * .85, eave + 4.6, a[1] + t[1] * L * .85], .07, .07, M.frame, 6);
      continue;
    }
    const closedSeam = doctoral && Math.abs(t[0]) < .15 && L < 18;
    const bays = Math.floor(L / (low ? 4.8 : doctoral ? 3.5 : 3.65));
    if (bays < 1 || closedSeam) {
      place(structure, L / 2, base + floors * storey / 2, -.17, L, floors * storey, .34, M.wall);
      continue;
    }
    const pitch = L / bays, openingWidth = Math.min(pitch - .72, low ? 2.85 : 2.1);
    const sill = low ? .75 : .9, openingHeight = low ? 1.94 : 1.62, head = sill + openingHeight;
    const front = !doctoral && n[1] > .6 && L > 30;
    const entryBay = edge === entry ? Math.floor(bays / 2) : -1;
    for (let level = 0; level < floors; level++) {
      const floorY = base + level * storey, mat = level === 0 ? M.plinth : M.wall;
      if (level === 0 && entryBay >= 0) {
        const center = (entryBay + .5) * pitch, left = center - openingWidth / 2, right = center + openingWidth / 2;
        place(structure, left / 2, floorY + sill / 2, -.17, left, sill, .34, mat);
        place(structure, (right + L) / 2, floorY + sill / 2, -.17, L - right, sill, .34, mat);
      } else place(structure, L / 2, floorY + sill / 2, -.17, L, sill, .34, mat);
      place(structure, L / 2, floorY + (head + storey) / 2, -.17, L, storey - head, .34, mat);
      for (let bay = 0; bay <= bays; bay++) {
        const width = bay === 0 || bay === bays ? (pitch - openingWidth) / 2 : pitch - openingWidth;
        const x = bay === 0 ? width / 2 : bay === bays ? L - width / 2 : bay * pitch;
        place(structure, x, floorY + (sill + head) / 2, -.17, width, openingHeight, .34, mat);
      }
      for (let bay = 0; bay < bays; bay++) {
        const door = level === 0 && bay === entryBay, bottom = door ? 0 : sill;
        const x = (bay + .5) * pitch, y = floorY + (bottom + head) / 2, clearHeight = head - bottom;
        place(windows, x, y, -.18, openingWidth, clearHeight, .07, M.glass);
        for (const side of [-1, 1]) place(windows, x + side * (openingWidth / 2 - .045), y, -.04, .09, clearHeight, .13, M.frame);
        place(windows, x, y, -.06, .055, clearHeight, .11, M.frame);
        for (const h of [bottom + .035, head - .035]) place(windows, x, floorY + h, -.04, openingWidth, .07, .13, M.frame);
        place(windows, x, floorY + bottom - .04, .05, openingWidth + .16, .08, .42, M.white);
        const center = [a[0] + t[0] * (x + openingWidth * .22), y, a[1] + t[1] * (x + openingWidth * .22)];
        const outside = [center[0] + n[0] * 1.8, y, center[2] + n[1] * 1.8];
        windowOpenings.push({outside, normal: [n[0], 0, n[1]], center});
        if (door) {
          doorwayProbe = {outside: [outside[0], base + .4, outside[2]], normal: [n[0], 0, n[1]]};
          for (const side of [-1, 1]) place(windows, x + side * .22, base + 1.25, .02, .035, .45, .06, M.frame);
        }
        if (!facadeSample && n[1] > .6 && level === 2 && bay === Math.floor(bays / 2)) {
          facadeSample = {glazing: [center[0] - n[0] * .13, y, center[2] - n[1] * .13],
            masonry: [a[0] + t[0] * x + n[0] * .01, floorY + .4, a[1] + t[1] * x + n[1] * .01]};
        }
        if (front && level > 0) {
          const depth = low ? 1.1 : .8, width = pitch - .28;
          place(balconies, x, floorY + .07, depth / 2, width, .14, depth, M.white);
          place(balconies, x, floorY + 1.0, depth, width, .065, .065, M.frame);
          place(balconies, x, floorY + .35, depth, width, .06, .055, M.frame);
          for (let post = 0; post <= 4; post++) {
            place(balconies, x - width / 2 + post * width / 4, floorY + .56, depth, .045, .88, .045, M.frame);
          }
          for (const side of [-1, 1]) {
            place(balconies, x + side * width / 2, floorY + .56, depth / 2, .065, .9, depth, M.frame);
          }
        }
      }
    }
    if (front && low) {
      for (let bay = 0; bay <= bays; bay++) {
        place(balconies, bay * pitch, base + floors * storey / 2, .73, .24, floors * storey, .95, M.white);
      }
      for (let bay = 0; bay < bays; bay++) {
        const x = (bay + .5) * pitch, half = pitch * .33;
        const point = (dx, y, z) => [a[0] + t[0] * (x + dx) + n[0] * z, y, a[1] + t[1] * (x + dx) + n[1] * z];
        triangle(B, roof, [point(-half, eave, 1.2), point(half, eave, 1.2), point(0, eave + .95, 1.2)], M.white);
        for (const side of [-1, 1]) {
          triangle(B, roof, [point(side * half, eave, 1.25), point(0, eave + .95, 1.25), point(0, eave + .95, -2.9)], M.roof);
          triangle(B, roof, [point(side * half, eave, 1.25), point(0, eave + .95, -2.9), point(side * half, eave, -2.9)], M.roof);
        }
      }
    }
    if (!low) {
      for (const y of [eave + .3, eave + .9]) place(roof, L / 2, y, 0, L, .12, .38, M.white);
    }
  }
  if (low) pitchedRoof(B, roof, ring, edges, eave, M, number <= 7 ? M.redRoof : M.roof);
  else {
    prism(B, roof, ring, eave, eave + .16, M.roof);
    if (doctoral) {
      const centerX = (Math.min(...ring.map(p => p[0])) + Math.max(...ring.map(p => p[0]))) / 2;
      const linkingEdge = edges.filter(edge => edge.length > 5 && edge.length < 16 && edge.normal[1] > .2)
        .sort((a, b) => Math.abs((a.a[0] + a.b[0]) / 2 - centerX) - Math.abs((b.a[0] + b.b[0]) / 2 - centerX))[0];
      if (!linkingEdge) throw new Error('W apartment needs its mapped central linking segment.');
      const {a, tangent: t, normal: n, length: L, yaw} = linkingEdge;
      B.box(roof, '', a[0] + t[0] * L / 2 + n[0] * .1, eave / 2,
        a[1] + t[1] * L / 2 + n[1] * .1, L * .76, eave - 1, .15, M.glass, yaw);
      for (let level = 1; level < floors; level++) B.box(roof, '',
        a[0] + t[0] * L / 2 + n[0] * .22, base + level * storey,
        a[1] + t[1] * L / 2 + n[1] * .22, L * .82, .12, .18, M.white, yaw);
    }
  }
  if (entry) {
    const {a, length: L, tangent: t, normal: n, yaw} = entry;
    const bays = Math.floor(L / (low ? 4.8 : doctoral ? 3.5 : 3.65)), entranceX = (Math.floor(bays / 2) + .5) * L / bays;
    B.box(balconies, '', a[0] + t[0] * entranceX + n[0], 3.0, a[1] + t[1] * entranceX + n[1],
      4.0, .18, 2.5, M.white, yaw);
    const digits = ['abcdef', 'bc', 'abdeg', 'abcdg', 'bcfg', 'acdfg', 'acdefg', 'abc', 'abcdefg', 'abcdfg'];
    const segments = {a: [0, .3, .36, .055], b: [.18, .15, .055, .3], c: [.18, -.15, .055, .3],
      d: [0, -.3, .36, .055], e: [-.18, -.15, .055, .3], f: [-.18, .15, .055, .3], g: [0, 0, .36, .055]};
    const text = String(number), plateY = low ? eave - .34 : 4.0, width = text.length * .62 + .2;
    const plate = (x, y, z, w, h, d, material) => B.box(balconies, '',
      a[0] + t[0] * (L * .5 + x) + n[0] * z, y, a[1] + t[1] * (L * .5 + x) + n[1] * z,
      w, h, d, material, yaw);
    plate(0, plateY, .12, width, .82, .14, M.roof);
    for (let i = 0; i < text.length; i++) for (const name of digits[Number(text[i])]) {
      const [x, y, w, h] = segments[name];
      plate((i - (text.length - 1) / 2) * .62 + x, plateY + y, .23, w, h, .05, M.white);
    }
  }
  group.userData = {apartmentNumber: number, family, estimatedFloors: floors,
    viewDirection: number >= 18 ? [-.7, .42, 1.1] : [.18, .38, 1.1],
    floorsSource: [19, 21, 22, 23].includes(number) ? 'Official accommodation guide: 11 floors; metre height estimated.'
      : number <= 13 || number === 20 ? 'Local OSM building:levels; not a surveyed count.'
        : 'Photo/family estimate only; not an independently verified floor count.',
    eaveHeight: eave, footprintArea: ringArea(ring), footprintRingLocal: ring,
    certainty: 'group-photo-typology-estimate', windowCount: windowOpenings.length, windowOpenings,
    facadeSample, doorwayProbe, doorwayCount: doorwayProbe ? 1 : 0,
    roofColorAssignment: 'estimated-by-group-location-not-individually-verified'};
  if (!facadeSample) {
    const sample = windowOpenings[Math.floor(windowOpenings.length / 2)];
    group.userData.facadeSample = {glazing: sample.center, masonry: [sample.center[0], sample.center[1] - 1.0, sample.center[2]]};
  }
}

export function createZijingDetail(feature, center, origin) {
  const metrics = validateOrigin(feature, center, origin), source = verifyZijingSource(feature);
  const parts = zijingPartitions(feature, center), detail = new THREE.Group(), M = materials();
  detail.name = `紫荆 ${source.numbers.join(' / ')} · 组团照片类型估算`;
  const B = createBuilder(THREE, source.numbers[0]);
  B.textureWorld.set(M.wall, [4, 2]); B.textureWorld.set(M.plinth, [1, .64]);
  for (const part of parts) makeApartment(B, detail, part, origin, M);
  B.finish();
  const used = new Set();
  detail.traverse(object => {
    if (!object.isMesh) return;
    used.add(object.material);
    if (object.parent.name === 'Pitched roof and gable closures' && [M.roof, M.redRoof].includes(object.material)) {
      object.receiveShadow = false;
    }
  });
  for (const material of Object.values(M)) if (!used.has(material)) {
    for (const value of Object.values(material)) if (value?.isTexture) value.dispose();
    material.dispose();
  }
  detail.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(detail), reference = catalog.sites.find(site => site.id === source.referenceSite);
  if (!reference?.images.length) throw new Error('Missing Zijing group-photo reference provenance.');
  detail.userData = {buildingFeatureId: source.featureId, referenceSite: source.referenceSite,
    referenceBasis: 'group-photo-typology-estimate', noReferencePhotoTextures: true,
    referencePages: [...new Set(reference.images.map(image => image.pageUrl))],
    referenceImages: reference.images.map(image => image.imageUrl), apartmentNumbers: source.numbers,
    footprintArea: metrics.area, estimatedDimensionsMeters: {meshLocalYMin: bounds.min.y, meshLocalYMax: bounds.max.y},
    limits: ZIJING_LIMITS};
  return detail;
}

export function refineZijing(campus, data, featureId) {
  const matches = data.features.filter(f => f.id === featureId);
  if (matches.length !== 1) throw new Error('Zijing source identity must occur exactly once.');
  const source = verifyZijingSource(matches[0]), root = campus.buildings.get(featureId);
  const metrics = validateOrigin(matches[0], data.metadata.center, root?.userData.localOriginMeters);
  if (!root || root.userData.featureId !== featureId || !root.getObjectByName('base') ||
      root.position.y !== 0 || Math.abs(root.position.x - metrics.origin[0]) > 1e-6 ||
      Math.abs(root.position.z - metrics.origin[1]) > 1e-6 ||
      !root.scale.equals(new THREE.Vector3(1, 1, 1)) || !root.rotation.toArray().slice(0, 3).every(v => v === 0)) {
    throw new Error('Zijing root placement/identity mismatch.');
  }
  const previous = root.children.find(c => c.userData.campusDetail);
  if (previous && previous.userData.referenceSite !== source.referenceSite) throw new Error('Refusing to replace a foreign Zijing detail.');
  const detail = createZijingDetail(matches[0], data.metadata.center, root.userData.localOriginMeters);
  const baseRenderHeight = root.userData.baseRenderHeight ?? root.userData.renderHeight;
  replaceBuilding(campus.buildings, featureId, detail);
  Object.assign(root.userData, {baseRenderHeight, referenceSite: source.referenceSite,
    referenceBasis: detail.userData.referenceBasis, apartmentNumbers: source.numbers,
    exportFilename: `tsinghua-zijing-${source.numbers.length === 1 ? source.numbers[0] : '14-17'}.glb`,
    referencePages: detail.userData.referencePages, referenceImages: detail.userData.referenceImages,
    refinementSummary: `紫荆学生公寓${source.numbers.join('–')}号楼：分楼建模窗洞、退入玻璃、窗框、坡顶或高层分带。${ZIJING_LIMITS}`,
    heightSource: '组团照片／楼层比例估算，非测绘', renderHeight: detail.userData.estimatedDimensionsMeters.meshLocalYMax,
    estimatedDimensionsMeters: detail.userData.estimatedDimensionsMeters,
  });
  if (previous) disposeOwnedDetail(previous);
  return root;
}
