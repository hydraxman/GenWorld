import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import polygonClipping from 'polygon-clipping';
import {footprintMetrics, project} from './geo.js';
import {replaceBuilding} from './model.js';

export const SCHOOL_ID = 'building:geometry:a253512bb392fe6910f5ddae';
const NAME_SOURCE_ID = 'osm:way:83805067';
const REFERENCE_PAGE = 'https://www.tsinghua.edu.cn/zjqh/xyfg/xyjg.htm';
const REFERENCE_IMAGE = 'https://www.tsinghua.edu.cn/__local/3/D6/43/55D1EDFDEEAC5CC4720BCF830F2_6E1BFFB2_C4429.jpg';
// Reviewed, frozen OpenFreeMap outline. The OSM way is a name association,
// not a replacement footprint. Northern reentrant edges MUST remain open.
const SOURCE_RING = [
  [116.318795085, 40.00133229], [116.318832636, 40.001019983],
  [116.31898284, 40.000937796], [116.320012808, 40.001007655],
  [116.320104003, 40.001102169], [116.320071816, 40.001402148],
  [116.319921613, 40.00139393], [116.31994307, 40.00121723],
  [116.319835782, 40.001110388], [116.319111586, 40.001061076],
  [116.318961382, 40.00115559], [116.318939924, 40.001340509],
  [116.318795085, 40.00133229],
];
const EAVE = 9.7;

function verifySource(feature) {
  const p = feature?.properties, rings = feature?.geometry?.coordinates;
  if (feature?.id !== SCHOOL_ID || p?.kind !== 'building' || p.name !== '清华学堂' ||
      p.nameSourceFeatureId !== NAME_SOURCE_ID || p.nameSource !== 'osm-local-extract-building-overlap' ||
      p.nameRole !== 'building-name' || p.nameConfidence !== 0.99 ||
      p.sourceFeatureId !== null || p.idStrategy !== 'canonical-geometry-sha256-96' ||
      p.extrude !== true || p.minHeight !== 0 || p.renderHeight !== 5 ||
      feature.geometry?.type !== 'Polygon' || !Array.isArray(rings) || rings.length !== 1 ||
      !Array.isArray(rings[0]) || rings[0].length !== SOURCE_RING.length ||
      rings[0].some((point, i) => !Array.isArray(point) || point.length !== 2 ||
        point.some((value, axis) => !Number.isFinite(value) ||
          Math.abs(value - SOURCE_RING[i][axis]) > 1e-10))) {
    throw new Error('School source association/geometry mismatch: re-review the frozen OLD 清华学堂 outline.');
  }
}

function verifyCoordinates(center, origin) {
  if (!Array.isArray(center) || center.length !== 2 || !center.every(Number.isFinite) ||
      Math.abs(center[0]) > 180 || Math.abs(center[1]) >= 90) {
    throw new Error('School requires a finite two-coordinate WGS84 projection center.');
  }
  if (!Array.isArray(origin) || origin.length !== 2 || !origin.every(Number.isFinite)) {
    throw new Error('School requires a finite two-coordinate local origin in meters.');
  }
}

function verifyOptions(options) {
  // This first pass intentionally has no unreviewed scale/heading overrides.
  if (!options || Object.getPrototypeOf(options) !== Object.prototype || Object.keys(options).length) {
    throw new Error('School options must be an empty object; scale/heading overrides are not supported.');
  }
}

