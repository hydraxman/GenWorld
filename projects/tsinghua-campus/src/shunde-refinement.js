import * as THREE from 'three';
import source from '../../shunde/docs/courtyard/source-footprint.json' with {type: 'json'};
import {createShundeModel} from '../../shunde/src/model.js';
import {project} from './geo.js';
import {replaceBuilding} from './model.js';

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

export function refineShunde(campus, data, featureId) {
  const target = campus.buildings.get(featureId);
  if (!target) throw new Error(`Matched Shunde footprint is missing: ${featureId}`);
  const built = createShundeModel(THREE, {textured: false, foliage: false, refinedFront: true});
  built.group.remove(built.building);
  const detail = new THREE.Group();
  detail.name = 'Shunde pilot - existing photo-informed architecture, plain materials';
  detail.add(built.building);
  detail.matrix.copy(shundePlacement(data.metadata.center, target.userData.localOriginMeters));
  detail.matrixAutoUpdate = false;
  detail.userData = {
    source: 'projects/shunde; existing photo-informed reconstruction, not newly surveyed',
    sourceFootprint: 'OSM way 84653293, combined Weilun + Shunde',
    limitations: 'Exact wing partition, hidden elevations and heights remain estimated. Plain materials; no reference photographs used as textures.',
  };
  replaceBuilding(campus.buildings, featureId, detail);
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
  target.userData.refinementSummary = '既有舜德照片参照模型，保留伟伦—舜德合并院落轮廓。隐藏立面、楼高及伟伦分界仍有推定，非测绘复原。';
  target.userData.reconstructionBatch = 1;
  target.name = target.userData.name;
  return target;
}
