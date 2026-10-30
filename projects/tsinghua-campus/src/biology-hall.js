import * as THREE from 'three';
import {createCourtyardReuse} from './courtyard-reuse.js';
import {footprintMetrics, lines, project} from './geo.js';
import {outlineEdges} from './architecture.js';
import {architectureSignature} from './architecture-contract.js';
import {disposeOwnedDetail, replaceBuilding} from './model.js';
import evidence from '../data/biology-hall-sources.json' with {type: 'json'};
import {refineBiologyNorth} from './biology-north.js';

export const BIOLOGY_HALL_ID = evidence.featureId;
export const BIOLOGY_HALL_SOURCE = evidence;

function verify(feature, center, origin) {
  if (!feature || feature.properties.name !== evidence.name || feature.properties.nameRole !== 'building-name' ||
      feature.properties.nameSourceFeatureId !== evidence.sourceId ||
      feature.properties.minHeight !== 0 || feature.properties.renderHeight !== 11 ||
      center.some((v, i) => v !== evidence.center[i]) || architectureSignature(feature, center) !== evidence.signature) {
    throw new Error('Old biology hall identity/footprint changed; do not replace the new life-sciences building.');
  }
  const metrics = footprintMetrics(feature.geometry, center);
  if (!origin?.every((v, i) => Math.abs(v - metrics.origin[i]) < 1e-6)) throw new Error('Old biology hall origin changed.');
  return metrics;
}

export function refineBiologyHall(campus, data) {
  const feature = data.features.find(f => f.id === BIOLOGY_HALL_ID), root = campus.buildings.get(BIOLOGY_HALL_ID);
  const metrics = verify(feature, data.metadata.center, root?.userData.localOriginMeters);
  const ring = metrics.projected[0][0].slice(0, -1).map(p => p.map((v, i) => v - metrics.origin[i]));
  const {tangent: t, normal: n} = outlineEdges(ring)[1];
  const center = ring[1].map((v, i) => (v + ring[6][i]) / 2);
  const local = p => {const dx = p[0] - center[0], dz = p[1] - center[1]; return [dx * t[0] + dz * t[1], dx * n[0] + dz * n[1]];};
  const plan = ring.map(local), zs = plan.map(p => p[1]);
  const reused = createCourtyardReuse({textured: typeof document !== 'undefined'}), source = reused.group;
  source.name = 'Original Courtyard geometry: garden-facing hall, dry basins and pergolas';
  source.position.z = (Math.min(...zs) + Math.max(...zs)) / 2
    - reused.architectureBounds.getCenter(new THREE.Vector3()).z;
  Object.assign(source.userData, {
    placementStatus: 'old-biology-hall-source-root-bound',
    sourceFrontWorld: [n[0], 0, n[1]],
    role: 'direct-original-courtyard-model',
    geometryPolicy: 'Original south facade, wings, roof and courtyard at unit scale. Only north-facing wall/joinery triangles replaced by the photographed entrance.',
  });
  const forecourt = source.children.filter(child => child.userData.role === 'legacy-library-forecourt');
  source.updateMatrixWorld(true);
  const courtBounds = new THREE.Box3();
  for (const child of forecourt) courtBounds.union(new THREE.Box3().setFromObject(child));
  const halfCourt = Math.max(Math.abs(courtBounds.min.x), Math.abs(courtBounds.max.x));
  let shoreline = Infinity;
  for (const water of data.features.filter(f => f.properties.kind === 'water')) {
    const linear = water.geometry.type === 'LineString' || water.geometry.type === 'MultiLineString';
    const rings = linear ? lines(water.geometry).map(line => line.map(p => project(p, data.metadata.center)))
      : footprintMetrics(water.geometry, data.metadata.center).projected.flat();
    for (const ring of rings) {
      const points = ring.map(p => local(p.map((v, i) => v - metrics.origin[i])));
      for (let i = 1; i < points.length; i++) {
        const [a, b] = [points[i - 1], points[i]];
        if (Math.max(a[0], b[0]) < -halfCourt || Math.min(a[0], b[0]) > halfCourt) continue;
        const span = b[0] - a[0], ts = span ? [-halfCourt, halfCourt].map(x => (x - a[0]) / span) : [];
        for (const t of [0, 1, ...ts].filter(t => t >= 0 && t <= 1)) {
          const x = a[0] + span * t, z = a[1] + (b[1] - a[1]) * t;
          if (Math.abs(x) <= halfCourt + 1e-6 && z > 8) shoreline = Math.min(shoreline, z - (linear ? 1.5 : 0));
        }
      }
    }
  }
  if (!Number.isFinite(shoreline) || courtBounds.max.z > shoreline - 3) {
    disposeOwnedDetail(source);
    throw new Error('The original Courtyard no longer fits landward of the mapped shoreline; review placement rather than deforming the source.');
  }
  const detail = new THREE.Group(); detail.name = '生物学馆 · Courtyard原模型直接放置';
  detail.position.set(center[0], 0, center[1]); detail.rotation.y = -Math.atan2(t[1], t[0]);
  const north = refineBiologyNorth(source);
  detail.add(source);
  const modelHeight = Math.max(reused.architectureBounds.max.y, north.userData.dimensions.top);
  const focusBounds = new THREE.Box3().setFromObject(detail);
  detail.userData = {referenceSite: 'biology-hall', evidence, reusedSource: evidence.originalModel,
    sourceStats: reused.stats, placement: {scaleX: 1, scaleY: 1, scaleZ: 1, shoreline, shorelineSetback: 3,
      sourceOffsetZ: source.position.z, southTangent: t, southNormal: n},
    modelHeight, noPhotoTextures: true, directOriginalGeometry: true, northFacadeRefined: true,
    limitations: evidence.limitations, entranceOrientationBasis: evidence.orientation};
  const previous = root.children.find(child => child.userData.campusDetail);
  const target = replaceBuilding(campus.buildings, BIOLOGY_HALL_ID, detail);
  if (previous) disposeOwnedDetail(previous);
  Object.assign(target.userData, {referenceSite: 'biology-hall', referencePages: [
    ...evidence.documents.map(document => document.url),
    'https://commons.wikimedia.org/wiki/File:3_Tsinghua.jpg',
  ],
    focusBoundsLocal: {min: focusBounds.min.toArray(), max: focusBounds.max.toArray()},
    refinementSummary: '老生物学馆（非伟伦生命科学馆）：直接使用Courtyard原有建筑、窗框、屋顶、三段干石池和双廊架，'
      + '主体未拉伸、未补写两翼；仅北面替换旧背墙窗列，按照片加入石质门厅、深门洞、台阶、分层长窗及阶梯式女儿墙。'
      + evidence.limitations.join(' '),
    renderHeight: modelHeight, heightSource: 'Courtyard主体原尺寸；北门细节适配其高度，非照片测绘；原地图顶部11m保留于来源。',
    viewDirection: [n[0] * 1.1 + t[0] * .18, .5, n[1] * 1.1 + t[1] * .18]});
  return target;
}