function proceduralTexture(roof) {
  const width = 128, height = 128, pixels = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    const row = Math.floor(y / 16);
    for (let x = 0; x < width; x++) {
      const shifted = x + (row % 2) * (roof ? 8 : 16);
      const joint = y % 16 < 1 || shifted % (roof ? 16 : 32) < 1;
      const base = roof ? (joint ? [93, 48, 39] : [154, 69, 51])
        : (joint ? [152, 153, 146] : [102, 112, 110]);
      const noise = ((x * 29 + y * 17) % 11) - 5;
      const offset = (y * width + x) * 4;
      for (let c = 0; c < 3; c++) pixels[offset + c] = base[c] + noise;
      pixels[offset + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(pixels, width, height);
  texture.name = roof ? 'school procedural red tiles (no photograph)' : 'school procedural grey masonry (no photograph)';
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

// Merge actual geometry by material/semantic surface. Eight mesh draws in this
// pass, independent of the number of windows, balusters or masonry courses.
function makeBatches() {
  const definitions = {
    foundation: ['exact U footprint foundation', {color: '#777b74', roughness: 0.96}],
    masonry: ['grey masonry U shell and raised end pavilions', {color: '#ffffff', map: proceduralTexture(false), roughness: 0.94, side: THREE.DoubleSide}],
    trim: ['batched white cornices columns arches and balustrades', {color: '#e7e6dc', roughness: 0.88}],
    roof: ['red pitched roofs clipped to frozen U footprint', {color: '#ffffff', map: proceduralTexture(true), roughness: 0.91, side: THREE.DoubleSide}],
    dormerRoof: ['batched red dormer hoods', null],
    glass: ['batched dark recessed windows and entrance panels', {color: '#283533', roughness: 0.65, metalness: 0.08, side: THREE.DoubleSide}],
    wood: ['batched brown window frames and doors', {color: '#4a3930', roughness: 0.88}],
    iron: ['batched sign strokes and entrance lanterns', {color: '#34342f', roughness: 0.8}],
  };
  const materials = {};
  for (const [key, [, settings]] of Object.entries(definitions)) {
    materials[key] = settings ? new THREE.MeshStandardMaterial(settings) : materials.roof;
    materials[key].name ||= `school ${key}`;
  }
  const pieces = Object.fromEntries(Object.keys(definitions).map(key => [key, []]));
  return {
    add(key, geometry, matrix = null) {
      if (matrix) geometry.applyMatrix4(matrix);
      pieces[key].push(geometry);
    },
    finish(group) {
      for (const [key, geometries] of Object.entries(pieces)) {
        if (!geometries.length) continue;
        const normalized = geometries.map(geometry => geometry.index ? geometry.toNonIndexed() : geometry);
        const geometry = mergeGeometries(normalized);
        new Set([...geometries, ...normalized]).forEach(piece => piece.dispose());
        if (!geometry) throw new Error(`Cannot batch school ${key} geometry.`);
        geometry.computeBoundingBox();
        geometry.computeBoundingSphere();
        const mesh = new THREE.Mesh(geometry, materials[key]);
        mesh.name = definitions[key][0];
        mesh.castShadow = mesh.receiveShadow = true;
        mesh.userData.surfaceRole = key;
        group.add(mesh);
      }
    },
  };
}

function frameAt(a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
  const tangent = [dx / length, dz / length], normal = [-tangent[1], tangent[0]];
  const origin = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const matrix = new THREE.Matrix4().makeBasis(
    new THREE.Vector3(tangent[0], 0, tangent[1]), new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(normal[0], 0, normal[1]));
  matrix.setPosition(origin[0], 0, origin[1]);
  return {length, tangent, normal, origin, matrix};
}

function box(batch, key, size, position, frame = null) {
  const geometry = new THREE.BoxGeometry(...size);
  geometry.translate(...position);
  batch.add(key, geometry, frame?.matrix);
}

function cylinder(batch, key, radii, height, position, frame = null) {
  const geometry = new THREE.CylinderGeometry(...radii, height, 12);
  geometry.translate(...position);
  batch.add(key, geometry, frame?.matrix);
}

function beam(batch, key, a, b, radius, frame = null) {
  const from = new THREE.Vector3(...a), to = new THREE.Vector3(...b);
  const geometry = new THREE.CylinderGeometry(radius, radius, from.distanceTo(to), 6);
  geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize()));
  geometry.translate(...from.add(to).multiplyScalar(0.5).toArray());
  batch.add(key, geometry, frame?.matrix);
}

function shapeFromPolygon(polygon) {
  const shape = new THREE.Shape(polygon[0].map(([x, z]) => new THREE.Vector2(x, -z)));
  for (const ring of polygon.slice(1)) shape.holes.push(new THREE.Path(ring.map(([x, z]) => new THREE.Vector2(x, -z))));
  return shape;
}

function horizontalSolid(batch, key, polygon, bottom, top) {
  const geometry = new THREE.ExtrudeGeometry(shapeFromPolygon(polygon), {
    depth: top - bottom, steps: 1, bevelEnabled: false, curveSegments: 1,
  });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, bottom, 0);
  batch.add(key, geometry);
}

