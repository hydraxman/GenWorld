import {build} from 'esbuild';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {writeReferencePage} from './reference-pages.mjs';
import references from '../src/reference-catalog.js';

const root = resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
if (args.some(arg => arg !== '--references') || args.length > 1) {
  throw new Error('Use: node scripts\\build.mjs [--references]');
}
const includeImages = args.includes('--references');
await mkdir(join(root, 'assets'), {recursive: true});
await mkdir(join(root, 'output'), {recursive: true});
await build({
  entryPoints: [join(root, 'src', 'main.js')],
  outfile: join(root, 'assets', 'scene.js'),
  bundle: true, minify: true, format: 'iife', target: 'chrome120',
  define: {__PHOTO_SITE_COUNT__: String(references.sites.length)},
  plugins: [{name: 'single-three-runtime', setup(context) {
    context.onResolve({filter: /^three(?:\/|$)/}, args => ({path: fileURLToPath(import.meta.resolve(args.path))}));
  }}],
  legalComments: 'inline', logLevel: 'warning',
});
const [html, css, bundle] = await Promise.all([
  readFile(join(root, 'index.html'), 'utf8'),
  readFile(join(root, 'style.css'), 'utf8'),
  readFile(join(root, 'assets', 'scene.js'), 'utf8'),
]);
const offline = html.replace('<link rel="stylesheet" href="style.css">', () => `<style>${css}</style>`)
  .replace('<script src="assets/scene.js"></script>', () => `<script>${bundle.replace(/<\/script/gi, '<\\/script')}</script>`);
await writeFile(join(root, 'output', 'tsinghua-campus-offline.html'), offline);
await writeReferencePage(root, references, {includeImages});
console.log(includeImages
  ? `Built local reference gallery for ${references.sites.length} sites; all requested photo hashes verified. Local use only.`
  : `Built source metadata for ${references.sites.length} sites; photos not bundled or byte-verified.`);
console.log('Built assets\\scene.js and output\\tsinghua-campus-offline.html (self-contained, no map requests).');
