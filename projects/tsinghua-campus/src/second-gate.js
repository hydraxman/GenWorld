import * as THREE from 'three';
import {FontLoader} from 'three/addons/loaders/FontLoader.js';
import inscriptionData from './second-gate-wenkai.json' with {type: 'json'};

export const SECOND_GATE_ID = 'landmark:osm:node:941370305';
export const SECOND_GATE_ANCHOR = Object.freeze([116.3182903, 39.9997127]);

// Photo-proportional LOCAL meters; no projection, campus identity or attachment.
const FRONT = 'projects/tsinghua-campus/references/second-gate-modern-complete.jpg';
const OBLIQUE = 'projects/tsinghua-campus/references/second-gate-gallery-b.jpg';
const FRONT_PAGE = 'https://xsg.tsinghua.edu.cn/info/1003/3153.htm';
const GALLERY_PAGE = 'https://www.tsinghua.edu.cn/info/1183/94394.htm';
const FRONT_IMAGE = 'https://xsg.tsinghua.edu.cn/__local/9/E9/9F/95C7625C7EEB88D4E0FAEEFB833_EB0EC5BE_270574.jpg';
const GALLERY_IMAGE = 'https://www.tsinghua.edu.cn/__local/1/63/BE/E6DAC008600170338C51AF67AA2_A30DA786_A857B.jpg';

function add(group, geometry, material, name, x = 0, y = 0, z = 0, role) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.position.set(x, y, z);
  mesh.castShadow = mesh.receiveShadow = true;
  if (role) mesh.userData.architecturalRole = role;
  group.add(mesh);
  return mesh;
}

function box(group, material, name, w, h, d, x, y, z = 0) {
  return add(group, new THREE.BoxGeometry(w, h, d), material, name, x, y, z);
}

function polygon(points) {
  const shape = new THREE.Shape(points.map(p => new THREE.Vector2(...p)));
  shape.closePath();
  return shape;
}

function rectangle(w, bottom, top) {
  return polygon([[-w / 2, bottom], [w / 2, bottom], [w / 2, top], [-w / 2, top]]);
}