function planarSurface(polygons, height) {
  const vertices = [], uv = [];
  for (const polygon of polygons) {
    const contours = polygon.map(ring => ring.map(point => new THREE.Vector2(...point)));
    const triangles = THREE.ShapeUtils.triangulateShape(contours[0], contours.slice(1));
    // ShapeUtils removes closing duplicates in-place; use those same contours.
    const flattened = contours.flat().map(point => [point.x, point.y]);
    for (const face of triangles) {
      const tri = face.map(index => flattened[index]);
      const cross = (tri[1][0] - tri[0][0]) * (tri[2][1] - tri[0][1]) -
        (tri[1][1] - tri[0][1]) * (tri[2][0] - tri[0][0]);
      if (Math.abs(cross) < 1e-9) continue;
      if (cross > 0) tri.reverse(); // X/Z order for upward Y normals.
      for (const point of tri) {
        vertices.push(point[0], height(point), point[1]);
        uv.push(point[0] / 0.9, point[1] / 0.9);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.computeVertexNormals();
  return geometry;
}

const rectangle = (x0, z0, x1, z1) => [[[x0, z0], [x1, z0], [x1, z1], [x0, z1], [x0, z0]]];
const boundsOf = polygons => {
  const points = polygons.flat(2);
  return [Math.min(...points.map(p => p[0])), Math.min(...points.map(p => p[1])),
    Math.max(...points.map(p => p[0])), Math.max(...points.map(p => p[1]))];
};

// Use installed robust polygon boolean intersections, not a duplicate of the
// auditorium's triangle half-plane clipper. Each planar hip sector is intersected
// with its exact, disjoint U-shaped footprint piece before triangulation.
function hipRoof(batch, polygons, eave, ridge, name) {
  const [x0, z0, x1, z1] = boundsOf(polygons), w = x1 - x0, d = z1 - z0;
  const half = Math.min(w, d) / 2, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const nw = [x0, z0], ne = [x1, z0], se = [x1, z1], sw = [x0, z1];
  const a = w >= d ? [x0 + half, cz] : [cx, z0 + half];
  const b = w >= d ? [x1 - half, cz] : [cx, z1 - half];
  const sectors = w >= d
    ? [[nw, ne, b, a], [sw, a, b, se], [nw, a, sw], [ne, se, b]]
    : [[nw, a, b, sw], [ne, se, b, a], [nw, ne, a], [sw, b, se]];
  const distances = w >= d
    ? [p => p[1] - z0, p => z1 - p[1], p => p[0] - x0, p => x1 - p[0]]
    : [p => p[0] - x0, p => x1 - p[0], p => p[1] - z0, p => z1 - p[1]];
  for (let i = 0; i < sectors.length; i++) {
    const sector = [...sectors[i], sectors[i][0]];
    const clipped = polygonClipping.intersection(polygons, [sector]);
    if (clipped.length) batch.add('roof', planarSurface(clipped, p =>
      eave + (ridge - eave) * distances[i](p) / half));
  }
  beam(batch, 'trim', [a[0], ridge + 0.035, a[1]], [b[0], ridge + 0.035, b[1]], 0.075);
  return {name, polygons, eave, ridge, height: p => eave + (ridge - eave) *
    Math.max(0, Math.min(p[0] - x0, x1 - p[0], p[1] - z0, z1 - p[1]) / half)};
}

function perimeterWall(batch, a, b, bottom, top) {
  const frame = frameAt(a, b), l = frame.length / 2;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    -l, bottom, 0, l, bottom, 0, l, top, 0, -l, bottom, 0, l, top, 0, -l, top, 0,
  ], 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute([
    0, bottom / 0.8, frame.length / 1.6, bottom / 0.8, frame.length / 1.6, top / 0.8,
    0, bottom / 0.8, frame.length / 1.6, top / 0.8, 0, top / 0.8,
  ], 2));
  geometry.computeVertexNormals();
  batch.add('masonry', geometry, frame.matrix);
}

function archShape(x, bottom, width, height, rise = width / 2) {
  const r = width / 2, spring = bottom + height - rise;
  const shape = new THREE.Shape();
  shape.moveTo(x - r, bottom);
  shape.lineTo(x + r, bottom);
  shape.lineTo(x + r, spring);
  shape.absellipse(x, spring, r, rise, 0, Math.PI, false);
  shape.lineTo(x - r, bottom);
  return shape;
}

function verticalShape(batch, key, shape, depth, offset, frame) {
  const geometry = new THREE.ExtrudeGeometry(shape, {depth, bevelEnabled: false, curveSegments: 16, steps: 1});
  geometry.translate(0, 0, offset);
  batch.add(key, geometry, frame.matrix);
}

function windowBay(batch, frame, x) {
  for (const [bottom, height] of [[1.25, 2.8], [6.02, 2.9]]) {
    const width = 1.75;
    box(batch, 'glass', [width, height, 0.06], [x, bottom + height / 2, 0.03], frame);
    for (const side of [-1, 1]) {
      box(batch, 'trim', [0.16, height + 0.2, 0.16], [x + side * (width / 2 + 0.08), bottom + height / 2, 0.10], frame);
      box(batch, 'wood', [0.075, height, 0.07], [x + side * (width / 2 - 0.04), bottom + height / 2, 0.09], frame);
    }
    for (const y of [bottom, bottom + height]) {
      box(batch, 'trim', [width + 0.45, 0.17, 0.25], [x, y, 0.11], frame);
    }
    box(batch, 'wood', [0.065, height, 0.07], [x, bottom + height / 2, 0.09], frame);
    box(batch, 'wood', [width, 0.075, 0.07], [x, bottom + height * 0.62, 0.09], frame);
    if (bottom > 5) {
      for (const side of [-1, 1]) box(batch, 'trim', [0.22, 0.42, 0.22],
        [x + side * (width / 2 + 0.06), bottom + height + 0.16, 0.13], frame);
    }
  }
}

// A small original geometric-stroke interpretation of 堂學華清 on the sign,
// not a font/image copy of the photograph's calligraphy.
function entranceSign(batch, frame) {
  const glyphs = [
    [[-.4,.1,.4,.1],[-.32,-.3,.32,-.3],[0,-.3,0,-.05],[-.4,-.45,.4,-.45],[-.35,.36,.35,.36],[-.35,.36,-.35,.12],[.35,.36,.35,.12],[-.18,.28,.18,.28],[-.18,.28,-.18,.14],[.18,.28,.18,.14],[-.18,.14,.18,.14],[0,.38,0,.5],[-.3,.5,-.18,.4],[.3,.5,.18,.4]],
    [[-.35,.3,.35,.3],[-.35,.3,-.35,.15],[.35,.3,.35,.15],[-.23,.08,.23,.08],[.23,.08,0,-.1],[0,-.1,0,-.4],[0,-.4,-.16,-.45],[-.4,-.15,.4,-.15],[-.32,.5,-.18,.35],[0,.5,.08,.35],[.34,.5,.2,.35]],
    [[-.2,.48,-.4,.18],[-.28,.33,-.28,.03],[.04,.46,.04,.07],[.04,.07,.37,.07],[.04,.2,.35,.37],[-.4,-.17,.4,-.17],[0,0,0,-.45]],
    [[-.36,.4,-.23,.27],[-.4,.12,-.27,.04],[-.4,-.4,-.24,-.18],[-.05,.35,.4,.35],[-.02,.2,.37,.2],[-.08,.05,.43,.05],[.18,.48,.18,.04],[0,-.08,.35,-.08],[0,-.23,.35,-.23],[0,-.38,.35,-.38],[0,-.08,0,-.46],[.35,-.08,.35,-.46]],
  ];
  glyphs.forEach((strokes, i) => {
    const cx = (i - 1.5) * 1.5;
    for (const [x1, y1, x2, y2] of strokes) {
      beam(batch, 'iron', [cx + x1 * 0.75, 10.15 + y1 * 0.67, 0.51],
        [cx + x2 * 0.75, 10.15 + y2 * 0.67, 0.51], 0.028, frame);
    }
  });
}

function entrance(batch, frame) {
  const wall = new THREE.Shape([
    new THREE.Vector2(-frame.length / 2, 0.45), new THREE.Vector2(frame.length / 2, 0.45),
    new THREE.Vector2(frame.length / 2, EAVE), new THREE.Vector2(-frame.length / 2, EAVE),
  ]);
  const door = archShape(0, 0.45, 3.1, 4.0, 0.72);
  const upper = [-1.55, 1.55].map(x => archShape(x, 6.22, 2.35, 3.03, 0.37));
  for (const hole of [door, ...upper]) wall.holes.push(new THREE.Path(hole.getPoints(24)));
  verticalShape(batch, 'masonry', wall, 0.32, -0.32, frame);
  verticalShape(batch, 'wood', door, 0.07, -0.22, frame);
  const surround = archShape(0, 0.45, 3.86, 4.43, 0.96);
  surround.holes.push(new THREE.Path(door.getPoints(24)));
  verticalShape(batch, 'trim', surround, 0.28, 0.015, frame);
  for (const shape of upper) verticalShape(batch, 'glass', shape, 0.04, -0.19, frame);
  for (const x of [-1.55, 1.55]) {
    const outer = archShape(x, 6.11, 2.62, 3.3, 0.44);
    outer.holes.push(new THREE.Path(archShape(x, 6.22, 2.35, 3.03, 0.37).getPoints(24)));
    verticalShape(batch, 'trim', outer, 0.12, 0.03, frame);
    box(batch, 'wood', [0.08, 2.88, 0.07], [x, 7.66, -0.13], frame);
    box(batch, 'wood', [2.28, 0.08, 0.07], [x, 8.1, -0.13], frame);
  }
  // Upper-storey classical columns, with bases and capitals; lower pilasters.
  for (const x of [-3.72, 3.72]) {
    box(batch, 'trim', [0.57, 4.38, 0.28], [x, 2.73, 0.15], frame);
    cylinder(batch, 'trim', [0.25, 0.3], 4.25, [x, 7.52, 0.34], frame);
    for (const y of [5.31, 9.69]) {
      cylinder(batch, 'trim', [0.4, 0.4], 0.20, [x, y, 0.34], frame);
      box(batch, 'trim', [0.87, 0.13, 0.75], [x, y + 0.12, 0.31], frame);
    }
  }
  box(batch, 'trim', [8.15, 0.3, 0.76], [0, 5.06, 0.22], frame);
  box(batch, 'trim', [8.5, 0.88, 0.43], [0, 10.13, 0.27], frame);
  box(batch, 'trim', [8.9, 0.20, 0.71], [0, 10.69, 0.29], frame);
  box(batch, 'trim', [8.3, 0.14, 0.58], [0, 9.64, 0.29], frame);
  entranceSign(batch, frame);
  // Real spaced balusters leave visible gaps; not a texture or opaque panel.
  for (const side of [-1, 1]) {
    const cx = side * 1.58;
    box(batch, 'trim', [2.45, 0.13, 0.36], [cx, 6.12, 0.45], frame);
    box(batch, 'trim', [2.45, 0.13, 0.36], [cx, 5.34, 0.45], frame);
    for (let i = 0; i < 7; i++) {
      const x = cx - 1.05 + i * 0.35;
      cylinder(batch, 'trim', [0.055, 0.06], 0.64, [x, 5.73, 0.45], frame);
      cylinder(batch, 'trim', [0.10, 0.10], 0.22, [x, 5.65, 0.45], frame);
    }
  }
  for (const x of [-2.67, 2.67]) {
    box(batch, 'iron', [0.31, 0.48, 0.32], [x, 4.35, 0.38], frame);
    beam(batch, 'iron', [x, 4.75, 0.05], [x, 4.75, 0.38], 0.04, frame);
  }
  for (let i = 0; i < 3; i++) box(batch, 'foundation', [5.1 + i * 0.42, 0.16, 0.72 + i * 0.65],
    [0, 0.40 - i * 0.14, 0.55 + i * 0.26], frame);
  // Low raised parapet ahead of the steep pavilion roof; corner piers are taller.
  box(batch, 'trim', [frame.length + 0.16, 0.19, 0.47], [0, 11.0, 0.11], frame);
  box(batch, 'trim', [8.45, 0.48, 0.27], [0, 11.36, 0.12], frame);
  for (const x of [-frame.length / 2 + 0.5, frame.length / 2 - 0.5]) {
    box(batch, 'trim', [0.86, 1.08, 0.49], [x, 11.56, 0.12], frame);
  }
  return {columns: 2, balconyBalusters: 14, doorWidth: 3.1, bayWidth: frame.length};
}

function dormer(batch, center, normal, base, width = 1.65, height = 1.3) {
  const t = [normal[1], -normal[0]], half = width / 2;
  const frame = frameAt([center[0] - t[0] * half, center[1] - t[1] * half],
    [center[0] + t[0] * half, center[1] + t[1] * half]);
  const face = archShape(0, base, width, height, width / 2);
  verticalShape(batch, 'masonry', face, 0.8, -0.8, frame);
  const aperture = archShape(0, base + 0.18, width - 0.43, height - 0.37, (width - 0.43) / 2);
  verticalShape(batch, 'glass', aperture, 0.025, 0.025, frame);
  const trim = archShape(0, base + 0.09, width - 0.18, height - 0.19, (width - 0.18) / 2);
  trim.holes.push(new THREE.Path(aperture.getPoints(20)));
  verticalShape(batch, 'trim', trim, 0.08, 0.04, frame);
  const g = new THREE.BufferGeometry(), peak = base + height + 0.12, edge = base + height - 0.45;
  g.setAttribute('position', new THREE.Float32BufferAttribute([
    -half - 0.10, edge, 0.14, 0, peak, 0.14, 0, peak, -1.1,
    -half - 0.10, edge, 0.14, 0, peak, -1.1, -half - 0.10, edge, -1.1,
    half + 0.10, edge, 0.14, half + 0.10, edge, -1.1, 0, peak, -1.1,
    half + 0.10, edge, 0.14, 0, peak, -1.1, 0, peak, 0.14,
  ], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0,0, .5,1, .5,0, 0,0, .5,0, 0,1, 1,0, 1,1, .5,1, 1,0, .5,1, .5,0], 2));
  g.computeVertexNormals();
  batch.add('dormerRoof', g, frame.matrix);
}

