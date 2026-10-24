import * as THREE from 'three';
import anchor from '../data/second-gate-anchor.json' with {type: 'json'};
import {project} from './geo.js';
import {createSecondGateModel, SECOND_GATE_ID, SECOND_GATE_ANCHOR} from './second-gate.js';

export const LANDMARK_SITES = [{
  featureId: SECOND_GATE_ID, buttonId: 'view-second-gate', label: '二校门',
  viewDirection: [-0.45, -0.18, 1.1],
}];

export function applyCampusLandmarks(campus, data) {
  if (anchor.id !== SECOND_GATE_ID || anchor.coordinates.some((value, i) => value !== SECOND_GATE_ANCHOR[i])) {
    throw new Error('Second Gate geometry and verified geographic anchor disagree.');
  }
  if (campus.buildings.has(anchor.id)) throw new Error('A point landmark cannot replace a map building.');
  const detail = createSecondGateModel();
  if (!detail?.isObject3D || detail.parent || !detail.userData.refinementSummary || !detail.userData.referenceSite) {
    throw new Error('Second Gate needs unattached geometry and its own reconstruction sources.');
  }
  detail.traverse(object => {
    if (object.userData.featureId) throw new Error('Only the landmark root may own its addressable identity.');
  });
  const box = new THREE.Box3().setFromObject(detail);
  if (box.isEmpty() || ![...box.min.toArray(), ...box.max.toArray()].every(Number.isFinite)) {
    throw new Error('Second Gate geometry has invalid bounds.');
  }
  const origin = project(anchor.coordinates, data.metadata.center);
  const target = new THREE.Group();
  target.name = anchor.name;
  target.position.set(origin[0], 0, origin[1]);
  target.userData = {
    ...detail.userData, featureId: anchor.id, kind: 'landmark', name: anchor.name,
    aliases: ['二校門', '清华园', '清華園', 'The Old Gate', 'Second Gate'],
    exportFilename: 'tsinghua-second-gate.glb',
    localOriginMeters: origin, centerWGS84: anchor.coordinates,
    localAxes: 'X east, Y up, Z south', mapSource: anchor,
    footprintArea: null, renderHeight: box.max.y, minHeight: Math.abs(box.min.y) < 1e-6 ? 0 : box.min.y,
    heightSource: detail.userData.heightSource || '照片比例推定，非测量高度',
    refinementStatus: 'detailed', reconstructionLevel: 'photo-informed-estimate-not-surveyed',
    positionLimitations: anchor.positionLimitations,
    orientationSource: 'Official description: viewed from Tsinghua Road looking north; east-west span is estimated.',
  };
  target.add(detail);
  const previous = campus.landmarks.get(anchor.id);
  if (previous) campus.layers.landmark.remove(previous);
  campus.layers.landmark.add(target);
  campus.landmarks.set(anchor.id, target);
  campus.objects.set(anchor.id, target);
  campus.group.userData.landmarkIds = [anchor.id];
  target.updateMatrixWorld(true);
  return [anchor.id];
}
