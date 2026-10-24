import * as THREE from 'three';
import polygonClipping from 'polygon-clipping';
import {createBuilder} from '../../shunde/src/builder.js';
import {footprintMetrics} from './geo.js';
import {replaceBuilding} from './model.js';
import match from '../data/old-library-match.json' with {type: 'json'};

// One map address for a merged complex, NOT separate invented IDs for its wings.
export const OLD_LIBRARY_IDS = Object.freeze([match.featureId]);
const PAGES = Object.freeze([
  'https://lib.tsinghua.edu.cn/gk/gsfm/lg.htm',
  'https://www.tsinghua.edu.cn/info/2965/108059.htm',
]);
const HEIGHT_SOURCE = '老馆西向入口与低侧翼按官方照片比例推定，非测绘；未考证组团部分保留上游5米基础体量';
const LIMITS = '只细化东翼西向入口及紧邻低侧翼。檐高、屋脊、窗尺度与隐蔽侧后墙为估计；夜景仅支持低翼坡屋顶，中央四坡顶及其脊高为推定。1931中西部、逸夫馆、李文正馆及相连部分不作照片重建，保留原轮廓的中性基础体量。';

function verifySource(feature) {
  const p = feature?.properties;
  if (feature?.id !== match.featureId || p?.kind !== 'building' ||
      p.name !== match.expectedName || p.nameSource !== 'unknown' || p.nameConfidence !== 0 ||
      p.sourceFeatureId !== null || p.nameSourceFeatureId != null ||
      p.sourceLayer !== 'building' || p.idStrategy !== 'canonical-geometry-sha256-96' ||
      p.sourceIdScope !== 'batched-vector-feature-not-individual-building' ||
      p.extrude !== true || p.minHeight !== 0 || p.renderHeight !== 5 ||
      JSON.stringify(p.sourceTiles) !== '["14/13485/6202"]' ||
      JSON.stringify(p.upstreamBatchFeatureIds) !== '["103278700"]' ||
      !p.poiLabels?.some(label => label.name === match.label.name &&
        label.sourceFeatureId === match.label.sourceFeatureId &&
        label.upstreamProperties?.['name:en'] === 'Old Library') ||
      JSON.stringify(feature.geometry) !== JSON.stringify(match.sourceGeometry)) {
    throw new Error('Old-library source identity/geometry/name changed; re-match osm:relation:20779765, not a nearby POI.');
  }
}

function verifyCoordinates(center, origin) {
  if (!Array.isArray(center) || center.length !== 2 || !center.every(Number.isFinite) ||
      Math.abs(center[0]) > 180 || Math.abs(center[1]) >= 90 ||
      !Array.isArray(origin) || origin.length !== 2 || !origin.every(Number.isFinite)) {
    throw new Error('Old-library requires finite WGS84 center and local origin.');
  }
}

function rectangle(lo, rear, hi, front) {
  return [[[lo, rear], [hi, rear], [hi, front], [lo, front], [lo, rear]]];
}

function inRing([x, z], ring) {
  let inside = false;
  for (let i = 0; i < ring.length - 1; i++) {
    const a = ring[i], b = ring[i + 1];
    if ((a[1] > z) !== (b[1] > z) &&
        x < a[0] + (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1])) inside = !inside;
  }
  return inside;
}

function inPlan(point, plan) {
  return plan.some(p => inRing(point, p[0]) && !p.slice(1).some(r => inRing(point, r)));
}

// Clip roof-cap centerlines too: source courtyard notches must not receive
// diagonal decorative rods even though the roof surface itself is clipped.
function clippedSegments(a, b, plan) {
  const d = [b[0] - a[0], b[1] - a[1]], cuts = [0, 1];
  for (const polygon of plan) for (const ring of polygon) {
    for (let i = 0; i < ring.length - 1; i++) {
      const c = ring[i], e = [ring[i + 1][0] - c[0], ring[i + 1][1] - c[1]];
      const det = d[0] * e[1] - d[1] * e[0];
      if (Math.abs(det) < 1e-9) continue;
      const ca = [c[0] - a[0], c[1] - a[1]];
      const t = (ca[0] * e[1] - ca[1] * e[0]) / det;
      const u = (ca[0] * d[1] - ca[1] * d[0]) / det;
      if (t > 0 && t < 1 && u >= 0 && u <= 1) cuts.push(t);
    }
  }
  cuts.sort((x, y) => x - y);
  const at = t => [a[0] + d[0] * t, a[1] + d[1] * t], segments = [];
  for (let i = 1; i < cuts.length; i++) {
    if (cuts[i] - cuts[i - 1] > 1e-7 && inPlan(at((cuts[i] + cuts[i - 1]) / 2), plan)) {
      segments.push([at(cuts[i - 1]), at(cuts[i])]);
    }
  }
  return segments;
}

