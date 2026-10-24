import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { makeEnvironment } from '../../../shared/environment.js';
import { FLOORS, ROUTES, searchCurriculum } from './curriculum.js';
import { INITIAL_STATE, transition, describeSelection } from './navigation.js';
import { createKnowledgeTower } from './tower.js';
import { EXHIBIT_DESCRIPTIONS } from './exhibits.js';
import { createLearningUI } from './learning-ui.js';
import { loadAcademyAssets } from './public-assets.js';

const $ = id => document.getElementById(id);
let state = { ...INITIAL_STATE };
let engine = null;
let learning = null;
let planLoaded = false;
const floorLabels = new Map();
const roomLabels = [];

function node(tag, className, text) {
  const entry = document.createElement(tag);
  if (className) entry.className = className;
  if (text !== undefined) entry.textContent = text;
  return entry;
}

function showUIError(error) {
  console.error(error);
  $('ui-error').textContent = `操作未完成：${error.message}`;
  $('ui-error').hidden = false;
}

function action(handler) {
  return event => {
    try {
      handler(event);
      $('ui-error').hidden = true;
    } catch (error) {
      showUIError(error);
    }
  };
}

function dispatch(change) {
  const previous = state;
  state = transition(state, change);
  if (['floor', 'room', 'step', 'route'].includes(change.type) && learning) learning.recordVisit(state.floor, state.roomId);
  paint();
  if (engine && change.type !== 'query') {
    applyModelState();
    if (state.mode !== previous.mode || state.floor !== previous.floor || change.type === 'mode') fitCamera();
    render();
  }
}

function buildNavigation() {
  for (const floor of [...FLOORS].reverse()) {
    const button = node('button', 'floor-button');
    button.dataset.floor = floor.number;
    button.style.setProperty('--floor-color', floor.color);
    button.append(node('span', 'floor-number', String(floor.number).padStart(2, '0')), node('span', '', floor.title));
    $('floor-nav').append(button);
    const label = node('button', 'spatial-label', `${String(floor.number).padStart(2, '0')}F`);
    label.dataset.floor = floor.number;
    label.title = `${floor.number} 层 · ${floor.title}`;
    label.setAttribute('aria-label', `进入第 ${floor.number} 层：${floor.title}`);
    $('floor-labels').append(label);
    floorLabels.set(floor.number, label);
  }
  for (const route of ROUTES) {
    const option = node('option', '', route.name);
    option.value = route.id;
    $('route').append(option);
  }
  for (let index = 0; index < 4; index++) {
    const label = node('button', 'spatial-label room-spatial-label');
    $('room-labels').append(label);
    roomLabels.push(label);
  }
}

function paintSearch() {
  const container = $('search-results');
  container.hidden = !state.query.trim();
  container.replaceChildren();
  if (container.hidden) return;
  const results = searchCurriculum(state.query);
  container.append(node('p', 'result-heading', results.length ? `${results.length} 个展厅匹配 · 点击直达` : '未找到匹配知识，试试“图”“事务”或“概率”。'));
  for (const result of results) {
    const button = node('button', 'search-result');
    button.dataset.room = result.roomId;
    button.dataset.topic = Math.max(0, result.topicIndex);
    button.append(node('b', '', result.topicName ?? result.roomName),
      node('span', '', `${String(result.floor).padStart(2, '0')}F · ${result.floorTitle} / ${result.roomName}`));
    container.append(button);
  }
}

