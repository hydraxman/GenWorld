import {createBuilder} from './builder.js';
import {createLeafGeometry} from '../../../shared/leaves.js';

export const FORECOURT = Object.freeze({minX: -55, maxX: 39, minZ: -91, maxZ: -35});
export const GROVE_SITES = [
  [-46, -46, 8.6], [-45, -59, 10.2], [-45, -74, 9.6],
  [-32, -79, 10.5], [-17, -82, 9.4], [-3, -78, 10.3],
  [12, -79, 9.2], [28, -77, 10.8], [29, -61, 9.8], [28, -46, 8.8],
  [-33, -63, 8.7], [12, -60, 9.5],
  [-47, -39, 7.2], [14, -39, 8.2],
];

export function createForecourt(THREE, {textured = true, leafMaterial = null} = {}) {
  const B = createBuilder(THREE, 18091), {box, cylinder} = B;
  const group = new THREE.Group();
  group.name = 'User-directed concrete forecourt and woodland';
  group.userData = {ground: 'level concrete hardscape, not raised terrain',
    source: 'user correction; exact tree positions and paving joints illustrative'};
  const paving = new THREE.Group();
  paving.name = 'Continuous fine-grained concrete slabs';
  paving.userData.role = 'concrete-hardscape';
  group.add(paving);
  const plain = (name, color) => new THREE.MeshStandardMaterial({name, color, roughness: .94});
  const concrete = textured ? B.pbr('Fine aggregate concrete', 'grain', [160, 163, 157], [1.3, 1.3])
    : plain('Fine aggregate concrete', '#a0a39d');
  concrete.normalScale?.set(.11, .11);
  const joint = plain('Recessed concrete expansion joints', '#727c78');
  const soil = plain('Flush woodland tree pits', '#5e5541');
  const bark = textured ? B.pbr('Forecourt fissured bark', 'grain', [96, 92, 74], [.4, 1.5], 256)
    : plain('Forecourt fissured bark', '#605c4a');
  const {minX, maxX, minZ, maxZ} = FORECOURT;
  box(paving, 'supported concrete apron', (minX + maxX) / 2, -.011, (minZ + maxZ) / 2,
    maxX - minX, .09, maxZ - minZ, concrete);
  for (let x = minX + 3; x < maxX; x += 3.6) {
    box(paving, 'expansion joint', x, .035, (minZ + maxZ) / 2, .027, .006, maxZ - minZ, joint);
  }
  for (let z = minZ + 3; z < maxZ; z += 3.6) {
    box(paving, 'expansion joint', (minX + maxX) / 2, .035, z, maxX - minX, .006, .027, joint);
  }
  const leaves = new THREE.InstancedMesh(createLeafGeometry(THREE, .32),
    leafMaterial || new THREE.MeshStandardMaterial({name: 'Forecourt leaf surfaces', color: '#607246',
      roughness: .86, side: THREE.DoubleSide}), GROVE_SITES.length * 2800);
  leaves.name = 'Woodland individual curved leaves';
  leaves.castShadow = true;
  leaves.receiveShadow = true;
  group.add(leaves);
  const dummy = new THREE.Object3D(), color = new THREE.Color();
  let index = 0;
  for (const [x, z, height] of GROVE_SITES) {
    const tree = new THREE.Group();
    tree.name = 'Branching woodland tree';
    tree.userData = {role: 'forecourt-tree', site: [x, z], height, placement: 'illustrative'};
    group.add(tree);
    box(tree, 'flush pit', x, .042, z, 2.15, .012, 2.15, soil);
    for (const s of [-1, 1]) {
      box(tree, 'pit edging', x + s * 1.12, .07, z, .12, .075, 2.35, concrete);
      box(tree, 'pit edging', x, .07, z + s * 1.12, 2.35, .075, .12, concrete);
    }
    cylinder(tree, [x, 0, z], [x + .16, height * .78, z - .12], .23, .075, bark, 10);
    const tips = [];
    for (let b = 0; b < 10; b++) {
      const a = b * 2.39996, reach = 1.8 + B.rand() * 1.3;
      const start = [x, height * (.40 + b * .025), z];
      const end = [x + Math.cos(a) * reach, height * (.75 + (b % 3) * .07), z + Math.sin(a) * reach];
      cylinder(tree, start, end, .095, .018, bark, 7);
      tips.push(end);
      for (const side of [-1, 1]) cylinder(tree,
        end.map((v, i) => (v + start[i]) / 2),
        [end[0] + Math.cos(a + side) * .9, end[1] + .7, end[2] + Math.sin(a + side) * .9],
        .03, .008, bark, 5);
    }
    for (let n = 0; n < 2800; n++) {
      const tip = tips[n % tips.length], a = B.rand() * Math.PI * 2, v = B.rand() * 2 - 1;
      const r = Math.cbrt(B.rand()) * 1.8, ring = r * Math.sqrt(1 - v * v);
      dummy.position.set(tip[0] + Math.cos(a) * ring, tip[1] + v * r * .8, tip[2] + Math.sin(a) * ring);
      dummy.rotation.set(B.rand() * Math.PI, B.rand() * Math.PI * 2, B.rand() * Math.PI);
      dummy.scale.setScalar(.75 + B.rand() * .75);
      dummy.updateMatrix();
      leaves.setMatrixAt(index, dummy.matrix);
      color.setHSL(.22 + B.rand() * .07, .22 + B.rand() * .12, .48 + B.rand() * .14);
      leaves.setColorAt(index++, color);
    }
  }
  leaves.instanceMatrix.needsUpdate = true;
  leaves.instanceColor.needsUpdate = true;
  B.finish();
  group.updateMatrixWorld(true);
  return {group, paving, leaves, stats: {trees: GROVE_SITES.length, leafInstances: index, terrainRaised: false}};
}
