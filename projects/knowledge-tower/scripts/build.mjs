import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
await build({
  entryPoints: [path.join(root, 'src', 'main.js')],
  bundle: true,
  format: 'iife',
  target: 'chrome120',
  outfile: path.join(root, 'assets', 'scene.js'),
  sourcemap: true,
  logLevel: 'warning',
});
console.log('Knowledge tower built: assets\\scene.js');
