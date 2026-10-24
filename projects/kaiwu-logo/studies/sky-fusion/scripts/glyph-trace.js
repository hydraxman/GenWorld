export const GLYPHS = [
  {name: '清', page: 'rightPage', bounds: [340, 180, 435, 280]},
  {name: '工', page: 'rightPage', bounds: [340, 290, 435, 380]},
  {name: '開', page: 'leftPage', bounds: [200, 180, 300, 280]},
  {name: '悟', page: 'leftPage', bounds: [200, 285, 300, 380]},
];

export function glyphContours(geometry, glyph) {
  const [left, top, right, bottom] = glyph.bounds;
  const inside = contour => contour.length >= 3 &&
    contour.every(([x, y]) => x >= left && x <= right && y >= top && y <= bottom);
  const contours = [];
  for (const [polygonIndex, polygon] of geometry[glyph.page].entries()) {
    const candidates = [polygon.outer, ...polygon.holes];
    for (const [index, points] of candidates.entries()) {
      if (inside(points)) contours.push({
        points, polygonIndex, kind: index === 0 ? 'outer' : 'hole', holeIndex: index - 1,
      });
    }
  }
  if (!contours.length) throw new Error(`Missing original letter contours: ${glyph.name}`);
  return contours;
}

export function sampleContour(points, spacing = .01) {
  const vertices = points.map(([x, y]) => [(x - 319.3) * .01, (319.5 - y) * .01]);
  const lengths = vertices.map((p, i) => {
    const q = vertices[(i + 1) % vertices.length];
    return Math.hypot(q[0] - p[0], q[1] - p[1]);
  });
  const perimeter = lengths.reduce((sum, length) => sum + length, 0);
  if (!(perimeter > 0)) throw new Error('Letter contour has zero length');
  const count = Math.max(12, Math.ceil(perimeter / spacing));
  const samples = [];
  let segment = 0, passed = 0;
  for (let i = 0; i < count; i++) {
    const distance = i / count * perimeter;
    while (segment < lengths.length - 1 && (passed + lengths[segment] <= distance || lengths[segment] === 0)) {
      passed += lengths[segment++];
    }
    const u = lengths[segment] > 0 ? (distance - passed) / lengths[segment] : 0;
    const a = vertices[segment], b = vertices[(segment + 1) % vertices.length];
    samples.push({position: [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, .024],
      along: i / count});
  }
  return samples;
}

export function createGlyphTrace(THREE, groups, geometry, timeUniform) {
  const stats = [], nodes = [];
  const material = new THREE.ShaderMaterial({
    uniforms: {studyTime: timeUniform},
    transparent: true, depthTest: true, depthWrite: false,
    blending: THREE.AdditiveBlending, toneMapped: false,
    vertexShader: `
      uniform float studyTime;
      attribute float along;
      attribute float startTime;
      varying float brightness;
      varying float heat;
      void main() {
        float progress = (studyTime - startTime) / .60;
        float lag = progress - along;
        float head = exp(-pow(lag / .028, 2.));
        float tail = exp(-max(lag, 0.) * 12.) * step(0., lag);
        float ink = .12 * smoothstep(-.005, .005, lag);
        float gate = smoothstep(startTime - .02, startTime + .03, studyTime)
          * (1. - smoothstep(startTime + .60, startTime + .80, studyTime));
        brightness = (head * .9 + tail * .58 + ink) * gate;
        heat = head;
        vec4 mv = modelViewMatrix * vec4(position, 1.);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = 3. + head * 8. + tail * 3.;
      }`,
    fragmentShader: `
      precision highp float;
      varying float brightness;
      varying float heat;
      void main() {
        float r = length(gl_PointCoord - .5);
        float alpha = (exp(-r*r*48.) + .18*exp(-r*r*12.)) * brightness;
        if (alpha < .006) discard;
        vec3 color = mix(vec3(1., .69, .28), vec3(.88, .96, 1.), heat);
        gl_FragColor = vec4(color, min(alpha, 1.));
      }`,
  });
  for (const [index, glyph] of GLYPHS.entries()) {
    const start = 4.45 + index * .42;
    const contours = glyphContours(geometry, glyph);
    const positions = [], along = [], starts = [];
    for (const contour of contours) for (const sample of sampleContour(contour.points)) {
      positions.push(...sample.position);
      along.push(sample.along);
      starts.push(start);
    }
    const buffer = new THREE.BufferGeometry();
    buffer.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    buffer.setAttribute('along', new THREE.Float32BufferAttribute(along, 1));
    buffer.setAttribute('startTime', new THREE.Float32BufferAttribute(starts, 1));
    const node = new THREE.Points(buffer, material);
    node.name = `Original glyph contour trace: ${glyph.name}`;
    node.frustumCulled = false;
    groups[glyph.page].add(node);
    nodes.push(node);
    stats.push({name: glyph.name, page: glyph.page, contours: contours.length, points: along.length,
      start, finish: start + .80, sourceBounds: glyph.bounds,
      sourceContours: contours.map(({polygonIndex, kind, holeIndex}) => ({polygonIndex, kind, holeIndex}))});
  }
  return {
    nodes, stats,
    state: time => stats.map(glyph => ({name: glyph.name,
      active: time >= glyph.start && time < glyph.finish,
      progress: Math.max(0, Math.min(1, (time - glyph.start) / .60))})),
  };
}
