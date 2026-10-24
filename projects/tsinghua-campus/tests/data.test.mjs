import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  area, bounds, boundsOverlap, buildingHeights, canonicalGeometry, clipLines, geometryId,
  inside, intersect, mapGeometry, mergePolygons, multi, polygon, project, rectangle,
  sha256, signedArea, unproject, validateGeometry,
} from '../scripts/data-geometry.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const dataPath = new URL('../data/campus.json', import.meta.url);
const readJSON = async name => JSON.parse(await readFile(new URL(`../data/${name}`, import.meta.url), 'utf8'));
const dataset = await readJSON('campus.json');
const cache = await readJSON('source-cache.json');
const provenance = await readJSON('provenance.json');
const names = await readJSON('osm-names.json');
const buildings = dataset.features.filter(f => f.properties.kind === 'building');
const mask = multi(mapGeometry(cache.boundary.geometry, project));
const square = (w, s, e, n) => ({ type: 'Polygon', coordinates: rectangle([w, s, e, n]) });

test('metadata declares frozen public tile provenance, WGS84, scope and limitations', () => {
  assert.equal(dataset.type, 'FeatureCollection');
  const m = dataset.metadata;
  for (const key of ['name', 'acquiredAt', 'tileSnapshot', 'attribution', 'boundarySource']) assert.ok(m[key]);
  assert.ok(Number.isFinite(Date.parse(m.acquiredAt)));
  assert.match(m.tileTemplate, /^https:\/\/tiles\.openfreemap\.org\/planet\/[^/]+\/\{z\}\/\{x\}\/\{y\}\.pbf$/);
  assert.equal(m.nativeZoom, 14);
  assert.ok(m.tileCount > 0 && m.tileCount <= 12);
  assert.equal(m.boundaryIsLegal, false);
  assert.equal(m.boundaryId, 'osm:relation:7469216');
  assert.deepEqual(m.bounds, bounds(cache.boundary.geometry));
  assert.ok(m.bounds[0] > 116.30 && m.bounds[2] < 116.34 && m.bounds[1] > 39.98 && m.bounds[3] > 40.011);
  assert.match(m.attribution, /OpenFreeMap.*OpenMapTiles.*OpenStreetMap.*ODbL/);
  assert.ok(m.notes.some(n => n.includes('NOT surveyed')));
  assert.ok(m.notes.some(n => n.includes('batches')));
});

test('cache hashes match provenance; committed cache is independently replayable', async () => {
  assert.equal(sha256(await readFile(new URL('../data/source-cache.json', import.meta.url))), provenance.cacheSHA256);
  assert.equal(sha256(await readFile(new URL('../data/osm-names.json', import.meta.url))), provenance.namesSHA256);
  assert.equal(cache.tiles.length, dataset.metadata.tileCount);
  for (const tile of cache.tiles) {
    assert.match(tile.sha256, /^[a-f0-9]{64}$/);
    assert.ok(tile.bytes > 0);
    assert.ok(tile.url.includes(`/${dataset.metadata.tileSnapshot}/14/`));
  }
});

test('features have unique IDs, known kinds and complete base schema', () => {
  assert.ok(buildings.length >= 400);
  assert.equal(new Set(dataset.features.map(f => f.id)).size, dataset.features.length);
  for (const f of dataset.features) {
    assert.equal(f.type, 'Feature');
    assert.match(f.id, /^\S+$/);
    const p = f.properties;
    assert.ok(['building', 'road', 'green', 'water', 'campus'].includes(p.kind));
    assert.equal(typeof p.name, 'string');
    assert.equal(typeof p.sourceLayer, 'string');
    assert.ok(p.sourceFeatureId === null || typeof p.sourceFeatureId === 'string');
    assert.equal(p.refinementStatus, 'base');
    assert.equal(typeof p.upstreamProperties, 'object');
    if (p.kind === 'building') {
      assert.equal(p.sourceLayer, 'building');
      assert.ok(p.renderHeight > 0 && Number.isFinite(p.renderHeight));
      assert.ok(p.minHeight >= 0 && p.minHeight <= p.renderHeight);
      assert.match(p.heightSource, /^(openfreemap-render-height|fallback-12m-not-surveyed)$/);
      assert.ok(Array.isArray(p.localOrigin) && p.localOrigin.length === 2);
      assert.ok(p.upstreamBatchFeatureIds.length > 0);
    }
  }
});

