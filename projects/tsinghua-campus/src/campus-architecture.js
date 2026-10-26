import * as THREE from 'three';
import polygonClipping from 'polygon-clipping';
import {createBuilder} from '../../shunde/src/builder.js';
import {footprintMetrics} from './geo.js';
import {outlineEdges} from './architecture.js';
import {disposeOwnedDetail, replaceBuilding} from './model.js';
import {createMasonryMaterial, createGlazingMaterial, createEstimatedFacade} from './surface-materials.js';
import evidence from '../data/architecture-evidence.json' with {type: 'json'};
import {architectureSignature} from './architecture-contract.js';
import {appearanceProfile, appearanceSource, appearanceLimitations} from './photo-appearance.js';
import {pitchedRoof} from './zijing.js';

export const ARCHITECTURE_FAMILIES = {
  academic: '教学／科研类型', residential: '住宅／宿舍类型', commercial: '办公／商业类型',
  service: '附属服务类型', bungalow: '低层房屋类型', pavilion: '开敞亭廊类型',
  grandstand: '看台类型', neutral: '未核实用途',
};
export const ARCHITECTURE_LIMITS = '程序建筑估算，非照片重建。保留冻结轮廓、庭院孔洞和原编号；'
  + '只采用重叠核验的本地OSM建筑类型／地上层数，无标签时保留地图显示高度。'
  + '窗位、窗数、门、朝向、材质、屋顶与层高均未逐栋核实；不复制住宅、房间或人员资料。';
const byId = new Map(evidence.buildings.map(record => [record.featureId, record]));
const states = new WeakMap();

export function architectureSpec(feature) {
  const record = byId.get(feature.id);
  const tags = record?.match === 'overlap-verified' ? record.tags : {};
  const type = tags.building;
  const family = ['university', 'school', 'college', 'kindergarten'].includes(type) ? 'academic'
    : ['residential', 'dormitory', 'apartments', 'hotel'].includes(type) ? 'residential'
      : ['office', 'commercial', 'retail'].includes(type) ? 'commercial'
        : ['service', 'bungalow', 'pavilion', 'grandstand'].includes(type) ? type : 'neutral';
  const taggedFloors = tags['building:levels'];
  if (taggedFloors !== undefined && (!/^[1-9]\d*$/.test(taggedFloors) || Number(taggedFloors) > 50)) {
    throw new Error(`Unsupported source floor count for ${feature.id}: ${taggedFloors}`);
  }
  const bottom = feature.properties.minHeight, mapTop = feature.properties.renderHeight;
  if (feature.properties.extrude === false || ![bottom, mapTop].every(Number.isFinite) || bottom < 0 || mapTop <= bottom) {
    throw new Error(`Architecture requires a finite extrudable height range: ${feature.id}`);
  }
  const appearance = appearanceProfile(feature);
  const floors = appearance?.floors ?? (taggedFloors ? Number(taggedFloors) : Math.max(1, Math.floor((mapTop - bottom) / 3.2)));
  const top = appearance?.estimatedHeight !== undefined ? bottom + appearance.estimatedHeight
    : taggedFloors ? bottom + floors * 3.2 : mapTop;
  return {family, bottom, top, floors, appearance, source: record || null, taggedFloors: Boolean(taggedFloors),
    floorsSource: appearance?.floors ? `${appearance.site}: photo-guided facade rhythm; estimated, not a confirmed floor count`
      : taggedFloors ? `${record.sourceId} building:levels=${taggedFloors}; community tag, not surveyed`
      : 'Facade rhythm from map display height / 3.2m; not an observed floor count.',
    heightSource: appearance?.estimatedHeight !== undefined
      ? `${appearance.site}: photo-guided proportion, estimated ${appearance.estimatedHeight}m; not measured`
      : taggedFloors ? `OSM building:levels=${taggedFloors} × estimated 3.2m/storey; not measured`
      : feature.properties.heightSource};
}

