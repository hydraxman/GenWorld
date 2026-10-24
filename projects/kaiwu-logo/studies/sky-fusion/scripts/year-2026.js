export function withYear2026(source, THREE) {
  const inLastDigit = contour => contour.every(([x, y]) =>
    x >= 355 && x <= 374 && y >= 477 && y <= 504);
  const matches = source.circuits.flatMap((polygon, polygonIndex) =>
    polygon.holes.flatMap((hole, holeIndex) => inLastDigit(hole) ? [{polygonIndex, holeIndex}] : []));
  if (matches.length !== 1) throw new Error('Expected exactly one original 2023 final-digit cutout');
  const {polygonIndex, holeIndex} = matches[0];

  // Match the traced numerals' cap height and heavy strokes without a runtime font.
  const outline = new THREE.Path();
  outline.moveTo(371.9, 482.7);
  outline.bezierCurveTo(370.9, 478.7, 368, 477.35, 364.9, 477.35);
  outline.bezierCurveTo(358.4, 477.35, 355.9, 483.2, 355.9, 491.1);
  outline.bezierCurveTo(355.9, 499.2, 358.6, 503, 364.5, 503);
  outline.bezierCurveTo(369.7, 503, 373, 499.4, 373, 494.4);
  outline.bezierCurveTo(373, 489.5, 370, 486.5, 365.5, 486.5);
  outline.bezierCurveTo(363.4, 486.5, 361.7, 487.3, 360.5, 488.7);
  outline.bezierCurveTo(360.7, 483.7, 362.2, 481.3, 365.1, 481.3);
  outline.bezierCurveTo(366.9, 481.3, 367.8, 482.3, 368.2, 483.4);
  outline.closePath();

  const counter = new THREE.Path();
  counter.moveTo(360.6, 494.7);
  counter.bezierCurveTo(360.6, 491.8, 362, 490.2, 364.4, 490.2);
  counter.bezierCurveTo(366.9, 490.2, 368.3, 491.9, 368.3, 494.7);
  counter.bezierCurveTo(368.3, 497.4, 366.8, 499.1, 364.4, 499.1);
  counter.bezierCurveTo(362, 499.1, 360.6, 497.4, 360.6, 494.7);

  const sample = path => path.getPoints(16).slice(0, -1).map(({x, y}) => [x, y]);
  const circuits = source.circuits.map((polygon, index) => index === polygonIndex
    ? {...polygon, holes: polygon.holes.map((hole, index) => index === holeIndex ? sample(outline) : hole)}
    : polygon);
  // The inside of a negative-space "6" is a separate solid island, like the original "0".
  circuits.push({outer: sample(counter), holes: [], noBevel: []});
  return {...source, circuits};
}
