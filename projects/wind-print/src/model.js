export const SIZE = 1000;
export const PALETTES = {
  teal: { ink: '#326e65', leaves: ['#316f65', '#71998b', '#96b2a0', '#d67f69', '#4b7384'] },
  coral: { ink: '#596f99', leaves: ['#cf7c65', '#df9b7d', '#5b779f', '#829bb5', '#477c73'] },
};

export function randomSource(seed) {
  if (!Number.isInteger(seed) || seed < 1 || seed > 999999999) throw new RangeError('Seed must be an integer from 1 to 999999999');
  let state = seed;
  return () => {
    state |= 0;
    state = state + 0x6D2B79F5 | 0;
    let value = Math.imul(state ^ state >>> 15, 1 | state);
    value = value + Math.imul(value ^ value >>> 7, 61 | value) ^ value;
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

function validateDensity(density) {
  if (!Number.isInteger(density) || density < 15 || density > 100) throw new RangeError('Density must be between 15 and 100');
}

export function makeBranch(points, density, seed) {
  validateDensity(density);
  if (!Array.isArray(points) || points.length < 2 || points.some(point =>
    !Array.isArray(point) || point.length !== 2 || point.some(value => !Number.isFinite(value)))) {
    throw new TypeError('A branch needs at least two finite 2D points');
  }
  const random = randomSource(seed);
  const lengths = points.slice(1).map((point, index) => Math.hypot(point[0] - points[index][0], point[1] - points[index][1]));
  const total = lengths.reduce((sum, length) => sum + length, 0);
  const spacing = 25 - density * .15;
  const leaves = [];
  let next = spacing, distance = 0;
  for (let index = 0; index < lengths.length; index++) {
    const length = lengths[index], [x, y] = points[index];
    const [tx, ty] = points[index + 1];
    while (next < distance + length) {
      const t = (next - distance) / length;
      const progress = next / total;
      const taper = Math.sin(progress * Math.PI) * .55 + .45;
      for (const side of [-1, 1]) {
        leaves.push({
          x: x + (tx - x) * t, y: y + (ty - y) * t,
          angle: Math.atan2(ty - y, tx - x) + side * (.68 + random() * .3),
          length: (24 + random() * 30) * taper,
          width: .15 + random() * .09, color: Math.floor(random() * 5),
          bend: (random() - .5) * .25, progress,
        });
      }
      next += spacing;
    }
    distance += length;
  }
  return { points: points.map(point => [...point]), leaves };
}

export function createComposition(seed, density) {
  validateDensity(density);
  const random = randomSource(seed);
  const branches = [];
  const specs = [
    [115, 727, 875, 610, -96],
    [351, 655, 749, 801, 71],
    [411, 641, 212, 527, -34],
  ];
  for (const [x0, y0, x1, y1, bend] of specs) {
    const wobble = (random() - .5) * 54;
    const points = Array.from({ length: 61 }, (_, i) => {
      const t = i / 60;
      return [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t + Math.sin(t * Math.PI) * (bend + wobble)
        + Math.sin(t * Math.PI * 2) * 18];
    });
    branches.push(makeBranch(points, density, 1 + Math.floor(random() * 999999998)));
  }
  return branches;
}

export function windOffset(x, y, pointer, mode) {
  if (!pointer || mode === 'restore') return [0, 0];
  if (!['push', 'attract'].includes(mode)) throw new RangeError('Unknown wind mode');
  const dx = x - pointer.x, dy = y - pointer.y;
  const distance = Math.hypot(dx, dy);
  if (distance >= 175 || distance < .01) return [0, 0];
  const strength = (1 - distance / 175) ** 2 * (mode === 'push' ? 68 : -48);
  return [dx / distance * strength, dy / distance * strength];
}

export function sampleStroke(points, point, minimum = 10) {
  if (point.some(value => !Number.isFinite(value))) throw new TypeError('Stroke coordinates must be finite');
  const bounded = [Math.max(75, Math.min(925, point[0])), Math.max(485, Math.min(845, point[1]))];
  const last = points.at(-1);
  if (!last || Math.hypot(bounded[0] - last[0], bounded[1] - last[1]) >= minimum) return [...points, bounded];
  return points;
}
