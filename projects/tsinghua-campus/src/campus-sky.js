import {campusWeather} from './campus-weather.js';

export const SKY_TEXTURE_SIZE = [1024, 512];

export const campusSkyGLSL = `
  uniform sampler2D campusSky;
  vec3 campusSkyColor(vec3 direction) {
    vec3 d = normalize(direction);
    vec2 uv = vec2(atan(d.z, d.x) * .15915494309 + .5, asin(clamp(d.y, -1., 1.)) * .31830988618 + .5);
    return texture2D(campusSky, uv).rgb * 3.;
  }
`;

const smooth = (lo, hi, value) => {
  const t = Math.max(0, Math.min(1, (value - lo) / (hi - lo)));
  return t * t * (3 - 2 * t);
};
const hash = (x, y) => {
  let value = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ 73471;
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
};
function noise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y), u = smooth(0, 1, x - ix), v = smooth(0, 1, y - iy);
  const a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
  return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
}

export function createCampusSky(THREE, initialWeather = 'clear') {
  const [width, height] = SKY_TEXTURE_SIZE, bytes = new Uint8Array(width * height * 4);
  const densities = new Uint8Array(width * height);
  const longitude = Array.from({length: width}, (_, x) => {
    const angle = ((x + .5) / width - .5) * Math.PI * 2;
    return [Math.cos(angle), Math.sin(angle)];
  });
  for (let y = height / 2; y < height; y++) {
    const latitude = ((y + .5) / height - .5) * Math.PI;
    const elevation = Math.sin(latitude), radius = Math.cos(latitude);
    for (let x = 0; x < width; x++) {
      let density = 0;
      let u = longitude[x][0] * radius / (elevation + .18) * 3.2 + 8.4;
      let v = longitude[x][1] * radius / (elevation + .18) * 3.2 - 3.7;
      for (const weight of [.5, .25, .14, .07, .04]) {
        density += noise(u, v) * weight;
        u = u * 2.03 + 5.2; v = v * 2.03 - 3.4;
      }
      densities[y * width + x] = Math.round(density * 255);
    }
  }
  const texture = new THREE.DataTexture(bytes, width, height, THREE.RGBAFormat);
  texture.name = 'Shared blue-sky and white-cloud radiance panorama';
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter; texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true; texture.needsUpdate = true;
  texture.userData = {sharedCampusSurface: true, source: 'Original deterministic procedural sky; no image downloads', radianceScale: 3};
  // Keep the GPU texture and cloud field. Only re-light the panorama on user selection.
  const pixel = new THREE.Color(), row = new THREE.Color(), cloudColor = new THREE.Color();
  function setWeather(id) {
    const {sky: spec, direction} = campusWeather(id);
    if (texture.userData.weather === id) return;
    const sun = new THREE.Vector3(...direction).normalize(), horizon = new THREE.Color(spec.horizon),
      zenith = new THREE.Color(spec.zenith), high = new THREE.Color(spec.cloud).multiplyScalar(spec.light),
      low = new THREE.Color(spec.cloudLow).multiplyScalar(spec.base),
      glow = spec.glow && new THREE.Color(spec.glow).multiplyScalar(2.8);
    for (let y = 0; y < height; y++) {
      const latitude = ((y + .5) / height - .5) * Math.PI, el = Math.sin(latitude), r = Math.cos(latitude);
      const cloudHorizon = smooth(.015, .18, el);
      row.copy(horizon).lerp(zenith, Math.pow(Math.max(0, el), .35)).multiplyScalar(1.35);
      for (let x = 0; x < width; x++) {
        const i = y * width + x, density = densities[i] / 255;
        const cloud = smooth(spec.cover[0], spec.cover[1], density) * cloudHorizon;
        pixel.copy(row);
        if (glow) {
          const dot = r * (longitude[x][0] * sun.x + longitude[x][1] * sun.z) + el * sun.y;
          pixel.lerp(glow, .76 * smooth(.48, 1, dot) ** 2 + .24 * smooth(.997, .99985, dot));
        }
        cloudColor.copy(low).lerp(high, smooth(.36, .74, density));
        pixel.lerp(cloudColor, cloud).multiplyScalar(1 / 3).convertLinearToSRGB();
        bytes[i * 4] = Math.round(Math.min(1, pixel.r) * 255);
        bytes[i * 4 + 1] = Math.round(Math.min(1, pixel.g) * 255);
        bytes[i * 4 + 2] = Math.round(Math.min(1, pixel.b) * 255);
        bytes[i * 4 + 3] = 255;
      }
    }
    texture.userData.weather = id; texture.needsUpdate = true;
  }
  setWeather(initialWeather);
  const material = new THREE.ShaderMaterial({
    name: 'Campus blue sky and white clouds', side: THREE.BackSide, depthWrite: false,
    uniforms: {campusSky: {value: texture}},
    vertexShader: `
      varying vec3 skyDirection;
      void main() {
        skyDirection = position;
        vec4 projected = projectionMatrix * vec4(mat3(viewMatrix) * position, 1.);
        gl_Position = projected.xyww;
      }`,
    fragmentShader: `
      varying vec3 skyDirection;
      ${campusSkyGLSL}
      void main() {
        gl_FragColor = vec4(campusSkyColor(skyDirection), 1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const sky = new THREE.Mesh(new THREE.BoxGeometry(900000, 900000, 900000), material);
  sky.name = 'Campus blue sky and white clouds';
  sky.frustumCulled = false; sky.renderOrder = -1;
  sky.raycast = () => {};
  return {sky, texture, setWeather};
}
