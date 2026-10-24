import polygonClipping from 'polygon-clipping';
import { createHash } from 'node:crypto';

export const ZOOM = 14;
export const EXTENT = 4096;
const WORLD = 2 ** ZOOM * EXTENT;
export const sha256 = value => createHash('sha256').update(
  typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value),
).digest('hex');
export const multi = geometry => {
  if (geometry.type === 'Polygon') return [geometry.coordinates];
  if (geometry.type === 'MultiPolygon') return geometry.coordinates;
  throw new Error(`Expected polygon geometry, received ${geometry.type}`);
};
export const polygon = coordinates => coordinates.length === 1
  ? { type: 'Polygon', coordinates: coordinates[0] }
  : { type: 'MultiPolygon', coordinates };
export const rectangle = ([w, s, e, n]) => [[[w, s], [e, s], [e, n], [w, n], [w, s]]];
export function mapGeometry(geometry, fn) {
  const descend = c => typeof c[0] === 'number' ? fn(c) : c.map(descend);
  return { type: geometry.type, coordinates: descend(geometry.coordinates) };
}
export function project([lon, lat]) {
  return [(lon + 180) / 360 * WORLD,
    (1 - Math.asinh(Math.tan(lat * Math.PI / 180)) / Math.PI) / 2 * WORLD];
}
export function unproject([x, y]) {
  return [Number((x / WORLD * 360 - 180).toFixed(9)),
    Number((Math.atan(Math.sinh(Math.PI * (1 - 2 * y / WORLD))) * 180 / Math.PI).toFixed(9))];
}
export function bounds(geometry) {
  const result = [Infinity, Infinity, -Infinity, -Infinity];
  mapGeometry(geometry, ([x, y]) => {
    result[0] = Math.min(result[0], x); result[1] = Math.min(result[1], y);
    result[2] = Math.max(result[2], x); result[3] = Math.max(result[3], y);
    return [x, y];
  });
  return result;
}
export const boundsOverlap = (a, b) => a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];
export function signedArea(ring) {
  let area = 0;
  const [x, y] = ring[0];
  for (let i = 0; i < ring.length - 1; i++) area +=
    (ring[i][0] - x) * (ring[i + 1][1] - y) - (ring[i + 1][0] - x) * (ring[i][1] - y);
  return area / 2;
}
export const area = coords => coords.reduce((sum, p) => sum + Math.abs(signedArea(p[0])) -
  p.slice(1).reduce((holes, r) => holes + Math.abs(signedArea(r)), 0), 0);
