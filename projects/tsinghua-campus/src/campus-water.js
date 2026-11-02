import {createWaterShader} from '../../courtyard/src/water.js';
import {createQingmingMicroTexture, qingmingWavesGLSL} from './qingming-reuse.js';
import {campusSkyGLSL} from './campus-sky.js';
import {DAYLIGHT_DIRECTION} from './daylight.js';

export const CAMPUS_WATER_COLOR = '#6da4b2';
export const WATER_REFLECTION_FADE = [220, 380];
// Positive oblique bias admits the nearly coplanar grass into distant reflection rays.
export const WATER_REFLECTION_CLIP_BIAS = 0;

export function createCampusWaterShader(THREE) {
  const shader = createWaterShader(THREE);
  shader.uniforms.microNormal = {value: createQingmingMicroTexture()};
  shader.uniforms.campusSky = {value: null};
  shader.uniforms.reflectionFade = {value: new THREE.Vector2(...WATER_REFLECTION_FADE)};
  shader.uniforms.campusSunDirection = {value: new THREE.Vector3(...DAYLIGHT_DIRECTION).normalize()};
  shader.uniforms.campusSunColor = {value: new THREE.Color('#fff4e3')};
  shader.uniforms.campusSunIntensity = {value: 3};
  shader.name = 'Campus water: filtered multi-scale ripples and shared planar reflection';
  shader.fragmentShader = `
    uniform vec3 color;
    uniform sampler2D tDiffuse;
    uniform sampler2D microNormal;
    uniform float time;
    uniform vec3 eye;
    uniform float reflectionEnabled;
    uniform vec2 reflectionFade;
    uniform vec3 campusSunDirection;
    uniform vec3 campusSunColor;
    uniform float campusSunIntensity;
    varying vec4 reflectionUv;
    varying vec3 worldPosition;

    ${qingmingWavesGLSL}
    ${campusSkyGLSL}
    void main() {
      vec2 p = worldPosition.xz;
      float viewDistance = distance(eye, worldPosition);
      vec3 waves = qingmingWaves(p, time);
      vec2 micro = texture2D(microNormal, p * .25 + vec2(time * .006, 0.)).rg * 2. - 1.;
      vec2 ripple = (waves.yz + micro * .013) * mix(1., .08, smoothstep(80., 320., viewDistance));
      vec3 normal = normalize(vec3(-ripple.x, 1., -ripple.y));
      vec3 viewDirection = normalize(eye - worldPosition);
      float facing = max(dot(viewDirection, normal), 0.);
      float fresnel = .025 + .975 * pow(1. - facing, 5.);
      float colorVariation = .5 + .5 * sin(p.x * .055 + sin(p.y * .043) * 1.8);
      vec3 body = color * mix(.86, 1., colorVariation);
      body += vec3(.008, .012, .016) * (waves.x * 5. + .5);
      vec3 reflectedDirection = reflect(-viewDirection, normal);
      vec3 reflection = campusSkyColor(reflectedDirection);
      float localReflection = reflectionEnabled * (1. - smoothstep(reflectionFade.x, reflectionFade.y, viewDistance));
      if (localReflection > 0. && reflectionUv.w > .0001) {
        vec2 uv = reflectionUv.xy / reflectionUv.w;
        if (all(greaterThanEqual(uv, vec2(0.))) && all(lessThanEqual(uv, vec2(1.)))) {
          reflection = mix(reflection, texture2D(tDiffuse, clamp(uv + ripple * .015, .001, .999)).rgb, localReflection);
        }
      }
      vec3 outgoing = mix(body, reflection, .55 + .4 * fresnel);
      vec3 sunDirection = normalize(campusSunDirection);
      float sparkle = pow(max(dot(reflect(-sunDirection, normal), viewDirection), 0.), 150.);
      outgoing += campusSunColor * sparkle * (.38 / 3.) * campusSunIntensity;
      gl_FragColor = vec4(outgoing, 1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`;
  return shader;
}
