import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { FLOORS } from '../src/curriculum.js';
import { createKnowledgeTower } from '../src/tower.js';
import { EXHIBIT_DESCRIPTIONS } from '../src/exhibits.js';

const makeTower = () => createKnowledgeTower(THREE, FLOORS);
const floorGroups = model => model.group.children.filter(object => object.userData.role === 'floor');
const floorGroup = (model, number) => floorGroups(model).find(object => object.userData.floorNumber === number);
const roomGroup = (model, id) => model.pickables.find(object => object.userData.roomId === id);
const rounded = values => values.map(value => Math.round(value * 1e9) / 1e9);

// Capture transforms, visibility and material state, not just floor heights.
function snapshot(model) {
  const result = [];
  model.group.traverse(object => {
    const materials = object.material ? [object.material].flat() : [];
    result.push({
      name: object.name,
      userData: structuredClone(object.userData),
      visible: object.visible,
      position: rounded(object.position.toArray()),
      quaternion: rounded(object.quaternion.toArray()),
      scale: rounded(object.scale.toArray()),
      materials: materials.map(material => ({
        color: material.color?.getHex(),
        emissive: material.emissive?.getHex(),
        intensity: material.emissiveIntensity,
        opacity: material.opacity,
      })),
    });
  });
  return result;
}

function visibleThroughAncestors(object) {
  for (let parent = object; parent; parent = parent.parent) {
    if (!parent.visible) return false;
  }
  return true;
}

test('16 named floors, 64 visible sculptural room groups and complete mesh metadata', () => {
  const model = makeTower();
  assert.equal(floorGroups(model).length, 16);
  assert.equal(model.pickables.length, 64);
  assert.equal(new Set(model.pickables).size, 64);
  const kinds = new Set();
  for (const floor of FLOORS) {
    const level = floorGroup(model, floor.number);
    assert.equal(level.name, `floor-${floor.number}`);
    assert.equal(level.userData.title, floor.title);
    assert.equal(level.visible, true);
    for (const room of floor.rooms) {
      const gallery = roomGroup(model, room.id);
      assert.equal(gallery.parent, level);
      assert.equal(gallery.name, `room-${room.id}`);
      assert.equal(gallery.userData.title, room.name);
      let meshes = 0;
      gallery.traverse(object => {
        if (object.userData.exhibitKind) kinds.add(object.userData.exhibitKind);
        if (!object.isMesh) return;
        meshes++;
        assert.equal(object.userData.floorNumber, floor.number);
        assert.equal(object.userData.roomId, room.id);
        assert.equal(object.visible, true);
        assert.ok(object.material instanceof THREE.MeshStandardMaterial);
        assert.equal(object.material.map, null, 'No external or canvas texture dependency');
      });
      assert.ok(meshes >= 10, `${room.id} has a deck, table and representative sculpture`);
    }
  }
  assert.equal(kinds.size, 64, 'Each curriculum room has its own semantic exhibit type');
  assert.deepEqual([...kinds].sort(), Object.values(EXHIBIT_DESCRIPTIONS).map(value => value.type).sort());
  assert.ok(model.group.getObjectByName('core-shaft'));
  assert.ok(model.group.getObjectByName('layered-circular-plaza'));
});

test('realistic finite geometry bounds, moderate mesh and triangle budgets', t => {
  const model = makeTower();
  let meshCount = 0;
  let triangles = 0;
  const geometrySet = new Set();
  model.group.traverse(object => {
    for (const value of [...object.position.toArray(), ...object.scale.toArray(), ...object.quaternion.toArray()]) {
      assert.ok(Number.isFinite(value), `Finite transform: ${object.name}`);
    }
    if (!object.isMesh) return;
    meshCount++;
    geometrySet.add(object.geometry);
    const positions = object.geometry.attributes.position;
    for (let i = 0; i < positions.array.length; i++) assert.ok(Number.isFinite(positions.array[i]));
    triangles += (object.geometry.index?.count ?? positions.count) / 3;
  });
  const bounds = new THREE.Box3().setFromObject(model.group);
  assert.equal(bounds.isEmpty(), false);
  for (const value of [...bounds.min.toArray(), ...bounds.max.toArray()]) assert.ok(Number.isFinite(value));
  const size = bounds.getSize(new THREE.Vector3());
  assert.ok(size.x >= 35 && size.x <= 38, `Plaza width ${size.x}`);
  assert.ok(size.z >= 35 && size.z <= 38, `Plaza depth ${size.z}`);
  assert.ok(size.y >= 58 && size.y <= 61, `Tower height ${size.y}`);
  // Richer architecture, furnishings, 64 teaching models and checkpoints replace
  // the former five generic sculptures. User-approved all-floor budget is 4000.
  assert.ok(meshCount <= 4000, `${meshCount} meshes`);
  assert.ok(triangles < 250000, `${triangles} triangles including shared geometry instances`);
  assert.ok(geometrySet.size <= 8, 'Geometries are reused across rooms and floors');
  t.diagnostic(`${meshCount} meshes; ${triangles} triangles; ${geometrySet.size} shared geometries`);
});

