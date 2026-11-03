import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import polygonClipping from 'polygon-clipping';
import {footprintMetrics, pointInPolygon, segmentDistance} from './geo.js';

const CELL = 230, CITY_HALF = CELL * 15.5, TREE_LIMIT = 2200;
const STREETS = Array.from({length: 32}, (_, i) => (i - 15.5) * CELL + Math.sin(i * 1.7) * 22);
const GROUND_Y = -.4;
const rectangle = (x, z, width, depth) => [[
  [x - width / 2, z - depth / 2], [x + width / 2, z - depth / 2],
  [x + width / 2, z + depth / 2], [x - width / 2, z + depth / 2], [x - width / 2, z - depth / 2],
]];
const seedRandom = () => {
  let seed = 7469216;
  return () => {seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296;};
};

export function createSurroundingsLayout(data) {
  const campus = data.features.filter(feature => feature.properties.kind === 'campus')
    .flatMap(feature => footprintMetrics(feature.geometry, data.metadata.center).projected.map(rings => [rings[0]]));
  if (!campus.length) throw new Error('Surroundings require a frozen campus boundary.');
  const buildings = data.features.filter(feature => feature.properties.kind === 'building').map(feature => {
    const [x0, z0, x1, z1] = footprintMetrics(feature.geometry, data.metadata.center).bounds;
    return rectangle((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0 + 24, z1 - z0 + 24);
  });
  // Fill campus holes as well: background props must never appear in a courtyard.
  const protectedArea = polygonClipping.union(campus, buildings);
  const rings = protectedArea.flatMap(polygon => polygon), points = rings.flat();
  const bounds = [Math.min(...points.map(p => p[0])), Math.min(...points.map(p => p[1])),
    Math.max(...points.map(p => p[0])), Math.max(...points.map(p => p[1]))];
  const clearance = point => {
    if (protectedArea.some(polygon => pointInPolygon(point, polygon))) return -1;
    return Math.min(...rings.map(ring => Math.min(...ring.slice(1).map((b, i) => segmentDistance(point, ring[i], b)))));
  };
  const streetDistance = value => Math.min(...STREETS.map(street => Math.abs(value - street)));
  const random = seedRandom(), trees = [], blocks = [], parks = [];
  const addTree = (x, z, edge = false) => {
    const radius = 3.2 + random() * 2.2;
    if (clearance([x, z]) < radius * 1.3 + 12 ||
        Math.abs(x) < CITY_HALF && Math.abs(z) < CITY_HALF &&
        Math.min(streetDistance(x), streetDistance(z)) < radius * 1.3 + 14) return;
    trees.push({x, z, radius, height: 7 + random() * 6, phase: random(), edge});
  };
  for (let x = bounds[0] - 190; x < bounds[2] + 190; x += 26) {
    for (let z = bounds[1] - 190; z < bounds[3] + 190; z += 26) {
      const px = x + (random() - .5) * 18, pz = z + (random() - .5) * 18;
      const distance = clearance([px, pz]);
      if (distance < 18 || distance > 180 || random() > .52 + .2 * Math.sin(x / 130 + Math.cos(z / 170))) continue;
      addTree(px, pz, true);
    }
  }
  for (let ix = 0; ix < 31; ix++) for (let iz = 0; iz < 31; iz++) {
    const x = (STREETS[ix] + STREETS[ix + 1]) / 2, z = (STREETS[iz] + STREETS[iz + 1]) / 2;
    const distance = clearance([x, z]);
    if (distance < CELL * .72 + 55) continue;
    const park = random() < (x < -1000 ? .4 : .22);
    if (park) {
      parks.push({x, z, radius: 65 + random() * 25, phase: random()});
      for (let i = 0; i < 7; i++) addTree(x + (random() - .5) * 170, z + (random() - .5) * 170);
      continue;
    }
    const residential = random() < .72;
    const height = residential ? 12 + Math.floor(random() * 7) * 3.4 : 23 + random() * (distance < 600 ? 15 : 33);
    for (let i = 0; i < (residential ? 3 : 2); i++) {
      const width = residential ? 75 + random() * 35 : 40 + random() * 20;
      const depth = residential ? 19 + random() * 7 : 43 + random() * 14;
      blocks.push({x: x + (residential ? (random() - .5) * 36 : (i - .5) * 95),
        z: z + (residential ? (i - 1) * 58 : (random() - .5) * 48),
        width, depth, height: height + (residential ? 0 : random() * 8), phase: random(), distant: false});
    }
    for (const dx of [-88, 88]) for (const dz of [-76, 0, 76]) addTree(x + dx, z + dz);
  }
  for (let i = 0; i < 320; i++) {
    const angle = random() * Math.PI * 2, distance = 4400 + random() * 2300;
    const block = {x: Math.cos(angle) * distance, z: Math.sin(angle) * distance,
      width: 30 + random() * 65, depth: 25 + random() * 40,
      height: 22 + random() * 70, phase: random(), distant: true};
    if (Math.abs(block.x) - block.width / 2 < CITY_HALF + 30 &&
        Math.abs(block.z) - block.depth / 2 < CITY_HALF + 30) continue;
    if (blocks.some(other => Math.abs(block.x - other.x) < (block.width + other.width) / 2 + 8 &&
      Math.abs(block.z - other.z) < (block.depth + other.depth) / 2 + 8)) continue;
    blocks.push(block);
  }
  const safeTrees = trees.filter(tree => !blocks.some(block =>
    Math.abs(tree.x - block.x) < block.width / 2 + tree.radius * 1.3 + 1 &&
    Math.abs(tree.z - block.z) < block.depth / 2 + tree.radius * 1.3 + 1));
  const edgeTrees = safeTrees.filter(tree => tree.edge), parkTrees = safeTrees.filter(tree => !tree.edge);
  const sample = (items, limit) => items.filter((_, i) => Math.floor(i * limit / items.length) !== Math.floor((i - 1) * limit / items.length));
  const selectedEdge = sample(edgeTrees, Math.min(900, edgeTrees.length));
  const selectedTrees = [...selectedEdge, ...sample(parkTrees, Math.min(TREE_LIMIT - selectedEdge.length, parkTrees.length))];
  const streets = width => {
    const strips = [];
    for (const p of STREETS) {
      strips.push(rectangle(p, 0, width, CITY_HALF * 2), rectangle(0, p, CITY_HALF * 2, width));
    }
    return polygonClipping.difference(polygonClipping.union(...strips), protectedArea);
  };
  return {protectedArea, bounds, trees: selectedTrees, buildings: blocks, parks, sidewalks: streets(23), roads: streets(13)};
}

function surfaceGeometry(polygons, height) {
  const pieces = polygons.map(rings => {
    const path = ring => ring.map(([x, z]) => new THREE.Vector2(x, -z));
    const shape = new THREE.Shape(path(rings[0]));
    for (const ring of rings.slice(1)) shape.holes.push(new THREE.Path(path(ring)));
    const geometry = new THREE.ShapeGeometry(shape);
    geometry.rotateX(-Math.PI / 2); geometry.translate(0, height, 0);
    return geometry;
  });
  const merged = mergeGeometries(pieces);
  pieces.forEach(piece => piece.dispose());
  merged.deleteAttribute('uv');
  return merged;
}

function facadeTexture() {
  const size = 64, bytes = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const window = x > 14 && x < 49 && y > 18 && y < 51;
    const frame = window && (x < 17 || x > 46 || y < 21 || y > 48 || x === 31 || x === 32);
    const color = frame ? [181, 190, 185] : window ? [89 + y / 3, 117 + y / 3, 133 + y / 3] : [246, 245, 239];
    bytes.set([...color, 255], (y * size + x) * 4);
  }
  const texture = new THREE.DataTexture(bytes, size, size);
  texture.name = 'Original background window bay';
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter; texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true; texture.anisotropy = 4; texture.needsUpdate = true;
  return texture;
}

