import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {GRAPH_NODES, GRAPH_EDGES, LABS, initialExperiment} from './experiments.js';
import {ANATOMY_FINISHES as FINISH} from './anatomy-finishes.js';

const graphPositions = [[-1.3, .22, 0], [-.6, .22, -.72], [-.65, .22, .72],
  [.2, .22, 0], [.75, .22, .72], [1.35, .22, -.55]];
const pads = [[-1.05, .14, .6], [-.75, .14, -.64], [.65, .14, -.64], [1.05, .14, .6]];
export function disposeExhibitTree(group) {
  const resources = new Set();
  group.traverse(object => {
    if (object.isInstancedMesh) object.dispose();
    if (object.geometry) resources.add(object.geometry);
    for (const material of [].concat(object.material ?? [])) {
      resources.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) resources.add(value);
    }
  });
  for (const resource of resources) resource.dispose();
}

export function createLabExhibit(id, {table = true, labels = typeof document !== 'undefined', onChange = () => {}} = {}) {
  if (!LABS[id]) throw new Error(`未知展台：${id}`);
  const root = new THREE.Group();
  root.name = `knowledge-lab-${id}`;
  root.userData = {knowledgeLab: id, illustrative: true};
  const platform = new THREE.Group(), diagram = new THREE.Group(), focusRing = new THREE.Group();
  focusRing.name = 'nearby-exhibit-highlight'; focusRing.visible = false; platform.add(focusRing);
  root.add(platform, diagram);
  let state = initialExperiment(id), expanded = false, lift = 0, targetLift = 0, frame = null, animation = null, frog = null;
  let detailLabels = [], previewLabels = [];
  const motion = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  const material = color => new THREE.MeshStandardMaterial({color, roughness: .7, metalness: .04});
  function mesh(parent, name, geometry, color, position, scale = [1, 1, 1]) {
    const object = new THREE.Mesh(geometry, material(color));
    object.name = name; object.position.set(...position); object.scale.set(...scale);
    object.castShadow = true; object.receiveShadow = true; parent.add(object); return object;
  }
  const box = (parent, name, color, position, scale) => mesh(parent, name, new THREE.BoxGeometry(1, 1, 1), color, position, scale);
  const rounded = (parent, name, color, position, size, radius = .025) =>
    mesh(parent, name, new RoundedBoxGeometry(...size, 2, radius), color, position);
  const ball = (parent, name, color, position, scale) => mesh(parent, name, new THREE.SphereGeometry(1, 14, 9), color, position, scale);
  function label(parent, text, position, width = .48, {detail = false, plaque = false} = {}) {
    if (!labels) return;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('无法创建展台文字画布。');
    ctx.font = '600 72px sans-serif';
    canvas.width = Math.ceil(ctx.measureText(text).width) + 32; canvas.height = 112;
    ctx.fillStyle = plaque ? '#e7e1d2' : '#274c50'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = plaque ? '#263c3c' : '#ffffff'; ctx.font = '600 72px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, canvas.width / 2, 58);
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
    const height = width * canvas.height / canvas.width;
    const object = plaque ? new THREE.Mesh(new THREE.PlaneGeometry(width, height),
      new THREE.MeshStandardMaterial({map, roughness: .75, side: THREE.FrontSide}))
      : new THREE.Sprite(new THREE.SpriteMaterial({map, toneMapped: false, depthTest: true}));
    object.name = `label-${text}`; object.position.set(...position);
    object.userData.labelRole = plaque ? 'plaque' : detail ? 'detail' : 'node';
    if (!plaque) {
      object.scale.set(width, height, 1);
      if (!detail) {previewLabels.push({object, width, height}); if (!expanded) object.scale.multiplyScalar(.65);}
    }
    if (detail) {detailLabels.push(object); object.visible = expanded;}
    parent.add(object);
  }
  function link(parent, name, from, to, color, {arrow = false, labelText, radius = .025, trim = .22} = {}) {
    const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to), direction = b.clone().sub(a).normalize();
    a.addScaledVector(direction, trim); b.addScaledVector(direction, -trim);
    const object = mesh(parent, name, new THREE.CylinderGeometry(radius, radius, a.distanceTo(b), 8), color,
      a.clone().add(b).multiplyScalar(.5).toArray());
    object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
    if (arrow) {
      const tip = mesh(parent, `${name}-arrow`, new THREE.ConeGeometry(.075, .17, 8), color, b.toArray());
      tip.quaternion.copy(object.quaternion);
    }
    if (labelText) label(parent, labelText, a.clone().lerp(b, .48).add(new THREE.Vector3(0, .12, 0)).toArray(),
      labelText.endsWith('%') ? .38 : .18, {detail: true});
  }
  if (table) {
    rounded(platform, 'exhibit-table', '#e4dfd1', [0, 1.035, 0], [3.15, .11, 2.05]);
    const trim = rounded(platform, 'table-edge-reveal', FINISH.gold, [0, .973, 0], [3.10, .026, 2.0], .012);
    trim.material.metalness = .65; trim.material.roughness = .34;
    rounded(platform, 'pedestal', '#344d4b', [0, .52, 0], [1.18, .88, 1.3], .05);
    rounded(platform, 'pedestal-foot', FINISH.gunmetal, [0, .06, 0], [1.48, .12, 1.60], .04);
    rounded(platform, 'exhibit-plaque-backing', FINISH.goldRecess, [0, .84, 1.019], [2.48, .27, .055], .018);
    label(platform, LABS[id].title, [0, .84, 1.05], id === 'markov' ? 2.25 : 1.66, {plaque: true});
    for (const x of [-.43, .43]) box(platform, 'pedestal-flute', FINISH.goldRecess, [x, .49, .656], [.014, .66, .012]);
    for (const x of [-1.54, 1.54]) box(focusRing, 'focus-edge', '#ffd077', [x, 1.105, 0], [.025, .025, 2]);
    for (const z of [-1, 1]) box(focusRing, 'focus-edge', '#ffd077', [0, 1.105, z], [3.1, .025, .025]);
  }
  function build() {
    disposeExhibitTree(diagram); diagram.clear(); frog = null; detailLabels = []; previewLabels = [];
    const active = '#e4a949', idle = '#62a998', dark = '#284e58';
    if (id === 'graph') {
      rounded(diagram, 'graph-ground', '#dcded5', [0, 0, 0], [3.08, .08, 1.94]);
      GRAPH_EDGES.forEach(([a, b], i) => {
        const inPath = state.path.some((node, n) => n && ((node === a && state.path[n - 1] === b) || (node === b && state.path[n - 1] === a)));
        link(diagram, `graph-edge-${a}-${b}`, graphPositions[GRAPH_NODES.indexOf(a)], graphPositions[GRAPH_NODES.indexOf(b)],
          inPath ? '#c87914' : '#739594', {labelText: String(state.weights[i]), radius: inPath ? .05 : .022});
      });
      GRAPH_NODES.forEach((node, i) => {
        const [x, , z] = graphPositions[i];
        mesh(diagram, `graph-socket-${node}`, new THREE.CylinderGeometry(.22, .24, .045, 24),
          FINISH.steel, [x, .063, z]);
        ball(diagram, `graph-node-${node}`, state.current === node ? active : state.visited.includes(node) ? idle : dark,
          graphPositions[i], [.18, .18, .18]);
        const p = [...graphPositions[i]]; p[1] += .4; label(diagram, node, p, .24);
      });
    } else if (id === 'list') {
      rounded(diagram, 'list-ground', '#dcded5', [0, -.02, 0], [3.08, .08, 1.94]);
      const positions = new Map(state.nodes.map((node, i) => [node.id, [-1.12 + (i % 3) * 1.12, .2, i < 3 ? -.45 : .6]]));
      for (const node of state.nodes) {
        const p = positions.get(node.id);
        rounded(diagram, `list-node-${node.id}`, node.id === state.cursor ? active : state.visited.includes(node.id) ? idle : dark, p, [.62, .3, .38]);
        box(diagram, `list-pointer-field-${node.id}`, FINISH.steel, [p[0] + .18, p[1] + .153, p[2]], [.14, .015, .29]);
        label(diagram, String(node.value), [p[0], p[1] + .29, p[2]], .35);
        if (node.next) link(diagram, `next-${node.id}-${node.next}`, p, positions.get(node.next), '#b7761e', {arrow: true, trim: .42});
        else label(diagram, 'null', [p[0], .23, p[2] + .37], .42);
        const tags = [];
        if (node.id === state.head) tags.push('head');
        if (node.id === state.previous && state.mode === 'reverse') tags.push('prev');
        if (node.id === state.cursor) tags.push('cur');
        if (tags.length) label(diagram, tags.join(' / '), [p[0], .84, p[2]], .65, {detail: true});
      }
    } else {
      mesh(diagram, 'pond-basin', new THREE.CylinderGeometry(1, 1, .14, 64), FINISH.gunmetal, [0, -.025, 0], [1.74, 1, 1.19]);
      const rim = mesh(diagram, 'pond-rim', new THREE.TorusGeometry(1, .014, 6, 64), FINISH.gold, [0, .06, 0], [1.72, 1.17, 1]);
      rim.rotation.x = -Math.PI / 2; rim.material.metalness = .6; rim.material.roughness = .3;
      const pond = mesh(diagram, 'pond-water', new THREE.CylinderGeometry(1, 1, .1, 64), '#4d9f9f', [0, 0, 0], [1.7, 1, 1.15]);
      pond.material.roughness = .24;
      for (let i = 0; i < pads.length; i++) {
        const shape = new THREE.Shape(); shape.moveTo(0, 0);
        shape.absarc(0, 0, .33, .22, Math.PI * 2 - .22, false); shape.lineTo(0, 0);
        const leaf = mesh(diagram, `lily-pad-${i}`, new THREE.ExtrudeGeometry(shape, {depth: .018, bevelEnabled: false, steps: 1, curveSegments: 24}),
          i === state.current ? '#6a953a' : '#39846b', pads[i]);
        leaf.rotation.x = -Math.PI / 2;
        const [x, y, z] = pads[i];
        label(diagram, 'ABCD'[i], [x, y + .19, z + .34], .24);
        if (i === state.current && state.matrix[i][i] > 0) {
          label(diagram, `原地 ${Math.round(state.matrix[i][i] * 100)}%`, [x, y + .65, z], .7, {detail: true});
        }
        if (i !== state.current && state.matrix[state.current][i] > 0) {
          const from = [...pads[state.current]], to = [...pads[i]]; from[1] = to[1] = .28;
          link(diagram, `probability-${state.current}-${i}`, from, to, '#f0d38b',
            {arrow: true, labelText: `${Math.round(state.matrix[state.current][i] * 100)}%`});
        }
      }
      frog = new THREE.Group(); frog.name = 'markov-frog'; diagram.add(frog);
      ball(frog, 'frog-body', '#83b846', [0, .14, 0], [.18, .14, .22]);
      ball(frog, 'frog-head', '#9fc84c', [0, .25, .1], [.19, .12, .14]);
      for (const side of [-1, 1]) {
        ball(frog, 'frog-eye', '#f4efcd', [side * .1, .34, .15], [.066, .074, .052]);
        ball(frog, 'frog-pupil', '#163736', [side * .1, .34, .195], [.029, .043, .018]);
        ball(frog, 'frog-haunch', '#619738', [side * .18, .1, -.1], [.1, .08, .14]);
        ball(frog, 'frog-foot', '#a7be58', [side * .19, .05, .12], [.07, .035, .12]);
      }
      frog.position.set(...pads[state.current]);
    }
    root.userData.steps = state.steps;
    diagram.position.y = 1.12 + lift;
    diagram.rotation.x = lift * .3;
    root.updateMatrixWorld(true);
  }
  function cancel() {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
  }
  function settle() {
    cancel(); animation = null; lift = targetLift; diagram.position.y = 1.12 + lift;
    diagram.rotation.x = lift * .3;
    if (frog) frog.position.set(...pads[state.current]);
    onChange();
  }
  function tick(now) {
    frame = null;
    if (!animation) return;
    const t = Math.min(1, (now - animation.start) / 650), ease = 1 - (1 - t) ** 4;
    lift = animation.fromLift + (targetLift - animation.fromLift) * ease;
    diagram.position.y = 1.12 + lift;
    diagram.rotation.x = lift * .3;
    if (frog && animation.hop) {
      const a = new THREE.Vector3(...pads[state.previous]), b = new THREE.Vector3(...pads[state.current]);
      frog.position.copy(a.lerp(b, ease)); frog.position.y += Math.sin(Math.PI * t) * .5;
      frog.rotation.y = Math.atan2(pads[state.current][0] - pads[state.previous][0], pads[state.current][2] - pads[state.previous][2]);
    }
    onChange();
    if (t < 1) frame = requestAnimationFrame(tick);
    else animation = null;
  }
  function animate(hop) {
    cancel();
    if (!labels || motion?.matches || document.hidden) {settle(); return;}
    animation = {start: performance.now(), fromLift: lift, hop};
    frame = requestAnimationFrame(tick);
  }
  const onVisibility = () => {if (document.hidden) settle();};
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisibility);
  build();
  return {root, diagram,
    focus(value) {focusRing.visible = Boolean(value);},
    sync(next, {animateHop = false} = {}) {
      if (next.kind !== id) throw new Error('实验状态与展台不匹配。');
      state = next; build(); animate(animateHop);
    },
    expand(value) {
      expanded = value; detailLabels.forEach(label => {label.visible = value;});
      previewLabels.forEach(({object, width, height}) => object.scale.set(width, height, 1).multiplyScalar(value ? 1 : .65));
      targetLift = value ? .7 : 0; animate(false);
    },
    settle,
    snapshot: () => ({id, expanded, lift, steps: state.steps, animating: frame !== null}),
    dispose() {
      cancel();
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisibility);
      disposeExhibitTree(root); root.removeFromParent();
    }};
}
