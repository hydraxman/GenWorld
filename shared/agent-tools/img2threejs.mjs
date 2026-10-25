import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {lstat, mkdir, mkdtemp, readFile, rename, rm, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import source from './img2threejs-source.json' with {type: 'json'};

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const destination = path.join(root, '.agents', 'skills', 'img2threejs');
const receiptName = '.genworld-source.json';
const blobHash = bytes => createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');

function api(endpoint, input) {
  const args = ['api', endpoint, ...(input ? ['--input', '-'] : [])];
  return JSON.parse(execFileSync('gh', args, {
    input: input ? JSON.stringify(input) : undefined,
    encoding: 'utf8', timeout: 120000, maxBuffer: 16 * 1024 * 1024, stdio: ['pipe', 'pipe', 'inherit'],
  }));
}

function localPath(directory, remotePath) {
  const parts = remotePath.split('/');
  if (parts.some(part => !part || part === '.' || part === '..' || /[\\:\0]/.test(part))) {
    throw new Error(`Unsafe upstream path: ${remotePath}`);
  }
  return path.join(directory, ...parts);
}

async function exists(file) {
  try {return await lstat(file);}
  catch (error) {if (error.code === 'ENOENT') return null; throw error;}
}

export async function checkInstallation(directory = destination) {
  const stat = await exists(directory);
  if (!stat || !stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error('Missing local img2threejs installation. Run npm run skills:install:3d.');
  }
  const receipt = JSON.parse(await readFile(path.join(directory, receiptName), 'utf8'));
  if (receipt.repository !== source.repository || receipt.revision !== source.revision ||
      !Array.isArray(receipt.files) || !receipt.files.length) {
    throw new Error('Installed source does not match the pinned revision; preserve it before reinstalling.');
  }
  for (const file of receipt.files) {
    const target = localPath(directory, file.path);
    if (!(await lstat(target)).isFile() || blobHash(await readFile(target)) !== file.sha) {
      throw new Error(`Upstream file changed: ${file.path}. Preserve local edits before reinstalling.`);
    }
  }
  for (const required of ['SKILL.md', 'LICENSE', 'forge/stage1_intake/search_specs.py',
    'docs/materials/material-reference.json', 'docs/specs/vocabulary/core_3d.jsonl',
    'grimoire/build/geometry_patterns.md', 'docs/standard-prompts/build.md']) {
    if (!receipt.files.some(file => file.path === required)) throw new Error(`Incomplete upstream installation: ${required}`);
  }
  return {repository: receipt.repository, revision: receipt.revision, files: receipt.files.length};
}

export async function install(directory = destination, request = api) {
  if (await exists(directory)) return checkInstallation(directory);
  const parent = path.dirname(directory);
  await mkdir(parent, {recursive: true});
  const staging = await mkdtemp(path.join(parent, '.img2threejs-'));
  try {
    const tree = request(`repos/${source.repository}/git/trees/${source.revision}?recursive=1`);
    if (tree.truncated || !Array.isArray(tree.tree)) throw new Error('Upstream tree is incomplete.');
    const files = tree.tree.filter(entry => entry.type !== 'tree');
    for (const file of files) {
      localPath(staging, file.path);
      if (file.type !== 'blob' || !['100644', '100755'].includes(file.mode)) {
        throw new Error(`Unsupported upstream entry: ${file.path}`);
      }
    }
    const [owner, name] = source.repository.split('/');
    for (let start = 0; start < files.length; start += 24) {
      const batch = files.slice(start, start + 24);
      const fields = batch.map((file, i) => `f${i}: object(expression:${JSON.stringify(`${source.revision}:${file.path}`)}) {
        ... on Blob { oid isBinary text }
      }`).join('\n');
      const result = request('graphql', {query: `query {
        repository(owner:${JSON.stringify(owner)},name:${JSON.stringify(name)}) {${fields}}
      }`});
      if (result.errors?.length || !result.data?.repository) throw new Error('GitHub could not return the pinned source blobs.');
      for (const [i, file] of batch.entries()) {
        const blob = result.data.repository[`f${i}`];
        if (!blob || blob.oid !== file.sha) throw new Error(`Upstream revision mismatch: ${file.path}`);
        let bytes;
        if (!blob.isBinary && typeof blob.text === 'string') bytes = Buffer.from(blob.text, 'utf8');
        else {
          const binary = request(`repos/${source.repository}/git/blobs/${file.sha}`);
          if (binary.encoding !== 'base64') throw new Error(`Unsupported upstream encoding: ${file.path}`);
          bytes = Buffer.from(binary.content, 'base64');
        }
        if (blobHash(bytes) !== file.sha) throw new Error(`Source integrity mismatch: ${file.path}`);
        const target = localPath(staging, file.path);
        await mkdir(path.dirname(target), {recursive: true});
        await writeFile(target, bytes);
      }
    }
    await writeFile(path.join(staging, receiptName), JSON.stringify({...source,
      files: files.map(({path, sha}) => ({path, sha}))}, null, 2) + '\n');
    await checkInstallation(staging);
    await rename(staging, directory);
    return checkInstallation(directory);
  } finally {
    await rm(staging, {recursive: true, force: true});
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const command = process.argv[2];
  if (!['install', 'check'].includes(command)) throw new Error('Usage: node shared\\agent-tools\\img2threejs.mjs <install|check>');
  const result = await (command === 'install' ? install() : checkInstallation());
  console.log(`img2threejs: ${result.files} verified upstream files at ${result.revision}`);
  console.log(path.relative(root, destination));
}
