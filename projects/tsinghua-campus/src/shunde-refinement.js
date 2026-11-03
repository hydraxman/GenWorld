import * as THREE from 'three';
import source from '../../shunde/docs/courtyard/source-footprint.json' with {type: 'json'};
import {createShundeModel} from '../../shunde/src/model.js';
import {project} from './geo.js';
import {disposeOwnedDetail, replaceBuilding} from './model.js';

export function shundePlacement(center, localOrigin) {
  const from = source.geometry_enu_m.coordinates[0].slice(0, -1).map(([e, n]) => [e, -n]);
  const to = source.geometry_wgs84.coordinates[0].slice(0, -1).map(point => project(point, center));
  const a = from[0];
  let j = 1, k = 2;
  for (let i = 1; i < from.length; i++) {
    if (Math.hypot(...from[i].map((v, axis) => v - a[axis])) >
        Math.hypot(...from[j].map((v, axis) => v - a[axis]))) j = i;
  }
  const cross = i => Math.abs((from[j][0] - a[0]) * (from[i][1] - a[1]) -
    (from[j][1] - a[1]) * (from[i][0] - a[0]));
  for (let i = 1; i < from.length; i++) if (cross(i) > cross(k)) k = i;
  const basis = new THREE.Matrix3().set(...a, 1, ...from[j], 1, ...from[k], 1);
  if (Math.abs(basis.determinant()) < 1) throw new Error('Shunde source anchors are degenerate.');
  basis.invert();
  const x = new THREE.Vector3(to[0][0], to[j][0], to[k][0]).applyMatrix3(basis);
  const z = new THREE.Vector3(to[0][1], to[j][1], to[k][1]).applyMatrix3(basis);
  const errors = from.map(([px, pz], i) =>
    Math.hypot(x.x * px + x.y * pz + x.z - to[i][0], z.x * px + z.y * pz + z.z - to[i][1]));
  if (Math.max(...errors) > 0.1) throw new Error('Source-to-campus placement error exceeds 10 cm.');
  return new THREE.Matrix4().set(
    x.x, 0, x.y, x.z - localOrigin[0],
    0, 1, 0, 0,
    z.x, 0, z.y, z.z - localOrigin[1],
    0, 0, 0, 1,
  );
}

export function refineShunde(campus, data, featureId, {textured = typeof document !== 'undefined'} = {}) {
  const target = campus.buildings.get(featureId);
  if (!target) throw new Error(`Matched Shunde footprint is missing: ${featureId}`);
  const built = createShundeModel(THREE, {textured, foliage: false, refinedFront: true, visitorLabels: typeof document !== 'undefined'});
  built.group.remove(built.building);
  disposeOwnedDetail(built.group, {preserve: built.building});
  const detail = new THREE.Group();
  detail.name = 'Shunde - original architecture and procedural PBR surfaces';
  detail.add(built.building);
  detail.matrix.copy(shundePlacement(data.metadata.center, target.userData.localOriginMeters));
  detail.matrixAutoUpdate = false;
  detail.userData = {
    source: 'projects/shunde; existing photo-informed reconstruction, not newly surveyed',
    sourceFootprint: 'OSM way 84653293, combined Weilun + Shunde',
    reusedSource: 'projects/shunde/src/model.js',
    textures: textured ? 'Original Shunde ceramic, marble and stone color/normal/roughness maps; no photo textures.'
      : 'Untextured source geometry for non-browser validation.',
    limitations: 'Exact wing partition, hidden elevations and heights remain estimated. Original architecture retained with the existing refined entry and visitor lobby. Standalone terrain and high-density foliage excluded; campus landscaping is shared. Sign typeface is an approximation, not extracted photograph lettering.',
  };
  const previous = target.children.find(child => child.userData.campusDetail);
  replaceBuilding(campus.buildings, featureId, detail);
  if (previous) disposeOwnedDetail(previous);
  target.userData.baseRenderHeight = target.userData.baseRenderHeight ?? target.userData.renderHeight;
  target.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(detail);
  target.userData.renderHeight = Number(box.max.y.toFixed(2));
  target.userData.heightSource = '既有照片参照模型的估算高度，非测绘';
  target.userData.name = '舜德楼 / 伟伦—舜德组合院落';
  target.userData.refinementSource = detail.userData.source;
  target.userData.referenceSite = 'shunde-building';
  target.userData.referencePages = [
    'https://vr.tsinghua.edu.cn/jsdl1/1133.jhtml',
    'https://www.ie.tsinghua.edu.cn/lxwm.htm',
  ];
  target.userData.refinementSummary = '直接复用原舜德模型的完整建筑、瓷砖网格、灰粉窗下板、深褐石材及颜色／法线／粗糙度纹理，保留已修好的入口与示意门厅。原尺度和伟伦—舜德合并轮廓不变；不搬入独立演示的巨大地面及高密度树叶。隐藏立面、楼高及伟伦分界仍有推定，楼牌字体为近似，非测绘复原。';
  target.userData.reconstructionBatch = 1;
  target.name = target.userData.name;
  return target;
}
