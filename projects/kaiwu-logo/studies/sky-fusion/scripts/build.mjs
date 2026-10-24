import {build} from 'esbuild';
import {mkdir, copyFile} from 'node:fs/promises';
import {resolve, join} from 'node:path';

const root = resolve(import.meta.dirname, '..');
await mkdir(join(root, 'assets'), {recursive: true});
await copyFile(resolve(root, '../../latest/tsinghua-mem-five-effects-cloud/assets/gsap.min.js'),
  join(root, 'assets/gsap.min.js'));
await build({
  absWorkingDir: root,
  entryPoints: ['scripts/entry.js'],
  outfile: 'assets/scene.bundle.js',
  bundle: true,
  format: 'iife',
  target: 'chrome120',
  minify: true,
  alias: {three: resolve(root, '../../latest/tsinghua-mem-five-effects-cloud/vendor/three/build/three.module.js')},
  logLevel: 'info',
});