test('tower/exploded/floor transitions are deterministic and round-trip all scene state', () => {
  const model = makeTower();
  const initial = snapshot(model);
  const state = { mode: 'exploded', floor: 6, roomId: '6-2', relatedFloors: [1, 3, 13], routeFloors: [6, 7, 11, 12] };
  model.setState(state);
  const exploded = snapshot(model);
  for (let number = 1; number <= 16; number++) {
    assert.ok(Math.abs(model.getFloorPosition(number).y - (1.15 + (number - 1) * 6.4)) < 1e-9);
  }
  const structure = model.group.getObjectByName('global-structure');
  const topColumn = structure.getObjectByName('corner-column-10.5-8.5');
  assert.ok(topColumn.scale.y > 99, 'Global structure grows with exploded layout');
  model.setState({ mode: 'floor', floor: 13, roomId: '13-3' });
  assert.equal(model.getFloorPosition(13).y, 0.8);
  model.setState(state);
  assert.deepEqual(snapshot(model), exploded);
  model.setState(state);
  assert.deepEqual(snapshot(model), exploded, 'Repeated state is idempotent');
  model.setState({ mode: 'tower', floor: 1 });
  assert.deepEqual(snapshot(model), initial);
  for (let number = 1; number <= 16; number++) {
    assert.ok(Math.abs(model.getFloorPosition(number).y - (1.15 + (number - 1) * 3.6)) < 1e-9);
  }
});

test('every floor can be isolated and the full-height shaft/columns remain hidden', () => {
  const model = makeTower();
  for (const floor of FLOORS) {
    model.setState({ mode: 'floor', floor: floor.number });
    assert.deepEqual(floorGroups(model).filter(object => object.visible).map(object => object.userData.floorNumber), [floor.number]);
    assert.equal(model.getFloorPosition(floor.number).y, 0.8);
    const structure = model.group.getObjectByName('global-structure');
    structure.traverse(object => assert.equal(visibleThroughAncestors(object), false));
    for (const room of floor.rooms) assert.ok(visibleThroughAncestors(roomGroup(model, room.id)));
  }
  model.setState({ mode: 'tower', floor: 16 });
  assert.ok(visibleThroughAncestors(model.group.getObjectByName('core-shaft')));
  assert.ok(floorGroups(model).every(object => object.visible));
});

test('getFloorPosition returns a fresh world-space base centre, including host transforms', () => {
  const model = makeTower();
  const host = new THREE.Group();
  host.position.set(4, -2, 9);
  host.rotation.set(0.15, 0.5, -0.1);
  host.scale.set(1.2, 0.85, 1.1);
  host.add(model.group);
  model.group.position.set(-3, 5, 2);
  model.group.rotation.y = -0.3;
  for (const state of [{ mode: 'tower', floor: 4 }, { mode: 'exploded', floor: 4 }, { mode: 'floor', floor: 4 }]) {
    model.setState(state);
    const expected = floorGroup(model, 4).localToWorld(new THREE.Vector3(0, 0, 0));
    const actual = model.getFloorPosition(4);
    assert.ok(actual instanceof THREE.Vector3);
    assert.ok(actual.distanceTo(expected) < 1e-9);
    actual.set(123, 456, 789);
    assert.ok(model.getFloorPosition(4).distanceTo(expected) < 1e-9);
  }
  // getFloorPosition must also update newly changed ancestors without a render.
  host.position.x += 10;
  assert.ok(Math.abs(model.getFloorPosition(4).x - floorGroup(model, 4).localToWorld(new THREE.Vector3()).x) < 1e-9);
});

test('floor, room, prerequisite and route accents differ and do not leak on reset', () => {
  const model = makeTower();
  const baseline = snapshot(model);
  model.setState({ mode: 'tower', floor: 9, roomId: '9-3', relatedFloors: [13, 14], routeFloors: [8, 14] });
  const selectedSlab = floorGroup(model, 9).getObjectByProperty('isMesh', true).material;
  const prerequisite = floorGroup(model, 13).getObjectByName('prerequisite-accent');
  const route = floorGroup(model, 8).getObjectByName('route-accent');
  assert.equal(prerequisite.visible, true);
  assert.equal(route.visible, true);
  assert.notEqual(selectedSlab.emissive.getHex(), prerequisite.material.color.getHex());
  assert.notEqual(prerequisite.material.color.getHex(), route.material.color.getHex());
  assert.equal(floorGroup(model, 14).getObjectByName('prerequisite-accent').visible, true);
  assert.equal(floorGroup(model, 14).getObjectByName('route-accent').visible, true);
  const selectedRoom = roomGroup(model, '9-3').getObjectByName('selected-rim');
  const otherRoom = roomGroup(model, '9-2').getObjectByName('gallery-selection-rim');
  assert.equal(selectedRoom.material.color.getHex(), 0xffd37d);
  assert.equal(visibleThroughAncestors(selectedRoom), true);
  assert.equal(otherRoom.visible, false, 'Selection uses a separate hairline, not score colour replacement');
  assert.ok(floorGroups(model).every(object => object.visible), 'Unrelated floors are not hidden');
  const unrelatedSlab = floorGroup(model, 2).getObjectByName('slab-2-z-5.5');
  assert.equal(unrelatedSlab.material.color.getHex(), 0xe9e1d0, 'Unrelated floors stay pale limestone, not dimmed');
  model.setState({ mode: 'tower', floor: 1 });
  assert.deepEqual(snapshot(model), baseline);
});

