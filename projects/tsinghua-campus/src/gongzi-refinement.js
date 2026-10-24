import * as THREE from 'three';
import polygonClipping from 'polygon-clipping';
import {createBuilder} from '../../shunde/src/builder.js';
import {footprintMetrics} from './geo.js';
import {replaceBuilding} from './model.js';
import source from '../data/gongzi-source.json' with {type: 'json'};

// One historic I-shaped hall, one separate south gate. 水木清华 is not a third root.
export const GONGZI_IDS = Object.freeze([source.main.id, source.gate.id]);
const SITE = 'gongzi-shuimu';
const EPSILON = 1e-6;
const rect = (x0, z0, x1, z1) => [[[x0, z0], [x1, z0], [x1, z1], [x0, z1], [x0, z0]]];
const boundsOf = rings => {
  const points = rings.flat();
  return [Math.min(...points.map(p => p[0])), Math.min(...points.map(p => p[1])),
    Math.max(...points.map(p => p[0])), Math.max(...points.map(p => p[1]))];
};

function verifySource(feature) {
  const index = GONGZI_IDS.indexOf(feature?.id), p = feature?.properties;
  const spec = index === 0 ? source.main : index === 1 ? source.gate : null;
  const rings = feature?.geometry?.coordinates;
  if (!spec || p?.kind !== 'building' || p.sourceLayer !== 'building' ||
      p.extrude !== true || p.minHeight !== 0 || p.renderHeight !== (index === 0 ? 4 : 5) ||
      p.minHeightSource !== 'openfreemap-render-min-height' ||
      p.heightSource !== 'openfreemap-render-height' ||
      p.upstreamProperties?.render_height !== p.renderHeight ||
      p.upstreamProperties?.render_min_height !== 0 ||
      feature.geometry?.type !== 'Polygon' || !Array.isArray(rings) || rings.length !== 1 ||
      !Array.isArray(rings[0]) || rings[0].length !== spec.ring.length ||
      rings[0].some((point, i) => !Array.isArray(point) || point.length !== 2 ||
        point.some((v, axis) => !Number.isFinite(v) || Math.abs(v - spec.ring[i][axis]) > 1e-10)) ||
      (index === 0
        ? p.name !== '工字厅' || p.nameSourceFeatureId !== source.main.nameSourceFeatureId ||
          p.sourceFeatureId !== '6598261612' || p.idStrategy !== 'source-layer-and-vector-feature-id' ||
          p.nameSource !== 'osm-local-extract-building-overlap' || p.nameRole !== 'building-name'
        : p.name !== '' || p.sourceFeatureId !== null || p.nameSourceFeatureId != null ||
          p.idStrategy !== 'canonical-geometry-sha256-96' || p.nameSource !== 'unknown')) {
    throw new Error('Gongzi source identity/geometry/height mismatch; re-review the frozen outline, not the photo label.');
  }
  return {spec, main: index === 0};
}

function coordinates(center, origin) {
  if (!Array.isArray(center) || center.length !== 2 || !center.every(Number.isFinite) ||
      Math.abs(center[0]) > 180 || Math.abs(center[1]) >= 90) {
    throw new Error('Gongzi requires a finite WGS84 projection center.');
  }
  if (!Array.isArray(origin) || origin.length !== 2 || !origin.every(Number.isFinite)) {
    throw new Error('Gongzi requires a finite local origin in meters.');
  }
}

function frame(feature, center, origin, main) {
  coordinates(center, origin);
  const metrics = footprintMetrics(feature.geometry, center);
  if (origin.some((v, i) => Math.abs(v - metrics.origin[i]) > EPSILON)) {
    throw new Error('Gongzi local origin does not match the frozen footprint.');
  }
  const ring = metrics.projected[0][0];
  // Main: exact long north edge 0 -> 11. Gate: exact long south edge 1 -> 2.
  const a = ring[main ? 0 : 1], b = ring[main ? 11 : 2];
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const east = [(b[0] - a[0]) / length, (b[1] - a[1]) / length];
  const south = [-east[1], east[0]];
  const toLocal = ([x, z]) => {
    x -= origin[0]; z -= origin[1];
    return [x * east[0] + z * east[1], x * south[0] + z * south[1]];
  };
  const footprint = metrics.projected[0].map(r => r.map(toLocal));
  return {metrics, east, south, footprint, bounds: boundsOf(footprint)};
}

