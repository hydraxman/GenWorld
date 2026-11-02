import {readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {deflateSync, inflateSync} from 'node:zlib';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
import {encoded, size} from '../src/vendor/qingming/micro.js';

const directory = resolve(import.meta.dirname, '..', 'src', 'vendor', 'qingming');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export async function packedQingming() {
  const [willowBytes, microBytes] = await Promise.all(['willow.json', 'micro.js'].map(name => readFile(resolve(directory, name))));
  const willow = JSON.parse(willowBytes);
  const pack = (width, height, rgba) => {
    const raw = Buffer.from(rgba, 'base64'), compressed = deflateSync(raw, {level: 9});
    if (raw.length !== width * height * 4 || !raw.equals(inflateSync(compressed))) {
      throw new Error('Qingming lossless texture round trip failed.');
    }
    return {width, height, byteLength: raw.length, sha256: sha256(raw), deflate: compressed.toString('base64')};
  };
  return {schemaVersion: 1, revision: '81f5c0a6e78e67388cc8a978064b88c53621949e',
    sourceSHA256: {willow: sha256(willowBytes), micro: sha256(microBytes)},
    textures: {willow: pack(willow.texture.width, willow.texture.height, willow.texture.rgba),
      micro: pack(size, size, encoded)}, parts: willow.parts};
}

export async function verifyPackedQingming() {
  const actual = JSON.parse(await readFile(resolve(directory, 'runtime.json'), 'utf8'));
  if (!isDeepStrictEqual(actual, await packedQingming())) {
    throw new Error('Qingming runtime assets are stale. Run npm run assets:pack in projects\\tsinghua-campus.');
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await writeFile(resolve(directory, 'runtime.json'), JSON.stringify(await packedQingming()) + '\n');
  console.log('Packed original Qingming pixels losslessly; original snapshots and licenses unchanged.');
}
