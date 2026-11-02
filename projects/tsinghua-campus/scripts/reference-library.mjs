// Offline inventory, archive verification and documentation. No network dependencies.
import {createHash} from 'node:crypto';
import {readFile, writeFile, readdir, mkdir, copyFile} from 'node:fs/promises';
import {resolve, relative, dirname, posix} from 'node:path';
import {fileURLToPath} from 'node:url';

export const projectRoot = resolve(import.meta.dirname, '..');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const slash = value => value.replaceAll('\\', '/');
const picture = path => /\.(?:jpe?g|png)$/i.test(path);
const json = async path => JSON.parse((await readFile(path, 'utf8')).replace(/^\uFEFF/, ''));
const optional = async path => { try { return await json(path); } catch (error) { if (error.code === 'ENOENT') return null; throw error; } };
const must = (condition, message) => { if (!condition) throw new Error(`Reference library: ${message}`); };
const validPath = value => typeof value === 'string' && !value.includes('\\') &&
  !value.startsWith('/') && !value.includes(':') && !value.split('/').includes('..') && posix.normalize(value) === value;
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const http = value => {
  try { const u = new URL(value); return ['https:', 'http:'].includes(u.protocol) && !u.username && !u.password; } catch { return false; }
};

async function walkFiles(directory) {
  let items;
  try { items = await readdir(directory, {withFileTypes: true}); }
  catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  const paths = [];
  for (const item of items) {
    must(!item.isSymbolicLink(), `symlink not accepted: ${item.name}`);
    const path = resolve(directory, item.name);
    if (item.isDirectory()) paths.push(...await walkFiles(path));
    else if (item.isFile()) paths.push(path);
  }
  return paths.sort();
}

/** Encoded pixel dimensions, NOT EXIF-oriented display dimensions. */
export function imageDimensions(bytes) {
  if (bytes.length >= 24 && bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) {
    must(bytes.toString('ascii', 12, 16) === 'IHDR', 'invalid PNG header');
    const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
    must(width > 0 && height > 0, 'zero PNG dimensions');
    return {width, height};
  }
  must(bytes.length > 4 && bytes[0] === 255 && bytes[1] === 216, 'expected JPEG or PNG');
  let offset = 2;
  while (offset < bytes.length) {
    must(bytes[offset++] === 255, 'invalid JPEG marker');
    while (bytes[offset] === 255) offset++;
    const marker = bytes[offset++];
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    must(offset + 2 <= bytes.length, 'truncated JPEG');
    const length = bytes.readUInt16BE(offset);
    must(length >= 2 && offset + length <= bytes.length, 'invalid JPEG segment');
    if ([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)) {
      must(length >= 8, 'invalid JPEG frame');
      const width = bytes.readUInt16BE(offset + 5), height = bytes.readUInt16BE(offset + 3);
      must(width > 0 && height > 0, 'zero JPEG dimensions');
      return {width, height};
    }
    offset += length;
  }
  throw new Error('Reference library: JPEG has no frame dimensions');
}