function visibleLocalBounds(detail) {
  detail.updateMatrixWorld(true);
  const bounds = new THREE.Box3();
  detail.traverseVisible(object => {
    if (!object.isMesh) return;
    object.geometry.computeBoundingBox();
    bounds.union(object.geometry.boundingBox.clone().applyMatrix4(object.matrixWorld));
  });
  if (bounds.isEmpty() || ![...bounds.min.toArray(), ...bounds.max.toArray()].every(Number.isFinite)) {
    throw new Error('School detail has invalid visible bounds.');
  }
  return bounds;
}

export function createSchoolDetail(feature, center, localOriginMeters, options = {}) {
  verifySource(feature);
  verifyCoordinates(center, localOriginMeters);
  verifyOptions(options);
  const metrics = footprintMetrics(feature.geometry, center);
  const projected = SOURCE_RING.slice(0, -1).map(point => project(point, center));
  const axis = frameAt(projected[2], projected[3]).tangent;
  const south = [-axis[1], axis[0]];
  const ring = projected.map(([x, z]) => {
    x -= metrics.origin[0]; z -= metrics.origin[1];
    return [x * axis[0] + z * axis[1], x * south[0] + z * south[1]];
  });
  const footprint = [[...ring, ring[0]]], batch = makeBatches();
  const detail = new THREE.Group(), architecture = new THREE.Group();
  detail.name = '清华学堂 · 灰墙白饰红坡屋顶照片参照重建';
  architecture.name = 'school footprint-aligned architecture';
  architecture.position.set(metrics.origin[0] - localOriginMeters[0], 0, metrics.origin[1] - localOriginMeters[1]);
  architecture.rotation.y = Math.atan2(-axis[1], axis[0]);
  detail.add(architecture);
  horizontalSolid(batch, 'foundation', footprint, 0, 0.45);
  batch.add('masonry', planarSurface([footprint], () => EAVE));
  let windowBays = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length], frame = frameAt(a, b);
    if (i !== 3) {
      perimeterWall(batch, a, b, 0.45, EAVE);
      const count = Math.max(1, Math.floor((frame.length - 1.5) / 4.6));
      for (let j = 0; j < count; j++) {
        windowBay(batch, frame, (j - (count - 1) / 2) * frame.length / count);
        windowBays++;
      }
    }
    for (const [height, thick, depth] of [[0.69, 0.25, 0.23], [4.83, 0.18, 0.17],
      [9.43, 0.20, 0.25], [9.69, 0.22, 0.40]]) {
      // Keep the modeled entrance aperture truly open, including its base course.
      if (i === 3 && height < 5) {
        const sideWidth = (frame.length - 3.95) / 2;
        for (const side of [-1, 1]) box(batch, 'trim', [sideWidth, thick, depth],
          [side * (3.95 / 2 + sideWidth / 2), height, 0.08], frame);
      } else box(batch, 'trim', [frame.length, thick, depth], [0, height, 0.08], frame);
    }
  }
  // Exact disjoint partitions, including the notch's diagonal returns. They
  // deliberately do not use the building bbox as a single roof/floor polygon.
  const zones = [
    ['south long range', rectangle(-35, -100, 37, 100), EAVE, 13.8],
    ['west northward wing', rectangle(-100, -100, -35, 1), EAVE, 13.6],
    ['east northward wing', rectangle(37, -100, 100, 1), EAVE, 13.8],
    ['southwest raised pavilion', rectangle(-100, 1, -35, 100), 10.6, 15.85],
    ['southeast entrance pavilion', rectangle(37, 1, 100, 100), 11.15, 17.0],
  ];
  const roofs = zones.map(([name, limit, eave, ridge]) => {
    const polygons = polygonClipping.intersection(footprint, limit);
    if (!polygons.length) throw new Error(`School roof partition missing: ${name}`);
    if (eave > EAVE) {
      for (const polygon of polygons) horizontalSolid(batch, 'masonry', polygon, EAVE, eave);
      for (const polygon of polygons) {
        const outer = polygon[0].slice(0, -1);
        outer.forEach((a, i) => {
          const frame = frameAt(a, outer[(i + 1) % outer.length]);
          box(batch, 'trim', [frame.length, 0.23, 0.44], [0, eave, 0.05], frame);
        });
      }
    }
    return hipRoof(batch, polygons, eave, ridge, name);
  });
  const front = frameAt(ring[3], ring[4]), entry = entrance(batch, front);
  const longRoof = roofs[0];
  for (const u of [-24, -9, 8, 23]) {
    const point = [u, ring[2][1] - 3.55];
    dormer(batch, point, [0, 1], longRoof.height(point) - 0.25);
  }
  const entryDormer = front.origin.map((value, axis) => value - front.normal[axis] * 3.6);
  dormer(batch, entryDormer, front.normal, roofs[4].height(entryDormer) - 0.46, 2.02, 1.72);
  for (const [index, u] of [[1, -48], [2, 49]]) {
    const point = [u, -10];
    dormer(batch, point, [index === 1 ? -1 : 1, 0], roofs[index].height(point) - 0.45, 1.5, 1.1);
  }
  batch.finish(architecture);
  const bounds = visibleLocalBounds(detail);
  const frontNormalXZ = [
    axis[0] * front.normal[0] + south[0] * front.normal[1],
    axis[1] * front.normal[0] + south[1] * front.normal[1],
  ];
  detail.userData = {
    featureId: SCHOOL_ID, nameSourceFeatureId: NAME_SOURCE_ID, referenceSite: 'tsinghua-school',
    referencePages: [REFERENCE_PAGE], referenceImages: [REFERENCE_IMAGE],
    localReference: 'references/tsinghua-school-oblique.jpg',
    localAxes: 'X east, Y up, Z south', footprintArea: metrics.area, footprintBounds: metrics.bounds,
    frontNormalXZ, frontYawDegrees: Math.atan2(frontNormalXZ[0], frontNormalXZ[1]) * 180 / Math.PI,
    viewDirection: [frontNormalXZ[0], 0.65, frontNormalXZ[1]],
    directionSource: '冻结轮廓东南斜切角 + 照片长南翼／短东翼关系；入口与摄影方向推定，非测绘',
    footprintAxisEastXZ: axis, footprintAxisSouthXZ: south,
    roofPartitions: roofs.map(({name, polygons, eave, ridge}) => ({name, polygons, eave, ridge})),
    componentCounts: {windowBays, entranceColumns: entry.columns, balconyBalusters: entry.balconyBalusters, dormers: 7, roofZones: 5},
    estimatedDimensionsMeters: {
      footprintBBoxWidth: metrics.bounds[2] - metrics.bounds[0],
      footprintBBoxDepth: metrics.bounds[3] - metrics.bounds[1],
      visibleBBoxWidth: bounds.max.x - bounds.min.x, visibleBBoxDepth: bounds.max.z - bounds.min.z,
      wallEave: EAVE, longRoofRidge: 13.8, westPavilionRidge: 15.85, entrancePavilionRidge: 17,
      entranceBayWidth: entry.bayWidth, entranceDoorWidth: entry.doorWidth,
      meshLocalYMin: bounds.min.y, meshLocalYMax: bounds.max.y,
    },
    observed: ['灰色砌筑墙体与白色多层线脚', '红色坡屋面、抬高端部屋顶和小型拱顶老虎窗',
      '入口白色上层柱式、下层拱门、双窗与透空栏杆', '入口额枋校名牌及高起栏板'],
    limits: '冻结地图轮廓保留北向开放院落；高度、屋顶分区、坡角、门窗数量和构件尺寸为照片比例推定，非测绘。入口定位在东南斜切角为推定；西南端、北翼及院内隐蔽面按可见节奏简化补全，非完整历史复原。入口实际建拱形墙洞及后退门板，普通窗为立面嵌板外观；不建内部空间。校名为简化几何笔画，不复制照片书法；不使用照片贴图。',
    noReferencePhotoTextures: true, reconstructionBatch: 3,
  };
  detail.traverse(object => {
    if (object.userData.surfaceRole === 'roof') object.userData.footprintClipped = true;
  });
  return detail;
}

