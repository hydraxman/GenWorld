import {createHash} from 'node:crypto';
import {readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {XMLParser} from 'fast-xml-parser';
import polygonClipping from 'polygon-clipping';
import {footprintMetrics, ringArea} from '../src/geo.js';
import {architectureSignature} from '../src/architecture-contract.js';

const root = resolve(import.meta.dirname, '..');
const list = value => value === undefined ? [] : Array.isArray(value) ? value : [value];
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const area = polygons => polygons.reduce((sum, polygon) =>
  sum + ringArea(polygon[0]) - polygon.slice(1).reduce((n, ring) => n + ringArea(ring), 0), 0);
const overlap = (a, b) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
const tagKeys = ['building', 'building:part', 'building:levels', 'roof:shape', 'roof:height', 'height', 'min_height'];

export async function architectureEvidence() {
  const [campusBytes, osmBytes] = await Promise.all([
    readFile(resolve(root, 'data', 'campus.json')),
    readFile(resolve(root, '..', 'tsinghua-tour', 'campus.osm')),
  ]);
  const campus = JSON.parse(campusBytes);
  const xml = new XMLParser({ignoreAttributes: false, attributeNamePrefix: '', parseAttributeValue: false}).parse(osmBytes).osm;
  const nodes = new Map(list(xml.node).map(node => [node.id, [Number(node.lon), Number(node.lat)]]));
  const sources = list(xml.way).flatMap(way => {
    const tags = Object.fromEntries(list(way.tag).map(tag => [tag.k, tag.v]));
    if (!tags.building && !tags['building:part']) return [];
    const references = list(way.nd).map(nd => nd.ref);
    if (references.length < 4 || references[0] !== references.at(-1)) return [];
    const ring = references.map(id => nodes.get(id));
    if (ring.some(point => !point)) throw new Error(`Incomplete frozen OSM building way ${way.id}`);
    const metrics = footprintMetrics({type: 'Polygon', coordinates: [ring]}, campus.metadata.center);
    return [{id: `osm:way:${way.id}`, metrics,
      tags: Object.fromEntries(tagKeys.filter(key => tags[key] !== undefined).map(key => [key, tags[key]]))}];
  });
  const buildings = campus.features.filter(feature => feature.properties.kind === 'building').map(feature => {
    const metrics = footprintMetrics(feature.geometry, campus.metadata.center);
    const matches = sources.filter(source => overlap(metrics.bounds, source.metrics.bounds)).map(source => {
      const intersection = area(polygonClipping.intersection(metrics.projected, source.metrics.projected));
      const iou = intersection / (metrics.area + source.metrics.area - intersection);
      return {source, iou};
    }).filter(match => match.iou >= .8).sort((a, b) => b.iou - a.iou || a.source.id.localeCompare(b.source.id));
    const best = matches[0];
    if (best && matches[1] && best.iou - matches[1].iou < .05) {
      return {featureId: feature.id, footprintSignature: architectureSignature(feature, campus.metadata.center), match: 'ambiguous', tags: {}};
    }
    return best ? {featureId: feature.id, footprintSignature: architectureSignature(feature, campus.metadata.center), match: 'overlap-verified',
      sourceId: best.source.id, intersectionOverUnion: Number(best.iou.toFixed(6)), tags: best.source.tags}
      : {featureId: feature.id, footprintSignature: architectureSignature(feature, campus.metadata.center), match: 'no-unambiguous-source', tags: {}};
  });
  return {
    schemaVersion: 1,
    sources: {
      footprints: {path: 'data/campus.json', sha256: hash(campusBytes)},
      architecture: {path: '../tsinghua-tour/campus.osm', sha256: hash(osmBytes),
        license: 'ODbL 1.0; © OpenStreetMap contributors', scope: 'Historical local extract; not a current survey.'},
    },
    matching: 'Single closed OSM building way, projected polygon IoU >= 0.8; reject near-tied matches. Tags only, never substitute source footprints. No tags borrowed from contained POIs or nearest buildings.',
    limitations: 'Community building types and levels are not verified current architecture. Absent tags remain unknown. No contact, occupancy, address or other nonarchitectural fields are copied.',
    buildings,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const evidence = await architectureEvidence();
  await writeFile(resolve(root, 'data', 'architecture-evidence.json'), JSON.stringify(evidence, null, 2) + '\n');
  console.log(`Architecture evidence: ${evidence.buildings.length} frozen roots, `
    + `${evidence.buildings.filter(record => record.match === 'overlap-verified').length} unambiguous OSM matches.`);
}
