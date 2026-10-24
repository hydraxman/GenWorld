import * as THREE from 'three';
import context from '../../shunde/docs/campus-context.json' with {type: 'json'};
import {createSEMBuilding, SEM_WAY} from '../../shunde/src/sem-building.js';
import {replaceBuilding} from './model.js';
import {shundePlacement} from './shunde-refinement.js';

export const SEM_ID = 'building:geometry:62d3ed181227f777a3fc0e1f';
const SOURCE = context.buildings.find(building => building.id === SEM_WAY);

export function refineSEM(campus, data, {textured = true} = {}) {
  const feature = data.features.find(item => item.id === SEM_ID);
  const target = campus.buildings.get(SEM_ID);
  if (!SOURCE || !target || feature?.properties.nameSourceFeatureId !== `osm:way:${SEM_WAY}`) {
    throw new Error('Red SEM footprint changed; re-match OSM way 937482182 before restoring its refinement.');
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
    ],
    meshStats: built.stats,
    limitations: 'Source-plan outer footprint; podium division, hidden elevations and corridor endpoints are interpreted. Corridor follows user description, not surveyed geometry or the officially named Jianhua-Lihua knowledge bridge.',
    textures: textured ? 'Locally generated cladding roughness and joints; no reference-photo textures.' : 'Plain materials.',
  };
  replaceBuilding(campus.buildings, SEM_ID, detail);
  target.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(detail);
  target.userData = {
    ...target.userData,
    baseRenderHeight: target.userData.baseRenderHeight ?? target.userData.renderHeight,
    renderHeight: Number(box.max.y.toFixed(2)),
    name: '新经管楼 · 建华／李华组团',
    aliases: ['经管楼', '砖红楼', '红楼', '建华楼', '李华楼'],
    heightSource: '官方组团总高30米；红色低区与隐藏立面为照片比例推定',
    refinementSummary: '砖红陶板、真实拱窗、凹进玻璃及上部玻璃体量。灰色空中连廊接向舜德楼，下缘约13.2米（四层尺度）；构造与端点为示意。',
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
