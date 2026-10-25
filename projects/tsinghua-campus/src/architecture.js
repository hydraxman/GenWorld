import * as THREE from 'three';

export function addFootprintPrism(B, group, ring, bottom, top, material) {
  const shape = new THREE.Shape(ring.map(([x, z]) => new THREE.Vector2(x, -z)));
  const geometry = new THREE.ExtrudeGeometry(shape, {depth: top - bottom, bevelEnabled: false, curveSegments: 1});
  geometry.rotateX(-Math.PI / 2); geometry.translate(0, bottom, 0);
  B.worldUV(geometry, material); B.add(group, geometry, material);
}

export function addTriangle(B, group, points, material) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points.flat(), 3));
  geometry.computeVertexNormals();
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(points.flatMap(p => [p[0] / 4, p[2] / 4]), 2));
  B.add(group, geometry, material);
}

export function outlineEdges(ring) {
  const area = ring.reduce((sum, a, i) => {
    const b = ring[(i + 1) % ring.length]; return sum + a[0] * b[1] - b[0] * a[1];
  }, 0);
  return ring.map((a, index) => {
    const b = ring[(index + 1) % ring.length], length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const tangent = [(b[0] - a[0]) / length, (b[1] - a[1]) / length], sign = area > 0 ? 1 : -1;
    return {a, b, length, tangent, normal: [sign * tangent[1], -sign * tangent[0]],
      yaw: -Math.atan2(tangent[1], tangent[0])};
  }).filter(edge => edge.length > .05);
}