test('all 64 semantic descriptions are Chinese, unique and match their room sculptures', () => {
  const model = makeTower();
  assert.deepEqual(Object.keys(EXHIBIT_DESCRIPTIONS).sort(), FLOORS.flatMap(f => f.rooms.map(r => r.id)).sort());
  assert.equal(new Set(Object.values(EXHIBIT_DESCRIPTIONS).map(d => d.title)).size, 64);
  assert.equal(new Set(Object.values(EXHIBIT_DESCRIPTIONS).map(d => d.summary)).size, 64);
  const representativeTypes = [
    'binary-tiles', 'git-branches', 'bplus-tree', 'dp-lattice',
    'capacity-flow', 'cpu-board', 'tcp-window', 'transaction-log',
    'requirements-tests', 'module-boundaries', 'replica-quorum', 'security-shield',
    'finite-automaton', 'basis-vectors', 'bell-histogram', 'rag-pipeline',
  ];
  for (const type of representativeTypes) {
    assert.ok(Object.values(EXHIBIT_DESCRIPTIONS).some(d => d.type === type), type);
  }
  for (const gallery of model.pickables) {
    const description = EXHIBIT_DESCRIPTIONS[gallery.userData.roomId];
    assert.equal(Object.isFrozen(description), true);
    assert.equal(description.id, gallery.userData.roomId);
    assert.match(description.title, /[\u4e00-\u9fff]/);
    assert.match(description.summary, /[\u4e00-\u9fff]/);
    assert.ok(description.summary.length > 20);
    const sculpture = gallery.children.find(o => o.userData.role === 'exhibit');
    assert.equal(sculpture.userData.exhibitKind, description.type);
    assert.equal(sculpture.userData.title, description.title);
    assert.equal(sculpture.userData.summary, description.summary);
    let parts = 0;
    sculpture.traverse(part => {
      if (!part.isMesh) return;
      parts++;
      assert.equal(part.userData.exhibitId, description.id);
      assert.equal(part.userData.exhibitKind, description.type);
      assert.equal(part.userData.semanticPart, part.name);
      assert.ok(part.name.length >= 3, `${description.id}: named semantic part`);
    });
    assert.ok(parts >= 4);
    // Compute bounds in sculpture-local space, independent of tower layout.
    sculpture.updateWorldMatrix(true, true);
    const inverse = sculpture.matrixWorld.clone().invert();
    const bounds = new THREE.Box3();
    sculpture.traverse(part => {
      if (!part.isMesh) return;
      part.geometry.computeBoundingBox();
      bounds.union(part.geometry.boundingBox.clone().applyMatrix4(
        inverse.clone().multiply(part.matrixWorld),
      ));
    });
    const size = bounds.getSize(new THREE.Vector3());
    assert.ok(size.x <= 3.6 + 1e-8 && size.z <= 2.8 + 1e-8, `${description.id}: ${size.toArray()}`);
    assert.ok(bounds.min.y >= -1e-8, `${description.id} rests on its table`);
    assert.ok(bounds.max.y < 2.2, `${description.id} fits below the next floor`);
    assert.equal(sculpture.position.y, 1.08);
  }
});

