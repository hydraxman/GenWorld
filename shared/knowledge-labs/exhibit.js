import * as THREE from 'three';
import {GRAPH_NODES, GRAPH_EDGES, LABS, initialExperiment} from './experiments.js';

const graphPositions = [[-1.3, .22, 0], [-.6, .22, -.72], [-.65, .22, .72],
  [.2, .22, 0], [.75, .22, .72], [1.35, .22, -.55]];
const pads = [[-1.05, .14, .6], [-.75, .14, -.64], [.65, .14, -.64], [1.05, .14, .6]];
export function disposeExhibitTree(group) {
  const resources = new Set();
  group.traverse(object => {
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
  const platform = new THREE.Group(), diagram = new THREE.Group();
  root.add(platform, diagram);
  let state = initialExperiment(id), expanded = false, lift = 0, targetLift = 0, frame = null, animation = null, frog = null;
  const motion = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  const material = color => new THREE.MeshStandardMaterial({color, roughness: .7, metalness: .04});
  function mesh(parent, name, geometry, color, position, scale = [1, 1, 1]) {
    const object = new THREE.Mesh(geometry, material(color));
    object.name = name; object.position.set(...position); object.scale.set(...scale);
    object.castShadow = true; object.receiveShadow = true; parent.add(object); return object;
  }
  const box = (parent, name, color, position, scale) => mesh(parent, name, new THREE.BoxGeometry(1, 1, 1), color, position, scale);
  const ball = (parent, name, color, position, scale) => mesh(parent, name, new THREE.SphereGeometry(1, 14, 9), color, position, scale);
  function label(parent, text, position, width = .48, background = '#183f49') {
    if (!labels) return;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('无法创建展台文字画布。');
    ctx.font = '600 72px sans-serif';
    canvas.width = Math.ceil(ctx.measureText(text).width) + 32; canvas.height = 112;
    ctx.fillStyle = background; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff'; ctx.font = '600 72px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, canvas.width / 2, 58);
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
    const object = new THREE.Sprite(new THREE.SpriteMaterial({map, toneMapped: false, depthTest: true}));
    object.name = `label-${text}`; object.position.set(...position);
    object.scale.set(width, width * canvas.height / canvas.width, 1); parent.add(object);
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
      labelText.endsWith('%') ? .45 : .2);
  }
  if (table) {
    box(platform, 'exhibit-table', '#e4d9bd', [0, 1.02, 0], [3.15, .14, 2.05]);
    box(platform, 'pedestal', '#344d4b', [0, .5, 0], [.75, 1, 1.15]);
    box(platform, 'pedestal-foot', '#b8b4a2', [0, .06, 0], [1.15, .12, 1.5]);
    label(platform, LABS[id].title, [0, .8, 1.05], 2.6);
  }
  function build() {
    disposeExhibitTree(diagram); diagram.clear(); frog = null;
    const active = '#e4a949', idle = '#62a998', dark = '#284e58';
    if (id === 'graph') {
      box(diagram, 'graph-ground', '#e9e2cb', [0, 0, 0], [3.3, .08, 2.0]);
      GRAPH_EDGES.forEach(([a, b], i) => {
        const inPath = state.path.some((node, n) => n && ((node === a && state.path[n - 1] === b) || (node === b && state.path[n - 1] === a)));
        link(diagram, `graph-edge-${a}-${b}`, graphPositions[GRAPH_NODES.indexOf(a)], graphPositions[GRAPH_NODES.indexOf(b)],
          inPath ? '#c87914' : '#739594', {labelText: String(state.weights[i]), radius: inPath ? .05 : .022});
      });
      GRAPH_NODES.forEach((node, i) => {
        ball(diagram, `graph-node-${node}`, state.current === node ? active : state.visited.includes(node) ? idle : dark,
          graphPositions[i], [.18, .18, .18]);
        const p = [...graphPositions[i]]; p[1] += .4; label(diagram, node, p, .24);
      });
    } else if (id === 'list') {
      box(diagram, 'list-ground', '#e9e2cb', [0, -.02, 0], [3.3, .08, 2]);
      const positions = new Map(state.nodes.map((node, i) => [node.id, [-1.12 + (i % 3) * 1.12, .2, i < 3 ? -.45 : .6]]));
      for (const node of state.nodes) {
        const p = positions.get(node.id);
        box(diagram, `list-node-${node.id}`, node.id === state.cursor ? active : state.visited.includes(node.id) ? idle : dark, p, [.62, .3, .38]);
        label(diagram, String(node.value), [p[0], p[1] + .29, p[2]], .35);
        if (node.next) link(diagram, `next-${node.id}-${node.next}`, p, positions.get(node.next), '#b7761e', {arrow: true, trim: .42});
        else label(diagram, 'null', [p[0], .23, p[2] + .37], .42);
        const tags = [];
        if (node.id === state.head) tags.push('head');
        if (node.id === state.previous && state.mode === 'reverse') tags.push('prev');
        if (node.id === state.cursor) tags.push('cur');
        if (tags.length) label(diagram, tags.join(' / '), [p[0], .84, p[2]], .85);
      }
    } else {
      const pond = mesh(diagram, 'pond-water', new THREE.CylinderGeometry(1, 1, .1, 48), '#66bbc5', [0, 0, 0], [1.7, 1, 1.15]);
      pond.material.roughness = .24;
      for (let i = 0; i < pads.length; i++) {
        const shape = new THREE.Shape(); shape.moveTo(0, 0);
        shape.absarc(0, 0, .33, .22, Math.PI * 2 - .22, false); shape.lineTo(0, 0);
        const leaf = mesh(diagram, `lily-pad-${i}`, new THREE.ShapeGeometry(shape, 24),
          i === state.current ? '#6a953a' : '#39846b', pads[i]);
        leaf.rotation.x = -Math.PI / 2;
        const [x, y, z] = pads[i];
        label(diagram, 'ABCD'[i], [x, y + .19, z + .34], .24);
        if (i === state.current && state.matrix[i][i] > 0) {
          label(diagram, `原地 ${Math.round(state.matrix[i][i] * 100)}%`, [x, y + .65, z], .9);
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
    sync(next, {animateHop = false} = {}) {
      if (next.kind !== id) throw new Error('实验状态与展台不匹配。');
      state = next; build(); animate(animateHop);
    },
    expand(value) {expanded = value; targetLift = value ? .7 : 0; animate(false);},
    settle,
    snapshot: () => ({id, expanded, lift, steps: state.steps, animating: frame !== null}),
    dispose() {
      cancel();
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisibility);
      disposeExhibitTree(root); root.removeFromParent();
    }};
}
