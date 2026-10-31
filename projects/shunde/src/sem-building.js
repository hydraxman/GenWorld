import {createBuilder} from './builder.js';
import {createSkyCorridor} from './sky-corridor.js';
import {FOOTPRINT} from './footprint.js';

export const SEM_WAY = 937482182;
export const SEM_HEIGHT = 30;
export const BRIDGE_Z = 2;
const PODIUM_HEIGHT = 22.7;
const WING_X = -98;
const WING_Z = -13;

function clipped(points, axis, value, lower) {
  const out = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    const ina = lower ? a[axis] <= value : a[axis] >= value;
    const inb = lower ? b[axis] <= value : b[axis] >= value;
    if (ina) out.push(a);
    if (ina !== inb) {
      const u = (value - a[axis]) / (b[axis] - a[axis]);
      out.push(a.map((v, i) => i === axis ? value : v + (b[i] - v) * u));
    }
  }
  return out;
}

export function createSEMBuilding(THREE, source, {textured = true} = {}) {
  if (source.id !== SEM_WAY || source.points.length < 3) throw new Error('Expected the mapped western new-SEM footprint.');
  const B = createBuilder(THREE, 41827), {box} = B;
  const group = new THREE.Group(), architecture = new THREE.Group();
  group.name = 'Red SEM complex - photo-informed Jianhua/Lihua context';
  group.userData = {osmWay: source.id,
    photo: 'https://www.tuef.tsinghua.edu.cn/info/1072/2664.htm',
    status: 'source outer footprint; podium division and unobserved elevations interpreted'};
  architecture.name = 'SEM red podium and glazed upper wing';
  group.add(architecture);
  const plain = (name, color, roughness = .75, metalness = 0) =>
    new THREE.MeshStandardMaterial({name, color, roughness, metalness});
  const red = textured ? B.pbr('Brick-red terracotta panel cladding', 'grain', [177, 87, 64], [2.7, 2.7], 256)
    : plain('Brick-red terracotta panel cladding', '#b15740');
  red.normalScale?.set(.035, .035);
  const panelSeam = plain('Terracotta panel joint', '#854f40');
  const glass = new THREE.MeshPhysicalMaterial({name: 'Recessed SEM glazing', color: '#63808b',
    roughness: .18, metalness: 0, clearcoat: .8, clearcoatRoughness: .1});
  const atriumGlass = glass.clone();
  atriumGlass.name = 'Jianhua transparent atrium glazing';
  atriumGlass.color.set('#bad0d7'); atriumGlass.transparent = true;
  atriumGlass.opacity = .23; atriumGlass.depthWrite = false;
  const frames = plain('SEM dark bronze aluminum', '#3e4948', .35, .55);
  const sill = plain('SEM pale stone sill and coping', '#b5b7b1', .65);
  const shade = plain('SEM deep window reveals', '#293b3d');
  const white = plain('Jianhua white interior arch and round supports', '#e6e5df', .65);
  const spandrel = plain('SEM curtain floor spandrel', '#71828a', .4, .15);
  const roof = textured ? B.pbr('SEM roof concrete', 'grain', [132, 139, 135], [2, 2], 256)
    : plain('SEM roof concrete', '#848b87');
  const windows = [];
  let northAtrium;
  function panel(parent, x, base, top, width, depth = .4, z = .2) {
    if (width <= 0 || top <= base) throw new Error('Invalid SEM cladding panel');
    box(parent, 'terracotta panel', x, (base + top) / 2, z, width, top - base, depth, red);
    const front = z + depth / 2 + .006;
    for (let u = x - width / 2 + .85; u < x + width / 2 - .1; u += .85) {
      box(parent, 'vertical panel joint', u, (base + top) / 2, front, .012, top - base, .008, panelSeam);
    }
    for (let y = Math.ceil(base / 2.7) * 2.7; y < top - .08; y += 2.7) {
      box(parent, 'horizontal panel joint', x, y, front, width, .012, .008, panelSeam);
    }
  }
  const arch = (width, bottom, spring) => {
    const path = new THREE.Shape();
    path.moveTo(-width / 2, bottom);
    path.lineTo(width / 2, bottom);
    path.lineTo(width / 2, spring);
    path.absarc(0, spring, width / 2, 0, Math.PI, false);
    path.closePath();
    return path;
  };
  function archedBay(parent, x, bayWidth) {
    const width = Math.min(3.8, bayWidth * .64), bottom = 10.0, spring = 18.8;
    const wallShape = new THREE.Shape([
      new THREE.Vector2(-bayWidth / 2, 8.8), new THREE.Vector2(bayWidth / 2, 8.8),
      new THREE.Vector2(bayWidth / 2, PODIUM_HEIGHT), new THREE.Vector2(-bayWidth / 2, PODIUM_HEIGHT),
    ]);
    wallShape.holes.push(new THREE.Path(arch(width + .13, bottom - .08, spring).getPoints(16)));
    const wallGeometry = new THREE.ExtrudeGeometry(wallShape, {depth: .40, bevelEnabled: false, curveSegments: 12, steps: 1});
    B.worldUV(wallGeometry, red);
    wallGeometry.translate(x, 0, 0);
    B.add(parent, wallGeometry, red);
    const pierWidth = (bayWidth - width - .13) / 2;
    for (const sign of [-1, 1]) {
      box(parent, 'terracotta vertical panel seam', x + sign * (bayWidth / 2 - .018),
        (8.8 + PODIUM_HEIGHT) / 2, .406, .014, PODIUM_HEIGHT - 8.8, .01, panelSeam);
      for (let y = 10; y < PODIUM_HEIGHT; y += 1.3) box(parent, 'terracotta panel course seam',
        x + sign * (bayWidth / 2 - pierWidth / 2), y, .406, pierWidth - .04, .014, .01, panelSeam);
    }
    for (const y of [21.1, 22.4]) box(parent, 'upper terracotta panel seam',
      x, y, .406, bayWidth - .04, .014, .01, panelSeam);
    const glazing = new THREE.ShapeGeometry(arch(width, bottom, spring), 16);
    glazing.translate(x, 0, .045);
    B.add(parent, glazing, glass);
    const frameShape = arch(width + .18, bottom - .09, spring);
    frameShape.holes.push(new THREE.Path(arch(width, bottom, spring).getPoints(16)));
    const trim = new THREE.ExtrudeGeometry(frameShape, {depth: .12, bevelEnabled: false, curveSegments: 16, steps: 1});
    trim.translate(x, 0, .19);
    B.add(parent, trim, frames);
    box(parent, 'arch center mullion', x, (bottom + spring) / 2, .28, .065, spring - bottom, .12, frames);
    for (const y of [13.15, 16.3, 19.15]) box(parent, 'arch transom', x, y, .28, width, .065, .12, frames);
    box(parent, 'arched sill', x, bottom - .15, .28, width + .30, .15, .48, sill);
    windows.push({type: 'arch', x, width});
  }
  function rectangularBay(parent, x, width, base, top, glazedUpper) {
    const opening = width * (glazedUpper ? .91 : .61), bottom = base + .65, head = top - .55;
    const pier = (width - opening) / 2;
    for (const sign of [-1, 1]) box(parent, 'window jamb', x + sign * (opening / 2 + pier / 2),
      (base + top) / 2, .16, pier + .008, top - base, .4, glazedUpper ? frames : red);
    box(parent, 'window lower panel', x, (base + bottom) / 2, .12, opening, bottom - base, .32, glazedUpper ? glass : red);
    box(parent, 'window lintel', x, (head + top) / 2, .12, opening, top - head, .32, glazedUpper ? glass : red);
    box(parent, 'interior window recess', x, (bottom + head) / 2, -.22, opening, head - bottom, .08, shade);
    box(parent, 'recessed glass pane', x, (bottom + head) / 2, -.09, opening - .08, head - bottom - .06, .035, glass);
    for (const sign of [-1, 1]) {
      box(parent, 'metal window jamb', x + sign * opening / 2, (bottom + head) / 2, .10,
        .07, head - bottom + .10, .17, frames);
      box(parent, 'metal window rail', x, sign === 1 ? head : bottom, .10, opening + .10, .07, .17, frames);
    }
    box(parent, 'window central mullion', x, (bottom + head) / 2, .09, .065, head - bottom, .12, frames);
    box(parent, 'stone sill', x, bottom - .07, .22, opening + .17, .12, .35, sill);
    if (!glazedUpper) {
      box(parent, 'terracotta fin', x - width / 2 + .12, (base + top) / 2, .40, .20, top - base, .52, red);
    }
    windows.push({type: 'rectangular', x, width: opening});
  }
  function curtain(parent, start, end, bottom, top, transparent = false, z = .05) {
    const cols = Math.max(1, Math.round((end - start) / 1.55)), rows = Math.max(1, Math.round((top - bottom) / 2.7));
    const pane = new THREE.PlaneGeometry(end - start, top - bottom);
    pane.translate((start + end) / 2, (bottom + top) / 2, z);
    B.add(parent, pane, transparent ? atriumGlass : glass);
    for (let i = 0; i <= cols; i++) {
      const x = start + (end - start) * i / cols;
      box(parent, 'slender curtain mullion', x, (bottom + top) / 2, z + .065, transparent ? .035 : .055,
        top - bottom, .10, frames);
      if (transparent) for (let j = 1; j < rows; j++) {
        box(parent, 'point supported curtain fitting', x, bottom + (top - bottom) * j / rows, z + .14, .13, .13, .055, sill);
      }
    }
    for (let j = 0; j <= rows; j++) box(parent, 'curtain transom', (start + end) / 2,
      bottom + (top - bottom) * j / rows, z + .065, end - start, .055, .10, frames);
    windows.push({type: 'curtain', panes: cols * rows, width: end - start});
  }
  function entrance(face, center) {
    const portal = new THREE.Group();
    portal.name = 'Jianhua north glazed entrance and interior arch';
    portal.position.x = center; face.add(portal);
    const width = 20.8, base = .55, archWidth = 11.6, spring = base + 17 - (archWidth + 1.25) / 2;
    panel(portal, 0, 21, PODIUM_HEIGHT, width);
    if (textured) {
      const canvas = document.createElement('canvas');
      canvas.width = 1024; canvas.height = 128;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '600 70px serif';
      ctx.fillText('\u6e05\u534e\u5927\u5b66\u7ecf\u6d4e\u7ba1\u7406\u5b66\u9662', 512, 47, 1000);
      ctx.font = '20px sans-serif'; ctx.fillText('SCHOOL OF ECONOMICS AND MANAGEMENT', 512, 103, 950);
      const lettering = new THREE.MeshStandardMaterial({name: 'Jianhua procedural entrance lettering',
        map: B.texture(canvas, true), color: '#d9c79a', metalness: .35, roughness: .5, transparent: true, alphaTest: .4});
      const sign = new THREE.PlaneGeometry(16.4, 1.55); sign.translate(0, 21.85, .425);
      B.add(portal, sign, lettering);
    }
    for (const sign of [-1, 1]) {
      panel(portal, sign * (width / 2 + .7), 0, PODIUM_HEIGHT, 1.4);
      box(portal, 'atrium side reveal', sign * (width / 2 - .18), 10.5, -3.7, .35, 21, 7.8, white);
    }
    const rim = arch(archWidth + 1.25, base, spring);
    rim.holes.push(new THREE.Path(arch(archWidth, base + .01, spring).getPoints(32)));
    const archGeometry = new THREE.ExtrudeGeometry(rim, {depth: .55, bevelEnabled: false, curveSegments: 24, steps: 1});
    // The white arch stands behind the glass; its clear width/thickness are photo estimates.
    archGeometry.translate(0, 0, -2);
    B.add(portal, archGeometry, white);
    box(portal, 'atrium background', 0, 10, -8, width, 20, .15, shade);
    box(portal, 'atrium floor', 0, .3, -3.7, width, .3, 8, sill);
    for (const y of [5.4, 10.8, 16.2]) for (const sign of [-1, 1]) {
      box(portal, 'visible side gallery', sign * 8.7, y, -4, 3.3, .28, 6.5, white);
    }
    curtain(portal, -width / 2, width / 2, 3.2, 21, true);
    curtain(portal, -width / 2, width / 2, .5, 3.05, true, .16);
    box(portal, 'entrance canopy', 0, 3.15, .25, width + .7, .19, 1.25, frames);
    for (const x of [-2.2, 0, 2.2]) box(portal, 'door stile', x, 1.72, .28, .07, 2.45, .12, frames);
    northAtrium = {archHeight: 17, openingHeight: 16.375, archWidth, archBase: base, glazingWidth: width, glazingTop: 21,
      archDepth: -1.45, facade: face, component: portal};
  }
  const east = clipped(source.points, 0, WING_X, false);
  const parts = [
    {points: clipped(source.points, 0, WING_X, true), podium: true},
    {points: clipped(east, 1, WING_Z, true), podium: true},
    {points: clipped(east, 1, WING_Z, false), podium: false},
  ];
  for (const {points, podium} of parts) {
    const height = podium ? PODIUM_HEIGHT : SEM_HEIGHT;
    const part = new THREE.Group();
    part.name = podium ? 'Red arched SEM podium - estimated internal division' : 'Six-level SEM glazed wing';
    architecture.add(part);
    const footprint = new THREE.Shape(points.map(([x, z]) => new THREE.Vector2(x, -z)));
    for (const y of [.04, height]) {
      const slab = new THREE.ExtrudeGeometry(footprint, {depth: .26, bevelEnabled: false});
      slab.rotateX(-Math.PI / 2);
      slab.translate(0, y, 0);
      B.worldUV(slab, roof);
      B.add(part, slab, roof);
    }
    const signedArea = points.reduce((sum, a, i) => {
      const b = points[(i + 1) % points.length];
      return sum + a[0] * b[1] - b[0] * a[1];
    }, 0);
    for (let edge = 0; edge < points.length; edge++) {
      let a = points[edge], b = points[(edge + 1) % points.length];
      const internal = (a[0] === WING_X && b[0] === WING_X) || (a[1] === WING_Z && b[1] === WING_Z);
      if (internal && podium) continue;
      // Local +Z faces outside; reversal changes traversal, never source vertices.
      if (signedArea > 0) [a, b] = [b, a];
      const dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
      const face = new THREE.Group();
      face.name = 'SEM articulated facade';
      face.position.set(a[0], 0, a[1]);
      face.rotation.y = -Math.atan2(dz, dx);
      part.add(face);
      const outwardZ = dx / length, isNorth = outwardZ < -.9;
      const entry = podium && isNorth && length > 65;
      face.userData = {outwardZ, podium, internal, sourceEdge: [a, b]};
      const bays = Math.max(1, Math.round(length / 5.8)), width = length / bays;
      const center = length / 2, entryHalfWidth = 11.8;
      if (entry) entrance(face, center);
      if (!podium) {
        curtain(face, .04, length - .04, internal ? PODIUM_HEIGHT + .26 : 10.2, SEM_HEIGHT - .22);
        for (let y = 15; y < SEM_HEIGHT; y += 5) {
          if (internal && y < PODIUM_HEIGHT + .3) continue;
          box(face, 'curtain floor band', length / 2, y, .12, length, .22, .12, spandrel);
          for (let x = 2.5; x < length - 1.5; x += 6.2) {
            box(face, 'narrow opening light', x, y + 1.1, .14, .22, 1.55, .11, frames);
          }
        }
        box(face, 'projecting dark soffit', length / 2, internal ? PODIUM_HEIGHT + .18 : 10,
          -.65, length, .32, 1.95, frames);
      }
      for (let bay = 0; bay < bays; bay++) {
        const x = (bay + .5) * width;
        if (internal) continue;
        if (entry && Math.abs(x - center) < entryHalfWidth + width / 2) {
          const left = x - width / 2, right = x + width / 2;
          if (left < center - entryHalfWidth) panel(face, (left + center - entryHalfWidth) / 2, 0,
            PODIUM_HEIGHT, center - entryHalfWidth - left);
          if (right > center + entryHalfWidth) panel(face, (right + center + entryHalfWidth) / 2, 0,
            PODIUM_HEIGHT, right - center - entryHalfWidth);
        } else if (podium && isNorth && (bay === 0 || bay === bays - 1)) {
          panel(face, x, 0, height, width);
        } else if (podium && (isNorth || outwardZ < .2)) {
          rectangularBay(face, x, width, .3, 8.8, false);
          archedBay(face, x, width);
        } else if (podium) {
          curtain(face, x - width / 2 + .55, x + width / 2 - .55, .5, height - .5);
          panel(face, x - width / 2 + .26, 0, height, .52, .65, .08);
          panel(face, x + width / 2 - .26, 0, height, .52, .65, .08);
          panel(face, x, height - .5, height, width);
        } else {
          curtain(face, x - width / 2 + .65, x + width / 2 - .65, .5, 9.8, false, -1.5);
          panel(face, x - width / 2 + .22, 0, 10, .44, .65, -1.1);
          if (bay % 3 === 1) B.cylinder(face, [x, .35, -.5], [x, 9.84, -.5], .29, .29, white, 12);
        }
      }
      box(face, 'thin projecting roof edge', length / 2, height + .23, .13, length + .20, .17, .8, podium ? red : frames);
      if (!internal) box(face, 'continuous recessed base', length / 2, .18, .12, length, .35, .42, frames);
    }
  }
  B.finish();
  architecture.traverse(mesh => {if (mesh.isMesh && mesh.material === atriumGlass) mesh.castShadow = false;});
  const eastEdge = [source.points[3], source.points[4]];
  const interpolateX = (a, b, z) => a[0] + (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]);
  const semX = interpolateX(...eastEdge, BRIDGE_Z);
  const shundeX = interpolateX(FOOTPRINT[0], FOOTPRINT[1], BRIDGE_Z);
  const corridor = createSkyCorridor(THREE, {start: [semX - .2, BRIDGE_Z], end: [shundeX + .2, BRIDGE_Z], textured});
  group.add(corridor.group);
  group.updateMatrixWorld(true);
  if (!northAtrium) throw new Error('The source SEM outline no longer supplies the long north entrance edge.');
  const {facade, component, ...atriumStats} = northAtrium;
  return {group, architecture, corridor, windows, northAtrium,
    stats: {osmWay: source.id, height: SEM_HEIGHT, podiumHeight: PODIUM_HEIGHT,
      northAtrium: atriumStats,
      windows: windows.length, archedWindows: windows.filter(w => w.type === 'arch').length,
      corridor: corridor.stats}};
}