export function validateManifest(manifest) {
  must(manifest?.schemaVersion === 1 && manifest.reviewedAt === '2026-11-02', 'manifest version/date');
  must(manifest.pathBase === 'projects/tsinghua-campus', 'path base');
  must(Array.isArray(manifest.photos) && manifest.photos.length > 0, 'empty inventory');
  const paths = new Set(), ids = new Set(), archives = new Set();
  for (const p of manifest.photos) {
    must(validPath(p.localPath) && p.localPath.startsWith('references/') && picture(p.localPath), 'unsafe local path');
    must(!paths.has(p.localPath) && nonempty(p.id) && !ids.has(p.id), 'duplicate path/id');
    paths.add(p.localPath); ids.add(p.id);
    must(/^[0-9a-f]{64}$/.test(p.sha256) && Number.isSafeInteger(p.bytes) && p.bytes > 0, 'hash/bytes');
    must(Number.isInteger(p.width) && p.width > 0 && Number.isInteger(p.height) && p.height > 0, 'dimensions');
    must(Array.isArray(p.referenceSites) && p.referenceSites.every(nonempty) && nonempty(p.siteName), 'site fields');
    must(['recorded', 'unresolved'].includes(p.provenanceStatus), 'provenanceStatus');
    must(p.optionalLocalCopy === true && nonempty(p.use) && Array.isArray(p.limitations) &&
      p.limitations.length > 0 && p.limitations.every(nonempty), 'research usage');
    must(Array.isArray(p.provenance) && (p.provenanceStatus === 'unresolved' || p.provenance.length > 0), 'provenance');
    for (const r of p.provenance) {
      must(nonempty(r.metadataFile) && nonempty(r.pointer) && ['path-and-hash','byte-identical-alias'].includes(r.match), 'metadata evidence');
      must(r.pageUrl === null || http(r.pageUrl), 'source page URL');
      must(r.imageUrl === null || http(r.imageUrl), 'image URL');
    }
    must(nonempty(p.author) && nonempty(p.license) && (p.licenseUrl === null || http(p.licenseUrl)), 'rights fields');
    if (p.archive !== null) {
      const a = p.archive;
      must(p.provenanceStatus === 'recorded' && validPath(a.path) && a.path.startsWith('docs/reference-photos/') &&
        picture(a.path) && !archives.has(a.path), 'unsafe/duplicate archive path');
      archives.add(a.path);
      must(['CC-BY-SA-2.0', 'CC-BY-SA-4.0'].includes(p.license) && http(p.licenseUrl) &&
        p.author !== '未确认' && a.sha256 === p.sha256 && a.required === true &&
        nonempty(a.title) && nonempty(a.changes) && http(a.pageUrl) && a.verifiedAt === manifest.reviewedAt, 'unverified archive rights');
    }
  }
  return manifest;
}

/**
 * Validate every retained local byte if present, but require every approved archive.
 * A fresh clone intentionally may omit all restricted research originals.
 */
export async function verifyReferenceLibrary({root = projectRoot, requireLocal = false, publishedDirectory} = {}) {
  const manifest = validateManifest(await json(resolve(root, 'data/reference-photo-inventory.json')));
  const report = {inventoried: manifest.photos.length, verifiedLocal: 0, optionalMissing: 0, verifiedArchive: 0,
    unresolved: manifest.photos.filter(p => p.provenanceStatus === 'unresolved').length};
  async function check(path, entry, mandatory) {
    let bytes;
    try { bytes = await readFile(resolve(root, path)); }
    catch (error) {
      if (error.code === 'ENOENT' && !mandatory) { report.optionalMissing++; return false; }
      throw error;
    }
    must(sha(bytes) === entry.sha256, `SHA256 mismatch: ${path}`);
    const d = imageDimensions(bytes);
    must(bytes.length === entry.bytes && d.width === entry.width && d.height === entry.height, `size mismatch: ${path}`);
    return true;
  }
  const allowed = new Set(manifest.photos.map(p => p.localPath));
  for (const path of await walkFiles(resolve(root, 'references'))) {
    if (picture(path)) must(allowed.has(slash(relative(root, path))), `uninventoried photo: ${relative(root, path)}`);
  }
  const expectedArchive = new Set(manifest.photos.filter(p => p.archive).map(p => p.archive.path));
  for (const path of await walkFiles(resolve(root, 'docs/reference-photos'))) {
    if (picture(path)) must(expectedArchive.has(slash(relative(root, path))), `unapproved archive photo: ${path}`);
  }
  for (const p of manifest.photos) {
    if (await check(p.localPath, p, requireLocal)) report.verifiedLocal++;
    if (p.archive) {
      await check(p.archive.path, p, true);
      report.verifiedArchive++;
    }
  }
  const rights = await json(resolve(root, 'data/reference-archive-rights.json'));
  must(rights.schemaVersion === 1 && rights.images.length === expectedArchive.size, 'archive rights count mismatch');
  for (const r of rights.images) {
    const p = manifest.photos.find(p => p.localPath === r.localPath);
    must(p?.archive?.path === r.archivePath && p.sha256 === r.sha256 && p.author === r.author &&
      p.license === r.license && p.licenseUrl === r.licenseUrl && p.archive.changes === r.changes &&
      p.archive.title === r.title && p.archive.pageUrl === r.pageUrl && p.archive.verifiedAt === r.verifiedAt, 'archive attribution mismatch');
  }
  if (publishedDirectory) {
    const forbiddenHashes = new Set(manifest.photos.map(p => p.sha256));
    for (const path of await walkFiles(resolve(publishedDirectory))) {
      if (picture(path)) must(!forbiddenHashes.has(sha(await readFile(path))), `reference pixels in public build: ${path}`);
      must(!slash(path).includes('/reference-photos/'), `reference archive in public build: ${path}`);
    }
  }
  return report;
}

