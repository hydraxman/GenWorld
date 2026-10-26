import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import polygonClipping from 'polygon-clipping';
import data from '../data/campus.json' with {type: 'json'};
import names from '../data/osm-names.json' with {type: 'json'};
import {PHOTO_APPEARANCES, APPEARANCE_SITES, appearanceProfile} from '../src/photo-appearance.js';
import {createCampusModel} from '../src/model.js';
import {architectureSpec, applyCampusArchitecture, disposeCampusArchitecture, prepareArchitectureExport} from '../src/campus-architecture.js';
import {footprintMetrics, ringArea} from '../src/geo.js';
import {createCoverage} from '../src/coverage.js';
import catalog from '../src/reference-catalog.js';

const features = PHOTO_APPEARANCES.map(profile => data.features.find(feature => feature.id === profile.featureId));
const area = polygons => polygons.reduce((sum, polygon) => sum + ringArea(polygon[0])
  - polygon.slice(1).reduce((sum, ring) => sum + ringArea(ring), 0), 0);

test('each photo appearance has an explicit named source and replays its real footprint correspondence', () => {
  assert.equal(PHOTO_APPEARANCES.length, 16);
  assert.equal(new Set(PHOTO_APPEARANCES.map(profile => profile.featureId)).size, 16);
  assert.equal(APPEARANCE_SITES.length, 15);
  assert.equal(APPEARANCE_SITES.flatMap(site => site.images).length, 18);
  for (const feature of features) {
    const profile = appearanceProfile(feature);
    const source = names.features.find(source => source.id === profile.sourceId);
    assert.ok(source, profile.id);
    const root = footprintMetrics(feature.geometry, data.metadata.center);
    const way = footprintMetrics(source.geometry, data.metadata.center);
    const intersection = area(polygonClipping.intersection(root.projected, way.projected));
    const iou = intersection / (root.area + way.area - intersection);
    if (profile.match === 'named-way-contained-in-merged-root') {
      assert.equal(profile.id, 'teaching-6-a');
      assert.ok(intersection / way.area > .99 && intersection / root.area > .7 && iou < .8);
      assert.match(APPEARANCE_SITES.find(site => site.id === profile.site).unknowns.join(' '), /合并/);
    } else assert.ok(iou > .8, `${profile.id} must not borrow a nearby building's photograph`);
    assert.ok(APPEARANCE_SITES.some(site => site.id === profile.site));
    for (const color of Object.values(profile.palette)) assert.match(color, /^#[a-f\d]{6}$/i);
  }
  assert.ok(new Set(PHOTO_APPEARANCES.map(profile => profile.palette.wall)).size >= 12);
  for (const site of APPEARANCE_SITES) for (const image of site.images) {
    assert.ok(new URL(image.imageUrl).hostname.endsWith('.tsinghua.edu.cn'));
    assert.ok(image.bytes > 0 && image.view && image.license);
    assert.match(image.sha256, /^[a-f0-9]{64}$/);
  }
  const c = features.find(feature => appearanceProfile(feature).id === 'teaching-6-c');
  assert.equal(architectureSpec(c).top, c.properties.renderHeight,
    'A duplicated group photograph must not establish the separate C wing height');
});

test('photo palettes, window styles and bounded entrance features survive near/far display and full-detail export', () => {
  const d = {...data, features}, campus = createCampusModel(d);
  const frozen = JSON.stringify(data);
  applyCampusArchitecture(campus, d);
  const camera = new THREE.PerspectiveCamera(); camera.position.set(0, 10000, 10000);
  campus.updateArchitectureLOD(camera);
  for (const profile of PHOTO_APPEARANCES) {
    const root = campus.buildings.get(profile.featureId);
    assert.equal(root.userData.refinementStatus, 'procedural');
    assert.equal(root.userData.referenceSite, undefined);
    assert.equal(root.userData.appearanceProfileId, profile.id);
    assert.equal(root.userData.appearanceReferenceSite, profile.site);
    const detail = root.children.find(child => child.userData.architectureLOD);
    const near = detail.children.find(child => child.userData.architectureNear);
    const far = detail.children.find(child => child.userData.architectureFar);
    assert.equal(near.visible, false); assert.equal(far.visible, true);
    assert.equal(detail.userData.appearanceProfile.windows, profile.windows);
    if (profile.inspectionDirection) assert.deepEqual(root.userData.viewDirection, profile.inspectionDirection);
    const materials = [];
    near.traverse(object => {if (object.isMesh) materials.push(object.material);});
    for (const part of ['wall', 'plinth', 'frame', 'glass', 'trim', 'roof']) {
      const material = materials.find(material => material.name.includes(`${profile.id} ${part}`));
      assert.ok(material, `Missing actual ${part} material for ${profile.id}`);
      assert.equal(material.color.getHexString(), profile.palette[part].slice(1));
    }
    if (profile.entry !== 'plain') {
      const entrance = near.children.find(child => child.userData.photoAppearanceEntrance);
      assert.ok(entrance?.children.some(child => child.isMesh), `Unused entry specification at ${profile.id}`);
    }
    const roofColor = new THREE.Color(profile.palette.roof).toArray();
    const wallColor = new THREE.Color(profile.palette.wall).toArray();
    const glassColor = new THREE.Color(profile.palette.glass).toArray();
    const farColors = far.children.flatMap(mesh => {
      const attribute = mesh.geometry.attributes.color;
      return Array.from({length: attribute.count}, (_, i) => [attribute.getX(i), attribute.getY(i), attribute.getZ(i)]);
    });
    for (const expected of [roofColor, wallColor, glassColor]) assert.ok(
      farColors.some(color => color.every((value, i) => Math.abs(value - expected[i]) < 1e-6)),
      `Overview must retain ${profile.id}'s photograph-guided palette, not turn uniformly gray`);
    near.updateMatrixWorld(true);
    const sample = detail.userData.facadeSample, direction = new THREE.Vector3(...root.userData.viewDirection);
    direction.y = 0; direction.normalize();
    for (const [part, expected] of [['glazing', 'glass'], ['masonry', 'wall']]) {
      const point = new THREE.Vector3(...sample[part]);
      const hits = new THREE.Raycaster(point.clone().addScaledVector(direction, 1), direction.clone().negate(), 0, 1.5)
        .intersectObject(near, true).filter(hit => !hit.object.parent.userData.photoAppearanceEntrance);
      assert.ok(hits[0]?.object.material.name.includes(`${profile.id} ${expected}`),
        `${profile.id} ${part} pixel sample must be on its real ${expected} surface`);
    }
    const clone = prepareArchitectureExport(root.clone(true));
    assert.equal(clone.userData.appearanceReferenceSite, profile.site);
    assert.equal(clone.children.find(child => child.userData.architectureLOD)
      .children.find(child => child.userData.architectureNear).visible, true);
  }
  const report = createCoverage(campus, d, catalog);
  assert.equal(report.counts.photoAppearanceBuildingObjects, 16);
  assert.equal(report.counts.photoModelBuildingObjects, 0);
  assert.equal(report.counts.remainingWorkBuildingObjects, 16);
  assert.ok(report.references.filter(record => record.appearanceBuildingIds.length)
    .every(record => record.stage === 'photo-appearance-only-estimated-envelope' && !record.buildingIds.length));
  assert.equal(JSON.stringify(data), frozen);
  disposeCampusArchitecture(campus);
});

test('appearance source/name drift fails before any original building is replaced', () => {
  for (const change of [
    feature => {feature.properties.name = 'another building';},
    feature => {feature.properties.nameRole = 'contained-poi-label-not-verified-building-name';},
    feature => {feature.properties.nameSourceFeatureId = 'osm:way:1';},
  ]) {
    const d = structuredClone({...data, features});
    change(d.features.at(-1));
    const campus = createCampusModel(d);
    assert.throws(() => applyCampusArchitecture(campus, d), /Photo appearance identity/);
    for (const root of campus.buildings.values()) {
      assert.equal(root.userData.refinementStatus, 'base');
      assert.equal(root.getObjectByName('base').visible, true);
    }
  }
});

test('shared photo materials are reused on reapply and their textures are released only once', () => {
  const d = {...data, features}, campus = createCampusModel(d);
  applyCampusArchitecture(campus, d);
  const materials = new Set(), textures = new Set();
  campus.group.traverse(object => {
    if (!object.isMesh || !object.parent?.parent?.userData.architectureNear) return;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      materials.add(material);
      for (const texture of Object.values(material)) if (texture?.isTexture) textures.add(texture);
    }
  });
  assert.ok(materials.size > 50 && textures.size <= 4);
  let releasedMaterials = 0, releasedTextures = 0;
  for (const material of materials) material.addEventListener('dispose', () => releasedMaterials++);
  for (const texture of textures) texture.addEventListener('dispose', () => releasedTextures++);
  applyCampusArchitecture(campus, d);
  assert.equal(releasedMaterials, 0); assert.equal(releasedTextures, 0);
  disposeCampusArchitecture(campus);
  assert.equal(releasedMaterials, materials.size); assert.equal(releasedTextures, textures.size);
  for (const root of campus.buildings.values()) {
    assert.equal(root.userData.appearanceProfileId, undefined);
    assert.equal(root.userData.refinementStatus, 'base');
  }
});