function extrude(shape, depth) {
  const geometry = new THREE.ExtrudeGeometry(shape, {depth, steps: 1, bevelEnabled: false, curveSegments: 32});
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

function field(radius, spring, top, halfWidth) {
  const shape = new THREE.Shape();
  shape.moveTo(-halfWidth, spring);
  shape.lineTo(-radius, spring);
  shape.absarc(0, spring, radius, Math.PI, 0, true);
  shape.lineTo(halfWidth, spring);
  shape.lineTo(halfWidth, top);
  shape.lineTo(-halfWidth, top);
  shape.closePath();
  return shape;
}

function archBand(inner, outer, spring) {
  const shape = new THREE.Shape();
  shape.moveTo(outer, spring);
  shape.absarc(0, spring, outer, 0, Math.PI, false);
  shape.lineTo(-inner, spring);
  shape.absarc(0, spring, inner, Math.PI, 0, true);
  shape.closePath();
  return shape;
}

// Thin 2D relief strip, not a round tube sticking forward from the facade.
function ribbon(group, material, name, points, width, z, depth = 0.012) {
  const left = [], right = [];
  points.forEach(([x, y], i) => {
    const before = points[Math.max(0, i - 1)], after = points[Math.min(points.length - 1, i + 1)];
    const length = Math.hypot(after[0] - before[0], after[1] - before[1]);
    const nx = -(after[1] - before[1]) / length * width / 2;
    const ny = (after[0] - before[0]) / length * width / 2;
    left.push([x + nx, y + ny]);
    right.push([x - nx, y - ny]);
  });
  return add(group, extrude(polygon([...left, ...right.reverse()]), depth), material, name, 0, 0, z);
}

function materials() {
  const colors = {
    plaster: '#f4f3ef', trim: '#fcfcfa', corniceShadow: '#d6d6d3',
    mortar: '#bfc0ba', brick: '#91938e', brickLight: '#a0a09a', brickDark: '#828783',
    stone: '#c2c0b8', stoneAggregate: '#c2c0b8', inscription: '#252421', pole: '#879798',
  };
  return Object.fromEntries(Object.entries(colors).map(([name, color]) => {
    const material = new THREE.MeshStandardMaterial({
      color, roughness: name === 'pole' ? 0.48 : 0.97,
      metalness: name === 'pole' ? 0.55 : 0, vertexColors: false,
    });
    material.name = `second-gate:${name}`;
    return [name, material];
  }));
}

function masonry(group, m) {
  const batches = [[], [], []];
  const courses = (width, bottom, top, center, face, end = false) => {
    for (let row = 0; bottom + (row + 1) * 0.13 < top; row++) {
      for (let col = -1; col <= Math.ceil(width / 0.34); col++) {
        const left = Math.max(-width / 2, -width / 2 + col * 0.34 + (row % 2) * 0.17);
        const right = Math.min(width / 2, -width / 2 + (col + 1) * 0.34 + (row % 2) * 0.17);
        if (right - left < 0.025) continue;
        const run = (left + right) / 2, y = bottom + row * 0.13 + 0.065;
        batches[(row * 7 + col + 9) % 3].push({
          p: end ? [center, y, run] : [center + run, y, face * 0.708],
          scale: [right - left - 0.010, 0.119, 0.020], rotation: end ? Math.PI / 2 : 0,
        });
      }
    }
  };
  for (const x of [-3.075, 3.075, -6.67, 6.67]) {
    const inner = Math.abs(x) < 4;
    const w = inner ? 2.45 : 0.76, h = inner ? 7.94 : 4.38;
    box(group, m.mortar, 'grey masonry pier core', w, h, 1.4, x, h / 2);
    for (const face of [-1, 1]) courses(w, 0.22, h, x, face);
  }
  for (const x of [-7.057, 7.057]) courses(1.4, 0.22, 4.38, x, 0, true);
  batches.forEach((placements, i) => {
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1),
      [m.brick, m.brickLight, m.brickDark][i], placements.length);
    mesh.name = 'light desaturated grey brick courses';
    const matrix = new THREE.Matrix4();
    placements.forEach(({p, scale, rotation}, index) => mesh.setMatrixAt(index,
      matrix.compose(new THREE.Vector3(...p),
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotation),
        new THREE.Vector3(...scale))));
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.instanceMatrix.needsUpdate = true;
    group.add(mesh);
  });
}