// Pure byte textures: no canvas, image loader, browser runtime, photograph or glyph atlas.
function texture(kind, bump = false) {
  const size = 128, pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const noise = ((x * 23 + y * 37) % 9) - 4;
    let c;
    if (kind === 'tile') {
      // Four narrow cap/pan rows per repeat, with fine overlapping courses.
      const u = (x % 32) / 32, v = y % 32;
      const cap = Math.pow(Math.max(0, Math.cos((u - 0.18) * Math.PI * 2)), 5);
      const seam = v < 2 ? -28 : v < 4 ? 12 : 0;
      c = (bump ? 105 + cap * 90 : 116 + cap * 32) + seam + noise;
    } else {
      const joint = y % 16 < 1 || (x + Math.floor(y / 16) % 2 * 16) % 32 < 1;
      c = (joint ? 139 : 112) + noise;
    }
    const i = (y * size + x) * 4;
    pixels[i] = c; pixels[i + 1] = c; pixels[i + 2] = c - (bump ? 0 : 3);
    pixels[i + 3] = 255;
  }
  const result = new THREE.DataTexture(pixels, size, size);
  result.name = `gongzi procedural ${kind}${bump ? ' microheight' : ''}; no reference photo`;
  result.userData.procedural = true;
  result.wrapS = result.wrapT = THREE.RepeatWrapping;
  result.magFilter = THREE.LinearFilter;
  result.minFilter = THREE.LinearMipmapLinearFilter;
  result.generateMipmaps = true;
  if (!bump) result.colorSpace = THREE.SRGBColorSpace;
  result.needsUpdate = true;
  return result;
}

function materials(B) {
  const make = (name, color, settings = {}) =>
    new THREE.MeshStandardMaterial({name: `gongzi ${name}`, color, roughness: 0.9, ...settings});
  const tile = make('grey curved pan and lap tiles', '#ffffff', {
    map: texture('tile'), bumpMap: texture('tile', true), bumpScale: 0.026, side: THREE.DoubleSide,
  });
  const brick = make('grey brick returns', '#ffffff', {map: texture('brick')});
  B.textureWorld.set(brick, [1.12, 0.72]);
  B.textureWorld.set(tile, [1.04, 1.12]);
  return {
    tile, brick,
    stone: make('grey stone plinth and steps', '#a4a39b'),
    white: make('white stone open balustrade', '#e2e0d5'),
    plaster: make('pale plaster wall and side screens', '#d2cfc4'),
    red: make('redwood columns and lattice', '#782b26'),
    dark: make('recessed wood and unlit lattice backing', '#322c2a'),
    blue: make('simplified blue painted frieze', '#356068'),
    ochre: make('simplified ochre painted beam pattern', '#b5975b'),
  };
}

function slab(B, group, polygon, y, thickness, mat) {
  const points = r => r.map(([x, z]) => new THREE.Vector2(x, -z));
  const shape = new THREE.Shape(points(polygon[0]));
  for (const ring of polygon.slice(1)) shape.holes.push(new THREE.Path(points(ring)));
  const geo = new THREE.ExtrudeGeometry(shape, {depth: thickness, steps: 1, bevelEnabled: false});
  geo.rotateX(-Math.PI / 2); geo.translate(0, y, 0);
  B.worldUV(geo, mat); B.add(group, geo, mat);
}

