import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {createLeafGeometry} from '../../courtyard/src/leaves.js';
import {buildCourtyardTree, scatterTreeLeaves} from '../../courtyard/src/trees.js';
import outline from '../../../shared/assets/leaves/outline.json' with {type: 'json'};

const canonical = new WeakMap();
export const TREE_LIMITS = {desktop: 12, mobile: 4, distance: 70, leavesPerTree: 684};

function templates() {
  let seed = 41827, branch = 0;
  const rand = () => {seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296;};
  const between = (lo, hi) => lo + rand() * (hi - lo);
  const trunk = [], clusters = [], matrix = new THREE.Matrix4(), quaternion = new THREE.Quaternion();
  buildCourtyardTree({x: 0, z: 0, height: 8, spread: 2.6, rand, between,
    cylinder(a, b, r1, r2) {
      if (r1 < .07 || r1 < .2 && branch++ % 2) return;
      const from = new THREE.Vector3(...a), to = new THREE.Vector3(...b), delta = to.clone().sub(from);
      const g = new THREE.CylinderGeometry(r2, r1, delta.length(), 5);
      quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
      matrix.compose(from.add(to).multiplyScalar(.5), quaternion, new THREE.Vector3(1, 1, 1));
      g.applyMatrix4(matrix); trunk.push(g);
    },
    cluster(cx, cy, cz, rx, ry, rz) {clusters.push({cx, cy, cz, rx, ry, rz});},
  });
  const leaf = createLeafGeometry(THREE);
  const points = [0, 8, 16, 30, 41, 49, 60, 67, 70].map(i => new THREE.Vector2(...outline[i]));
  const coarse = new THREE.ShapeGeometry(new THREE.Shape(points));
  coarse.translate(-.44, -.08, 0);
  const makeLeaves = (near, count) => {
    const pieces = [];
    for (const cluster of clusters) {
      const {cx, cy, cz, rx, ry, rz} = cluster;
      const add = (x, y, z, size) => {
        const g = (near ? leaf : coarse).clone();
        const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(between(-1.3, 1.3), rand() * Math.PI * 2, rand() * Math.PI * 2));
        matrix.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(size * between(.75, 1.05), size, size));
        g.applyMatrix4(matrix);
        const color = new THREE.Color().setHSL(.245 + between(-.025, .025), between(.32, .48), between(.26, .43));
        const colors = new Float32Array(g.attributes.position.count * 3);
        for (let i = 0; i < g.attributes.position.count; i++) colors.set(color.toArray(), i * 3);
        g.setAttribute('color', new THREE.BufferAttribute(colors, 3)); pieces.push(g);
      };
      if (near || count > 2) scatterTreeLeaves(rand, between, cx, cy, cz, rx, ry * .72, rz, count, near ? .64 : .95, add);
      else for (let i = 0; i < count; i++) add(cx, cy, cz, rx * 2.25);
    }
    const merged = mergeGeometries(pieces);
    pieces.forEach(g => g.dispose()); return merged;
  };
  const branches = mergeGeometries(trunk);
  trunk.forEach(g => g.dispose());
  const far = makeLeaves(false, 2), near = makeLeaves(true, 36), exported = makeLeaves(false, 12);
  leaf.dispose(); coarse.dispose();
  return {branches, far, near, exported};
}

