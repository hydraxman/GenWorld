import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import data from '../data/campus.json';
import {createCampusModel} from './model.js';
import {buildCampusRefinements, REFINEMENT_SITES, REFINEMENT_VIEWS} from './refinements.js';
import {applyCampusLandmarks, LANDMARK_SITES} from './landmarks.js';
import {createCoverage} from './coverage.js';
import catalog from './reference-catalog.js';
import {viewBounds} from './view-bounds.js';
import {fitInspectionView, fitInspectionShadow, updateInspectionClipping} from './inspection-view.js';
import {createCampusDaylight} from './daylight.js';
import {createCampusRenderPipeline} from './render-pipeline.js';
import {ZIJING_APARTMENTS} from './zijing-sources.js';
import {applyCampusArchitecture, prepareArchitectureExport, ARCHITECTURE_FAMILIES} from './campus-architecture.js';
import {PHOTO_APPEARANCES} from './photo-appearance.js';
import {buildCampusLandscape} from './landscape.js';
import {installCampusReflections} from './campus-reflections.js';
import {createWalkthrough} from './walkthrough.js';
import {createDetailedDisplay, prepareDetailedExport} from './display-lod.js';
import {prepareQingmingTextures} from './qingming-reuse.js';
import {renderKnowledgeCard} from './knowledge-card.js';
import {createKnowledgeHall} from './knowledge-hall.js';

const $ = id => document.getElementById(id);
const outputPrefix = location.pathname.endsWith('/tsinghua-campus-offline.html') ? '' : 'output/';
let messageTimeout;
function message(text, error = false, persistent = false) {
  clearTimeout(messageTimeout);
  $('message').textContent = text;
  $('message').classList.toggle('error', error);
  $('message').hidden = !text;
  if (text && !error && !persistent) messageTimeout = setTimeout(() => { $('message').hidden = true; }, 5500);
}

