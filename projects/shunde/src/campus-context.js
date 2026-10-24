import {createBuilder} from './builder.js';
import {FOOTPRINT} from './footprint.js';

export function insideFootprint([x, z], points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i], b = points[j];
    if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

export function createCampusContext(THREE, data, {textured = true} = {}) {
  if (!data.buildings?.length || !data.roads?.length) throw new Error('Campus context requires frozen building and road geometry.');
  const group = new THREE.Group();
  group.name = 'Map-grounded campus context - inferred elevations and materials';
  group.userData = {source: data.sourceUrl, license: data.license, limitations: data.limitations};
  const B = createBuilder(THREE, 7429);
  const {box} = B;
  const material = (name, color, roughness = .9, metalness = 0) =>
    new THREE.MeshStandardMaterial({name, color, roughness, metalness});
  const tile = textured ? B.pbr('Context pale masonry estimate', 'square-grid', [175, 169, 152], [2.1, 2.1], 256)
    : material('Context pale masonry estimate', '#b0a997');
  tile.normalScale?.set(.08, .08);
  const brick = textured ? B.pbr('OSM brick material', 'brick', [141, 99, 78], [2, 2], 256)
    : material('OSM brick material', '#8d634e');
  const glass = material('Context reflective glazing', '#799099', .25, .35);
  const frame = material('Context window frames', '#c5c2b6', .65, .2);
  const roof = material('Context roof estimate', '#91918a');
  const road = material('Campus asphalt estimate', '#686f70');
  const walk = material('Campus walking paving estimate', '#b0b2a6');
  let windowCount = 0;
  const architecture = new THREE.Group();
  architecture.name = 'OSM neighboring building footprints';
  group.add(architecture);
  for (const building of data.buildings) {
    const block = new THREE.Group();
    block.name = building.name || `OSM building ${building.id}`;
    block.userData = {osmWay: building.id, heightStatus: building.heightStatus,
      facadeStatus: 'generic contextual openings, not a photo-reconstructed facade'};
    architecture.add(block);
    const points = building.points, height = building.height;
    if (!(height > 0 && height < 200) || points.length < 3) throw new Error(`Invalid campus block ${building.id}`);
    const wall = building.tags['building:material'] === 'brick' ? brick : tile;
    const shape = new THREE.Shape(points.map(([x, z]) => new THREE.Vector2(x, -z)));
    const geometry = new THREE.ExtrudeGeometry(shape, {depth: height, bevelEnabled: false, curveSegments: 1});
    geometry.rotateX(-Math.PI / 2);
    B.worldUV(geometry, wall);
    B.add(block, geometry, wall);
    const cap = new THREE.ShapeGeometry(shape);
    cap.rotateX(-Math.PI / 2);
    cap.translate(0, height + .012, 0);
    B.add(block, cap, roof);
    const area = points.reduce((sum, a, i) => {
      const b = points[(i + 1) % points.length];
      return sum + a[0] * b[1] - b[0] * a[1];
    }, 0);
    for (let edge = 0; edge < points.length; edge++) {
      const a = points[edge], b = points[(edge + 1) % points.length];
      const dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
      if (length < .01) continue;
      const angle = -Math.atan2(dz, dx);
      const normal = [dz / length * Math.sign(area), -dx / length * Math.sign(area)];
      box(block, 'roof parapet', (a[0] + b[0]) / 2, height + .17, (a[1] + b[1]) / 2,
        length + .1, .34, .22, wall, angle);
      const bays = Math.floor(length / 4.5);
      for (let bay = 0; bay < bays; bay++) {
        const u = (bay + .5) / bays;
        const x = a[0] + dx * u + normal[0] * .055;
        const z = a[1] + dz * u + normal[1] * .055;
        for (let y = 2.7; y < height - 1.2; y += 3.6) {
          box(block, 'context glazing', x, y, z, Math.min(2.9, length / bays - .8), 1.8, .045, glass, angle);
          box(block, 'context mullion', x + normal[0] * .03, y, z + normal[1] * .03, .065, 1.84, .08, frame, angle);
          box(block, 'context sill', x, y - .93, z, 3.0, .095, .2, frame, angle);
          windowCount++;
        }
      }
    }
  }
  const routes = new THREE.Group();
  routes.name = 'Map-grounded campus paths and roads - widths estimated';
  group.add(routes);
  const roadside = [];
  for (const path of data.roads) {
    const pedestrian = ['footway', 'path', 'pedestrian', 'cycleway'].includes(path.kind);
    if (path.area) {
      const shape = new THREE.Shape(path.points.map(([x, z]) => new THREE.Vector2(x, -z)));
      const pavement = new THREE.ShapeGeometry(shape);
      pavement.rotateX(-Math.PI / 2);
      pavement.translate(0, .007, 0);
      B.add(routes, pavement, walk);
      continue;
    }
    const width = pedestrian ? 2.2 : ['service', 'living_street'].includes(path.kind) ? 5 : 8;
    for (let i = 0; i < path.points.length - 1; i++) {
      const a = path.points[i], b = path.points[i + 1], dx = b[0] - a[0], dz = b[1] - a[1];
      const length = Math.hypot(dx, dz);
      if (length < .01) continue;
      box(routes, 'continuous road', (a[0] + b[0]) / 2, -.012, (a[1] + b[1]) / 2,
        length + .1, .038, width, pedestrian ? walk : road, -Math.atan2(dz, dx));
      if (!pedestrian && length > 15) {
        for (let d = 9; d < length; d += 19) for (const side of [-1, 1]) {
          const offset = side * (width / 2 + 3.5);
          roadside.push([a[0] + dx * d / length - dz / length * offset,
            a[1] + dz * d / length + dx / length * offset]);
        }
      }
    }
  }
  const allFootprints = [FOOTPRINT, ...data.buildings.map(b => b.points)];
  const treeSites = [];
  for (const [x, z] of [...data.trees, ...roadside]) {
    if (Math.hypot(x, z) > 380 || (x > -54 && x < 39 && z > -42 && z < -4)) continue;
    if (allFootprints.some(p => [[x, z], [x - 3, z], [x + 3, z], [x, z - 3], [x, z + 3]].some(v => insideFootprint(v, p)))) continue;
    if (treeSites.some(p => Math.hypot(p[0] - x, p[1] - z) < 8)) continue;
    treeSites.push([x, z]);
  }
  const crownGeometry = new THREE.IcosahedronGeometry(1, 1);
  const positions = crownGeometry.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
    const r = 1 + .16 * Math.sin(x * 19 + y * 23 + z * 17);
    positions.setXYZ(i, x * r, y * r, z * r);
  }
  crownGeometry.computeVertexNormals();
  const crowns = new THREE.InstancedMesh(crownGeometry, material('Context canopy clusters', '#66764a'), treeSites.length * 14);
  crowns.name = 'Campus trees - mapped points plus illustrative roadside planting';
  crowns.castShadow = true;
  crowns.receiveShadow = true;
  const bark = material('Context tree bark', '#746c58');
  const dummy = new THREE.Object3D(), color = new THREE.Color();
  let instance = 0;
  for (const [x, z] of treeSites) {
    const height = 6 + B.rand() * 4;
    B.cylinder(group, [x, 0, z], [x, height - 1, z], .19, .08, bark, 6);
    for (let c = 0; c < 14; c++) {
      const a = B.rand() * Math.PI * 2, r = Math.sqrt(B.rand()) * 2.1;
      dummy.position.set(x + Math.cos(a) * r, height - 1 + B.rand() * 2.5, z + Math.sin(a) * r);
      dummy.rotation.set(B.rand(), B.rand() * 6, B.rand());
      dummy.scale.set(1.1 + B.rand(), 1 + B.rand() * .7, 1.1 + B.rand());
      dummy.updateMatrix();
      crowns.setMatrixAt(instance, dummy.matrix);
      color.setHSL(.22 + B.rand() * .065, .2 + B.rand() * .16, .18 + B.rand() * .10);
      crowns.setColorAt(instance++, color);
    }
  }
  crowns.instanceMatrix.needsUpdate = true;
  if (crowns.instanceColor) crowns.instanceColor.needsUpdate = true;
  group.add(crowns);
  B.finish();
  group.updateMatrixWorld(true);
  return {group, architecture, treeSites,
    stats: {buildings: data.buildings.length, roads: new Set(data.roads.map(r => r.id)).size,
      roadSegments: data.roads.length, trees: treeSites.length, windows: windowCount}};
}
