import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import data from '../data/campus.json' with {type: 'json'};
import catalog from '../reference-catalog.json' with {type: 'json'};
import {createCampusModel} from '../src/model.js';
import {applyCampusRefinements, REFINEMENT_SITES, REFINEMENT_VIEWS} from '../src/refinements.js';

test('the registered batch refines its declared identities without replacing neighboring buildings', () => {
  const campus = createCampusModel(data);
  const before = [...campus.buildings.keys()];
  const ids = applyCampusRefinements(campus, data, {textured: false});
  assert.equal(ids.length, REFINEMENT_SITES.length);
  assert.deepEqual([...campus.buildings.keys()], before);
  assert.deepEqual(campus.group.userData.refinedBuildingIds, ids);
  const sites = new Set();
  for (const [id, building] of campus.buildings) {
    if (ids.includes(id)) {
      assert.equal(building.userData.refinementStatus, 'detailed');
      assert.equal(building.getObjectByName('base').visible, false);
      assert.equal(building.children.filter(child => child.userData.campusDetail).length, 1);
      assert.ok(building.userData.refinementSummary);
      assert.ok(building.userData.renderHeight > 0 && building.userData.renderHeight < 100);
      const site = REFINEMENT_SITES.find(site => site.featureId === id);
      if (site.displayName) {
        assert.equal(building.userData.name, site.displayName);
        assert.equal(building.userData.displayNameSource, site.displayNameSource);
        assert.ok(site.aliases.every(alias => building.userData.aliases.includes(alias)));
      }
      sites.add(building.userData.referenceSite);
    } else {
      assert.equal(building.userData.refinementStatus, 'base');
      assert.equal(building.getObjectByName('base').visible, true);
    }
  }
  assert.deepEqual([...sites].sort(), [...new Set(REFINEMENT_SITES.map(site => site.referenceSite))].sort());
  const featureNodes = [];
  campus.group.traverse(object => { if (object.userData.featureId) featureNodes.push(object); });
  assert.equal(featureNodes.length, before.length);
  assert.equal(new Set(featureNodes.map(object => object.userData.featureId)).size, before.length);
});

test('view aliases target registered map objects without creating duplicate reconstructions', () => {
  assert.equal(new Set(REFINEMENT_SITES.map(site => site.featureId)).size, REFINEMENT_SITES.length);
  assert.equal(new Set(REFINEMENT_VIEWS.map(view => view.buttonId)).size, REFINEMENT_VIEWS.length);
  for (const view of REFINEMENT_VIEWS) {
    assert.ok(REFINEMENT_SITES.some(site => site.featureId === view.featureId));
    assert.ok(view.viewDirection.every(Number.isFinite));
    for (const id of view.groupFeatureIds || []) assert.ok(REFINEMENT_SITES.some(site => site.featureId === id));
  }
});

test('every registered reconstruction has local photo provenance and a reachable workbench view', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.equal(new Set(catalog.sites.map(site => site.id)).size, catalog.sites.length);
  for (const site of REFINEMENT_SITES) {
    const reference = catalog.sites.find(reference => reference.id === site.referenceSite);
    assert.ok(reference, `${site.label} is missing from the local reference catalog`);
    assert.ok(reference.images.length > 0);
    for (const image of reference.images) {
      assert.match(image.path, /^references\\/);
      assert.match(image.sha256, /^[a-f0-9]{64}$/);
      assert.ok(image.width > 0 && image.height > 0);
      assert.ok(new URL(image.pageUrl).protocol === 'https:');
      assert.ok(image.license);
    }
  }
  for (const view of REFINEMENT_VIEWS) {
    assert.equal(html.split(`id="${view.buttonId}"`).length - 1, 1, `${view.label} needs exactly one button`);
  }
});

test('changed map geometry cannot silently remove a registered reconstruction', () => {
  const dataset = {...data, features: data.features.filter(feature => feature.id !== REFINEMENT_SITES[0].featureId)};
  const campus = createCampusModel(dataset);
  assert.throws(() => applyCampusRefinements(campus, dataset, {textured: false}), /footprint ID changed/);
});