test('refined architecture has warm galleries, mullions, open-front circulation and a hidden isolated roof', () => {
  const model = makeTower();
  for (const floor of FLOORS) {
    const level = floorGroup(model, floor.number);
    for (const name of ['limestone-fascia', 'fascia-shadow-reveal', 'bronze-facade-mullion',
      'warm-recessed-cove', 'atrium-glass-balustrade', 'elevator-landing', 'checkpoint-lintel']) {
      assert.ok(level.getObjectByName(name), `${floor.number}: ${name}`);
    }
    if (floor.number < 16) assert.ok(level.getObjectByName('stair-tread-17'));
    for (const room of floor.rooms) {
      const gallery = roomGroup(model, room.id);
      const [x, z] = [[-5.8, -4.5], [5.8, -4.5], [-5.8, 4.5], [5.8, 4.5]][room.index];
      assert.deepEqual(gallery.position.toArray(), [x, 0, z]);
      assert.ok(gallery.getObjectByName('reading-bench-seat'));
      assert.ok(gallery.getObjectByName('reference-book-2'));
    }
  }
  assert.ok(model.group.getObjectByName('entry-canopy'));
  assert.ok(model.group.getObjectByName('entry-step-3'));
  assert.ok(model.group.getObjectByName('roof-crown-pavilion'));
  model.setState({ mode: 'floor', floor: 16 });
  assert.equal(visibleThroughAncestors(model.group.getObjectByName('roof-crown-pavilion')), false);
  assert.equal(visibleThroughAncestors(model.group.getObjectByName('entry-canopy')), false);
  assert.equal(visibleThroughAncestors(floorGroup(model, 16).getObjectByName('inter-floor-stair')), false);
});

const sampleOccupants = [
  { id: 'my-avatar', floor: 7, roomId: '7-2', color: '#ffd37d' },
  { id: 'beginner', floor: 1, roomId: '1-1', color: '#e77b78' },
  { id: 'researcher', floor: 16, roomId: null, color: '#7baff5' },
  { id: 'peer', floor: 7, roomId: '7-2', color: '#59cdb7' },
];

test('mastery is independent/non-linear, unknown differs from zero, and gold never masks the heatmap', () => {
  const model = makeTower();
  const normalDeck = roomGroup(model, '1-1').getObjectByName('gallery-deck').material.color.getHex();
  const data = {
    heatmap: true,
    mastery: { '1-1': 0, '1-2': null, '1-3': 39.9, '1-4': 40, '16-1': 69.9, '16-2': 70, '16-3': 84.9, '16-4': 85 },
    passedFloors: [16],
  };
  model.setLearning(data);
  const expected = {
    '1-1': '#e77b78', '1-2': '#65778d', '1-3': '#e77b78', '1-4': '#e8b96a',
    '16-1': '#e8b96a', '16-2': '#59cdb7', '16-3': '#59cdb7', '16-4': '#7baff5',
    '8-1': '#65778d',
  };
  for (const [id, hex] of Object.entries(expected)) {
    const gallery = roomGroup(model, id);
    assert.equal(gallery.userData.masteryColor, hex);
    assert.equal(gallery.userData.mastery, data.mastery[id] ?? null);
    for (const name of ['gallery-deck', 'gallery-front-inlay', 'gallery-side-inlay']) {
      assert.equal(gallery.getObjectByName(name).material.color.getHexString(), hex.slice(1));
    }
    // Selected and unselected rooms have exactly the same score surface.
    const number = gallery.userData.floorNumber;
    for (const mode of ['tower', 'exploded', 'floor']) {
      model.setState({ mode, floor: number, roomId: id });
      assert.equal(gallery.getObjectByName('gallery-deck').material.color.getHexString(), hex.slice(1));
      assert.equal(gallery.getObjectByName('gallery-front-inlay').material.color.getHexString(), hex.slice(1));
      assert.equal(gallery.getObjectByName('gallery-selection-rim').visible, true);
      assert.equal(gallery.getObjectByName('selected-rim').material.color.getHex(), 0xffd37d);
    }
  }
  assert.equal(roomGroup(model, '1-1').userData.mastery, 0);
  assert.equal(roomGroup(model, '1-2').userData.mastery, null);
  data.mastery['1-1'] = 100;
  data.passedFloors.push(1);
  model.setState({ mode: 'tower', floor: 1 });
  assert.equal(roomGroup(model, '1-1').userData.mastery, 0, 'Input objects are copied');
  model.setLearning({ ...data, heatmap: false });
  assert.equal(roomGroup(model, '1-1').userData.mastery, 100);
  assert.equal(roomGroup(model, '1-1').getObjectByName('gallery-deck').material.color.getHex(), normalDeck);
  model.setLearning();
  assert.equal(roomGroup(model, '1-1').userData.mastery, null, 'Replacement resets omitted rooms to unknown');
});

test('learning survives view round-trips and does not mutate the current view', () => {
  const model = makeTower();
  const state = { mode: 'exploded', floor: 7, roomId: '7-2', relatedFloors: [1, 6], routeFloors: [7, 16] };
  model.setState(state);
  const floorPositions = floorGroups(model).map(f => f.position.toArray());
  const learning = {
    heatmap: true, mastery: { '1-1': 15, '16-4': 98, '7-2': 62 },
    occupants: sampleOccupants, passedFloors: [1, 4, 16],
  };
  model.setLearning(learning);
  assert.deepEqual(floorGroups(model).map(f => f.position.toArray()), floorPositions);
  assert.equal(roomGroup(model, '7-2').getObjectByName('gallery-selection-rim').visible, true);
  const baseline = snapshot(model);
  model.setLearning(learning);
  assert.deepEqual(snapshot(model), baseline, 'Learning replacement is idempotent');
  for (let i = 0; i < 3; i++) {
    model.setState({ mode: 'floor', floor: 1 });
    model.setState({ mode: 'tower', floor: 16 });
    model.setState(state);
  }
  assert.deepEqual(snapshot(model), baseline, 'No position, material, visibility or metadata drift');
});