test('coordinates are finite WGS84 and polygon rings follow RFC7946 winding', () => {
  let holes = 0;
  for (const f of dataset.features) {
    validateGeometry(f.geometry);
    mapGeometry(f.geometry, p => {
      assert.ok(p[0] > 116.30 && p[0] < 116.34);
      assert.ok(p[1] > 39.98 && p[1] < 40.02);
      return p;
    });
    if (f.geometry.type.endsWith('Polygon')) for (const p of multi(f.geometry)) {
      assert.ok(signedArea(p[0]) > 0, `${f.id} exterior winding`);
      for (const hole of p.slice(1)) { holes++; assert.ok(signedArea(hole) < 0, `${f.id} hole winding`); }
    }
  }
  assert.ok(holes > 0, 'courtyard holes must survive');
});

test('every selected building intersects actual campus and is not cut at its boundary', () => {
  let across = 0;
  for (const f of buildings) {
    const geom = multi(mapGeometry(f.geometry, project));
    const overlap = area(intersect(geom, mask));
    assert.ok(overlap > 0, f.id);
    if (overlap < area(geom) - 0.1) across++;
  }
  assert.ok(across > 0, 'at least one original outline extends beyond campus and remains whole');
});

test('Zijing dormitory zone and south teaching zone both contain useful footprints', () => {
  assert.ok(buildings.filter(f => bounds(f.geometry)[1] > 40.0065).length > 80);
  assert.ok(buildings.filter(f => bounds(f.geometry)[3] < 40.001).length > 100);
  assert.ok(buildings.some(f => f.properties.name.includes('紫荆')));
  assert.ok(buildings.some(f => f.properties.name.includes('图书馆')));
});

test('individual geometry IDs do not pretend upstream batches are building identities', () => {
  assert.ok(buildings.filter(f => f.properties.sourceFeatureId === null).length > 100);
  for (const f of buildings) {
    if (f.properties.sourceFeatureId === null) {
      assert.equal(f.id, geometryId('building', f.geometry));
      assert.equal(f.properties.sourceIdScope, 'batched-vector-feature-not-individual-building');
    } else assert.equal(f.id, `building:${f.properties.sourceFeatureId}`);
  }
});

test('names use reciprocal polygon overlap or unambiguous contained POIs, not nearest labels', () => {
  let matched = 0;
  for (const f of buildings) {
    const p = f.properties;
    if (!p.name) { assert.equal(p.nameSource, 'unknown'); continue; }
    matched++;
    const geom = mapGeometry(f.geometry, project);
    if (p.nameSource === 'osm-local-extract-building-overlap') {
      const source = names.features.find(n => n.id === p.nameSourceFeatureId);
      assert.ok(source);
      const named = mapGeometry(source.geometry, project), overlap = area(intersect(multi(geom), multi(named)));
      assert.ok(overlap / area(multi(geom)) >= 0.649);
      assert.ok(overlap / area(multi(named)) >= 0.649);
    } else {
      assert.equal(p.nameSource, 'openfreemap-poi-inside-footprint');
      assert.equal(p.poiLabels.length, 1);
      const poi = cache.records.find(r => r.kind === 'poi' &&
        (r.properties['name:zh'] ?? r.properties.name) === p.name && inside(r.geometry.coordinates, multi(geom)));
      assert.ok(poi);
      assert.equal(p.nameRole, 'contained-poi-label-not-verified-building-name');
    }
  }
  assert.equal(matched, dataset.metadata.counts.namedBuildings);
});

test('native tile polygon union removes buffer duplication and preserves courtyard holes', () => {
  const courtyard = { type: 'Polygon', coordinates: [
    rectangle([0, 0, 20, 20])[0], rectangle([7, 7, 13, 13])[0].reverse(),
  ] };
  const a = polygon(intersect(multi(courtyard), [rectangle([0, 0, 10, 20])]));
  const b = polygon(intersect(multi(courtyard), [rectangle([10, 0, 20, 20])]));
  const stitched = mergePolygons([a, b, a]);
  assert.equal(area(stitched), 364);
  assert.equal(stitched.length, 1);
  assert.equal(stitched[0].length, 2);
  assert.equal(inside([10, 10], stitched), false);
});

