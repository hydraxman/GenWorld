import * as THREE from 'three';
import {createPBRTools} from '../../../shared/pbr.js';
const masonryAtlases = new Map();

function surfaceTextures(name, sample, size = 128) {
  const colors = new Uint8Array(size * size * 4), normals = new Uint8Array(colors.length);
  const heights = new Float32Array(size * size);
  let roughness;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const {color, height, roughness: value} = sample(x / size, y / size);
    const i = y * size + x;
    colors.set([...color, 255], i * 4);
    heights[i] = height;
    if (value !== undefined) {
      roughness ||= new Uint8Array(size * size * 4);
      const channel = Math.round(value * 255);
      roughness.set([255, channel, 0, 255], i * 4);
    }
  }
  const heightAt = (x, y) => heights[((y + size) % size) * size + (x + size) % size];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const normal = new THREE.Vector3(heightAt(x - 1, y) - heightAt(x + 1, y),
      heightAt(x, y - 1) - heightAt(x, y + 1), 1).normalize();
    normals.set([...normal.toArray().map(value => Math.round((value + 1) * 127.5)), 255], (y * size + x) * 4);
  }
  function texture(bytes, suffix, colorSpace) {
    const map = new THREE.DataTexture(bytes, size, size);
    map.name = `${name}: generated ${suffix}; no photograph`;
    map.colorSpace = colorSpace;
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.generateMipmaps = true;
    map.minFilter = THREE.LinearMipmapLinearFilter;
    map.anisotropy = 4;
    map.needsUpdate = true;
    return map;
  }
  return {map: texture(colors, 'base color', THREE.SRGBColorSpace),
    normalMap: texture(normals, 'normal', THREE.NoColorSpace),
    ...(roughness ? {roughnessMap: texture(roughness, 'roughness', THREE.NoColorSpace)} : {})};
}

export function createMasonryMaterial(name, rgb, stone = false) {
  if (typeof document !== 'undefined') {
    const kind = stone ? 'granite' : 'brick';
    if (!masonryAtlases.has(kind)) {
      let seed = 41827;
      const tools = createPBRTools(THREE, {rand: () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296;
      }, stats: {textures: 0}, materials: {}, textureWorld: new Map()});
      const template = tools.pbr(`Shared ${kind}`, kind, [242, 242, 242], [4, 4], 256);
      for (const key of ['map', 'normalMap', 'roughnessMap']) {
        template[key].repeat.set(stone ? 2 : 3.7, stone ? 2 : 3.45);
        template[key].name = `Shared ${kind}: generated Courtyard ${key}; no photograph`;
        template[key].userData.sharedCampusSurface = true;
      }
      masonryAtlases.set(kind, {template, references: 0});
    }
    const atlas = masonryAtlases.get(kind), material = atlas.template.clone();
    material.name = name;
    material.color.setRGB(rgb[0] / 242, rgb[1] / 242, rgb[2] / 242, THREE.SRGBColorSpace);
    material.normalScale.set(.28, .28);
    material.userData.courtyardSurface = kind;
    atlas.references++;
    const release = () => {
      material.removeEventListener('dispose', release);
      if (--atlas.references === 0) {
        for (const key of ['map', 'normalMap', 'roughnessMap']) atlas.template[key].dispose();
        atlas.template.dispose(); masonryAtlases.delete(kind);
      }
    };
    material.addEventListener('dispose', release);
    return material;
  }
  const textures = surfaceTextures(name, (u, v) => {
    const row = Math.floor(v * 8), seam = v * 8 % 1 < .065 ||
      (u * (stone ? 2 : 4) + row % 2 * .5) % 1 < .035;
    const grain = Math.floor(u * 128) * 7 + Math.floor(v * 128) * 11;
    const variation = (grain % 7) - 3 + (row % 2 ? 3 : -2);
    return {color: rgb.map(value => Math.max(0, Math.min(255, value + (seam ? (stone ? 18 : -19) : variation)))),
      height: seam ? -.3 : .02 * (grain % 5)};
  });
  return new THREE.MeshStandardMaterial({name, color: '#ffffff', ...textures,
    normalScale: new THREE.Vector2(.24, .24), roughness: stone ? .78 : .88});
}

