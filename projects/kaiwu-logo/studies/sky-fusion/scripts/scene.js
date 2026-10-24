import * as THREE from '../../../latest/tsinghua-mem-five-effects-cloud/vendor/three/build/three.module.js';
import {ExtrudeGeometry} from '../../../latest/tsinghua-mem-five-effects-cloud/scripts/SelectiveExtrudeGeometry.js';
import {makeClouds} from '../../../latest/tsinghua-mem-five-effects-cloud/scripts/clouds.js';
import originalGeometry from '../../../latest/tsinghua-mem-five-effects-cloud/inputs/semantic-geometry.json';
import {createGlyphTrace} from './glyph-trace.js';
import {withYear2026} from './year-2026.js';

const geometryData = withYear2026(originalGeometry, THREE);
const clamp = value => Math.max(0, Math.min(1, value));
const DURATION = 4;
const VISUAL_RATE = 2;
const phase = (time, start, end) => {
  const t = clamp((time - start) / (end - start));
  return t * t * t * (t * (t * 6 - 15) + 10);
};
let pending = 0;
window.renderAt = time => {
  if (!Number.isFinite(time)) throw new Error('Time must be finite.');
  pending = Math.max(0, Math.min(DURATION, time));
  window.__drawScene?.(pending);
};
window.addEventListener('hf-seek', event => window.renderAt(event.detail.time));

// The surface and its arriving particles use exactly the same assembly field.
const arrivalGLSL = `
float field(vec2 p) {
  return .50 + .21 * sin(p.x * 2.3 + p.y * 1.4)
    + .14 * sin(p.y * 4.7 - p.x * 1.8) + .10 * sin(p.x * 8.1 + p.y * 6.2);
}
float arrival(vec2 p) {
  return .6 + .6 * clamp((p.x + 3.4) / 6.8, 0., 1.) + .6 * field(p);
}`;

function surfaceMaterial(parameters, uniforms, face) {
  const material = new THREE.MeshPhysicalMaterial(parameters);
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 surfacePosition;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nsurfacePosition = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 surfacePosition;
        uniform float studyTime;
        uniform float sweepCenter;
        uniform float sweepStrength;
        ${arrivalGLSL}`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        float formed = studyTime - arrival(surfacePosition.xy);
        if (formed < 0.) discard;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float edge = (1. - smoothstep(0., .10, formed)) * .65;
        totalEmissiveRadiance += vec3(.45, .67, .8) * edge;
        ${face ? `
          float axis = surfacePosition.x + surfacePosition.y * .38;
          float band = exp(-pow((axis - sweepCenter) / .56, 2.)) * sweepStrength;
          float shoulder = exp(-pow((axis - sweepCenter + .5) / 1.15, 2.)) * sweepStrength;
          vec3 pearl = mix(vec3(.42, .72, .94), vec3(.96, .71, .46),
            smoothstep(-.75, .75, axis - sweepCenter));
          totalEmissiveRadiance += pearl * band * .68 + vec3(.25, .10, .38) * shoulder * .12;
        ` : ''}
      `);
  };
  material.customProgramCacheKey = () => `sky-fusion-${face ? 'planar' : 'side'}`;
  return material;
}

function createBadge(face, side) {
  const badge = new THREE.Group();
  badge.name = '2026 badge; original artwork except the final year digit';
  const groups = {}, stats = {};
  let vertices = 0, sourcePaths = 0, sourceHoles = 0;
  for (const [name, polygons] of Object.entries(geometryData)) {
    const group = new THREE.Group();
    group.name = name;
    badge.add(group);
    groups[name] = group;
    let holes = 0;
    for (const [index, polygon] of polygons.entries()) {
      const coords = points => points.map(([x, y]) => new THREE.Vector2((x - 319.3) * .01, (319.5 - y) * .01));
      const shape = new THREE.Shape(coords(polygon.outer));
      for (const hole of polygon.holes) shape.holes.push(new THREE.Path(coords(hole)));
      const noBevel = new Set(coords(polygon.noBevel).map(v => `${v.x.toFixed(8)},${v.y.toFixed(8)}`));
      const depth = name.includes('Page') ? .18 : name === 'braidedRim' ? .27 : .21;
      const geometry = new ExtrudeGeometry(shape, {
        depth, steps: 1, bevelEnabled: true, bevelThickness: .008, bevelSize: .0055,
        bevelSegments: 3, curveSegments: 1,
        bevelAllowed: v => !noBevel.has(`${v.x.toFixed(8)},${v.y.toFixed(8)}`),
      });
      geometry.translate(0, 0, -depth);
      const position = geometry.attributes.position;
      for (let j = 0; j < position.count; j++) position.setZ(j, Math.round(position.getZ(j) * 1e7) / 1e7);
      geometry.computeVertexNormals();
      const mesh = new THREE.Mesh(geometry, [face, side]);
      mesh.name = `${name}-${index}`;
      mesh.userData = {sourceDerived: true, originalApertures: polygon.holes.length};
      group.add(mesh);
      vertices += position.count;
      holes += polygon.holes.length;
    }
    stats[name] = {meshes: polygons.length, holes};
    sourcePaths += polygons.length;
    sourceHoles += holes;
  }
  return {badge, groups, stats, vertices, sourcePaths, sourceHoles};
}