function surface(polygons, height, uv, smooth = false) {
  const positions = [], uvs = [], normals = [];
  for (const polygon of polygons) {
    const contours = polygon.map(r => r.map(p => new THREE.Vector2(...p)));
    const triangles = THREE.ShapeUtils.triangulateShape(contours[0], contours.slice(1));
    const points = contours.flat().map(p => [p.x, p.y]);
    for (const face of triangles) {
      const tri = face.map(i => points[i]);
      const cross = (tri[1][0] - tri[0][0]) * (tri[2][1] - tri[0][1]) -
        (tri[1][1] - tri[0][1]) * (tri[2][0] - tri[0][0]);
      if (Math.abs(cross) < 1e-10) continue;
      if (cross > 0) tri.reverse();
      for (const p of tri) {
        positions.push(p[0], height(p), p[1]);
        uvs.push(...uv(p));
        if (smooth) {
          const d = 0.0001;
          const normal = new THREE.Vector3(
            -(height([p[0] + d, p[1]]) - height([p[0] - d, p[1]])) / (2 * d), 1,
            -(height([p[0], p[1] + d]) - height([p[0], p[1] - d])) / (2 * d)).normalize();
          normals.push(...normal.toArray());
        }
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  if (smooth) geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  else geo.computeVertexNormals();
  return geo;
}

// Concave-up traditional pitch, with a shallow turned eave lip, not a triangle.
// Height is continuous across the four hip sectors; normals crease only at hips.
const pitch = t => (Math.pow(Math.max(0, Math.min(1, t)), 1.45) +
  0.09 * Math.pow(1 - Math.max(0, Math.min(1, t)), 8) - 0.09) / 0.91;

function hipRoof(B, group, polygon, eave, ridge, mat, name) {
  const [x0, z0, x1, z1] = boundsOf(polygon);
  const half = Math.min(x1 - x0, z1 - z0) / 2, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const longX = x1 - x0 >= z1 - z0;
  const a = longX ? [x0 + half, cz] : [cx, z0 + half];
  const b = longX ? [x1 - half, cz] : [cx, z1 - half];
  const nw = [x0, z0], ne = [x1, z0], se = [x1, z1], sw = [x0, z1];
  const sectors = [
    {ring: longX ? [nw, ne, b, a, nw] : [nw, ne, a, nw], axis: 1, edge: z0, sign: 1},
    {ring: longX ? [ne, se, b, ne] : [ne, se, b, a, ne], axis: 0, edge: x1, sign: -1},
    {ring: longX ? [se, sw, a, b, se] : [se, sw, b, se], axis: 1, edge: z1, sign: -1},
    {ring: longX ? [sw, nw, a, sw] : [sw, nw, a, b, sw], axis: 0, edge: x0, sign: 1},
  ];
  // Split each hip sector into 32 thin contour bands BEFORE triangulation.
  // Boolean intersection retains every source concavity, including the I cutouts.
  for (const sector of sectors) {
    const tAt = p => (p[sector.axis] - sector.edge) * sector.sign / half;
    const yAt = p => eave + (ridge - eave) * pitch(tAt(p));
    for (let i = 0; i < 32; i++) {
      const lo = sector.edge + sector.sign * half * i / 32;
      const hi = sector.edge + sector.sign * half * (i + 1) / 32;
      const strip = sector.axis === 1
        ? rect(x0 - 1, Math.min(lo, hi), x1 + 1, Math.max(lo, hi))
        : rect(Math.min(lo, hi), z0 - 1, Math.max(lo, hi), z1 + 1);
      const clipped = polygonClipping.intersection([polygon], [[sector.ring]], [strip]);
      if (!clipped.length) continue;
      B.add(group, surface(clipped, yAt, p => sector.axis === 1
        ? [p[0] / 1.04, p[1] / 1.12] : [p[1] / 1.04, p[0] / 1.12], true), mat);
    }
  }
  // Thin vertical edge closure at the footprint itself, no oversized eave box.
  const h = ([x, z]) => eave + (ridge - eave) * pitch(Math.min(x - x0, x1 - x, z - z0, z1 - z) / half);
  for (const r of polygon) for (let i = 0; i < r.length - 1; i++) {
    const p = r[i], q = r[i + 1], positions = [], uvs = [];
    const count = Math.max(1, Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) / 0.22));
    for (let n = 0; n < count; n++) {
      const at = t => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
      const u = at(n / count), v = at((n + 1) / count);
      for (const [point, drop] of [[u, 0], [v, 0.09], [v, 0], [u, 0], [u, 0.09], [v, 0.09]]) {
        positions.push(point[0], h(point) - drop, point[1]);
        uvs.push(point[0] / 1.04, point[1] / 1.12);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.computeVertexNormals(); B.add(group, geo, mat);
  }
  // One modest rounded ridge per roof, batched with the tiles. Endpoints are
  // deep inside these reviewed domains; no fantastical animals or sculpted finials.
  if (Math.hypot(b[0] - a[0], b[1] - a[1]) > 0.05) {
    B.cylinder(group, [a[0], ridge + 0.04, a[1]], [b[0], ridge + 0.04, b[1]], 0.10, 0.10, mat, 10);
  }
  return {name, polygon, eave, ridge, curvedProfile: '32-band concave pitch with turned eave lip',
    footprintClipped: true, ridgeAxis: longX ? 'local east-west' : 'local north-south'};
}

function lineBox(B, group, a, b, bottom, height, depth, mat) {
  const run = Math.hypot(b[0] - a[0], b[1] - a[1]);
  B.box(group, '', (a[0] + b[0]) / 2, bottom + height / 2, (a[1] + b[1]) / 2,
    run, height, depth, mat, -Math.atan2(b[1] - a[1], b[0] - a[0]));
}

function beamPattern(B, group, M, width, y, z) {
  B.box(group, '', 0, y, z, width, 0.29, 0.20, M.red);
  B.box(group, '', 0, y, z + Math.sign(z) * 0.115, width - 0.12, 0.19, 0.035, M.blue);
  const count = Math.max(3, Math.floor(width / 0.56));
  for (let i = 0; i < count; i++) {
    const x = -width / 2 + (i + 0.5) * width / count;
    // Clearly simplified painted alternating lozenges, not copied mural motifs.
    const geo = new THREE.BoxGeometry(0.11, 0.11, 0.022);
    geo.rotateZ(Math.PI / 4); geo.translate(x, y, z + Math.sign(z) * 0.14);
    B.add(group, geo, M.ochre);
  }
  for (const dy of [-0.12, 0.12]) B.box(group, '', 0, y + dy, z, width, 0.026, 0.26, M.ochre);
}

function column(B, group, M, x, z, base, top) {
  B.cylinder(group, [x, base, z], [x, top, z], 0.17, 0.15, M.red, 14);
  B.cylinder(group, [x, base - 0.04, z], [x, base + 0.13, z], 0.24, 0.21, M.stone, 12);
  B.box(group, '', x, top - 0.04, z, 0.54, 0.15, 0.43, M.red);
}

function lattice(B, group, M, x, z, width, bottom, top, yaw = 0) {
  const place = (dx, y, w, h, d, material, dz = 0) => {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    B.box(group, '', x + c * dx + s * dz, y, z - s * dx + c * dz, w, h, d, material, yaw);
  };
  place(0, (top + bottom) / 2, width, top - bottom, 0.045, M.dark, -0.07);
  for (const dy of [bottom, top]) place(0, dy, width + 0.08, 0.10, 0.12, M.red);
  for (const dx of [-width / 2, width / 2]) place(dx, (top + bottom) / 2, 0.10, top - bottom, 0.12, M.red);
  // Actual narrow wood members, not a painted window texture.
  const divisions = Math.max(4, Math.round(width / 0.25));
  for (let i = 1; i < divisions; i++) {
    place(-width / 2 + i * width / divisions, (top + bottom) / 2, 0.035, top - bottom, 0.065, M.red, 0.03);
  }
  for (let i = 1; i < 5; i++) place(0, bottom + i * (top - bottom) / 5, width, 0.04, 0.065, M.red, 0.03);
}

function northTerrace(B, group, M, xmin, xmax, rear) {
  const top = 0.74, edge = rear - 2.05, stairWidth = 4.3, center = 0.5;
  const left = xmin + 0.45, right = xmax - 0.45;
  B.box(group, '', (left + right) / 2, 0.43, rear - 0.8, right - left, 0.62, 2.5, M.stone);
  B.box(group, '', (left + right) / 2, top - 0.045, rear - 0.8, right - left + 0.08, 0.09, 2.5, M.white);
  const railing = (a, b, count) => {
    for (let i = 0; i <= count; i++) {
      const t = i / count, x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
      B.box(group, '', x, top + 0.51, z, 0.18, 1.02, 0.18, M.white);
      B.box(group, '', x, top + 1.03, z, 0.27, 0.08, 0.27, M.white);
    }
    for (const [y, depth] of [[top + 0.18, 0.10], [top + 0.86, 0.12]]) lineBox(B, group, a, b, y, depth, 0.12, M.white);
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]), dx = (b[0] - a[0]) / length, dz = (b[1] - a[1]) / length;
    const yaw = -Math.atan2(dz, dx), bay = length / count;
    for (let i = 0; i < count; i++) {
      const x = a[0] + dx * bay * (i + 0.5), z = a[1] + dz * bay * (i + 0.5);
      // Pierced rectangular fret, with open air around it; no solid fence panel.
      for (const u of [-0.24, 0.24]) B.box(group, '', x + dx * u, top + 0.52, z + dz * u, 0.065, 0.42, 0.09, M.white, yaw);
      for (const y of [top + 0.31, top + 0.73]) B.box(group, '', x, y, z, 0.54, 0.06, 0.09, M.white, yaw);
    }
    return count + 1;
  };
  const opening = stairWidth / 2 + 0.22;
  let posts = railing([left, edge], [center - opening, edge], 6);
  posts += railing([center + opening, edge], [right, edge], 6);
  posts += railing([left, edge], [left, rear + 0.3], 1);
  posts += railing([right, edge], [right, rear + 0.3], 1);
  const steps = [];
  for (let i = 0; i < 6; i++) {
    const height = 0.14 + i * 0.10, z = edge - (6 - i - 0.5) * 0.42;
    B.box(group, '', center, height / 2 + 0.01, z, stairWidth, height, 0.42, M.white);
    steps.push({x: center, z, treadY: height + 0.01, width: stairWidth, run: 0.42});
  }
  // Sloping stone handrails and separate posts flank, never cross, the stairs.
  for (const side of [-1, 1]) {
    const x = center + side * (stairWidth / 2 + 0.14);
    for (const i of [0, 2, 4, 6]) {
      const y = 0.15 + i * 0.10, z = edge - (6 - i) * 0.42;
      B.box(group, '', x, y + 0.44, z, 0.17, 0.88, 0.17, M.white);
      B.box(group, '', x, y + 0.90, z, 0.24, 0.08, 0.24, M.white); posts++;
    }
    const a = new THREE.Vector3(x, 1.02, edge - 2.52), b = new THREE.Vector3(x, 1.62, edge);
    const geo = new THREE.BoxGeometry(0.15, a.distanceTo(b), 0.15);
    geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()));
    geo.translate(...a.add(b).multiplyScalar(0.5).toArray()); B.add(group, geo, M.white);
  }
  // Small return enclosures, not new wings or additional footprint roots.
  for (const x of [left - 0.16, right + 0.16]) {
    B.box(group, '', x, 1.38, rear + 0.35, 0.22, 1.8, 3.6, M.plaster);
    B.box(group, '', x, 0.65, rear + 0.35, 0.28, 0.35, 3.6, M.brick);
    B.box(group, '', x, 2.34, rear + 0.35, 0.32, 0.12, 3.65, M.brick);
    // Low-relief/pierced motifs represented only as plain dark lozenges.
    for (let i = 0; i < 3; i++) {
      const geo = new THREE.BoxGeometry(0.026, 0.30, 0.30);
      geo.rotateX(Math.PI / 4); geo.translate(x + Math.sign(x) * 0.125, 1.53, rear - 0.7 + i * 0.9);
      B.add(group, geo, M.dark);
    }
  }
  return {posts, steps, landingTop: top, northEdge: edge, stairOpeningWidth: 2 * opening};
}

