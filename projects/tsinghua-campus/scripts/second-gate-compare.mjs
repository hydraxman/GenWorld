import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir, readFile, unlink, writeFile} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import puppeteer from 'puppeteer-core';
import {createProjectServer} from './serve.mjs';

const phase = process.argv[2];
if (!['before', 'after'].includes(phase)) throw new Error('Use: node scripts\\second-gate-compare.mjs before|after');
const root = resolve(import.meta.dirname, '..');
const output = join(root, 'output');
await mkdir(output, {recursive: true});
const model = phase === 'before' ? 'output/second-gate-review-before.glb' : 'output/landmarks/tsinghua-second-gate.glb';
await readFile(join(root, model));
const rendererFile = join(output, 'second-gate-review-renderer.html');
const bundle = await build({
  entryPoints: [join(import.meta.dirname, 'second-gate-study-scene.js')],
  bundle: true, write: false, minify: true, target: 'chrome120', format: 'iife',
  define: {__MODEL_URL__: JSON.stringify(`/${model}`)}, logLevel: 'warning',
});
await writeFile(rendererFile, `<!doctype html><meta charset="utf-8"><link rel="icon" href="data:,">
<style>html,body{margin:0;width:1600px;height:1200px;overflow:hidden}canvas{display:block}</style>
<body><script>${bundle.outputFiles[0].text.replace(/<\/script/gi, '<\\/script')}</script></body>`);
const server = createProjectServer();
await new Promise(done => server.listen(0, '127.0.0.1', done));
let browser;
try {
  browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: true, args: ['--use-gl=angle', '--use-angle=d3d11'],
  });
  const page = await browser.newPage();
  await page.setViewport({width: 1600, height: 1200, deviceScaleFactor: 1});
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  page.on('requestfailed', request => errors.push(`${request.url()}: ${request.failure()?.errorText}`));
  await page.goto(`http://127.0.0.1:${server.address().port}/output/second-gate-review-renderer.html`, {waitUntil: 'load'});
  await page.waitForFunction(() => window.gateStudy?.ready || window.gateStudyError, {timeout: 90000});
  assert.equal(await page.evaluate(() => window.gateStudyError), undefined);
  for (const angle of ['front', 'oblique']) {
    await page.evaluate(view => {
      window.gateStudy.capture(view);
      return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }, angle);
    await page.screenshot({path: join(output, `second-gate-${phase}-${angle}.png`)});
  }
  assert.deepEqual(errors, []);
  if (phase === 'after') {
    const catalog = JSON.parse(await readFile(join(root, 'reference-catalog.json'), 'utf8'));
    const site = catalog.sites.find(item => item.id === 'second-gate');
    assert.ok(site);
    const front = site.images.find(image => image.path.endsWith('second-gate-modern-complete.jpg'));
    const oblique = site.images.find(image => image.path.endsWith('second-gate-gallery-b.jpg'));
    assert.ok(front && oblique, 'Verified complete modern references are required');
    const escape = value => String(value).replace(/[&<>"']/g, c =>
      ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
    const section = (angle, name, reference) => `<section><h2>${name}</h2><div class="grid">
      <figure><a href="${escape(reference.path.replace(/\\/g, '/'))}" target="_blank" rel="noreferrer"><img src="${escape(reference.path.replace(/\\/g, '/'))}" alt="二校门现貌${name}参考照片"></a><figcaption>现貌参考照片 · <a href="${escape(reference.pageUrl)}">官方来源</a></figcaption></figure>
      <figure><a href="second-gate-before-${angle}.png" target="_blank" rel="noreferrer"><img src="second-gate-before-${angle}.png" alt="修改前二校门${name}模型"></a><figcaption>修改前 · 同一相机与照明</figcaption></figure>
      <figure><a href="second-gate-after-${angle}.png" target="_blank" rel="noreferrer"><img src="second-gate-after-${angle}.png" alt="修改后二校门${name}模型"></a><figcaption>修改后 · 同一相机与照明</figcaption></figure>
      </div></section>`;
    const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width">
      <title>二校门 · 现貌与模型对照</title><style>body{margin:0;padding:28px;background:#f1f3f1;color:#263a38;font:15px/1.7 "Microsoft YaHei",sans-serif}h1{margin:0}p{margin:8px 0}h2{font-size:20px;margin:20px 0 10px}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}figure{margin:0;background:white;border:1px solid #d3dcd8;border-radius:8px;overflow:hidden}img{display:block;width:100%;aspect-ratio:4/3;object-fit:contain;background:#e6edf1}figcaption{padding:10px;font-size:13px}a{color:#704382}.note{font-size:12px;color:#67756f}@media(max-width:850px){.grid{grid-template-columns:1fr}}</style>
      <h1>二校门：现貌照片 / 修改前 / 修改后</h1><p>重点修正平顶阶梯冠部、独立柱墩檐口、柱径与石基、侧拱白色墙面及卷涡装饰。</p>
      <p class="note">模型前后使用相同机位与照明，原照片视角仅近似对应；不是像素配准或测绘验收。点击任意图片查看原尺寸。照片保留原貌、仅供本地对照，不用作模型贴图。题字仍为字体近似。</p>
      ${section('front', '正面 · 冠部与三拱比例', front)}${section('oblique', '低机位斜视 · 柱式与立面层次', oblique)}
      </html>`;
    await writeFile(join(output, 'second-gate-comparison.html'), html);
    await page.setViewport({width: 1920, height: 1250, deviceScaleFactor: 1});
    await page.goto(`http://127.0.0.1:${server.address().port}/output/second-gate-comparison.html`, {waitUntil: 'load'});
    await page.screenshot({path: join(output, 'second-gate-comparison.png'), fullPage: true});
  }
  console.log(`Saved ${phase} reference-angle captures${phase === 'after' ? ' and local comparison page' : ''}.`);
} finally {
  await browser?.close();
  await new Promise(done => server.close(done));
  await unlink(rendererFile);
}