test('four distinct learner positions follow their floors, have their own raycast identity, and never enter room pickables', () => {
  const model = makeTower();
  model.setLearning({ occupants: sampleOccupants });
  const people = [];
  model.group.traverse(o => { if (o.userData.role === 'learner' && o.isGroup) people.push(o); });
  assert.equal(people.length, 4);
  const raycaster = new THREE.Raycaster();
  for (const person of people) {
    const input = sampleOccupants.find(o => o.id === person.userData.learnerId);
    assert.equal(person.parent, floorGroup(model, input.floor));
    assert.equal(person.userData.roomId, input.roomId);
    assert.equal(person.getObjectByName('learner-coat').material.color.getHexString(), input.color.slice(1));
    assert.ok(person.getObjectByName('learner-halo'));
    assert.ok(person.getObjectByName('learner-vertical-pin'));
    assert.ok(person.position.y < 0.5, 'Position is relative to the floor, never full progress height');
    model.setState({ mode: 'floor', floor: input.floor });
    const origin = person.localToWorld(new THREE.Vector3(0, 4, 0));
    raycaster.set(origin, new THREE.Vector3(0, -1, 0));
    const personHits = raycaster.intersectObject(person, true);
    assert.ok(personHits.length > 0);
    assert.ok(personHits.every(hit => hit.object.userData.learnerId === input.id));
    assert.ok(personHits.every(hit => hit.object.userData.floorNumber === input.floor));
    const roomHits = raycaster.intersectObjects(model.pickables, true);
    assert.ok(roomHits.every(hit => !hit.object.userData.learnerId));
  }
  const mine = model.group.getObjectByName('learner-my-avatar');
  const peer = model.group.getObjectByName('learner-peer');
  assert.ok(mine.position.distanceTo(peer.position) > 0.5, 'Same-room learners do not overlap');
  model.setState({ mode: 'floor', floor: 2 });
  raycaster.set(mine.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 5, 0)), new THREE.Vector3(0, -1, 0));
  assert.deepEqual(raycaster.intersectObject(mine, true), [], 'Hidden learners do not raycast');
  model.setLearning();
  assert.equal(model.group.getObjectByName('learner-my-avatar'), undefined);
  assert.equal(model.pickables.length, 64);
});

test('all 16 checkpoint arches have passed colours and fresh, transformed world-space button anchors', () => {
  const model = makeTower();
  model.setLearning({ passedFloors: [1, 3, 16] });
  const host = new THREE.Group();
  host.position.set(3, -2, 8);
  host.rotation.set(0.1, 0.4, -0.05);
  host.scale.set(1.3, 0.8, 1.1);
  host.add(model.group);
  for (const mode of ['tower', 'exploded', 'floor']) for (let number = 1; number <= 16; number++) {
    model.setState({ mode, floor: number });
    const checkpoint = floorGroup(model, number).getObjectByName(`checkpoint-${number}`);
    assert.equal(checkpoint.userData.role, 'checkpoint');
    assert.equal(checkpoint.userData.floorNumber, number);
    assert.equal(checkpoint.userData.passed, [1, 3, 16].includes(number));
    assert.deepEqual(checkpoint.position.toArray(), [0, 0.3, 6.8]);
    const expectedColor = [1, 3, 16].includes(number) ? '59cdb7' : 'e8b96a';
    assert.equal(checkpoint.getObjectByName('checkpoint-status').material.color.getHexString(), expectedColor);
    checkpoint.traverse(o => {
      if (!o.isMesh) return;
      assert.equal(o.userData.role, 'checkpoint');
      assert.equal(o.userData.floorNumber, number);
    });
    host.position.x += 0.1; // API must update changed ancestors without rendering.
    const actual = model.getCheckpointPosition(number);
    const expected = floorGroup(model, number).localToWorld(new THREE.Vector3(0, 2.95, 6.8));
    assert.ok(actual.distanceTo(expected) < 1e-8);
    actual.set(1000, 1000, 1000);
    assert.ok(model.getCheckpointPosition(number).distanceTo(expected) < 1e-8);
  }
  for (const value of [0, 17, '1', null, NaN, 3.5]) assert.throws(() => model.getCheckpointPosition(value), RangeError);
  model.setLearning();
  assert.equal(floorGroup(model, 1).getObjectByName('checkpoint-status').material.color.getHexString(), 'e8b96a');
});