function planShape(rings) {
  const points = ring => ring.map(([u, v]) => new THREE.Vector2(u, -v));
  const result = new THREE.Shape(points(rings[0]));
  rings.slice(1).forEach(ring => result.holes.push(new THREE.Path(points(ring))));
  return result;
}

function rectShape(x, bottom, width, height) {
  const s = new THREE.Shape();
  s.moveTo(x - width / 2, bottom);
  s.lineTo(x + width / 2, bottom);
  s.lineTo(x + width / 2, bottom + height);
  s.lineTo(x - width / 2, bottom + height);
  s.closePath();
  return s;
}

function archShape(x, bottom, width, spring) {
  const r = width / 2, s = new THREE.Shape();
  s.moveTo(x - r, bottom);
  s.lineTo(x + r, bottom);
  s.lineTo(x + r, spring);
  s.absarc(x, spring, r, 0, Math.PI, false);
  s.lineTo(x - r, bottom);
  s.closePath();
  return s;
}

// Pure authored texels: no DOM, external loaders, photograph pixels or runtime fetch.
function masonryTexture() {
  const size = 128, pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const row = Math.floor(y / 16), shifted = x + (row % 2) * 16;
      const mortar = y % 16 < 1 || shifted % 32 < 1;
      const c = mortar ? [166, 143, 111] : [167, 94, 63];
      const noise = ((Math.floor(shifted / 32) * 37 + row * 19) % 13) - 6;
      const i = (y * size + x) * 4;
      for (let k = 0; k < 3; k++) pixels[i + k] = c[k] + noise;
      pixels[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(pixels, size, size);
  tex.name = 'old-library authored running-bond brick, NOT photo pixels';
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

function roofTexture() {
  const size = 64, pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const seam = x % 8 < 1 || y % 16 < 1;
    // Regular low-contrast joints and a gentle tile roll, not dark one-pixel
    // stripes. Keep the existing tile pitch/UVs; filtering handles distance.
    const roll = Math.round(2 * Math.cos((x % 8 - 4) * Math.PI / 4));
    const c = seam ? [109, 97, 82] : [118 + roll, 104 + roll, 87 + roll];
    pixels.set([...c, 255], (y * size + x) * 4);
  }
  const tex = new THREE.DataTexture(pixels, size, size);
  tex.name = 'old-library authored roof tile rows, NOT photo pixels';
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  // DataTexture defaults to nearest filtering without mipmaps, which aliases
  // badly on the oblique roof planes at campus/quickview distances.
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

function visibleBounds(detail) {
  // Must be evaluated while unattached: hidden base and transformed campus never
  // participate in the local height used by caller selection/UI metadata.
  if (detail.parent) throw new Error('Old-library height requires unattached geometry.');
  detail.updateMatrixWorld(true);
  const box = new THREE.Box3();
  detail.traverseVisible(object => {
    if (!object.isMesh) return;
    object.geometry.computeBoundingBox();
    box.union(object.geometry.boundingBox.clone().applyMatrix4(object.matrixWorld));
  });
  if (box.isEmpty() || ![...box.min.toArray(), ...box.max.toArray()].every(Number.isFinite)) {
    throw new Error('Old-library produced invalid visible bounds.');
  }
  return box;
}

function historicFocusBounds(detail) {
  if (detail.parent) throw new Error('Old-library focus bounds require unattached geometry.');
  detail.updateMatrixWorld(true);
  const architecture = detail.children[0], box = new THREE.Box3(), point = new THREE.Vector3();
  // Unattached detail axes equal the original building-local X east/Y up/Z
  // south axes. Apply the facade yaw AND its offset from the merged root origin.
  // Never include the full foundation or unrefined-remainder mesh batches.
  for (const group of architecture.children) {
    if (!['facade', 'roofs', 'entrance'].includes(group.userData.role)) continue;
    group.traverseVisible(object => {
      if (!object.isMesh) return;
      const positions = object.geometry.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        box.expandByPoint(point.fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld));
      }
    });
  }
  // Include only the supported strip's foundation region, without altering or
  // splitting the existing full-footprint foundation geometry.
  for (const polygon of detail.userData.photoRefinedPlanFacadeMeters) for (const ring of polygon) {
    for (const [u, v] of ring) box.expandByPoint(point.set(u, 0.12, v).applyMatrix4(architecture.matrixWorld));
  }
  const min = box.min.toArray(), max = box.max.toArray();
  if (box.isEmpty() || ![...min, ...max].every(Number.isFinite) ||
      min.some((value, axis) => value >= max[axis])) {
    throw new Error('Old-library produced invalid historic focus bounds.');
  }
  return {min, max};
}

