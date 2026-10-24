import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { VectorTile } from '@mapbox/vector-tile';
import Pbf from 'pbf';
import { XMLParser } from 'fast-xml-parser';
import {
  ZOOM, EXTENT, sha256, multi, polygon, rectangle, mapGeometry, project, unproject,
  bounds, boundsOverlap, area, inside, tileGeometry, mergePolygons, intersect,
  geometryId, canonicalGeometry, clipLines, validateGeometry, rewind, buildingHeights,
} from './data-geometry.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const DATA = path.join(ROOT, 'data');
const TILES = path.join(ROOT, 'output', 'tiles');
const TILEJSON_URL = 'https://tiles.openfreemap.org/planet';
const BOUNDARY_URL = 'https://api.openstreetmap.org/api/0.6/relation/7469216/full.json';
const ATTRIBUTION = 'OpenFreeMap · © OpenMapTiles · © OpenStreetMap contributors (ODbL 1.0)';
const args = new Set(process.argv.slice(2));
for (const arg of args) if (!['--offline', '--refresh'].includes(arg)) throw new Error(`Unknown option ${arg}`);
if (args.has('--offline') && args.has('--refresh')) throw new Error('--offline and --refresh are mutually exclusive');
const exists = async p => { try { await access(p); return true; } catch { return false; } };
const json = async p => JSON.parse(await readFile(p, 'utf8'));
const save = async (name, value) => writeFile(path.join(DATA, name), JSON.stringify(value, null, 2) + '\n');
const diagnostics = { counters: {}, events: [] };
function count(key, amount = 1) { diagnostics.counters[key] = (diagnostics.counters[key] ?? 0) + amount; }
function warn(code, detail) { count(code); diagnostics.events.push({ code, ...detail }); }
function download(url) {
  // curl is deliberately used: native Windows fetch/DNS is not reliable in this environment.
  if (!['tiles.openfreemap.org', 'api.openstreetmap.org'].includes(new URL(url).hostname)) throw new Error(`Unapproved download host: ${url}`);
  console.log(`GET ${url}`);
  return execFileSync(process.platform === 'win32' ? 'curl.exe' : 'curl',
    ['-fLsS', '--retry', '2', '--retry-delay', '2', '--connect-timeout', '20', '--max-time', '90', url],
    { maxBuffer: 30 * 1024 * 1024, timeout: 280_000 });
}
function assembleBoundary(raw) {
  const nodes = new Map(raw.elements.filter(e => e.type === 'node').map(n => [n.id, [n.lon, n.lat]]));
  const ways = new Map(raw.elements.filter(e => e.type === 'way').map(w => [w.id, w.nodes]));
  const relation = raw.elements.find(e => e.type === 'relation' && e.id === 7469216);
  if (!relation || relation.tags?.amenity !== 'university') throw new Error('Expected Tsinghua university relation 7469216');
  const rings = { outer: [], inner: [] };
  for (const role of Object.keys(rings)) {
    const remaining = relation.members.filter(m => m.type === 'way' && m.role === role).map(m => {
      if (!ways.has(m.ref)) throw new Error(`Missing boundary member way ${m.ref}`);
      return [...ways.get(m.ref)];
    });
    while (remaining.length) {
      const chain = remaining.shift();
      while (chain[0] !== chain.at(-1)) {
        const i = remaining.findIndex(w => w[0] === chain.at(-1) || w.at(-1) === chain.at(-1));
        if (i < 0) throw new Error('University boundary contains an unclosed ring');
        const next = remaining.splice(i, 1)[0];
        if (next[0] !== chain.at(-1)) next.reverse();
        chain.push(...next.slice(1));
      }
      rings[role].push(chain.map(id => { if (!nodes.has(id)) throw new Error(`Missing boundary node ${id}`); return nodes.get(id); }));
    }
  }
  if (!rings.outer.length) throw new Error('No campus outer ring');
  const coordinates = rings.outer.map(r => [r]);
  for (const hole of rings.inner) {
    const outer = coordinates.find(p => inside(hole[0], [p]));
    if (!outer) throw new Error('Orphan campus boundary hole');
    outer.push(hole);
  }
  for (const member of relation.members) if (member.type !== 'way' || !['outer', 'inner'].includes(member.role)) {
    warn('unexpectedBoundaryMember', { member });
  }
  const geometry = polygon(coordinates);
  validateGeometry(geometry);
  return {
    type: 'Feature', id: 'campus:osm-relation:7469216',
    properties: { name: '清华大学北京主校区', sourceLayer: 'osm-university-boundary', sourceFeatureId: '7469216',
      kind: 'campus', refinementStatus: 'base', upstreamProperties: relation.tags,
      boundarySource: BOUNDARY_URL, sourceVersion: relation.version, sourceTimestamp: relation.timestamp,
      legalBoundary: false },
    geometry,
  };
}
async function supplementalNames() {
  const source = path.resolve(ROOT, '../tsinghua-tour/campus.osm');
  if (!await exists(source)) {
    warn('supplementalExtractUnavailable', { note: 'Optional local OSM names unavailable; use POIs only.' });
    return { source: null, features: [] };
  }
  const xml = await readFile(source, 'utf8');
  const parsed = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '',
    parseAttributeValue: false, isArray: name => ['node', 'way', 'relation', 'nd', 'tag', 'member'].includes(name) }).parse(xml).osm;
  const nodes = new Map(parsed.node.map(n => [n.id, [Number(n.lon), Number(n.lat)]]));
  const tagsOf = e => Object.fromEntries((e.tag ?? []).map(t => [t.k, t.v]));
  const features = [];
  for (const way of parsed.way) {
    const tags = tagsOf(way), name = tags['name:zh-Hans'] ?? tags['name:zh'] ?? tags.name;
    if (!name || (!tags.building && !tags['building:part'])) continue;
    const refs = (way.nd ?? []).map(n => n.ref);
    if (refs.length < 4 || refs[0] !== refs.at(-1) || refs.some(id => !nodes.has(id))) {
      warn('incompleteSupplementalNamedBuilding', { sourceId: way.id });
      continue;
    }
    features.push({ id: `osm:way:${way.id}`, name, geometry: { type: 'Polygon', coordinates: [refs.map(id => nodes.get(id))] }, tags });
  }
  return { source: '../tsinghua-tour/campus.osm', sha256: sha256(xml), originalBounds: parsed.bounds,
    scope: 'Only explicitly named building/building:part ways; geometry used for name overlap matching, never output footprints or heights.',
    features };
}
function kindFor(layer, props, geometry) {
  if (layer === 'building') return 'building';
  if (layer === 'water' || layer === 'waterway') return 'water';
  if (layer === 'transportation') {
    if (!geometry.type.includes('LineString')) { count('transportationNonLineExcluded'); return null; }
    if (['rail', 'transit', 'aerialway'].includes(props.class)) { count('nonRoadTransportExcluded'); return null; }
    return 'road';
  }
  if (layer === 'landcover' && ['wood', 'grass', 'wetland'].includes(props.class)) return 'green';
  if (layer === 'landuse' && ['park', 'garden', 'grass', 'recreation_ground', 'village_green', 'forest', 'cemetery'].includes(props.class)) return 'green';
  return null;
}
async function acquire() {
  const acquiredAt = new Date().toISOString();
  const tilejsonBytes = download(TILEJSON_URL), tilejson = JSON.parse(tilejsonBytes);
  if (tilejson.maxzoom !== ZOOM) throw new Error(`Native zoom changed to ${tilejson.maxzoom}; review acquisition before refreshing`);
  const template = tilejson.tiles.find(t => t.startsWith('https://tiles.openfreemap.org/planet/'));
  if (!template) throw new Error('No expected official OpenFreeMap tile template');
  const boundaryBytes = download(BOUNDARY_URL), boundary = assembleBoundary(JSON.parse(boundaryBytes));
  const campusBounds = bounds(boundary.geometry);
  // 250m+ halo preserves complete edge buildings and makes tile-edge truncation testable.
  const halo = [campusBounds[0] - 0.003, campusBounds[1] - 0.003, campusBounds[2] + 0.003, campusBounds[3] + 0.003];
  const projectedHalo = bounds(mapGeometry({ type: 'Polygon', coordinates: rectangle(halo) }, project));
  const [minX, minY, maxX, maxY] = projectedHalo.map(v => Math.floor(v / EXTENT));
  if ((maxX - minX + 1) * (maxY - minY + 1) > 12) throw new Error('Boundary exceeds bounded 12-tile acquisition budget');
  await mkdir(TILES, { recursive: true });
  const records = [], tiles = [];
  for (let x = minX; x <= maxX; x++) for (let y = minY; y <= maxY; y++) {
    const url = template.replace('{z}', ZOOM).replace('{x}', x).replace('{y}', y);
    const cacheFile = path.join(TILES, `${template.split('/')[4]}-${ZOOM}-${x}-${y}.pbf`);
    const bytes = await exists(cacheFile) ? await readFile(cacheFile) : download(url);
    await writeFile(cacheFile, bytes);
    const decoded = new VectorTile(new Pbf(bytes));
    const tileId = `${ZOOM}/${x}/${y}`;
    const tileInfo = { id: tileId, url, sha256: sha256(bytes), bytes: bytes.length, layers: {} };
    tiles.push(tileInfo);
    for (const layerName of ['building', 'landuse', 'landcover', 'water', 'waterway', 'transportation', 'poi']) {
      const layer = decoded.layers[layerName];
      tileInfo.layers[layerName] = layer?.length ?? 0;
      if (!layer) { count(`missingTileLayer:${layerName}`); continue; }
      for (let i = 0; i < layer.length; i++) {
        const feature = layer.feature(i);
        let geometry;
        try {
          geometry = tileGeometry(feature, x, y, ZOOM, layer.extent);
          validateGeometry(geometry);
        } catch (error) {
          warn('malformedTileGeometry', { tile: tileId, layer: layerName, index: i, message: error.message });
          throw error;
        }
        if (!boundsOverlap(bounds(geometry), projectedHalo)) continue;
        const kind = layerName === 'poi' ? 'poi' : kindFor(layerName, feature.properties, geometry);
        if (!kind) continue;
        if ((kind === 'building' || kind === 'green' || layerName === 'water') && !geometry.type.endsWith('Polygon')) {
          throw new Error(`Unexpected ${geometry.type} in ${layerName}`);
        }
        if (layerName === 'waterway' && !geometry.type.includes('LineString')) throw new Error('Unexpected waterway geometry');
        if (kind === 'poi' && geometry.type !== 'Point') { warn('nonPointPoiExcluded', { tile: tileId, index: i }); continue; }
        const sourceFeatureId = Number.isSafeInteger(feature.id) && feature.id >= 0 ? String(feature.id) : null;
        if (feature.id != null && sourceFeatureId === null) warn('unsafeSourceId', { tile: tileId, layer: layerName, index: i, rawId: String(feature.id) });
        records.push({ layer: layerName, kind, sourceFeatureId, tile: tileId, tileBounds: [x * EXTENT, y * EXTENT, (x + 1) * EXTENT, (y + 1) * EXTENT],
          geometry, properties: feature.properties });
      }
    }
    console.log(`${tileId}: ${bytes.length} bytes, ${tileInfo.layers.building} upstream building fragments`);
  }
  const names = await supplementalNames();
  const cache = { schemaVersion: 1, acquiredAt, tileSnapshot: template.split('/')[4], tileTemplate: template, zoom: ZOOM, extent: EXTENT,
    boundary, haloBounds: halo, tileGridBounds: [minX * EXTENT, minY * EXTENT, (maxX + 1) * EXTENT, (maxY + 1) * EXTENT],
    tiles, records, acquisitionDiagnostics: structuredClone(diagnostics) };
  await save('boundary.geojson', boundary);
  await save('tilejson.json', tilejson);
  await save('osm-names.json', names);
  // Compact, campus-local, lossless decoded tile fragments: sufficient for offline
  // reconstruction even in a fresh clone where ignored raw PBF files are absent.
  await writeFile(path.join(DATA, 'source-cache.json'), JSON.stringify(cache) + '\n');
  await save('provenance.json', {
    schemaVersion: 1, acquiredAt, tileSnapshot: cache.tileSnapshot, tilejsonURL: TILEJSON_URL, tilejsonSHA256: sha256(tilejsonBytes),
    boundaryURL: BOUNDARY_URL, boundaryRawSHA256: sha256(boundaryBytes), boundaryVersion: boundary.properties.sourceVersion,
    boundarySourceTimestamp: boundary.properties.sourceTimestamp, tileTemplate: template,
    cacheSHA256: sha256(await readFile(path.join(DATA, 'source-cache.json'))),
    namesSHA256: sha256(await readFile(path.join(DATA, 'osm-names.json'))),
    tiles, attribution: ATTRIBUTION,
    licenses: ['https://openfreemap.org/', 'https://openmaptiles.org/', 'https://www.openstreetmap.org/copyright', 'https://opendatacommons.org/licenses/odbl/1-0/'],
  });
  return cache;
}

