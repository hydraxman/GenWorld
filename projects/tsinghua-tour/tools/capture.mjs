import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseArgs, selectFrames, findBrowser, startServer, computeFingerprint,
  openCapture, framePath, commitFrame, saveReport, sha256,
} from './capture-core.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

// One page, serial seeks. Identical poses can reuse a verified image, but each
// global frame keeps its own output/source times and checksum in the report.
export async function renderFrames(page, cache, frames, fps) {
  cache.report.requested_frames = frames;
  let processed = 0;
  try {
    for (const frame of frames) {
      if (cache.byFrame.has(frame)) continue;
      const state = await page.evaluate(t => {
        const pose = window.setTime(t);
        return { pose, output_time: window.outputTime, source_time: window.currentTime,
          source_frame: window.sourceFrame, visiblePoemText: window.visiblePoemText };
      }, frame / fps);
      const poseKey = await sha256(state.pose.cacheKey);
      const reused = cache.poses.get(poseKey);
      let bytes, info;
      if (reused !== undefined) {
        bytes = await fs.readFile(framePath(cache, reused));
        if (await sha256(bytes) !== cache.byFrame.get(reused).sha256) throw new Error('Cached image changed during capture');
        info = { loaded: true, reused_from: reused };
      } else {
        await page.waitForFunction(() => window.map.loaded() && window.map.areTilesLoaded(), { timeout: 90000, polling: 40 });
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        info = await page.evaluate(() => ({
          loaded: window.map.loaded() && window.map.areTilesLoaded(),
          mapErrors: window.mapErrors.splice(0),
          attribution: document.querySelector('.maplibregl-ctrl-attrib')?.innerText || '',
          star_background: getComputedStyle(document.body).backgroundImage,
        }));
        if (!info.loaded || info.attribution || info.mapErrors.length || cache.report.errors.length) {
          throw new Error('Renderer/network validation failed: ' + JSON.stringify(info));
        }
        bytes = await page.screenshot({ type: 'jpeg', quality: 95 });
      }
      await commitFrame(cache, frame, bytes, { ...state, ...info, poseKey });
      if (++processed % 100 === 0) {
        await saveReport(cache);
        console.log(JSON.stringify({ frames_done: cache.report.frames_done, total_frames: cache.report.total_frames }));
      }
    }
    if (cache.report.errors.length) throw new Error('Network or browser errors recorded');
  } catch (error) {
    cache.report.errors.push(error.message);
    throw error;
  } finally {
    cache.report.requested_done = frames.filter(f => cache.byFrame.has(f)).length;
    cache.report.request_complete = cache.report.requested_done === frames.length && cache.report.errors.length === 0;
    await saveReport(cache);
  }
}

export async function main(args = process.argv.slice(2)) {
  const options = parseArgs(args);
  const timing = JSON.parse(await fs.readFile(path.join(ROOT, 'timing.json'), 'utf8'));
  const frames = selectFrames(timing, options);
  if (!frames.length) throw new Error('No representative frames in the requested range');
  let server, browser, cache;
  try {
    if (options.serve) {
      server = await startServer(ROOT);
      console.log(`http://127.0.0.1:${server.address().port}/map.html?basemap=${options.basemap}`);
      await new Promise(resolve => {
        const stop = () => { process.off('SIGINT', stop); process.off('SIGTERM', stop); resolve(); };
        process.once('SIGINT', stop); process.once('SIGTERM', stop);
      });
      return;
    }
    const { default: puppeteer } = await import('puppeteer-core');
    browser = await puppeteer.launch({ executablePath: await findBrowser(), headless: true,
      args: process.platform === 'darwin' ? ['--use-gl=angle', '--use-angle=metal'] : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    const spec = await computeFingerprint(ROOT, options.basemap, { fps: timing.fps, browser: await browser.version(), platform: process.platform });
    cache = await openCapture(path.resolve(ROOT, options.out), spec, timing.total_frames, options.preview);
    if (frames.some(frame => !cache.byFrame.has(frame))) {
      server = await startServer(ROOT);
      const page = await browser.newPage();
      page.on('pageerror', error => cache.report.errors.push(error.message));
      page.on('requestfailed', request => {
        const error = request.failure()?.errorText || 'request failed';
        cache.report.network.push({ url: request.url(), error });
        // Camera seeks legitimately abort superseded tile requests.
        if (error !== 'net::ERR_ABORTED') cache.report.errors.push(`${error}: ${request.url()}`);
      });
      page.on('response', response => {
        if (response.status() >= 400) {
          cache.report.network.push({ url: response.url(), status: response.status() });
          cache.report.errors.push(`HTTP ${response.status()}: ${response.url()}`);
        }
      });
      await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
      await page.goto(`http://127.0.0.1:${server.address().port}/map.html?basemap=${options.basemap}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
      await page.waitForFunction(() => window.ready && window.setTime, { timeout: 90000 });
      await page.evaluate(() => window.ready);
      await renderFrames(page, cache, frames, timing.fps);
      await page.close();
    } else {
      cache.report.requested_frames = frames;
      cache.report.requested_done = frames.length;
      cache.report.request_complete = true;
    }
    // Fail closed if local render inputs changed while the browser was running.
    if ((await computeFingerprint(ROOT, options.basemap, spec.settings)).fingerprint !== spec.fingerprint) throw new Error('Render inputs changed during capture; use a new --out');
    await saveReport(cache);
    console.log(JSON.stringify({ basemap: options.basemap, frames_done: cache.report.frames_done, total_frames: timing.total_frames,
      requested_done: cache.report.requested_done, complete: cache.report.complete, report: cache.reportPath, errors: cache.report.errors.length }));
  } catch (error) {
    if (cache && !cache.report.errors.includes(error.message)) cache.report.errors.push(error.message);
    throw error;
  } finally {
    // Stop listening before closing Chrome so teardown aborts do not mark good
    // frames as network failures. Every failure path still checkpoints the report.
    if (browser) {
      for (const page of await browser.pages()) { page.removeAllListeners('requestfailed'); page.removeAllListeners('response'); }
      await browser.close();
    }
    if (server) await new Promise(resolve => server.close(resolve));
    if (cache) await saveReport(cache);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
