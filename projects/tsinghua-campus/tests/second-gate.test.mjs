import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {SECOND_GATE_ID, SECOND_GATE_ANCHOR, createSecondGateModel} from '../src/second-gate.js';
import wenkaiData from '../src/second-gate-wenkai.json' with {type: 'json'};

test('Second Gate is an unattached local-meter model with parent-owned identity', () => {
  assert.equal(SECOND_GATE_ID, 'landmark:osm:node:941370305');
  assert.deepEqual(SECOND_GATE_ANCHOR, [116.3182903, 39.9997127]);
  const gate = createSecondGateModel();
  assert.ok(gate instanceof THREE.Group);
  assert.equal(gate.parent, null);
  assert.deepEqual(gate.position.toArray(), [0, 0, 0]);
  assert.deepEqual(gate.rotation.toArray().slice(0, 3), [0, 0, 0]);
  assert.deepEqual(gate.scale.toArray(), [1, 1, 1]);
  assert.equal(gate.userData.featureId, undefined);
  assert.equal(gate.userData.referenceSite, 'second-gate');
  assert.ok(gate.userData.referencePages.includes('https://www.tsinghua.edu.cn/zjqh/xyfg/xyjg.htm'));
  assert.match(gate.userData.refinementSummary, /二校门/);
  assert.match(gate.userData.heightSource, /estimated|估测/i);
  assert.equal(gate.userData.estimatedDimensions.wallDepth, 1.4);
});

test('reference provenance distinguishes the modern gate from historical wall remnants', () => {
  const {userData} = createSecondGateModel();
  const modern = userData.referenceEvidence?.find(reference => reference.primary === true);
  const historical = userData.referenceEvidence?.find(reference => reference.period === 'historical');
  assert.equal(modern?.localPath, 'projects/tsinghua-campus/references/second-gate-modern-complete.jpg');
  assert.equal(modern.authoritativeForCurrentAppearance, true);
  assert.equal(historical?.localPath, 'projects/tsinghua-campus/references/second-gate-front-official.jpg');
  assert.equal(historical.authoritativeForCurrentAppearance, false);
  assert.equal(historical.shortWallRemnantsTransferred, false);
  assert.ok(userData.referencePages.includes('https://www.tsinghua.edu.cn/info/2116/81037.htm'));
  assert.equal(userData.history.destroyedYear, 1966);
  assert.equal(userData.history.rebuiltYear, 1991);
  assert.equal(userData.history.shortWallsRemovedPeriod, '1950s');
  assert.equal(userData.anchorSource.nodeId, 941370305);
  assert.equal(userData.anchorSource.version, 5);
  assert.equal(userData.anchorSource.verifiedBy, 'parent');
  assert.equal(userData.anchorSource.frozenBuildingFootprint, false);
});

function through(gate, x, y, face = 1) {
  gate.updateMatrixWorld(true);
  return new THREE.Raycaster(new THREE.Vector3(x, y, face * 3),
    new THREE.Vector3(0, 0, -face), 0, 6).intersectObject(gate, true);
}

test('three full-depth passages have semicircular open crowns, solid piers and lintels', () => {
  const gate = createSecondGateModel();
  const openings = [
    {id: 'center', x: 0, radius: 1.85, spring: 4.45},
    {id: 'west', x: -5.33, radius: 0.65, spring: 2.68},
    {id: 'east', x: 5.33, radius: 0.65, spring: 2.68},
  ];
  assert.equal(gate.userData.archApertures?.length, 3);
  for (const opening of openings) {
    const descriptor = gate.userData.archApertures.find(arch => arch.id === opening.id);
    assert.ok(descriptor);
    assert.equal(descriptor.through, true);
    assert.equal(descriptor.shape, 'semicircular');
    assert.deepEqual(descriptor.depthRange, [-0.7, 0.7]);
    for (const face of [-1, 1]) {
      for (const [x, y] of [
        [opening.x, 0.15],
        [opening.x, opening.spring - 0.1],
        [opening.x, opening.spring + opening.radius - 0.08],
        [opening.x - opening.radius * 0.5, opening.spring + opening.radius * 0.8],
        [opening.x + opening.radius * 0.5, opening.spring + opening.radius * 0.8],
        [opening.x - opening.radius * 0.94, 1],
        [opening.x + opening.radius * 0.94, 1],
      ]) assert.equal(through(gate, x, y, face).length, 0, `${opening.id}: open at ${x},${y}, face ${face}`);
      for (const [x, y] of [
        [opening.x, opening.spring + opening.radius + 0.3],
        [opening.x - opening.radius * 0.9, opening.spring + opening.radius * 0.75],
        [opening.x + opening.radius * 0.9, opening.spring + opening.radius * 0.75],
        [opening.x - opening.radius - 0.2, 1.3],
        [opening.x + opening.radius + 0.2, 1.3],
      ]) assert.ok(through(gate, x, y, face).length, `${opening.id}: masonry at ${x},${y}, face ${face}`);
    }
  }
});

