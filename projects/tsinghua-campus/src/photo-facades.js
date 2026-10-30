import * as THREE from 'three';
import polygonClipping from 'polygon-clipping';

export function createPhotoFacade({profile, edge, spec, roofY, B, panels, structure, windows, roof,
  entrance, M, wall, deferNear, farWindow}) {
  const {a, tangent: t, normal: n, yaw, length: L} = edge;
  const {bottom, floors} = spec, base = bottom + .16, height = roofY - base;
  const style = profile.facade.style, width = profile.facade.width, mid = L / 2;
  const reverse = t[0] * n[1] - t[1] * n[0] < 0;
  const point = (x, y, depth = 0) => [a[0] + t[0] * x + n[0] * depth, y,
    a[1] + t[1] * x + n[1] * depth];
  const openings = [], probes = [], doors = [];
  const box = (g, x, y, depth, w, h, d, material = M.trim) => {
    if (!deferNear) B.box(g, '', ...point(x, y, depth), w, h, d, material, yaw);
  };
  const rect = (x0, x1, y0, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  const arch = (x0, x1, y0, spring) => {
    const r = (x1 - x0) / 2, x = (x0 + x1) / 2;
    return [[x0, y0], [x1, y0], ...Array.from({length: 21}, (_, i) =>
      [x + r * Math.cos(i * Math.PI / 20), spring + r * Math.sin(i * Math.PI / 20)])];
  };
  const surface = (g, material, ring, depth) => {
    if (deferNear) return;
    const geometry = new THREE.ShapeGeometry(new THREE.Shape(ring.map(p => new THREE.Vector2(...p))));
    const position = geometry.attributes.position;
    for (let i = 0; i < position.count; i++) position.setXYZ(i, ...point(position.getX(i), position.getY(i), depth));
    if (reverse) {
      const index = geometry.index;
      for (let i = 0; i < index.count; i += 3) {
        const second = index.getX(i + 1); index.setX(i + 1, index.getX(i + 2)); index.setX(i + 2, second);
      }
    }
    geometry.computeVertexNormals(); B.worldUV(geometry, material); B.add(g, geometry, material);
  };
  const perforated = (outer, holes, depth, material) => {
    const closed = ring => [...ring, ring[0]];
    const pieces = holes.length ? polygonClipping.difference([[closed(outer)]], ...holes.map(hole => [[closed(hole)]]))
      : [[closed(outer)]];
    for (const polygon of pieces) {
      if (deferNear) continue;
      const shape = new THREE.Shape(polygon[0].map(p => new THREE.Vector2(...p)));
      for (const hole of polygon.slice(1)) shape.holes.push(new THREE.Path(hole.map(p => new THREE.Vector2(...p))));
      const geometry = new THREE.ShapeGeometry(shape);
      const position = geometry.attributes.position;
      for (let i = 0; i < position.count; i++) position.setXYZ(i, ...point(position.getX(i), position.getY(i), depth));
      if (reverse) {
        const index = geometry.index;
        for (let i = 0; i < index.count; i += 3) {
          const second = index.getX(i + 1); index.setX(i + 1, index.getX(i + 2)); index.setX(i + 2, second);
        }
      }
      geometry.computeVertexNormals(); B.worldUV(geometry, material); B.add(structure, geometry, material);
    }
  };
  const opening = (x, w, y0, y1, {door = false, depth = -.32, curved = false, divisions = 2} = {}) => {
    const x0 = x - w / 2, x1 = x + w / 2;
    const ring = curved ? arch(x0, x1, y0, y1 - w / 2) : rect(x0, x1, y0, y1);
    openings.push({ring, depth});
    surface(windows, M.glass, ring, depth);
    farWindow([point(x0, y0, .025), point(x1, y0, .025), point(x1, y1, .025), point(x0, y1, .025)]);
    for (const xEdge of [x0, x1]) box(windows, xEdge, (y0 + y1 - (curved ? w / 2 : 0)) / 2,
      depth + .08, .08, y1 - y0 - (curved ? w / 2 : 0), .18, M.frame);
    for (const y of [y0, y1 - (curved ? w / 2 : 0)]) box(windows, x, y, depth + .08, w, .08, .18, M.frame);
    for (let i = 1; i < divisions; i++) box(windows, x0 + w * i / divisions,
      (y0 + y1 - (curved ? w / 2 : 0)) / 2, depth + .08, .06,
      y1 - y0 - (curved ? w / 2 : 0), .14, M.frame);
    box(windows, x, y0 + (y1 - y0) * .68, depth + .08, w, .06, .14, M.frame);
    if (!deferNear) {
      for (let i = 0; i < ring.length; i++) {
        const u = ring[i], v = ring[(i + 1) % ring.length];
        const dx = v[0] - u[0], dy = v[1] - u[1], length = Math.hypot(dx, dy);
        panels.quad(windows, M.trim, [point(...u), point(...v), point(...v, depth), point(...u, depth)],
          [t[0] * -dy / length, dx / length, t[1] * -dy / length]);
      }
    }
    const probe = {outside: point(x + w * .113, y0 + (y1 - y0) * .39, 1),
      center: point(x + w * .113, y0 + (y1 - y0) * .39, depth), normal: [n[0], 0, n[1]]};
    probes.push(probe); if (door) doors.push(probe);
    return ring;
  };
  const column = (x, low, high, depth, radius, round = true) => {
    if (!deferNear && round) B.cylinder(entrance, point(x, low, depth), point(x, high, depth),
      radius, radius * .94, M.trim, 16);
    if (!round) box(entrance, x, (low + high) / 2, depth, radius * 2, high - low, radius * 2);
    for (const y of [low + .1, high - .12]) box(entrance, x, y, depth, radius * 2.45, .2, radius * 2.45);
  };
  const archTrim = (x, w, spring, thickness, depth = .12, rise = w / 2) => {
    if (deferNear) return;
    const r = w / 2, ring = [];
    for (let i = 0; i <= 24; i++) ring.push([x + (r + thickness) * Math.cos(i * Math.PI / 24),
      spring + (rise + thickness) * Math.sin(i * Math.PI / 24)]);
    for (let i = 24; i >= 0; i--) ring.push([x + r * Math.cos(i * Math.PI / 24),
      spring + rise * Math.sin(i * Math.PI / 24)]);
    const geometry = new THREE.ExtrudeGeometry(new THREE.Shape(ring.map(p => new THREE.Vector2(...p))),
      {depth: .3, bevelEnabled: false, curveSegments: 1});
    const position = geometry.attributes.position;
    for (let i = 0; i < position.count; i++) position.setXYZ(i,
      ...point(position.getX(i), position.getY(i), depth + position.getZ(i)));
    if (reverse) {
      for (let i = 0; i < position.count; i += 3) {
        const p = [position.getX(i + 1), position.getY(i + 1), position.getZ(i + 1)];
        position.setXYZ(i + 1, position.getX(i + 2), position.getY(i + 2), position.getZ(i + 2));
        position.setXYZ(i + 2, ...p);
      }
      geometry.deleteAttribute('normal'); geometry.computeVertexNormals();
    } else geometry.computeVertexNormals();
    B.worldUV(geometry, M.trim); B.add(entrance, geometry, M.trim);
  };
  const frontHoles = [];
  const central = x => Math.abs(x - mid) < width / 2 + 1;
  const storey = height / floors;
  const wingWindows = (grouped = false) => {
    const count = Math.max(2, Math.floor(L / (grouped ? 9 : 5)));
    for (let level = 0; level < floors; level++) for (let i = 0; i < count; i++) {
      const x = (i + .5) * L / count;
      if (central(x) || style === 'masonry-portal' && Math.abs(x - mid) < width / 2 + 3) continue;
      for (const offset of grouped ? [-1.6, 0, 1.6] : [0]) {
        const w = grouped ? 1.2 : Math.min(2.6, L / count * .55);
        frontHoles.push(opening(x + offset, w, base + level * storey + .8,
          base + (level + 1) * storey - .55));
      }
    }
  };
  const landing = base + (style === 'loggia' ? .65 : .45);
  wingWindows(style === 'civic-colonnade');
  if (style === 'loggia') {
    const bay = width / 3, spring = roofY - .8 - bay / 2;
    const backHoles = [], lowerTop = base + height * .43, balcony = base + height * .49;
    for (let i = 0; i < 3; i++) {
      const x = mid + (i - 1) * bay, w = bay - .5;
      frontHoles.push(arch(x - w / 2, x + w / 2, landing, spring));
      backHoles.push(opening(x, w * .79, landing, lowerTop, {door: true, depth: -1.55}));
      backHoles.push(opening(x, w * .79, balcony + .45, spring + .2, {depth: -1.55}));
      archTrim(x, w, spring, .26);
      box(entrance, x, balcony, -.58, bay - .35, .28, 1.7);
      box(entrance, x, balcony + .82, .13, bay - .35, .12, .16);
      for (let j = 1; j <= 7; j++) box(entrance, x - bay / 2 + j * bay / 8,
        balcony + .44, .13, .065, .7, .09);
    }
    perforated(rect(mid - width / 2 - .3, mid + width / 2 + .3, landing, roofY), backHoles, -1.55, M.trim);
    for (let i = 0; i <= 3; i++) column(mid + (i - 1.5) * bay, landing, spring, .1, .22);
  } else if (style === 'masonry-portal') {
    const bay = width / 3;
    for (let i = 0; i < 3; i++) {
      const x = mid + (i - 1) * bay, w = bay * .68;
      frontHoles.push(opening(x, w, landing, base + height * .22, {door: true}));
      frontHoles.push(opening(x, w, base + height * .34, base + height * .57, {curved: true}));
      archTrim(x, w, base + height * .57 - w / 2, .28);
      for (const level of [2, 3]) frontHoles.push(opening(x, w, base + level * storey + .7,
        base + (level + 1) * storey - .65));
      box(entrance, x, base + height * .29, .08, w + .16, .6, .25);
    }
    for (let i = 0; i <= 3; i++) column(mid + (i - 1.5) * bay, landing, base + height * .45, .08, .22, false);
    for (const side of [-1, 1]) for (let level = 0; level < floors; level++) {
      frontHoles.push(opening(mid + side * (width / 2 + .9), 1.05,
        base + level * storey + 1, base + level * storey + 2.5));
    }
  } else if (style === 'civic-colonnade') {
    const split = base + height * .52;
    frontHoles.push(opening(mid, width * .7, landing, split - 1, {door: true, depth: -1.45, divisions: 6}));
    frontHoles.push(opening(mid, width * .76, split + .8, roofY - .75, {depth: -.65, divisions: 7}));
    for (const fraction of [-.49, -.245, .245, .49]) column(mid + L * fraction, landing, split, .7, .52);
    for (const side of [-1, 1]) column(mid + side * width * .43, split + .8, roofY - .75, .15, .48);
    box(entrance, mid, split, .4, L, .48, 2.1);
    archTrim(mid, width * .65, split - 1.1, .25, -.2, .75);
    const rise = profile.roofFeatureRise, span = width * 1.5;
    for (const fraction of [-.5, -1 / 6, 1 / 6, .5]) box(roof, mid + span * fraction,
      roofY + rise * .32, -1.1, .36, rise * .64, .5);
    box(roof, mid, roofY + rise * .64, -1.1, span + .36, .34, .6);
    if (!deferNear) {
      const points = [], indices = [], segments = 28;
      for (let i = 0; i <= segments; i++) for (const depth of [-2, -6]) {
        points.push(...point(mid + (i / segments - .5) * span * .9,
          roofY + rise * (.1 + .9 * Math.sin(Math.PI * i / segments)), depth));
      }
      for (let i = 0; i < segments; i++) indices.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
      geometry.setAttribute('uv', new THREE.Float32BufferAttribute(points.flatMap((_, i) => i % 3 ? [] : [points[i] / 4, points[i + 2] / 4]), 2));
      geometry.setIndex(!reverse ? indices.map((_, i) => indices[i - i % 3 + (2 - i % 3)]) : indices);
      geometry.computeVertexNormals(); B.worldUV(geometry, M.roof); B.add(roof, geometry, M.roof);
    }
  } else {
    const canopyY = base + (style === 'square-canopy' ? Math.min(4.5, height * .43) : Math.min(3.55, height * .77));
    for (let i = 0; i < 3; i++) frontHoles.push(opening(mid + (i - 1) * width / 3,
      width / 3 - .5, landing, canopyY - .24, {door: true, depth: -.8, divisions: 3}));
    for (let level = 1; level < floors; level++) {
      const low = Math.max(canopyY + .6, base + level * storey + .7);
      const high = base + (level + 1) * storey - .5;
      if (high > low + .3) frontHoles.push(opening(mid, width, low, high, {divisions: 8}));
    }
    box(entrance, mid, canopyY, 1.1, width + 4, .55, 4);
    if (style === 'square-canopy') for (const side of [-1, 1]) column(mid + side * (width / 2 + .65),
      landing, canopyY - .27, 1.65, .34, false);
  }
  perforated(rect(0, L, base, roofY), frontHoles, 0, wall);
  for (let i = 0; i < 5; i++) box(entrance, mid, bottom + (landing - bottom) * (i + .5) / 5,
    1.85 - i * .29, width + 2 - i * .24, (landing - bottom) / 5, 3.8 - i * .58);
  for (const side of [-1, 1]) box(entrance, mid + side * (width / 2 + 1.1),
    (bottom + landing + .35) / 2, 1.1, .55, landing + .35 - bottom, 3);
  if (['loggia', 'masonry-portal'].includes(style)) {
    box(roof, mid, roofY - .22, .45, L + .5, .28, 1.6);
    for (let i = 0; i <= Math.floor(L / 1.4); i++) box(roof, L * i / Math.floor(L / 1.4),
      roofY - .55, .4, .14, .4, 1.4);
  }
  const corners = [-1, 1].flatMap(side => [point(mid + side * (width / 2 + 2.5), bottom, -.5),
    point(mid + side * (width / 2 + 2.5), Math.min(spec.top, roofY + .3), 4)]);
  const bounds = new THREE.Box3().setFromPoints(corners.map(p => new THREE.Vector3(...p)));
  const sampleOpening = openings.find(o => o.depth === -.32 && Math.abs((o.ring[0][0] + o.ring[1][0]) / 2 - mid) > width / 2 + 1);
  return {
    windowProbes: probes.filter(probe => !doors.includes(probe)), doorProbes: doors,
    sample: sampleOpening ? {glazing: point((sampleOpening.ring[0][0] + sampleOpening.ring[1][0]) / 2 + .15,
      sampleOpening.ring[0][1] + .3, -.32),
    masonry: point(.25, base + height * .73)} : null,
    metadata: {...profile.facade, openingProbes: probes, doorwayCount: doors.length,
      bounds: {min: bounds.min.toArray(), max: bounds.max.toArray()},
      viewDirection: [n[0] * 1.1 - t[0] * .12, .42, n[1] * 1.1 - t[1] * .12]},
    entrancePoint: point(mid, landing),
  };
}
