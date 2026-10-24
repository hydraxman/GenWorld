// The two pure renderer helpers also run in the browser. Node APIs are loaded
// only by the capture/server functions below, never by the page's import.
export function resolveBasemap(value) {
  if (value == null) return 'satellite';
  if (!['standard', 'satellite'].includes(value)) throw new Error('Invalid basemap: use standard or satellite');
  return value;
}

export function sourceFrame(frame, remap) {
  if (!Number.isSafeInteger(frame) || frame < 0) throw new Error('Invalid frame');
  if (!Array.isArray(remap) || remap.length !== 409 || !remap.every(n => Number.isSafeInteger(n) && n >= 0 && n <= 408)) {
    throw new Error('Invalid intro remap');
  }
  return frame < remap.length ? remap[frame] : frame;
}

// Do not grant directory-wide access: manifests enumerate photos, and only
// renderer font formats and the pinned MapLibre runtime chunks are public.
export async function publicAssets(root) {
  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  const assets = new Set(['map.html', 'route.json', 'timing.json', 'intro-remap.json',
    'stars.svg', 'photos/all-manifest.json', 'styles/standard.json', 'styles/satellite.json',
    'tools/capture-core.mjs', 'node_modules/maplibre-gl/dist/maplibre-gl.mjs',
    'node_modules/maplibre-gl/dist/maplibre-gl-shared.mjs',
    'node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs',
    'node_modules/maplibre-gl/dist/maplibre-gl.css']);
  const photos = JSON.parse(await fs.readFile(path.join(root, 'photos/all-manifest.json'), 'utf8'));
  for (const photo of photos) {
    if (!/^[\w-]+\.(?:jpg|jpeg|png|webp)$/.test(photo.local_filename)) throw new Error('Invalid photo filename');
    assets.add(`photos/${photo.local_filename}`);
  }
  for (const name of await fs.readdir(path.join(root, 'fonts'))) {
    if (/^[\w.-]+\.(?:ttf|otf|woff2?)$/.test(name)) assets.add(`fonts/${name}`);
  }
  return assets;
}

