import {createBuilder} from './builder.js';
import {createSkyCorridor} from './sky-corridor.js';
import {FOOTPRINT} from './footprint.js';

export const SEM_WAY = 937482182;
export const SEM_HEIGHT = 30;
export const BRIDGE_Z = 2;
const PODIUM_HEIGHT = 22.7;
const SPLIT_Z = 23;

function clipped(points, north) {
  const out = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    const ina = north ? a[1] <= SPLIT_Z : a[1] >= SPLIT_Z;
    const inb = north ? b[1] <= SPLIT_Z : b[1] >= SPLIT_Z;
    if (ina) out.push(a);
    if (ina !== inb) {
      const u = (SPLIT_Z - a[1]) / (b[1] - a[1]);
      out.push([a[0] + (b[0] - a[0]) * u, SPLIT_Z]);
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
  const red = textured ? B.pbr('Brick-red terracotta panel cladding', 'grain', [159, 71, 47], [1.4, 1.4], 512)
    : plain('Brick-red terracotta panel cladding', '#9f472f');
  red.normalScale?.set(.075, .075);
  const panelSeam = plain('Terracotta panel joint', '#713f34');
  const glass = plain('Recessed SEM glazing', '#547681', .15, .5);
  const frames = plain('SEM dark bronze aluminum', '#3e4948', .35, .55);
  const sill = plain('SEM pale stone sill and coping', '#b5b7b1', .65);
  const shade = plain('SEM deep window reveals', '#293b3d');
  const roof = textured ? B.pbr('SEM roof concrete', 'grain', [132, 139, 135], [2, 2], 256)
    : plain('SEM roof concrete', '#848b87');
  const windows = [];
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
    const width = Math.min(2.9, bayWidth * .58), bottom = 10.0, spring = 19.2;
    const wallShape = new THREE.Shape([
      new THREE.Vector2(-bayWidth / 2, 8.8), new THREE.Vector2(bayWidth / 2, 8.8),
      new THREE.Vector2(bayWidth / 2, PODIUM_HEIGHT), new THREE.Vector2(-bayWidth / 2, PODIUM_HEIGHT),
    ]);
    wallShape.holes.push(new THREE.Path(arch(width + .13, bottom - .08, spring).getPoints(32)));
    const wallGeometry = new THREE.ExtrudeGeometry(wallShape, {depth: .40, bevelEnabled: false, curveSegments: 24});
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
    const glazing = new THREE.ShapeGeometry(arch(width, bottom, spring), 32);
    glazing.translate(x, 0, .045);
    B.add(parent, glazing, glass);
    const frameShape = arch(width + .18, bottom - .09, spring);
    frameShape.holes.push(new THREE.Path(arch(width, bottom, spring).getPoints(32)));
    const trim = new THREE.ExtrudeGeometry(frameShape, {depth: .12, bevelEnabled: false, curveSegments: 32});
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
      for (let y = base + 1.2; y < top; y += 1.2) {
        box(parent, 'red panel horizontal seam', x, y, .327, width - .2, .012, .012, panelSeam);
      }
    }
    windows.push({type: 'rectangular', x, width: opening});
  }
  for (const north of [true, false]) {
    const points = clipped(source.points, north), height = north ? PODIUM_HEIGHT : SEM_HEIGHT;
    const part = new THREE.Group();
    part.name = north ? 'Red arched SEM podium - estimated internal division' : 'Six-level SEM glazed wing';
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
      const upperReturn = a[1] === SPLIT_Z && b[1] === SPLIT_Z;
      if (upperReturn && north) continue;
      // Local +Z faces outside; reversal changes traversal, never source vertices.
      if (signedArea > 0) [a, b] = [b, a];
      const dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
      const face = new THREE.Group();
      face.name = 'SEM articulated facade';
      face.position.set(a[0], 0, a[1]);
      face.rotation.y = -Math.atan2(dz, dx);
      part.add(face);
      const bays = Math.max(1, Math.round(length / 4.65)), width = length / bays;
      for (let bay = 0; bay < bays; bay++) {
        const x = (bay + .5) * width;
        if (upperReturn) {
          rectangularBay(face, x, width, PODIUM_HEIGHT + .26, 26.4, true);
          rectangularBay(face, x, width, 26.4, SEM_HEIGHT, true);
        } else if (north) {
          rectangularBay(face, x, width, .3, 4.55, false);
          rectangularBay(face, x, width, 4.55, 8.8, false);
          archedBay(face, x, width);
        } else {
          for (let floor = 0; floor < 6; floor++) rectangularBay(face, x, width, floor * 5 + .3,
            (floor + 1) * 5, floor >= 2);
        }
      }
      box(face, 'thin projecting roof edge', length / 2, height + .23, .13, length + .20, .17, .8, sill);
      if (!upperReturn) box(face, 'continuous recessed base', length / 2, .18, .12, length, .35, .42, frames);
    }
  }
  B.finish();
  const eastEdge = [source.points[3], source.points[4]];
  const interpolateX = (a, b, z) => a[0] + (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]);
  const semX = interpolateX(...eastEdge, BRIDGE_Z);
  const shundeX = interpolateX(FOOTPRINT[0], FOOTPRINT[1], BRIDGE_Z);
  const corridor = createSkyCorridor(THREE, {start: [semX - .2, BRIDGE_Z], end: [shundeX + .2, BRIDGE_Z], textured});
  group.add(corridor.group);
  group.updateMatrixWorld(true);
  return {group, architecture, corridor, windows,
    stats: {osmWay: source.id, height: SEM_HEIGHT, podiumHeight: PODIUM_HEIGHT,
      windows: windows.length, archedWindows: windows.filter(w => w.type === 'arch').length,
      corridor: corridor.stats}};
}