function paint() {
  const { floor, room, route, prerequisites, routeIndex } = describeSelection(state);
  document.documentElement.style.setProperty('--accent', floor.color);
  $('floor-counter').textContent = `${String(floor.number).padStart(2, '0')} / 16`;
  $('floor-english').textContent = floor.english;
  $('floor-title').textContent = floor.title;
  $('floor-summary').textContent = floor.summary;
  $('floor-brief').textContent = floor.rooms.map(entry => entry.question).join(' ');
  const modeName = { tower: '整楼', exploded: '分层展开', floor: '单层查看' }[state.mode];
  $('scene-heading').textContent = state.mode === 'floor' ? `${String(floor.number).padStart(2, '0')}F · ${floor.title}` : `${modeName} · 软件工程知识体系`;
  $('selection-caption').textContent = room ? `${floor.number}F / ${room.name}` : `${floor.number}F / ${floor.title}`;
  const related = new Set(prerequisites.map(entry => entry.floor));
  document.querySelectorAll('#floor-nav [data-floor]').forEach(button => {
    const number = Number(button.dataset.floor);
    button.classList.toggle('active', number === state.floor);
    button.classList.toggle('on-route', route?.floors.includes(number) ?? false);
    button.classList.toggle('related', related.has(number));
    button.setAttribute('aria-current', number === state.floor ? 'true' : 'false');
  });
  floorLabels.forEach((label, number) => label.classList.toggle('active', number === state.floor));
  document.querySelectorAll('[data-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mode === state.mode)));
  $('room-nav').replaceChildren();
  floor.rooms.forEach((entry, index) => {
    const button = node('button', `room-button${entry.id === state.roomId ? ' active' : ''}`);
    button.dataset.room = entry.id;
    button.setAttribute('aria-pressed', String(entry.id === state.roomId));
    button.append(node('span', '', `ROOM / 0${index + 1}`), document.createTextNode(entry.name));
    $('room-nav').append(button);
    const label = roomLabels[index];
    label.dataset.room = entry.id;
    label.textContent = `0${index + 1} · ${entry.name}`;
    label.classList.toggle('active', entry.id === state.roomId);
  });
  $('room-detail').hidden = !room;
  $('floor-overview').hidden = Boolean(room);
  if (room) {
    const exhibit = EXHIBIT_DESCRIPTIONS[room.id];
    $('exhibit-title').textContent = exhibit.title;
    $('exhibit-summary').textContent = exhibit.summary;
    $('room-name').textContent = room.name;
    $('room-question').textContent = room.question;
    $('topic-tabs').replaceChildren();
    room.topics.forEach((topic, index) => {
      const button = node('button', '', topic.name);
      button.dataset.topicIndex = index;
      button.setAttribute('aria-pressed', String(index === state.topicIndex));
      $('topic-tabs').append(button);
    });
    $('topic-title').textContent = room.topics[state.topicIndex].name;
    $('topic-summary').textContent = room.topics[state.topicIndex].summary;
    $('room-challenge').textContent = room.challenge;
    $('prerequisites').replaceChildren();
    for (const entry of prerequisites) {
      const button = node('button', 'prerequisite-button');
      button.dataset.room = entry.id;
      button.append(node('span', '', `${String(entry.floor).padStart(2, '0')}F`), document.createTextNode(`${entry.name} ↗`));
      $('prerequisites').append(button);
    }
    if (!prerequisites.length) $('prerequisites').append(node('p', 'prerequisite-empty', '这是一个入门展厅，没有指定的先修展厅。'));
  }
  $('route').value = state.routeId ?? '';
  $('route-progress').hidden = !route;
  if (route) {
    $('route-name').textContent = route.name;
    $('route-summary').textContent = route.summary;
    $('route-stops').replaceChildren();
    route.floors.forEach(number => {
      const button = node('button', number === state.floor ? 'active' : '', `${String(number).padStart(2, '0')}F`);
      button.dataset.floor = number;
      button.title = FLOORS[number - 1].title;
      button.setAttribute('aria-label', `${number} 层：${FLOORS[number - 1].title}`);
      $('route-stops').append(button);
    });
    $('route-position').textContent = routeIndex < 0 ? '路线之外' : `${routeIndex + 1} / ${route.floors.length}`;
    $('route-prev').disabled = routeIndex <= 0;
    $('route-next').disabled = routeIndex === route.floors.length - 1;
    $('route-next').textContent = routeIndex < 0 ? '进入路线 →' : '下一站 →';
  }
  paintSearch();
  learning?.paint(state.floor, state.roomId);
  window.__knowledgeState = { ...state };
}

function bindUI() {
  for (const id of ['floor-nav', 'floor-labels', 'route-stops']) {
    $(id).addEventListener('click', action(event => {
      const button = event.target.closest('[data-floor]');
      if (button) dispatch({ type: 'floor', number: Number(button.dataset.floor) });
    }));
  }
  for (const id of ['room-nav', 'room-labels', 'prerequisites', 'search-results']) {
    $(id).addEventListener('click', action(event => {
      const button = event.target.closest('[data-room]');
      if (button) dispatch({ type: 'room', id: button.dataset.room, topicIndex: Number(button.dataset.topic ?? 0) });
    }));
  }
  $('topic-tabs').addEventListener('click', action(event => {
    const button = event.target.closest('[data-topic-index]');
    if (button) dispatch({ type: 'topic', index: Number(button.dataset.topicIndex) });
  }));
  document.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', action(() => dispatch({ type: 'mode', mode: button.dataset.mode }))));
  $('search').addEventListener('input', action(event => dispatch({ type: 'query', query: event.target.value })));
  $('route').addEventListener('change', action(event => dispatch({ type: 'route', id: event.target.value || null })));
  $('route-prev').addEventListener('click', action(() => dispatch({ type: 'step', delta: -1 })));
  $('route-next').addEventListener('click', action(() => dispatch({ type: 'step', delta: 1 })));
  $('reset-view').addEventListener('click', action(() => { if (engine) { fitCamera(); render(); } }));
  $('open-plan').addEventListener('click', () => {
    $('plan-dialog').showModal();
    if (!planLoaded) loadPlan();
  });
  $('close-plan').addEventListener('click', () => $('plan-dialog').close());
}

async function loadPlan() {
  try {
    const response = await fetch('DESIGN.md');
    if (!response.ok) throw new Error(`规划文本读取失败（HTTP ${response.status}）`);
    $('plan-text').textContent = await response.text();
    planLoaded = true;
  } catch (error) {
    $('plan-text').textContent = `${error.message}。请使用 HTTP 服务打开项目，或直接打开项目内的 DESIGN.md。`;
    console.error(error);
  }
}

function applyModelState() {
  const { prerequisites, route } = describeSelection(state);
  engine.tower.setState({
    mode: state.mode, floor: state.floor, roomId: state.roomId,
    relatedFloors: [...new Set(prerequisites.map(room => room.floor))],
    routeFloors: route?.floors ?? [],
  });
  if (learning) engine.tower.setLearning(learning.getSceneState());
  if (engine.publicAssets) engine.publicAssets.visible = state.mode !== 'floor';
}

function fitCamera() {
  const { camera, controls, tower } = engine;
  let center;
  let radius;
  if (state.mode === 'floor') {
    center = tower.getFloorPosition(state.floor).add(new THREE.Vector3(0, 1.2, 0));
    radius = 17;
  } else {
    const low = tower.getFloorPosition(1).y;
    const high = tower.getFloorPosition(16).y + 4;
    center = new THREE.Vector3(0, (low + high) / 2, 0);
    radius = Math.hypot(19, (high - low) / 2 + 2);
  }
  const verticalHalf = THREE.MathUtils.degToRad(camera.fov / 2);
  const horizontalHalf = Math.atan(Math.tan(verticalHalf) * camera.aspect);
  const padding = state.mode === 'exploded' ? 1.28 : state.mode === 'tower' ? 1.18 : 1.04;
  const distance = radius / Math.sin(Math.min(verticalHalf, horizontalHalf)) * padding;
  if (state.mode !== 'floor') center.y += 2;
  const direction = state.mode === 'floor' ? new THREE.Vector3(1, 1.1, 1.5) : new THREE.Vector3(1, .48, 1.55);
  camera.position.copy(center).addScaledVector(direction.normalize(), distance);
  controls.target.copy(center);
  controls.minDistance = state.mode === 'floor' ? 9 : 24;
  controls.maxDistance = state.mode === 'floor' ? 160 : 550;
  controls.update();
}

function placeLabel(label, position) {
  const point = position.project(engine.camera);
  const inView = point.z > -1 && point.z < 1 && Math.abs(point.x) < 1.03 && Math.abs(point.y) < .85;
  label.hidden = !inView;
  if (inView) {
    label.style.left = `${(point.x + 1) * engine.width / 2}px`;
    label.style.top = `${(1 - point.y) * engine.height / 2}px`;
  }
}

function render() {
  if (!engine) return;
  engine.renderer.render(engine.scene, engine.camera);
  floorLabels.forEach((label, number) => {
    label.hidden = state.mode === 'floor';
    if (state.mode !== 'floor') placeLabel(label, engine.tower.getFloorPosition(number).add(new THREE.Vector3(12.5, .7, 0)));
  });
  roomLabels.forEach((label, index) => {
    label.hidden = state.mode !== 'floor';
    if (state.mode === 'floor') {
      const x = index % 2 === 0 ? -5.8 : 5.8;
      const z = index < 2 ? -4.5 : 4.5;
      placeLabel(label, engine.tower.getFloorPosition(state.floor).add(new THREE.Vector3(x, 3.3, z)));
    }
  });
  $('checkpoint-label').hidden = state.mode !== 'floor';
  if (state.mode === 'floor') placeLabel($('checkpoint-label'), engine.tower.getCheckpointPosition(state.floor).add(new THREE.Vector3(0, 1.2, 0)));
}

function isVisible(object) {
  for (let current = object; current; current = current.parent) if (!current.visible) return false;
  return true;
}

function bindPicking(canvas) {
  const raycaster = new THREE.Raycaster();
  let start = null;
  const pointers = new Set();
  canvas.addEventListener('pointerdown', event => {
    pointers.add(event.pointerId);
    start = pointers.size === 1 ? { x: event.clientX, y: event.clientY, id: event.pointerId } : null;
  });
  canvas.addEventListener('pointercancel', event => { pointers.delete(event.pointerId); start = null; });
  canvas.addEventListener('pointerup', action(event => {
    pointers.delete(event.pointerId);
    const origin = start;
    start = null;
    if (!origin || origin.id !== event.pointerId || event.button !== 0 || Math.hypot(event.clientX - origin.x, event.clientY - origin.y) > 6) return;
    const rect = canvas.getBoundingClientRect();
    const pointer = new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    raycaster.setFromCamera(pointer, engine.camera);
    const hit = raycaster.intersectObjects(engine.tower.pickables, true).find(entry => isVisible(entry.object));
    if (hit) dispatch({ type: 'room', id: hit.object.userData.roomId });
  }));
}

function initScene() {
  const renderer = new THREE.WebGLRenderer({ canvas: $('scene'), antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = .95;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const environment = makeEnvironment(THREE, renderer);
  scene.environment = environment.environment;
  scene.environmentIntensity = .5;
  scene.add(new THREE.HemisphereLight('#d7e9f0', '#3a4654', 1.7));
  const sun = new THREE.DirectionalLight('#ffe3bc', 3);
  sun.position.set(35, 110, 50);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -38, right: 38, top: 58, bottom: -58, near: 1, far: 230 });
  sun.shadow.normalBias = .035;
  sun.target.position.set(0, 32, 0);
  scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight('#94c9e0', 1.3);
  fill.position.set(-30, 40, -20);
  scene.add(fill);
  const tower = createKnowledgeTower(THREE, FLOORS);
  scene.add(tower.group);
  const camera = new THREE.PerspectiveCamera(42, 1, .1, 1500);
  const controls = new OrbitControls(camera, $('scene'));
  controls.enableDamping = false;
  controls.maxPolarAngle = Math.PI / 2 - .025;
  controls.minPolarAngle = .16;
  controls.enablePan = false;
  engine = { renderer, scene, tower, camera, controls, width: 1, height: 1 };
  applyModelState();
  controls.addEventListener('change', render);
  const resize = () => {
    const rect = $('viewport').getBoundingClientRect();
    engine.width = Math.max(1, rect.width);
    engine.height = Math.max(1, rect.height);
    renderer.setSize(engine.width, engine.height, false);
    camera.aspect = engine.width / engine.height;
    camera.updateProjectionMatrix();
    fitCamera();
    render();
  };
  const observer = new ResizeObserver(resize);
  observer.observe($('viewport'));
  resize();
  bindPicking($('scene'));
  $('scene').addEventListener('webglcontextlost', event => {
    event.preventDefault();
    $('scene-error').textContent = '三维图形上下文已丢失。请刷新页面重新构建；楼层导航和知识文本仍可使用。';
    $('scene-error').hidden = false;
    window.__sceneError = 'WebGL context lost';
  });
  let meshes = 0, triangles = 0;
  tower.group.traverse(object => {
    if (!object.isMesh) return;
    meshes++;
    triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3 * (object.isInstancedMesh ? object.count : 1);
  });
  window.__knowledgeStats = { floors: FLOORS.length, rooms: FLOORS.flatMap(floor => floor.rooms).length,
    topics: FLOORS.flatMap(floor => floor.rooms.flatMap(room => room.topics)).length, meshes, triangles };
  window.__knowledgeCamera = () => ({ position: camera.position.toArray(), target: controls.target.toArray(), aspect: camera.aspect });
  window.__knowledgePickTargets = () => {
    scene.updateMatrixWorld(true);
    return tower.pickables.filter(isVisible).map(object => {
      const point = new THREE.Box3().setFromObject(object).getCenter(new THREE.Vector3()).project(camera);
      return { roomId: object.userData.roomId, x: (point.x + 1) * engine.width / 2, y: (1 - point.y) * engine.height / 2 };
    });
  };
  window.__publicAssetsReady = false;
  loadAcademyAssets().then(assets => {
    engine.publicAssets = assets;
    tower.group.add(assets);
    assets.visible = state.mode !== 'floor';
    window.__publicAssetsReady = true;
    render();
  }).catch(error => {
    window.__publicAssetsError = String(error);
    showUIError(new Error(`公共模型未能加载：${error.message}。知识与学习记录仍可使用。`));
  });
  $('loading').hidden = true;
  window.__knowledgeReady = true;
  window.addEventListener('pagehide', () => {
    observer.disconnect();
    controls.dispose();
    renderer.dispose();
  }, { once: true });
}

buildNavigation();
bindUI();
learning = createLearningUI({
  navigate: dispatch,
  reportError: showUIError,
  onChange: () => { paint(); if (engine) { applyModelState(); render(); } },
});
paint();
try {
  initScene();
} catch (error) {
  window.__sceneError = String(error.stack ?? error);
  $('loading').hidden = true;
  $('scene-error').textContent = `三维场景无法启动：${error.message}。请使用支持 WebGL 的浏览器并启用硬件加速；你仍可通过两侧的导航查看全部知识。`;
  $('scene-error').hidden = false;
  console.error(error);
}