/** Explicit maintainer operation; only exact path+hash or byte-identical aliases count as provenance. */
export async function snapshotInventory(root = projectRoot) {
  const catalog = await json(resolve(root, 'reference-catalog.json'));
  const appearances = await json(resolve(root, 'data/appearance-profiles.json'));
  const sites = [...catalog.sites, ...appearances.sites];
  const knownSites = new Map(sites.map(s => [s.id, s.name]));
  const previous = await optional(resolve(root, 'data/reference-photo-inventory.json'));
  const rights = await json(resolve(root, 'data/reference-archive-rights.json'));
  const metadataFiles = [
    'reference-catalog.json', 'data/appearance-profiles.json',
    ...(await readdir(resolve(root, 'data'))).filter(f => /(?:references|sources)\.json$/.test(f)).map(f => `data/${f}`),
    'data/gongzi-source.json', 'data/zijing-evidence.json',
    'output/appearance-classroom-downloads.json', 'output/appearance-extra-downloads.json',
    'output/appearance-research-downloads.json',
  ];
  const candidates = [];
  function collect(value, file, pointer = '', inherited = {}) {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) { value.forEach((v, i) => collect(v, file, `${pointer}/${i}`, inherited)); return; }
    const context = {...inherited};
    if (knownSites.has(value.id)) { context.site = value.id; context.name = knownSites.get(value.id); }
    else if (value.name) context.name = value.name;
    if (value.license) context.license = value.license;
    const path = value.path || value.localPath;
    if (path && picture(path) && /^[a-f0-9]{64}$/.test(value.sha256)) {
      candidates.push({path: slash(path).replace(/^projects\/tsinghua-campus\//, ''), sha256: value.sha256,
        metadataFile: file, pointer: pointer || '/', pageUrl: value.pageUrl || value.referencePage || null,
        imageUrl: value.imageUrl || value.url || null, license: value.license || context.license || '未查得再分发许可',
        view: value.view || null, site: context.site || null, siteName: context.name || '未确认'});
    }
    for (const [k, v] of Object.entries(value)) collect(v, file, `${pointer}/${k}`, context);
  }
  for (const file of metadataFiles) {
    const data = await optional(resolve(root, file));
    if (data) collect(data, file);
  }
  const photos = [];
  for (const path of (await walkFiles(resolve(root, 'references'))).filter(picture)) {
    const localPath = slash(relative(root, path)), bytes = await readFile(path), hash = sha(bytes);
    const matches = candidates.filter(c => c.sha256 === hash);
    const old = previous?.photos.find(p => p.localPath === localPath && p.sha256 === hash);
    const provenance = matches.map(c => ({metadataFile: c.metadataFile, pointer: c.pointer,
      match: c.path === localPath ? 'path-and-hash' : 'byte-identical-alias',
      pageUrl: c.pageUrl, imageUrl: c.imageUrl, license: c.license, view: c.view, recordedPath: c.path}));
    for (const r of old?.provenance || []) {
      if (!provenance.some(p => p.metadataFile === r.metadataFile && p.pointer === r.pointer)) provenance.push(r);
    }
    const r = rights.images.find(r => r.localPath === localPath);
    const derivative = localPath.includes('chemistry-hall-') && localPath.endsWith('-review.jpg');
    const derivativeOf = derivative ? localPath.replace('-review.jpg', '.jpg') : null;
    const parentRights = rights.images.find(r => r.localPath === derivativeOf);
    const allSites = [...new Set([...matches.map(c => c.site).filter(Boolean), ...old?.referenceSites || []])];
    const sourceNames = [...new Set(matches.map(c => c.siteName).filter(n => n !== '未确认'))];
    const recordedAuthors = {
      'references/tongfang-official-2018.jpg': '李派（摄影）；任帅（图片设计）；校史馆（素材）',
      'references/second-gate-modern-complete.jpg': '贾珺',
      'references/sem-tour-567.jpg': '李宙',
    };
    const author = r?.author || parentRights?.author || recordedAuthors[localPath] || '未确认';
    const license = r?.license || parentRights?.license || (provenance.length ? '未查得开放再分发许可' : '未确认');
    const reviewNotes = derivative
      ? '本地审阅衍生图：按EXIF转正（若有）、等比缩小并以JPEG quality94编码；无内容修补，作者及CC BY-SA 4.0沿用原图。'
      : '原始保存字节；是否相机原片未知。';
    const p = {
      id: localPath.slice('references/'.length).replace(/\.[^.]+$/, ''),
      localPath, sha256: hash, bytes: bytes.length, ...imageDimensions(bytes),
      referenceSites: allSites, siteName: sourceNames.join(' / ') || old?.siteName || '未确认；文件名仅为查找线索',
      provenanceStatus: provenance.some(p => p.pageUrl || p.imageUrl) ? 'recorded' : 'unresolved',
      provenance, author, license, licenseUrl: r?.licenseUrl || parentRights?.licenseUrl || null,
      optionalLocalCopy: true, derivativeOf, changes: reviewNotes,
      use: '仅作合法本地观察、身份核对和可见结构比较；不作模型纹理，不随Pages或离线应用发布。',
      limitations: [
        provenance.length ? '记录来源不等于已取得像素再发布权；网页正文作者不自动等于摄影者。' :
          '来源页、原图URL、作者与许可均未匹配确认；不能从文件名中的official或commons推定授权。',
        '照片只约束入镜部分；不证明背面、屋顶、隐藏尺度或最新现状；不代表完成三维复原。',
        ...(allSites.length ? [] : ['未绑定确切referenceSite；不得凭文件名自动映射到楼宇知识卡。']),
        ...(derivative ? ['衍生图不重复算作新的原发布照片；这里只记录、不复制到跟踪档案。'] : []),
      ],
      archive: r ? {path: r.archivePath, required: true, title: r.title, pageUrl: r.pageUrl,
        sha256: r.sha256, changes: r.changes, verifiedAt: r.verifiedAt} : null,
    };
    if (r) must(r.sha256 === hash && provenance.length > 0, `licensed original drift: ${localPath}`);
    photos.push(p);
  }
  const manifest = {
    schemaVersion: 1, reviewedAt: '2026-11-02', pathBase: 'projects/tsinghua-campus',
    scope: 'references/下全部JPEG/PNG，包括未接入模型的研究照片与两张审阅衍生图；不包括字体、XML、自动生成截图和output/图库重复副本。',
    metadataFiles,
    siblingReferences: [
      {path: '../shunde/references/sohu_old_2.jpg', metadata: '../shunde/docs/courtyard/photo-correspondence.json',
        status: '本机目录不存在；对应同SHA256照片已列为references/shunde-courtyard-oblique.jpg，未新增缺失副本。'},
      {path: null, referenceId: 'user_front', metadata: '../shunde/docs/courtyard/photo-correspondence.json',
        status: 'metadata只有user_front标识及哈希，未记录原文件名；本机邻项目references目录不存在，不臆造本地路径或来源。'}
    ],
    photos,
  };
  validateManifest(manifest);
  await writeFile(resolve(root, 'data/reference-photo-inventory.json'), JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}

/** Explicit local copy, never a build hook; only frozen approved originals are eligible. */
export async function archiveApprovedPhotos(root = projectRoot) {
  const rights = await json(resolve(root, 'data/reference-archive-rights.json'));
  const manifest = validateManifest(await json(resolve(root, 'data/reference-photo-inventory.json')));
  for (const r of rights.images) {
    const p = manifest.photos.find(p => p.localPath === r.localPath);
    must(p?.archive?.path === r.archivePath && p.sha256 === r.sha256, 'unapproved archive operation');
    const bytes = await readFile(resolve(root, r.localPath));
    must(sha(bytes) === r.sha256, `original drift: ${r.localPath}`);
    await mkdir(dirname(resolve(root, r.archivePath)), {recursive: true});
    await copyFile(resolve(root, r.localPath), resolve(root, r.archivePath));
  }
}

export function historyMarkdown(history) {
  const sources = new Map(history.sources.map(s => [s.id, s]));
  const refs = ids => ids.map(id => { const s = sources.get(id); return `[${s.title} · ${s.publisher}](${s.url})`; }).join('；');
  const out = ['# 建筑历史与知识卡数据', '',
    `核验日期：${history.reviewedAt}。本页由 \`data/building-history.json\` 生成；事实以短篇原创中文转述，不复制来源文章。`, '',
    '## 读取契约与范围', '',
    '`src/building-history.js` 导出 `historyForSite(site)`、`HISTORY_SOURCES`（sources的同一只读数组）、`sources`、`entries`、`reviewedAt`、`validateBuildingHistory(data, {knownSites})`。只按精确 `referenceSite` / `appearanceReferenceSite` 查找；未知或缺失返回 `null`，不做名称模糊匹配。错误记录在模块加载时抛出，已导出的数据深冻结。', '',
    'UI先读取对象的referenceSite，再读取appearanceReferenceSite；使用textContent渲染纯文本，以sourceIds解析来源链接。null显示“尚无已核实建筑史”，不能显示成“没有历史”。同一site可对应多个地图根，但组团事实不能变成每栋的竣工年份。', '',
    '本次限定19个主要地点；未核实的照片外观地点不附会年代。无建筑文字证据时architecture为空，并在limitations明确说明。source.accessedAt是本次读取日期，reviewedAt是数据审阅日期，不是网页发表或建筑完成日期。', '',
    '校方公开网页在web_fetch中遇到本机DNS地址限制后，使用Python HTTPS读取同一公开URL核验；没有依赖搜索摘要作为事实证据。部分来源仅有建筑概况，没有准确开工或开馆日，保持未知。', '',
    '照片权限、完整逐文件表及离线核验见 [参考照片库](REFERENCE-LIBRARY.md)；文字可引用不意味着照片可转载。模型形体与历史事实分别核验，本数据不提高照片重建覆盖率。', '',
    '## 逐处事实', ''];
  for (const entry of history.entries) {
    out.push(`### ${entry.name}`, '', `键：${entry.referenceSites.map(id => `\`${id}\``).join('、')}`, '', entry.summary, '');
    for (const f of entry.facts) out.push(`- **${f.label}**：${f.text}（${refs(f.sourceIds)}）`);
    for (const a of entry.architecture) out.push(`- **建筑**：${a.text}（${refs(a.sourceIds)}）`);
    for (const l of entry.limitations) out.push(`- **边界／未知**：${l}`);
    out.push('');
  }
  out.push('## 来源登记', '');
  for (const source of history.sources) out.push(`- \`${source.id}\`：[${source.title}](${source.url})；${source.publisher}；访问：${source.accessedAt}。`);
  return out.join('\n') + '\n';
}