function parts(gate, role) {
  const found = [];
  gate.traverse(object => { if (object.userData.architecturalRole === role) found.push(object); });
  return found;
}

function closeRatio(actual, target, tolerance, label) {
  assert.ok(Math.abs(actual - target) <= tolerance, `${label}: ${actual} vs photo ${target} ±${tolerance}`);
}

function openingBoundary(gate, pointAt, low, high) {
  // Observe the returned scene, not its declared aperture parameters.
  assert.equal(through(gate, ...pointAt(low)).length, 0);
  assert.ok(through(gate, ...pointAt(high)).length);
  for (let i = 0; i < 18; i++) {
    const mid = (low + high) / 2;
    if (through(gate, ...pointAt(mid)).length) high = mid;
    else low = mid;
  }
  return (low + high) / 2;
}

test('current front-photo proportions govern facade, open passages, shafts, bases and separate pole height', () => {
  const gate = createSecondGateModel();
  const facade = parts(gate, 'facade')[0];
  assert.ok(facade, 'structural facade is distinct from the pole');
  const facadeSize = new THREE.Box3().setFromObject(facade).getSize(new THREE.Vector3());
  const bounds = new THREE.Box3().setFromObject(gate);
  const size = bounds.getSize(new THREE.Vector3());
  // Independent targets measured from the 3264x2448 modern front photograph,
  // not ratios derived from model parameters. Occluded feet justify tolerance.
  const centerRadius = openingBoundary(gate, x => [x, 1], 0, 2.2);
  const sideRadius = openingBoundary(gate, offset => [5.33 + offset, 1], 0, 1);
  const centerCrown = openingBoundary(gate, y => [0, y], 5, 6.8);
  const sideCrown = openingBoundary(gate, y => [5.33, y], 2.7, 3.9);
  closeRatio(facadeSize.x / facadeSize.y, 1.43, 0.05, 'facade W/H');
  closeRatio(centerRadius * 2 / facadeSize.x, 0.259, 0.025, 'central clear width / facade width');
  closeRatio(sideRadius / centerRadius, 0.35, 0.06, 'side / central clear width');
  closeRatio(centerCrown / facadeSize.y, 0.625, 0.035, 'central crown / facade height');
  closeRatio((centerCrown - centerRadius) / facadeSize.y, 0.445, 0.035, 'central spring / facade height');
  closeRatio(sideCrown / facadeSize.y, 0.33, 0.035, 'side crown / facade height');
  assert.ok(Math.abs(facadeSize.y - 10) < 0.02);
  assert.ok(Math.abs(size.y - 14) < 0.02);
  assert.ok(Math.abs(size.z - 2.9) < 0.03);
  assert.equal(gate.userData.structuralHeight, 10);
  assert.equal(gate.userData.overallWithPole, 14);
  assert.equal(gate.userData.renderHeight, 14);
  assert.equal(gate.userData.estimatedDimensions.height, 14);
  closeRatio((size.y - facadeSize.y) / facadeSize.y, 0.37, 0.05, 'exposed pole / facade height');
  assert.ok(Math.abs(bounds.min.y) < 1e-6);
  assert.ok(Math.abs(bounds.min.x + bounds.max.x) < 1e-5);
  assert.ok(Math.abs(bounds.min.z + bounds.max.z) < 1e-5);
  const shafts = parts(gate, 'column-shaft'), pedestals = parts(gate, 'pedestal');
  assert.equal(shafts.length, 8);
  assert.equal(pedestals.length, 2);
  for (const shaft of shafts) {
    const shaftSize = new THREE.Box3().setFromObject(shaft).getSize(new THREE.Vector3());
    closeRatio(shaftSize.x / (centerRadius * 2), 0.16, 0.025, 'shaft diameter / central aperture');
    closeRatio(shaftSize.y / 10, 0.46, 0.05, 'shaft height / facade');
  }
  for (const pedestal of pedestals) {
    const pedestalSize = new THREE.Box3().setFromObject(pedestal).getSize(new THREE.Vector3());
    closeRatio(pedestalSize.y / 10, 0.18, 0.035, 'stone pedestal / facade');
  }
  for (const z of [-1.16, 1.16]) {
    gate.updateMatrixWorld(true);
    const acrossFront = new THREE.Raycaster(new THREE.Vector3(-7.8, 4, z),
      new THREE.Vector3(1, 0, 0), 0, 15.6).intersectObject(gate, true);
    const hitMeshes = new Set(acrossFront.map(hit => hit.object));
    assert.ok(hitMeshes.size >= 4, `four projecting shafts on face z=${z}`);
  }
  assert.ok(through(gate, 4.42, 5.85).length, 'curved east shoulder');
  assert.ok(through(gate, -4.42, 5.85).length, 'curved west shoulder');
  assert.equal(gate.userData.photoProportions.primaryImage,
    'projects/tsinghua-campus/references/second-gate-modern-complete.jpg');
});

