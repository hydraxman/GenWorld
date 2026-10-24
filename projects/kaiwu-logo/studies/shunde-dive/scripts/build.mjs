import {build} from 'esbuild';
import {mkdir, copyFile, access} from 'node:fs/promises';
import {resolve, join} from 'node:path';
import {execFileSync} from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const repo = resolve(root, '../../../..');
await mkdir(join(root, 'assets'), {recursive: true});
const music = resolve(root, '../sky-fusion/assets/study-music.wav');
try { await access(music); }
catch (error) {
  if (error.code !== 'ENOENT') throw error;
  execFileSync('python', [resolve(root, '../sky-fusion/scripts/music.py')], {stdio: 'inherit'});
}
for (const [source, name] of [
  [resolve(root, '../../latest/tsinghua-mem-five-effects-cloud/assets/gsap.min.js'), 'gsap.min.js'],
  [music, 'study-music.wav'],
  [join(repo, 'projects/shunde/assets/name-glyphs.png'), 'name-glyphs.png'],
]) await copyFile(source, join(root, 'assets', name));
await mkdir(join(root, 'assets/leaves'), {recursive: true});
for (const name of ['maple-color.png', 'Normal.png', 'Roughness.png', 'SOURCE.json']) {
  await copyFile(join(repo, 'shared/assets/leaves', name), join(root, 'assets/leaves', name));
}
await build({
  absWorkingDir: root, entryPoints: ['scripts/entry.js'], outfile: 'assets/scene.bundle.js',
  bundle: true, format: 'iife', target: 'chrome120', minify: true,
  plugins: [{
    name: 'one-three-instance',
    setup(builder) {
      builder.onResolve({filter: /^three$/}, () => ({
        path: resolve(root, '../../latest/tsinghua-mem-five-effects-cloud/vendor/three/build/three.module.js'),
      }));
    },
  }],
  logLevel: 'info',
});