function save(bytes, name, type) {
  const url = URL.createObjectURL(new Blob([bytes], {type}));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

const nextPaint = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
function loading(text, progress) {
  $('loading-text').textContent = text;
  $('loading-progress').value = progress;
}

async function main() {
  performance.mark('campus-start');
  await nextPaint();
  const renderer = new THREE.WebGLRenderer({canvas: $('scene'), antialias: true});
  const compact = window.matchMedia('(max-width: 850px)');
  renderer.setPixelRatio(Math.min(devicePixelRatio, compact.matches ? 1.5 : 1.75));
  const scene = new THREE.Scene();
  const {sun, skyTexture} = createCampusDaylight(renderer, scene);
  const drawScene = createCampusRenderPipeline(renderer, scene);
  const campus = createCampusModel(data);
  scene.add(campus.group);
  const previewCamera = new THREE.PerspectiveCamera(40, 1, 1, 30000);
  const width = $('workspace').clientWidth, height = $('workspace').clientHeight;
  renderer.setSize(width, height, false);
  fitInspectionView(previewCamera, new THREE.Box3().setFromObject(campus.group), {width, height,
    region: {x: 0, y: 0, width, height}});
  sun.castShadow = false;
  renderer.render(scene, previewCamera);
  performance.mark('campus-map-visible');
  loading('地图已显示，正在构建照片参照建筑…', 20);
  await nextPaint();
  const refinedIds = [];
  let sliceStarted = performance.now();
  for (const id of buildCampusRefinements(campus, data)) {
    refinedIds.push(id);
    if (performance.now() - sliceStarted > 32) {
      loading(`正在构建照片参照建筑 ${refinedIds.length} / ${REFINEMENT_SITES.length}`, 20 + 55 * refinedIds.length / REFINEMENT_SITES.length);
      await nextPaint();
      sliceStarted = performance.now();
    }
  }
  performance.mark('campus-photo-models-built');
  loading('正在准备完整目录与轻量远景；近景细节按需构建…', 80);
  await nextPaint();
  const architectureIds = applyCampusArchitecture(campus, data, {deferNear: true});
  const landmarkIds = applyCampusLandmarks(campus, data);
  loading('正在铺设地图操场、草坪与树木…', 90);
  await nextPaint();
  await prepareQingmingTextures();
  const landscapeStages = buildCampusLandscape(campus, data);
  let landscapeStage = landscapeStages.next(), landscapeBuilt = 0;
  sliceStarted = performance.now();
  while (!landscapeStage.done) {
    landscapeBuilt++;
    if (performance.now() - sliceStarted > 32) {
      loading(`正在铺设地图运动场 ${landscapeBuilt}，准备草坪与树木…`, 90 + Math.min(7, landscapeBuilt / 6));
      await nextPaint(); sliceStarted = performance.now();
    }
    landscapeStage = landscapeStages.next();
  }
  const landscapeStats = landscapeStage.value;
  const refinedSiteCount = new Set(refinedIds.map(id => campus.buildings.get(id).userData.referenceSite)).size;
  const siteCount = refinedSiteCount + landmarkIds.length;
  const coverage = createCoverage(campus, data, catalog);
  const bounds = new THREE.Box3().setFromObject(campus.group);
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  const span = Math.max(size.x, size.z);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(span * 5, span * 5),
    new THREE.MeshStandardMaterial({color: '#edf0e3', roughness: 1}));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(center.x, -0.4, center.z);
  ground.receiveShadow = true;
  scene.add(ground);
  const perspective = new THREE.PerspectiveCamera(40, 1, 1, 30000);
  const plan = new THREE.OrthographicCamera(-1000, 1000, 1000, -1000, 1, 30000);
  let camera = perspective, planMode = false, selected = null, selectedPart = null;
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.12;
  controls.minDistance = 8;
  controls.maxDistance = 13000;
  controls.maxPolarAngle = Math.PI / 2.005;
  controls.minZoom = 0.15;
  controls.maxZoom = 45;
  let dirty = true;
  controls.addEventListener('change', () => { dirty = true; });
  const highlight = new THREE.Box3Helper(new THREE.Box3(), '#784b91');
  highlight.visible = false;
  scene.add(highlight);
  const buildings = [...campus.buildings.entries()];
  const objects = [...campus.objects.entries()];
  let framedBounds = null, framedPadding = 1.3;
  $('contact-shadows').checked = !compact.matches;
  let contactShadowsActive = false;
  const reflections = installCampusReflections(renderer, scene, campus, {compact: compact.matches, skyTexture});
  const detailedDisplay = createDetailedDisplay(campus, {batching: renderer.extensions.has('WEBGL_multi_draw')});
  let knowledgeHall;
  const walker = createWalkthrough({camera: perspective, controls, canvas: renderer.domElement,
    panel: $('walk-controls'), onChange: () => {dirty = true; knowledgeHall?.updateVisitor(walker.state());},
    onEnter: object => knowledgeHall.enter(object), onExit: () => knowledgeHall.exit(),
    onInteract: () => knowledgeHall.interact()});
  knowledgeHall = createKnowledgeHall({scene, camera: perspective, canvas: renderer.domElement,
    host: $('workspace'), walker, onChange: () => {dirty = true;}});
  let sceneTime = 0, lastMotion = performance.now();
  function setSceneTime(time) {
    reflections.setTime(time); campus.scenery.setTime(time); sceneTime = time; dirty = true;
  }
  function draw(forceReflections = false) {
    const autoReset = renderer.info.autoReset;
    renderer.info.autoReset = false;
    renderer.info.reset();
    try {
      if (!walker.active) updateInspectionClipping(camera, controls.target);
      campus.updateArchitectureLOD(camera, $('architecture-details').checked, {maxBuilds: 2});
      detailedDisplay.update(camera, renderer.domElement.height);
      campus.updateTreeLOD(camera, compact.matches);
      campus.updateSceneryLOD(camera, compact.matches);
      sun.castShadow = !planMode && framedBounds && framedBounds.getSize(new THREE.Vector3()).length() < 600;
      contactShadowsActive = $('contact-shadows').checked && !planMode && framedBounds &&
        framedBounds.getSize(new THREE.Vector3()).length() < 600;
      reflections.update(camera, !planMode && framedBounds &&
        framedBounds.getSize(new THREE.Vector3()).length() < 380, forceReflections);
      drawScene(camera, Boolean(contactShadowsActive));
    } finally {renderer.info.autoReset = autoReset;}
  }
  const inspector = $('sidebar'), legend = $('layers');
  function panel(element, toggle, open) {
    element.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
  }
  panel(inspector, $('toggle-inspector'), !compact.matches);
  panel(legend, $('toggle-layers'), !compact.matches);
  function inspectionRegion() {
    const width = $('workspace').clientWidth, height = $('workspace').clientHeight;
    const margin = compact.matches ? 14 : 24;
    const top = Math.max(...['.toolbar', '.sitebar', 'header'].map(selector =>
      document.querySelector(selector).getBoundingClientRect().bottom)) + 16;
    const left = !compact.matches && !inspector.hidden ? inspector.getBoundingClientRect().right + 24 : margin;
    const bottom = !legend.hidden ? legend.getBoundingClientRect().top - 16 : height - 70;
    const y = Math.min(top, height - 100);
    return {x: left, y, width: Math.max(1, width - left - margin), height: Math.max(1, bottom - y)};
  }

  function resize() {
    const width = $('workspace').clientWidth, height = $('workspace').clientHeight;
    renderer.setSize(width, height, false);
    perspective.aspect = width / height;
    perspective.updateProjectionMatrix();
    const extent = span * 0.61;
    plan.left = -extent * width / height;
    plan.right = extent * width / height;
    plan.top = extent;
    plan.bottom = -extent;
    plan.updateProjectionMatrix();
    const sitebar = document.querySelector('.sitebar');
    $('message').style.top = `${sitebar.offsetTop + sitebar.offsetHeight + 12}px`;
    if (framedBounds && !walker.active) frame(framedBounds, framedPadding, camera.position.clone().sub(controls.target).normalize().toArray());
    if (knowledgeHall.active) knowledgeHall.focus();
    dirty = true;
  }
  function frame(targetBounds, padding = 1.15, direction = [0.33, 0.92, 1.1]) {
    if (walker.active) walker.exit();
    const damping = controls.enableDamping;
    controls.enableDamping = false;
    controls.update();
    controls.enableDamping = damping;
    framedBounds = targetBounds.clone();
    framedPadding = padding;
    if (planMode) {
      camera.up.set(0, 0, -1);
    } else {
      controls.maxPolarAngle = direction[1] < 0 ? Math.PI * 0.61 : Math.PI / 2.005;
      camera.up.set(0, 1, 0);
    }
    const middle = fitInspectionView(camera, targetBounds, {width: $('workspace').clientWidth,
      height: $('workspace').clientHeight, region: inspectionRegion(), padding,
      direction: planMode ? [0, 1, 0] : direction});
    controls.target.copy(middle);
    fitInspectionShadow(sun, targetBounds);
    controls.update();
    dirty = true;
  }
  function mode(usePlan) {
    if (walker.active) walker.exit();
    planMode = usePlan;
    camera = usePlan ? plan : perspective;
    controls.object = camera;
    controls.enableRotate = !usePlan;
    $('view-3d').classList.toggle('active', !usePlan);
    $('view-plan').classList.toggle('active', usePlan);
    $('view-3d').setAttribute('aria-pressed', String(!usePlan));
    $('view-plan').setAttribute('aria-pressed', String(usePlan));
    resize();
    frame(bounds);
  }
  function focusSelected() {
    if (!selected) return;
    const view = [...REFINEMENT_VIEWS, ...LANDMARK_SITES].find(site => site.featureId === selected.userData.featureId);
    frame(viewBounds(selectedPart || selected), 1.2, selectedPart?.userData.viewDirection || view?.viewDirection || selected.userData.viewDirection);
  }
  function focusFacade() {
    if (!selected) return;
    const detail = selected.children.find(child => child.userData.architectureLOD);
    const facade = detail?.userData.photoFacade;
    if (!facade) throw new Error('Selected building has no photo-supported facade view.');
    if (planMode) mode(false);
    selected.updateWorldMatrix(true, true);
    const box = new THREE.Box3(new THREE.Vector3(...facade.bounds.min), new THREE.Vector3(...facade.bounds.max))
      .applyMatrix4(detail.matrixWorld);
    const direction = new THREE.Vector3(...facade.viewDirection).transformDirection(detail.matrixWorld).toArray();
    frame(box, 1.15, direction);
  }
  function showKnowledge() {
    panel(inspector, $('toggle-inspector'), true);
    inspector.scrollTop = $('selection').offsetTop - 16;
  }
  function clearKnowledge() {
    $('building-knowledge').replaceChildren(); $('building-knowledge').hidden = true;
    delete $('building-knowledge').dataset.historyId;
    $('open-knowledge').hidden = true;
  }
  function select(id, focus = false, apartmentNumber = null, {revealKnowledge = false} = {}) {
    if (walker.active) walker.exit();
    const building = campus.objects.get(id);
    if (!building) throw new Error(`Campus object not found: ${id}`);
    if (campus.buildings.has(id)) campus.ensureArchitectureDetail(id);
    if (!building.visible) {
      $('only-refined').checked = false;
      $('architecture-family').value = '';
      filterObjects();
    }
    const numbers = building.userData.apartmentNumbers || [];
    const number = apartmentNumber ?? (numbers.length === 1 ? numbers[0] : null);
    const part = number === null ? null
      : building.children.find(child => child.userData.campusDetail)?.children.find(child => child.userData.apartmentNumber === number);
    if (number !== null && !part) throw new Error(`Apartment ${number} is not part of ${id}`);
    selected = building;
    selectedPart = part;
    $('sports-ground').value = '';
    $('zijing-apartment').value = part ? String(number) : '';
    if (compact.matches) panel(inspector, $('toggle-inspector'), false);
    highlight.box.setFromObject(building);
    highlight.visible = building.userData.refinementStatus !== 'detailed' && building.visible &&
      campus.layers[building.userData.kind].visible;
    const p = building.userData;
    $('appearance-building').value = p.appearanceProfileId || '';
    $('selection-name').textContent = part?.name || p.name || '未命名建筑';
    $('selection-fields').replaceChildren();
    for (const [label, value] of [
      ['编号', id], ['对象类型', p.kind === 'landmark' ? '地标' : '建筑'],
      ['模型占地', p.footprintArea === null ? '—' : `${Math.round(p.footprintArea).toLocaleString()} m²`],
      ['模型顶部', `${p.renderHeight.toFixed(2)} m`], ['模型底部', `${p.minHeight.toFixed(2)} m`],
      ['原点 X/Z', p.localOriginMeters.map(v => v.toFixed(1)).join(' / ') + ' m'],
      ...(p.refinementStatus === 'procedural' ? [
        ['建筑分型', ARCHITECTURE_FAMILIES[p.architectureFamily]],
        ['展示层数', `${p.estimatedFloors}层`],
      ] : []),
      ...(numbers.length ? [['楼号', `${numbers.join(' / ')}号楼`]] : []),
      ...(part ? [['当前分楼', `${number}号楼`]] : []),
    ]) {
      const term = document.createElement('dt'), detail = document.createElement('dd');
      term.textContent = label; detail.textContent = value;
      $('selection-fields').append(term, detail);
    }
    $('focus').hidden = $('export-building').hidden = false;
    $('focus-facade').hidden = !building.children.some(child => child.userData.photoFacade);
    $('selection-link').hidden = false;
    const permalink = new URL(location.href);
    permalink.search = '';
    if (part) permalink.searchParams.set('view', `zijing-${number}`);
    else permalink.searchParams.set('building', id);
    $('selection-link').href = permalink.href;
    const referenceSite = p.referenceSite || p.appearanceReferenceSite;
    renderKnowledgeCard($('building-knowledge'), referenceSite);
    $('open-knowledge').hidden = false;
    $('selected-references').hidden = !referenceSite || (__PHOTO_SITE_COUNT__ === 0 && !p.appearanceReferenceSite);
    if (referenceSite) {
      $('selected-references').href = outputPrefix
        + `reference-photos.html#${encodeURIComponent(referenceSite)}`;
      if (__PHOTO_SITE_COUNT__ === 0 && p.appearanceReferenceSite) {
        $('selected-references').href = p.appearanceReferencePages[0];
      }
    }
    if (focus) focusSelected();
    if (revealKnowledge) showKnowledge();
    dirty = true;
    return building;
  }
  function selectApartment(number) {
    const apartment = ZIJING_APARTMENTS.find(part => part.number === number);
    if (!apartment) throw new Error(`未知紫荆楼号：${number}`);
    if (planMode) mode(false);
    return select(apartment.featureId, true, number);
  }
  const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
  let pointerStart;
  renderer.domElement.addEventListener('pointerdown', event => { pointerStart = [event.clientX, event.clientY]; });
  renderer.domElement.addEventListener('pointerup', event => {
    if (event.button !== 0 || !pointerStart || Math.hypot(event.clientX - pointerStart[0], event.clientY - pointerStart[1]) > 5) return;
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    if (walker.active) {knowledgeHall.pick(pointer); return;}
    raycaster.setFromCamera(pointer, camera);
    const pickable = ['building', 'landmark'].filter(kind => campus.layers[kind].visible).map(kind => campus.layers[kind]);
    const hit = raycaster.intersectObjects(pickable, true).find(result => {
      if (!result.object.isMesh) return false;
      for (let object = result.object; object; object = object.parent) if (!object.visible) return false;
      return true;
    });
    if (!hit) return;
    if (hit.object.userData.architectureFarBatch) {
      const id = hit.object.userData.featureIds[hit.batchId];
      if (!id) throw new Error('远景建筑拾取未关联原地图编号。');
      select(id, false, null, {revealKnowledge: true});
      return;
    }
    if (hit.object.userData.campusDetailedBatch) {
      const identity = hit.object.userData.identities[hit.batchId];
      if (!identity) throw new Error('精细显示批次缺少原始建筑身份。');
      select(identity.featureId, false, identity.apartmentNumber, {revealKnowledge: true});
      return;
    }
    let target = hit.object, apartmentNumber = null;
    while (target && !target.userData.featureId) {
      if (target.userData.apartmentNumber) apartmentNumber = target.userData.apartmentNumber;
      target = target.parent;
    }
    if (target) select(target.userData.featureId, false, apartmentNumber, {revealKnowledge: true});
  });
  let resultPage = 0;
  const pageSize = 40;
  function search() {
    const query = $('search').value.trim().toLocaleLowerCase();
    const matches = objects.filter(([id, object]) =>
      (!$('only-refined').checked || object.userData.refinementStatus === 'detailed') &&
      (!$('architecture-family').value || object.userData.architectureFamily === $('architecture-family').value) &&
      `${id} ${object.userData.name || ''} ${(object.userData.aliases || []).join(' ')}`.toLocaleLowerCase().includes(query));
    matches.sort((a, b) => Number(Boolean(b[1].userData.name)) - Number(Boolean(a[1].userData.name)));
    resultPage = Math.max(0, Math.min(resultPage, Math.ceil(matches.length / pageSize) - 1));
    $('result-count').textContent = `${matches.length} 个结果`;
    $('results-page').textContent = `${resultPage + 1} / ${Math.max(1, Math.ceil(matches.length / pageSize))}`;
    $('results-prev').disabled = resultPage === 0;
    $('results-next').disabled = (resultPage + 1) * pageSize >= matches.length;
    const list = document.createDocumentFragment();
    for (const [id, object] of matches.slice(resultPage * pageSize, (resultPage + 1) * pageSize)) {
      const button = document.createElement('button');
      button.textContent = object.userData.name || '未命名建筑';
      const small = document.createElement('small');
      small.textContent = id;
      button.append(small);
      const numberMatch = query.match(/^(?:紫荆(?:(?:学生)?公寓)?)?(\d+)(?:号楼|号)?$/);
      const number = numberMatch ? Number(numberMatch[1]) : null;
      const partNumber = object.userData.apartmentNumbers?.includes(number) ? number : null;
      if (partNumber) button.firstChild.textContent = `紫荆学生公寓${partNumber}号楼`;
      button.addEventListener('click', () => select(id, true, partNumber, {revealKnowledge: true}));
      list.append(button);
    }
    $('results').replaceChildren(list);
  }
  async function exportSelectedModel() {
    const exportSelection = selected, exportPart = selectedPart;
    message('正在导出可编辑 GLB…', false, true);
    $('export-building').disabled = true;
    try {
      if (!exportSelection) throw new Error('请先选择建筑或地标。');
      const id = exportSelection.userData.featureId;
      if (campus.buildings.has(id)) campus.ensureArchitectureDetail(id);
      reflections.refresh();
      const {GLTFExporter} = await import('three/addons/exporters/GLTFExporter.js');
      const object = exportSelection.clone(!exportPart);
      if (exportPart) {
        object.add(exportPart.clone(true));
        Object.assign(object.userData, {selectedApartmentNumber: exportPart.userData.apartmentNumber,
          exportScope: 'Logical apartment within original frozen map root; source footprint identity is preserved.',
          sourceRootFootprintArea: object.userData.footprintArea,
          footprintArea: exportPart.userData.footprintArea,
          apartmentNumbers: [exportPart.userData.apartmentNumber]});
      }
      object.position.set(0, 0, 0);
      prepareDetailedExport(object);
      prepareArchitectureExport(object);
      reflections.prepareExport(object);
      object.updateMatrixWorld(true);
      const bytes = await new GLTFExporter().parseAsync(object, {binary: true, onlyVisible: true});
      save(bytes, exportPart ? `tsinghua-zijing-${exportPart.userData.apartmentNumber}.glb` : exportSelection.userData.exportFilename
        || `tsinghua-${exportSelection.userData.featureId.replace(/[^a-z0-9_-]/gi, '-')}.glb`, 'model/gltf-binary');
      message('选中对象 GLB 已导出，使用米制坐标及自身局部原点。');
      return bytes.byteLength;
    } catch (error) {
      console.error(error);
      message(`导出失败：${error.message}`, true);
      throw error;
    } finally {
      $('export-building').disabled = false;
    }
  }
  $('search').addEventListener('input', () => {resultPage = 0; search();});
  $('results-prev').addEventListener('click', () => {resultPage--; search();});
  $('results-next').addEventListener('click', () => {resultPage++; search();});
  for (const [value, label] of Object.entries(ARCHITECTURE_FAMILIES)) {
    const option = document.createElement('option'); option.value = value; option.textContent = label;
    $('architecture-family').append(option);
  }
  function filterObjects() {
    resultPage = 0;
    for (const object of campus.buildings.values()) object.visible =
      (!$('only-refined').checked || object.userData.refinementStatus === 'detailed') &&
      (!$('architecture-family').value || object.userData.architectureFamily === $('architecture-family').value);
    for (const object of campus.landmarks.values()) object.visible = !$('architecture-family').value;
    if (selected && !selected.visible) {
      selected = null; selectedPart = null; highlight.visible = false;
      $('zijing-apartment').value = '';
      $('appearance-building').value = '';
      $('selection-name').textContent = '选择筛选后的建筑或地标';
      $('selection-fields').replaceChildren();
      clearKnowledge();
      $('focus-facade').hidden = $('focus').hidden = $('export-building').hidden = $('selected-references').hidden = $('selection-link').hidden = true;
    }
    search(); reflections.invalidate(); dirty = true;
  }
  $('architecture-family').addEventListener('change', filterObjects);
  for (const apartment of ZIJING_APARTMENTS) {
    const option = document.createElement('option'); option.value = apartment.number;
    option.textContent = `${apartment.number}号楼${apartment.family === 'w-doctoral' ? ' · W楼' : ''}`;
    $('zijing-apartment').append(option);
  }
  $('zijing-apartment').addEventListener('change', event => {
    if (event.target.value) selectApartment(Number(event.target.value));
  });
  for (const profile of PHOTO_APPEARANCES) {
    const option = document.createElement('option'); option.value = profile.id; option.textContent = profile.name;
    $('appearance-building').append(option);
  }
  $('appearance-building').addEventListener('change', event => {
    if (!event.target.value) return;
    const profile = PHOTO_APPEARANCES.find(profile => profile.id === event.target.value);
    if (!profile) throw new Error(`未知实景配色建筑：${event.target.value}`);
    if (planMode) mode(false);
    select(profile.featureId, true);
  });
  function selectGround(id) {
    const ground = campus.sports.get(id);
    if (!ground) throw new Error(`Unknown mapped sports ground: ${id}`);
    if (planMode) mode(false);
    campus.layers.sports.visible = true;
    document.querySelector('[data-layer="sports"]').checked = true;
    selected = null; selectedPart = null; highlight.visible = false;
    clearKnowledge();
    $('appearance-building').value = ''; $('zijing-apartment').value = '';
    $('sports-ground').value = id;
    $('selection-name').textContent = ground.name || '地图运动场';
    $('selection-fields').replaceChildren();
    for (const [label, value] of [['编号', ground.id], ['运动类型', ground.sport || '未标注']]) {
      const term = document.createElement('dt'), detail = document.createElement('dd');
      term.textContent = label; detail.textContent = value; $('selection-fields').append(term, detail);
    }
    $('focus-facade').hidden = $('focus').hidden = $('export-building').hidden = true;
    $('selected-references').hidden = false;
    $('selected-references').href = `https://www.openstreetmap.org/way/${id.split(':').at(-1)}`;
    const link = new URL(location.href); link.search = ''; link.searchParams.set('ground', id);
    $('selection-link').hidden = false; $('selection-link').href = link.href;
    if (compact.matches) panel(inspector, $('toggle-inspector'), false);
    const [x0, z0, x1, z1] = ground.bounds;
    frame(new THREE.Box3(new THREE.Vector3(x0, 0, z0), new THREE.Vector3(x1, 4, z1)), 1.15, [.2, 1.2, 1]);
  }
  const primaryGrounds = ['osm:way:32954674', 'osm:way:32954848', 'osm:way:32954864'];
  for (const id of primaryGrounds) {
    const ground = campus.sports.get(id);
    if (!ground) throw new Error(`Required playground missing from frozen evidence: ${id}`);
    const option = document.createElement('option'); option.value = id; option.textContent = ground.name;
    $('sports-ground').append(option);
  }
  $('sports-ground').addEventListener('change', event => {if (event.target.value) selectGround(event.target.value);});
  $('only-refined').addEventListener('change', filterObjects);
  $('view-3d').addEventListener('click', () => mode(false));
  $('architecture-details').addEventListener('change', () => {reflections.invalidate(); dirty = true;});
  $('contact-shadows').addEventListener('change', () => {dirty = true;});
  $('scene-reflections').addEventListener('change', () => {
    reflections.setEnabled($('scene-reflections').checked); dirty = true;
  });
  $('view-plan').addEventListener('click', () => mode(true));
  $('view-all').addEventListener('click', () => frame(bounds));
  function visitBuilding(id) {
    let anchor;
    campus.group.traverse(object => {if (object.userData.walkthrough?.id === id) anchor = object;});
    if (!anchor) throw new Error('此建筑暂未提供可进入的门厅。');
    let root = anchor;
    while (root && !root.userData.featureId) root = root.parent;
    if (!root) throw new Error('Visitor lobby has no original building identity.');
    if (planMode) mode(false);
    campus.layers.building.visible = true;
    document.querySelector('[data-layer="building"]').checked = true;
    reflections.invalidate();
    select(root.userData.featureId, true);
    $('visit-building').value = id;
    walker.enter(anchor);
  }
  $('visit-building').addEventListener('change', event => {
    if (event.target.value) {
      try {visitBuilding(event.target.value);}
      catch (error) {console.error(error); message(`进入失败：${error.message}`, true);}
    }
  });
  $('enter-knowledge-hall').addEventListener('click', () => {
    try {visitBuilding('shunde');}
    catch (error) {console.error(error); message(`进入知识门厅失败：${error.message}`, true);}
  });
  function viewScenery(name) {
    const view = campus.scenery.views[name];
    if (!view) throw new Error(`Unknown scenery view: ${name}`);
    if (planMode) mode(false);
    const center = new THREE.Vector3(...view.center), half = new THREE.Vector3(...view.size).multiplyScalar(.5);
    frame(new THREE.Box3(center.clone().sub(half), center.clone().add(half)), 1.12, view.direction);
    message(name === 'riverside' ? '河岸近景' : '校园街景');
  }
  for (const name of Object.keys(campus.scenery.views)) $(`view-${name}`).addEventListener('click', () => viewScenery(name));
  for (const [toggle, element] of [[$('toggle-inspector'), inspector], [$('toggle-layers'), legend]]) {
    toggle.addEventListener('click', () => {
      panel(element, toggle, element.hidden);
      frame(framedBounds, framedPadding, camera.position.clone().sub(controls.target).normalize().toArray());
    });
  }
  $('focus').addEventListener('click', focusSelected);
  $('open-knowledge').addEventListener('click', showKnowledge);
  $('focus-facade').addEventListener('click', focusFacade);
  $('view-north').addEventListener('click', () => {
    const region = bounds.clone(); region.max.z = bounds.min.z + size.z * 0.43; frame(region, 1.2);
  });
  $('view-south').addEventListener('click', () => {
    const region = bounds.clone(); region.min.z = bounds.min.z + size.z * 0.43; frame(region, 1.2);
  });
  for (const site of [...REFINEMENT_VIEWS, ...LANDMARK_SITES]) {
    if (!site.buttonId) continue;
    $(site.buttonId).addEventListener('click', () => {
      if (planMode) mode(false);
      const target = select(site.featureId);
      const focus = site.focusObject ? target.getObjectByName(site.focusObject) : target;
      if (!focus) throw new Error(`Missing registered inspection component: ${site.focusObject}`);
      const box = viewBounds(focus);
      for (const id of site.groupFeatureIds || []) box.union(viewBounds(campus.objects.get(id)));
      frame(box, 1.12, site.viewDirection);
    });
  }
  if (__PHOTO_SITE_COUNT__ > 0) {
    $('references').hidden = false;
    $('references').addEventListener('click', () => {
      window.open(`${outputPrefix}reference-photos.html`, '_blank', 'noopener');
    });
  }
  // exportSelectedModel reports the failure in the UI before rejecting.
  $('export-building').addEventListener('click', () => { void exportSelectedModel().catch(error => console.error('Building export failed', error)); });
  document.querySelectorAll('[data-layer]').forEach(input => input.addEventListener('change', () => {
    campus.layers[input.dataset.layer].visible = input.checked;
    reflections.invalidate();
    if (selected?.userData.kind === input.dataset.layer) highlight.visible =
      selected.userData.refinementStatus !== 'detailed' && input.checked && selected.visible;
    dirty = true;
  }));
  $('building-count').textContent = buildings.length.toLocaleString();
  $('named-count').textContent = data.features.filter(feature =>
    feature.properties.kind === 'building' && feature.properties.name).length.toLocaleString();
  window.addEventListener('resize', resize);
  compact.addEventListener('change', () => {
    $('contact-shadows').checked = !compact.matches;
    panel(inspector, $('toggle-inspector'), !compact.matches);
    panel(legend, $('toggle-layers'), !compact.matches);
    resize();
  });
  renderer.domElement.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    message('显卡上下文已中断，请刷新页面重新加载。', true);
  });
  resize(); frame(bounds); search();
  const requestedBuilding = new URLSearchParams(location.search).get('building');
  const requestedView = new URLSearchParams(location.search).get('view');
  const requestedGround = new URLSearchParams(location.search).get('ground');
  const requestedVisit = new URLSearchParams(location.search).get('visit');
  if ([requestedBuilding, requestedView, requestedGround, requestedVisit].filter(Boolean).length > 1) throw new Error('建筑编号、操场、室内漫游与快捷视角不能同时指定。');
  if (requestedBuilding) select(requestedBuilding, true);
  if (requestedGround) selectGround(requestedGround);
  if (requestedView) {
    if (Object.hasOwn(campus.scenery.views, requestedView)) viewScenery(requestedView);
    else if (/^zijing-(?:[1-9]|1\d|2[0-3])$/.test(requestedView)) selectApartment(Number(requestedView.slice(7)));
    else {
      const view = [...REFINEMENT_VIEWS, ...LANDMARK_SITES].find(site => site.buttonId === `view-${requestedView}`);
      if (!view) throw new Error(`未知重建视角：${requestedView}`);
      $(view.buttonId).click();
    }
  }
  if (requestedVisit) visitBuilding(requestedVisit);
  let lastFrame = performance.now();
  function render() {
    const now = performance.now();
    walker.update((now - lastFrame) / 1000); lastFrame = now;
    if (!$('scene-motion').checked || document.hidden) lastMotion = now;
    else if (now - lastMotion >= 1000 / 30) {
      setSceneTime(sceneTime + Math.min(.1, (now - lastMotion) / 1000)); lastMotion = now;
    }
    if (!walker.active) controls.update();
    if (dirty || campus.architecturePending || reflections.pending()) {
      draw();
      $('north').textContent = planMode ? 'N ↑ 北' : 'N · -Z';
      dirty = false;
    }
    requestAnimationFrame(render);
  }
  render();
  window.campusApp = {
    ready: true, campus, data, coverage, select, selectApartment, selectGround, mode, exportSelectedModel, setSceneTime, detailedDisplay,
    visitBuilding, walkthrough: {state: walker.state, exit: walker.exit},
    knowledgeHall: {state: knowledgeHall.snapshot, pickTargets: knowledgeHall.pickTargets},
    selectedApartment: () => selectedPart?.userData.apartmentNumber ?? null,
    stats: {buildings: buildings.length, features: data.features.length, refined: refinedIds.length, architecture: coverage.counts.architectureModelBuildingObjects,
      procedural: architectureIds.length,
      refinedSites: refinedSiteCount, landmarks: landmarkIds.length, reconstructedSites: siteCount, landscape: landscapeStats},
    render: draw,
    inspection: () => ({region: inspectionRegion(), camera, bounds: framedBounds.clone(),
      rendering: {environment: Boolean(scene.environment), contactShadows: Boolean(contactShadowsActive),
        toneMapping: renderer.toneMapping, environmentIntensity: scene.environmentIntensity,
        calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, geometries: renderer.info.memory.geometries,
        textures: renderer.info.memory.textures, reflections: reflections.stats(), scenery: campus.scenery.stats(),
        detailedDisplay: detailedDisplay.stats()},
      shadowTexelMeters: (sun.shadow.camera.right - sun.shadow.camera.left) / sun.shadow.mapSize.x}),
  };
  draw();
  performance.mark('campus-ready');
  window.addEventListener('pagehide', event => {
    if (!event.persisted) {knowledgeHall.dispose(); walker.dispose();}
  });
  $('loading').hidden = true;
  $('workspace').setAttribute('aria-busy', 'false');
  message('选择建筑，查看知识卡片。');
}

main().catch(error => {
  console.error(error);
  window.campusError = String(error);
  $('loading').hidden = true;
  $('workspace').setAttribute('aria-busy', 'false');
  message(`校园模型加载失败：${error.message}。请确认数据与构建步骤已完成。`, true);
});
