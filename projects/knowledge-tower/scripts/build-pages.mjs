import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const project = fileURLToPath(new URL('..', import.meta.url));
const repository = path.resolve(project, '..', '..');
const output = path.join(repository, 'output', 'pages');

await import('./build.mjs');
await rm(output, { recursive: true, force: true });
for (const file of [
  'index.html', 'styles.css', 'DESIGN.md', 'assets/scene.js', 'assets/models/SOURCES.md',
  'assets/models/kenney-assistant/character.glb',
  'assets/models/kenney-assistant/Textures/colormap.png',
  'assets/models/kenney-fountain/pavement-fountain.glb',
  'assets/models/kenney-fountain/Textures/colormap.png',
]) {
  await mkdir(path.dirname(path.join(output, file)), { recursive: true });
  await cp(path.join(project, file), path.join(output, file));
}
await cp(path.join(repository, 'LICENSE'), path.join(output, 'LICENSE'));
await cp(path.join(repository, 'node_modules', 'three', 'LICENSE'), path.join(output, 'LICENSE-three.txt'));
await writeFile(path.join(output, '.nojekyll'), '');
console.log('Pages site built in output/pages');
