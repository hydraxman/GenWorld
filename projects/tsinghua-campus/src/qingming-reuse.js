/*!
 * Adapted from mike007jd/qingming, revision 81f5c0a6e78e67388cc8a978064b88c53621949e.
 * The MIT License
 * Copyright (c) 2026 BubuAi
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
 * of the Software, and to permit persons to whom the Software is furnished to
 * do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */
import * as THREE from 'three';
import willow from './vendor/qingming/runtime.json' with {type: 'json'};

const bytes = text => Uint8Array.from(atob(text), character => character.charCodeAt(0));
let textures, preparation;
export function prepareQingmingTextures() {
  preparation ||= Promise.all(Object.entries(willow.textures).map(async ([name, image]) => {
    const stream = new Blob([bytes(image.deflate)]).stream().pipeThrough(new DecompressionStream('deflate'));
    const data = new Uint8Array(await new Response(stream).arrayBuffer());
    if (data.length !== image.byteLength || data.length !== image.width * image.height * 4) {
      throw new Error(`Qingming ${name} texture has invalid decoded dimensions.`);
    }
    return [name, data];
  })).then(entries => {textures = Object.fromEntries(entries);});
  return preparation;
}

function pixels(name) {
  if (!textures) throw new Error('Await prepareQingmingTextures() before constructing campus water or willow assets.');
  return textures[name];
}

export function createQingmingMicroTexture() {
  const {width, height} = willow.textures.micro;
  const texture = new THREE.DataTexture(pixels('micro'), width, height, THREE.RGBAFormat);
  texture.name = 'Qingming original river micro-normal texture';
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter; texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true; texture.needsUpdate = true;
  return texture;
}

export const qingmingWavesGLSL = `
vec3 qingmingWaves(vec2 p, float time) {
 vec3 h=vec3(0.); float depth=2.;
 for(int i=0;i<7;i++){
  float fi=float(i),theta=fi*2.399963+.24;
  vec2 d=normalize(vec2(cos(theta)*.8+1.,sin(theta)));
  float k=.70*pow(1.51,fi),amp=.042*pow(.67,fi)*.55;
  amp*=1.-smoothstep(4.,9.,k);
  float omega=sqrt(9.81*k*tanh(k*depth));
  float q=k*dot(d,p)-omega*time+fi*fi*1.71;
  amp*=1.-smoothstep(.5,2.8,fwidth(q));
  h+=vec3(amp*sin(q),amp*k*d*cos(q));
 }
 return h;
}`;

export function createQingmingWillow() {
  const image = willow.textures.willow;
  const texture = new THREE.DataTexture(pixels('willow'), image.width, image.height, THREE.RGBAFormat);
  texture.name = 'Qingming original baked willow leaf clusters'; texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = true; texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter; texture.anisotropy = 4; texture.needsUpdate = true;
  const time = {value: 0};
  const hook = shader => {
    shader.uniforms.detailTime = time;
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>
      uniform float detailTime;
      vec2 breezeAt(float y) {
        float h=max(y,0.)/8.;
        vec2 anchor=instanceMatrix[3].xz;
        float phase=detailTime*.8+anchor.x*.1+anchor.y*.12;
        return vec2(sin(phase)*.18,cos(phase*.83)*.1)*h*h;
      }`)
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
        vec2 dn=breezeAt(position.y+.01)-breezeAt(position.y);
        objectNormal.y-=dot(objectNormal.xz,dn)/.01;`)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed.xz+=breezeAt(position.y);');
  };
  const materials = willow.parts.map(part => {
    const leaf = part.leaf;
    const color = part.name.includes('leaf_dark') ? [.095, .16, .036] : part.name.includes('leaf_light') ? [.33, .37, .10]
      : leaf ? [.20, .27, .063] : [.15, .12, .065];
    const material = new THREE.MeshStandardMaterial({name: `Qingming reused willow ${leaf ? 'leaf clusters' : 'bark'}`,
      color: new THREE.Color(...color), vertexColors: true, roughness: .88,
      side: THREE.DoubleSide, map: leaf ? texture : null, alphaTest: leaf ? .12 : 0});
    material.onBeforeCompile = hook; material.customProgramCacheKey = () => 'campus-qingming-breeze-1';
    return material;
  });
  const depthMaterials = [false, true].map(leaf => {
    const material = new THREE.MeshDepthMaterial({depthPacking: THREE.RGBADepthPacking,
      side: THREE.DoubleSide, map: leaf ? texture : null, alphaTest: leaf ? .12 : 0});
    material.onBeforeCompile = hook; material.customProgramCacheKey = () => 'campus-qingming-breeze-depth-1';
    return material;
  });
  const attribute = source => {
    const Type = {5121: Uint8Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array}[source.componentType];
    if (!Type) throw new Error('Unsupported Qingming attribute component type');
    return new THREE.BufferAttribute(new Type(bytes(source.data).buffer), source.itemSize, source.normalized);
  };
  const parts = willow.parts.map((part, index) => {
    const geometry = new THREE.BufferGeometry();
    for (const [source, target] of Object.entries({POSITION: 'position', NORMAL: 'normal', TEXCOORD_0: 'uv', COLOR_0: 'color'})) {
      geometry.setAttribute(target, attribute(part.attributes[source]));
    }
    geometry.setIndex(attribute(part.index)); geometry.computeBoundingSphere();
    return {name: part.name, geometry, material: materials[index], depthMaterial: depthMaterials[Number(part.leaf)]};
  });
  return {parts, setTime(value) {time.value = value;},
    dispose() {texture.dispose(); [...materials, ...depthMaterials].forEach(material => material.dispose());}};
}