export function referenceMarkdown(manifest) {
  const archived = manifest.photos.filter(p => p.archive);
  const unresolved = manifest.photos.filter(p => p.provenanceStatus === 'unresolved');
  const licensed = manifest.photos.filter(p => p.licenseUrl);
  const out = ['# 清华校园参考照片库', '',
    `审阅：${manifest.reviewedAt}。共 **${manifest.photos.length}** 个本地照片文件（按路径计，含2张审阅衍生图），**${archived.length}** 张已核实开放许可原图纳入文档档案；**${licensed.length}** 个文件有明确开放许可（含衍生图）；**${unresolved.length}** 个文件来源未解决。`, '',
    '## 路径、权限与用途', '',
    '机器清单：[reference-photo-inventory.json](../data/reference-photo-inventory.json)。所有localPath相对于projects/tsinghua-campus；尺寸为文件编码尺寸而非EXIF转正后的显示尺寸。SHA256覆盖文件原始字节，不因换行、元数据或转正而忽略差异。相同哈希的不同路径仍逐项登记。', '',
    '扫描整个references/照片目录，而非只列已经接入模型的图片；来源汇合reference-catalog.json、data中的照片/外观/来源记录，以及原有忽略目录中的appearance下载日志。日志中的有效证据已固化在每条provenance中，因此全新克隆不需要那些日志。path-and-hash表示路径与哈希匹配；byte-identical-alias表示另一个路径字节完全相同，不凭文件名推断来源。', '',
    '受限及未知照片原件保持在被Git忽略的references/，不移动、不删除、不去水印；缺失是允许的，缺失不等于照片已通过检验。官方公开网页、可下载、文件名中的official/commons均不是再发布许可。默认未确认摄影作者；文章作者或记者不自动认定为摄影作者。', '',
    '仅docs/reference-photos/内的三张原图是明确批准的版本化照片档案。它们不受源码MIT覆盖，适用各自CC BY-SA许可；复制、改编须保留署名、来源、许可链接及修改说明，改编另须遵守相同方式共享，不暗示作者为本项目背书。许可可能不涵盖其他独立权利；仅归档许可明确的文件。', '',
    '该档案是仓库文档，不是网站图库。禁止将任何参考像素加入Pages、离线应用或纹理；现有Pages显式复制清单不包含docs/reference-photos/，无需放宽.gitignore或把references/改为public目录。本工具从不联网，普通build不复制档案。', '',
    '## 开放许可档案及完整署名', '',
    '以下副本逐字节保留原文件；没有新制作的照片衍生图。已有两个化学馆审阅衍生图只登记于本地清单，不复制到文档档案。', ''];
  for (const p of archived) {
    const a = p.archive;
    out.push(`### ${a.title}`, '', `- 文件：[${a.path}](../${a.path})`,
      `- 作者：**${p.author}**；来源：[Commons文件页](${a.pageUrl})。`,
      `- 许可：[${p.license}](${p.licenseUrl})；核验日期：${a.verifiedAt}。`,
      `- 修改说明：${a.changes}`, `- SHA256：\`${p.sha256}\`。`, '');
  }
  out.push('## 全部照片逐文件登记', '',
    '每项均记录来源页／原图（如已知）、作者／许可、归属／用途及限制。来源未解决者不能进入许可档案；以后核实需保存来源页证据、对比下载文件SHA256并单独审阅授权，不能以补猜URL关闭未知。', '');
  for (const p of manifest.photos) {
    out.push(`### ${p.id}`, '', `- 本地路径：\`${p.localPath}\`（研究副本可缺失）`,
      `- SHA256：\`${p.sha256}\`；${p.width}×${p.height}；${p.bytes}字节。`,
      `- 建筑／地点：${p.siteName}；site：${p.referenceSites.length ? p.referenceSites.join('、') : '未确认／未注册'}。`,
      `- 作者：${p.author}；许可：${p.license}${p.licenseUrl ? `（${p.licenseUrl}）` : ''}。`,
      `- 来源状态：${p.provenanceStatus === 'recorded' ? '已记录（不等于授权）' : '未解决'}。`);
    const seen = new Set();
    for (const r of p.provenance) {
      const key = `${r.pageUrl}|${r.imageUrl}`;
      if (!seen.has(key)) {
        out.push(`- 来源页：${r.pageUrl || '未确认'}；原图：${r.imageUrl || '未确认'}。`);
        seen.add(key);
      }
    }
    if (!p.provenance.length) out.push('- 来源页／原图URL：均未确认，不臆造链接。');
    out.push(`- 文件说明：${p.changes}${p.derivativeOf ? ` 原图：\`${p.derivativeOf}\`。` : ''}`,
      `- 用途：${p.use}`, ...p.limitations.map(l => `- 限制：${l}`), '');
  }
  out.push('## 邻项目与范围排除', '', manifest.scope, '');
  for (const sibling of manifest.siblingReferences) out.push(`- \`${sibling.path || sibling.referenceId}\`：${sibling.status} 线索：\`${sibling.metadata}\`。`);
  out.push('', '同目录的字体/OFL及OSM XML不是照片，继续沿用原有许可和测试；output/的截图、拼图和图库副本不是新增原发布照片。', '',
    '## 离线复核与更新', '',
    '从仓库根执行：', '', '```sh',
    'node projects/tsinghua-campus/scripts/reference-library.mjs',
    'node projects/tsinghua-campus/scripts/reference-library.mjs --require-local',
    'node --test projects/tsinghua-campus/tests/building-history.test.mjs projects/tsinghua-campus/tests/reference-library.test.mjs',
    '```', '',
    '默认核验：每张仍存在的研究照片都验证SHA256、字节数和尺寸；缺失研究照片明确计入optionalMissing；三张文档档案必须存在并匹配；新出现但未登记照片或未批准档案会失败。--require-local要求全部研究原件在场。', '',
    '维护者确认新增照片证据后才运行--snapshot；--archive仅复制预先批准的原图且校验哈希；--write-docs从冻结JSON生成本页及BUILDING-HISTORY.md。不要把这些维护操作加入普通构建或测试。', '',
    '发布完成构建后可额外运行`node projects/tsinghua-campus/scripts/reference-library.mjs --published output/pages`排查已登记原始像素或reference-photos目录泄漏。该检查不替代人工检查二次压缩、重命名衍生图和打包内嵌图像。', '');
  return out.join('\n');
}

