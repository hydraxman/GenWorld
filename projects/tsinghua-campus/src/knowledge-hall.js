import * as THREE from 'three';
import {LABS} from '../../../shared/knowledge-labs/experiments.js';
import {createLabExhibit, disposeExhibitTree} from '../../../shared/knowledge-labs/exhibit.js';
import {createLabUI} from '../../../shared/knowledge-labs/ui.js';
import {setLabViewport} from '../../../shared/knowledge-labs/camera.js';
import {createTeachingSurfaceLibrary} from '../../../shared/knowledge-labs/surfaces.js';

export const SHUNDE_STANDS = Object.freeze([
  {id: 'graph', x: -3.35, z: -2.5},
  {id: 'markov', x: 0, z: -4.15},
  {id: 'list', x: 3.35, z: -2.5},
].map(Object.freeze));
export const SHUNDE_STAND_OBSTACLES = SHUNDE_STANDS.map(({x, z}) => ({min: [x - 1.575, z - 1.025], max: [x + 1.575, z + 1.025]}));

export function createTeachingRoom({labels = typeof document !== 'undefined'} = {}) {
  const room = new THREE.Group();
  room.name = 'illustrative-teaching-room-finishes';
  room.userData.illustrative = true;
  const stone = new THREE.MeshStandardMaterial({color: '#e7dfce', roughness: .88});
  const wood = new THREE.MeshStandardMaterial({color: '#a57a50', roughness: .8});
  const ceiling = new THREE.MeshStandardMaterial({color: '#eae5d9', roughness: .95});
  const bronze = new THREE.MeshStandardMaterial({color: '#796347', metalness: .65, roughness: .38});
  const light = new THREE.MeshStandardMaterial({color: '#fff1cf', emissive: '#ffda97', emissiveIntensity: .8});
  const geometry = new THREE.BoxGeometry();
  function box(name, material, position, scale, surface) {
    const mesh = new THREE.Mesh(geometry, material); mesh.name = name;
    mesh.position.set(...position); mesh.scale.set(...scale);
    mesh.receiveShadow = true; mesh.castShadow = true;
    mesh.userData.teachingSurface = surface; room.add(mesh); return mesh;
  }
  box('inset-teaching-floor', stone, [0, .91, -2.5], [10.98, .02, 6.28], 'stone');
  box('interior-back-lining', ceiling, [0, 2.55, -5.63], [11.1, 3.3, .04]);
  box('acoustic-ceiling', ceiling, [0, 4.17, -2.5], [11.1, .07, 6.6]);
  for (const x of [-3.85, 3.85]) {
    box('oak-display-backing', wood, [x, 2.52, -5.58], [2.75, 3.24, .06], 'wood');
    box('brass-wall-foot', bronze, [x, 1.02, -5.53], [2.75, .24, .04]);
  }
  for (const x of [-4.65, 4.65]) {
    box('ceiling-light-recess', bronze, [x, 4.118, -2.5], [.14, .035, 5.8]);
    box('warm-linear-light', light, [x, 4.095, -2.5], [.07, .015, 5.72]);
  }
  if (labels) {
    const canvas = document.createElement('canvas'); canvas.width = 1280; canvas.height = 200;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('无法创建知识门厅导览文字。');
    context.fillStyle = '#eae5d9'; context.fillRect(0, 0, 1280, 200);
    context.textAlign = 'center'; context.fillStyle = '#294c4a';
    context.font = '600 90px sans-serif'; context.fillText('舜德 · 知识门厅', 640, 130);
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.65, .73),
      new THREE.MeshBasicMaterial({map, toneMapped: false}));
    sign.name = 'teaching-room-wayfinding'; sign.position.set(0, 3.17, -5.6); room.add(sign);
  }
  return room;
}

export function createKnowledgeHall({scene, camera, canvas, host, walker, onChange}) {
  const group = new THREE.Group();
  group.name = 'illustrative-shunde-knowledge-hall';
  group.userData.runtimeOnly = true;
  group.matrixAutoUpdate = false;
  const fill = new THREE.HemisphereLight('#f4edda', '#a5bcb8', .9);
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
      if (!anchor || ui.active) return;
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
      if (object.userData.walkthrough.id !== 'shunde') return;
      anchor = object; anchor.updateWorldMatrix(true, false); group.matrix.copy(anchor.matrixWorld);
      for (const {id, x, z} of SHUNDE_STANDS) {
        const view = createLabExhibit(id, {onChange});
        view.root.position.set(x, .9, z); group.add(view.root); views.set(id, view);
      }
      finishes = createTeachingRoom(); group.add(finishes);
      surfaces = surfaceLibrary.install(group, object => object.userData.teachingSurface ||
        (object.name === 'exhibit-table' ? 'stone' : undefined));
      scene.add(group); walker.setObstacles([...SHUNDE_STAND_OBSTACLES, {min: [-5.5, -5.7], max: [5.5, -5.5]}]);
      interact.hidden = false;
      launches.hidden = false;
      document.getElementById('walk-title').textContent = '舜德楼 · 知识门厅';
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