function stonePanel(w, h) {
  // Uniform stone albedo: do not encode grain in interpolated vertex colors.
  // The former modular brightness field repeated diagonally over 0.39x0.642 m.
  // Instead use ~2 cm facets with <=0.4 mm total relief and flat edge vertices.
  const columns = Math.ceil(w / 0.02), rows = Math.ceil(h / 0.02);
  const geometry = new THREE.PlaneGeometry(w, h, columns, rows);
  const position = geometry.getAttribute('position');
  for (let i = 0; i < position.count; i++) {
    const x = i % (columns + 1), y = Math.floor(i / (columns + 1));
    if (x === 0 || x === columns || y === 0 || y === rows) continue;
    let seed = Math.imul(x ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(y ^ 0xc2b2ae35, 0x27d4eb2d);
    seed = Math.imul(seed ^ (seed >>> 16), 0x7feb352d);
    seed = Math.imul(seed ^ (seed >>> 15), 0x846ca68b);
    seed = (seed ^ (seed >>> 16)) >>> 0;
    position.setZ(i, (seed / 0xffffffff - 0.5) * 0.0004);
  }
  geometry.computeVertexNormals();
  return geometry;
}

function pedestals(group, m) {
  for (const side of [-1, 1]) {
    const base = new THREE.Group();
    base.name = 'massive raised stone pedestal with recessed block panel';
    base.position.x = side * 3.1;
    base.userData.architecturalRole = 'pedestal';
    // Cut the panel window through the core rather than overlaying its two
    // large box-face triangles with a second surface only 15 mm in front.
    const core = rectangle(2.08, 0, 1.78);
    core.holes.push(new THREE.Path(rectangle(1.56, 0.46, 1.56).getPoints()));
    add(base, extrude(core, 2.60), m.stone, 'pedestal core with real panel window');
    box(base, m.stone, 'pedestal stone foot', 2.08, 0.22, 2.90, 0, 0.11);
    box(base, m.stone, 'pedestal coping', 2.08, 0.10, 2.82, 0, 1.83);
    for (const face of [-1, 1]) {
      for (const x of [-0.91, 0.91]) box(base, m.stone, 'panel side block', 0.26, 1.30, 0.10,
        x, 1.0, face * 1.40);
      for (const [y, h] of [[0.32, 0.34], [1.64, 0.28]]) {
        box(base, m.stone, 'panel horizontal block', 2.08, h, 0.10, 0, y, face * 1.40);
      }
      const panel = add(base, stonePanel(1.56, 1.10), m.stoneAggregate,
        'coarse stone recessed panel', 0, 1.01, face * 1.30);
      if (face === -1) panel.rotation.y = Math.PI;
      // Preserve the existing body/rim caster policy and real received shadows.
      // This is not an albedo fix: the parent's shadow-disabled capture proved
      // the diagonal patches persisted independently of shadow-map sampling.
      panel.castShadow = false;
      for (const x of [-0.74, 0.74]) box(base, m.stone, 'inset thin vertical stone border',
        0.026, 1.01, 0.016, x, 1.01, face * 1.335);
      for (const y of [0.505, 1.515]) box(base, m.stone, 'inset thin horizontal stone border',
        1.50, 0.026, 0.016, 0, y, face * 1.335);
    }
    group.add(base);
  }
  for (const x of [-6.67, 6.67]) box(group, m.stone, 'outer pier stone foot', 0.76, 0.25, 1.7, x, 0.125);
}

function columns(group, m) {
  for (const side of [-1, 1]) for (const offset of [-0.45, 0.45]) for (const face of [-1, 1]) {
    const x = side * 3.1 + offset, z = face * 0.98;
    box(group, m.trim, 'column square foot', 0.76, 0.10, 0.76, x, 1.93, z);
    add(group, new THREE.CylinderGeometry(0.34, 0.36, 0.10, 40), m.trim, 'column base cushion', x, 2.02, z);
    const torus = add(group, new THREE.TorusGeometry(0.33, 0.028, 8, 40), m.trim,
      'column base torus', x, 2.075, z);
    torus.rotation.x = Math.PI / 2;
    add(group, new THREE.CylinderGeometry(0.29, 0.325, 4.56, 40), m.trim,
      'substantial white tapered round shaft', x, 4.34, z, 'column-shaft');
    add(group, new THREE.CylinderGeometry(0.32, 0.29, 0.11, 40), m.trim, 'necking', x, 6.675, z);
    add(group, new THREE.LatheGeometry([[0.31, 0], [0.32, 0.04], [0.36, 0.09],
      [0.39, 0.17], [0.40, 0.20]].map(p => new THREE.Vector2(...p)), 40),
    m.trim, 'curved capital', x, 6.73, z);
    box(group, m.trim, 'capital square abacus', 0.83, 0.10, 0.82, x, 6.95, z);
  }
}

function archWalls(group, m, arches) {
  for (const {id, centerX: x, radius: r, springY: spring} of arches) {
    const central = id === 'center', half = central ? 2.18 : 1.04, top = central ? 7.78 : 4.38;
    add(group, extrude(field(r, spring, top, half), 1.4), m.plaster, `${id} true cut-out arch wall`, x);
    add(group, extrude(archBand(r, r + (central ? 0.32 : 0.25), spring), 1.4),
      m.plaster, `${id} white full-depth soffit`, x);
    for (const face of [-1, 1]) {
      const surface = field(r, spring, top, half);
      if (central) for (const side of [-1, 1]) {
        const hole = polygon([[side * 1.98, 6.10], [side * 1.98, 6.67], [side * 0.90, 6.67]]);
        surface.holes.push(new THREE.Path(hole.getPoints()));
      }
      add(group, extrude(surface, 0.08), m.plaster, `${id} complete off-white plaster field`, x, 0, face * 0.745);
      for (const side of [-1, 1]) {
        box(group, m.plaster, `${id} white jamb`, half - r, spring, 1.40,
          x + side * (r + (half - r) / 2), spring / 2);
        box(group, m.trim, `${id} layered impost`, 0.38, 0.15, 0.18,
          x + side * (r + 0.19), spring, face * 0.795);
      }
      if (central) {
        for (const [inner, outer] of [[r, r + 0.044], [r + 0.105, r + 0.145], [r + 0.235, r + 0.270]]) {
          add(group, extrude(archBand(inner, outer, spring), 0.025), m.trim,
            'thin raised central archivolt track', x, 0, face * 0.799);
        }
        for (const side of [-1, 1]) ribbon(group, m.trim, 'triangular recessed spandrel frame', [
          [side * 2.10, 5.95], [side * 2.10, 6.78], [side * 0.64, 6.78], [side * 2.10, 5.95],
        ], 0.025, face * 0.800);
        const key = polygon([[-0.10, 6.30], [0.10, 6.30], [0.18, 6.80], [-0.18, 6.80]]);
        add(group, extrude(key, 0.11), m.trim, 'central decorative crown key', 0, 0, face * 0.819);
        const boss = add(group, new THREE.TorusGeometry(0.063, 0.012, 8, 32), m.trim,
          'keystone circular relief', 0, 6.65, face * 0.886);
        if (face === -1) boss.rotation.y = Math.PI;
        for (const groove of [-0.048, 0, 0.048]) {
          box(group, m.corniceShadow, 'key vertical groove', 0.012, 0.18, 0.006,
            groove, 6.45, face * 0.876);
        }
      } else {
        // Fan joints continue to the side beam/outer boundaries, not just an annular ring.
        for (const angle of [0.38, 0.90, 1.30, 1.84, 2.24, 2.76]) {
          const dx = Math.cos(angle), dy = Math.sin(angle);
          const length = Math.min(half / Math.abs(dx), (4.32 - spring) / dy);
          ribbon(group, m.corniceShadow, 'fan-shaped voussoir joint to side beam', [
            [x + r * dx, spring + r * dy], [x + length * dx, spring + length * dy],
          ], 0.016, face * 0.792, 0.007);
        }
        for (const side of [-1, 1]) for (let row = 0; row < 7; row++) {
          const w = row % 2 ? 0.42 : 0.38;
          box(group, m.trim, 'strong side layered quoin', w, 0.34, 0.13,
            x + side * (r + w / 2), 0.23 + row * 0.39, face * 0.815);
        }
      }
    }
  }
}

function cornices(group, m) {
  for (const side of [-1, 1]) {
    for (const [w, h, d, y] of [
      [2.15, 0.14, 2.55, 6.95], [2.36, 0.10, 2.72, 7.07],
      [2.46, 0.16, 2.80, 7.20], [2.34, 0.12, 2.68, 7.34],
    ]) box(group, m.trim, 'separate lower tower architrave', w, h, d, side * 3.1, y);
    // Exposed brick frieze at 7.40..7.91 separates lower and upper entablatures.
    for (const [w, h, d, y] of [
      [2.48, 0.12, 1.88, 7.97], [2.66, 0.14, 2.12, 8.10],
      [2.90, 0.13, 2.45, 8.235], [2.98, 0.12, 2.66, 8.36],
      [3.02, 0.18, 2.80, 8.51], [3.08, 0.10, 2.88, 8.65],
    ]) box(group, m.trim, 'projecting multi-tier tower cornice', w, h, d, side * 3.1, y);
    for (const [w, h, d, y] of [[2.70, 0.12, 1.65, 4.26],
      [2.82, 0.15, 1.82, 4.365], [2.87, 0.12, 1.94, 4.44]]) {
      box(group, m.trim, 'side cornice', w, h, d, side * 5.715, y);
    }
    for (const face of [-1, 1]) {
      const x = side * 6.67;
      box(group, m.trim, 'outer upper pier ornament panel', 0.54, 0.55, 0.10, x, 3.99, face * 0.785);
      for (const y of [3.69, 4.29]) box(group, m.trim, 'ornament stepped ledge', 0.74, 0.07, 0.20,
        x, y, face * 0.80);
      const roundel = add(group, new THREE.TorusGeometry(0.11, 0.012, 8, 32),
        m.trim, 'outer pier circular relief', x, 4.08, face * 0.847);
      if (face === -1) roundel.rotation.y = Math.PI;
      for (const offset of [-0.085, 0, 0.085]) box(group, m.corniceShadow, 'outer pier triglyph recess',
        0.016, 0.19, 0.006, x + offset, 3.87, face * 0.838);
      for (const offset of [-0.21, -0.07, 0.07, 0.21]) box(group, m.trim, 'outer pier dentil',
        0.10, 0.11, 0.16, x + offset, 3.60, face * 0.81);
    }
  }
  for (const [w, h, d, y] of [[4.08, 0.13, 1.66, 7.76], [4.18, 0.12, 1.79, 7.885],
    [4.30, 0.14, 1.95, 8.015], [4.38, 0.17, 2.07, 8.17], [4.42, 0.13, 2.13, 8.32]]) {
    box(group, m.trim, 'recessed central connector cornice', w, h, d, 0, y);
  }
}

function crest(group, m) {
  // The current gate has stepped RECTANGLES, emphatically no triangular pediment.
  box(group, m.plaster, 'flat central parapet', 4.75, 1.19, 1.40, 0, 8.985); // top 9.58
  box(group, m.trim, 'middle rectangular crest step', 2.30, 0.16, 1.40, 0, 9.66);
  box(group, m.trim, 'top rectangular crest step', 0.95, 0.15, 1.40, 0, 9.815);
  for (const side of [-1, 1]) {
    const x = side * 3.1;
    box(group, m.plaster, 'raised outer attic block', 1.20, 1.30, 1.50, x, 9.35);
    const panel = rectangle(1.18, 9.06, 9.98);
    for (const offset of [-0.065, 0, 0.065]) for (const [bottom, top] of [[9.13, 9.44], [9.56, 9.90]]) {
      panel.holes.push(new THREE.Path(rectangle(0.019, bottom, top).getPoints()
        .map(p => new THREE.Vector2(p.x + offset, p.y))));
    }
    for (const face of [-1, 1]) {
      add(group, extrude(panel, 0.045), m.trim, 'attic three actual recessed grooves', x, 0, face * 0.768);
      box(group, m.trim, 'attic fine transverse ledge', 1.24, 0.036, 1.63, x, 9.51);
      const circle = add(group, new THREE.TorusGeometry(0.10, 0.013, 8, 32), m.trim,
        'attic circular relief', x, 9.51, face * 0.812);
      if (face === -1) circle.rotation.y = Math.PI;
    }
  }
}

function shoulders(group, m) {
  const shape = new THREE.Shape();
  shape.moveTo(4.28, 4.50);
  shape.lineTo(6.96, 4.50);
  shape.lineTo(6.96, 4.70);
  shape.bezierCurveTo(5.75, 4.95, 4.62, 4.68, 4.30, 6.30);
  shape.lineTo(4.30, 7.00);
  shape.closePath();
  for (const side of [-1, 1]) {
    const wall = add(group, extrude(shape, 1.4), m.plaster, 'shallow curved shoulder wall');
    if (side === -1) wall.rotation.y = Math.PI;
    for (const face of [-1, 1]) {
      const discShape = new THREE.Shape();
      discShape.absellipse(0, 0, 0.46, 0.33, 0, Math.PI * 2, false, 0);
      add(group, extrude(discShape, 0.10), m.plaster, 'broad flattened volute disc',
        side * 6.56, 4.98, face * 0.72, 'volute-disc');
      const spiral = [];
      for (let i = 0; i <= 70; i++) {
        const t = i / 70, a = t * Math.PI * 3.55, r = 0.38 * (1 - t) + 0.028;
        spiral.push([side * (6.56 + Math.cos(a) * r), 4.98 + Math.sin(a) * r * 0.66]);
      }
      ribbon(group, m.trim, 'flat spiral scroll relief', spiral, 0.031, face * 0.784, 0.015);
      // Omit the former diagonal seam: its upper end exceeded this curved
      // plaster profile. A source division line is not license to add a
      // freestanding strip; retain the supported shoulder and scroll relief.
    }
  }
}

function inscription(group, m) {
  const font = new FontLoader().parse(structuredClone(inscriptionData));
  const glyphs = [...'園華清'].map((character, index) => {
    const shapes = font.generateShapes(character, 1);
    const geometry = new THREE.ExtrudeGeometry(shapes, {depth: 0.012, bevelEnabled: false, curveSegments: 10});
    geometry.computeBoundingBox();
    const size = geometry.boundingBox.getSize(new THREE.Vector3()), center = geometry.boundingBox.getCenter(new THREE.Vector3());
    geometry.translate(-center.x, -center.y, 0);
    geometry.scale([0.46, 0.48, 0.42][index] / size.x, 0.59 / size.y, 1);
    return {character, geometry, outlineCount: shapes.length,
      counterCount: shapes.reduce((sum, shape) => sum + shape.holes.length, 0)};
  });
  for (const face of [-1, 1]) {
    const frame = rectangle(3.78, 6.81, 7.65);
    frame.holes.push(new THREE.Path(rectangle(3.63, 6.88, 7.58).getPoints()));
    add(group, extrude(frame, 0.07), m.trim, 'recessed inscription panel border',
      0, 0, face * 0.835);
    box(group, m.plaster, 'white recessed inscription field', 3.63, 0.70, 0.014, 0, 7.23, face * 0.824);
    for (const x of [-0.54, 0.54]) box(group, m.corniceShadow, 'faint vertical inscription seam',
      0.006, 0.67, 0.005, x, 7.23, face * 0.833);
    const text = new THREE.Group();
    text.name = face === 1 ? 'south readable 清華園' : 'north inferred readable 清華園';
    text.position.set(0, 7.23, face * 0.838);
    text.rotation.y = face === 1 ? 0 : Math.PI;
    text.userData = {
      role: 'vector-inscription', face: face === 1 ? 'south' : 'north', text: '清華園',
      visibleLeftToRight: '園華清', readingDirection: 'right-to-left',
      fontSource: 'OFL LXGW WenKai Regular v1.522; coherent three-glyph Kai approximation',
      calligraphyNote: '園華清统一采用霞鹜文楷真实字体矢量轮廓；仅为楷书/毛笔风格近似，不是那桐原题字描摹；北面推定。',
      unknownSmallTextOmitted: true, northFaceInferred: face === -1,
    };
    glyphs.forEach((glyph, i) => {
      const mesh = add(text, glyph.geometry, m.inscription, `vector glyph ${glyph.character}`, (i - 1) * 1.08);
      mesh.userData = {character: glyph.character, outlineCount: glyph.outlineCount, counterCount: glyph.counterCount,
        fontSource: 'LXGW WenKai Regular v1.522'};
    });
    // Small geometric panel pin heads only; no invented signature/date characters.
    for (const x of [-1.72, -0.56, 0.56, 1.72]) for (const y of [6.925, 7.535]) {
      add(group, new THREE.SphereGeometry(0.009, 8, 6), m.corniceShadow,
        'small inscription panel fastener', x, y, face * 0.839);
    }
    group.add(text);
  }
}

function pole(gate, m) {
  const group = new THREE.Group();
  group.name = 'slender pole behind central crest, including round finial';
  group.userData.architecturalRole = 'pole-assembly';
  add(group, new THREE.CylinderGeometry(0.018, 0.035, 4.30, 16), m.pole,
    'pole shaft', 0, 11.70, -0.30);
  add(group, new THREE.SphereGeometry(0.08, 20, 12), m.pole,
    'round pole finial', 0, 13.92, -0.30);
  gate.add(group);
}

/** Unattached local geometry; parent owns stable identity, placement and export. */
export function createSecondGateModel() {
  const gate = new THREE.Group(), facade = new THREE.Group(), m = materials();
  gate.name = '清华二校门 · current-photo corrected reconstruction';
  facade.name = 'current freestanding gate facade (pole excluded)';
  facade.userData.architecturalRole = 'facade';
  gate.userData = {
    referenceSite: 'second-gate', units: 'meters', localAxes: '+X east / -X west, Y up, +Z south/front',
    structuralHeight: 10, overallWithPole: 14, renderHeight: 14,
    estimatedDimensions: {width: 14.3, height: 14, structuralHeight: 10, overallWithPole: 14,
      wallDepth: 1.4, overallDepth: 2.9},
    heightSource: 'modern front-photo proportional estimated dimensions / 照片比例估测: structural 10m, including pole 14m; not surveyed',
    refinementSummary: '二校门按完整现代正面照片重建：三座真实通拱、粗白双柱及高石台、分层折线塔檐与灰砖楣带、平顶三级矩形冠、扁卷涡和薄拱饰；含后置圆顶细杆，总高估测14米；非西校门。',
    localReference: FRONT, referencePages: [FRONT_PAGE, GALLERY_PAGE,
      'https://www.tsinghua.edu.cn/zjqh/xyfg/xyjg.htm', 'https://www.tsinghua.edu.cn/info/2116/81037.htm'],
    referenceImages: [FRONT_IMAGE, GALLERY_IMAGE],
    referenceEvidence: [
      {localPath: FRONT, period: 'modern', primary: true, viewed: true, photographer: '贾珺',
        authoritativeForCurrentAppearance: true, use: 'Complete straight-front proportions and current architecture.'},
      {localPath: OBLIQUE, period: 'modern', viewed: true, authoritativeForCurrentAppearance: true,
        use: 'Complete current low-oblique view: cornice projection, base, crest and flattened scroll relief.'},
      {localPath: 'projects/tsinghua-campus/references/second-gate-front-official.jpg',
        period: 'historical', viewed: true, authoritativeForCurrentAppearance: false,
        use: 'Historical context only; NOT used to infer available modern front geometry.',
        shortWallRemnantsTransferred: false},
    ],
    anchorSource: {nodeId: 941370305, version: 5, verifiedBy: 'parent',
      coordinatesMatch: true, frozenBuildingFootprint: false,
      placementContract: 'Standalone landmark; parent owns landmarks/objects Map registration.'},
    history: {destroyedYear: 1966, rebuiltYear: 1991, shortWallsRemovedPeriod: '1950s',
      sourcePage: 'https://www.tsinghua.edu.cn/info/2116/81037.htm', verifiedBy: 'parent'},
    photoProportions: {
      primaryImage: FRONT, nativePixels: [3264, 2448],
      method: 'Approximate manually read front-image landmarks; not a survey or calibrated orthophoto.',
      landmarksPixels: {facadeLeft: 610, facadeRight: 2562, atticTop: 658, estimatedGround: 2024,
        centralLeft: 1335, centralRight: 1839, centralCrown: 1170, centralSpring: 1415,
        sideClearWidth: 181, sideCrown: 1570, shaftDiameter: 82, finialTop: 153},
      targets: {facadeWidthOverHeight: 1.43, centralWidthOverFacade: 0.259, sideWidthOverCentral: 0.35,
        centralCrownOverHeight: 0.625, centralSpringOverHeight: 0.445, sideCrownOverHeight: 0.33,
        shaftDiameterOverCentral: 0.16, pedestalHeightOverHeight: 0.18, exposedPoleOverHeight: 0.37},
      tolerances: {facadeWidthOverHeight: 0.05, centralWidthOverFacade: 0.025, sideWidthOverCentral: 0.06,
        centralCrownOverHeight: 0.035, centralSpringOverHeight: 0.035, sideCrownOverHeight: 0.035,
        shaftDiameterOverCentral: 0.025, pedestalHeightOverHeight: 0.035, exposedPoleOverHeight: 0.05},
      occlusionNote: 'Feet partly hidden by planters; pedestal target is an estimated 0.15–0.22 envelope, selected 0.18.',
    },
    reconstructionLimitations: [
      'Absolute scale, depth and hidden/back details remain estimated, not surveyed.',
      'Modern complete front/oblique images override earlier cropped/historical shape guesses; no triangular pediment or old walls.',
      'All three glyphs use LXGW WenKai Regular v1.522 as one coherent Kai/brush approximation, not 那桐 tracing.',
      'Unknown small signature/date lettering omitted; north decoration/text is symmetric inference.',
    ],
    archApertures: [
      {id: 'center', centerX: 0, radius: 1.85, springY: 4.45},
      {id: 'west', centerX: -5.33, radius: 0.65, springY: 2.68},
      {id: 'east', centerX: 5.33, radius: 0.65, springY: 2.68},
    ].map(arch => ({...arch, width: arch.radius * 2, groundY: 0, crownY: arch.springY + arch.radius,
      depthRange: [-0.7, 0.7], shape: 'semicircular', through: true})),
  };
  masonry(facade, m);
  pedestals(facade, m);
  columns(facade, m);
  archWalls(facade, m, gate.userData.archApertures);
  cornices(facade, m);
  crest(facade, m);
  shoulders(facade, m);
  inscription(facade, m);
  gate.add(facade);
  pole(gate, m);
  return gate;
}
