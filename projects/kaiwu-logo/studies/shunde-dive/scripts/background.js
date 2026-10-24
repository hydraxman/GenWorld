import {createShundeModel} from '../../../../shunde/src/model.js';
import {installGlassReflections} from '../../../../../shared/glass-reflections.js';
import {createCampusContext} from '../../../../shunde/src/campus-context.js';
import {createForecourt} from '../../../../shunde/src/forecourt.js';
import {createSEMBuilding, SEM_WAY} from '../../../../shunde/src/sem-building.js';
import {loadLeafTextures, createLeafMaterial} from '../../../../../shared/leaves.js';
import campusData from '../../../../shunde/docs/campus-context.json';
import {flightAt, badgeAt, smooth, FOV, FRONT} from './flight.js';

export async function createBackground({THREE, renderer, clouds}) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 16 / 9, .3, 2400);
  const sky = clouds.mat.uniforms.skyMap.value.clone();
  sky.colorSpace = THREE.SRGBColorSpace;
  sky.mapping = THREE.EquirectangularReflectionMapping;
  sky.needsUpdate = true;
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromEquirectangular(sky).texture;
  pmrem.dispose();
  scene.environmentIntensity = .58;
  scene.fog = new THREE.Fog('#c8dce1', 280, 1300);
  scene.add(new THREE.HemisphereLight('#dfedff', '#9d9d7c', 1.05));
  const sun = new THREE.DirectionalLight('#fff3df', 2.55);
  sun.position.set(-85, 120, -90);
  sun.target.position.set(15, 0, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  Object.assign(sun.shadow.camera, {left: -150, right: 150, top: 140, bottom: -140, near: 1, far: 420});
  sun.shadow.bias = -.000045;
  sun.shadow.normalBias = .035;
  scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight('#d8eaff', .45);
  fill.position.set(50, 30, 90);
  scene.add(fill);
  const signGlyphs = await new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not load the Shunde sign glyphs.'));
    image.src = 'assets/name-glyphs.png';
  });
  const built = createShundeModel(THREE, {signGlyphs, refinedFront: true});
  scene.add(built.group);
  const semSource = campusData.buildings.find(b => b.id === SEM_WAY);
  if (!semSource) throw new Error('Missing western SEM source footprint.');
  const sem = createSEMBuilding(THREE, semSource);
  const campus = createCampusContext(THREE, {...campusData,
    buildings: campusData.buildings.filter(b => b.id !== SEM_WAY)});
  scene.add(campus.group);
  scene.add(sem.group);
  await loadLeafTextures(THREE);
  const forecourt = createForecourt(THREE, {leafMaterial: createLeafMaterial(THREE, 'Forecourt leaf surfaces')});
  scene.add(forecourt.group);
  const ground = built.campus.children.find(o => o.isMesh && o.material.name === 'Garden grass');
  if (!ground) throw new Error('Missing source campus ground.');
  ground.geometry.scale(8, 1, 8);
  const uv = ground.geometry.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 8, uv.getY(i) * 8);
  uv.needsUpdate = true;
  scene.updateMatrixWorld(true);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  scene.background = sky;
  const reflections = installGlassReflections(THREE, renderer, scene, scene,
    {position: [FRONT[0], 10, FRONT[1] - 4], resolution: 512, far: 700,
      intensity: 1.15, roughness: .10, metalness: .55});
  reflections.update(camera);
  scene.background = null;

  // Extend the existing photo-sky's view, not its colour treatment. At t <= .65
  // these uniforms reproduce the original shader constants exactly.
  clouds.mat.uniforms.divePitch = {value: .76};
  clouds.mat.uniforms.diveYaw = {value: 0};
  clouds.mat.uniforms.diveLens = {value: 1};
  clouds.mat.fragmentShader = clouds.mat.fragmentShader
    .replace('uniform sampler3D volume;', 'uniform float divePitch,diveYaw,diveLens;\nuniform sampler3D volume;')
    .replace('(uv-.5)*vec2(1.90,1.07)', '(uv-.5)*vec2(1.90,1.07)*diveLens')
    .replace('float pitch=.76;', 'float pitch=divePitch;')
    .replace('+.235+time*.018', '+.235+time*.018+diveYaw/6.28318530718');
  clouds.mat.needsUpdate = true;
  clouds.fgMat.uniforms.diveCloudVisibility = {value: 1};
  clouds.fgMat.fragmentShader = clouds.fgMat.fragmentShader
    .replace('uniform sampler3D volume;', 'uniform float diveCloudVisibility;\nuniform sampler3D volume;')
    .replace('a*=smoothstep(.02,.20,1.-trans);', 'a*=smoothstep(.02,.20,1.-trans)*diveCloudVisibility;');
  clouds.fgMat.needsUpdate = true;

  let pose;
  return {
    scene, camera, built, campus, forecourt, sem, reflections, badgeAt,
    draw(time) {
      pose = flightAt(time);
      camera.position.set(...pose.position);
      camera.up.set(0, 1, 0);
      camera.lookAt(...pose.target);
      camera.fov = pose.fov;
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld(true);
      clouds.mat.uniforms.divePitch.value = pose.pitch;
      clouds.mat.uniforms.diveYaw.value = pose.yaw;
      clouds.mat.uniforms.diveLens.value = Math.tan(pose.fov * Math.PI / 360) / .535;
      clouds.fgMat.uniforms.diveCloudVisibility.value = 1 - smooth(time, .65, 1.25);
      clouds.drawBackground(time * .96);
      // Geometry enters through the lower frustum as the lens tilts down.
      // No visibility switch, dissolve, or 2D building image is used.
      renderer.clearDepth();
      renderer.render(scene, camera);
      renderer.shadowMap.autoUpdate = false;
    },
    state() { return {...pose, front: FRONT, campus: campus.stats, forecourt: forecourt.stats, sem: sem.stats,
      reflectionCaptures: reflections.stats.captures}; },
  };
}