export function createOldLibraryDetail(feature, center, localOrigin) {
  verifySource(feature);
  verifyCoordinates(center, localOrigin);
  const metrics = footprintMetrics(feature.geometry, center);
  if (localOrigin.some((value, axis) => Math.abs(value - metrics.origin[axis]) > 1e-6)) {
    throw new Error('Old-library local origin does not match the frozen footprint.');
  }
  const ring = metrics.projected[0][0];
  const [a, b] = match.frontEdgeIndices.map(i => ring[i]);
  const run = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const tangent = [(b[0] - a[0]) / run, (b[1] - a[1]) / run];
  const normal = [-tangent[1], tangent[0]];
  const frontCenter = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const toFacade = point => {
    const d = point.map((value, i) => value - frontCenter[i]);
    return [d[0] * tangent[0] + d[1] * tangent[1], d[0] * normal[0] + d[1] * normal[1]];
  };
  const footprint = [metrics.projected[0].map(r => r.map(toFacade))];
  const half = run / 2, northEnd = toFacade(ring[30])[0], southEnd = toFacade(ring[35])[0];
  // Conservative front strip only. Do not assign the unknown rear courtyard
  // block or the entire connected library complex to a 1919 photo.
  const rear = -19.7;
  const photoPlan = polygonClipping.intersection(footprint, [rectangle(northEnd, rear, southEnd, 0.01)]);
  const remainder = polygonClipping.difference(footprint, photoPlan);
  const centerPlan = polygonClipping.intersection(photoPlan, [rectangle(-half, rear, half, 0.01)]);
  const wingPlans = [
    polygonClipping.intersection(photoPlan, [rectangle(northEnd, rear, -half, 0.01)]),
    polygonClipping.intersection(photoPlan, [rectangle(half, rear, southEnd, 0.01)]),
  ];
  if (!centerPlan.length || wingPlans.some(p => !p.length)) throw new Error('Old-library matched front strip is empty.');

  const detail = new THREE.Group();
  detail.name = '老图书馆 · 东翼西向入口照片参照';
  const architecture = new THREE.Group();
  architecture.name = 'Old-library source-clipped architecture';
  architecture.position.set(frontCenter[0] - localOrigin[0], 0, frontCenter[1] - localOrigin[1]);
  architecture.rotation.y = -Math.atan2(tangent[1], tangent[0]);
  detail.add(architecture);
  const B = createBuilder(THREE, 19191931);
  const material = (name, color, roughness = 0.85) => new THREE.MeshStandardMaterial({
    name: `old-library ${name}`, color, roughness, side: THREE.DoubleSide,
  });
  const brick = material('warm red brick', '#ffffff');
  brick.map = masonryTexture();
  B.textureWorld.set(brick, [1.05, 0.58]);
  const archBrick = material('radial brick voussoirs', '#ab714e');
  const stone = material('sandstone sills steps and sign panel', '#d1c09c');
  const timber = material('dark timber brackets and soffit', '#554234');
  const frames = material('slender pale metal mullions', '#b5b7a3', 0.55);
  const glass = material('recessed muted glazing', '#536467', 0.37);
  const shadow = material('deep entrance interior', '#202623');
  const roof = material('authored brown grey roof tiles', '#ffffff');
  roof.map = roofTexture();
  B.textureWorld.set(roof, [0.8, 1.0]);
  const neutral = material('UNREFINED merged-complex source mass', '#d7d1c4');
  const groups = {};
  for (const name of ['foundation', 'unrefined-remainder', 'facade', 'roofs', 'entrance']) {
    groups[name] = new THREE.Group();
    groups[name].name = name;
    groups[name].userData.role = name;
    architecture.add(groups[name]);
  }
  const add = (group, geometry, mat) => {
    B.worldUV(geometry, mat);
    B.add(group, geometry, mat);
  };
  const box = (group, x, y, z, w, h, d, mat, yaw = 0) =>
    B.box(group, '', x, y, z, w, h, d, mat, yaw);
  const slab = (group, polygon, bottom, top, mat) => {
    const g = new THREE.ExtrudeGeometry(planShape(polygon), {
      depth: top - bottom, steps: 1, bevelEnabled: false, curveSegments: 1,
    });
    g.rotateX(-Math.PI / 2);
    g.translate(0, bottom, 0);
    add(group, g, mat);
  };
  for (const polygon of footprint) slab(groups.foundation, polygon, 0.12, 0.3, stone);
  for (const polygon of remainder) slab(groups['unrefined-remainder'], polygon, 0.3, 5, neutral);

  function wallShape(group, s, front, depth, mat, matrix = null, curveSegments = 12) {
    const g = new THREE.ExtrudeGeometry(s, {depth, bevelEnabled: false, curveSegments, steps: 1});
    // Shape is in horizontal facade U / vertical Y; extrusion goes INWARD.
    g.scale(1, 1, -1);
    g.translate(0, 0, front);
    if (matrix) g.applyMatrix4(matrix);
    add(group, g, mat);
  }

  function aperture(group, x, bottom, width, height, front, arched = false, door = false, matrix = null) {
    const radius = width / 2, spring = bottom + height - radius;
    const s = arched ? archShape(x, bottom, width, spring) : rectShape(x, bottom, width, height);
    wallShape(group, s, front - (door ? 1.0 : 0.31), 0.035, door ? shadow : glass, matrix);
    const trim = arched ? archShape(x, bottom - 0.09, width + 0.2, spring)
      : rectShape(x, bottom - 0.09, width + 0.2, height + 0.18);
    trim.holes.push(new THREE.Path(s.getPoints(24)));
    wallShape(group, trim, front + 0.07, 0.17, frames, matrix);
    const localBox = (u, y, z, w, h, d, mat) => {
      const g = new THREE.BoxGeometry(w, h, d);
      g.translate(u, y, z);
      if (matrix) g.applyMatrix4(matrix);
      add(group, g, mat);
    };
    for (let i = 1; i < 5; i++) {
      const u = x - radius + width * i / 5;
      const top = arched ? spring + Math.sqrt(Math.max(0, radius ** 2 - (u - x) ** 2)) : bottom + height;
      localBox(u, (bottom + top) / 2, front - 0.25, 0.045, top - bottom, 0.07, frames);
    }
    const rows = arched ? [bottom + 0.68, spring - 0.5, spring, spring + radius * 0.55]
      : [bottom + height / 3, bottom + height * 2 / 3];
    for (const y of rows) {
      const w = arched && y > spring ? 2 * Math.sqrt(radius ** 2 - (y - spring) ** 2) : width;
      localBox(x, y, front - 0.25, w, 0.045, 0.07, frames);
    }
    localBox(x, bottom - 0.12, front + 0.04, width + 0.3, 0.17, 0.55, stone);
    return s;
  }

  const facade = groups.facade;
  const cornerWidth = 3.15, middleWidth = run - 2 * cornerWidth;
  const archWidth = 2.25, archBottom = 6.35, archSpring = 8.55, bayPitch = 3.2;
  const centralWall = rectShape(0, 0.3, middleWidth, 13.7);
  const photoWindows = [];
  for (const x of [-bayPitch, 0, bayPitch]) {
    const arched = aperture(facade, x, archBottom, archWidth, archSpring + archWidth / 2 - archBottom, -0.55, true);
    centralWall.holes.push(new THREE.Path(arched.getPoints(24)));
    const lower = aperture(facade, x, 1.65, x === 0 ? 1.95 : 2.25, 3.45, -0.55, false, x === 0);
    centralWall.holes.push(new THREE.Path(lower.getPoints()));
    const upper = aperture(facade, x, 11.1, 1.12, 1.78, -0.55);
    centralWall.holes.push(new THREE.Path(upper.getPoints()));
    photoWindows.push({x, bottom: archBottom, spring: archSpring, radius: archWidth / 2, front: -0.55, glass: -0.86});
    // Concentric, genuinely open brick rings; radial joints are geometry.
    for (const [inner, outer, depth] of [[1.17, 1.37, 0.14], [1.43, 1.57, 0.11]]) {
      for (let i = 0; i < 20; i++) {
        const start = Math.PI * i / 20 + 0.008, end = Math.PI * (i + 1) / 20 - 0.008;
        const voussoir = new THREE.Shape();
        voussoir.absarc(x, archSpring, outer, start, end, false);
        voussoir.absarc(x, archSpring, inner, end, start, true);
        voussoir.closePath();
        // A single brick covers only 9 degrees: four arc subdivisions suffice,
        // unlike the whole semicircular window's higher-resolution curve.
        wallShape(facade, voussoir, -0.44, depth, archBrick, null, 2);
      }
      for (const side of [-1, 1]) {
        box(facade, x + side * (inner + outer) / 2, (archBottom + archSpring) / 2,
          -0.46, outer - inner, archSpring - archBottom, depth, archBrick);
      }
    }
    box(facade, x, 5.68, -0.34, 2.58, 0.8, 0.24, stone);
  }
  wallShape(facade, centralWall, -0.55, 0.45, brick);
  // Paired square projecting corners; only the center face recedes. No solid
  // box behind these holes, hence the windows remain genuine apertures.
  for (const side of [-1, 1]) {
    const x = side * (half - cornerWidth / 2);
    const s = rectShape(x, 0.3, cornerWidth, 12.6);
    for (const bottom of [1.2, 5.05, 9.0]) {
      const opening = aperture(facade, x, bottom, 1.14, 2.13, 0);
      s.holes.push(new THREE.Path(opening.getPoints()));
    }
    wallShape(facade, s, 0, 0.45, brick);
    // Narrow corner returns flank the recessed central frontage.
    for (const u of [x - cornerWidth / 2, x + cornerWidth / 2]) {
      box(facade, u, 6.6, -1.7, 0.4, 12.6, 3.4, brick);
    }
    box(facade, x, 12.98, -1.45, cornerWidth + 0.2, 0.22, 3.65, stone);
    const diamond = new THREE.BoxGeometry(0.22, 0.22, 0.04);
    diamond.rotateZ(Math.PI / 4);
    diamond.translate(x, 12.55, 0.035);
    add(facade, diamond, glass);
  }

  let wingArches = 0, inferredWindows = 0;
  function edgeShell(plan, height, central = false) {
    for (const polygon of plan) for (const r of polygon) {
      const signed = r.slice(0, -1).reduce((sum, a, i) => sum + a[0] * r[i + 1][1] - r[i + 1][0] * a[1], 0);
      for (let i = 0; i < r.length - 1; i++) {
        const a = r[i], b = r[i + 1], length = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (length < 0.02 || (central && Math.abs(a[1]) < 0.03 && Math.abs(b[1]) < 0.03)) continue;
        const t = [(b[0] - a[0]) / length, (b[1] - a[1]) / length];
        const n = [t[1] * Math.sign(signed), -t[0] * Math.sign(signed)];
        const matrix = new THREE.Matrix4().makeBasis(
          new THREE.Vector3(t[0], 0, t[1]), new THREE.Vector3(0, 1, 0), new THREE.Vector3(n[0], 0, n[1]));
        matrix.setPosition((a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2);
        const wall = rectShape(0, 0.3, length, height - 0.3);
        const isFront = !central && n[1] > 0.98 && Math.abs(a[1] + 4.15) < 0.35;
        // Source-clipping cuts are internal partitions, not photo facades.
        const isCut = Math.abs(a[1] - rear) < 0.03 && Math.abs(b[1] - rear) < 0.03;
        if (length > 3.3 && !isCut) {
          const bays = Math.max(1, Math.floor(length / 3.85));
          for (let j = 0; j < bays; j++) {
            const x = -length / 2 + (j + 0.5) * length / bays;
            for (const [bottom, w, h, arch] of [[1.0, 1.42, 2.3, false],
              [4.65, 2.08, 3.15, isFront]]) {
              const opening = aperture(facade, x, bottom, w, h, 0, arch, false, matrix);
              wall.holes.push(new THREE.Path(opening.getPoints(24)));
              if (arch) wingArches++; else inferredWindows++;
            }
          }
        }
        wallShape(facade, wall, 0, 0.32, brick, matrix);
      }
    }
  }
  edgeShell(centerPlan, 14, true);
  wingPlans.forEach(plan => edgeShell(plan, 9.2));

  function hippedRoof(plan, eave, ridge) {
    const points = plan.flatMap(p => p[0]);
    const lo = Math.min(...points.map(p => p[0])), hi = Math.max(...points.map(p => p[0]));
    const back = Math.min(...points.map(p => p[1])), front = Math.max(...points.map(p => p[1]));
    const inset = Math.min(hi - lo, front - back) / 2;
    const h = ([u, v]) => eave + (ridge - eave) * Math.max(0, Math.min(1,
      (u - lo) / inset, (hi - u) / inset, (v - back) / inset, (front - v) / inset));
    // Four planar slope cells, clipped to the real outline. Triangulating the
    // whole ring once would miss the ridge and could fill source courtyards.
    const corners = [[lo, back], [hi, back], [hi, front], [lo, front]];
    const inner = [[lo + inset, back + inset], [hi - inset, back + inset],
      [hi - inset, front - inset], [lo + inset, front - inset]];
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      const cell = [[corners[i], corners[j], inner[j], inner[i], corners[i]]];
      for (const polygon of polygonClipping.intersection(plan, [cell])) {
        const contours = polygon.map(r => r.map(p => new THREE.Vector2(...p)));
        const triangles = THREE.ShapeUtils.triangulateShape(contours[0], contours.slice(1));
        const all = contours.flat(), positions = [];
        for (const tri of triangles) for (const k of tri) positions.push(all[k].x, h([all[k].x, all[k].y]), all[k].y);
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        g.computeVertexNormals();
        add(groups.roofs, g, roof);
      }
    }
    // Ridge/hip caps are slender cylinders, not a pyramid floating on a box.
    const cap = (a, b) => {
      if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.01) return;
      for (const [from, to] of clippedSegments(a, b, plan)) {
        B.cylinder(groups.roofs, [from[0], h(from) + 0.05, from[1]], [to[0], h(to) + 0.05, to[1]],
          0.06, 0.06, timber, 8);
      }
    };
    for (let i = 0; i < 4; i++) cap(corners[i], inner[i]);
    cap(inner[0], inner[2]);
  }
  hippedRoof(centerPlan, 14.15, 16.25);
  wingPlans.forEach(plan => hippedRoof(plan, 9.35, 11.5));
  // Thin deep eaves with repeated exposed brackets, as in the frontal photo.
  box(facade, 0, 13.95, -0.05, run + 1.1, 0.18, 1.65, timber);
  box(facade, 0, 14.11, 0.7, run + 1.2, 0.12, 0.22, stone);
  for (let i = 0; i < 19; i++) {
    const u = -half + 0.25 + i * (run - 0.5) / 18;
    box(facade, u, 13.65, 0.08, 0.13, 0.32, 1.12, timber);
    B.cylinder(facade, [u, 13.33, -0.43], [u, 13.82, 0.56], 0.065, 0.065, timber, 6);
  }

  const entrance = groups.entrance;
  const stairWidth = 8.8, steps = 9, riser = 0.18, tread = 0.36;
  box(entrance, 0, 0.87, 0.42, stairWidth, 1.5, 1.25, stone);
  for (let i = 0; i < steps; i++) {
    const top = 1.62 - i * riser;
    box(entrance, 0, (top + 0.02) / 2, 1.22 + i * tread, stairWidth, top - 0.02, tread + 0.015, stone);
  }
  for (const side of [-1, 1]) {
    const wall = new THREE.Shape();
    wall.moveTo(0.82, 0.05); wall.lineTo(4.38, 0.05);
    wall.lineTo(4.38, 0.65); wall.lineTo(0.82, 2.12); wall.closePath();
    // Shape's X is forward distance here; rotate into the staircase side.
    const g = new THREE.ExtrudeGeometry(wall, {depth: 0.3, bevelEnabled: false});
    g.rotateY(-Math.PI / 2);
    g.translate(side * (stairWidth / 2 + 0.18), 0, 0);
    add(entrance, g, stone);
    B.cylinder(entrance, [side * 4.6, 2.16, 0.82], [side * 4.6, 0.7, 4.38], 0.1, 0.1, stone, 8);
  }
  // The paired lamps are geometry estimates; do not rasterize photo signage.
  for (const side of [-1, 1]) {
    B.cylinder(entrance, [side * 3.55, 1.62, 0.52], [side * 3.55, 3.18, 0.52], 0.06, 0.06, timber, 8);
    for (const [dx, y] of [[0, 3.34], [-0.18, 3.12], [0.18, 3.12]]) {
      const g = new THREE.SphereGeometry(0.15, 10, 8);
      g.translate(side * 3.55 + dx, y, 0.52);
      add(entrance, g, stone);
    }
  }
  B.finish();
  const bounds = visibleBounds(detail);
  let meshes = 0;
  detail.traverse(o => { if (o.isMesh) meshes++; });
  detail.userData = {
    referenceSite: 'old-library', referencePages: [...PAGES],
    sourceMatch: {expectedOSMId: match.expectedOSMId, outerWay: match.outerWay,
      innerWay: match.innerWay, labelSourceFeatureId: match.label.sourceFeatureId,
      matchMethod: 'verified OSM relation outline overlap + frozen contained Old Library label, NOT nearest route POI',
      overlap: {...match.overlap}, mergedMapAddress: match.featureId},
    facadeNormal: normal, frontNormalXZ: normal, facadeTangent: tangent,
    facadeOriginLocalMeters: [frontCenter[0] - localOrigin[0], frontCenter[1] - localOrigin[1]],
    sourceFootprintArea: metrics.area, sourceCourtyardCount: metrics.projected[0].length - 1,
    photoRefinedPlanFacadeMeters: photoPlan, unrefinedPlanFacadeMeters: remainder,
    estimatedDimensionsMeters: {entranceFacadeWidth: run, supportedFrontSpan: southEnd - northEnd,
      supportedDepth: -rear, mainEave: 14.15, mainRidge: 16.25, lowerEave: 9.35, lowerRidge: 11.5,
      archWidth, archBottom, archSpring, entranceDoorWidth: 1.95,
      stairWidth, stairSteps: steps, riser, tread, visibleHeight: bounds.max.y},
    proportions: {mainArchWidthToFacade: archWidth / run, cornerWidthToFacade: cornerWidth / run,
      centralRecessMeters: 0.55, windowRecessMeters: 0.31},
    mainArchedWindows: photoWindows, upperRectangularWindows: 3, projectingCorners: 2,
    wingArches, inferredWindows, eaveBrackets: 19, meshCount: meshes,
    heightSource: HEIGHT_SOURCE, limitations: LIMITS,
    noReferencePhotoTextures: true, reconstructionLevel: 'photo-informed-estimate-not-surveyed',
  };
  return detail;
}

