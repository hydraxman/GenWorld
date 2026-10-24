import {build} from 'esbuild';
import {mkdir, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(import.meta.dirname, '..');
const result = await build({
  entryPoints: [resolve(root, 'src', 'library-courtyard-preview.js')],
  bundle: true, write: false, minify: true, format: 'iife', target: 'chrome120',
  plugins: [{name: 'single-three-runtime', setup(context) {
    context.onResolve({filter: /^three(?:\/|$)/}, args => ({path: fileURLToPath(import.meta.resolve(args.path))}));
  }}],
  legalComments: 'inline',
});
await mkdir(resolve(root, 'output'), {recursive: true});
await writeFile(resolve(root, 'output', 'library-courtyard-source-preview.html'), `<!doctype html>
<html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>GenWorld · 已有水池庭院建筑</title><style>
body{margin:0;font:14px/1.7 "Microsoft YaHei",sans-serif;color:#294039;background:#e7eee4}
header{position:absolute;left:24px;top:20px;max-width:440px;background:#fffdf4e8;border-radius:12px;padding:16px 20px}
h1{font-size:20px;margin:0 0 8px}p{margin:5px 0}a{color:#765286}#scene{width:100vw;height:100dvh}canvas{display:block}
</style><div id="scene"></div><header><h1>已有模型 · 水池庭院建筑</h1>
<p>直接复用 GenWorld 的庭院楼、三段石池和双廊架；不是重新制作的楼体。</p>
<p id="status">独立原模型预览，尚未确认地图定位；尺寸与隐藏部分为照片估算。石池保留原模型的干池状态。</p>
<p><a href="../">校园工作台</a> · 拖动旋转，滚轮缩放</p></header>
<script>${result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script')}</script></html>`);
console.log('Saved output\\library-courtyard-source-preview.html');