function crownGeometry() {
  const pieces = [];
  for (const [x, y, z, scale] of [[-.36, .55, .08, .74], [.37, .65, -.1, .7], [0, .94, 0, .63]]) {
    const geometry = new THREE.IcosahedronGeometry(1, 0);
    geometry.scale(scale, scale * .68, scale); geometry.translate(x, y, z);
    const position = geometry.attributes.position, colors = new Float32Array(position.count * 3);
    for (let i = 0; i < position.count; i++) {
      const shade = .68 + .26 * Math.max(0, position.getY(i));
      colors.set([shade, shade, shade], i * 3);
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3)); pieces.push(geometry);
  }
  const geometry = mergeGeometries(pieces);
  pieces.forEach(piece => piece.dispose());
  return geometry;
}

export function createCampusSurroundings(data, lawnMaterial) {
  if (!lawnMaterial?.map) throw new Error('Surroundings require the existing shared campus lawn surface.');
  const layout = createSurroundingsLayout(data), group = new THREE.Group();
  group.name = 'Campus surroundings';
  group.userData = {displayOnly: true, source: 'Original procedural urban and park backdrop; not mapped buildings',
    exportPolicy: 'Outside authoritative campus model; excluded from building exports'};
  const atmosphere = {value: 1}, hazeColor = new THREE.Color('#8acbfa').multiplyScalar(1.35);
  const materials = new Set(), geometries = new Set(), texture = facadeTexture();
  function material(name, options, facade = false) {
    const result = new THREE.MeshStandardMaterial({name, roughness: .92, ...options});
    result.onBeforeCompile = shader => {
      shader.uniforms.backdropAtmosphere = atmosphere;
      shader.uniforms.backdropHaze = {value: hazeColor};
      // Keep high overview cameras from washing out the entire surrounding district.
      shader.vertexShader = `varying float backdropDepth;\n${shader.vertexShader}`
        .replace('#include <project_vertex>', `#include <project_vertex>
          backdropDepth = max(0., length(mvPosition.xyz) - max(cameraPosition.y, 0.) * .9);`);
      if (facade) shader.vertexShader = shader.vertexShader.replace('#include <uv_vertex>', `#include <uv_vertex>
        #if defined(USE_MAP) && defined(USE_INSTANCING)
          vec3 size = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
          vMapUv = abs(normal.y) > .5 ? vec2(.02) : uv * vec2(abs(normal.x) > .5 ? size.z : size.x, size.y) / vec2(4., 3.4);
        #endif`);
      shader.fragmentShader = `varying float backdropDepth;
        uniform float backdropAtmosphere; uniform vec3 backdropHaze;\n${shader.fragmentShader}`
        .replace('#include <opaque_fragment>', `#include <opaque_fragment>
          gl_FragColor.rgb = mix(gl_FragColor.rgb, backdropHaze, backdropAtmosphere * smoothstep(1800., 10500., backdropDepth));`);
    };
    result.customProgramCacheKey = () => `campus-surroundings-v1-${facade}`;
    materials.add(result);
    return result;
  }
  const walls = material('Background warm masonry and cool window bays', {map: texture}, true);
  const roofs = material('Background roof caps', {color: '#ffffff'});
  const foliage = material('Background clustered foliage', {color: '#ffffff', vertexColors: true, flatShading: true});
  const bark = material('Background tree trunks', {color: '#6a6250'});
  const groundMaterial = material('Background low-frequency meadow and shared lawn', {
    map: lawnMaterial.map, normalMap: lawnMaterial.normalMap, roughnessMap: lawnMaterial.roughnessMap,
    normalScale: new THREE.Vector2(.04, .04), vertexColors: true,
  });
  const groundGeometry = new THREE.PlaneGeometry(48000, 48000, 96, 96);
  groundGeometry.rotateX(-Math.PI / 2); groundGeometry.translate(0, GROUND_Y, 0);
  const position = groundGeometry.attributes.position, colors = new Float32Array(position.count * 3);
  const uv = groundGeometry.attributes.uv;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i), z = position.getZ(i);
    const variation = .91 + .045 * Math.sin(x / 380 + Math.cos(z / 520)) + .035 * Math.cos(z / 730 + x / 1100);
    colors.set([variation, variation, variation], i * 3); uv.setXY(i, x / 12, z / 12);
  }
  groundGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.name = 'Continuous meadow ground'; group.add(ground);
  const parcels = [];
  function parcel(polygon, color) {
    const geometry = surfaceGeometry([polygon], -.33), tint = new THREE.Color(color);
    const colors = new Float32Array(geometry.attributes.position.count * 3);
    for (let i = 0; i < colors.length; i += 3) colors.set(tint.toArray(), i);
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3)); parcels.push(geometry);
  }
  for (const building of layout.buildings.filter(building => !building.distant)) {
    parcel(rectangle(building.x, building.z, building.width + 12, building.depth + 12), '#a8ac99');
  }
  for (const park of layout.parks) {
    const ring = Array.from({length: 21}, (_, i) => {
      const angle = i / 20 * Math.PI * 2, radius = park.radius * (1 + .15 * Math.sin(angle * 3 + park.phase * 6));
      return [park.x + Math.cos(angle) * radius, park.z + Math.sin(angle) * radius * .8];
    });
    ring[20] = [...ring[0]];
    parcel([ring], park.phase < .5 ? '#7e985f' : '#829b69');
  }
  const parcelGeometry = mergeGeometries(parcels); parcels.forEach(geometry => geometry.dispose());
  const plantedBlocks = new THREE.Mesh(parcelGeometry, material('Background park clearings and building aprons',
    {vertexColors: true, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1}));
  plantedBlocks.name = 'Background landscaped parcels'; group.add(plantedBlocks);
  for (const [name, polygons, height, color, units] of [
    ['Background sidewalks', layout.sidewalks, -.28, '#b8baa9', -2],
    ['Background streets', layout.roads, -.23, '#7e8986', -4],
  ]) {
    const mesh = new THREE.Mesh(surfaceGeometry(polygons, height),
      material(name, {color, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: units}));
    mesh.name = name; group.add(mesh);
  }
  const box = new THREE.BoxGeometry(1, 1, 1); box.clearGroups();
  const crown = crownGeometry(), trunk = new THREE.CylinderGeometry(.24, .38, 1, 5, 1, true);
  trunk.translate(0, .5, 0);
  const object = new THREE.Object3D(), color = new THREE.Color();
  function instances(name, geometry, surface, items, transform) {
    const mesh = new THREE.InstancedMesh(geometry, surface, items.length);
    mesh.name = name;
    for (const [index, item] of items.entries()) {
      object.position.set(0, 0, 0); object.rotation.set(0, 0, 0); object.scale.set(1, 1, 1); color.set('#ffffff');
      transform(item, object, color); object.updateMatrix();
      mesh.setMatrixAt(index, object.matrix); mesh.setColorAt(index, color);
    }
    mesh.computeBoundingSphere(); group.add(mesh);
  }
  const palette = ['#d3c7b1', '#c4bcb0', '#c9cdd0', '#b6b9ad', '#c9ad93'];
  for (let quadrant = 0; quadrant < 4; quadrant++) {
    const inQuadrant = item => (item.x < 0 ? 1 : 0) + (item.z < 0 ? 2 : 0) === quadrant;
    const buildings = layout.buildings.filter(inQuadrant), trees = layout.trees.filter(inQuadrant);
    instances(`Surrounding district ${quadrant}`, box, walls, buildings, (item, object, color) => {
      object.position.set(item.x, GROUND_Y + item.height / 2, item.z);
      object.scale.set(item.width, item.height, item.depth);
      color.set(palette[Math.floor(item.phase * palette.length)]);
    });
    const roofParts = buildings.flatMap(item => [item, ...item.phase < .5 ? [{...item, terrace: true}] : []]);
    instances(`Surrounding roofline ${quadrant}`, box, roofs, roofParts, (item, object, color) => {
      object.position.set(item.x, GROUND_Y + item.height + (item.terrace ? 1.5 : .3), item.z);
      object.scale.set(item.terrace ? item.width * .4 : item.width + .7, item.terrace ? 3 : .6,
        item.terrace ? item.depth * .5 : item.depth + .7);
      color.set(item.phase < .16 ? '#987f70' : '#9aaba9');
    });
    instances(`Surrounding tree crowns ${quadrant}`, crown, foliage, trees, (item, object, color) => {
      object.position.set(item.x, GROUND_Y + item.height * .25, item.z);
      object.scale.set(item.radius, item.height * .58, item.radius); object.rotation.y = item.phase * Math.PI * 2;
      color.setHSL(.23 + item.phase * .065, .24 + item.phase * .13, .29 + item.phase * .12);
    });
    instances(`Surrounding tree trunks ${quadrant}`, trunk, bark, trees, (item, object) => {
      object.position.set(item.x, GROUND_Y, item.z); object.scale.set(1, item.height * .7, 1);
    });
  }
  let triangles = 0, bytes = 0;
  group.traverse(mesh => {
    if (!mesh.isMesh) return;
    mesh.castShadow = false; mesh.receiveShadow = false; mesh.raycast = () => {};
    geometries.add(mesh.geometry);
    triangles += (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3 * (mesh.isInstancedMesh ? mesh.count : 1);
    if (mesh.isInstancedMesh) bytes += mesh.instanceMatrix.array.byteLength + mesh.instanceColor.array.byteLength;
  });
  for (const geometry of geometries) {
    bytes += geometry.index?.array.byteLength ?? 0;
    for (const attribute of Object.values(geometry.attributes)) bytes += attribute.array.byteLength;
  }
  const stats = {buildings: layout.buildings.length, trees: layout.trees.length,
    edgeTrees: layout.trees.filter(tree => tree.edge).length, drawCalls: group.children.length, triangles, geometryBytes: bytes,
    newTextures: 1, newTextureBytes: texture.image.data.byteLength, sharedLawnTextures: 3};
  let disposed = false;
  return {group, stats, layout,
    update(camera) {atmosphere.value = camera.isOrthographicCamera ? 0 : 1;},
    dispose() {
      if (disposed) return;
      disposed = true; group.removeFromParent();
      group.traverse(mesh => {if (mesh.isInstancedMesh) mesh.dispose();});
      for (const resource of [...geometries, ...materials, texture]) resource.dispose();
      group.clear();
    },
  };
}
