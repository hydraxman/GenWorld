import * as THREE from 'three';
import {RectAreaLightUniformsLib} from 'three/addons/lights/RectAreaLightUniformsLib.js';
import {LABS} from '../../../shared/knowledge-labs/experiments.js';
import {createLabExhibit, disposeExhibitTree} from '../../../shared/knowledge-labs/exhibit.js';
import {createLabUI} from '../../../shared/knowledge-labs/ui.js';
import {setLabViewport} from '../../../shared/knowledge-labs/camera.js';
import {createTeachingSurfaceLibrary} from '../../../shared/knowledge-labs/surfaces.js';
import {ANATOMY_FINISHES as FINISH} from '../../../shared/knowledge-labs/anatomy-finishes.js';

let areaLightsReady = false;

export const SHUNDE_STANDS = Object.freeze([
  {id: 'graph', x: -3.35, z: -2.5},
  {id: 'markov', x: 0, z: -4.15},
  {id: 'list', x: 3.35, z: -2.5},
].map(Object.freeze));
export const SHUNDE_STAND_OBSTACLES = SHUNDE_STANDS.map(({x, z}) => ({min: [x - 1.575, z - 1.025], max: [x + 1.575, z + 1.025]}));

export function createTeachingRoom({labels = typeof document !== 'undefined', kind = 'shunde'} = {}) {
  if (!['shunde', 'jianhua'].includes(kind)) throw new Error(`Unknown interior finish: ${kind}`);
  const shunde = kind === 'shunde', floor = shunde ? .9 : .45;
  const back = shunde ? -5.63 : -7.47, front = shunde ? .64 : -2.12, width = shunde ? 10.98 : 10.5;
  const depth = front - back, center = (front + back) / 2, top = floor + 3.26;
  const room = new THREE.Group();
  room.name = 'illustrative-teaching-room-finishes';
  room.userData = {illustrative: true, interiorKind: kind};
  const stone = new THREE.MeshStandardMaterial({color: '#ddd4c1', roughness: .88});
  const wood = new THREE.MeshStandardMaterial({color: '#99734f', roughness: .8});
  const ceiling = new THREE.MeshStandardMaterial({color: '#eee7d9', roughness: .95});
  const bronze = new THREE.MeshStandardMaterial({color: FINISH.gold, metalness: .65, roughness: .38});
  const recess = new THREE.MeshStandardMaterial({color: FINISH.gunmetal, roughness: .85});
  const light = new THREE.MeshStandardMaterial({color: '#fff1cf', emissive: '#ffda97', emissiveIntensity: .8});
  const geometry = new THREE.BoxGeometry();
  function box(name, material, position, scale, surface) {
    const mesh = new THREE.Mesh(geometry, material); mesh.name = name;
    mesh.position.set(...position); mesh.scale.set(...scale);
    mesh.receiveShadow = true; mesh.castShadow = true;
    mesh.userData.teachingSurface = surface; room.add(mesh); return mesh;
  }
  function repeated(name, material, placements, surface) {
    const mesh = new THREE.InstancedMesh(geometry, material, placements.length);
    const object = new THREE.Object3D();
    for (const [index, [position, scale]] of placements.entries()) {
      object.position.set(...position); object.scale.set(...scale); object.updateMatrix(); mesh.setMatrixAt(index, object.matrix);
    }
    mesh.name = name; mesh.userData.teachingSurface = surface;
    mesh.castShadow = true; mesh.receiveShadow = true; mesh.computeBoundingSphere(); room.add(mesh);
    return mesh;
  }
  const floorMesh = box('inset-teaching-floor', stone, [0, floor + .006, center], [width, .016, depth], 'stone');
  floorMesh.geometry = geometry.clone();
  const uv1 = new Float32Array(floorMesh.geometry.attributes.position.count * 2);
  for (let i = 0; i < uv1.length / 2; i++) {
    uv1[i * 2] = floorMesh.geometry.attributes.position.getX(i) + .5;
    uv1[i * 2 + 1] = floorMesh.geometry.attributes.position.getZ(i) + .5;
  }
  floorMesh.geometry.setAttribute('uv1', new THREE.BufferAttribute(uv1, 2));
  const ao = new Uint8Array(128 * 128 * 4);
  for (let v = 0; v < 128; v++) for (let u = 0; u < 128; u++) {
    const x = ((u + .5) / 128 - .5) * width, z = back + (v + .5) / 128 * depth;
    let shade = .23 * Math.exp(-Math.min(z - back, width / 2 - Math.abs(x)) / .21);
    const supports = shunde ? SHUNDE_STANDS : [{x: -4.3, z: -6.7}, {x: 4.3, z: -6.7}];
    for (const stand of supports) shade += .5 * Math.exp(-((x - stand.x) ** 2 / .8 + (z - stand.z) ** 2 / 1.0) * 1.9);
    const channel = Math.round(255 * Math.max(.22, 1 - shade));
    ao.set([channel, channel, channel, 255], (v * 128 + u) * 4);
  }
  const aoMap = new THREE.DataTexture(ao, 128, 128);
  aoMap.name = 'Interior static contact occlusion'; aoMap.channel = 1;
  aoMap.minFilter = aoMap.magFilter = THREE.LinearFilter; aoMap.needsUpdate = true;
  stone.aoMap = aoMap; stone.aoMapIntensity = .8;
  const seams = [];
  for (let x = -width / 2 + 1.22; x < width / 2; x += 1.22) seams.push([[x, floor + .016, center], [.008, .003, depth]]);
  for (let z = back + 1.22; z < front; z += 1.22) seams.push([[0, floor + .016, z], [width, .003, .008]]);
  repeated('limestone-floor-joints', new THREE.MeshStandardMaterial({color: '#aaa694', roughness: .96}), seams);
  box('interior-back-lining', ceiling, [0, floor + 1.65, back], [width + .1, 3.3, .04]);
  for (const sign of shunde ? [-1, 1] : []) {
    box('interior-side-lining', ceiling, [sign * (width / 2 + .055), floor + 1.65, center], [.08, 3.3, depth]);
    box('side-wall-skirting', bronze, [sign * width / 2, floor + .09, center], [.025, .18, depth]);
    box('side-wall-panel-reveal', recess, [sign * width / 2, floor + 1.04, center], [.012, .014, depth]);
  }
  box('back-wall-skirting', bronze, [0, floor + .09, back + .05], [width, .18, .025]);
  for (const x of [-3.85, 3.85]) {
    box('oak-display-recess', recess, [x, floor + 1.67, back + .055], [2.5, 3.16, .07]);
    const slats = [];
    for (let i = 0; i < 18; i++) slats.push([[x - 1.19 + i * .14, floor + 1.68, back + .11], [.10, 3.08, .055]]);
    const slatGeometry = new THREE.BoxGeometry(.10, 3.08, .055);
    // Bake meter-scaled slat UVs once; every repeated slat uses the same dimensions.
    const positions = slatGeometry.attributes.position, normals = slatGeometry.attributes.normal, uv = slatGeometry.attributes.uv;
    for (let i = 0; i < positions.count; i++) uv.setXY(i,
      (Math.abs(normals.getX(i)) > .5 ? positions.getZ(i) : positions.getX(i)) / 2.4,
      (Math.abs(normals.getY(i)) > .5 ? positions.getZ(i) : positions.getY(i)) / 1.2);
    const instances = new THREE.InstancedMesh(slatGeometry, wood, slats.length), matrix = new THREE.Matrix4();
    slats.forEach(([position], index) => {matrix.makeTranslation(...position); instances.setMatrixAt(index, matrix);});
    instances.name = 'oak-acoustic-slats'; instances.userData.teachingSurface = 'wood';
    instances.userData.meterUV = true; instances.castShadow = true; instances.receiveShadow = true;
    instances.computeBoundingSphere(); room.add(instances);
    box('display-backing-base', bronze, [x, floor + .12, back + .12], [2.5, .24, .06]);
  }
  if (shunde) {
    box('acoustic-ceiling', recess, [0, top + .025, center], [width + .1, .05, depth]);
    for (const x of [-3.66, 0, 3.66]) {
      box('ceiling-acoustic-panel', ceiling, [x, top - .035, center], [3.58, .075, depth - .1]);
    }
  }
  for (const x of [-4.65, 4.65]) {
    const lightCenter = shunde ? center : back + .26, lightDepth = shunde ? depth - .4 : .42;
    box('ceiling-light-recess', recess, [x, top - .085, lightCenter], [.18, .08, lightDepth]);
    box('warm-linear-light', light, [x, top - .129, lightCenter], [.085, .012, lightDepth - .06]);
  }
  if (!areaLightsReady) {RectAreaLightUniformsLib.init(); areaLightsReady = true;}
  for (const x of [-2.7, 2.7]) {
    const area = new THREE.RectAreaLight('#fff0d8', 3.2, 4.8, 2.5);
    area.name = 'Interior soft ceiling light'; area.position.set(x, top - .2, center);
    area.lookAt(x, floor, center); room.add(area);
  }
  const bounce = new THREE.RectAreaLight('#f4e9d6', 1.1, width - 1, depth - .5);
  bounce.name = 'Interior diffuse floor bounce'; bounce.position.set(0, floor + .3, center);
  bounce.lookAt(0, top, center); room.add(bounce);
  if (labels) {
    const canvas = document.createElement('canvas'); canvas.width = 1280; canvas.height = 256;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('无法创建知识门厅导览文字。');
    context.fillStyle = '#eee7d9'; context.fillRect(0, 0, 1280, 256);
    context.textAlign = 'center'; context.fillStyle = '#294c4a';
    context.font = '500 96px sans-serif'; context.fillText(shunde ? '舜德 · 知识门厅' : '建华楼', 640, 170);
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
    box('wayfinding-shadow-reveal', recess, [0, floor + 2.32, back + .033], [4.0, .86, .036]);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.9, .78),
      new THREE.MeshStandardMaterial({map, roughness: .9}));
    sign.name = 'teaching-room-wayfinding'; sign.position.set(0, floor + 2.32, back + .055); room.add(sign);
  }
  let meshes = 0, triangles = 0;
  room.traverse(mesh => {if (mesh.isMesh) {meshes++; triangles += (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3 *
    (mesh.isInstancedMesh ? mesh.count : 1);}});
  room.userData.finishStats = {meshes, triangles, areaLights: 3, contactMapSize: 128};
  return room;
}

