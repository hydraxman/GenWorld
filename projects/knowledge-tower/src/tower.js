import { addSemanticExhibit, EXHIBIT_DESCRIPTIONS } from './exhibits.js';

/**
 * Procedural, DOM-free knowledge tower. Coordinates are metres; +Z is the open
 * front. Each pickable is a room Group containing visible, metadata-bearing
 * meshes. No invisible proxy geometry is used for picking.
 *
 * setState is a complete state replacement (not a patch). Floor numbers are
 * integers 1..16, and roomId must belong to the selected floor. Validation
 * completes before any scene mutation. setLearning is an independent complete
 * replacement of learning overlays; changing the view never clears learning.
 * Materials/geometries are owned by this model and shared within it; a host
 * disposing the model should deduplicate them. No DOM, texture or asset loading.
 */
export function createKnowledgeTower(THREE, floors) {
  const count = 16;
  const towerSpacing = 3.6;
  const explodedSpacing = 6.4;
  const baseY = 1.15;
  const centres = [[-5.8, -4.5], [5.8, -4.5], [-5.8, 4.5], [5.8, 4.5]];
  if (!Array.isArray(floors) || floors.length !== count) {
    throw new TypeError('floors must contain exactly 16 floors');
  }
  const floorData = new Map();
  const roomData = new Map();
  function requireFloor(number) {
    if (!Number.isInteger(number) || number < 1 || number > count) {
      throw new RangeError(`Invalid floor number: ${String(number)}; expected 1..16`);
    }
    return number;
  }
  for (const floor of floors) {
    if (!floor || typeof floor !== 'object') throw new TypeError('Invalid floor definition');
    requireFloor(floor.number);
    if (floorData.has(floor.number)) throw new RangeError(`Duplicate floor: ${floor.number}`);
    if (typeof floor.title !== 'string' || typeof floor.color !== 'string' ||
        !Array.isArray(floor.rooms) || floor.rooms.length !== 4) {
      throw new TypeError(`Floor ${floor.number} needs title, color and four rooms`);
    }
    const indices = new Set();
    for (const room of floor.rooms) {
      if (!room || typeof room.id !== 'string' || !room.id ||
          typeof room.name !== 'string' || !Number.isInteger(room.index) ||
          room.index < 0 || room.index > 3) {
        throw new TypeError(`Invalid room definition on floor ${floor.number}`);
      }
      if (indices.has(room.index) || roomData.has(room.id)) {
        throw new RangeError(`Duplicate room index or id: ${room.id}`);
      }
      indices.add(room.index);
      roomData.set(room.id, floor.number);
    }
    floorData.set(floor.number, floor);
  }

  const group = new THREE.Group();
  group.name = 'knowledge-tower';
  // Host-owned async CC0 decor attaches to group, not to a gallery/learner.
  // The fountain is offset slightly forward/inward from (-11, 11) to clear
  // the ground-floor limestone fascia while staying on the 18 m plaza.
  // Positions/radii are tower-local metres; no placeholder meshes or loaders.
  group.userData.plazaAssetReservations = {
    fountain: { position: [-10.7, 0.5, 11.4], radius: 2.2 },
    assistant: { position: [10, 0.5, 11], radius: 1.2 },
  };
  const pickables = [];
  const levels = new Map();
  const geometries = {
    box: new THREE.BoxGeometry(1, 1, 1),
    cylinder: new THREE.CylinderGeometry(1, 1, 1, 16),
    sphere: new THREE.SphereGeometry(1, 10, 6),
    ring: new THREE.TorusGeometry(1, 0.045, 6, 24),
    cone: new THREE.ConeGeometry(1, 1, 8),
  };
  const material = (color, options = {}) => new THREE.MeshStandardMaterial({
    color, roughness: 0.58, metalness: 0.18, ...options,
  });
  const steel = material('#4b443a', { metalness: 0.72, roughness: 0.4 });
  const dark = material('#283c40', { metalness: 0.35 });
  const pale = material('#eee7d6', { roughness: 0.82, metalness: 0.04 });
  const wood = material('#b38b61', { roughness: 0.83, metalness: 0.02 });
  const foliage = material('#488e72', { roughness: 0.9 });
  const light = material('#ffdf9c', { emissive: '#ffda93', emissiveIntensity: 0.65, metalness: 0.1 });
  const glass = material('#64bdb3', {
    transparent: true, opacity: 0.23, depthWrite: false,
    roughness: 0.22, metalness: 0.12, side: THREE.DoubleSide,
  });
  const coreGlass = material('#3fd0c4', {
    transparent: true, opacity: 0.22, depthWrite: false, roughness: 0.25,
  });
  const gold = new THREE.Color('#ffd37d');
  const relatedColor = new THREE.Color('#65ebe4');
  const routeColor = new THREE.Color('#c4a1ff');
  const slabColor = new THREE.Color('#e9e1d0');
  const checkpointAmber = '#e8b96a';
  const checkpointGreen = '#59cdb7';
  const learners = new Map();
  const learnerMaterials = new Map();
  let selectedRoomId = null;
  let learning = { heatmap: false, mastery: new Map(), passedFloors: new Set() };

  function mesh(parent, name, geometry, mat, position, scale, castsShadow = false) {
    const object = new THREE.Mesh(geometry, mat);
    object.name = name;
    object.position.set(...position);
    object.scale.set(...scale);
    object.castShadow = castsShadow;
    object.receiveShadow = castsShadow;
    parent.add(object);
    return object;
  }
  const box = (parent, name, mat, position, scale, shadow = false) =>
    mesh(parent, name, geometries.box, mat, position, scale, shadow);
  const cylinder = (parent, name, mat, position, radius, height, shadow = false) =>
    mesh(parent, name, geometries.cylinder, mat, position, [radius, height, radius], shadow);

  // Three's stock Mesh.raycast does not test ancestor visibility. Enforce it on
  // room meshes, even if the host passes all 64 groups to intersectObjects.
  function visibleRoomRaycast(raycaster, intersections) {
    for (let ancestor = this; ancestor; ancestor = ancestor.parent) {
      if (!ancestor.visible) return;
    }
    THREE.Mesh.prototype.raycast.call(this, raycaster, intersections);
  }

  const plaza = new THREE.Group();
  plaza.name = 'layered-circular-plaza';
  group.add(plaza);
  cylinder(plaza, 'plaza-foundation', pale, [0, -0.18, 0], 18, 0.36);
  cylinder(plaza, 'plaza-middle-step', steel, [0, 0.04, 0], 16.7, 0.08);
  cylinder(plaza, 'plaza-upper-step', pale, [0, 0.18, 0], 15.5, 0.2);
  const plazaRing = mesh(plaza, 'plaza-knowledge-cycle', geometries.ring,
    material('#b69d61', { metalness: 0.7 }), [0, 0.36, 0], [16, 16, 16]);
  plazaRing.rotation.x = Math.PI / 2;
  // A scaled torus would also scale its tube thickness. Flatten just the tube
  // vertically so it reads as an inlaid architectural ring rather than a wall.
  plazaRing.scale.z = 0.4;
  // Front corners remain visually quiet for the host's fountain and small
  // robot assistant. Keep wayfinding inlays only at the rear plaza corners.
  for (const i of [1, 2]) {
    const angle = Math.PI / 4 + i * Math.PI / 2;
    const spoke = box(plaza, `plaza-wayfinding-${i + 1}`, steel,
      [Math.sin(angle) * 14.2, 0.35, Math.cos(angle) * 14.2], [0.22, 0.035, 3]);
    spoke.rotation.y = angle;
  }
  for (let i = 0; i < 4; i++) {
    box(plaza, `entry-step-${i}`, pale, [0, 0.35 + i * 0.21, 12.1 - i * 0.63],
      [5.7, 0.2, 1.1], true);
  }
  for (const x of [-2.8, 2.8]) {
    box(plaza, 'entry-canopy-post', steel, [x, 1.98, 10.1], [0.12, 3.3, 0.12]);
    cylinder(plaza, 'entry-planter', pale, [x * 2.5, 0.64, 11], 0.72, 0.7);
    mesh(plaza, 'entry-topiary', geometries.sphere, foliage, [x * 2.5, 1.5, 11], [0.75, 0.85, 0.75], true);
  }
  box(plaza, 'entry-canopy', pale, [0, 3.6, 10.15], [6.6, 0.22, 2.5], true);
  box(plaza, 'entry-canopy-recessed-light', light, [0, 3.47, 10.9], [5.5, 0.035, 0.06]);

  const structure = new THREE.Group();
  structure.name = 'global-structure';
  group.add(structure);
  const verticalMembers = [];
  for (const x of [-10.5, 10.5]) {
    for (const z of [-8.5, 8.5]) {
      verticalMembers.push(box(structure, `corner-column-${x}-${z}`, steel,
        [x, 0, z], [0.3, 1, 0.3]));
    }
  }
  const shaft = new THREE.Group();
  shaft.name = 'core-shaft';
  structure.add(shaft);
  for (const x of [-1.7, 1.7]) {
    for (const z of [-1.7, 1.7]) {
      verticalMembers.push(box(shaft, `core-mullion-${x}-${z}`, steel,
        [x, 0, z], [0.12, 1, 0.12]));
    }
  }
  verticalMembers.push(box(shaft, 'core-rear-glass', coreGlass, [0, 0, -1.7], [3.3, 1, 0.06]));
  for (const x of [-1.7, 1.7]) {
    verticalMembers.push(box(shaft, `core-side-glass-${x}`, coreGlass, [x, 0, 0], [0.06, 1, 3.3]));
  }

  const crown = new THREE.Group();
  crown.name = 'roof-crown-pavilion';
  structure.add(crown);
  box(crown, 'crown-limestone-eave', pale, [0, 0, 0], [22.6, 0.32, 18.5], true);
  for (const x of [-3.8, 3.8]) for (const z of [-2.5, 2.5]) {
    box(crown, 'pavilion-bronze-post', steel, [x, 0.8, z], [0.12, 1.6, 0.12]);
  }
  box(crown, 'pavilion-floating-roof', pale, [0, 1.65, 0], [8.8, 0.18, 6.3], true);
  box(crown, 'pavilion-lantern', coreGlass, [0, 0.8, -2.5], [7.5, 1.4, 0.08]);
  box(crown, 'crown-sign-warm-inlay', light, [0, 1.1, 2.56], [4.2, 0.16, 0.06]);
  for (let i = 0; i < 5; i++) {
    box(crown, `knowledge-sign-bar-${i}`, light, [-1.2 + i * 0.6, 0.65, 2.56],
      [0.18, 0.3 + (2 - Math.abs(i - 2)) * 0.12, 0.06]);
  }

  for (let number = 1; number <= count; number++) {
    const floor = floorData.get(number);
    const level = new THREE.Group();
    level.name = `floor-${number}`;
    level.userData = { role: 'floor', floorNumber: number, title: floor.title };
    group.add(level);
    const slabMaterial = material(slabColor, {
      emissive: '#244958', emissiveIntensity: 0.025, roughness: 0.8, metalness: 0.08,
    });
    const bandMaterial = material(floor.color, { emissive: floor.color, emissiveIntensity: 0.12 });
    // Four panels form a genuinely open 4 x 4 central atrium.
    for (const z of [-5.5, 5.5]) {
      const slab = box(level, `slab-${number}-z${z}`, slabMaterial, [0, 0.15, z], [22, 0.3, 7], true);
      slab.userData.role = 'slab';
    }
    for (const x of [-6.5, 6.5]) {
      const slab = box(level, `slab-${number}-x${x}`, slabMaterial, [x, 0.15, 0], [9, 0.3, 4], true);
      slab.userData.role = 'slab';
    }
    // Deep limestone fascia, setback shadow lines and cornices give the floors
    // architectural depth, without adding an opaque roof over each exhibition.
    for (const z of [-8.98, 8.98]) {
      box(level, 'limestone-fascia', pale, [0, 0.04, z], [22.15, 0.4, 0.22], true);
      box(level, 'fascia-shadow-reveal', steel, [0, 0.29, z], [21.9, 0.055, 0.06]);
    }
    box(level, 'floor-color-band', bandMaterial, [0, 0.17, 9.03], [22, 0.13, 0.08]);
    const related = box(level, 'prerequisite-accent',
      material(relatedColor, { emissive: relatedColor, emissiveIntensity: 0.25 }),
      [-5.6, 0.35, 9.06], [9.6, 0.07, 0.08]);
    const route = box(level, 'route-accent',
      material(routeColor, { emissive: routeColor, emissiveIntensity: 0.25 }),
      [5.6, 0.35, 9.06], [9.6, 0.07, 0.08]);
    for (const x of [-5.8, 5.8]) {
      box(level, `rear-glass-${x}`, glass, [x, 1.5, -8.82], [9.2, 2.15, 0.07]);
    }
    for (const x of [-10.75, 10.75]) {
      box(level, `side-glass-${x}`, glass, [x, 1.2, -3.6], [0.07, 1.6, 9.5]);
      box(level, `side-frame-${x}`, steel, [x, 3.05, 0], [0.2, 0.22, 17.6]);
      box(level, `side-rail-${x}`, steel, [x, 1.02, 0], [0.09, 0.08, 17.6]);
      box(level, 'limestone-side-eave', pale, [x, 3.23, 0], [0.4, 0.24, 17.9], true);
      for (const z of [-8.45, -2.8, 2.8, 8.45]) {
        box(level, 'bronze-facade-mullion', steel, [x, 1.75, z], [0.11, 2.9, 0.11]);
      }
      box(level, 'warm-recessed-cove', light, [x * 0.97, 3.08, 0], [0.045, 0.035, 17]);
    }
    box(level, 'rear-frame', steel, [0, 3.05, -8.8], [21.5, 0.22, 0.2]);
    box(level, 'rear-limestone-cornice', pale, [0, 3.23, -8.8], [22, 0.24, 0.4], true);
    for (const x of [-7.2, 7.2]) {
      box(level, `front-open-rail-${x}`, steel, [x, 1.02, 8.8], [6.1, 0.08, 0.09]);
    }
    // Central front and rear circulation stays open: no partition through the
    // checkpoint, elevator landing or stair. Low crosswalls frame the galleries.
    for (const x of [-6.4, 6.4]) {
      box(level, `low-partition-x${x}`, wood, [x, 0.53, 0], [8.4, 0.46, 0.14]);
    }
    for (const x of [-10.5, 10.5]) {
      for (const z of [-8.5, 8.5]) {
        box(level, `column-collar-${x}-${z}`, steel, [x, 0.37, z], [0.5, 0.14, 0.5]);
      }
    }
    for (const x of [-2.1, 2.1]) {
      box(level, 'atrium-glass-balustrade', glass, [x, 0.83, 0], [0.05, 0.95, 4.1]);
      box(level, 'atrium-bronze-handrail', steel, [x, 1.33, 0], [0.08, 0.07, 4.2]);
    }
    for (const z of [-2.1, 2.1]) {
      box(level, 'atrium-glass-balustrade', glass, [0, 0.83, z], [4.1, 0.95, 0.05]);
      box(level, 'atrium-bronze-handrail', steel, [0, 1.33, z], [4.2, 0.07, 0.08]);
    }
    box(level, 'elevator-landing', wood, [0, 0.34, -2.7], [3.3, 0.08, 1.1]);
    box(level, 'elevator-call-column', steel, [1.5, 0.9, -2.8], [0.14, 1.2, 0.14]);
    box(level, 'elevator-call-light', light, [1.5, 1.18, -2.7], [0.07, 0.09, 0.04]);
    const stair = new THREE.Group();
    stair.name = 'inter-floor-stair';
    stair.position.set(0, 0.3, -3.2);
    level.add(stair);
    if (number < count) {
      for (let step = 0; step < 18; step++) {
        box(stair, `stair-tread-${step}`, pale,
          [0, (step + 1) * 3.6 / 18 - 0.07, -step * 0.29], [1.7, 0.14, 0.33], true);
      }
      for (const x of [-0.88, 0.88]) {
        const rail = box(stair, 'stair-ascending-handrail', steel,
          [x, 2.6, -2.47], [0.055, 0.055, Math.hypot(3.4, 4.94)]);
        rail.rotation.x = Math.atan2(3.4, 4.94);
      }
    }

    const checkpoint = new THREE.Group();
    checkpoint.name = `checkpoint-${number}`;
    checkpoint.position.set(0, 0.3, 6.8);
    checkpoint.userData = { role: 'checkpoint', floorNumber: number, passed: false };
    level.add(checkpoint);
    const checkpointMaterial = material(checkpointAmber, {
      emissive: checkpointAmber, emissiveIntensity: 0.35, roughness: 0.4,
    });
    for (const x of [-1.12, 1.12]) {
      box(checkpoint, 'checkpoint-bronze-jamb', steel, [x, 1.08, 0], [0.16, 2.16, 0.24], true);
      box(checkpoint, 'checkpoint-status-light', checkpointMaterial, [x * 0.91, 1.08, 0.14], [0.045, 2.06, 0.035]);
    }
    for (const x of [-0.96, 0.96]) {
      const shoulder = box(checkpoint, 'checkpoint-arch-shoulder', pale,
        [x, 2.25, 0], [0.48, 0.18, 0.27], true);
      shoulder.rotation.z = x < 0 ? Math.PI / 4 : -Math.PI / 4;
    }
    box(checkpoint, 'checkpoint-lintel', pale, [0, 2.4, 0], [1.65, 0.19, 0.27], true);
    box(checkpoint, 'checkpoint-status', checkpointMaterial, [0, 2.4, 0.16], [1.45, 0.065, 0.035]);
    box(checkpoint, 'checkpoint-threshold', checkpointMaterial, [0, 0.04, 0], [2.2, 0.035, 0.5]);
    checkpoint.traverse(object => {
      if (!object.isMesh) return;
      Object.assign(object.userData, checkpoint.userData);
      object.raycast = visibleRoomRaycast;
    });
    if (number % 4 === 0) {
      for (const x of [-9.65, 9.65]) {
        box(level, 'terrace-planter', pale, [x, 0.62, 7.5], [0.8, 0.6, 1.5], true);
        mesh(level, 'terrace-foliage', geometries.sphere, foliage, [x, 1.18, 7.5], [0.52, 0.6, 0.85], true);
      }
    }

    const rooms = [];
    for (const room of [...floor.rooms].sort((a, b) => a.index - b.index)) {
      const gallery = new THREE.Group();
      gallery.name = `room-${room.id}`;
      gallery.userData = { role: 'room', floorNumber: number, roomId: room.id, title: room.name, mastery: null };
      const [x, z] = centres[room.index];
      gallery.position.set(x, 0, z);
      level.add(gallery);
      const tint = new THREE.Color(floor.color).offsetHSL(room.index * 0.075 - 0.07, 0, 0);
      const deckColor = new THREE.Color('#b38b61').lerp(tint, 0.28);
      const deckMaterial = material(deckColor, { roughness: 0.83, metalness: 0.02, emissive: tint, emissiveIntensity: 0.025 });
      const rimMaterial = material(tint, { emissive: tint, emissiveIntensity: 0.09 });
      const selectionMaterial = material(gold, { emissive: gold, emissiveIntensity: 0.45 });
      box(gallery, 'gallery-deck', deckMaterial, [0, 0.37, 0], [7.6, 0.14, 5.8], true);
      box(gallery, 'gallery-front-inlay', rimMaterial, [0, 0.45, 2.87], [7.4, 0.035, 0.065]);
      box(gallery, 'gallery-side-inlay', rimMaterial, [-3.72, 0.45, 0], [0.065, 0.035, 5.7]);
      const selection = new THREE.Group();
      selection.name = 'gallery-selection-rim';
      gallery.add(selection);
      for (const z of [-2.92, 2.92]) box(selection, 'selected-rim', selectionMaterial, [0, 0.47, z], [7.7, 0.025, 0.025]);
      for (const x of [-3.84, 3.84]) box(selection, 'selected-rim', selectionMaterial, [x, 0.47, 0], [0.025, 0.025, 5.84]);
      cylinder(gallery, 'pedestal-foot', rimMaterial, [0, 0.49, 0], 1.45, 0.08);
      cylinder(gallery, 'pedestal-stem', steel, [0, 0.72, 0], 0.18, 0.4);
      box(gallery, 'exhibit-table', pale,
        [0, 0.99, 0], [3.55, 0.16, 2.85], true);
      // Benches and a reading shelf live outside the sculpture/picking centre.
      box(gallery, 'reading-bench-seat', wood, [2.85, 0.72, -0.2], [0.6, 0.15, 1.8], true);
      box(gallery, 'reading-bench-base', steel, [2.85, 0.57, -0.2], [0.35, 0.25, 1.5]);
      box(gallery, 'reading-shelf', wood, [-2.75, 1.05, -1.7], [1.35, 0.12, 0.5]);
      box(gallery, 'reading-shelf-leg', steel, [-2.75, 0.73, -1.7], [0.15, 0.6, 0.3]);
      for (let book = 0; book < 3; book++) {
        box(gallery, `reference-book-${book}`, book % 2 ? pale : rimMaterial,
          [-3.1 + book * 0.28, 1.3, -1.7], [0.18, 0.36 + book * 0.06, 0.34]);
      }
      const description = EXHIBIT_DESCRIPTIONS[`${number}-${room.index + 1}`];
      const exhibit = addSemanticExhibit(THREE, gallery, description, {
        box, cylinder, mesh, geometries, material, steel, dark, pale, tint,
      });
      // The semantic slot follows curriculum order; custom valid room IDs still
      // retain their own picking identity.
      exhibit.userData.roomId = room.id;
      gallery.traverse(object => {
        if (!object.isMesh) return;
        object.userData.floorNumber = number;
        object.userData.roomId = room.id;
        object.raycast = visibleRoomRaycast;
      });
      pickables.push(gallery);
      rooms.push({ gallery, deckMaterial, deckColor, rimMaterial, tint, selection });
    }
    levels.set(number, {
      level, slabMaterial, bandMaterial, floorColor: new THREE.Color(floor.color),
      related, route, rooms, stair, checkpoint, checkpointMaterial,
    });
  }

  function validateFloorList(list, name) {
    if (!Array.isArray(list)) throw new TypeError(`${name} must be an array of floor numbers`);
    for (const number of list) requireFloor(number);
    return new Set(list);
  }

  function masteryColor(value) {
    return value === null ? '#65778d' : value < 40 ? '#e77b78' :
      value < 70 ? '#e8b96a' : value < 85 ? '#59cdb7' : '#7baff5';
  }

  function refreshLearningAppearance() {
    for (const [number, entry] of levels) {
      const passed = learning.passedFloors.has(number);
      const color = passed ? checkpointGreen : checkpointAmber;
      entry.checkpointMaterial.color.set(color);
      entry.checkpointMaterial.emissive.set(color);
      entry.checkpoint.traverse(object => {
        object.userData.passed = passed;
      });
      for (const room of entry.rooms) {
        const value = learning.mastery.get(room.gallery.userData.roomId) ?? null;
        const color = masteryColor(value);
        room.gallery.userData.mastery = value;
        room.gallery.userData.masteryColor = color;
        room.deckMaterial.color.copy(room.deckColor);
        room.rimMaterial.color.copy(room.tint);
        if (learning.heatmap) {
          room.deckMaterial.color.set(color);
          room.rimMaterial.color.set(color);
        }
        // Gold is a separate hairline around the room, never its score surface.
        room.selection.visible = room.gallery.userData.roomId === selectedRoomId;
        room.deckMaterial.emissive.copy(room.deckMaterial.color);
        room.deckMaterial.emissiveIntensity = 0.025;
        room.rimMaterial.emissive.copy(room.rimMaterial.color);
        room.rimMaterial.emissiveIntensity = learning.heatmap ? 0.18 : 0.09;
      }
    }
  }

  function requireRecord(value, label) {
    if (!value || typeof value !== 'object' ||
        ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
      throw new TypeError(`${label} must be a plain object`);
    }
  }

  // Three accepts invalid styles with only a console warning. Validate supported
  // CSS colours first so an invalid learner cannot silently become white.
  function parseLearnerColor(value) {
    if (typeof value !== 'string') throw new TypeError('occupant color must be a CSS color string');
    const text = value.trim().toLowerCase();
    let valid = /^#(?:[\da-f]{3}|[\da-f]{6})$/.test(text) ||
      Object.hasOwn(THREE.Color.NAMES, text);
    const rgb = text.match(/^rgb\(\s*(\d+%?)\s*,\s*(\d+%?)\s*,\s*(\d+%?)\s*\)$/);
    if (rgb) {
      const percent = rgb[1].endsWith('%');
      valid = rgb.slice(1).every(channel => channel.endsWith('%') === percent &&
        Number.parseInt(channel, 10) <= (percent ? 100 : 255));
    }
    const hsl = text.match(/^hsl\(\s*([+-]?\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)%\s*,\s*(\d+(?:\.\d+)?)%\s*\)$/);
    if (hsl) valid = Number.isFinite(Number(hsl[1])) && Number(hsl[2]) <= 100 && Number(hsl[3]) <= 100;
    if (!valid) throw new RangeError(`Invalid occupant color: ${value}`);
    return new THREE.Color(text);
  }

  /**
   * Independent complete replacement. Missing rooms are unknown (null), NOT 0.
   * Occupants are positions, not mastery/level thresholds; the host supplies the
   * personal avatar's gold colour and any peer profiles. No synthetic students.
   * CSS colours: #RGB, #RRGGBB, named colours, comma rgb()/hsl().
   */
  function setLearning(input = {}) {
    requireRecord(input, 'Learning state');
    const { heatmap = false, mastery = {}, occupants = [], passedFloors = [] } = input;
    if (typeof heatmap !== 'boolean') throw new TypeError('heatmap must be boolean');
    requireRecord(mastery, 'mastery');
    const nextMastery = new Map();
    for (const id of Reflect.ownKeys(mastery)) {
      if (typeof id !== 'string' || !roomData.has(id)) throw new RangeError(`Unknown mastery room: ${String(id)}`);
      const value = mastery[id];
      if (value !== null && (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100)) {
        throw new RangeError(`mastery for ${id} must be null or a number in 0..100`);
      }
      nextMastery.set(id, value);
    }
    const passed = validateFloorList(passedFloors, 'passedFloors');
    if (!Array.isArray(occupants)) throw new TypeError('occupants must be an array');
    const ids = new Set();
    const profiles = [];
    for (const occupant of occupants) {
      requireRecord(occupant, 'occupant');
      const { id, floor, roomId, color } = occupant;
      if (typeof id !== 'string' || !id.trim()) throw new TypeError('occupant id must be a non-empty string');
      if (ids.has(id)) throw new RangeError(`Duplicate occupant id: ${id}`);
      ids.add(id);
      requireFloor(floor);
      if (roomId !== null) {
        if (typeof roomId !== 'string') throw new TypeError('occupant roomId must be a string or null');
        if (!roomData.has(roomId)) throw new RangeError(`Unknown occupant room: ${roomId}`);
        if (roomData.get(roomId) !== floor) throw new RangeError(`Occupant room ${roomId} does not belong to floor ${floor}`);
      }
      profiles.push({ id, floor, roomId, color: parseLearnerColor(color) });
    }
    profiles.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    // All validation above completes before materials, scene, or stored state
    // change. Copy scalar values; future caller edits cannot modify the model.
    learning = { heatmap, mastery: nextMastery, passedFloors: passed };
    for (const learner of learners.values()) learner.removeFromParent();
    learners.clear();
    const clusters = new Map();
    for (const profile of profiles) {
      const key = `${profile.floor}:${profile.roomId ?? ''}`;
      if (!clusters.has(key)) clusters.set(key, []);
      clusters.get(key).push(profile);
    }
    for (const cluster of clusters.values()) cluster.forEach((profile, index) => {
      const entry = levels.get(profile.floor);
      const learner = new THREE.Group();
      learner.name = `learner-${profile.id}`;
      learner.userData = {
        role: 'learner', learnerId: profile.id, floorNumber: profile.floor, roomId: profile.roomId,
      };
      if (profile.roomId !== null) {
        const room = entry.rooms.find(room => room.gallery.userData.roomId === profile.roomId);
        // Small groups occupy the front corners, not sculpture/table centres.
        const t = cluster.length === 1 ? 0 : index / (cluster.length - 1);
        learner.position.set(room.gallery.position.x - 2.9 + t * 5.8, 0.45, room.gallery.position.z + 2.05);
      } else {
        learner.position.set(cluster.length === 1 ? 3.2 : -8.8 + index * 17.6 / (cluster.length - 1), 0.31, 7.85);
      }
      // These are siblings of galleries, never members of room pickables.
      entry.level.add(learner);
      const key = profile.color.getHexString();
      if (!learnerMaterials.has(key)) learnerMaterials.set(key, material(profile.color, {
        emissive: profile.color, emissiveIntensity: 0.12, roughness: 0.68,
      }));
      const coat = learnerMaterials.get(key);
      const halo = mesh(learner, 'learner-halo', geometries.ring, coat, [0, 0.03, 0], [0.43, 0.43, 0.43]);
      halo.rotation.x = Math.PI / 2;
      for (const x of [-0.09, 0.09]) {
        cylinder(learner, 'learner-leg', dark, [x, 0.23, 0], 0.065, 0.4);
      }
      box(learner, 'learner-coat', coat, [0, 0.62, 0], [0.38, 0.42, 0.25], true);
      for (const x of [-0.25, 0.25]) {
        const arm = box(learner, 'learner-arm', coat, [x, 0.61, 0], [0.085, 0.36, 0.12]);
        arm.rotation.z = x < 0 ? -0.16 : 0.16;
      }
      mesh(learner, 'learner-head', geometries.sphere, pale, [0, 0.99, 0], [0.15, 0.17, 0.15], true);
      cylinder(learner, 'learner-vertical-pin', coat, [0, 1.53, 0], 0.022, 0.56);
      mesh(learner, 'learner-pin-cap', geometries.sphere, coat, [0, 1.84, 0], [0.07, 0.07, 0.07]);
      learner.traverse(object => {
        if (!object.isMesh) return;
        Object.assign(object.userData, learner.userData);
        object.raycast = visibleRoomRaycast;
      });
      learners.set(profile.id, learner);
    });
    refreshLearningAppearance();
    group.updateWorldMatrix(true, true);
  }

  function setState(state) {
    if (!state || typeof state !== 'object' || Array.isArray(state)) {
      throw new TypeError('Tower state must be an object');
    }
    const { mode, floor, roomId = null, relatedFloors = [], routeFloors = [] } = state;
    if (!['tower', 'exploded', 'floor'].includes(mode)) {
      throw new RangeError(`Invalid mode: ${String(mode)}; expected tower, exploded or floor`);
    }
    requireFloor(floor);
    if (roomId !== null) {
      if (typeof roomId !== 'string') throw new TypeError('roomId must be a string or null');
      if (!roomData.has(roomId)) throw new RangeError(`Unknown room: ${roomId}`);
      if (roomData.get(roomId) !== floor) {
        throw new RangeError(`Room ${roomId} does not belong to floor ${floor}`);
      }
    }
    const prerequisites = validateFloorList(relatedFloors, 'relatedFloors');
    const routeSet = validateFloorList(routeFloors, 'routeFloors');
    const spacing = mode === 'exploded' ? explodedSpacing : towerSpacing;
    selectedRoomId = roomId;
    for (const [number, entry] of levels) {
      const selected = number === floor;
      entry.level.position.y = mode === 'floor' && selected ? 0.8 : baseY + (number - 1) * spacing;
      entry.level.visible = mode !== 'floor' || selected;
      entry.related.visible = prerequisites.has(number);
      entry.route.visible = routeSet.has(number);
      entry.slabMaterial.color.copy(selected ? gold.clone().lerp(slabColor, 0.66) : slabColor);
      entry.slabMaterial.emissive.set('#244958');
      entry.slabMaterial.emissiveIntensity = 0.025;
      if (selected || prerequisites.has(number) || routeSet.has(number)) {
        entry.slabMaterial.emissive.copy(selected ? gold : prerequisites.has(number) ? relatedColor : routeColor);
        entry.slabMaterial.emissiveIntensity = selected ? 0.12 : 0.055;
      }
      entry.bandMaterial.color.copy(selected ? gold : entry.floorColor);
      entry.bandMaterial.emissive.copy(selected ? gold : entry.floorColor);
      entry.stair.scale.y = spacing / towerSpacing;
      entry.stair.visible = mode !== 'floor';
    }
    refreshLearningAppearance();
    structure.visible = mode !== 'floor';
    crown.position.y = baseY + (count - 1) * spacing + 3.35;
    plaza.visible = mode !== 'floor';
    const bottom = 0.34;
    const top = baseY + (count - 1) * spacing + 3.2;
    for (const member of verticalMembers) {
      member.position.y = (bottom + top) / 2;
      member.scale.y = top - bottom;
    }
    group.updateWorldMatrix(true, true);
  }

  function getFloorPosition(number) {
    requireFloor(number);
    // Returns a fresh Vector3, including any host/ancestor transform.
    return levels.get(number).level.getWorldPosition(new THREE.Vector3());
  }

  function getCheckpointPosition(number) {
    requireFloor(number);
    // Button anchor above the central arch, away from room labels. localToWorld
    // updates ancestor matrices even if the host has not rendered a frame.
    return levels.get(number).checkpoint.localToWorld(new THREE.Vector3(0, 2.65, 0));
  }

  setState({ mode: 'tower', floor: 1 });
  return { group, pickables, setState, getFloorPosition, setLearning, getCheckpointPosition };
}
