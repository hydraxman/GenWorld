import { build } from 'esbuild';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildKnowledgePages } from '../../knowledge-tower/scripts/build-pages.mjs';
import { scenes } from '../src/scenes.js';

const site = path.resolve(import.meta.dirname, '..');
const repository = path.resolve(site, '..', '..');
export const output = path.join(repository, 'output', 'pages');

async function copy(source, destination) {
  await mkdir(path.dirname(destination), { recursive: true });
  await cp(source, destination);
}

export async function buildSite() {
  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  const cards = scenes.map(scene => `<a class="scene-card ${scene.id}" href="scene.html?scene=${scene.id}">
    <div class="card-art" data-number="${scene.number}" aria-hidden="true"><div class="mini-model"></div></div>
    <div class="card-copy"><span class="card-category">${scene.category}</span>
    <div class="card-heading"><h3>${scene.title}</h3><span aria-hidden="true">↗</span></div>
    <span class="card-english">${scene.english}</span><p class="card-description">${scene.description}</p>
    <span class="card-detail">${scene.detail}</span></div></a>`).join('\n');
  const links = scenes.map(scene =>
    `<a data-scene="${scene.id}" href="scene.html?scene=${scene.id}">${scene.title}</a>`).join('');
  for (const file of ['index.html', 'scene.html']) {
    const html = (await readFile(path.join(site, file), 'utf8'))
      .replace('<!-- SCENE_CARDS -->', cards).replace('<!-- SCENE_LINKS -->', links);
    await writeFile(path.join(output, file), html);
  }
  for (const file of ['site.css', 'credits.html']) await copy(path.join(site, file), path.join(output, file));
  const splaytree = await readFile(path.join(repository, 'node_modules', 'splaytree', 'Readme.md'), 'utf8');
  const notice = splaytree.indexOf('The MIT License (MIT)');
  if (notice < 0) throw new Error('Missing splaytree license notice');
  await writeFile(path.join(output, 'LICENSE-geometry.txt'), [
    'polygon-clipping\n' + await readFile(path.join(repository, 'node_modules', 'polygon-clipping', 'LICENSE.md'), 'utf8'),
    'splaytree\n' + splaytree.slice(notice),
    'robust-predicates\n' + await readFile(path.join(repository, 'node_modules', 'robust-predicates', 'LICENSE'), 'utf8'),
  ].join('\n\n'));
  for (const [source, destination] of [
    ['LICENSE', 'LICENSE'], ['node_modules/three/LICENSE', 'LICENSE-three.txt'],
    ['projects/tsinghua-campus/index.html', 'scenes/campus/index.html'],
    ['projects/tsinghua-campus/style.css', 'scenes/campus/style.css'],
    ['projects/tsinghua-campus/src/second-gate-font-OFL.txt', 'scenes/campus/LICENSE-font.txt'],
    ['projects/courtyard/viewer.html', 'scenes/courtyard/index.html'],
  ]) await copy(path.join(repository, source), path.join(output, destination));
  for (const file of ['campus.json', 'provenance.json', 'gongzi-source.json', 'second-gate-anchor.json', 'old-library-match.json']) {
    await copy(path.join(repository, 'projects', 'tsinghua-campus', 'data', file),
      path.join(output, 'scenes', 'campus', 'data', file));
  }
  for (const file of ['source-footprint.json', 'campus-context.json']) {
    await copy(path.join(repository, 'projects', 'shunde', 'docs', file === 'source-footprint.json' ? 'courtyard' : '', file),
      path.join(output, 'scenes', 'campus', 'data', file));
  }
  for (const file of ['maple-color.png', 'Normal.png', 'Roughness.png', 'SOURCE.json']) {
    await copy(path.join(repository, 'projects', 'courtyard', 'assets', 'leaves', file),
      path.join(output, 'scenes', 'courtyard', 'assets', 'leaves', file));
  }
  await buildKnowledgePages(path.join(output, 'scenes', 'knowledge'));
  for (const project of ['courtyard', 'tsinghua-campus']) {
    await build({
      entryPoints: [path.join(repository, 'projects', project, 'src', 'main.js')],
      outfile: path.join(output, 'scenes', project === 'tsinghua-campus' ? 'campus' : project, 'assets', 'scene.js'),
      bundle: true, minify: true, format: 'iife', target: 'chrome120',
      define: { __PHOTO_SITE_COUNT__: '0' },
      legalComments: 'inline',
      plugins: [{ name: 'published-runtime-dependencies', setup(context) {
        context.onResolve({ filter: /^(?:three(?:\/|$)|polygon-clipping$)/ }, args =>
          ({ path: fileURLToPath(import.meta.resolve(args.path)) }));
      } }],
    });
  }
  await build({
    entryPoints: [path.join(site, 'src', 'preview.js')], outfile: path.join(output, 'preview.js'),
    bundle: true, minify: true, format: 'iife', target: 'chrome120',
  });
  const courtyard = path.join(output, 'scenes', 'courtyard', 'index.html');
  await writeFile(courtyard, (await readFile(courtyard, 'utf8')).replace('<head>', '<head><link rel="icon" href="data:,">'));
  await writeFile(path.join(output, '.nojekyll'), '');
  console.log('Navigation site built in output/pages');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await buildSite();