function mainHall(B, groups, M, footprint, bounds) {
  const r = footprint[0], [xmin, rear, xmax] = bounds, width = xmax - xmin;
  const close = indices => [...indices.map(i => r[i]), r[indices[0]]];
  // EXACT disjoint I decomposition, using original vertices, not a bounding box.
  const domains = [
    {name: 'north rear hall / 水木清华 pond facade', polygon: [close([0, 1, 2, 9, 10, 11])], eave: 4.5, ridge: 7.0},
    {name: 'short central spine / hidden inferred roof', polygon: [close([2, 3, 8, 9])], eave: 4.0, ridge: 6.0},
    {name: 'south main hall / hidden inferred roof', polygon: [close([3, 4, 5, 6, 7, 8])], eave: 4.5, ridge: 7.0},
  ];
  slab(B, groups.body, footprint, 0.1, 0.32, M.stone);
  for (let i = 0; i < r.length - 1; i++) {
    if (i === 11) continue; // North facade is an OPEN colonnade, not a solid wall.
    const a = r[i], b = r[i + 1], run = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const connectorEdge = i === 2 || i === 8;
    const top = connectorEdge ? 3.75 : 4.22;
    lineBox(B, groups.body, a, b, 0.42, top - 0.42, 0.22, M.brick);
    // Modest inferred windows on unseen faces; keep the forward porch clear.
    if (i === 0 || i === 10) continue;
    const bays = Math.floor(run / 3.4), yaw = -Math.atan2(b[1] - a[1], b[0] - a[0]);
    const normal = [(b[1] - a[1]) / run, -(b[0] - a[0]) / run];
    for (let n = 0; n < bays; n++) {
      const t = (n + 0.5) / bays;
      lattice(B, groups.wood, M, a[0] + (b[0] - a[0]) * t + normal[0] * 0.14,
        a[1] + (b[1] - a[1]) * t + normal[1] * 0.14, 1.45, 1.03, 3.24, yaw);
    }
  }
  const porchFront = rear + 0.65, screenZ = rear + 2.6;
  const porchLeft = xmin + 0.65, porchRight = xmax - 0.65, bays = 7, bay = (porchRight - porchLeft) / bays;
  for (let i = 0; i <= bays; i++) {
    column(B, groups.wood, M, porchLeft + i * bay, porchFront, 0.74, 4.20);
  }
  beamPattern(B, groups.paint, M, width - 0.8, 4.14, porchFront);
  for (let i = 0; i < bays; i++) {
    const x = porchLeft + (i + 0.5) * bay;
    lattice(B, groups.wood, M, x, screenZ, bay - 0.20, 1.38, 3.88, Math.PI);
    B.box(groups.body, '', x, 1.06, screenZ, bay - 0.20, 0.64, 0.12, M.red);
    // Two red lower-door panels, modest gold outline, no fabricated inscription.
    for (const dx of [-bay * 0.22, bay * 0.22]) {
      B.box(groups.paint, '', x + dx, 1.06, screenZ - 0.08, bay * 0.34, 0.40, 0.025, M.ochre);
      B.box(groups.paint, '', x + dx, 1.06, screenZ - 0.10, bay * 0.30, 0.34, 0.025, M.red);
    }
  }
  const terrace = northTerrace(B, groups.terrace, M, xmin, xmax, rear);
  const roofs = domains.map(d => hipRoof(B, groups.roof, d.polygon, d.eave, d.ridge, M.tile, d.name));
  return {roofs, columns: 8, latticeBays: bays, terrace, facade: {
    direction: 'north / pond-facing rear hall', z: rear, porchFront, screenZ,
    clearPorchDepth: screenZ - porchFront - 0.22, porchLeft, porchRight,
  }};
}

