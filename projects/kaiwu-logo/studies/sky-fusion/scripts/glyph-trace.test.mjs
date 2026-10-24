import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {GLYPHS, glyphContours, sampleContour} from './glyph-trace.js';

const source = JSON.parse(await readFile(new URL(
  '../../../latest/tsinghua-mem-five-effects-cloud/inputs/semantic-geometry.json', import.meta.url)));

test('traces all four original letters, including interior islands, without book edges', () => {
  assert.deepEqual(GLYPHS.map(glyph => glyph.name), ['清', '工', '開', '悟']);
  assert.deepEqual(GLYPHS.map(glyph => glyphContours(source, glyph).length), [7, 1, 8, 6]);
  const references = new Set();
  for (const glyph of GLYPHS) for (const contour of glyphContours(source, glyph)) {
    const ref = `${glyph.page}:${contour.polygonIndex}:${contour.kind}:${contour.holeIndex}`;
    assert.ok(!references.has(ref), 'Contour must belong to exactly one letter');
    references.add(ref);
  }
});

test('every light sample lies on an actual source outline, never bridges disconnected strokes', () => {
  for (const glyph of GLYPHS) for (const {points} of glyphContours(source, glyph)) {
    const samples = sampleContour(points);
    assert.ok(samples.length >= 12);
    let previous = -1;
    for (const {position: [x, y, z], along} of samples) {
      assert.ok(along > previous && along < 1);
      previous = along;
      assert.equal(z, .024);
      const sx = x * 100 + 319.3, sy = 319.5 - y * 100;
      let minimum = Infinity;
      for (let i = 0; i < points.length; i++) {
        const a = points[i], b = points[(i + 1) % points.length];
        const dx = b[0] - a[0], dy = b[1] - a[1], d2 = dx * dx + dy * dy;
        const u = d2 ? Math.max(0, Math.min(1, ((sx - a[0]) * dx + (sy - a[1]) * dy) / d2)) : 0;
        minimum = Math.min(minimum, Math.hypot(sx - a[0] - dx * u, sy - a[1] - dy * u));
      }
      assert.ok(minimum < 1e-7, `Light point drifted away from ${glyph.name} by ${minimum} source pixels`);
    }
  }
});