export function createCampusTrees(group, placements) {
  const geometry = templates(), bark = new THREE.MeshStandardMaterial({name: 'Courtyard reused branching bark', color: '#665b43', roughness: .98});
  const foliage = new THREE.MeshStandardMaterial({name: 'Courtyard reused lobed leaves; procedural colors, unverified species',
    color: '#ffffff', vertexColors: true, roughness: .92, side: THREE.DoubleSide});
  const count = placements.length;
  const branches = new THREE.InstancedMesh(geometry.branches, bark, count);
  const crowns = new THREE.InstancedMesh(geometry.far, foliage, count);
  const leaves = new THREE.InstancedMesh(geometry.near, foliage, TREE_LIMITS.desktop);
  branches.name = 'Courtyard branching trees: shared full-map instances';
  crowns.name = 'Courtyard lobed canopy sprays: full-map lightweight display';
  leaves.name = 'Courtyard individual leaves: bounded close-up display only';
  branches.userData.campusTreeBranches = true; crowns.userData.campusTreeCanopy = true;
  leaves.userData.campusTreeDisplayOnly = true; leaves.count = 0; leaves.frustumCulled = false;
  const object = new THREE.Object3D(), matrices = [], colors = [], zero = new THREE.Matrix4().makeScale(0, 0, 0);
  for (const [index, tree] of placements.entries()) {
    const phase = (index * 1.61803398875) % 1, height = 6 + phase * 4;
    object.position.set(tree.position[0], 0, tree.position[1]);
    object.scale.setScalar(height / 8); object.rotation.y = phase * Math.PI * 2; object.updateMatrix();
    matrices.push(object.matrix.clone()); branches.setMatrixAt(index, object.matrix); crowns.setMatrixAt(index, object.matrix);
    const color = new THREE.Color().setHSL(.25 + phase * .035, .12, .72 + phase * .16);
    colors.push(color); crowns.setColorAt(index, color);
  }
  for (const mesh of [branches, crowns, leaves]) {
    mesh.castShadow = true; mesh.receiveShadow = false; if (mesh !== leaves) mesh.computeBoundingSphere(); group.add(mesh);
  }
  canonical.set(geometry.far, geometry.exported);
  group.userData.treeLOD = {source: 'projects/courtyard/src/trees.js + shared/leaves.js',
    leafSource: 'cgbookcase Maple Leaf 01 outline, CC0; no downloaded textures',
    nearTrees: 0, maxNearTrees: TREE_LIMITS.desktop, leavesPerTree: TREE_LIMITS.leavesPerTree,
    exportPolicy: 'All tree instances use the same camera-independent medium-detail canopy; display-only near leaves are removed.'};
  let selected = [], last = '';
  const frustum = new THREE.Frustum(), projection = new THREE.Matrix4(), inverse = new THREE.Matrix4();
  return {materials: [bark, foliage], extraGeometry: geometry.exported,
    update(camera, mobile = false) {
      const cap = mobile ? TREE_LIMITS.mobile : TREE_LIMITS.desktop, candidates = [];
      if (group.visible) {
        group.updateWorldMatrix(true, false); inverse.copy(group.matrixWorld).invert();
        const position = camera.getWorldPosition(new THREE.Vector3()).applyMatrix4(inverse);
        projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); frustum.setFromProjectionMatrix(projection);
        for (const [index, tree] of placements.entries()) {
          const center = new THREE.Vector3(tree.position[0], 5, tree.position[1]);
          const distance = center.distanceToSquared(position);
          if (distance < TREE_LIMITS.distance ** 2 && frustum.intersectsSphere(new THREE.Sphere(center.applyMatrix4(group.matrixWorld), 6))) {
            candidates.push({index, distance});
          }
        }
      }
      const next = candidates.sort((a, b) => a.distance - b.distance || a.index - b.index).slice(0, cap).map(v => v.index);
      const key = next.join(',');
      if (key !== last) {
        for (const i of selected) crowns.setMatrixAt(i, matrices[i]);
        for (const [slot, i] of next.entries()) {
          crowns.setMatrixAt(i, zero); leaves.setMatrixAt(slot, matrices[i]); leaves.setColorAt(slot, colors[i]);
        }
        leaves.count = next.length; leaves.instanceMatrix.needsUpdate = true;
        if (leaves.instanceColor) leaves.instanceColor.needsUpdate = true;
        crowns.instanceMatrix.needsUpdate = true; selected = next; last = key;
      }
      Object.assign(group.userData.treeLOD, {nearTrees: next.length, maxNearTrees: cap});
    },
  };
}

export function prepareTreeExport(object) {
  object.traverse(group => {
    const branches = group.children.find(child => child.userData.campusTreeBranches);
    if (!branches) return;
    const canopy = group.children.find(child => child.userData.campusTreeCanopy), geometry = canonical.get(canopy?.geometry);
    if (!canopy || !geometry) throw new Error('Missing canonical courtyard tree export geometry.');
    canopy.geometry = geometry; canopy.instanceMatrix.copy(branches.instanceMatrix);
    for (const child of [...group.children]) if (child.userData.campusTreeDisplayOnly) group.remove(child);
    group.userData.treeLOD.nearTrees = 0;
  });
  return object;
}