test('invalid learning input is rejected atomically, including late errors after valid profiles', () => {
  const model = makeTower();
  model.setState({ mode: 'exploded', floor: 7, roomId: '7-2' });
  model.setLearning({ heatmap: true, mastery: { '1-1': 8, '16-4': 99 }, occupants: sampleOccupants, passedFloors: [4] });
  const before = snapshot(model);
  const invalid = [
    null, [], new Map(), { heatmap: 1 }, { heatmap: 'false' },
    ...[null, [], new Map(), new Date()].map(mastery => ({ mastery })),
    { mastery: { '0-1': 80 } }, { mastery: { '1-1': 100, '17-1': 50 } },
    ...[-1, 100.1, NaN, Infinity, -Infinity, undefined, '85', false, {}].map(value => ({ mastery: { '1-1': value } })),
    { passedFloors: null }, { passedFloors: '1' },
    ...[0, 17, 1.5, '1', NaN].map(value => ({ passedFloors: [1, value] })),
    { occupants: null }, { occupants: {} },
    ...[null, [], {}, { id: '' }, { id: 12 },
      { ...sampleOccupants[0], floor: '7' }, { ...sampleOccupants[0], floor: 17 },
      { ...sampleOccupants[0], roomId: '1-1' }, { ...sampleOccupants[0], roomId: 'missing' },
      { ...sampleOccupants[0], roomId: undefined }, { ...sampleOccupants[0], color: null },
      ...['', 'not-a-color', '#12', '#zzzzzz', 'rgb(256,0,0)', 'rgb(1%,2,3)', 'hsl(12,110%,2%)'].map(color => ({ ...sampleOccupants[0], color })),
    ].map(profile => ({ occupants: [{ id: 'valid', floor: 4, roomId: null, color: 'gold' }, profile] })),
    { occupants: [sampleOccupants[0], { ...sampleOccupants[0] }] },
  ];
  for (const state of invalid) {
    assert.throws(() => model.setLearning(state), error => error instanceof TypeError || error instanceof RangeError);
    assert.deepEqual(snapshot(model), before, `No partial mutation for ${JSON.stringify(state)}`);
  }
});

test('learning accepts fractional scores and valid CSS colours, copies occupants and resets explicitly', () => {
  const model = makeTower();
  const occupants = [
    { id: 'hex-short', floor: 2, roomId: null, color: '#abc' },
    { id: 'named', floor: 2, roomId: null, color: 'gold' },
    { id: 'rgb', floor: 2, roomId: null, color: 'rgb(10, 20, 30)' },
    { id: 'hsl', floor: 2, roomId: null, color: 'hsl(180, 50%, 60%)' },
  ];
  model.setLearning({ mastery: { '1-1': 39.75, '16-4': 100 }, occupants });
  occupants[0].floor = 16;
  occupants[0].color = '#000000';
  model.setState({ mode: 'floor', floor: 2 });
  const person = model.group.getObjectByName('learner-hex-short');
  assert.equal(person.parent, floorGroup(model, 2));
  assert.equal(person.getObjectByName('learner-coat').material.color.getHexString(), 'aabbcc');
  assert.equal(roomGroup(model, '1-1').userData.mastery, 39.75);
  assert.equal(roomGroup(model, '16-4').userData.masteryColor, '#7baff5');
  const before = snapshot(model);
  model.setState({ mode: 'floor', floor: 2 });
  assert.deepEqual(snapshot(model), before);
  model.setLearning({});
  assert.equal(model.group.getObjectByName('learner-hex-short'), undefined);
  assert.equal(roomGroup(model, '16-4').userData.mastery, null);
});

test('all 64 galleries are raycast-selectable and hidden ancestors cannot be selected', () => {
  const model = makeTower();
  const raycaster = new THREE.Raycaster();
  for (const floor of FLOORS) {
    model.setState({ mode: 'floor', floor: floor.number });
    for (const room of floor.rooms) {
      const gallery = roomGroup(model, room.id);
      const target = gallery.localToWorld(new THREE.Vector3(2.5, 0.44, 1.9));
      raycaster.set(target.clone().add(new THREE.Vector3(0, 6, 0)), new THREE.Vector3(0, -1, 0));
      const hits = raycaster.intersectObjects(model.pickables, true);
      assert.ok(hits.length > 0, `Room ${room.id} is selectable`);
      assert.ok(hits.every(hit => hit.object.userData.floorNumber === floor.number));
      assert.equal(hits[0].object.userData.roomId, room.id);
      assert.ok(hits.every(hit => visibleThroughAncestors(hit.object)));
      // Parent browser picking aims at room group centres, not just clear deck
      // corners. Verify both a vertical and a front-oblique sculpture-centre ray.
      const centre = gallery.localToWorld(new THREE.Vector3(0, 0.7, 0));
      for (const offset of [new THREE.Vector3(0, 6, 0), new THREE.Vector3(0.5, 6, 3)]) {
        const origin = centre.clone().add(offset);
        raycaster.set(origin, centre.clone().sub(origin).normalize());
        const centreHits = raycaster.intersectObjects(model.pickables, true);
        assert.ok(centreHits.length > 0, `Room centre ${room.id}`);
        assert.equal(centreHits[0].object.userData.roomId, room.id);
      }
    }
  }
  model.setState({ mode: 'floor', floor: 4 });
  const hiddenRoom = roomGroup(model, '3-1');
  const hiddenTarget = hiddenRoom.localToWorld(new THREE.Vector3(2.5, 0.44, 1.9));
  raycaster.set(hiddenTarget.clone().add(new THREE.Vector3(0, 0.3, 0)), new THREE.Vector3(0, -1, 0));
  assert.deepEqual(raycaster.intersectObject(hiddenRoom, true), []);
  const shownRoom = roomGroup(model, '4-1');
  const shownTarget = shownRoom.localToWorld(new THREE.Vector3(2.5, 0.44, 1.9));
  raycaster.set(shownTarget.clone().add(new THREE.Vector3(0, 3, 0)), new THREE.Vector3(0, -1, 0));
  shownRoom.visible = false;
  assert.deepEqual(raycaster.intersectObject(shownRoom, true), []);
  shownRoom.visible = true;
  model.group.visible = false;
  assert.deepEqual(raycaster.intersectObjects(model.pickables, true), []);
});