function createParticles(badge, uniforms, seed) {
  const rand = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const positions = [], seeds = [];
  badge.traverse(object => {
    if (!object.isMesh) return;
    const geometry = object.geometry;
    const position = geometry.attributes.position;
    const vertex = index => new THREE.Vector3().fromBufferAttribute(position, geometry.index ? geometry.index.getX(index) : index);
    for (const group of geometry.groups) {
      if (group.materialIndex !== 0) continue;
      for (let i = group.start; i < group.start + group.count; i += 3) {
        const a = vertex(i), b = vertex(i + 1), c = vertex(i + 2);
        const normal = b.clone().sub(a).cross(c.clone().sub(a));
        if (normal.z <= 0) continue;
        const area = normal.length() * .5;
        const expected = area * 300;
        const count = Math.floor(expected) + (rand() < expected % 1 ? 1 : 0);
        for (let n = 0; n < count; n++) {
          const u = Math.sqrt(rand()), v = rand();
          const p = a.clone().multiplyScalar(1 - u).addScaledVector(b, u * (1 - v)).addScaledVector(c, u * v);
          positions.push(p.x, p.y, p.z + .016);
          seeds.push(rand());
        }
      }
    }
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('seed', new THREE.Float32BufferAttribute(seeds, 1));
  const material = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, depthTest: true, toneMapped: false,
    vertexShader: `
      uniform float studyTime;
      attribute float seed;
      varying float opacity;
      varying float hue;
      ${arrivalGLSL}
      void main() {
        float arrive = arrival(position.xy);
        float remain = arrive - studyTime;
        float travel = clamp(remain / 1.5, 0., 1.);
        travel = travel * travel * (3. - 2. * travel);
        float angle = seed * 25.13 + travel * 1.6;
        vec3 p = position + vec3(cos(angle) * travel * (3. + seed * 3.),
          sin(angle) * travel * (2.5 + seed), travel * (1. + seed * 2.));
        opacity = smoothstep(0., .45, studyTime) * smoothstep(-.07, .12, remain)
          * (1. - smoothstep(1.75, 2., studyTime));
        hue = seed;
        vec4 mv = modelViewMatrix * vec4(p, 1.);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = (58. + seed * 52.) / max(1., -mv.z);
      }`,
    fragmentShader: `
      precision highp float;
      varying float opacity;
      varying float hue;
      void main() {
        float r = length(gl_PointCoord - .5);
        float alpha = exp(-r * r * 20.) * opacity;
        if (alpha < .015) discard;
        vec3 ink = mix(vec3(.30, .22, .55), vec3(.95, .78, .42), hue);
        gl_FragColor = vec4(ink, alpha * .85);
      }`,
  });
  const particles = new THREE.Points(geometry, material);
  particles.frustumCulled = false;
  particles.name = 'Seeded front-surface assembly particles';
  badge.add(particles);
  return seeds.length;
}

