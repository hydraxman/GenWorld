import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import data from '../data/campus.json' with {type: 'json'};
import {footprintMetrics} from '../src/geo.js';
import {outlineEdges} from '../src/architecture.js';
import {architectureSpec, createArchitectureDetail, createArchitectureResources} from '../src/campus-architecture.js';
import {REFINEMENT_SITES} from '../src/refinements.js';
import {createZijingDetail} from '../src/zijing.js';
import {ZIJING_SOURCES} from '../src/zijing-sources.js';

const photoIds = new Set(REFINEMENT_SITES.map(site => site.featureId));
const features = data.features.filter(feature => feature.properties.kind === 'building' && !photoIds.has(feature.id));
function exteriorHits(group, edge, height) {
  const {a, tangent, normal, length} = edge;
  const origin = new THREE.Vector3(a[0] + tangent[0] * length * .317 + normal[0], height,
    a[1] + tangent[1] * length * .317 + normal[1]);
  return new THREE.Raycaster(origin, new THREE.Vector3(-normal[0], 0, -normal[1]), 0, 1.05)
    .intersectObject(group, true).filter(hit => Math.abs(hit.distance - 1) < .00005);
}

for (const family of ['academic', 'residential', 'neutral']) test(`${family} floor joints have one continuous exterior, not competing coplanar slab rims`, () => {
  const feature = features.find(feature => {
    const spec = architectureSpec(feature);
    return spec.family === family && !spec.appearance && spec.floors >= 3;
  });
  const metrics = footprintMetrics(feature.geometry, data.metadata.center), spec = architectureSpec(feature);
  const palette = createArchitectureResources();
  const detail = createArchitectureDetail(feature, data.metadata.center, metrics.origin, palette);
  const near = detail.children.find(child => child.userData.architectureNear);
  near.updateMatrixWorld(true);
  const ring = metrics.projected[0][0].slice(0, -1).map(point => point.map((v, i) => v - metrics.origin[i]));
  const edge = outlineEdges(ring).sort((a, b) => b.length - a.length)[0];
  const base = spec.bottom + .16, roof = spec.top - Math.min(.45, (spec.top - spec.bottom) * .1);
  for (let level = 1; level < spec.floors; level++) {
    const joint = base + level * (roof - base) / spec.floors;
    // Below the projecting trim, the floor rim used to occupy the wall plane.
    assert.equal(exteriorHits(near, edge, joint - .10).length, 1, `Overlapping or open exterior at floor ${level}`);
  }
  palette.dispose();
});

test('Zijing floor rims do not fight walls, and high-rise coping is supported by a closed parapet', () => {
  const source = ZIJING_SOURCES.find(source => source.numbers.includes(14));
  const feature = data.features.find(feature => feature.id === source.featureId);
  const metrics = footprintMetrics(feature.geometry, data.metadata.center);
  const detail = createZijingDetail(feature, data.metadata.center, metrics.origin);
  detail.updateMatrixWorld(true);
  for (const part of detail.children.filter(child => child.userData.apartmentNumber)) {
    const d = part.userData, edge = outlineEdges(d.footprintRingLocal).sort((a, b) => b.length - a.length)[0];
    const storey = (d.eaveHeight - .22) / d.estimatedFloors;
    for (let floor = 1; floor < d.estimatedFloors; floor++) {
      assert.equal(exteriorHits(part, edge, .22 + floor * storey - .10).length, 1);
    }
    assert.ok(exteriorHits(part, edge, d.eaveHeight + .60).length, 'Coping must not float above the roof');
  }
});
