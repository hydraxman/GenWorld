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
