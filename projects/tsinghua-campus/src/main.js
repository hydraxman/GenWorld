import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import data from '../data/campus.json';
import {createCampusModel} from './model.js';
import {applyCampusRefinements, REFINEMENT_VIEWS} from './refinements.js';
import {applyCampusLandmarks, LANDMARK_SITES} from './landmarks.js';
import {createCoverage} from './coverage.js';
import catalog from './reference-catalog.js';
import {viewBounds} from './view-bounds.js';
import {fitInspectionView, fitInspectionShadow} from './inspection-view.js';
import {createCampusDaylight} from './daylight.js';
import {createCampusRenderPipeline} from './render-pipeline.js';
import {ZIJING_APARTMENTS} from './zijing-sources.js';
import {applyCampusArchitecture, prepareArchitectureExport, ARCHITECTURE_FAMILIES} from './campus-architecture.js';
import {PHOTO_APPEARANCES} from './photo-appearance.js';

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

function main() {
  const renderer = new THREE.WebGLRenderer({canvas: $('scene'), antialias: true, preserveDrawingBuffer: true});
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  const scene = new THREE.Scene();
  const sun = createCampusDaylight(renderer, scene);
  const drawScene = createCampusRenderPipeline(renderer, scene);
  const campus = createCampusModel(data);
  const refinedIds = applyCampusRefinements(campus, data);
  const architectureIds = applyCampusArchitecture(campus, data);
  const landmarkIds = applyCampusLandmarks(campus, data);
  const refinedSiteCount = new Set(refinedIds.map(id => campus.buildings.get(id).userData.referenceSite)).size;
  const siteCount = refinedSiteCount + landmarkIds.length;
  const coverage = createCoverage(campus, data, catalog);
  scene.add(campus.group);
  const bounds = new THREE.Box3().setFromObject(campus.group);
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  const span = Math.max(size.x, size.z);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(span * 5, span * 5),
    new THREE.MeshStandardMaterial({color: '#e7ecde', roughness: 1}));
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
  const compact = window.matchMedia('(max-width: 850px)');
  $('contact-shadows').checked = !compact.matches;
  let contactShadowsActive = false;
  function draw() {
    campus.updateArchitectureLOD(camera, $('architecture-details').checked);
    contactShadowsActive = $('contact-shadows').checked && !planMode && framedBounds &&
      framedBounds.getSize(new THREE.Vector3()).length() < 600;
    drawScene(camera, Boolean(contactShadowsActive));
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
    if (framedBounds) frame(framedBounds, framedPadding, camera.position.clone().sub(controls.target).normalize().toArray());
    dirty = true;
  }
  function frame(targetBounds, padding = 1.15, direction = [0.33, 0.92, 1.1]) {
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
  function select(id, focus = false, apartmentNumber = null) {
    const building = campus.objects.get(id);
    if (!building) throw new Error(`Campus object not found: ${id}`);
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
    $('zijing-apartment').value = part ? String(number) : '';
    if (compact.matches) panel(inspector, $('toggle-inspector'), false);
    highlight.box.setFromObject(building);
    highlight.visible = building.userData.refinementStatus !== 'detailed' && building.visible &&
      campus.layers[building.userData.kind].visible;
    const p = building.userData;
    $('appearance-building').value = p.appearanceProfileId || '';
    $('selection-name').textContent = part?.name || p.name || '未命名建筑';
    $('selection-help').textContent = building.userData.refinementStatus !== 'base'
      ? building.userData.refinementSummary
      : `当前为轮廓基模。${building.userData.baseFacadeSource} 楼高和屋顶亦非实测。`;
    $('selection-fields').replaceChildren();
    for (const [label, value] of [
      ['编号', id], ['对象类型', p.kind === 'landmark' ? '独立地标 · 非地图建筑轮廓' : '地图建筑轮廓'],
      ['占地', p.footprintArea === null ? '无测绘轮廓，不标注占地' : `${Math.round(p.footprintArea).toLocaleString()} m²`],
      ['顶部标高', `${p.renderHeight.toFixed(2)} m`], ['底部标高', `${p.minHeight.toFixed(2)} m`],
      ['高度来源', p.heightSource || '来源未标注'],
      ['原点 X/Z', p.localOriginMeters.map(v => v.toFixed(1)).join(' / ') + ' m'],
      ...(p.kind === 'landmark' ? [['位置来源', `OSM node ${p.mapSource.id.split(':').at(-1)} · 社区地图点位，非测绘`]] : []),
      ['重建状态', p.refinementStatus === 'detailed'
        ? p.referenceBasis === 'group-photo-typology-estimate' ? '照片参照重建 · 组团类型推定，非逐栋照片验证' : '照片参照重建 · 非测绘'
        : p.appearanceProfileId ? '程序建筑估算 · 对应照片配色／局部特征，非逐面复原'
          : p.refinementStatus === 'procedural' ? '程序建筑估算 · 未逐栋照片验证' : '基模 · 待照片重建'],
      ...(p.refinementStatus === 'procedural' ? [
        ['建筑分型', ARCHITECTURE_FAMILIES[p.architectureFamily]],
        ['类型依据', p.architectureSource.sourceId || '无可靠建筑标签，未推断用途'],
        ['楼层节奏', `${p.estimatedFloors}层 · ${p.floorsSource}`],
      ] : []),
      ...(p.appearanceProfileId ? [['照片依据', p.appearanceReferencePages.join(' · ')],
        ['外观范围', '照片约束配色与有限可见特征；全轮廓与未入镜表面仍为估算']] : []),
      ...(numbers.length ? [['楼号', numbers.length > 1 ? `${numbers.join(' / ')} 共用一个原地图根` : `${numbers[0]}号楼`]] : []),
      ...(part ? [['当前分楼', `${number}号楼 · ${part.userData.estimatedFloors}层外观节奏`],
        ['楼层依据', part.userData.floorsSource]] : []),
      ...(p.refinementStatus === 'detailed'
        ? [['重建范围', p.reconstructionExtent === 'partial' ? '局部重建 · 仍需完善其他区域' : '轮廓范围内外观估算 · 细节含推定']] : []),
    ]) {
      const term = document.createElement('dt'), detail = document.createElement('dd');
      term.textContent = label; detail.textContent = value;
      $('selection-fields').append(term, detail);
    }
    $('focus').hidden = $('export-building').hidden = false;
    $('selection-link').hidden = false;
    const permalink = new URL(location.href);
    permalink.search = '';
    if (part) permalink.searchParams.set('view', `zijing-${number}`);
    else permalink.searchParams.set('building', id);
    $('selection-link').href = permalink.href;
    const referenceSite = p.referenceSite || p.appearanceReferenceSite;
    $('selected-references').hidden = !referenceSite || (__PHOTO_SITE_COUNT__ === 0 && !p.appearanceReferenceSite);
    if (referenceSite) {
      $('selected-references').href = outputPrefix
        + `reference-photos.html#${encodeURIComponent(referenceSite)}`;
      if (__PHOTO_SITE_COUNT__ === 0 && p.appearanceReferenceSite) {
        $('selected-references').href = p.appearanceReferencePages[0];
      }
    }
    if (focus) focusSelected();
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
      select(id);
      return;
    }
    let target = hit.object, apartmentNumber = null;
    while (target && !target.userData.featureId) {
      if (target.userData.apartmentNumber) apartmentNumber = target.userData.apartmentNumber;
      target = target.parent;
    }
    if (target) select(target.userData.featureId, false, apartmentNumber);
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
      button.addEventListener('click', () => select(id, true, partNumber));
      list.append(button);
    }
    $('results').replaceChildren(list);
  }
  async function exportModel(whole = true) {
    message('正在导出可编辑 GLB…', false, true);
    $('export-all').disabled = $('export-building').disabled = true;
    try {
      const object = whole ? campus.group.clone(true) : selected?.clone(!selectedPart);
      if (!object) throw new Error('请先选择建筑或地标。');
      if (!whole && selectedPart) {
        object.add(selectedPart.clone(true));
        Object.assign(object.userData, {selectedApartmentNumber: selectedPart.userData.apartmentNumber,
          exportScope: 'Logical apartment within original frozen map root; source footprint identity is preserved.',
          sourceRootFootprintArea: object.userData.footprintArea,
          footprintArea: selectedPart.userData.footprintArea,
          apartmentNumbers: [selectedPart.userData.apartmentNumber]});
      }
      if (!whole) object.position.set(0, 0, 0);
      prepareArchitectureExport(object);
      object.updateMatrixWorld(true);
      const bytes = await new GLTFExporter().parseAsync(object, {binary: true, onlyVisible: true});
      save(bytes, whole ? 'tsinghua-campus-refined.glb' : selectedPart ? `tsinghua-zijing-${selectedPart.userData.apartmentNumber}.glb` : selected.userData.exportFilename
        || `tsinghua-${selected.userData.featureId.replace(/[^a-z0-9_-]/gi, '-')}.glb`, 'model/gltf-binary');
      message('GLB 已导出。使用米制坐标；校园导出包含当前开启图层及筛选后可见对象。');
      return bytes.byteLength;
    } catch (error) {
      console.error(error);
      message(`导出失败：${error.message}`, true);
      throw error;
    } finally {
      $('export-all').disabled = $('export-building').disabled = false;
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
      $('selection-help').textContent = '可切换类型筛选，或通过目录逐页查看全部建筑。';
      $('selection-fields').replaceChildren();
      $('focus').hidden = $('export-building').hidden = $('selected-references').hidden = $('selection-link').hidden = true;
    }
    search(); dirty = true;
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
  $('only-refined').addEventListener('change', filterObjects);
  $('view-3d').addEventListener('click', () => mode(false));
  $('architecture-details').addEventListener('change', () => {dirty = true;});
  $('contact-shadows').addEventListener('change', () => {dirty = true;});
  $('view-plan').addEventListener('click', () => mode(true));
  $('view-all').addEventListener('click', () => frame(bounds));
  for (const [toggle, element] of [[$('toggle-inspector'), inspector], [$('toggle-layers'), legend]]) {
    toggle.addEventListener('click', () => {
      panel(element, toggle, element.hidden);
      frame(framedBounds, framedPadding, camera.position.clone().sub(controls.target).normalize().toArray());
    });
  }
  $('focus').addEventListener('click', focusSelected);
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
      const box = viewBounds(target);
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
  // exportModel reports the failure in the UI before rejecting.
  $('export-all').addEventListener('click', () => { void exportModel(true).catch(error => console.error('Campus export failed', error)); });
  $('export-building').addEventListener('click', () => { void exportModel(false).catch(error => console.error('Building export failed', error)); });
  document.querySelectorAll('[data-layer]').forEach(input => input.addEventListener('change', () => {
    campus.layers[input.dataset.layer].visible = input.checked;
    if (selected?.userData.kind === input.dataset.layer) highlight.visible =
      selected.userData.refinementStatus !== 'detailed' && input.checked && selected.visible;
    dirty = true;
  }));
  $('building-count').textContent = buildings.length.toLocaleString();
  $('named-count').textContent = data.features.filter(feature =>
    feature.properties.kind === 'building' && feature.properties.name).length.toLocaleString();
  $('refined-count').textContent = refinedIds.length;
  $('architecture-count').textContent = coverage.counts.architectureModelBuildingObjects;
  $('landmark-count').textContent = landmarkIds.length;
  $('coverage-note').textContent = `${coverage.counts.architectureModelBuildingObjects} / ${buildings.length} 个地图轮廓已有建筑结构，`
    + `${architectureIds.length}个为程序估算，${refinedIds.length}个为照片参照；`
    + `程序外壳中${coverage.counts.photoAppearanceBuildingObjects}个新增了对应照片配色／有限特征，仍非逐面复原。`
    + `其中${coverage.counts.groupTypologyBuildingObjects}个是组团类型推定，涵盖紫荆1–23号楼（14–17共用一个地图根）。`
    + `${coverage.counts.remainingBaseBuildingObjects} 个仅有基模；${coverage.counts.partialPhotoModelBuildingObjects} 个照片模型仅做了局部。覆盖不等于真实还原。`;
  $('source-note').textContent = '北京主校区 · 冻结地图650轮廓均有建筑结构，非测绘边界或最新建筑清单。'
    + `已接入 ${siteCount} 处照片参照重建（${refinedIds.length} 个轮廓、${landmarkIds.length} 个独立地标）；隐藏立面及部分尺寸含推定。`;
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
  if (requestedBuilding && requestedView) throw new Error('建筑编号与快捷视角不能同时指定。');
  if (requestedBuilding) select(requestedBuilding, true);
  if (requestedView) {
    if (/^zijing-(?:[1-9]|1\d|2[0-3])$/.test(requestedView)) selectApartment(Number(requestedView.slice(7)));
    else {
      const view = [...REFINEMENT_VIEWS, ...LANDMARK_SITES].find(site => site.buttonId === `view-${requestedView}`);
      if (!view) throw new Error(`未知重建视角：${requestedView}`);
      $(view.buttonId).click();
    }
  }
  function render() {
    controls.update();
    if (dirty) {
      draw();
      $('north').textContent = planMode ? 'N ↑ 北' : 'N · -Z';
      dirty = false;
    }
    requestAnimationFrame(render);
  }
  render();
  window.campusApp = {
    ready: true, campus, data, coverage, select, selectApartment, mode, exportModel,
    selectedApartment: () => selectedPart?.userData.apartmentNumber ?? null,
    stats: {buildings: buildings.length, features: data.features.length, refined: refinedIds.length, architecture: coverage.counts.architectureModelBuildingObjects,
      procedural: architectureIds.length,
      refinedSites: refinedSiteCount, landmarks: landmarkIds.length, reconstructedSites: siteCount},
    render: draw,
    inspection: () => ({region: inspectionRegion(), camera, bounds: framedBounds.clone(),
      rendering: {environment: Boolean(scene.environment), contactShadows: Boolean(contactShadowsActive),
        toneMapping: renderer.toneMapping, environmentIntensity: scene.environmentIntensity,
        calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, geometries: renderer.info.memory.geometries,
        textures: renderer.info.memory.textures},
      shadowTexelMeters: (sun.shadow.camera.right - sun.shadow.camera.left) / sun.shadow.mapSize.x}),
  };
  message(`已覆盖 ${buildings.length} 个冻结建筑轮廓：${architectureIds.length} 个程序估算、${refinedIds.length} 个照片参照。覆盖不等于照片级还原。`);
}

try { main(); }
catch (error) {
  console.error(error);
  window.campusError = String(error);
  message(`校园模型加载失败：${error.message}。请确认数据与构建步骤已完成。`, true);
}
