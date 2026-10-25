import {project, footprintMetrics, ringArea} from './geo.js';

const prefix = 'building:geometry:';
const rows = [
  [1, '23d2b6d3833865e896982bf2', '79696972', '2a503cce'],
  [2, '14b553cc0f464b0929399c23', '79696973', '4d6f5439'],
  [3, '3f0f404774cf29f6d86ae91a', '79696974', '7d2cdc1f'],
  [4, '37463e4d28e145d20a8fa72d', '79696964', 'f80b4e2c'],
  [5, '2d898d42e8c1fab68aa1270b', '79696965', 'c650dd72'],
  [6, '79c15388686919a5c642b3c8', '79696966', '3233e493'],
  [7, 'ecf53403cc0fdbcc371d161f', '79696968', 'ccf615d8'],
  [8, 'f3e43ba15ac3ed8c463387e1', '79696969', '08bce947'],
  [9, '0ba68ea0395e53b57ec509e2', '79696955', 'ed2d6b15'],
  [10, 'd610ac52ae6eb71aee24252d', '79696956', '41125ba8'],
  [11, 'ab84f4d6049ae8c3878e8120', '79696957', '5e3621d2'],
  [12, 'eb0036d85dc719b44012599a', '79696958', '4d33cce2'],
  [13, 'e8100209f6d71c316db50e43', '79696959', 'fec9e1bf'],
  [[14, 15, 16, 17], 'b2d1efe7e37b0570b0979197', null, 'cf7899c2'],
  [18, 'cb36b8e051ddbffc79e5e255', '79698988', 'b4d1ee63'],
  [19, 'c63b3cb088d82f735f75c7c8', '79698948', '3e6995c3'],
  [20, '8a4c5fac52f1922f38050a45', '79698950', '7341be77'],
  [21, '23070734d08edc5bbddc23d9', '79698952', '92cc5d1d'],
  [22, '3d75d76b50caec7510c1289b', '79698956', '8b7f3104'],
  [23, '3aebb8f19da24cdaddc97a21', '79698958', 'aed5ea19'],
];

export const ZIJING_SOURCES = rows.map(([numbers, id, osmWay, geometrySignature]) => ({
  featureId: prefix + id, numbers: Array.isArray(numbers) ? numbers : [numbers],
  osmWay, geometrySignature, referenceSite: 'zijing-dormitories',
}));
export const ZIJING_APARTMENTS = ZIJING_SOURCES.flatMap(source =>
  source.numbers.map(number => ({number, featureId: source.featureId,
    name: `紫荆学生公寓${number}号楼`, family: number <= 13 ? 'pitched-low-rise'
      : number <= 17 ? 'w-doctoral' : 'terraced-high-rise'})));
export const ZIJING_IDS = ZIJING_SOURCES.map(source => source.featureId);

// Shared endpoints of OSM ways 84644281 / 79698971 / 84644276 / 84644273.
// These only partition the frozen outline; the OSM rings never replace it.
export const DOCTORAL_SEAMS = [
  [[116.3219018, 40.0114053], [116.3218999, 40.0115352]],
  [[116.3228968, 40.0114581], [116.3228833, 40.0115898]],
  [[116.3238732, 40.0115057], [116.3238597, 40.0116353]],
];

function signature(geometry) {
  let hash = 2166136261;
  for (const char of JSON.stringify(geometry)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  return hash.toString(16).padStart(8, '0');
}

export function verifyZijingSource(feature) {
  const source = ZIJING_SOURCES.find(source => source.featureId === feature?.id);
  const merged = source?.numbers.length === 4;
  const p = feature?.properties;
  if (!source || p?.kind !== 'building' || feature.geometry?.type !== 'Polygon' ||
      signature(feature.geometry) !== source.geometrySignature || p.minHeight !== 0 ||
      p.renderHeight !== (merged || source.numbers[0] === 18 ? 5 : source.numbers[0] <= 13 ? 26 : 41) ||
      p.extrude !== true || (merged
        ? p.name !== '' || !source.numbers.every(number => p.poiLabels?.some(label =>
          label.name === `紫荆学生公寓${number}号楼`))
        : p.name !== `紫荆学生公寓${source.numbers[0]}号楼` ||
          p.nameSourceFeatureId !== `osm:way:${source.osmWay}` ||
          p.nameSource !== 'osm-local-extract-building-overlap')) {
    throw new Error('Zijing frozen footprint/identity changed; re-review the source.');
  }
  return source;
}

function halfPlane(ring, a, b, east) {
  const distance = p => ((b[1] - a[1]) * (p[0] - a[0]) -
    (b[0] - a[0]) * (p[1] - a[1])) * (east ? -1 : 1);
  const output = [];
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i], q = ring[(i + 1) % ring.length], dp = distance(p), dq = distance(q);
    if (dp >= -1e-8) output.push(p);
    if (dp * dq < 0) output.push(p.map((v, axis) => v + (q[axis] - v) * dp / (dp - dq)));
  }
  return output;
}

export function zijingPartitions(feature, center) {
  const source = verifyZijingSource(feature);
  const metrics = footprintMetrics(feature.geometry, center), ring = metrics.projected[0][0].slice(0, -1);
  if (source.numbers.length === 1) return [{number: source.numbers[0], ring}];
  const seams = DOCTORAL_SEAMS.map(seam => seam.map(point => project(point, center)));
  const parts = source.numbers.map((number, index) => {
    let part = ring;
    if (index > 0) part = halfPlane(part, ...seams[index - 1], true);
    if (index < 3) part = halfPlane(part, ...seams[index], false);
    return {number, ring: part};
  });
  if (parts.some(part => part.ring.length < 3) ||
      Math.abs(parts.reduce((sum, part) => sum + ringArea(part.ring), 0) - metrics.area) > .001) {
    throw new Error('Doctoral-apartment partitions must preserve the entire frozen outline.');
  }
  return parts;
}