async function init({createBackground = null, badgeLayout = null, renderPass = 'composite'} = {}) {
  if (!['composite', 'background', 'badge'].includes(renderPass)) {
    throw new Error(`Unknown scene render pass: ${renderPass}`);
  }
  const renderer = new THREE.WebGLRenderer({canvas: document.getElementById('three-layer'),
    antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: 'high-performance'});
  renderer.setPixelRatio(1);
  renderer.setSize(1920, 1080, false);
  renderer.setClearColor(0, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.autoClear = false;
  const clouds = makeClouds(renderer);
  await clouds.ready;
  const background = createBackground ? await createBackground({THREE, renderer, clouds}) : null;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35.14, 16 / 9, .1, 100);
  const environment = new THREE.Scene();
  environment.background = new THREE.Color('#617888');
  const panel = (color, power, x, y, z, width, height, tilt = 0) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height),
      new THREE.MeshBasicMaterial({color: new THREE.Color(color).multiplyScalar(power), side: THREE.DoubleSide}));
    mesh.position.set(x, y, z);
    mesh.rotation.z = tilt;
    environment.add(mesh);
  };
  panel('#fff8eb', 3.2, -1.4, 1, 6, 1.1, 10, -.3);
  panel('#c0eaff', 2.2, 2.6, 0, 5, .6, 10, -.3);
  panel('#fffaff', 1.8, 0, 4, 5, 10, 1);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const map = pmrem.fromScene(environment, .04, .1, 50);
  scene.environment = map.texture;
  scene.add(new THREE.HemisphereLight('#eef7ff', '#756281', 1.15));
  const key = new THREE.DirectionalLight('#fff3df', 2.8);
  key.position.set(-3, 5, 7);
  scene.add(key);
  const fill = new THREE.DirectionalLight('#c0dfff', 1.6);
  fill.position.set(4, -1, 5);
  scene.add(fill);
  const uniforms = {studyTime: {value: 0}, sweepCenter: {value: -7}, sweepStrength: {value: 0}};
  const face = surfaceMaterial({
    color: '#692b82', metalness: .7, roughness: .26, clearcoat: .7,
    clearcoatRoughness: .20, envMapIntensity: .95,
  }, uniforms, true);
  const side = surfaceMaterial({
    color: '#b8a6c4', metalness: .85, roughness: .22,
    clearcoat: .45, envMapIntensity: 1.15,
  }, uniforms, false);
  const built = createBadge(face, side);
  scene.add(built.badge);
  const layers = {};
  for (const [name, members] of Object.entries({
    inner: ['leftPage', 'rightPage', 'circuits'],
    middle: ['letterBand'],
    outer: ['braidedRim'],
  })) {
    const layer = new THREE.Group();
    layer.name = `${name} rotating badge layer`;
    for (const member of members) layer.add(built.groups[member]);
    built.badge.add(layer);
    layers[name] = layer;
  }
  const particleCount = Object.values(layers).reduce((count, layer, index) =>
    count + createParticles(layer, uniforms, 61387 + index * 997), 0);
  const glyphTrace = createGlyphTrace(THREE, built.groups, geometryData, uniforms.studyTime);
  const landmarks = {leftPage: [[-1.6, 1.2, 0]], rightPage: [[1.6, 1.2, 0]],
    circuits: [[0, 2.05, 0]], letterBand: [[0, 2.5, 0]], braidedRim: [[0, 3, 0]]};
  const gl = renderer.getContext(), debug = gl.getExtension('WEBGL_debug_renderer_info');
  window.sceneMetrics = {
    duration: DURATION, visualRate: VISUAL_RATE, badgeYear: 2026,
    fps: 30, width: 1920, height: 1080, sourcePaths: built.sourcePaths,
    sourceHoles: built.sourceHoles, semanticGroups: built.stats, vertices: built.vertices,
    particleCount, faceNormalPerturbation: false, roughnessMap: false,
    glyphTrace: glyphTrace.stats.map(glyph => ({...glyph,
      start: glyph.start / VISUAL_RATE, finish: glyph.finish / VISUAL_RATE})),
    layerMembers: {inner: ['leftPage', 'rightPage', 'circuits'], middle: ['letterBand'], outer: ['braidedRim']},
    renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
    metal: 'Planar PBR purple face, silver edges, art-directed linear pearl sweep',
  };
  function draw(compositionTime) {
    // Keep every accepted pose and shader cue on the same original eight-second clock.
    const time = compositionTime * VISUAL_RATE;
    uniforms.studyTime.value = time;
    const settle = phase(time, 1.4, 4.4);
    built.badge.rotation.set(.055 * (1 - settle), -.19 * (1 - settle), -.035 * (1 - settle));
    const inner = 1 - phase(time, .9, 3.6);
    const middle = 1 - phase(time, 1., 4.05);
    const outer = 1 - phase(time, .7, 4.4);
    layers.inner.rotation.set(.10 * inner, Math.PI * 1.1 * inner, 0);
    layers.inner.position.set(0, 0, .65 * inner);
    layers.middle.rotation.set(.26 * middle, .16 * middle, -Math.PI * 1.35 * middle);
    layers.middle.position.set(0, 0, .12 * middle);
    layers.outer.rotation.set(-.16 * outer, -.36 * outer, Math.PI * 1.8 * outer);
    layers.outer.position.set(0, 0, -.65 * outer);
    const fold = phase(time, 2.9, 3.12) * (1 - phase(time, 3.20, 3.51));
    for (const [name, direction] of [['leftPage', -1], ['rightPage', 1]]) {
      const page = built.groups[name];
      page.position.set(0, 0, 0);
      page.rotation.set(0, -direction * 1.03 * fold, 0);
    }
    camera.position.set(0, 0, 13.4 - 1.2 * phase(time, .4, 4.4));
    camera.lookAt(0, 0, 0);
    const sweepProgress = clamp((time - 6.55) / .65);
    uniforms.sweepCenter.value = -5.2 + 10.4 * sweepProgress;
    uniforms.sweepStrength.value = Math.sin(Math.PI * sweepProgress) ** .65;
    const holdLighting = phase(time, 6.95, 7.3);
    scene.environmentRotation.y = -.12 + .20 * phase(time, 6.5, 7.25) * (1 - holdLighting);
    scene.environmentIntensity = 1 - .25 * holdLighting;
    face.roughness = .26 + .06 * holdLighting;
    key.intensity = 2.8 - .6 * holdLighting;
    fill.intensity = 1.6 + .6 * holdLighting;
    const layout = badgeLayout ? badgeLayout(compositionTime) : background?.badgeAt(compositionTime);
    built.badge.scale.setScalar(layout?.scale ?? 1);
    built.badge.position.set(0, layout?.y ?? 0, 0);
    scene.updateMatrixWorld(true);
    let error = 0;
    for (const [name, points] of Object.entries(landmarks)) for (const point of points) {
      const local = new THREE.Vector3(...point);
      const expected = built.badge.localToWorld(local.clone());
      error = Math.max(error, expected.distanceTo(built.groups[name].localToWorld(local.clone())));
    }
    renderer.clear();
    if (renderPass !== 'badge') {
      if (background) background.draw(compositionTime);
      else clouds.drawBackground(time * .48);
    }
    if (renderPass !== 'background') {
      renderer.clearDepth();
      renderer.render(scene, camera);
    }
    if (renderPass !== 'badge') clouds.drawForeground();
    window.sceneMetrics.pose = {
      time: compositionTime, sourceTime: time, assemblyErrorSourcePixels: error * 100,
      ...(background ? {background: background.state()} : {}),
      ...(layout ? {badgeLayout: layout} : {}),
      renderPass,
      lighting: {holdBlend: holdLighting, environmentYaw: scene.environmentRotation.y,
        environmentIntensity: scene.environmentIntensity, faceRoughness: face.roughness,
        keyIntensity: key.intensity, fillIntensity: fill.intensity},
      glyphTrace: glyphTrace.state(time),
      book: {
        separationWorld: built.groups.rightPage.position.x - built.groups.leftPage.position.x,
        pages: Object.fromEntries(['leftPage', 'rightPage'].map(name => [name, {
          rotationDegrees: built.groups[name].rotation.toArray().slice(0, 3).map(THREE.MathUtils.radToDeg),
          position: built.groups[name].position.toArray(),
        }])),
        stage: time < 2.9 ? 'rest' : time < 3.2 ? 'opposed fixed-spine hinges'
          : time < 3.51 ? 'unfold' : 'restored',
      },
      layers: Object.fromEntries(Object.entries(layers).map(([name, layer]) => [name, {
        rotationDegrees: layer.rotation.toArray().slice(0, 3).map(THREE.MathUtils.radToDeg),
        position: layer.position.toArray(),
        particleClouds: layer.children.filter(child => child.isPoints).length,
      }])),
      sweepCenter: uniforms.sweepCenter.value, sweepStrength: uniforms.sweepStrength.value,
      stage: time < .5 ? 'clear sky' : time < 2 ? 'particles form three independently rotating layers'
        : time >= 2.9 && time < 3.51 ? 'quick fixed-spine book hinge inside rotating rings'
          : time < 4.4 ? 'inner flip, counter-rotating middle and outer rings'
          : time < 4.45 ? 'three layers aligned' : time < 6.51 ? 'light particles trace the four original glyphs'
            : time < 6.55 ? 'glyph tails cleared' : time < 7.2 ? 'single linear pearl sweep' : 'readable hero hold',
    };
  }
  window.__drawScene = draw;
  window.__sceneDebug = {THREE, renderer, scene, camera, badge: built.badge, layers, face, side, clouds, glyphTrace, background};
  draw(pending);
  window.animationReady = true;
}
export function startSkyFusion(options) {
  const ready = init(options);
  window.__hf = window.__hf || {};
  window.__hf.buildReady = window.__hf.buildReady || {};
  window.__hf.buildReady['kaiwu-scene'] = ready;
  ready.catch(error => {
    window.__sceneError = String(error.stack || error);
    console.error(error);
  });
  return ready;
}