function disposeOldDetail(detail) {
  const geometries = new Set(), materials = new Set(), textures = new Set();
  detail.traverse(object => {
    if (object.geometry) geometries.add(object.geometry);
    for (const material of object.material ? [].concat(object.material) : []) {
      materials.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
    }
  });
  geometries.forEach(value => value.dispose());
  materials.forEach(value => value.dispose());
  textures.forEach(value => value.dispose());
}

export function refineSchool(campus, data, options = {}) {
  verifyOptions(options);
  const matches = data?.features?.filter(feature => feature.id === SCHOOL_ID) || [];
  if (matches.length !== 1) throw new Error('School frozen feature must occur exactly once.');
  const feature = matches[0];
  verifySource(feature);
  const center = data?.metadata?.center, target = campus?.buildings?.get(SCHOOL_ID);
  verifyCoordinates(center, target?.userData.localOriginMeters);
  const metrics = footprintMetrics(feature.geometry, center);
  if (!target?.isGroup || target.userData.featureId !== SCHOOL_ID ||
      target.userData.name !== '清华学堂' || target.userData.nameSourceFeatureId !== NAME_SOURCE_ID ||
      !target.children.some(child => child.name === 'base') ||
      !target.userData.localOriginMeters.every((value, axis) => Math.abs(value - metrics.origin[axis]) < 1e-6) ||
      Math.abs(target.position.x - metrics.origin[0]) > 1e-6 ||
      Math.abs(target.position.z - metrics.origin[1]) > 1e-6 || target.position.y !== 0 ||
      target.rotation.x !== 0 || target.rotation.y !== 0 || target.rotation.z !== 0 ||
      !target.scale.equals(new THREE.Vector3(1, 1, 1)) ||
      !Number.isFinite(target.userData.baseRenderHeight ?? target.userData.renderHeight)) {
    throw new Error('School source building placement/identity mismatch.');
  }
  const detail = createSchoolDetail(feature, center, target.userData.localOriginMeters, options);
  const baseRenderHeight = target.userData.baseRenderHeight ?? target.userData.renderHeight;
  const previous = target.children.find(child => child.userData.campusDetail);
  const result = replaceBuilding(campus.buildings, SCHOOL_ID, detail);
  result.name = '清华学堂';
  Object.assign(result.userData, {
    name: '清华学堂', referenceSite: 'tsinghua-school', baseRenderHeight,
    // Only new visible detail geometry, evaluated before attachment. Box3 on
    // the target includes its hidden base and parent transforms: never use it.
    renderHeight: detail.userData.estimatedDimensionsMeters.meshLocalYMax,
    heightSource: '照片比例推定，非测绘',
    refinementSummary: '清华学堂（非新清华学堂）：保留北向开口的 U 形灰砌筑体量，重建白色线脚、东南角双柱／拱门／透空栏杆入口、红色分区坡屋顶、老虎窗和抬高端亭；高度与隐蔽面按官方照片比例估算，非测绘。',
    referencePages: detail.userData.referencePages, referenceImages: detail.userData.referenceImages,
    refinementSource: '官方照片参照 + 冻结 OpenFreeMap U 形轮廓',
    estimatedDimensionsMeters: detail.userData.estimatedDimensionsMeters,
    frontNormalXZ: detail.userData.frontNormalXZ, frontYawDegrees: detail.userData.frontYawDegrees,
    directionSource: detail.userData.directionSource, limits: detail.userData.limits,
    noReferencePhotoTextures: true, reconstructionBatch: 3,
  });
  if (previous?.userData.referenceSite === 'tsinghua-school') disposeOldDetail(previous);
  return result;
}
