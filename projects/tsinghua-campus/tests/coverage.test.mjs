import assert from 'node:assert/strict';
import test from 'node:test';
import {createCoverage} from '../src/coverage.js';

function fixture() {
  const features = [1, 2, 3].map(id => ({
    id: `building:${id}`, properties: {
      kind: 'building', name: id === 1 ? 'Main' : null, renderHeight: 5,
      heightSource: 'map display height', localOrigin: [116.32 + id * 0.001, 40],
    },
  }));
  const buildings = new Map(features.map(feature => [feature.id, {userData: {
    ...feature.properties, featureId: feature.id, refinementStatus: 'base',
  }}]));
  Object.assign(buildings.get('building:1').userData, {
    refinementStatus: 'detailed', referenceSite: 'main', renderHeight: 20,
    heightSource: 'photo estimate', refinementSummary: 'Hidden facades are estimated.',
  });
  const landmarks = new Map([['landmark:1', {userData: {
    featureId: 'landmark:1', name: 'Gate', referenceSite: 'gate', refinementSummary: 'Scale estimated.',
  }}]]);
  const sites = ['main', 'gate', 'dorms'].map(id => ({id, name: id, images: [{}], unknowns: ['unmeasured']}));
  return {campus: {buildings, landmarks}, data: {features, metadata: {name: 'Test scope'}}, catalog: {sites}};
}

test('coverage separates frozen footprints, estimated reconstructions and independent landmarks', () => {
  const {campus, data, catalog} = fixture();
  const report = createCoverage(campus, data, catalog);
  assert.deepEqual(report.counts, {
    mapBuildingObjects: 3, photoModelBuildingObjects: 1, remainingBaseBuildingObjects: 2,
    partialPhotoModelBuildingObjects: 0, remainingWorkBuildingObjects: 2,
    independentLandmarks: 1, photoModelSites: 2, surveyedBuildingObjects: 0,
  });
  assert.equal(report.completeFaithfulReplication, false);
  assert.equal(report.allFootprintsHavePhotoModels, false);
  assert.equal(report.buildings[0].mapHeight, 5);
  assert.equal(report.buildings[0].currentHeight, 20);
  assert.deepEqual(report.references[0].buildingIds, ['building:1']);
  assert.deepEqual(report.references[1].landmarkIds, ['landmark:1']);
  assert.equal(report.references[2].stage, 'photos-ready-identity-or-model-pending');
});

test('partly rebuilt merged complexes remain in the work backlog', () => {
  const {campus, data, catalog} = fixture();
  campus.buildings.get('building:1').userData.reconstructionExtent = 'partial';
  const report = createCoverage(campus, data, catalog);
  assert.equal(report.counts.photoModelBuildingObjects, 1);
  assert.equal(report.counts.partialPhotoModelBuildingObjects, 1);
  assert.equal(report.counts.remainingBaseBuildingObjects, 2);
  assert.equal(report.counts.remainingWorkBuildingObjects, 3);
  assert.equal(report.buildings[0].stage, 'photo-informed-partial');
});

test('even complete photo-model stage coverage cannot claim measured faithful replication', () => {
  const {campus, data, catalog} = fixture();
  for (const object of campus.buildings.values()) Object.assign(object.userData, {
    refinementStatus: 'detailed', referenceSite: 'main', refinementSummary: 'Photo estimate.',
  });
  const report = createCoverage(campus, data, catalog);
  assert.equal(report.allFootprintsHavePhotoModels, true);
  assert.equal(report.completeFaithfulReplication, false);
  assert.equal(report.counts.surveyedBuildingObjects, 0);
});

test('coverage rejects missing objects, invalid identities, unknown stages and untraceable refinements', () => {
  let {campus, data, catalog} = fixture();
  campus.buildings.delete('building:3');
  assert.throws(() => createCoverage(campus, data, catalog), /every frozen/);
  ({campus, data, catalog} = fixture());
  campus.buildings.get('building:2').userData.featureId = 'wrong';
  assert.throws(() => createCoverage(campus, data, catalog), /identity mismatch/);
  ({campus, data, catalog} = fixture());
  campus.buildings.get('building:2').userData.refinementStatus = 'complete';
  assert.throws(() => createCoverage(campus, data, catalog), /Unknown reconstruction stage/);
  ({campus, data, catalog} = fixture());
  delete campus.buildings.get('building:1').userData.referenceSite;
  assert.throws(() => createCoverage(campus, data, catalog), /Missing photo provenance/);
});