export function createGlazingMaterial(name) {
  return new THREE.MeshPhysicalMaterial({name, color: '#365b6b', roughness: .2, metalness: 0,
    ior: 1.5, specularIntensity: 1, envMapIntensity: 1.2, side: THREE.DoubleSide});
}

export function createLawnMaterial() {
  const textures = surfaceTextures('Original procedural lawn', (u, v) => {
    const broad = Math.sin(u * Math.PI * 2 + Math.sin(v * Math.PI * 2));
    const cell = Math.floor(u * 64), row = Math.floor(v * 32);
    const seed = Math.sin(cell * 127.1 + row * 311.7);
    const blade = Math.max(0, 1 - Math.abs(u * 64 % 1 - .5 - Math.sin(v * Math.PI * 64) * .16) * 7)
      * Math.sin((v * 32 % 1) * Math.PI);
    const grain = Math.sin(Math.floor(u * 256) * 127.1 + Math.floor(v * 256) * 311.7);
    return {color: [115, 147, 90].map(value => value + broad * 1.5 + grain * 2 + blade * seed * 2),
      height: grain * .035 + blade * .24, roughness: .94 + Math.abs(seed) * .06};
  }, 256);
  return new THREE.MeshStandardMaterial({name: 'Mapped green space; original non-photographic lawn surface',
    color: '#ffffff', ...textures, metalnessMap: textures.roughnessMap, metalness: 0,
    roughness: .97, normalScale: new THREE.Vector2(.1, .1), side: THREE.DoubleSide});
}

export function createEstimatedFacade() {
  const textures = surfaceTextures('Estimated base facade', (u, v) => {
    const window = u > .19 && u < .81 && v > .24 && v < .82;
    const frame = window && (u < .22 || u > .78 || v < .27 || v > .79 ||
      Math.abs(u - .5) < .012 || Math.abs(v - .55) < .012);
    if (frame) return {color: [157, 168, 170], height: .12};
    if (window) {
      const reflection = v > .6 + u * .15 ? 18 : 0;
      return {color: [55 + reflection, 91 + reflection, 113 + reflection], height: -.25};
    }
    const sill = u > .16 && u < .84 && v > .20 && v < .24;
    const grain = (Math.floor(u * 128) * 3 + Math.floor(v * 128) * 7) % 5;
    return {color: (sill ? [232, 225, 212] : [202, 194, 178]).map(value => value + grain - 2),
      height: sill ? .18 : 0};
  });
  const material = new THREE.MeshStandardMaterial({name: 'Estimated window bays - not photo reconstruction',
    color: '#ffffff', ...textures, normalScale: new THREE.Vector2(.16, .16), roughness: .76});
  return {
    material,
    setVisible(visible) {
      if (typeof visible !== 'boolean') throw new Error('Estimated facade visibility must be a boolean.');
      material.map = visible ? textures.map : null;
      material.normalMap = visible ? textures.normalMap : null;
      material.needsUpdate = true;
    },
    uvGenerator(bottom, top) {
      if (![bottom, top].every(Number.isFinite) || top <= bottom) throw new Error('Facade UVs require a finite positive height range.');
      const storey = (top - bottom) / Math.max(1, Math.floor((top - bottom) / 3.6));
      return {
        generateTopUV(geometry, vertices, a, b, c) {
          return [a, b, c].map(i => new THREE.Vector2(vertices[i * 3] / 4, vertices[i * 3 + 1] / 4));
        },
        generateSideWallUV(geometry, vertices, a, b, c, d) {
          const width = Math.hypot(vertices[a * 3] - vertices[b * 3], vertices[a * 3 + 1] - vertices[b * 3 + 1]);
          const bays = width < 1.8 ? width / 1.8 * .125 : Math.max(1, Math.floor(width / 3.2));
          return [a, b, c, d].map((i, corner) =>
            new THREE.Vector2(corner === 0 || corner === 3 ? 0 : bays, vertices[i * 3 + 2] / storey));
        },
      };
    },
  };
}