test('floor slabs leave a real open atrium instead of a solid central ceiling', () => {
  const model = makeTower();
  model.setState({ mode: 'floor', floor: 6 });
  const slabs = [];
  floorGroup(model, 6).traverse(object => {
    if (object.userData.role === 'slab') slabs.push(object);
  });
  const raycaster = new THREE.Raycaster(new THREE.Vector3(0, 5, 0), new THREE.Vector3(0, -1, 0));
  assert.deepEqual(raycaster.intersectObjects(slabs), []);
  raycaster.set(new THREE.Vector3(7, 5, 0), new THREE.Vector3(0, -1, 0));
  assert.ok(raycaster.intersectObjects(slabs).length > 0);
});

test('invalid state fails explicitly and atomically before scene mutation', () => {
  const model = makeTower();
  model.setState({ mode: 'exploded', floor: 8, roomId: '8-2', relatedFloors: [3], routeFloors: [8, 12] });
  const before = snapshot(model);
  const invalidStates = [
    [null, TypeError, /state/i],
    [[], TypeError, /state/i],
    [{ mode: 'orbit', floor: 1 }, RangeError, /mode/i],
    [{ floor: 1 }, RangeError, /mode/i],
    ...[null, undefined, 0, 17, 1.5, '1', NaN, Infinity].map(floor =>
      [{ mode: 'tower', floor }, RangeError, /floor/i]),
    [{ mode: 'floor', floor: 1, roomId: 'missing' }, RangeError, /room/i],
    [{ mode: 'floor', floor: 1, roomId: '2-1' }, RangeError, /belong/i],
    [{ mode: 'floor', floor: 1, roomId: 1 }, TypeError, /roomId/i],
    [{ mode: 'tower', floor: 1, relatedFloors: null }, TypeError, /relatedFloors/i],
    [{ mode: 'tower', floor: 1, relatedFloors: [2, 17] }, RangeError, /floor/i],
    [{ mode: 'tower', floor: 1, routeFloors: '1,2' }, TypeError, /routeFloors/i],
    [{ mode: 'tower', floor: 1, routeFloors: ['2'] }, RangeError, /floor/i],
  ];
  for (const [state, ErrorType, message] of invalidStates) {
    assert.throws(() => model.setState(state), error => error instanceof ErrorType && message.test(error.message));
    assert.deepEqual(snapshot(model), before);
  }
  for (const number of [0, 17, null, undefined, '3', 2.2, NaN]) {
    assert.throws(() => model.getFloorPosition(number), RangeError);
  }
});

test('construction validates floor count, numbering and unique room slots/IDs', () => {
  assert.throws(() => createKnowledgeTower(THREE, FLOORS.slice(1)), /16 floors/);
  const duplicateFloor = FLOORS.map(floor => ({ ...floor }));
  duplicateFloor[15].number = 1;
  assert.throws(() => createKnowledgeTower(THREE, duplicateFloor), /Duplicate floor/);
  const invalidRooms = FLOORS.map(floor => ({ ...floor, rooms: floor.rooms.map(room => ({ ...room })) }));
  invalidRooms[0].rooms[3].index = 0;
  assert.throws(() => createKnowledgeTower(THREE, invalidRooms), /Duplicate room/);
  invalidRooms[0].rooms[3].index = 3;
  invalidRooms[1].rooms[0].id = '1-1';
  assert.throws(() => createKnowledgeTower(THREE, invalidRooms), /Duplicate room/);
});

