import {createHash} from 'node:crypto';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {dirname, join, resolve, sep} from 'node:path';

const escape = value => String(value).replace(/[&<>"']/g, c =>
  ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));

export async function writeReferencePage(root, catalog, {includeImages = false} = {}) {
  const sections = [];
  for (const site of catalog.sites) {
    const images = [];
    for (const image of site.images) {
      let preview = '<p class="availability">本地照片未打包，图像字节未校验；此处仅提供来源元数据。</p>';
      if (includeImages) {
        const source = resolve(root, image.path.replaceAll('\\', sep));
        if (!source.startsWith(resolve(root, 'references') + sep)) throw new Error(`Invalid photo path: ${image.path}`);
        const bytes = await readFile(source);
        if (createHash('sha256').update(bytes).digest('hex') !== image.sha256) {
          throw new Error(`Reference image hash mismatch: ${image.path}`);
        }
        const relative = source.slice(resolve(root).length + 1);
        const destination = join(root, 'output', relative);
        await mkdir(dirname(destination), {recursive: true});
        await writeFile(destination, bytes);
        const href = relative.split(sep).map(encodeURIComponent).join('/');
        preview = `<a href="${href}"><img loading="lazy" src="${href}" alt="${escape(site.name)}"></a>
          <p class="availability">仅本地参考：图像字节已校验（SHA-256），不代表获得再发布授权。</p>`;
      }
      images.push(`<figure>${preview}
      <figcaption>${escape(image.view)} · ${image.width}×${image.height}
      <p><a href="${escape(image.pageUrl)}" target="_blank" rel="noreferrer">来源发布页</a> ·
      <a href="${escape(image.imageUrl)}" target="_blank" rel="noreferrer">原图来源</a></p>
      <p>SHA-256：<code>${escape(image.sha256)}</code></p>
      <p>${escape(image.license)}</p></figcaption></figure>`);
    }
    sections.push(`<section id="${escape(site.id)}"><h2>${escape(site.name)}</h2><div class="images">${images.join('')}</div>
      <p><b>可用于建模：</b>${escape(site.observations.join('；'))}</p>
      <p><b>尚未确认：</b>${escape(site.unknowns.join('；'))}</p></section>`);
  }
  await mkdir(join(root, 'output'), {recursive: true});
  await writeFile(join(root, 'output', 'reference-photos.html'), `<!doctype html><html lang="zh-CN">
    <meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>清华校园 · 建筑参考来源</title>
    <style>body{font:15px/1.8 "Segoe UI","Microsoft YaHei",sans-serif;max-width:1150px;margin:40px auto;padding:0 24px;background:#f5f3ed;color:#303b34}h1{font-weight:500}section{background:white;border:1px solid #dfdfd3;border-radius:14px;padding:24px;margin:24px 0}.images{display:flex;flex-wrap:wrap;gap:20px}figure{margin:0;flex:1;min-width:260px}img{width:100%;height:300px;object-fit:contain;background:#eceee7}figcaption{font-size:12px;color:#727967}code{overflow-wrap:anywhere}a{color:#765286}p{margin:10px 0}.availability{color:#765286}</style>
    <h1>清华校园 / 建筑参考来源</h1><p>当前 ${catalog.sites.length} 处地点。照片仅供本地观察与建模参考，不代表获得再发布或贴图授权；参考照片不是已经完成的三维模型。</p>
    <p>默认构建不读取或复制照片，也不声称照片验证通过。需要本地图库时运行 npm run build:references；完整图像证据检查运行 npm run test:references。</p>
    ${sections.join('')}</html>`);
}