function stitchRecords(records) {
  const groups = new Map();
  const anonymous = [];
  for (const record of records) {
    if (record.kind === 'poi') continue;
    if (!record.sourceFeatureId) { anonymous.push(record); continue; }
    const key = `${record.layer}:${record.sourceFeatureId}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(record);
  }
  // Anonymous fragments are joined only when their original buffered polygon
  // areas overlap across distinct tiles AND their raw properties agree. Touching
  // adjacent buildings are NOT merged just because they have the same height.
  const sets = anonymous.map((_, i) => i);
  function root(i) { while (sets[i] !== i) { sets[i] = sets[sets[i]]; i = sets[i]; } return i; }
  for (let i = 0; i < anonymous.length; i++) for (let j = i + 1; j < anonymous.length; j++) {
    const a = anonymous[i], b = anonymous[j];
    if (a.layer !== b.layer || JSON.stringify(a.properties) !== JSON.stringify(b.properties)) continue;
    if (sha256(canonicalGeometry(a.geometry)) === sha256(canonicalGeometry(b.geometry))) { sets[root(j)] = root(i); continue; }
    if (a.tile === b.tile || !a.geometry.type.endsWith('Polygon') || !b.geometry.type.endsWith('Polygon')) continue;
    if (boundsOverlap(bounds(a.geometry), bounds(b.geometry)) && area(intersect(multi(a.geometry), multi(b.geometry))) > 0) {
      sets[root(j)] = root(i); count('anonymousOverlappingBufferFragmentsJoined');
    }
  }
  anonymous.forEach((record, i) => {
    const key = `anonymous:${root(i)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(record);
  });
  return [...groups.values()];
}
function buildingGroups(cache, mask) {
  const byProperties = new Map();
  for (const record of cache.records.filter(r => r.kind === 'building')) {
    const key = JSON.stringify(Object.fromEntries(Object.entries(record.properties).sort()));
    if (!byProperties.has(key)) byProperties.set(key, []);
    byProperties.get(key).push(record);
    if (record.geometry.type === 'MultiPolygon') count('upstreamBatchedBuildingFeatures');
  }
  const groups = [];
  for (const records of byProperties.values()) {
    // OpenFreeMap's z14 layer is visibly batched by rendering properties, with
    // hundreds of disconnected buildings under a single vector feature ID.
    // Union matching-property native-cell pieces before splitting connected
    // components, including cross-tile batches whose IDs differ.
    const pieces = records.map(r => ({
      record: r, coordinates: intersect(multi(r.geometry), [rectangle(r.tileBounds)]),
    })).filter(p => p.coordinates.length);
    const merged = mergePolygons(pieces.map(p => polygon(p.coordinates)));
    for (const component of merged) {
      const geometry = { type: 'Polygon', coordinates: component };
      if (!area(intersect([component], mask))) continue;
      const componentBounds = bounds(geometry);
      const contributing = pieces.filter(p => boundsOverlap(bounds(p.record.geometry), componentBounds) &&
        area(intersect(p.coordinates, [component])) > 0).map(p => p.record);
      const ids = [...new Set(contributing.map(r => r.sourceFeatureId).filter(Boolean))].sort();
      const usableId = ids.length === 1 && contributing.every(r => r.geometry.type === 'Polygon') ? ids[0] : null;
      if (!usableId) count('individualBuildingIdUnavailableInBatchedTile');
      groups.push([{
        ...contributing[0], geometry, sourceFeatureId: usableId,
        tileBounds: cache.tileGridBounds,
        buildingSourceRecords: contributing,
        upstreamBatchFeatureIds: ids,
      }]);
    }
  }
  return groups;
}
function build(cache, names) {
  const campus = { ...cache.boundary, geometry: rewind(cache.boundary.geometry) };
  const mask = multi(mapGeometry(campus.geometry, project));
  const features = [campus];
  const nameGeometries = names.features.map(n => ({ ...n, projected: mapGeometry(n.geometry, project) }));
  const pois = cache.records.filter(r => r.kind === 'poi' && (r.properties['name:zh'] || r.properties.name));
  const seenIds = new Set([campus.id]);
  const groups = [
    ...buildingGroups(cache, mask),
    ...stitchRecords(cache.records.filter(r => r.kind !== 'building')),
  ];
  for (const fragments of groups) {
    const first = fragments[0];
    let geometry;
    const versions = [...new Map(fragments.map(r => [JSON.stringify(r.properties), r.properties])).values()];
    if (versions.length > 1) warn('upstreamPropertyConflict', { layer: first.layer, sourceFeatureId: first.sourceFeatureId, variants: versions });
    if (first.geometry.type.endsWith('Polygon')) {
      const clipped = fragments.map(r => intersect(multi(r.geometry), [rectangle(r.tileBounds)])).filter(c => c.length).map(polygon);
      if (!clipped.length) { count('bufferOnlyPolygonGroupsExcluded'); continue; }
      let merged = mergePolygons(clipped);
      if (!merged.length || area(merged) <= 0) throw new Error('Empty merged polygon');
      const campusIntersection = intersect(merged, mask);
      if (!campusIntersection.length || area(campusIntersection) <= 0) { count('outsideCampusPolygonGroupsExcluded'); continue; }
      if (first.kind === 'building') {
        const b = bounds(polygon(merged)), g = cache.tileGridBounds;
        if (b[0] <= g[0] || b[1] <= g[1] || b[2] >= g[2] || b[3] >= g[3]) throw new Error('Selected building touches acquisition edge; enlarge tile halo');
        if (area(campusIntersection) < area(merged) - 0.01) count('wholeBuildingsRetainedAcrossCampusBoundary');
      } else merged = campusIntersection;
      geometry = polygon(merged);
    } else {
      const lines = fragments.flatMap(r => clipLines(r.geometry, [rectangle(r.tileBounds)]));
      const masked = clipLines({ type: 'MultiLineString', coordinates: lines }, mask);
      if (!masked.length) { count('outsideCampusLineGroupsExcluded'); continue; }
      geometry = masked.length === 1 ? { type: 'LineString', coordinates: masked[0] } : { type: 'MultiLineString', coordinates: masked };
    }
    validateGeometry(geometry);
    const worldGeometry = rewind(mapGeometry(geometry, unproject));
    validateGeometry(worldGeometry);
    const id = first.sourceFeatureId ? `${first.layer}:${first.sourceFeatureId}` : geometryId(first.layer, worldGeometry);
    if (seenIds.has(id)) {
      const existing = features.find(f => f.id === id);
      if (sha256(canonicalGeometry(existing.geometry)) !== sha256(canonicalGeometry(worldGeometry))) throw new Error(`Conflicting stable ID ${id}`);
      warn('exactDuplicateFeatureExcluded', { id }); continue;
    }
    seenIds.add(id);
    const originalFragments = first.buildingSourceRecords ?? fragments;
    const properties = {
      kind: first.kind, name: '', sourceLayer: first.layer, sourceFeatureId: first.sourceFeatureId,
      refinementStatus: 'base', upstreamProperties: first.properties, upstreamPropertyVariants: versions,
      sourceTiles: [...new Set(originalFragments.map(r => r.tile))].sort(), sourceFragmentCount: originalFragments.length,
      idStrategy: first.sourceFeatureId ? 'source-layer-and-vector-feature-id' : 'canonical-geometry-sha256-96',
      nameSource: 'unknown', nameConfidence: 0,
    };
    if (first.kind === 'building') {
      properties.upstreamBatchFeatureIds = first.upstreamBatchFeatureIds;
      properties.sourceIdScope = first.sourceFeatureId ? 'single-polygon-vector-feature-unverified' : 'batched-vector-feature-not-individual-building';
    }
    if (properties.sourceTiles.length > 1) count('multiTileFeatureGroups');
    if (first.kind === 'building') {
      const rawHeight = first.properties.render_height, rawMin = first.properties.render_min_height;
      try { Object.assign(properties, buildingHeights(first.properties)); }
      catch (error) { throw new Error(`${id}: ${error.message}`); }
      if (!properties.extrude) count('hide3dPlanningOutlinesRetained');
      if (properties.heightSource.startsWith('fallback')) warn('fallbackHeight', { id, rawHeight: rawHeight ?? null });
      if (rawMin != null && (typeof rawMin !== 'number' || !Number.isFinite(rawMin) || rawMin < 0)) {
        warn('invalidMinimumHeight', { id, rawMin });
      }
      const candidateBounds = bounds(geometry), candidateArea = area(multi(geometry));
      const candidates = [];
      for (const named of nameGeometries) {
        if (!boundsOverlap(candidateBounds, bounds(named.projected))) continue;
        const overlap = area(intersect(multi(geometry), multi(named.projected)));
        const coverage = overlap / candidateArea, referenceCoverage = overlap / area(multi(named.projected));
        if (coverage >= 0.65 && referenceCoverage >= 0.65) candidates.push({ named, score: Math.min(coverage, referenceCoverage) });
      }
      candidates.sort((a, b) => b.score - a.score);
      if (candidates.length && (candidates.length === 1 || candidates[0].named.name === candidates[1].named.name || candidates[0].score - candidates[1].score > 0.15)) {
        const match = candidates[0];
        properties.name = match.named.name;
        properties.nameSource = 'osm-local-extract-building-overlap';
        properties.nameConfidence = Number(match.score.toFixed(3));
        properties.nameSourceFeatureId = match.named.id;
        properties.nameRole = 'building-name';
      } else {
        const labels = new Map();
        for (const poi of pois) if (inside(poi.geometry.coordinates, multi(geometry))) {
          const name = poi.properties['name:zh'] ?? poi.properties.name;
          labels.set(name, { name, sourceFeatureId: poi.sourceFeatureId, upstreamProperties: poi.properties });
        }
        properties.poiLabels = [...labels.values()].sort((a, b) => a.name.localeCompare(b.name, 'zh'));
        if (labels.size === 1) {
          properties.name = [...labels.keys()][0];
          properties.nameSource = 'openfreemap-poi-inside-footprint';
          properties.nameConfidence = 0.7;
          properties.nameRole = 'contained-poi-label-not-verified-building-name';
        } else if (labels.size > 1 || candidates.length > 1) {
          warn('ambiguousBuildingName', { id, osmCandidates: candidates.map(c => c.named.name), poiCandidates: [...labels.keys()] });
        }
      }
      properties.localOrigin = unproject([(candidateBounds[0] + candidateBounds[2]) / 2, (candidateBounds[1] + candidateBounds[3]) / 2]);
    }
    features.push({ type: 'Feature', id, properties, geometry: worldGeometry });
  }
  features.sort((a, b) => a.id.localeCompare(b.id, 'en'));
  const counts = Object.fromEntries(['building', 'road', 'water', 'green', 'campus'].map(k => [k, features.filter(f => f.properties.kind === k).length]));
  if (counts.building < 100) throw new Error(`No useful campus building dataset: only ${counts.building} buildings`);
  const buildings = features.filter(f => f.properties.kind === 'building');
  counts.namedBuildings = buildings.filter(f => f.properties.name).length;
  counts.extrudedBuildings = buildings.filter(f => f.properties.extrude).length;
  counts.planningOutlines = buildings.filter(f => !f.properties.extrude).length;
  counts.fallbackHeightBuildings = buildings.filter(f => f.properties.heightSource.startsWith('fallback')).length;
  counts.floatingBuildings = buildings.filter(f => f.properties.minHeight > 0).length;
  counts.geometryHashBuildings = buildings.filter(f => !f.properties.sourceFeatureId).length;
  counts.total = features.length;
  const campusBounds = bounds(campus.geometry);
  return {
    type: 'FeatureCollection',
    metadata: {
      schemaVersion: 1, name: '清华大学北京主校区 · OpenFreeMap 基础模型',
      center: [(campusBounds[0] + campusBounds[2]) / 2, (campusBounds[1] + campusBounds[3]) / 2],
      bounds: campusBounds, acquiredAt: cache.acquiredAt, tileSnapshot: cache.tileSnapshot,
      tileTemplate: cache.tileTemplate, nativeZoom: ZOOM, tileCount: cache.tiles.length,
      attribution: ATTRIBUTION, counts, coordinateSystem: 'EPSG:4326 WGS84 longitude,latitude',
      boundarySource: BOUNDARY_URL, boundarySourceType: 'OpenStreetMap community-mapped university multipolygon',
      boundaryId: 'osm:relation:7469216', boundaryVersion: campus.properties.sourceVersion,
      boundarySourceTimestamp: campus.properties.sourceTimestamp, boundaryIsApproximate: false, boundaryIsLegal: false,
      featureBounds: bounds({ type: 'MultiPoint', coordinates: features.flatMap(f => { const b = bounds(f.geometry); return [[b[0], b[1]], [b[2], b[3]]]; }) }),
      notes: [
        'Footprints come exclusively from the official OpenFreeMap public vector tiles, using the OpenMapTiles schema and OSM data (ODbL). No imagery tracing or OSM footprint substitution.',
        'Scope is OSM university relation 7469216: Beijing main campus including Zijing dormitories and internal service/life zones, not the surrounding science park. This community-mapped boundary is not a surveyed/legal boundary.',
        'OpenFreeMap render_height/render_min_height are upstream visualization values; they may be inferred or defaulted and are NOT surveyed heights. Our missing/invalid top-height fallback is explicitly 12 m.',
        'hide_3d outlines are retained as planning footprints with extrude=false. Consumers MUST NOT extrude them: they may overlap the building parts that should be extruded.',
        'Buildings intersecting the campus are retained WHOLE, not cut at the campus edge. Roads, water and greens are clipped to the campus mask; polygon holes and multipolygons are preserved.',
        'Tile buffers are clipped to each native tile cell in integer world-tile coordinates before union. Same-layer source IDs are vector feature IDs, NOT verified OSM IDs. Nonbuilding features union by source ID.',
        'IMPORTANT: the actual native z14 building layer batches many disconnected buildings by rendering properties into MultiPolygons under one vector feature ID. Matching-property building pieces are unioned across tiles, then split into connected outlines. Batched IDs are preserved in upstreamBatchFeatureIds, not misrepresented as individual building IDs. These outlines use geometry-hash IDs and sourceFeatureId=null; upstream touching buildings can remain merged and need manual refinement.',
        'Missing-ID polygons are only stitched when matching-property buffered fragments overlap across tiles. Canonical geometry hashes are deterministic, but geometry edits, quantization or upstream ID changes can change IDs on refresh; persist reviewed aliases for long-lived refinement registries.',
        'OSM names from the earlier local extract are assigned only with >=65% reciprocal footprint area overlap. Its original coverage is partial. OpenFreeMap POIs are used only if contained in a building and unambiguous, and may identify an occupant rather than the building. No nearest-neighbor name guesses.',
        'Map data can omit or simplify small buildings, paths, greens and details. All features have refinementStatus=base. Roof shape, facade, material and exact height remain unverified.',
        'The committed source-cache.json is a lossless campus-local decoded acquisition cache. npm run data -- --offline rebuilds campus.json without network or ignored raw tile files; --refresh explicitly obtains a new snapshot.',
      ],
    },
    features,
  };
}
await mkdir(DATA, { recursive: true });
try {
  const cachePath = path.join(DATA, 'source-cache.json');
  let cache;
  if (!args.has('--refresh') && await exists(cachePath)) {
    const provenance = await json(path.join(DATA, 'provenance.json'));
    if (sha256(await readFile(cachePath)) !== provenance.cacheSHA256) throw new Error('Decoded source cache hash mismatch');
    if (sha256(await readFile(path.join(DATA, 'osm-names.json'))) !== provenance.namesSHA256) throw new Error('Supplemental name cache hash mismatch');
    cache = await json(cachePath);
    console.log(`Using frozen ${cache.tileSnapshot} cache; no network requests.`);
    Object.assign(diagnostics.counters, cache.acquisitionDiagnostics.counters);
    diagnostics.events.push(...cache.acquisitionDiagnostics.events);
  } else {
    if (args.has('--offline')) throw new Error('Offline source cache is missing; run npm run data once online');
    cache = await acquire();
  }
  const campus = build(cache, await json(path.join(DATA, 'osm-names.json')));
  await save('campus.json', campus);
  await save('diagnostics.json', diagnostics);
  console.log(JSON.stringify({ dataset: 'data/campus.json', snapshot: campus.metadata.tileSnapshot, counts: campus.metadata.counts, diagnostics: diagnostics.counters }, null, 2));
} catch (error) {
  warn('fatal', { message: error.message, stack: error.stack });
  await save('diagnostics.json', diagnostics);
  throw error;
}
