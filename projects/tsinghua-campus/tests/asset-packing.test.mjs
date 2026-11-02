import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {inflateSync} from 'node:zlib';
import {packedQingming} from '../scripts/pack-qingming.mjs';
import packed from '../src/vendor/qingming/runtime.json' with {type: 'json'};
import original from '../src/vendor/qingming/willow.json' with {type: 'json'};
import {encoded} from '../src/vendor/qingming/micro.js';
import {createQingmingWillow, createQingmingMicroTexture, prepareQingmingTextures} from '../src/qingming-reuse.js';

test('packed runtime is reproducible and retains every original mesh and exact RGBA byte', async () => {
  assert.deepEqual(await packedQingming(), packed);
  assert.deepEqual(packed.parts, original.parts);
  for (const [name, text] of [['willow', original.texture.rgba], ['micro', encoded]]) {
    const image = packed.textures[name], raw = Buffer.from(text, 'base64');
    assert.deepEqual(inflateSync(Buffer.from(image.deflate, 'base64')), raw);
    assert.equal(createHash('sha256').update(raw).digest('hex'), image.sha256);
  }
  assert.ok(JSON.stringify(packed).length < 500000);
  await prepareQingmingTextures();
  const willow = createQingmingWillow(), micro = createQingmingMicroTexture();
  assert.deepEqual(Buffer.from(willow.parts.find(part => part.material.map).material.map.image.data),
    Buffer.from(original.texture.rgba, 'base64'));
  assert.deepEqual(Buffer.from(micro.image.data), Buffer.from(encoded, 'base64'));
  willow.parts.forEach(part => part.geometry.dispose()); willow.dispose(); micro.dispose();
});
