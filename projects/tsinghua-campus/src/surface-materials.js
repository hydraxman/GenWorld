import * as THREE from 'three';

function surfaceTextures(name, sample, size = 128) {
  const colors = new Uint8Array(size * size * 4), normals = new Uint8Array(colors.length);
  const heights = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const {color, height} = sample(x / size, y / size);
    const i = y * size + x;
    colors.set([...color, 255], i * 4);
    heights[i] = height;
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
    normalMap: texture(normals, 'normal', THREE.NoColorSpace)};
}

export function createMasonryMaterial(name, rgb, stone = false) {
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
    const grain = Math.sin(Math.floor(u * 128) * 127.1 + Math.floor(v * 128) * 311.7);
    return {color: [115, 147, 90].map(value => value + broad * 2 + grain * 3), height: grain * .012};
  });
  return new THREE.MeshStandardMaterial({name: 'Mapped green space; original non-photographic lawn surface',
    color: '#ffffff', ...textures, roughness: .97, normalScale: new THREE.Vector2(.08, .08), side: THREE.DoubleSide});
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