test('rectangular crest, articulated brick-frieze towers, full side plaster and shallow scroll discs replace old massing', () => {
  const gate = createSecondGateModel();
  for (const side of [-1, 1]) {
    assert.ok(through(gate, side * 0.30, 9.84).length, 'flat narrow top step');
    assert.equal(through(gate, side * 0.80, 9.84).length, 0, 'no sloping triangular pediment');
    assert.ok(through(gate, side * 1.0, 9.67).length, 'flat intermediate step');
    assert.equal(through(gate, side * 1.7, 9.67).length, 0);
    assert.ok(through(gate, side * 2.1, 9.50).length, 'flat wide parapet');
    const frieze = through(gate, side * 3.1, 7.68)[0];
    const lower = through(gate, side * 3.1, 7.15)[0];
    const upper = through(gate, side * 3.1, 8.20)[0];
    assert.match(frieze?.object.material.name ?? '', /brick/);
    assert.match(lower?.object.material.name ?? '', /trim|plaster/);
    assert.match(upper?.object.material.name ?? '', /trim|plaster/);
    assert.ok(upper.point.z - frieze.point.z > 0.4, 'upper tower cornice visibly projects');
    assert.ok(upper.point.z - through(gate, 0, 8.20)[0].point.z > 0.15, 'zig-zag tower/connector outline');
    for (const x of [4.65, 5.33, 6.02]) {
      assert.match(through(gate, side * x, 4.03)[0]?.object.material.name ?? '', /plaster|trim/,
        'side spandrel is a complete plaster field');
    }
    const panel = through(gate, side * 3.1, 1.05)[0];
    const rim = through(gate, side * 4.02, 1.05)[0];
    assert.ok(rim.point.z - panel.point.z > 0.04, 'pedestal panel is physically recessed');
  }
  const inscriptionField = through(gate, 1.6, 7.23)[0];
  const inscriptionFrame = through(gate, 1.6, 7.62)[0];
  assert.ok(inscriptionFrame.point.z - inscriptionField.point.z > 0.025, 'inscription field is recessed in frame');
  const discs = parts(gate, 'volute-disc');
  assert.equal(discs.length, 4);
  for (const disc of discs) {
    const size = new THREE.Box3().setFromObject(disc).getSize(new THREE.Vector3());
    assert.ok(size.x > 0.75 && size.y > 0.5);
    assert.ok(size.z < 0.16, 'scroll is a broad thin disc, not a projecting cylinder');
  }
});