export function createArchitectureResources() {
  const facade = createEstimatedFacade();
  const M = {
    academic: createMasonryMaterial('architecture: estimated academic masonry', [201, 186, 161], true),
    residential: createMasonryMaterial('architecture: estimated residential render', [213, 207, 191], true),
    commercial: createMasonryMaterial('architecture: estimated commercial stone', [193, 202, 201], true),
    neutral: createMasonryMaterial('architecture: unknown exterior, neutral masonry', [207, 204, 192], true),
    plinth: createMasonryMaterial('architecture: estimated masonry plinth', [141, 136, 124]),
    trim: new THREE.MeshStandardMaterial({name: 'architecture: estimated pale coping', color: '#e6e3d8', roughness: .79}),
    roof: new THREE.MeshStandardMaterial({name: 'architecture: neutral roof, form unverified', color: '#8c9696', roughness: .86}),
    frame: new THREE.MeshStandardMaterial({name: 'architecture: estimated metal window frames', color: '#b0bcbd', metalness: .25, roughness: .47}),
    glass: createGlazingMaterial('architecture: recessed dielectric glass'),
    farWall: facade.material,
    farTint: new THREE.MeshStandardMaterial({name: 'architecture: display-only vertex-colored roof and photo appearance',
      color: '#ffffff', vertexColors: true, roughness: .84}),
    photoBrick: createMasonryMaterial('architecture: original procedural photo-guided brick basis', [255, 255, 255]),
    photoRender: createMasonryMaterial('architecture: original procedural photo-guided stone/render basis', [255, 255, 255], true),
  };
  const materials = new Set(Object.values(M)), profiles = new Map();
  Object.values(M).forEach(material => {material.userData.sharedCampusMaterial = true;});
  return {M, forProfile(profile) {
    if (profiles.has(profile.id)) return profiles.get(profile.id);
    const colors = {...M};
    for (const [part, color] of Object.entries(profile.palette)) {
      const source = ['wall', 'plinth'].includes(part) ? M[profile.surface === 'brick' ? 'photoBrick' : 'photoRender'] : M[part];
      if (!source) throw new Error(`Unsupported photo appearance material: ${part}`);
      const material = source.clone();
      material.name = `architecture: photo-guided ${profile.id} ${part}${part === 'glass' ? ' recessed glass' : ''}`;
      material.color.set(color);
      material.userData = {...material.userData, appearanceProfile: profile.id};
      colors[part] = material; materials.add(material);
    }
    profiles.set(profile.id, colors);
    return colors;
  }, dispose() {
    const textures = new Set();
    for (const material of materials) {
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
      material.dispose();
    }
    textures.forEach(texture => texture.dispose());
  }};
}

function prism(B, group, rings, bottom, top, material) {
  const shape = new THREE.Shape(rings[0].map(([x, z]) => new THREE.Vector2(x, -z)));
  for (const ring of rings.slice(1)) shape.holes.push(new THREE.Path(ring.map(([x, z]) => new THREE.Vector2(x, -z))));
  const geometry = new THREE.ExtrudeGeometry(shape, {depth: top - bottom, bevelEnabled: false, curveSegments: 1});
  geometry.rotateX(-Math.PI / 2); geometry.translate(0, bottom, 0);
  B.worldUV(geometry, material); B.add(group, geometry, material);
}

function surfaces(B) {
  const buffers = new Map();
  return {
    quad(group, material, points, outward) {
      const key = `${group.uuid}:${material.uuid}`;
      if (!buffers.has(key)) buffers.set(key, {group, material, position: [], uv: [], index: []});
      const buffer = buffers.get(key), start = buffer.position.length / 3;
      const a = new THREE.Vector3(...points[0]), b = new THREE.Vector3(...points[1]), c = new THREE.Vector3(...points[2]);
      const reverse = b.sub(a).cross(c.sub(a)).dot(new THREE.Vector3(...outward)) < 0;
      buffer.position.push(...points.flat());
      for (const point of points) buffer.uv.push((Math.abs(outward[0]) > .7 ? point[2] : point[0]) / 4,
        (Math.abs(outward[1]) > .7 ? point[2] : point[1]) / 4);
      const indices = points.length === 3 ? reverse ? [0, 2, 1] : [0, 1, 2]
        : reverse ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3];
      for (const index of indices) buffer.index.push(start + index);
    },
    finish() {
      for (const {group, material, position, uv, index} of buffers.values()) {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
        geometry.setIndex(index); geometry.computeVertexNormals(); B.worldUV(geometry, material);
        B.add(group, geometry, material);
      }
    },
  };
}

