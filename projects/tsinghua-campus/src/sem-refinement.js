import * as THREE from 'three';
import context from '../../shunde/docs/campus-context.json' with {type: 'json'};
import {createSEMBuilding, SEM_WAY} from '../../shunde/src/sem-building.js';
import {disposeOwnedDetail, replaceBuilding} from './model.js';
import {shundePlacement} from './shunde-refinement.js';
import {architectureSignature} from './architecture-contract.js';
import {footprintMetrics} from './geo.js';

export const SEM_ID = 'building:geometry:62d3ed181227f777a3fc0e1f';
const SOURCE = context.buildings.find(building => building.id === SEM_WAY);

export function refineSEM(campus, data, {textured = true} = {}) {
  const feature = data.features.find(item => item.id === SEM_ID);
  const target = campus.buildings.get(SEM_ID);
  if (!SOURCE || !target || feature?.properties.nameSourceFeatureId !== `osm:way:${SEM_WAY}` ||
      feature.properties.name !== '清华大学经济管理学院' || feature.properties.nameRole !== 'building-name' ||
      architectureSignature(feature, data.metadata.center) !== '451:24ce92d1') {
    throw new Error('Red SEM footprint changed; re-match OSM way 937482182 before restoring its refinement.');
  }
  const origin = footprintMetrics(feature.geometry, data.metadata.center).origin;
  if (target.userData.localOriginMeters?.length !== 2 ||
      !target.userData.localOriginMeters.every((v, i) => Number.isFinite(v) && Math.abs(v - origin[i]) < 1e-6)) {
    throw new Error('Red SEM origin changed; re-match the frozen source before refinement.');
  }
  const built = createSEMBuilding(THREE, SOURCE, {textured});
  const detail = built.group;
  // Both existing buildings use the same Shunde-origin ENU frame; no visual repositioning.
  detail.matrix.copy(shundePlacement(data.metadata.center, target.userData.localOriginMeters));
  detail.matrixAutoUpdate = false;
  detail.userData = {
    ...detail.userData,
    referenceSite: 'sem-complex',
    referencePages: [
      'https://www.tuef.tsinghua.edu.cn/info/1072/2664.htm',
      'https://www.tsinghua.edu.cn/info/1181/37409.htm',
      'https://www.gensler.com/projects/tsinghua-university-school-of-economics-management',
      'https://qhbk.tsinghua.edu.cn/xqh/2024-09/06/content_99183263.html',
      'https://www.thepaper.cn/newsDetail_forward_28552771',
    ],
    meshStats: built.stats,
    limitations: 'Frozen outer footprint; north orientation and 17 m interior arch are documented. Arch width, north portal position along the edge, upper-wing setback, podium division, hidden elevations and corridor endpoints are interpreted. Corridor follows user description, not surveyed geometry or the officially named Jianhua-Lihua knowledge bridge.',
    textures: textured ? 'Locally generated cladding roughness and joints; no reference-photo textures.' : 'Plain materials.',
  };
  const previous = target.children.find(child => child.userData.campusDetail);
  replaceBuilding(campus.buildings, SEM_ID, detail);
  if (previous) disposeOwnedDetail(previous);
  target.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(detail);
  target.userData = {
    ...target.userData,
    baseRenderHeight: target.userData.baseRenderHeight ?? target.userData.renderHeight,
    renderHeight: Number(box.max.y.toFixed(2)),
    name: '新经管楼 · 建华／李华组团',
    aliases: ['经管楼', '砖红楼', '红楼', '建华楼', '李华楼'],
    heightSource: '官方组团总高30米；红色低区与隐藏立面为照片比例推定',
    refinementSummary: '建华楼北面通透玻璃门厅与后退的17米白色拱门、局部高拱窗、大板陶板实墙及薄檐玻璃翼；侧后窗位和体量分界推定。通舜德灰色连廊下缘约13.2米，非官方“知识之桥”的核实复原。',
    referenceSite: detail.userData.referenceSite,
    referencePages: detail.userData.referencePages,
    reconstructionBatch: 2,
    refinementSource: 'Reuse of projects/shunde SEM photo-informed model, placed in the campus coordinate frame.',
    corridor: {
      ...built.corridor.stats,
      startCampus: detail.localToWorld(new THREE.Vector3(
        built.corridor.group.userData.start[0], built.corridor.stats.clearance,
        built.corridor.group.userData.start[1],
      )).toArray(),
      endCampus: detail.localToWorld(new THREE.Vector3(
        built.corridor.group.userData.end[0], built.corridor.stats.clearance,
        built.corridor.group.userData.end[1],
      )).toArray(),
      belongsTo: SEM_ID,
    },
  };
  target.name = target.userData.name;
  return target;
}