export async function writeDocs(root = projectRoot) {
  const manifest = validateManifest(await json(resolve(root, 'data/reference-photo-inventory.json')));
  const history = await json(resolve(root, 'data/building-history.json'));
  await mkdir(resolve(root, 'docs'), {recursive: true});
  await writeFile(resolve(root, 'docs/REFERENCE-LIBRARY.md'), referenceMarkdown(manifest));
  await writeFile(resolve(root, 'docs/BUILDING-HISTORY.md'), historyMarkdown(history));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--snapshot') {
    const m = await snapshotInventory(); console.log(`Inventoried ${m.photos.length} photographs.`);
  } else if (args.length === 1 && args[0] === '--archive') {
    await archiveApprovedPhotos(); console.log('Copied approved original bytes into docs/reference-photos only.');
  } else if (args.length === 1 && args[0] === '--write-docs') {
    await writeDocs(); console.log('Generated Chinese reference and history documentation.');
  } else if (args.length === 0 || (args.length === 1 && args[0] === '--require-local') ||
      (args.length === 2 && args[0] === '--published')) {
    console.log(JSON.stringify(await verifyReferenceLibrary({requireLocal: args[0] === '--require-local',
      publishedDirectory: args[0] === '--published' ? args[1] : undefined}), null, 2));
  } else throw new Error('Use reference-library.mjs [--require-local | --published DIRECTORY | --snapshot | --archive | --write-docs]');
}