export function createKnowledgeHall({scene, camera, canvas, host, walker, onChange}) {
  const group = new THREE.Group();
  group.name = 'illustrative-shunde-knowledge-hall';
  group.userData.runtimeOnly = true;
  group.matrixAutoUpdate = false;
  const fill = new THREE.HemisphereLight('#f4edda', '#a5bcb8', .35);
  group.add(fill);
  const views = new Map(), raycaster = new THREE.Raycaster();
  const surfaceLibrary = createTeachingSurfaceLibrary();
  const launches = document.createElement('div');
  launches.className = 'lab-launches'; launches.id = 'shunde-lab-launches'; launches.hidden = true;
  document.getElementById('walk-controls').append(launches);
  let anchor = null, selected = null, finishes = null, surfaces = null, nearby = null;
  const interact = document.getElementById('interact-exhibit');
  const ui = createLabUI({host, onClose: () => {
    selected = null;
    camera.clearViewOffset(); camera.fov = 65; camera.aspect = canvas.clientWidth / canvas.clientHeight; camera.updateProjectionMatrix();
    walker.resume(); onChange();
  }});
  function focus() {
    if (!selected || !anchor) return;
    const stand = SHUNDE_STANDS.find(entry => entry.id === selected);
    const target = new THREE.Vector3(stand.x, 2.93, stand.z);
    const eye = target.clone().add(new THREE.Vector3(0, 1.03, 2.85));
    anchor.updateWorldMatrix(true, false);
    camera.position.copy(anchor.localToWorld(eye)); camera.lookAt(anchor.localToWorld(target));
    camera.fov = 72; camera.near = .06;
    setLabViewport(camera, canvas.clientWidth, canvas.clientHeight);
    camera.updateMatrixWorld(true); onChange();
  }
  function open(id) {
    if (!anchor || !views.has(id)) throw new Error('请先进入舜德楼知识门厅。');
    if (ui.active) ui.close();
    walker.suspend(); selected = id;
    ui.open(id, views.get(id), '舜德楼 · 知识门厅'); focus();
  }
  for (const {id} of SHUNDE_STANDS) {
    const button = document.createElement('button'); button.textContent = LABS[id].title; button.dataset.hallLab = id;
    button.addEventListener('click', () => open(id)); launches.append(button);
  }
  function exit() {
    ui.close();
    surfaces?.dispose(); surfaces = null;
    views.forEach(view => view.dispose()); views.clear(); group.removeFromParent();
    if (finishes) {disposeExhibitTree(finishes); finishes.removeFromParent(); finishes = null;}
    anchor = null; selected = null; launches.hidden = true; walker.setObstacles([]);
    nearby = null; interact.hidden = true;
  }
  return {get active() {return ui.active;}, open, focus, exit,
    interact() {if (nearby && !ui.active) open(nearby);},
    updateVisitor(visitor) {
      if (!anchor || !views.size || ui.active) return;
      const [x, z] = visitor.position;
      const close = SHUNDE_STANDS.filter(stand => Math.hypot(stand.x - x, stand.z - z) < 3.4 &&
        (stand.x - x) * Math.sin(visitor.yaw) + (stand.z - z) * Math.cos(visitor.yaw) > .2)
        .sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z))[0]?.id ?? null;
      nearby = close;
      views.forEach((view, id) => view.focus(id === nearby));
      interact.disabled = !nearby;
      interact.textContent = nearby ? `展开「${LABS[nearby].title}」 · F` :
        visitor.phase === 'entering' ? '正在穿过门厅 · 移动或拖动可接管' : '走近并面向展台后按 F 互动';
    },
    enter(object) {
      exit();
      const kind = object.userData.walkthrough.id;
      if (!['shunde', 'jianhua'].includes(kind)) return;
      anchor = object; anchor.updateWorldMatrix(true, false); group.matrix.copy(anchor.matrixWorld);
      for (const {id, x, z} of kind === 'shunde' ? SHUNDE_STANDS : []) {
        const view = createLabExhibit(id, {onChange});
        view.root.position.set(x, .9, z); group.add(view.root); views.set(id, view);
      }
      finishes = createTeachingRoom({kind}); group.add(finishes);
      surfaces = surfaceLibrary.install(group, object => object.userData.teachingSurface ||
        (object.name === 'exhibit-table' ? 'stone' : undefined));
      scene.add(group);
      walker.setObstacles(kind === 'shunde' ? [...SHUNDE_STAND_OBSTACLES, {min: [-5.5, -5.7], max: [5.5, -5.46]}]
        : [{min: [-5.3, -7.6], max: [5.3, -7.37]}]);
      interact.hidden = launches.hidden = kind !== 'shunde';
      if (kind === 'shunde') document.getElementById('walk-title').textContent = '舜德楼 · 知识门厅';
      onChange();
    },
    pick(pointer) {
      if (!anchor || ui.active) return false;
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObject(group, true)[0];
      if (!hit || hit.distance > 18) return false;
      const blocked = raycaster.intersectObject(anchor, true).some(result => {
        if (result.distance >= hit.distance - .03) return false;
        for (let object = result.object; object; object = object.parent) if (!object.visible) return false;
        return true;
      });
      if (blocked) return false;
      let object = hit.object;
      while (object && !object.userData.knowledgeLab) object = object.parent;
      if (!object) return false;
      open(object.userData.knowledgeLab); return true;
    },
    snapshot: () => ({mounted: Boolean(anchor), count: views.size, active: selected, state: ui.state(), surfaces: surfaces?.stats ?? null,
      room: finishes?.userData.finishStats ?? null,
      views: [...views.values()].map(view => view.snapshot())}),
    pickTargets() {
      group.updateWorldMatrix(true, true);
      return [...views].map(([id, view]) => {
        const point = view.root.localToWorld(new THREE.Vector3(0, 1.085, 0)).project(camera);
        return {id, x: (point.x + 1) * canvas.clientWidth / 2, y: (1 - point.y) * canvas.clientHeight / 2};
      });
    },
    dispose() {exit(); ui.dispose(); launches.remove(); surfaceLibrary.dispose();}};
}