function southGate(B, groups, M, footprint, bounds) {
  const [xmin, rear, xmax, front] = bounds, half = 6.25, screenZ = front - 1.18;
  slab(B, groups.body, footprint, 0.04, 0.14, M.stone);
  const partitions = [
    {name: 'central south entrance canopy', cut: rect(-half, rear - 1, half, front + 1), eave: 3.5, ridge: 5.7},
    {name: 'west gate return roof', cut: rect(xmin - 1, rear - 1, -half, front + 1), eave: 2.9, ridge: 4.15},
    {name: 'east gate return roof', cut: rect(half, rear - 1, xmax + 1, front + 1), eave: 2.9, ridge: 4.15},
  ];
  const roofs = [];
  for (const part of partitions) {
    const clipped = polygonClipping.intersection([footprint], [part.cut]);
    for (const polygon of clipped) {
      roofs.push(hipRoof(B, groups.roof, polygon, part.eave, part.ridge, M.tile, part.name));
    }
  }
  const r = footprint[0];
  // Wing enclosures follow the real skewed ring; no wall crosses the passage.
  for (let i = 0; i < r.length - 1; i++) {
    const a = r[i], b = r[i + 1];
    for (const [lo, hi] of [[xmin - 1, -half], [half, xmax + 1]]) {
      const ts = [0, 1];
      if (Math.abs(b[0] - a[0]) > 1e-8) {
        ts.push((lo - a[0]) / (b[0] - a[0]), (hi - a[0]) / (b[0] - a[0]));
      }
      const sorted = ts.filter(t => t >= 0 && t <= 1).sort((u, v) => u - v);
      for (let j = 0; j < sorted.length - 1; j++) {
        const u = sorted[j], v = sorted[j + 1], mid = a[0] + (b[0] - a[0]) * (u + v) / 2;
        if (mid < lo || mid > hi || v - u < 1e-8) continue;
        const at = t => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
        lineBox(B, groups.body, at(u), at(v), 0.18, 2.68, 0.28, M.brick);
        if (i !== 1) continue;
        const p = at(u), q = at(v);
        const cx = (p[0] + q[0]) / 2, cz = (p[1] + q[1]) / 2;
        const w = Math.hypot(q[0] - p[0], q[1] - p[1]), yaw = -Math.atan2(q[1] - p[1], q[0] - p[0]);
        for (const offset of [-w * 0.24, w * 0.24]) {
          const px = cx + Math.cos(yaw) * offset, pz = cz - Math.sin(yaw) * offset + 0.15;
          const panelWidth = w * 0.48 - 0.38;
          B.box(groups.body, '', px, 1.55, pz, panelWidth, 1.57, 0.025, M.plaster, yaw);
          for (const y of [0.72, 2.38]) B.box(groups.body, '', px, y, pz + 0.02,
            panelWidth + 0.16, 0.10, 0.09, M.stone, yaw);
          for (const side of [-1, 1]) {
            const dx = side * (panelWidth / 2 + 0.08);
            B.box(groups.body, '', px + Math.cos(yaw) * dx, 1.55, pz - Math.sin(yaw) * dx + 0.02,
              0.10, 1.74, 0.09, M.stone, yaw);
          }
        }
      }
    }
  }
  // Return piers flank the main pavilion, but the central entry remains open.
  for (const x of [-half - 0.13, half + 0.13]) {
    B.box(groups.body, '', x, 1.82, front - 0.48, 0.47, 3.28, 0.72, M.brick);
  }
  for (const z of [front - 0.58, rear + 0.68]) for (const x of [-5.94, -2.12, 2.12, 5.94]) {
    column(B, groups.wood, M, x, z, 0.18, 3.28);
  }
  beamPattern(B, groups.paint, M, 12.25, 3.19, front - 0.51);
  B.box(groups.wood, '', 0, 3.12, rear + 0.68, 12.20, 0.22, 0.24, M.red);
  for (const x of [-4.05, 4.05]) {
    B.box(groups.body, '', x, 0.48, screenZ, 3.34, 0.60, 0.18, M.brick);
    B.box(groups.wood, '', x, 1.68, screenZ, 3.15, 1.80, 0.12, M.dark);
    B.box(groups.body, '', x, 1.68, screenZ + 0.08, 2.88, 1.52, 0.03, M.plaster);
    for (const y of [0.88, 2.48]) B.box(groups.wood, '', x, y, screenZ + 0.12, 3.06, 0.045, 0.025, M.white);
    for (const dx of [-1.53, 1.53]) B.box(groups.wood, '', x + dx, 1.68, screenZ + 0.12, 0.045, 1.63, 0.025, M.white);
  }
  // A shallow stone threshold only: no fake doors or lions obstructing the gate.
  B.box(groups.body, '', 0, 0.14, front - 0.10, 3.95, 0.08, 0.50, M.stone);
  return {roofs, columns: 8, latticeBays: 0, facade: {
    direction: 'south / entrance gate', z: front, screenZ,
    centralEntryClearWidth: 3.90, centralEntryClearHeight: 2.95,
    passageRear: rear + 0.35, passageFront: front + 0.20,
  }};
}

