import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { resolveBasemap, sourceFrame } from '../tools/capture-core.mjs';

async function renderer(search) {
  let html;
  try { html = await readFile(new URL('../map.html', import.meta.url), 'utf8'); }
  catch (e) { if (e.code !== 'ENOENT') throw e; }
  assert.ok(html, 'portable renderer exists');
  const script = html.match(/<script type="module">([\s\S]*?)<\/script>/)[1].replace(/import [^;]+;/g, '');
  const elements = new Map();
  const element = () => ({ style: {}, classList: { toggle() {} }, append() {}, querySelector() { return this.label ||= element(); } });
  const get = id => { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); };
  class MapStub {
    constructor(options) { this.options = options; }
    on() {}
    once(event, callback) { queueMicrotask(callback); }
    jumpTo(pose) { this.camera = pose; }
    setProjection() {}
    getStyle() { return { layers: [], sources: {} }; }
    setLayoutProperty() {}
    cameraForBounds() { return { center: { lng: 116.32, lat: 40 }, zoom: 14 }; }
    getSource() { return { setData() {} }; }
    addSource() {}
    addLayer() {}
  }
  class Marker { setLngLat() { return this; } addTo() { return this; } }
  class ImageStub { set src(value) { this.url = value; queueMicrotask(() => this.onload()); } get src() { return this.url; } }
  const window = {};
  const context = vm.createContext({ window, location: { search }, URLSearchParams, resolveBasemap, sourceFrame,
    maplibregl: { Map: MapStub, Marker, LngLatBounds: class { extend() {} } },
    document: { fonts: { async load() {}, ready: Promise.resolve() }, createElement: element, querySelector: get, getElementById: get },
    Image: ImageStub, setTimeout() {}, clearTimeout() {},
    fetch: async p => ({ ok: true, json: async () => JSON.parse(await readFile(new URL('../' + p, import.meta.url))) }) });
  await vm.runInContext(`(async()=>{${script}})()`, context);
  await window.ready;
  return window;
}

test('renderer uses query whitelist and exact approved source times while preserving stable post-intro poses', async () => {
  const remap = JSON.parse(await readFile(new URL('../intro-remap.json', import.meta.url)));
  for (const mode of ['standard', 'satellite']) {
    const win = await renderer('?basemap=' + mode);
    assert.equal(win.map.options.style, `styles/${mode}.json`);
    assert.equal(win.map.options.attributionControl, false);
    assert.equal(win.basemap, mode);
    for (let frame = 0; frame < remap.length; frame++) {
      const pose = win.setTime(frame / 24);
      assert.equal(win.sourceFrame, remap[frame], `${mode} frame ${frame}`);
      assert.equal(win.currentTime, remap[frame] / 24);
      assert.equal(win.outputTime, frame / 24);
      assert.equal(win.pose.cacheKey, pose.cacheKey);
    }
    assert.equal(win.setTime(700 / 24).cacheKey, win.setTime(701 / 24).cacheKey);
    win.setTime(8524 / 24); assert.equal(win.sourceFrame, 8524);
    assert.throws(() => win.setTime(NaN), /time/);
  }
  assert.equal((await renderer('')).basemap, 'satellite');
  await assert.rejects(renderer('?basemap=evil'), /basemap/);
  await assert.rejects(renderer('?basemap=standard&basemap=satellite'), /basemap/);
});