function disposeDetail(detail) {
  if (!detail) return;
  const geometries = new Set(), materials = new Set(), textures = new Set();
  detail.traverse(o => {
    if (o.geometry) geometries.add(o.geometry);
    for (const mat of (Array.isArray(o.material) ? o.material : o.material ? [o.material] : [])) {
      materials.add(mat);
      for (const value of Object.values(mat)) if (value?.isTexture) textures.add(value);
    }
  });
  geometries.forEach(g => g.dispose());
  textures.forEach(t => t.dispose());
  materials.forEach(m => m.dispose());
}

export function refineOldLibrary(campus, data, featureId) {
  if (!OLD_LIBRARY_IDS.includes(featureId)) throw new Error('Unknown old-library verified root ID.');
  const matches = data?.features?.filter(f => f.id === featureId) || [];
  if (matches.length !== 1) throw new Error('Old-library source must occur exactly once.');
  const feature = matches[0], target = campus?.buildings?.get(featureId);
  verifySource(feature);
  const center = data?.metadata?.center, origin = target?.userData?.localOriginMeters;
  verifyCoordinates(center, origin);
  const metrics = footprintMetrics(feature.geometry, center), p = target?.userData;
  const base = target?.children.find(child => child.name === 'base');
  if (!target?.isGroup || p.featureId !== featureId || !base ||
      p.name !== match.expectedName || p.sourceFeatureId !== null || p.nameSource !== 'unknown' ||
      p.nameConfidence !== 0 || p.nameSourceFeatureId != null ||
      p.sourceLayer !== 'building' || p.sourceIdScope !== feature.properties.sourceIdScope ||
      p.idStrategy !== feature.properties.idStrategy ||
      JSON.stringify(p.sourceTiles) !== JSON.stringify(feature.properties.sourceTiles) ||
      JSON.stringify(p.upstreamBatchFeatureIds) !== JSON.stringify(feature.properties.upstreamBatchFeatureIds) ||
      !p.poiLabels?.some(l => l.sourceFeatureId === match.label.sourceFeatureId && l.name === match.label.name) ||
      (p.baseRenderHeight ?? p.renderHeight) !== 5 ||
      origin.some((v, i) => Math.abs(v - metrics.origin[i]) > 1e-6) ||
      Math.abs(target.position.x - origin[0]) > 1e-6 || Math.abs(target.position.z - origin[1]) > 1e-6 ||
      target.position.y !== 0 || target.rotation.x !== 0 || target.rotation.y !== 0 || target.rotation.z !== 0 ||
      !target.scale.equals(new THREE.Vector3(1, 1, 1))) {
    throw new Error('Old-library existing-root placement/source identity changed.');
  }
  const previous = target.children.filter(c => c.userData.campusDetail);
  if (previous.length > 1 || previous.some(c => c.userData.referenceSite !== 'old-library')) {
    throw new Error('Old-library root has an unexpected existing refinement.');
  }
  // Validate/build everything before changing the addressable scene root.
  const detail = createOldLibraryDetail(feature, center, origin);
  const focusBoundsLocal = historicFocusBounds(detail);
  const sourceHeight = p.baseRenderHeight ?? p.renderHeight;
  const sourceHeightSource = p.baseHeightSource ?? p.heightSource;
  replaceBuilding(campus.buildings, featureId, detail);
  // Empty source marker remains for repeat validation, but even exporters with
  // onlyVisible:false cannot accidentally include the original hidden solid.
  base.traverse(o => { o.geometry?.dispose(); });
  base.clear();
  base.visible = false;
  base.userData = {sourceOnly: true, geometryPreservedIn: 'root.userData.sourceFootprintGeometry'};
  disposeDetail(previous[0]);
  target.name = '图书馆组团 · 老馆东翼入口细化';
  Object.assign(p, {
    referenceSite: 'old-library', referencePages: [...PAGES],
    // Keep original unnamed source name, source IDs/labels and nameSource intact.
    displayName: target.name, aliases: ['老图书馆', '老馆', 'Old Library'],
    baseRenderHeight: sourceHeight, baseHeightSource: sourceHeightSource,
    sourceFootprintGeometry: structuredClone(feature.geometry),
    renderHeight: detail.userData.estimatedDimensionsMeters.visibleHeight,
    focusBoundsLocal,
    heightSource: HEIGHT_SOURCE, facadeNormal: [...detail.userData.facadeNormal],
    estimatedDimensionsMeters: {...detail.userData.estimatedDimensionsMeters},
    proportions: {...detail.userData.proportions},
    sourceMatch: structuredClone(detail.userData.sourceMatch),
    refinementSummary: '保留未命名图书馆组团完整原轮廓、三个庭院孔洞与地图根身份，仅重建老馆东翼西向暖红砖入口、三扇真半圆高拱窗／细分窗棂、双侧方形突出角楼、顶部矩形窗、深挑托木薄檐、推定瓦四坡顶及宽台阶侧墙；其余相连馆舍保留中性基础体量，隐藏面及标高为估计。',
    limits: LIMITS, reconstructionLevel: 'photo-informed-estimate-not-surveyed',
  });
  target.updateWorldMatrix(true, true);
  return target;
}