export function createGongziDetail(feature, center, localOrigin) {
  const {spec, main} = verifySource(feature);
  const F = frame(feature, center, localOrigin, main), B = createBuilder(THREE, 659826161);
  const M = materials(B), detail = new THREE.Group();
  detail.name = main ? '工字厅 · 北后厦水木清华与推定工字屋面' : '工字厅门房 · 南入口照片参照';
  detail.rotation.y = -Math.atan2(F.east[1], F.east[0]);
  const groups = {};
  for (const [key, name] of Object.entries({
    body: 'exact-footprint masonry and plinth', wood: 'real red columns screens and lattice',
    paint: 'simplified painted beams (not exact mural)', roof: 'footprint-clipped curved grey hip roofs',
    terrace: 'north white stone landing open balustrade and stairs',
  })) {
    groups[key] = new THREE.Group(); groups[key].name = name;
    groups[key].userData.architectureRole = key; detail.add(groups[key]);
  }
  const result = main ? mainHall(B, groups, M, F.footprint, F.bounds) : southGate(B, groups, M, F.footprint, F.bounds);
  B.finish();
  const usedMaterials = new Set(), textures = new Set();
  let meshCount = 0, triangles = 0;
  detail.traverse(object => {
    if (!object.isMesh) return;
    meshCount++; triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3;
    object.geometry.computeBoundingBox(); object.geometry.computeBoundingSphere();
    object.userData.surfaceRole = object.parent.userData.architectureRole;
    if (object.userData.surfaceRole === 'roof') object.userData.footprintClipped = true;
    usedMaterials.add(object.material);
    for (const value of Object.values(object.material)) if (value?.isTexture) textures.add(value);
  });
  // Release unused materials; no per-detail orphan materials/textures.
  for (const mat of Object.values(M)) if (!usedMaterials.has(mat)) mat.dispose();
  const visible = new THREE.Box3().setFromObject(detail);
  const normal = F.south.map(v => main ? -v : v);
  const dimensions = {
    footprintBBoxWidth: F.metrics.bounds[2] - F.metrics.bounds[0],
    footprintBBoxDepth: F.metrics.bounds[3] - F.metrics.bounds[1],
    footprintArea: F.metrics.area,
    orientedFootprintWidth: F.bounds[2] - F.bounds[0], orientedFootprintDepth: F.bounds[3] - F.bounds[1],
    eave: main ? 4.5 : 3.5, mainRidge: main ? 7.0 : 5.7,
    meshLocalYMin: visible.min.y, meshLocalYMax: visible.max.y,
    visibleBBoxWidth: visible.max.x - visible.min.x, visibleBBoxDepth: visible.max.z - visible.min.z,
    terraceLanding: main ? result.terrace.landingTop : null,
  };
  const summary = main
    ? '工字厅（关联别名水木清华）：保留两厅＋短脊廊的精确工字凹轮廓；北后厦为照片支持的红柱／几何格窗、白石透空栏杆、临水台阶立面；南厅与中廊屋面为隐蔽面推定，非独立水木清华建筑。'
    : '工字厅门房（照片／地图关系解释，非 OSM 上游命名）：独立南入口，灰砖粉墙、曲坡灰瓦、红柱彩枋、双侧屏与贯通中央入口；不冒充主工字厅。石狮与精雕细部省略。';
  const knownUnknowns = [
    '所有高度、檐口、屋脊、柱径、开间、窗格数量与台阶尺寸为照片比例推定，非测绘。',
    '彩绘额枋仅用蓝／赭几何纹样简化；不声称复制原彩画。',
    '题额、楹联与其他文字未制作；不使用伪汉字或不可读随机字形。',
    '石狮、脊兽、精雕石刻／浮雕省略，不用卡通代用品。',
    main ? '北后厦照片被柳树遮挡且有透视；完整南厅、中廊、内院与背面结构为推定。'
      : '南门背面及侧翼进深被遮挡；低侧屋面与灰砖返回墙据冻结轮廓推定。',
    '不建内部空间、池塘、柳树或额外水木清华建筑；池塘及其他校园层由父模块维护。',
    '地图边界可能已含屋面投影；所有大屋面限于冻结原轮廓，不额外扩檐。',
  ];
  detail.userData = {
    campusDetail: true, buildingFeatureId: feature.id, referenceSite: SITE,
    displayName: main ? '工字厅' : '工字厅门房', aliases: main ? ['水木清华'] : [],
    labelSource: main ? '工字厅来自 OSM 建筑名；水木清华为官方后厦景观关联别名'
      : '照片与地图位置解释；上游 OSM 无 name 标签',
    referencePages: [source.referencePage],
    referenceImages: [main ? source.photos.northRearHall.url : source.photos.gate.url],
    sourceImage: main ? source.photos.northRearHall : source.photos.gate,
    sourceVerification: source.verification, heightSource: '照片比例推定，非测绘（photo-proportion inference, not measurement）',
    sourceMatchMetadata: {
      frozenFeatureId: feature.id, frozenRingSha256: spec.frozenRingSha256,
      frozenCoordinates: spec.ring, sourceName: feature.properties.name,
      nameSourceFeatureId: main ? source.main.nameSourceFeatureId : null,
      reviewedOsmAssociation: main ? source.main.nameSourceFeatureId : source.gate.osmMatch.id,
      ...(main ? {associatedPoi: source.main.shuimuPoi} : {osmMatch: source.gate.osmMatch}),
      sourceGeometryReplaced: false, independentShuimuBuilding: false,
    },
    refinementSummary: summary, knownUnknowns, limits: knownUnknowns.join(' '),
    estimatedDimensionsMeters: dimensions, dimensions,
    facadeNormal: [normal[0], 0, normal[1]], facadeNormalXZ: normal, frontNormalXZ: normal,
    frontYawDegrees: Math.atan2(normal[0], normal[1]) * 180 / Math.PI,
    directionSource: main ? '冻结北厅长北边 + 北池塘后厦照片（后厦关系由父流程核实）'
      : '冻结门房长南边 + 真正南入口照片；OSM 对应无建筑名',
    facade: result.facade, footprintAxisEastXZ: F.east, footprintAxisSouthXZ: F.south,
    footprintInFacadeFrame: F.footprint, roofPartitions: result.roofs,
    componentCounts: {columns: result.columns, northLatticeBays: result.latticeBays,
      sideScreens: main ? 0 : 2, balustradePosts: main ? result.terrace.posts : 0,
      stairs: main ? 6 : 0, lions: 0, inscriptions: 0},
    ...(main ? {terrace: result.terrace} : {}),
    materialMeshCounts: {materials: usedMaterials.size, meshes: meshCount, textures: textures.size, triangles},
    noReferencePhotoTextures: true,
  };
  return detail;
}