test('disconnected batched buildings remain individual outlines and holes remain grouped', () => {
  const merged = mergePolygons([square(0, 0, 10, 10), square(20, 0, 30, 10)]);
  assert.equal(merged.length, 2);
  assert.equal(area(merged), 200);
});

test('geometry IDs ignore polygon winding, ring start and MultiPolygon order', () => {
  const a = square(1, 1, 3, 3), ring = a.coordinates[0];
  const b = { type: 'Polygon', coordinates: [[ring[2], ring[1], ring[0], ring[3], ring[2]]] };
  assert.equal(geometryId('building', a), geometryId('building', b));
  const c = { type: 'MultiPolygon', coordinates: [a.coordinates, square(5, 5, 6, 6).coordinates] };
  assert.equal(geometryId('building', c), geometryId('building', { ...c, coordinates: [...c.coordinates].reverse() }));
});

test('crossing lines are clipped against exterior and holes rather than endpoint-filtered', () => {
  const mask = [[rectangle([0, 0, 10, 10])[0], rectangle([4, 4, 6, 6])[0]]];
  const lines = clipLines({ type: 'LineString', coordinates: [[-5, 5], [15, 5]] }, mask);
  assert.deepEqual(lines, [[[0, 5], [4, 5]], [[6, 5], [10, 5]]]);
});

test('height provenance distinguishes upstream visualization values, fallback and floating parts', () => {
  const upstream = buildingHeights({ render_height: 5, render_min_height: 0 });
  assert.equal(upstream.renderHeight, 5);
  assert.equal(upstream.heightSource, 'openfreemap-render-height');
  const fallback = buildingHeights({});
  assert.equal(fallback.renderHeight, 12);
  assert.equal(fallback.heightSource, 'fallback-12m-not-surveyed');
  assert.equal(buildingHeights({ render_height: 0 }).renderHeight, 12);
  assert.equal(buildingHeights({ render_height: 30, render_min_height: 12 }).minHeight, 12);
  assert.equal(buildingHeights({ render_height: 30, hide_3d: true }).extrude, false);
  assert.equal(buildingHeights({ hide_3d: 1 }).footprintRole, 'planning-outline-hide-3d');
  assert.throws(() => buildingHeights({ render_height: 5, render_min_height: 20 }));
});

test('malformed, degenerate and unsupported geometry is rejected explicitly', () => {
  assert.throws(() => validateGeometry({ type: 'Polygon', coordinates: [[[0, 0], [1, 1], [0, 0]]] }));
  assert.throws(() => validateGeometry({ type: 'Point', coordinates: [NaN, 0] }));
  assert.throws(() => validateGeometry({ type: 'GeometryCollection', geometries: [] }));
  assert.throws(() => validateGeometry({ type: 'LineString', coordinates: [[1, 2]] }));
});

test('world tile projection round-trips without coordinate datum substitution', () => {
  const p = [116.3201, 40.0074], actual = unproject(project(p));
  assert.ok(Math.abs(p[0] - actual[0]) < 1e-8);
  assert.ok(Math.abs(p[1] - actual[1]) < 1e-8);
});

test('dataset counts agree with actual feature collection', () => {
  const counts = dataset.metadata.counts;
  for (const kind of ['building', 'road', 'green', 'water', 'campus']) {
    assert.equal(counts[kind], dataset.features.filter(f => f.properties.kind === kind).length);
  }
  assert.equal(counts.total, dataset.features.length);
});

test('offline acquisition rebuild is byte-for-byte deterministic without PBF/network access', async () => {
  const before = await readFile(dataPath);
  const output = execFileSync(process.execPath, ['scripts/fetch-campus.mjs', '--offline'], {
    cwd: root, encoding: 'utf8', timeout: 120_000,
    env: { ...process.env, HTTP_PROXY: 'http://127.0.0.1:1', HTTPS_PROXY: 'http://127.0.0.1:1', ALL_PROXY: 'http://127.0.0.1:1' },
  });
  assert.match(output, /no network requests/);
  assert.doesNotMatch(output, /GET https/);
  assert.equal(sha256(await readFile(dataPath)), sha256(before));
});