export async function startServer(root) {
  const fs = await import('node:fs/promises');
  const { constants } = await import('node:fs');
  const path = await import('node:path');
  const { createServer } = await import('node:http');
  root = await fs.realpath(root);
  const allowed = await publicAssets(root);
  const types = { '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript', '.css': 'text/css',
    '.json': 'application/json', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.otf': 'font/otf',
    '.woff': 'font/woff', '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };
  const server = createServer(async (req, res) => {
    const host = `127.0.0.1:${server.address().port}`;
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    if (req.headers.host !== host || (req.headers.origin !== undefined && req.headers.origin !== `http://${host}`)) {
      res.writeHead(403).end(); return;
    }
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405, { Allow: 'GET, HEAD' }).end(); return; }
    let handle;
    try {
      // Validate raw segments before URL normalization can erase traversal.
      const raw = req.url.split('?')[0];
      if (!raw.startsWith('/') || /%2f|%5c/i.test(raw)) throw new Error('path');
      const decoded = decodeURIComponent(raw);
      const parts = decoded.slice(1).split('/');
      if (/[\\\x00-\x1f%]/.test(decoded) || parts.some(p => !p || p === '.' || p === '..')) throw new Error('path');
      const rel = parts.join('/');
      if (!allowed.has(rel)) throw new Error('path');
      const file = path.join(root, ...parts);
      const real = await fs.realpath(file);
      if (!real.startsWith(root + path.sep) || real !== file) throw new Error('boundary');
      handle = await fs.open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
      const stat = await handle.stat();
      if (!stat.isFile()) throw new Error('file');
      res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Content-Length': stat.size });
      if (req.method === 'HEAD') res.end();
      else res.end(await handle.readFile());
    } catch {
      if (!res.headersSent) res.writeHead(404).end();
      else res.destroy();
    } finally { await handle?.close(); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  return server;
}

export async function sha256(bytes) {
  const { createHash } = await import('node:crypto');
  return createHash('sha256').update(bytes).digest('hex');
}

export async function computeFingerprint(root, mode, options = {}) {
  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  const basemap = resolveBasemap(mode);
  const settings = { width: 1280, height: 720, fps: 24, quality: 95, schema: 1, ...options };
  const assets = await publicAssets(root);
  assets.delete(`styles/${basemap === 'standard' ? 'satellite' : 'standard'}.json`);
  for (const file of ['tools/capture.mjs', 'package.json', 'package-lock.json']) assets.add(file);
  const files = {};
  for (const file of [...assets].sort()) files[file] = await sha256(await fs.readFile(path.join(root, file)));
  const fingerprint = await sha256(JSON.stringify({ basemap, settings, files }));
  return { fingerprint, basemap, settings, files };
}

export function framePath(cache, frame) {
  return cache.join(cache.frameDir, `frame-${String(frame).padStart(5, '0')}.jpg`);
}

export async function atomicWrite(file, bytes) {
  const fs = await import('node:fs/promises');
  const { randomUUID } = await import('node:crypto');
  const temporary = `${file}.${randomUUID()}.part`;
  try {
    await fs.writeFile(temporary, bytes, { flag: 'wx' });
    await fs.rename(temporary, file);
  } finally { await fs.rm(temporary, { force: true }); }
}

export async function openCapture(out, spec, totalFrames, preview) {
  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  const reportPath = path.join(out, preview ? 'preview-report.json' : 'capture-report.json');
  const frameDir = path.join(out, preview ? 'previews' : 'frames');
  await fs.mkdir(frameDir, { recursive: true });
  let previous;
  try { previous = JSON.parse(await fs.readFile(reportPath, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (previous && (previous.fingerprint !== spec.fingerprint || previous.basemap !== spec.basemap || previous.total_frames !== totalFrames)) {
    throw new Error('Capture fingerprint/basemap changed; choose a new --out directory');
  }
  if (!previous && (await fs.readdir(frameDir)).some(n => /^frame-\d+\.jpg$/.test(n))) {
    throw new Error('Unbound frames without a fingerprint report; choose a new --out directory');
  }
  const report = previous || { ...spec, mode: spec.basemap, total_frames: totalFrames, views: [], errors: [], network: [], attempts: [] };
  if (report.errors.length) report.attempts.push({ errors: report.errors, frames_done: report.frames_done });
  report.errors = [];
  const cache = { report, reportPath, frameDir, join: path.join, byFrame: new Map(), poses: new Map() };
  for (const view of report.views) {
    if (!Number.isSafeInteger(view.frame) || view.frame < 0 || view.frame >= totalFrames) throw new Error('Invalid report frame');
    try {
      const actual = await sha256(await fs.readFile(framePath(cache, view.frame)));
      if (actual === view.sha256) {
        cache.byFrame.set(view.frame, view);
        cache.poses.set(view.poseKey, view.frame);
      }
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  await saveReport(cache);
  return cache;
}

export async function commitFrame(cache, frame, bytes, info) {
  if (!Number.isSafeInteger(frame) || frame < 0 || frame >= cache.report.total_frames) throw new Error('Invalid frame');
  await atomicWrite(framePath(cache, frame), bytes);
  const view = { ...info, frame, sha256: await sha256(bytes) };
  cache.byFrame.set(frame, view);
  cache.poses.set(info.poseKey, frame);
}

export async function saveReport(cache) {
  cache.report.views = [...cache.byFrame.values()].sort((a, b) => a.frame - b.frame);
  cache.report.frames_done = cache.report.views.length;
  cache.report.complete = cache.report.frames_done === cache.report.total_frames && cache.report.errors.length === 0;
  await atomicWrite(cache.reportPath, JSON.stringify(cache.report, null, 2) + '\n');
}

export function parseArgs(args) {
  const options = { preview: false, serve: false, from: 0 };
  const seen = new Set();
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (!['--basemap', '--from', '--to', '--out', '--preview', '--serve'].includes(flag) || seen.has(flag)) throw new Error(`Unknown or duplicate option: ${flag}`);
    seen.add(flag);
    const key = flag.slice(2);
    if (['preview', 'serve'].includes(key)) options[key] = true;
    else {
      const value = args[++i];
      if (!value || value.startsWith('--')) throw new Error(`Missing value: ${flag}`);
      if (['from', 'to'].includes(key)) {
        if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value))) throw new Error('Invalid frame number');
        options[key] = Number(value);
      } else options[key] = value;
    }
  }
  if (options.preview && options.serve) throw new Error('Choose preview or serve');
  options.basemap = resolveBasemap(options.basemap);
  options.out ??= `output/${options.basemap}`;
  return options;
}

export function selectFrames(timing, options) {
  const from = options.from ?? 0, to = options.to ?? timing.total_frames;
  if (from < 0 || from >= to || to > timing.total_frames) throw new Error('Invalid frame range: --to is exclusive');
  if (!options.preview) return Array.from({ length: to - from }, (_, i) => from + i);
  const voice = timing.voices.find(v => v.id === 'couplet');
  const frames = [0, 96, 192, 288, 408,
    ...timing.segments.filter(s => s.kind === 'hold').map(s => Math.floor((s.start_frame + s.end_frame) / 2)),
    ...[3, 8.5, 16.9].map(t => Math.round(voice.start_frame + t * timing.fps)), timing.total_frames - 1];
  return [...new Set(frames)].filter(f => f >= from && f < to).sort((a, b) => a - b);
}

export async function findBrowser(env = process.env, platform = process.platform) {
  const fs = await import('node:fs/promises');
  const { constants } = await import('node:fs');
  const path = await import('node:path');
  const { homedir } = await import('node:os');
  const executable = async file => {
    try { await fs.access(file, platform === 'win32' ? constants.F_OK : constants.X_OK); return (await fs.stat(file)).isFile(); }
    catch { return false; }
  };
  if (env.CHROME_PATH) {
    if (await executable(env.CHROME_PATH)) return env.CHROME_PATH;
    throw new Error('CHROME_PATH is not an executable browser file');
  }
  const candidates = [];
  if (platform === 'darwin') {
    for (const base of ['/Applications', path.join(homedir(), 'Applications')]) {
      for (const name of ['Google Chrome', 'Microsoft Edge', 'Chromium']) candidates.push(path.join(base, `${name}.app`, 'Contents/MacOS', name));
    }
  } else if (platform === 'win32') {
    for (const base of [env.PROGRAMFILES, env['PROGRAMFILES(X86)'], env.LOCALAPPDATA].filter(Boolean)) {
      for (const suffix of ['Google/Chrome/Application/chrome.exe', 'Microsoft/Edge/Application/msedge.exe', 'Chromium/Application/chrome.exe']) candidates.push(path.join(base, suffix));
    }
  }
  for (const base of (env.PATH || '').split(path.delimiter).filter(Boolean)) {
    for (const name of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge', 'microsoft-edge-stable', 'chrome.exe', 'msedge.exe']) candidates.push(path.join(base, name));
  }
  for (const file of candidates) if (await executable(file)) return file;
  throw new Error('Chrome/Edge/Chromium not found; set CHROME_PATH to its executable');
}