function disposeDetail(detail) {
  const geometries = new Set(), materials = new Set(), textures = new Set();
  detail.traverse(object => {
    if (object.geometry) geometries.add(object.geometry);
    for (const mat of object.material ? [].concat(object.material) : []) {
      materials.add(mat);
      for (const value of Object.values(mat)) if (value?.isTexture) textures.add(value);
    }
  });
  geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose());
}

export function refineGongzi(campus, data, featureId) {
  if (!GONGZI_IDS.includes(featureId)) throw new Error('Unsupported Gongzi feature ID; no standalone Shuimu building is permitted.');
  const matches = data?.features?.filter(f => f.id === featureId) ?? [];
  if (matches.length !== 1) throw new Error('Gongzi frozen feature must occur exactly once.');
  const feature = matches[0], {main} = verifySource(feature), center = data?.metadata?.center;
  const target = campus?.buildings?.get(featureId);
  coordinates(center, target?.userData.localOriginMeters);
  const F = frame(feature, center, target.userData.localOriginMeters, main);
  const baseHeight = target.userData.baseRenderHeight ?? target.userData.renderHeight;
  if (!target.isGroup || target.userData.featureId !== featureId ||
      target.userData.sourceFeatureId !== feature.properties.sourceFeatureId ||
      target.userData.nameSourceFeatureId !== feature.properties.nameSourceFeatureId ||
      target.userData.minHeight !== feature.properties.minHeight ||
      target.userData.minHeightSource !== feature.properties.minHeightSource ||
      baseHeight !== feature.properties.renderHeight ||
      Math.abs(target.position.x - F.metrics.origin[0]) > EPSILON ||
      Math.abs(target.position.z - F.metrics.origin[1]) > EPSILON || target.position.y !== 0 ||
      target.rotation.x !== 0 || target.rotation.y !== 0 || target.rotation.z !== 0 ||
      !target.scale.equals(new THREE.Vector3(1, 1, 1)) ||
      !target.children.some(child => child.name === 'base')) {
    throw new Error('Gongzi source root identity/placement/base-height mismatch.');
  }
  // All validation/construction precedes mutation, so source failure is atomic.
  const detail = createGongziDetail(feature, center, target.userData.localOriginMeters);
  const previous = target.children.find(child => child.userData.campusDetail);
  const root = replaceBuilding(campus.buildings, featureId, detail);
  root.name = detail.userData.displayName;
  const fields = ['displayName', 'aliases', 'labelSource', 'referenceSite', 'referencePages', 'referenceImages',
    'sourceImage', 'sourceVerification', 'heightSource', 'sourceMatchMetadata', 'refinementSummary',
    'knownUnknowns', 'limits', 'dimensions', 'estimatedDimensionsMeters', 'facadeNormal', 'facadeNormalXZ', 'frontNormalXZ',
    'frontYawDegrees', 'directionSource', 'materialMeshCounts', 'noReferencePhotoTextures'];
  for (const field of fields) root.userData[field] = detail.userData[field];
  // Preserve upstream name/association, source height, min-height and local origin.
  root.userData.baseRenderHeight = baseHeight;
  root.userData.baseHeightSource ??= feature.properties.heightSource;
  root.userData.renderHeight = detail.userData.estimatedDimensionsMeters.meshLocalYMax;
  if (previous?.userData.referenceSite === SITE) disposeDetail(previous);
  root.updateMatrixWorld(true);
  return root;
}