function photoEntrance(B, group, edge, center, spec, M, roof) {
  const profile = spec.appearance;
  if (!profile || !center || profile.entry === 'plain') return;
  const {a, tangent: t, normal: n, yaw, length} = edge;
  const offset = (center[0] - a[0]) * t[0] + (center[2] - a[1]) * t[1];
  const point = (x, y, depth) => [a[0] + t[0] * (offset + x) + n[0] * depth,
    y, a[1] + t[1] * (offset + x) + n[1] * depth];
  const box = (x, y, depth, width, height, thickness, material = M.trim) =>
    B.box(group, '', ...point(x, y, depth), width, height, thickness, material, yaw);
  const width = Math.min(10, length * .38), base = spec.bottom + .16;
  const eave = spec.top - (profile.roofFeatureRise || .45);
  if (profile.entry === 'triple-arch') {
    const bay = width / 3, radius = bay / 2, spring = Math.min(eave - radius - .3, base + 6.3);
    for (let i = 0; i < 4; i++) {
      B.cylinder(group, point(-width / 2 + i * bay, base, .7),
        point(-width / 2 + i * bay, spring, .7), .22, .22, M.trim, 8);
    }
    for (let i = 0; i < 3; i++) {
      const geometry = new THREE.TorusGeometry(radius, .16, 6, 16, Math.PI);
      geometry.rotateY(yaw); geometry.translate(...point(-width / 2 + (i + .5) * bay, spring, .7));
      B.add(group, geometry, M.trim);
    }
    box(0, base + (spring - base) * .55, .7, width + .44, .22, .5);
  } else if (profile.entry === 'colonnade') {
    const high = Math.min(eave - .5, base + 5.7);
    for (const x of [-.5, -.18, .18, .5]) {
      B.cylinder(group, point(x * width, base, .7), point(x * width, high, .7), .22, .22, M.trim, 10);
    }
    box(0, high + .13, .7, width + .6, .26, 1.2);
  } else if (profile.entry === 'glazed-bay') {
    const high = Math.min(eave - .3, base + 6);
    for (const x of [-1, 1]) box(x * 1.35, (base + high) / 2, .12, .24, high - base, .5);
    box(0, high, .12, 3, .3, .5);
  } else if (profile.entry === 'stepped-portal') {
    const high = eave - .15;
    for (const x of [-1, 1]) box(x * 2.1, (base + high) / 2, .12, .5, high - base, .45);
    box(0, high - .2, .12, 4.7, .4, .45);
    box(0, spec.top - .12, -.08, 2.9, .24, .3);
  } else if (profile.entry === 'roof-fins') {
    const span = Math.min(length * .65, 21), rise = profile.roofFeatureRise;
    if (!(rise > 0)) throw new Error('Photo roof fins require a bounded vertical allowance.');
    for (let i = 0; i <= 20; i++) {
      const height = rise * (.55 + .45 * Math.sin(Math.PI * i / 20));
      box((i / 20 - .5) * span, eave + height / 2, -4, .07, height, 5.5);
    }
  } else throw new Error(`Unsupported photo entrance: ${profile.entry}`);
  if (profile.id === 'mingli') {
    const rise = profile.roofFeatureRise, high = spec.top - rise;
    for (const x of [-1, 1]) box(x * width * .42, high + rise * .325, -2, .24, rise * .65, .35);
    box(0, high + rise * .65, -2, width * .84, .2, .35);
    const radius = width * .42;
    const canopy = new THREE.CylinderGeometry(radius, radius, 2.8, 24, 1, true, -Math.PI / 2, Math.PI);
    canopy.rotateX(-Math.PI / 2); canopy.scale(1, rise * .45 / radius, 1);
    canopy.rotateY(yaw); canopy.translate(...point(0, high + rise * .55, -3.2));
    B.add(roof, canopy, M.roof);
  }
}

