import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import data from '../data/campus.json';
import {createCampusModel} from './model.js';
import {applyCampusRefinements, REFINEMENT_VIEWS} from './refinements.js';
import {applyCampusLandmarks, LANDMARK_SITES} from './landmarks.js';
import {createCoverage} from './coverage.js';
import catalog from '../reference-catalog.json';
import {viewBounds} from './view-bounds.js';
import {fitInspectionView, fitInspectionShadow} from './inspection-view.js';

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
  renderer.setClearColor('#edf0e7');
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#ffffff', '#a1b195', 1.2));
  const sun = new THREE.DirectionalLight('#fff7e8', 2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  scene.add(sun, sun.target);
  const campus = createCampusModel(data);
  const refinedIds = applyCampusRefinements(campus, data);
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
  let camera = perspective, planMode = false, selected = null;
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.12;
  controls.minDistance = 8;
  controls.maxDistance = 13000;
  controls.maxPolarAngle = Math.PI / 2.05;
  controls.minZoom = 0.15;
  controls.maxZoom = 45;
  let dirty = true;
  controls.addEventListener('change', () => { dirty = true; });
  const highlight = new THREE.Box3Helper(new THREE.Box3(), '#784b91');
  highlight.visible = false;
  scene.add(highlight);
  const selectionMaterial = new THREE.MeshStandardMaterial({color: '#ae89bf', roughness: 0.75});
  const originalMaterials = new Map();
  const buildings = [...campus.buildings.entries()];
  const objects = [...campus.objects.entries()];
  let framedBounds = null, framedPadding = 1.3;
  const compact = window.matchMedia('(max-width: 850px)');
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
      controls.maxPolarAngle = direction[1] < 0 ? Math.PI * 0.61 : Math.PI / 2.05;
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
  function select(id, focus = false) {
    const building = campus.objects.get(id);
    if (!building) throw new Error(`Campus object not found: ${id}`);
    for (const [mesh, material] of originalMaterials) mesh.material = material;
    originalMaterials.clear();
    selected = building;
    if (compact.matches) panel(inspector, $('toggle-inspector'), false);
    building.traverse(object => {
      if (object.isMesh && building.userData.refinementStatus !== 'detailed') {
        originalMaterials.set(object, object.material);
        object.material = selectionMaterial;
      }
    });
    highlight.box.setFromObject(building);
    highlight.visible = building.userData.refinementStatus !== 'detailed' && building.visible &&
      campus.layers[building.userData.kind].visible;
    const p = building.userData;
    $('selection-name').textContent = p.name || '未命名建筑';
    $('selection-help').textContent = building.userData.refinementStatus === 'detailed'
      ? building.userData.refinementSummary
      : '当前为轮廓拉伸基模。楼高、屋顶与立面尚未逐栋核实，不代表实测建筑。';
    $('selection-fields').replaceChildren();
    for (const [label, value] of [
      ['编号', id], ['对象类型', p.kind === 'landmark' ? '独立地标 · 非地图建筑轮廓' : '地图建筑轮廓'],
      ['占地', p.footprintArea === null ? '无测绘轮廓，不标注占地' : `${Math.round(p.footprintArea).toLocaleString()} m²`],
      ['顶部标高', `${p.renderHeight.toFixed(2)} m`], ['底部标高', `${p.minHeight.toFixed(2)} m`],
      ['高度来源', p.heightSource || '来源未标注'],
      ['原点 X/Z', p.localOriginMeters.map(v => v.toFixed(1)).join(' / ') + ' m'],
      ...(p.kind === 'landmark' ? [['位置来源', `OSM node ${p.mapSource.id.split(':').at(-1)} · 社区地图点位，非测绘`]] : []),
      ['重建状态', p.refinementStatus === 'detailed' ? '照片参照重建 · 非测绘' : '基模 · 待照片重建'],
      ...(p.refinementStatus === 'detailed'
        ? [['重建范围', p.reconstructionExtent === 'partial' ? '局部重建 · 仍需完善其他区域' : '轮廓范围内外观估算 · 细节含推定']] : []),
    ]) {
      const term = document.createElement('dt'), detail = document.createElement('dd');
      term.textContent = label; detail.textContent = value;
      $('selection-fields').append(term, detail);
    }
    $('focus').hidden = $('export-building').hidden = false;
    $('selected-references').hidden = !p.referenceSite || __PHOTO_SITE_COUNT__ === 0;
    if (p.referenceSite) {
      $('selected-references').href = outputPrefix
        + `reference-photos.html#${encodeURIComponent(p.referenceSite)}`;
    }
    if (focus) frame(viewBounds(building), 1.2);
    dirty = true;
    return building;
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
    let target = hit.object;
    while (target && !target.userData.featureId) target = target.parent;
    if (target) select(target.userData.featureId);
  });
  function search() {
    const query = $('search').value.trim().toLocaleLowerCase();
    const matches = objects.filter(([id, object]) =>
      (!$('only-refined').checked || object.userData.refinementStatus === 'detailed') &&
      `${id} ${object.userData.name || ''} ${(object.userData.aliases || []).join(' ')}`.toLocaleLowerCase().includes(query));
    matches.sort((a, b) => Number(Boolean(b[1].userData.name)) - Number(Boolean(a[1].userData.name)));
    $('result-count').textContent = `${matches.length} 个结果${matches.length > 50 ? ' · 显示前 50 个' : ''}`;
    const list = document.createDocumentFragment();
    for (const [id, object] of matches.slice(0, 50)) {
      const button = document.createElement('button');
      button.textContent = object.userData.name || '未命名建筑';
      const small = document.createElement('small');
      small.textContent = id;
      button.append(small);
      button.addEventListener('click', () => select(id, true));
      list.append(button);
    }
    $('results').replaceChildren(list);
  }
  async function exportModel(whole = true) {
    message('正在导出可编辑 GLB…', false, true);
    $('export-all').disabled = $('export-building').disabled = true;
    try {
      const object = whole ? campus.group.clone(true) : selected?.clone(true);
      if (!object) throw new Error('请先选择建筑或地标。');
      object.traverse(child => {
        if (child.isMesh && child.material === selectionMaterial) {
          const original = [...originalMaterials.keys()].find(mesh => mesh.geometry === child.geometry);
          if (original) child.material = originalMaterials.get(original);
        }
      });
      if (!whole) object.position.set(0, 0, 0);
      object.updateMatrixWorld(true);
      const bytes = await new GLTFExporter().parseAsync(object, {binary: true, onlyVisible: true});
      save(bytes, whole ? 'tsinghua-campus-refined.glb' : selected.userData.exportFilename
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
  $('search').addEventListener('input', search);
  $('only-refined').addEventListener('change', () => {
    for (const object of campus.buildings.values()) {
      object.visible = !$('only-refined').checked || object.userData.refinementStatus === 'detailed';
    }
    if (selected && !selected.visible) {
      for (const [mesh, material] of originalMaterials) mesh.material = material;
      originalMaterials.clear();
      selected = null;
      highlight.visible = false;
      $('selection-name').textContent = '选择已重建建筑或地标';
      $('selection-help').textContent = '基模已暂时隐藏；点击已重建对象或使用上方快捷视角。';
      $('selection-fields').replaceChildren();
      $('focus').hidden = $('export-building').hidden = $('selected-references').hidden = true;
    } else if (selected) highlight.visible = selected.userData.refinementStatus !== 'detailed' &&
      campus.layers[selected.userData.kind].visible;
    else {
      $('selection-name').textContent = '选择建筑或地标';
      $('selection-help').textContent = '点击地图上的对象，或搜索名称与编号。未重建对象仍保留原轮廓基模。';
    }
    search();
    dirty = true;
  });
  $('view-3d').addEventListener('click', () => mode(false));
  $('view-plan').addEventListener('click', () => mode(true));
  $('view-all').addEventListener('click', () => frame(bounds));
  for (const [toggle, element] of [[$('toggle-inspector'), inspector], [$('toggle-layers'), legend]]) {
    toggle.addEventListener('click', () => {
      panel(element, toggle, element.hidden);
      frame(framedBounds, framedPadding, camera.position.clone().sub(controls.target).normalize().toArray());
    });
  }
  $('focus').addEventListener('click', () => selected && frame(viewBounds(selected), 1.2));
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
  $('landmark-count').textContent = landmarkIds.length;
  $('coverage-note').textContent = `${refinedIds.length} / ${buildings.length} 个地图轮廓已有照片参照模型；`
    + `${coverage.counts.remainingBaseBuildingObjects} 个仍为基模，${coverage.counts.partialPhotoModelBuildingObjects} 个仅做了局部。含推定，不代表完整复刻。`;
  $('source-note').textContent = '北京主校区 · OSM 校园范围，非测绘边界。多数地图楼高仅为显示值，待逐栋重建。'
    + `已接入 ${siteCount} 处照片参照重建（${refinedIds.length} 个轮廓、${landmarkIds.length} 个独立地标）；隐藏立面及部分尺寸含推定。`;
  window.addEventListener('resize', resize);
  compact.addEventListener('change', () => {
    panel(inspector, $('toggle-inspector'), !compact.matches);
    panel(legend, $('toggle-layers'), !compact.matches);
    resize();
  });
  renderer.domElement.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    message('显卡上下文已中断，请刷新页面重新加载。', true);
  });
  resize(); frame(bounds); search();
  const requestedView = new URLSearchParams(location.search).get('view');
  if (requestedView) {
    const view = [...REFINEMENT_VIEWS, ...LANDMARK_SITES].find(site => site.buttonId === `view-${requestedView}`);
    if (!view) throw new Error(`未知重建视角：${requestedView}`);
    $(view.buttonId).click();
  }
  function render() {
    controls.update();
    if (dirty) {
      renderer.render(scene, camera);
      $('north').textContent = planMode ? 'N ↑ 北' : 'N · -Z';
      dirty = false;
    }
    requestAnimationFrame(render);
  }
  render();
  window.campusApp = {
    ready: true, campus, data, coverage, select, mode, exportModel,
    stats: {buildings: buildings.length, features: data.features.length, refined: refinedIds.length,
      refinedSites: refinedSiteCount, landmarks: landmarkIds.length, reconstructedSites: siteCount},
    render: () => renderer.render(scene, camera),
    inspection: () => ({region: inspectionRegion(), camera, bounds: framedBounds.clone(),
      shadowTexelMeters: (sun.shadow.camera.right - sun.shadow.camera.left) / sun.shadow.mapSize.x}),
  };
  message(`已加载 ${buildings.length} 个建筑体块、${siteCount} 处照片参照重建。点击地标查看细节；尺寸与隐蔽面仍为估算。`);
}

try { main(); }
catch (error) {
  console.error(error);
  window.campusError = String(error);
  message(`校园模型加载失败：${error.message}。请确认数据与构建步骤已完成。`, true);
}