test('front plaza reserves clear fountain and small-assistant footprints for host-owned assets', () => {
  const model = makeTower();
  const zones = model.group.userData.plazaAssetReservations;
  assert.deepEqual(zones, {
    fountain: { position: [-10.7, 0.5, 11.4], radius: 2.2 },
    assistant: { position: [10, 0.5, 11], radius: 1.2 },
  });
  assert.ok(Math.hypot(zones.fountain.position[0], zones.fountain.position[2]) + zones.fountain.radius < 18);
  assert.equal(model.group.getObjectByName('plaza-wayfinding-1'), undefined);
  assert.equal(model.group.getObjectByName('plaza-wayfinding-4'), undefined);
  for (const mode of ['tower', 'exploded', 'floor']) {
    model.setState({ mode, floor: 1 });
    for (const [name, { position: [x, y, z], radius }] of Object.entries(zones)) {
      model.group.traverse(object => {
        if (!object.isMesh || !visibleThroughAncestors(object)) return;
        const bounds = new THREE.Box3().setFromObject(object);
        // Ground/inlays below the asset base and overhead architecture above
        // 3 m do not obstruct the reserved standing space.
        if (bounds.max.y <= y || bounds.min.y >= 3) return;
        const nearestX = THREE.MathUtils.clamp(x, bounds.min.x, bounds.max.x);
        const nearestZ = THREE.MathUtils.clamp(z, bounds.min.z, bounds.max.z);
        assert.ok(Math.hypot(nearestX - x, nearestZ - z) >= radius,
          `${mode}: ${object.name} clears ${name}`);
      });
    }
  }
  const hostDecor = new THREE.Group();
  hostDecor.name = 'host-async-plaza-decor';
  hostDecor.position.set(...zones.fountain.position);
  model.group.add(hostDecor);
  model.setState({ mode: 'exploded', floor: 7 });
  model.setLearning({ occupants: sampleOccupants });
  model.setState({ mode: 'floor', floor: 7 });
  assert.equal(hostDecor.parent, model.group, 'Host retains ownership and floor-mode visibility control');
  assert.deepEqual(hostDecor.position.toArray(), zones.fountain.position);
  assert.equal(hostDecor.visible, true);
  assert.ok(model.group.getObjectByName('learner-my-avatar'), 'Assistant decor does not replace human learners');
});

test('parent setState then setLearning sequence preserves exact empty/single/multiple occupancy within budget', t => {
  const model = makeTower();
  const me = { id: 'me', floor: 7, roomId: null, color: '#ffd37d' };
  const states = [
    { mode: 'tower', floor: 1, roomId: '1-1' },
    { mode: 'exploded', floor: 7, roomId: '7-2' },
    { mode: 'floor', floor: 16, roomId: '16-4' },
  ];
  // Ending with [] verifies removal of prior people, not just an empty default.
  for (const occupants of [[], [me], sampleOccupants, []]) {
    const learning = { heatmap: true, mastery: { '1-1': 12, '16-4': 98 }, occupants, passedFloors: [16] };
    for (const state of states) {
      model.setState(state);
      model.setLearning(learning);
      const ids = [];
      model.group.traverse(object => {
        if (object.isGroup && object.userData.role === 'learner') ids.push(object.userData.learnerId);
      });
      assert.deepEqual(ids.sort(), occupants.map(person => person.id).sort(), 'No synthetic progress/peer people');
      assert.equal(roomGroup(model, state.roomId).getObjectByName('gallery-selection-rim').visible, true);
      assert.equal(roomGroup(model, '1-1').userData.masteryColor, '#e77b78');
      assert.equal(roomGroup(model, '16-4').userData.masteryColor, '#7baff5');
      const anchor = model.getCheckpointPosition(state.floor);
      assert.ok(anchor.distanceTo(floorGroup(model, state.floor).localToWorld(new THREE.Vector3(0, 2.95, 6.8))) < 1e-8);
      assert.equal(floorGroup(model, 16).getObjectByName('checkpoint-16').userData.passed, true);
      const before = snapshot(model);
      model.setState(state);
      model.setLearning(learning);
      assert.deepEqual(snapshot(model), before, 'Parent refresh order is idempotent');
    }
    let meshes = 0, triangles = 0;
    const geometries = new Set();
    // Count the entire tower, including hidden floors, not just the current view.
    model.group.traverse(object => {
      if (!object.isMesh) return;
      meshes++;
      geometries.add(object.geometry);
      triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3;
    });
    assert.ok(meshes <= 4000, `${occupants.length} occupants: ${meshes} meshes`);
    assert.ok(triangles < 250000, `${occupants.length} occupants: ${triangles} triangles`);
    assert.equal(geometries.size, 5);
    t.diagnostic(`Procedural only, ${occupants.length} occupants: ${meshes} meshes; ${triangles} triangles; ${geometries.size} shared geometries (host GLBs excluded)`);
  }
});