export function createArchitectureDetail(feature, center, origin, palette) {
  const metrics = footprintMetrics(feature.geometry, center), spec = architectureSpec(feature), profile = spec.appearance;
  const M = profile ? palette.forProfile(profile) : palette.M;
  if (!origin?.every((value, i) => Number.isFinite(value) && Math.abs(value - metrics.origin[i]) < 1e-6)) {
    throw new Error(`Architecture local origin changed: ${feature.id}`);
  }
  const detail = new THREE.Group(); detail.name = 'Footprint-preserving procedural architecture estimate';
  const near = new THREE.Group(), far = new THREE.Group();
  near.name = 'Near: perforated walls, recessed windows and roof details';
  far.name = 'Far: lightweight same-outline envelope'; far.visible = false;
  near.userData.architectureNear = true; far.userData.architectureFar = true;
  detail.add(near, far);
  const B = createBuilder(THREE), panels = surfaces(B);
  for (const material of [M.academic, M.residential, M.commercial, M.neutral, M.plinth]) B.textureWorld.set(material, [4, 4]);
  if (profile) for (const material of [M.wall, M.plinth]) B.textureWorld.set(material,
    profile.surface === 'brick' ? [1.05, .52] : [2.4, 3.2]);
  const group = name => {const g = new THREE.Group(); g.name = name; near.add(g); return g;};
  const structure = group('Perforated perimeter and courtyard walls');
  const windows = group('Recessed glazing, reveals and divided frames');
  const roof = group('Exact outline roof, raised coping and entrance');
  const wall = M.wall || M[spec.family] || M.neutral;
  const open = ['pavilion', 'grandstand'].includes(spec.family);
  const {bottom, top, floors} = spec, roofY = open ? top
    : top - (profile?.roofRise || profile?.roofFeatureRise || Math.min(.45, (top - bottom) * .1));
  const baseY = bottom + .16, storey = (roofY - baseY) / floors;
  const polygons = metrics.projected.map(polygon => polygon.map(ring => ring.slice(0, -1).map(point => point.map((v, i) => v - origin[i]))));
  const windowsProbes = [], doorProbes = [], farWindowPositions = [], farWindowColors = [];
  const farColor = new THREE.Color(profile?.palette.glass || '#365b6b').toArray();
  const farWindow = points => {
    for (const i of [0, 1, 2, 0, 2, 3]) {farWindowPositions.push(...points[i]); farWindowColors.push(...farColor);}
  };
  let sample, entranceEdge, entrancePoint, totalBays = 0, sampleScore = -Infinity;
  const edgeSets = polygons.map(polygon => polygon.map((ring, i) => outlineEdges(ring)
    .map(edge => i ? {...edge, normal: edge.normal.map(v => -v)} : edge)));
  const candidates = edgeSets.flatMap(rings => rings[0]).filter(edge => edge.length >= 2.8);
  entranceEdge = candidates.sort((a, b) => (open ? 0 : (b.normal[1] > .3) - (a.normal[1] > .3)) || b.length - a.length)[0];
  const sampleDirection = profile?.inspectionDirection
    ? new THREE.Vector2(profile.inspectionDirection[0], profile.inspectionDirection[2]).normalize().toArray()
    : entranceEdge?.normal;
  for (const [polygonIndex, rings] of polygons.entries()) {
    prism(B, structure, rings, bottom, baseY, M.plinth);
    prism(B, roof, rings, roofY - .14, roofY, M.roof);
    if (profile?.roofRise) {
      if (rings.length !== 1) throw new Error('Photo-guided pitched roof cannot close an unknown courtyard.');
      pitchedRoof(B, roof, rings[0], edgeSets[polygonIndex][0], roofY,
        {white: M.trim, frame: M.frame}, M.roof, {rise: profile.roofRise, edgeRadius: 0});
    }
    if (spec.family === 'grandstand') {
      const front = edgeSets[polygonIndex][0].reduce((a, b) => a.length > b.length ? a : b);
      const {a, tangent: t, normal: n} = front;
      const depth = Math.max(...rings[0].map(p => -((p[0] - a[0]) * n[0] + (p[1] - a[1]) * n[1])));
      const point = (x, d) => [a[0] + t[0] * x - n[0] * d, a[1] + t[1] * x - n[1] * d];
      const closed = rings.map(ring => [...ring, ring[0]]);
      for (let tier = 0; tier < 6; tier++) {
        const rectangle = [point(-depth, depth * tier / 6), point(front.length + depth, depth * tier / 6),
          point(front.length + depth, depth * (tier + 1) / 6), point(-depth, depth * (tier + 1) / 6)];
        const pieces = polygonClipping.intersection([closed], [[[...rectangle, rectangle[0]]]]);
        for (const polygon of pieces) prism(B, structure, polygon, baseY, baseY + (roofY - baseY) * .55 * (tier + 1) / 6, M.trim);
      }
    }
    for (let level = 1; level < floors && !open; level++) {
      prism(B, structure, rings, baseY + level * storey - .12, baseY + level * storey, M.trim);
    }
    for (const [ringIndex, edges] of edgeSets[polygonIndex].entries()) for (const edge of edges) {
      const {a, tangent: t, normal: n, length: L, yaw} = edge;
      const p = (x, y, depth = 0) => [a[0] + t[0] * x + n[0] * depth, y, a[1] + t[1] * x + n[1] * depth];
      const face = (g, mat, x0, x1, y0, y1, depth = 0, normal = [n[0], 0, n[1]]) => {
        if (x1 - x0 > .0001 && y1 - y0 > .0001) panels.quad(g, mat,
          [p(x0, y0, depth), p(x1, y0, depth), p(x1, y1, depth), p(x0, y1, depth)], normal);
      };
      const box = (g, mat, x, y, depth, width, height, thickness) => B.box(g, '',
        ...[p(x, y, depth)[0], y, p(x, y, depth)[2]], width, height, thickness, mat, yaw);
      if (open) {
        const count = Math.max(1, Math.floor(L / 5));
        for (let i = 0; i < count; i++) box(structure, M.trim, (i + .5) * L / count, (baseY + roofY) / 2, -.25,
          .25, roofY - baseY, .25);
        box(roof, M.trim, L / 2, roofY - .12, -.12, L, .24, .24);
        continue;
      }
      const style = profile?.windows, pitchTarget = ['vertical', 'slit'].includes(style) ? 3
        : ['ribbon', 'sunshade', 'curtain'].includes(style) ? 5 : spec.family === 'residential' ? 3.6
          : spec.family === 'commercial' ? 4.6 : 4;
      const bays = L < 2.8 ? 0 : Math.max(1, Math.floor(L / pitchTarget));
      totalBays += bays;
      if (!bays) {
        face(structure, wall, 0, L, baseY, roofY);
        face(structure, wall, 0, L, baseY, roofY, -.24, [-n[0], 0, -n[1]]);
      } else {
        const sill = ['vertical', 'slit'].includes(style) ? .18 : Math.min(.88, storey * .28);
        const head = storey - (['vertical', 'slit'].includes(style) ? .16 : Math.min(.48, storey * .16));
        for (let level = 0; level < floors; level++) {
          const band = profile?.glazedBandLevel === level, levelBays = band ? 1 : bays;
          const pitch = L / levelBays, width = band ? L - .55 : profile ? Math.min(pitch - .55,
            pitch * (style === 'vertical' || style === 'slit' ? .43
              : ['ribbon', 'sunshade', 'curtain'].includes(style) ? .83 : .57))
            : Math.min(pitch - .65, spec.family === 'commercial' ? 3.1 : 2.1);
          const entranceBay = edge === entranceEdge ? Math.floor(levelBays / 2) : -1;
          const floor = baseY + level * storey, mat = level === 0 && !profile ? M.plinth : wall;
          const solid = (left, right, low, high) => {
            face(structure, mat, left, right, low, high);
            face(structure, mat, left, right, low, high, -.24, [-n[0], 0, -n[1]]);
          };
          if (level === 0 && entranceBay >= 0) {
            const center = (entranceBay + .5) * pitch;
            solid(0, center - width / 2, floor, floor + sill);
            solid(center + width / 2, L, floor, floor + sill);
          } else solid(0, L, floor, floor + sill);
          solid(0, L, floor + head, floor + storey);
          for (let pier = 0; pier <= levelBays; pier++) {
            const x0 = pier === 0 ? 0 : (pier - .5) * pitch + width / 2;
            const x1 = pier === levelBays ? L : (pier + .5) * pitch - width / 2;
            solid(x0, x1, floor + sill, floor + head);
          }
          face(windows, M.frame, 0, L, floor + head - .065, floor + head, -.05);
          if (level === 0 && entranceBay >= 0 && ringIndex === 0) {
            const center = (entranceBay + .5) * pitch;
            face(windows, M.frame, 0, center - width / 2, floor + sill, floor + sill + .065, -.05);
            face(windows, M.frame, center + width / 2, L, floor + sill, floor + sill + .065, -.05);
          } else face(windows, M.frame, 0, L, floor + sill, floor + sill + .065, -.05);
          for (let bay = 0; bay < levelBays; bay++) {
            const x = (bay + .5) * pitch, x0 = x - width / 2, x1 = x + width / 2;
            const door = level === 0 && bay === entranceBay && ringIndex === 0;
            const y0 = floor + (door ? 0 : sill), y1 = floor + head;
            face(windows, M.glass, x0, x1, y0, y1, -.20);
            if (profile) {
              const points = [p(x0, y0, .015), p(x1, y0, .015), p(x1, y1, .015), p(x0, y1, .015)];
              const normal = new THREE.Vector3(...points[1]).sub(new THREE.Vector3(...points[0]))
                .cross(new THREE.Vector3(...points[2]).sub(new THREE.Vector3(...points[0])));
              if (normal.dot(new THREE.Vector3(n[0], 0, n[1])) < 0) points.reverse();
              farWindow(points);
            }
            for (const [y, sign] of [[y0, 1], [y1, -1]]) panels.quad(windows, mat,
              [p(x0, y), p(x1, y), p(x1, y, -.24), p(x0, y, -.24)], [0, sign, 0]);
            for (const [xEdge, sign] of [[x0, 1], [x1, -1]]) panels.quad(windows, mat,
              [p(xEdge, y0), p(xEdge, y1), p(xEdge, y1, -.24), p(xEdge, y0, -.24)], [t[0] * sign, 0, t[1] * sign]);
            for (const [left, right, low, high] of [
              [x0, x0 + .065, y0, y1], [x1 - .065, x1, y0, y1],
              [x - .025, x + .025, y0, y1],
            ]) face(windows, M.frame, left, right, low, high, -.05);
            if (door) face(windows, M.frame, x0, x1, y0, y0 + .065, -.05);
            if (style === 'lattice') for (const fraction of [.33, .67]) {
              const y = y0 + (y1 - y0) * fraction;
              face(windows, M.frame, x0, x1, y - .025, y + .025, -.04);
            }
            if (style === 'sunshade' && !door) {
              box(windows, M.frame, x, y1 + .08, .23, width + .2, .065, .55);
            }
            if (!door) {
              const a = p(x0 - .05, y0 - .005, -.20), b = p(x1 + .05, y0 - .005, -.20);
              const c = p(x1 + .05, y0 - .005, .14), d = p(x0 - .05, y0 - .005, .14);
              const e = p(x0 - .05, y0 - .075, .14), f = p(x1 + .05, y0 - .075, .14);
              panels.quad(windows, M.trim, [a, b, c, d], [0, 1, 0]);
              panels.quad(windows, M.trim, [d, c, f, e], [n[0], 0, n[1]]);
              panels.quad(windows, M.trim, [a, e, f, b], [0, -1, 0]);
              panels.quad(windows, M.trim, [a, d, e], [-t[0], 0, -t[1]]);
              panels.quad(windows, M.trim, [b, f, c], [t[0], 0, t[1]]);
            }
            const probe = {outside: p(x + width * .23, (y0 + y1) / 2, 1),
              normal: [n[0], 0, n[1]], center: p(x + width * .23, (y0 + y1) / 2, -.20)};
            if (door) {
              entrancePoint = p(x, baseY + .3);
              doorProbes.push({...probe, outside: p(x + width * .23, baseY + .35, 1)});
              box(roof, M.trim, x, baseY + head + .18, .35, width + .7, .14, 1.1);
            } else windowsProbes.push(probe);
            if (!door && level === Math.max(0, floors - 2)) {
              const facing = n[0] * sampleDirection[0] + n[1] * sampleDirection[1];
              const score = (ringIndex === 0 ? 1000000 : 0) + facing * 10000
                + probe.center[0] * sampleDirection[0] + probe.center[2] * sampleDirection[1]
                - Math.abs(bay - (levelBays - 1) / 2) * .01;
              if (facing > .7 && score > sampleScore) {
                sampleScore = score;
                sample = {glazing: probe.center, masonry: p(x1 + (pitch - width) / 4, (y0 + y1) / 2)};
              }
            }
          }
        }
      }
      const copingTop = profile?.roofRise || profile?.roofFeatureRise ? roofY + .12 : top;
      box(roof, M.trim, L / 2, (roofY + copingTop) / 2, -.08, L, copingTop - roofY, .16);
      if (spec.family === 'academic' || spec.family === 'commercial') {
        for (let level = 1; level < floors; level++) box(structure, M.trim, L / 2, baseY + level * storey, -.015, L, .14, .15);
      }
    }
    const shape = new THREE.Shape(rings[0].map(([x, z]) => new THREE.Vector2(x, -z)));
    for (const ring of rings.slice(1)) shape.holes.push(new THREE.Path(ring.map(([x, z]) => new THREE.Vector2(x, -z))));
    const geometry = new THREE.ExtrudeGeometry(shape, {depth: open ? .14 : top - bottom, bevelEnabled: false, curveSegments: 1});
    geometry.rotateX(-Math.PI / 2); geometry.translate(0, open ? roofY - .14 : bottom, 0);
    const colors = new Float32Array(geometry.attributes.position.count * 3);
    const roofColor = M.roof.color.toArray(), wallColor = (open ? M.trim : wall).color.toArray();
    for (const group of geometry.groups) for (let i = group.start; i < group.start + group.count; i++) {
      colors.set(group.materialIndex === 0 ? roofColor : profile || open ? wallColor : [1, 1, 1], i * 3);
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const mesh = new THREE.Mesh(geometry, [M.farTint, open || profile ? M.farTint : M.farWall]);
    mesh.name = 'Far same-outline approximation'; mesh.castShadow = true; mesh.receiveShadow = false;
    if (!open && !profile) {
      const uv = createEstimatedFacadeUV(B, geometry, M.farWall);
      if (!uv) throw new Error('Far facade requires meter-scale UVs.');
    }
    far.add(mesh);
  }
  if (profile) {
    if (profile.entry !== 'plain') {
      const entrance = group('Photo-supported projecting entrance; dimensions and orientation estimated');
      entrance.userData.photoAppearanceEntrance = true;
      photoEntrance(B, entrance, entranceEdge, entrancePoint, spec, M, roof);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(farWindowPositions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(farWindowColors, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(farWindowPositions.length / 3 * 2), 2));
    geometry.computeVertexNormals(); geometry.addGroup(0, farWindowPositions.length / 3, 0);
    const mesh = new THREE.Mesh(geometry, [M.farTint]);
    mesh.name = 'Display-only photo palette window patches'; mesh.receiveShadow = false;
    far.add(mesh);
  }
  panels.finish(); B.finish();
  roof.traverse(object => {if (object.isMesh) object.receiveShadow = false;});
  const box = new THREE.Box3().setFromObject(near), sphere = box.getBoundingSphere(new THREE.Sphere());
  detail.userData = {
    architectureLOD: true, family: spec.family, estimatedFloors: floors, floorsSource: spec.floorsSource,
    footprintArea: metrics.area, polygonCount: polygons.length, holeCount: polygons.reduce((sum, rings) => sum + rings.length - 1, 0),
    windowCount: windowsProbes.length, doorwayCount: doorProbes.length,
    windowProbes: windowsProbes, doorProbes, facadeSample: sample || null,
    nearDistance: Math.max(180, sphere.radius * 5),
    localSphere: {center: sphere.center.toArray(), radius: sphere.radius},
    sourceEvidence: spec.source, limitations: profile ? appearanceLimitations(profile) : ARCHITECTURE_LIMITS,
    appearanceProfile: profile, appearanceLimitations: profile ? appearanceLimitations(profile) : null,
    viewDirection: profile?.inspectionDirection || (entranceEdge
      ? [entranceEdge.normal[0] * 1.1, open ? .28 : .45, entranceEdge.normal[1] * 1.1] : [.3, .5, 1.1]),
    entrancePoint: entrancePoint || null, totalBays,
  };
  return detail;
}

function createEstimatedFacadeUV(B, geometry, material) {
  B.textureWorld.set(material, [3.6, 3.2]); B.worldUV(geometry, material);
  return geometry.getAttribute('uv');
}

function buildFarBatches(campus, ids) {
  const groups = new Map(), instances = new Map(ids.map(id => [id, []]));
  for (const id of ids) {
    const root = campus.buildings.get(id), detail = root.children.find(child => child.userData.architectureLOD);
    const far = detail.children.find(child => child.userData.architectureFar);
    root.updateMatrix();
    for (const mesh of far.children) {
      mesh.visible = false;
      if (mesh.geometry.index) throw new Error('Far batching requires nonindexed envelope geometry.');
      for (const group of mesh.geometry.groups) {
        const material = mesh.material[group.materialIndex];
        if (!groups.has(material)) groups.set(material, []);
        groups.get(material).push({id, root, geometry: mesh.geometry, start: group.start, count: group.count});
      }
    }
  }
  const batches = [];
  for (const [material, entries] of groups) {
    const mesh = new THREE.BatchedMesh(entries.length, entries.reduce((sum, entry) => sum + entry.count, 0), 0, material);
    mesh.name = 'Display-only far architecture batch'; mesh.castShadow = true; mesh.receiveShadow = false;
    mesh.sortObjects = false;
    mesh.userData = {architectureFarBatch: true, featureIds: []};
    const batch = {mesh, visibleCount: 0};
    for (const entry of entries) {
      const geometry = new THREE.BufferGeometry();
      for (const [key, attribute] of Object.entries(entry.geometry.attributes)) {
        geometry.setAttribute(key, new THREE.BufferAttribute(attribute.array.slice(entry.start * attribute.itemSize,
          (entry.start + entry.count) * attribute.itemSize), attribute.itemSize, attribute.normalized));
      }
      const instance = mesh.addInstance(mesh.addGeometry(geometry)); geometry.dispose();
      mesh.setMatrixAt(instance, entry.root.matrix);
      mesh.setVisibleAt(instance, false);
      mesh.userData.featureIds[instance] = entry.id;
      instances.get(entry.id).push({batch, instance});
    }
    campus.layers.building.add(mesh); batches.push(batch);
  }
  return {batches, instances};
}

export function applyCampusArchitecture(campus, data) {
  const features = data.features.filter(feature => feature.properties.kind === 'building');
  if (features.length !== campus.buildings.size) throw new Error('Architecture must account for every frozen map root.');
  for (const feature of features) {
    appearanceProfile(feature);
    const record = byId.get(feature.id);
    if (!record || record.footprintSignature !== architectureSignature(feature, data.metadata.center)) {
      throw new Error(`Architecture frozen footprint/evidence changed: ${feature.id}`);
    }
    const root = campus.buildings.get(feature.id), origin = footprintMetrics(feature.geometry, data.metadata.center).origin;
    if (!root || root.userData.featureId !== feature.id || root.position.y !== 0 ||
        Math.abs(root.position.x - origin[0]) > 1e-6 || Math.abs(root.position.z - origin[1]) > 1e-6) {
      throw new Error(`Architecture identity or placement mismatch: ${feature.id}`);
    }
  }
  let state = states.get(campus);
  if (!state) {
    state = {palette: createArchitectureResources(), originals: new Map(), originalLevelOfDetail: campus.group.userData.levelOfDetail};
    states.set(campus, state);
  }
  const ids = [];
  for (const feature of features) {
    const root = campus.buildings.get(feature.id);
    if (!root || root.userData.featureId !== feature.id) throw new Error(`Architecture identity mismatch: ${feature.id}`);
    if (root.userData.refinementStatus === 'detailed') continue;
    if (!['base', 'procedural'].includes(root.userData.refinementStatus)) throw new Error(`Unknown architecture stage: ${feature.id}`);
    const detail = createArchitectureDetail(feature, data.metadata.center, [root.position.x, root.position.z], state.palette);
    const previous = root.children.find(child => child.userData.campusDetail);
    if (!state.originals.has(feature.id)) state.originals.set(feature.id, {...root.userData});
    const spec = architectureSpec(feature);
    replaceBuilding(campus.buildings, feature.id, detail);
    if (previous) disposeOwnedDetail(previous);
    Object.assign(root.userData, {
      refinementStatus: 'procedural', referenceBasis: 'map-architecture-procedural-estimate',
      reconstructionLevel: 'procedural-architecture-not-photo-verified', reconstructionExtent: 'whole-footprint-estimate',
      refinementSummary: ARCHITECTURE_LIMITS, architectureFamily: spec.family,
      architectureSource: spec.source, estimatedFloors: spec.floors, floorsSource: spec.floorsSource,
      baseRenderHeight: feature.properties.renderHeight, renderHeight: spec.top, heightSource: spec.heightSource,
      viewDirection: detail.userData.viewDirection,
      ...(spec.appearance ? {
        appearanceProfileId: spec.appearance.id, appearanceReferenceSite: spec.appearance.site,
        appearanceReferencePages: [...new Set(appearanceSource(spec.appearance).images.map(image => image.pageUrl))],
        appearanceBasis: 'photo-palette-and-visible-features-on-estimated-envelope',
        refinementSummary: appearanceLimitations(spec.appearance),
      } : {}),
    });
    ids.push(feature.id);
  }
  for (const batch of state.far?.batches || []) {batch.mesh.removeFromParent(); batch.mesh.dispose();}
  state.far = buildFarBatches(campus, ids);
  campus.group.userData.proceduralBuildingIds = ids;
  campus.group.userData.levelOfDetail = 'All frozen footprints have architectural geometry; photo-informed models and unverified procedural envelopes are separate stages, not a fidelity score.';
  campus.updateArchitectureLOD = (camera, details = true) => {
    if (typeof details !== 'boolean') throw new Error('Architecture detail visibility must be a boolean.');
    camera.updateWorldMatrix(true, false);
    const eye = camera.getWorldPosition(new THREE.Vector3());
    for (const batch of state.far.batches) batch.visibleCount = 0;
    for (const id of ids) {
      const root = campus.buildings.get(id), detail = root.children.find(child => child.userData.architectureLOD);
      if (!detail) continue;
      const center = new THREE.Vector3(...detail.userData.localSphere.center).add(root.position);
      const near = details && eye.distanceTo(center) - detail.userData.localSphere.radius < detail.userData.nearDistance;
      detail.children.find(child => child.userData.architectureNear).visible = near;
      detail.children.find(child => child.userData.architectureFar).visible = !near;
      for (const {batch, instance} of state.far.instances.get(id)) {
        const visible = !near && root.visible;
        batch.mesh.setVisibleAt(instance, visible);
        if (visible) batch.visibleCount++;
      }
    }
    for (const batch of state.far.batches) batch.mesh.visible = batch.visibleCount > 0;
  };
  return ids;
}

export function prepareArchitectureExport(object) {
  const batches = [];
  object.traverse(detail => {
    if (detail.userData.architectureFarBatch) batches.push(detail);
    if (!detail.userData.architectureLOD) return;
    detail.children.find(child => child.userData.architectureNear).visible = true;
    detail.children.find(child => child.userData.architectureFar).visible = false;
  });
  for (const batch of batches) {batch.removeFromParent(); batch.dispose();}
  return object;
}

export function disposeCampusArchitecture(campus) {
  const state = states.get(campus);
  if (!state) return;
  for (const [id, original] of state.originals) {
    const root = campus.buildings.get(id);
    if (root.userData.refinementStatus !== 'procedural') continue;
    const detail = root.children.find(child => child.userData.architectureLOD);
    root.remove(detail); disposeOwnedDetail(detail);
    root.userData = original; root.getObjectByName('base').visible = true;
  }
  for (const batch of state.far?.batches || []) {batch.mesh.removeFromParent(); batch.mesh.dispose();}
  state.palette.dispose(); states.delete(campus);
  delete campus.group.userData.proceduralBuildingIds;
  campus.group.userData.levelOfDetail = state.originalLevelOfDetail;
  delete campus.updateArchitectureLOD;
}