test('traditional vector inscriptions read 園 華 清 from either face without mirrored glyphs', () => {
  const gate = createSecondGateModel(), inscriptions = [];
  gate.traverse(object => {
    if (object.userData.role === 'vector-inscription') inscriptions.push(object);
  });
  assert.equal(inscriptions.length, 2);
  gate.updateMatrixWorld(true);
  for (const face of ['south', 'north']) {
    const inscription = inscriptions.find(object => object.userData.face === face);
    assert.ok(inscription?.isGroup);
    assert.equal(inscription.userData.text, '清華園');
    assert.equal(inscription.userData.visibleLeftToRight, '園華清');
    assert.equal(inscription.userData.readingDirection, 'right-to-left');
    assert.match(inscription.userData.fontSource, /LXGW WenKai Regular v1\.522/);
    assert.match(inscription.userData.calligraphyNote, /那桐/);
    const facing = new THREE.Vector3(0, 0, 1).transformDirection(inscription.matrixWorld);
    assert.ok(facing.z * (face === 'south' ? 1 : -1) > 0.99);
    assert.ok(inscription.matrixWorld.determinant() > 0, 'rotation, not reflected glyph outlines');
    const glyphs = inscription.children.filter(object => object.userData.character);
    assert.equal(glyphs.length, 3);
    const right = face === 'south' ? 1 : -1;
    glyphs.sort((a, b) => right * (a.getWorldPosition(new THREE.Vector3()).x -
      b.getWorldPosition(new THREE.Vector3()).x));
    assert.deepEqual(glyphs.map(object => object.userData.character), ['園', '華', '清']);
    for (const glyph of glyphs) {
      assert.equal(glyph.userData.fontSource, 'LXGW WenKai Regular v1.522', 'one coherent font for all three glyphs');
      assert.ok(glyph.isMesh);
      assert.ok(glyph.geometry.getAttribute('position').count > 300, 'real font curves, not a placeholder stroke');
      assert.ok(glyph.userData.outlineCount > 0);
      const bounds = new THREE.Box3().setFromObject(glyph), size = bounds.getSize(new THREE.Vector3());
      assert.ok(size.x > 0.36 && size.x < 0.56);
      assert.ok(size.y > 0.54 && size.y < 0.67);
      assert.ok(size.z > 0 && size.z < 0.03);
    }
    // WenKai's upper inner horizontal stroke crosses the former Noto sample.
    // Use its upper-right counter and enclosure stroke, not the old font's
    // whitespace coordinates. Rays still test real geometry, not a texture.
    const enclosure = glyphs.find(glyph => glyph.userData.character === '園');
    const glyphRay = (x, y) => new THREE.Raycaster(
      enclosure.localToWorld(new THREE.Vector3(x, y, 1)),
      new THREE.Vector3(0, 0, -1).transformDirection(enclosure.matrixWorld), 0, 2)
      .intersectObject(enclosure);
    assert.equal(glyphRay(0.140, 0.180).length, 0, 'negative space inside 園 enclosure');
    assert.ok(glyphRay(0.196, 0.180).length > 0, 'enclosure right stroke is solid');
    const textSize = new THREE.Box3().setFromObject(inscription).getSize(new THREE.Vector3());
    closeRatio(textSize.x / 3.7, 0.69, 0.08, 'three glyph span / central opening');
    assert.equal(inscription.userData.unknownSmallTextOmitted, true);
  }
});

test('bundled WenKai subset contains only the three licensed traditional inscription glyphs', () => {
  assert.deepEqual(Object.keys(wenkaiData.glyphs).sort(), ['園', '清', '華'].sort());
  assert.match(wenkaiData.sourceFont, /LXGW WenKai Regular v1\.522/);
  assert.equal(wenkaiData.resolution, 1000);
  assert.match(wenkaiData.copyright, /LXGW/);
  assert.match(wenkaiData.copyright, /Klee Project Authors/);
  assert.match(wenkaiData.license, /SIL Open Font License 1\.1/);
  assert.match(wenkaiData.approximation, /NOT a tracing/);
  for (const glyph of Object.values(wenkaiData.glyphs)) {
    assert.match(glyph.o, /\bq\b/);
    assert.ok(glyph.o.length > 1000, 'real font curves, not invented substitute strokes');
  }
});

