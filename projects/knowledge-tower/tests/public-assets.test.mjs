import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

test('pinned CC0 public models and all external textures are present locally', async () => {
  const entries = [
    ['kenney-assistant/character.glb', '7112f6a08400914f9da546f3e6029e947cc9eab2b4a6da5eb99776111289efb1'],
    ['kenney-fountain/pavement-fountain.glb', 'ea2996089e90a79ba13d764106d374486bb8137666cf1cdbaebd1927ef365185'],
  ];
  for (const [file, hash] of entries) {
    const url = new URL(`../assets/models/${file}`, import.meta.url);
    const buffer = await readFile(url);
    assert.equal(createHash('sha256').update(buffer).digest('hex'), hash);
    assert.equal(buffer.readUInt32LE(0), 0x46546c67);
    assert.equal(buffer.readUInt32LE(4), 2);
    assert.equal(buffer.readUInt32LE(8), buffer.length);
    const json = JSON.parse(buffer.subarray(20, 20 + buffer.readUInt32LE(12)).toString('utf8'));
    assert.equal(json.asset.version, '2.0');
    for (const image of json.images) {
      if (!image.uri) continue;
      assert.equal(image.uri, 'Textures/colormap.png');
      const texture = await readFile(new URL(image.uri, url));
      assert.equal(texture.subarray(1, 4).toString(), 'PNG');
    }
  }
  const license = await readFile(new URL('../assets/models/SOURCES.md', import.meta.url), 'utf8');
  assert.match(license, /CC0 1.0/);
  assert.match(license, /Kenney/);
});
