import {createHash} from 'node:crypto';
import {readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {XMLParser} from 'fast-xml-parser';
import polygonClipping from 'polygon-clipping';

const root = resolve(import.meta.dirname, '..');
const list = value => value === undefined ? [] : Array.isArray(value) ? value : [value];
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const tags = object => Object.fromEntries(list(object.tag).map(tag => [tag.k, tag.v]));
const insideRing = (point, ring) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > point[1]) !== (b[1] > point[1]) &&
        point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
};

export async function landscapeEvidence() {
  const [osmBytes, boundaryBytes] = await Promise.all([
    readFile(resolve(root, '..', 'tsinghua-tour', 'campus.osm')),
    readFile(resolve(root, 'data', 'boundary.geojson')),
  ]);
  if (osmBytes.includes(Buffer.from('\r\n'))) throw new Error('Landscape evidence requires committed LF OSM bytes.');
  const xml = new XMLParser({ignoreAttributes: false, attributeNamePrefix: '', parseAttributeValue: false}).parse(osmBytes).osm;
  const boundary = JSON.parse(boundaryBytes).geometry;
  const campus = boundary.type === 'Polygon' ? [boundary.coordinates] : boundary.coordinates;
  const nodes = new Map(list(xml.node).map(node => [node.id, [Number(node.lon), Number(node.lat)]]));
  const schoolGrounds = list(xml.way).filter(way => tags(way).name === '清华附中操场' || way.id === '1442584520');
  const sportsBoundary = polygonClipping.difference(campus, schoolGrounds.map(way =>
    [list(way.nd).map(node => nodes.get(node.ref))]));
  const grounds = list(xml.way).flatMap(way => {
    const t = tags(way), refs = list(way.nd).map(node => node.ref);
    if (!['pitch', 'track'].includes(t.leisure) || t.building || refs.length < 4 || refs[0] !== refs.at(-1)) return [];
    const ring = refs.map(id => nodes.get(id));
    if (ring.some(point => !point)) throw new Error(`Missing sports-ground node in OSM way ${way.id}`);
    const clipped = polygonClipping.intersection([[ring]], sportsBoundary);
    if (!clipped.length) return [];
    return [{id: `osm:way:${way.id}`, name: t.name || null, sport: t.sport || null, leisure: t.leisure,
      sourceGeometry: {type: 'Polygon', coordinates: [ring]},
      geometry: {type: 'MultiPolygon', coordinates: clipped}}];
  });
  const trees = list(xml.node).filter(node => tags(node).natural === 'tree').flatMap(node => {
    const point = nodes.get(node.id);
    return campus.some(polygon => insideRing(point, polygon[0]) && !polygon.slice(1).some(ring => insideRing(point, ring)))
      ? [{id: `osm:node:${node.id}`, coordinates: point}] : [];
  });
  return {schemaVersion: 1, source: {path: '../tsinghua-tour/campus.osm', sha256: hash(osmBytes),
    boundarySHA256: hash(boundaryBytes), license: 'ODbL 1.0; © OpenStreetMap contributors'},
  excludedGroundAreas: schoolGrounds.map(way => ({id: `osm:way:${way.id}`, name: tags(way).name || '清华附中跑道',
    reason: 'Affiliated secondary-school ground, not one of the university playgrounds in this display.'})),
  limitations: 'Frozen community-map sports boundaries and individual tree locations, not a current survey. Affiliated secondary-school playground areas are excluded. Court lines, track width, tree species, heights and crowns are display estimates. Additional greenery is explicitly illustrative planting within mapped green areas.',
  grounds, trees};
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const evidence = await landscapeEvidence();
  await writeFile(resolve(root, 'data', 'landscape-evidence.json'), JSON.stringify(evidence, null, 2) + '\n');
  console.log(`Landscape evidence: ${evidence.grounds.length} mapped sports polygons; ${evidence.trees.length} mapped trees.`);
}