export function insideRing([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
export const inside = (point, coords) => coords.some(p => insideRing(point, p[0]) &&
  !p.slice(1).some(r => insideRing(point, r)));

// Source geometry is on the native tile grid before union. Adjacent tiles therefore
// share exact integer seam coordinates, not separately rounded lon/lat projections.
export function tileGeometry(feature, x, y, z, extent) {
  const geo = feature.toGeoJSON(x, y, z).geometry;
  const scale = WORLD / (2 ** z * extent);
  return mapGeometry(geo, p => project(p).map(v => Math.round(v / scale) * scale));
}
export function mergePolygons(fragments) {
  if (!fragments.length) return [];
  return polygonClipping.union(...fragments.map(f => multi(f)));
}
export const intersect = (a, b) => polygonClipping.intersection(a, b);
export function rewind(geometry) {
  if (!geometry.type.endsWith('Polygon')) return geometry;
  return polygon(multi(geometry).map(p => p.map((r, i) =>
    (signedArea(r) > 0) === (i === 0) ? r : [...r].reverse())));
}
export function buildingHeights(raw) {
  const top = raw.render_height, bottom = raw.render_min_height;
  const renderHeight = typeof top === 'number' && Number.isFinite(top) && top > 0 ? top : 12;
  const minHeight = typeof bottom === 'number' && Number.isFinite(bottom) && bottom >= 0 ? bottom : 0;
  if (minHeight > renderHeight) throw new Error('Minimum height exceeds top height');
  const extrude = ![true, 1, 'true', '1'].includes(raw.hide_3d);
  return {
    renderHeight, minHeight,
    heightSource: renderHeight === top ? 'openfreemap-render-height' : 'fallback-12m-not-surveyed',
    minHeightSource: minHeight === bottom ? 'openfreemap-render-min-height' : 'fallback-ground-0m',
    extrude, footprintRole: extrude ? 'extrudable-building-or-part' : 'planning-outline-hide-3d',
  };
}

// Deterministic IDs also tolerate ring starting-index, winding and part-order changes.
export function canonicalGeometry(geometry) {
  const order = (a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b), 'en');
  const line = pts => {
    const forward = pts.map(p => p.map(n => Number(n.toFixed(9))));
    const backward = [...forward].reverse();
    return order(forward, backward) <= 0 ? forward : backward;
  };
  const ring = points => {
    const pts = points.slice(0, -1).map(p => p.map(n => Number(n.toFixed(9))));
    const variants = [];
    for (const seq of [pts, [...pts].reverse()]) {
      const minimum = [...seq].sort(order)[0];
      for (let i = 0; i < seq.length; i++) if (order(seq[i], minimum) === 0) {
        const rotated = [...seq.slice(i), ...seq.slice(0, i)];
        variants.push([...rotated, rotated[0]]);
      }
    }
    return variants.sort(order)[0];
  };
  if (geometry.type === 'Polygon' || geometry.type === 'MultiPolygon') {
    const parts = multi(geometry).map(p => [ring(p[0]), ...p.slice(1).map(ring).sort(order)]).sort(order);
    return { type: 'MultiPolygon', coordinates: parts };
  }
  if (geometry.type === 'Point') return geometry;
  const lines = geometry.type === 'LineString' ? [geometry.coordinates] : geometry.coordinates;
  return { type: 'MultiLineString', coordinates: lines.map(line).sort(order) };
}
export const geometryId = (layer, geometry) => `${layer}:geometry:${sha256(canonicalGeometry(geometry)).slice(0, 24)}`;

// Clip line segments against all polygon edges, including holes. The midpoint
// test selects intervals; it does not incorrectly discard a line crossing the mask.
export function clipLines(geometry, mask) {
  const input = geometry.type === 'LineString' ? [geometry.coordinates] : geometry.coordinates;
  const output = [];
  const cross = (a, b) => a[0] * b[1] - a[1] * b[0];
  for (const line of input) {
    let current = [];
    const flush = () => { if (current.length > 1) output.push(current); current = []; };
    for (let i = 0; i < line.length - 1; i++) {
      const a = line[i], b = line[i + 1], d = [b[0] - a[0], b[1] - a[1]];
      if (!d[0] && !d[1]) continue;
      const cuts = [0, 1];
      for (const p of mask) for (const ring of p) for (let j = 0; j < ring.length - 1; j++) {
        const c = ring[j], e = [ring[j + 1][0] - c[0], ring[j + 1][1] - c[1]];
        const denominator = cross(d, e);
        if (Math.abs(denominator) < 1e-12) continue;
        const ca = [c[0] - a[0], c[1] - a[1]];
        const t = cross(ca, e) / denominator, u = cross(ca, d) / denominator;
        if (t > 0 && t < 1 && u >= 0 && u <= 1) cuts.push(t);
      }
      cuts.sort((a, b) => a - b);
      for (let j = 0; j < cuts.length - 1; j++) {
        const t = cuts[j], u = cuts[j + 1];
        if (u - t < 1e-12) continue;
        if (!inside([a[0] + d[0] * (t + u) / 2, a[1] + d[1] * (t + u) / 2], mask)) { flush(); continue; }
        const start = [a[0] + d[0] * t, a[1] + d[1] * t], end = [a[0] + d[0] * u, a[1] + d[1] * u];
        const last = current.at(-1);
        if (last && Math.hypot(last[0] - start[0], last[1] - start[1]) > 1e-7) flush();
        if (!current.length) current.push(start);
        current.push(end);
      }
    }
    flush();
  }
  const unique = new Map(output.map(l => [sha256(canonicalGeometry({ type: 'LineString', coordinates: l })), l]));
  return [...unique.values()];
}
export function validateGeometry(geometry) {
  const supported = ['Polygon', 'MultiPolygon', 'LineString', 'MultiLineString', 'Point'];
  if (!geometry || !supported.includes(geometry.type)) throw new Error(`Unexpected geometry ${geometry?.type}`);
  mapGeometry(geometry, p => {
    if (p.length !== 2 || !p.every(Number.isFinite)) throw new Error('Nonfinite or unexpected coordinate');
    return p;
  });
  if (geometry.type.endsWith('Polygon')) {
    const parts = multi(geometry);
    if (!parts.length) throw new Error('Empty polygon');
    for (const p of parts) {
      if (!p.length) throw new Error('Empty polygon rings');
      for (const r of p) {
        if (r.length < 4 || JSON.stringify(r[0]) !== JSON.stringify(r.at(-1)) || signedArea(r) === 0) {
          throw new Error('Degenerate or unclosed polygon ring');
        }
      }
    }
  } else if (geometry.type.includes('LineString')) {
    const lines = geometry.type === 'LineString' ? [geometry.coordinates] : geometry.coordinates;
    if (!lines.length || lines.some(l => l.length < 2)) throw new Error('Empty or short line');
  }
}
