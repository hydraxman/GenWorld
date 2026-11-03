import * as THREE from 'three';
import {LABS} from '../../../shared/knowledge-labs/experiments.js';
import {createLabExhibit} from '../../../shared/knowledge-labs/exhibit.js';
import {createLabUI} from '../../../shared/knowledge-labs/ui.js';
import {setLabViewport} from '../../../shared/knowledge-labs/camera.js';

export const SHUNDE_STANDS = Object.freeze([
  {id: 'graph', x: -3.35, z: -2.5},
  {id: 'markov', x: 0, z: -4.15},
  {id: 'list', x: 3.35, z: -2.5},
].map(Object.freeze));
export const SHUNDE_STAND_OBSTACLES = SHUNDE_STANDS.map(({x, z}) => ({min: [x - 1.575, z - 1.025], max: [x + 1.575, z + 1.025]}));

export function createKnowledgeHall({scene, camera, canvas, host, walker, onChange}) {
  const group = new THREE.Group();
  group.name = 'illustrative-shunde-knowledge-hall';
  group.userData.runtimeOnly = true;
  group.matrixAutoUpdate = false;
  const fill = new THREE.HemisphereLight('#f4edda', '#a5bcb8', .9);
  group.add(fill);
  const views = new Map(), raycaster = new THREE.Raycaster();
  const launches = document.createElement('div');
  launches.className = 'lab-launches'; launches.id = 'shunde-lab-launches'; launches.hidden = true;
  document.getElementById('walk-controls').insertBefore(launches, document.getElementById('walk-note'));
  let anchor = null, selected = null;
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
    ui.open(id, views.get(id), '舜德楼 · 示意知识门厅'); focus();
  }
  for (const {id} of SHUNDE_STANDS) {
    const button = document.createElement('button'); button.textContent = LABS[id].title; button.dataset.hallLab = id;
    button.addEventListener('click', () => open(id)); launches.append(button);
  }
  function exit() {
    ui.close();
    views.forEach(view => view.dispose()); views.clear(); group.removeFromParent();
    anchor = null; selected = null; launches.hidden = true; walker.setObstacles([]);
  }
  return {get active() {return ui.active;}, open, focus, exit,
    enter(object) {
      exit();
      if (object.userData.walkthrough.id !== 'shunde') return;
      anchor = object; anchor.updateWorldMatrix(true, false); group.matrix.copy(anchor.matrixWorld);
      for (const {id, x, z} of SHUNDE_STANDS) {
        const view = createLabExhibit(id, {onChange});
        view.root.position.set(x, .9, z); group.add(view.root); views.set(id, view);
      }
      scene.add(group); walker.setObstacles(SHUNDE_STAND_OBSTACLES);
      launches.hidden = false;
      document.getElementById('walk-title').textContent = '舜德楼 · 知识门厅';
      document.getElementById('walk-note').textContent = '教学展台与室内均为示意，非实地陈设。走入门厅，点击展台或上方名称展开实验。';
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
    snapshot: () => ({mounted: Boolean(anchor), count: views.size, active: selected, state: ui.state(),
      views: [...views.values()].map(view => view.snapshot())}),
    pickTargets() {
      group.updateWorldMatrix(true, true);
      return [...views].map(([id, view]) => {
        const point = view.root.localToWorld(new THREE.Vector3(0, 1.085, 0)).project(camera);
        return {id, x: (point.x + 1) * canvas.clientWidth / 2, y: (1 - point.y) * canvas.clientHeight / 2};
      });
    },
    dispose() {exit(); ui.dispose(); launches.remove();}};
}