test('all geometry, instances and materials are finite and use no image textures', t => {
  const gate = createSecondGateModel(), materials = new Set(), geometries = new Set();
  let meshes = 0, instances = 0;
  const materialCounts = {};
  gate.updateMatrixWorld(true);
  gate.traverse(object => {
    assert.equal(object.userData.featureId, undefined);
    for (const array of [object.position.toArray(), object.quaternion.toArray(),
      object.scale.toArray(), object.matrixWorld.elements]) assert.ok(array.every(Number.isFinite));
    if (!object.isMesh) return;
    meshes++;
    const geometry = object.geometry;
    geometries.add(geometry);
    assert.ok(geometry.getAttribute('position').count > 0);
    for (const attribute of Object.values(geometry.attributes)) {
      assert.ok(Array.from(attribute.array).every(Number.isFinite), `${object.name}: finite geometry`);
    }
    if (geometry.index) {
      assert.ok(Array.from(geometry.index.array).every(index =>
        Number.isInteger(index) && index >= 0 && index < geometry.getAttribute('position').count));
    }
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    assert.ok([...geometry.boundingBox.min.toArray(), ...geometry.boundingBox.max.toArray(),
      ...geometry.boundingSphere.center.toArray(), geometry.boundingSphere.radius].every(Number.isFinite));
    if (object.isInstancedMesh) {
      instances += object.count;
      const matrix = new THREE.Matrix4();
      for (let i = 0; i < object.count; i++) {
        object.getMatrixAt(i, matrix);
        assert.ok(matrix.elements.every(Number.isFinite));
        assert.ok(matrix.determinant() > 0);
      }
    }
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      materials.add(material);
      materialCounts[material.name] = (materialCounts[material.name] ?? 0) + 1;
      assert.ok(material.isMeshStandardMaterial);
      assert.ok(material.color.toArray().every(value => Number.isFinite(value) && value >= 0 && value <= 1));
      assert.ok(material.emissive.toArray().every(Number.isFinite));
      assert.equal(material.emissive.getHex(), 0, 'no emissive whitening cheat');
      if (material.name === 'second-gate:trim') {
        const rgb = material.color.toArray();
        assert.ok(Math.max(...rgb) - Math.min(...rgb) < 0.025, 'neutral white, not green tinted');
      }
      for (const property of ['roughness', 'metalness', 'opacity', 'emissiveIntensity']) {
        assert.ok(Number.isFinite(material[property]), `${material.name}: ${property}`);
      }
      assert.ok(material.roughness >= 0 && material.roughness <= 1);
      assert.ok(material.metalness >= 0 && material.metalness <= 1);
      for (const [property, value] of Object.entries(material)) {
        if (property.endsWith('Map') || property === 'map') assert.ok(!value, `no texture: ${property}`);
      }
    }
  });
  assert.ok(meshes > 50, 'volumetric architectural details, not a billboard');
  assert.equal(materials.size, 11, 'neutral masonry palette, stone aggregate, inscription and steel pole');
  t.diagnostic(`${meshes} meshes; ${geometries.size} geometries; ${instances} brick instances; ${materials.size} materials`);
  t.diagnostic(`material mesh counts: ${JSON.stringify(materialCounts)}`);
});

