import * as THREE from 'three';
import {createBuilder} from '../../shunde/src/builder.js';

export function isOriginalRearTriangle(section, positions, normals, offset) {
  const back = [0, 1, 2].every(i => positions.getZ(offset + i) < -8.98);
  if (!back) return false;
  if (section === 'Windows and facade joinery') return true;
  if (section !== 'Building shell') return false;
  return [0, 1, 2].every(i => positions.getY(offset + i) < 9.12 && normals.getZ(offset + i) < -.99)
    || [0, 1, 2].every(i => positions.getZ(offset + i) < -9.01 && positions.getY(offset + i) < 2.7);
}

export function refineBiologyNorth(source) {
  const materials = new Map();
  let removed = 0;
  for (const section of source.children) section.traverse(mesh => {
    if (!mesh.isMesh) return;
    materials.set(mesh.material.name, mesh.material);
    if (!['Building shell', 'Windows and facade joinery'].includes(section.name)) return;
    const old = mesh.geometry, geometry = old.index ? old.toNonIndexed() : old;
    const p = geometry.attributes.position, normal = geometry.attributes.normal, keep = [];
    for (let i = 0; i < p.count; i += 3) {
      if (isOriginalRearTriangle(section.name, p, normal, i)) removed++;
      else keep.push(i, i + 1, i + 2);
    }
    if (keep.length === p.count) {if (geometry !== old) geometry.dispose(); return;}
    const next = new THREE.BufferGeometry();
    for (const [name, attribute] of Object.entries(geometry.attributes)) {
      const values = new attribute.array.constructor(keep.length * attribute.itemSize);
      for (const [index, from] of keep.entries()) values.set(
        attribute.array.subarray(from * attribute.itemSize, (from + 1) * attribute.itemSize), index * attribute.itemSize);
      next.setAttribute(name, new THREE.BufferAttribute(values, attribute.itemSize, attribute.normalized));
    }
    next.computeBoundingBox(); next.computeBoundingSphere(); mesh.geometry = next;
    old.dispose(); if (geometry !== old) geometry.dispose();
  });
  const material = name => {
    const m = materials.get(name);
    if (!m) throw new Error(`Missing original Courtyard finish: ${name}`);
    return m;
  };
  const M = {brick: material('Weathered deep brick red'), stone: material('Pale weathered concrete'),
    granite: material('Light dressed granite coping'), glass: material('Unified gray blue architectural glass'),
    frame: material('Dark mahogany painted window frame')};
  const group = new THREE.Group(); group.name = 'Photo-refined north bridge entrance';
  source.add(group);
  const B = createBuilder(THREE);
  B.textureWorld.set(M.brick, [1.08, 1.16]); B.textureWorld.set(M.stone, [1.5, 1.5]);
  B.textureWorld.set(M.granite, [1.3, 1.3]);
  const openings = [], dimensions = {width: 33.6, centralWidth: 7.8, top: 11.6, wingTop: 8.25};
  const box = (x, y, z, w, h, d, m = M.stone) => B.box(group, '', x, y, z, w, h, d, m);
  function facade(x0, x1, top, z, holes, m, bottom = .02) {
    const shape = new THREE.Shape([
      new THREE.Vector2(x0, bottom), new THREE.Vector2(x1, bottom),
      new THREE.Vector2(x1, top), new THREE.Vector2(x0, top),
    ]);
    for (const o of holes) shape.holes.push(new THREE.Path([
      new THREE.Vector2(o.x - o.w / 2, o.y), new THREE.Vector2(o.x + o.w / 2, o.y),
      new THREE.Vector2(o.x + o.w / 2, o.y + o.h), new THREE.Vector2(o.x - o.w / 2, o.y + o.h),
    ]));
    const geometry = new THREE.ExtrudeGeometry(shape, {depth: .22, bevelEnabled: false, curveSegments: 1});
    geometry.translate(0, 0, z); B.worldUV(geometry, m); B.add(group, geometry, m);
    for (const o of holes) {
      const depth = o.door ? .94 : .32, paneZ = z + depth;
      box(o.x, o.y + o.h / 2, paneZ, o.w, o.h, .035, M.glass);
      for (const side of [-1, 1]) {
        box(o.x + side * (o.w / 2 + .065), o.y + o.h / 2, z + depth / 2, .13, o.h + .16, depth, M.granite);
        box(o.x + side * (o.w / 2 - .04), o.y + o.h / 2, paneZ - .05, .065, o.h, .12, M.frame);
      }
      for (const fraction of o.door ? [0, .16, .77, 1] : [0, .34, .68, 1]) box(o.x, o.y + o.h * fraction, paneZ - .05, o.w, .06, .12, M.frame);
      box(o.x, o.y + o.h / 2, paneZ - .05, .06, o.h, .12, M.frame);
      box(o.x, o.y - .08, z + .05, o.w + .28, .16, .52, M.granite);
      if (o.door) for (const sign of [-1, 1]) box(o.x + sign * .13, o.y + .8, paneZ - .15, .025, .32, .06, M.granite);
      openings.push({...o, outside: [o.x + o.w * .2, o.y + o.h * .46, z - 1], depth});
    }
  }
  for (const sign of [-1, 1]) {
    const holes = [];
    for (const x of [5.3, 8.5, 11.7, 14.9]) {
      holes.push({x: sign * x, y: .42, w: 1.15, h: .95});
      for (const y of [1.98, 4.05, 6.12]) holes.push({x: sign * x, y, w: 1.4, h: 1.63});
    }
    const x0 = sign < 0 ? -16.8 : 3.9, x1 = sign < 0 ? -3.9 : 16.8;
    facade(x0, x1, 1.68, -9.18, holes.filter(o => o.y < 1.68), M.stone);
    facade(x0, x1, 8.25, -9.18, holes.filter(o => o.y > 1.68), M.brick, 1.68);
    box(sign * 6.95, 8.68, -8.99, 6.1, .86, .22, M.brick);
    for (const x of [4.35, 7.7, 10.9, 14.1, 16.55]) box(sign * x, 5.05, -9.26, .28, 6.4, .19);
    for (const y of [1.68, 3.83, 5.9, 8.2]) box(sign * 10.35, y, -9.25, 12.9, .17, .25);
    for (const x of [5.3, 8.5, 11.7, 14.9]) for (const y of [3.81, 5.88]) {
      box(sign * x, y, -9.23, 1.6, .35, .12);
    }
  }
  facade(-3.9, 3.9, 11.1, -9.8, [
    {x: 0, y: 1.75, w: 2.55, h: 2.45, door: true},
    ...[-2.3, 0, 2.3].flatMap(x => [{x, y: 4.85, w: 1.02, h: 1.6}, {x, y: 7.1, w: 1.02, h: 3.02}]),
  ], M.stone);
  for (const x of [-3.7, -1.48, 1.48, 3.7]) {
    box(x, 7.7, -9.93, .31, 7.8, .34);
    box(x, 11.32, -9.8, .56, .56, .56, M.granite);
  }
  for (const sign of [-1, 1]) {
    box(sign * 3.8, 10.14, -8.89, .2, 2.1, 1.9);
    box(sign * 1.62, 2.82, -10.12, .48, 2.8, .63, M.granite);
    box(sign * 2.38, .96, -11.15, .36, 1.92, 3.1, M.granite);
  }
  box(0, 11.07, -8.94, 7.8, .18, 1.94, M.granite);
  box(0, 4.38, -10.1, 4.03, .47, .59, M.granite);
  box(0, 10.66, -9.92, 7.9, .22, .34, M.granite);
  for (let i = 0; i < 10; i++) {
    const h = 1.75 * (i + 1) / 10;
    box(0, h / 2, -11.6 + i * .11, 4.05, h, 3.6 - i * .22, M.granite);
  }
  B.finish();
  group.userData = {referenceImage: 'biology-hall-commons.jpg', source: 'CC BY-SA 2.0, cabbagezs',
    scope: 'North elevation only; source south, side wings, roof and garden preserved without stretching.',
    dimensions, openings, removedOriginalRearTriangles: removed,
    estimated: 'Dimensions fitted to the original source model, not a surveyed reconstruction; unseen side returns inferred.',
    observed: ['projecting pale stone entrance', 'recessed double door and raised steps', 'three upper window bays',
      'stepped parapet piers', 'vertical stone mullions and spandrels', 'three brick-wing window tiers above basement']};
  return group;
}
