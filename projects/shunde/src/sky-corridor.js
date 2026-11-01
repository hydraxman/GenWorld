import {createBuilder} from './builder.js';

export const CORRIDOR_CLEARANCE = 9.84;
export const CORRIDOR_HEIGHT = 5.2;
export const CORRIDOR_WIDTH = 3.4;

export function createSkyCorridor(THREE, {start, end, textured = true}) {
  if (![...start, ...end].every(Number.isFinite) || start.length !== 2 || end.length !== 2) {
    throw new Error('Sky corridor requires finite [east, -north] endpoint coordinates.');
  }
  const length = Math.hypot(end[0] - start[0], end[1] - start[1]);
  if (length < 4) throw new Error('Sky corridor span must connect two separate building faces.');
  const B = createBuilder(THREE, 19861), {box} = B;
  const group = new THREE.Group();
  group.name = 'Gray enclosed elevated corridor between SEM and Shunde';
  group.position.set(start[0], 0, start[1]);
  group.rotation.y = -Math.atan2(end[1] - start[1], end[0] - start[0]);
  group.userData = {role: 'sky-corridor', start, end, clearance: CORRIDOR_CLEARANCE,
    source: 'user-confirmed Shunde connection visible at the left of the official north exterior photograph',
    dimensionsStatus: 'Lower edge aligned to the elevated glass wing in the photograph; height, span and northward attachment are estimated.'};
  const plain = (name, color, roughness = .6, metalness = .1) =>
    new THREE.MeshStandardMaterial({name, color, roughness, metalness});
  const gray = textured ? B.pbr('Gray corridor cladding', 'grain', [153, 158, 158], [1.4, 1.4], 256)
    : plain('Gray corridor cladding', '#999e9e');
  gray.normalScale?.set(.09, .09);
  const frame = plain('Corridor aluminum posts', '#b4b9b7', .4, .55);
  const seam = plain('Corridor panel joints', '#697779');
  const floor = plain('Corridor interior floor', '#838b87', .85);
  const glass = new THREE.MeshPhysicalMaterial({name: 'Corridor glass', color: '#86a3ab',
    roughness: .12, metalness: .3, transparent: true, opacity: .75, depthWrite: false});
  const y = CORRIDOR_CLEARANCE, width = CORRIDOR_WIDTH, h = CORRIDOR_HEIGHT;
  // The underside is suspended: no ground-level box or hidden backing spans the road.
  box(group, 'structural soffit', length / 2, y + .17, 0, length + .30, .34, width + .12, gray);
  box(group, 'interior walkable floor', length / 2, y + .36, 0, length + .30, .04, width, floor);
  box(group, 'roof cap', length / 2, y + h - .17, 0, length + .5, .34, width + .35, gray);
  const bays = Math.max(4, Math.ceil(length / 1.55)), bayWidth = length / bays;
  for (const side of [-1, 1]) {
    const z = side * width / 2;
    box(group, 'continuous lower gray fascia', length / 2, y + .53, z, length + .30, .32, .17, gray);
    box(group, 'continuous upper gray fascia', length / 2, y + h - .43, z, length + .30, .27, .19, gray);
    for (let b = 0; b < bays; b++) {
      const x = (b + .5) * bayWidth, glassBottom = y + .72, glassTop = y + h - .59;
      box(group, 'longitudinal glazing', x, (glassBottom + glassTop) / 2, z,
        bayWidth - .085, glassTop - glassBottom, .045, glass);
      box(group, 'spandrel seam', b * bayWidth, y + .53, z + side * .09, .018, .30, .012, seam);
    }
    for (let b = 0; b <= bays; b++) {
      box(group, 'full height corridor post', b * bayWidth, y + h / 2, z,
        .085, h - .35, .16, frame);
    }
    for (const yy of [y + .7, y + h - .57]) box(group, 'glazing rail',
      length / 2, yy, z + side * .045, length + .08, .075, .13, frame);
  }
  for (const x of [0, length]) {
    for (const side of [-1, 1]) box(group, 'end connection jamb', x, y + (h + .14) / 2,
      side * (width / 2 + .07), .32, h + .14, .23, gray);
    box(group, 'end connection lintel', x, y + h + .025, 0, .32, .22, width + .32, gray);
  }
  B.finish();
  group.updateMatrixWorld(true);
  return {group, length, stats: {clearance: y, width, height: h, glazingBays: bays}};
}