test('repeat factory calls own independent geometry, materials and metadata', () => {
  const first = createSecondGateModel(), second = createSecondGateModel();
  assert.notEqual(first, second);
  assert.equal(first.parent, null);
  assert.equal(second.parent, null);
  const collect = gate => {
    const meshes = [];
    gate.traverse(object => { if (object.isMesh) meshes.push(object); });
    return meshes;
  };
  const a = collect(first), b = collect(second);
  assert.equal(a.length, b.length);
  const aGeometry = new Set(a.map(mesh => mesh.geometry)), aMaterials = new Set(a.map(mesh => mesh.material));
  for (let i = 0; i < b.length; i++) {
    assert.ok(!aGeometry.has(b[i].geometry), 'no geometry shared between callers');
    assert.ok(!aMaterials.has(b[i].material), 'no mutable materials shared between callers');
    assert.deepEqual(a[i].geometry.getAttribute('position').array, b[i].geometry.getAttribute('position').array,
      'deterministic geometry');
  }
  const oldVertex = b[0].geometry.getAttribute('position').getX(0);
  a[0].geometry.translate(10, 0, 0);
  assert.equal(b[0].geometry.getAttribute('position').getX(0), oldVertex);
  const oldColor = b[0].material.color.getHex();
  a[0].material.color.set('#ff00ff');
  assert.equal(b[0].material.color.getHex(), oldColor);
  first.userData.estimatedDimensions.width = 99;
  first.userData.archApertures[0].radius = 99;
  assert.equal(second.userData.estimatedDimensions.width, 14.3);
  assert.equal(second.userData.archApertures[0].radius, 1.85);
  new THREE.Group().add(first);
  assert.equal(second.parent, null);
});

test('shoulder moldings do not protrude above the curved plaster silhouette into empty air', () => {
  const gate = createSecondGateModel();
  for (const side of [-1, 1]) for (const face of [-1, 1]) {
    assert.equal(through(gate, side * 5.10, 5.425, face).length, 0,
      'the source-reference sky above this curved shoulder must remain empty');
    assert.ok(through(gate, side * 4.42, 5.85, face).length,
      'the existing supported plaster shoulder remains intact');
  }
});

test('each recessed pedestal panel has only one front-facing stone surface, not a layered solid front', () => {
  const gate = createSecondGateModel();
  gate.updateMatrixWorld(true);
  for (const side of [-1, 1]) for (const face of [-1, 1]) {
    for (const offset of [-0.5, 0, 0.5]) for (const y of [0.72, 1.05, 1.35]) {
      const hits = new THREE.Raycaster(new THREE.Vector3(side * 3.1 + offset, y, face * 3),
        new THREE.Vector3(0, 0, -face), 0, 1.85).intersectObject(gate, true);
      const surfaces = new Set(hits.filter(hit =>
        /second-gate:stone(?:Aggregate)?$/.test(hit.object.material.name)).map(hit => hit.object));
      assert.equal(surfaces.size, 1, `one stone panel surface at ${side},${face},${offset},${y}`);
      const panel = [...surfaces][0];
      assert.equal(panel.material.name, 'second-gate:stoneAggregate');
      assert.equal(panel.receiveShadow, true, 'real rim shadows still shade the inset');
    }
  }
});

test('pedestal inset albedo is uniform and fine grain cannot interpolate macroscopic color triangles', () => {
  const gate = createSecondGateModel(), panels = [];
  gate.traverse(object => {
    if (object.material?.name === 'second-gate:stoneAggregate') panels.push(object);
  });
  assert.equal(panels.length, 4);
  for (const panel of panels) {
    assert.equal(panel.material.vertexColors, false, 'no interpolated COLOR brightness field');
    assert.equal(panel.geometry.getAttribute('color'), undefined, 'no latent/exportable COLOR_0 field');
    assert.equal(panel.material.map, null, 'uniform neutral stone albedo');
    const position = panel.geometry.getAttribute('position'), index = panel.geometry.index;
    let minZ = Infinity, maxZ = -Infinity;
    for (let i = 0; i < position.count; i++) {
      minZ = Math.min(minZ, position.getZ(i));
      maxZ = Math.max(maxZ, position.getZ(i));
    }
    assert.ok(maxZ - minZ <= 0.0006, 'flat stone panel with sub-millimeter grain only');
    for (let i = 0; i < index.count; i += 3) {
      const points = [0, 1, 2].map(offset =>
        new THREE.Vector3().fromBufferAttribute(position, index.getX(i + offset)));
      for (let edge = 0; edge < 3; edge++) {
        assert.ok(points[edge].distanceTo(points[(edge + 1) % 3]) <= 0.03,
          'grain facets are at most 3 cm, not panel-sized triangles');
      }
    }
  }
});
