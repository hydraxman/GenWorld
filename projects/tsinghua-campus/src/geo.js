const RADIUS = 6378137;
const RADIANS = Math.PI / 180;

export function project([longitude, latitude], center) {
  if (![longitude, latitude, ...center].every(Number.isFinite)) {
    throw new Error('Projection requires finite WGS84 coordinates.');
  }
  return [
    RADIUS * (longitude - center[0]) * RADIANS * Math.cos(center[1] * RADIANS),
    -RADIUS * (latitude - center[1]) * RADIANS,
  ];
}

export function polygons(geometry) {
  if (geometry.type === 'Polygon') return [geometry.coordinates];
  if (geometry.type === 'MultiPolygon') return geometry.coordinates;
  throw new Error(`Expected polygon geometry, got ${geometry.type}`);
}

export function lines(geometry) {
  if (geometry.type === 'LineString') return [geometry.coordinates];
  if (geometry.type === 'MultiLineString') return geometry.coordinates;
  throw new Error(`Expected line geometry, got ${geometry.type}`);
}

export function pointInPolygon(point, polygon) {
  const inRing = ring => {
    let result = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[i], b = ring[j];
      if ((a[1] > point[1]) !== (b[1] > point[1]) &&
          point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) result = !result;
    }
    return result;
  };
  return inRing(polygon[0]) && !polygon.slice(1).some(inRing);
}

export function segmentDistance(point, a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1], length = dx * dx + dz * dz;
  const t = length ? Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dz) / length)) : 0;
  return Math.hypot(point[0] - a[0] - t * dx, point[1] - a[1] - t * dz);
}

export function roadProfile(feature) {
  const p = feature.properties;
  const roadClass = p.class || p.upstreamProperties?.class || p.raw?.class || p.sourceProperties?.class || '';
  const width = p.kind === 'water' ? 3 : ['path', 'pedestrian', 'track'].includes(roadClass) ? 2.5
    : ['primary', 'secondary', 'tertiary'].includes(roadClass) ? 9 : 5;
  const brunnel = p.brunnel || p.upstreamProperties?.brunnel || p.raw?.brunnel;
  return {roadClass, width, brunnel, height: brunnel === 'bridge' ? 1.1 : p.kind === 'water' ? .11 : .24};
}

export function ringArea(points) {
  return Math.abs(points.reduce((sum, a, i) => {
    const b = points[(i + 1) % points.length];
    return sum + a[0] * b[1] - b[0] * a[1];
  }, 0)) / 2;
}

export function footprintMetrics(geometry, center) {
  const projected = polygons(geometry).map(polygon =>
    polygon.map(ring => ring.map(point => project(point, center))));
  let area = 0;
  const bounds = [Infinity, Infinity, -Infinity, -Infinity];
  for (const polygon of projected) {
    if (!polygon.length || polygon.some(ring => ring.length < 4)) {
      throw new Error('A footprint needs closed polygon rings.');
    }
    area += ringArea(polygon[0]) - polygon.slice(1).reduce((sum, ring) => sum + ringArea(ring), 0);
    for (const [x, z] of polygon[0]) {
      bounds[0] = Math.min(bounds[0], x);
      bounds[1] = Math.min(bounds[1], z);
      bounds[2] = Math.max(bounds[2], x);
      bounds[3] = Math.max(bounds[3], z);
    }
  }
  if (!(area > 0) || !bounds.every(Number.isFinite)) throw new Error('Empty or invalid footprint.');
  return {projected, area, bounds, origin: [(bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2]};
}
