export function setLabViewport(camera, width, height) {
  const compact = width <= 760;
  const region = compact
    ? {x: 10, y: 82, width: Math.max(1, width - 20), height: Math.max(1, height * .53 - 92)}
    : {x: 18, y: 105, width: Math.max(1, width - 404), height: Math.max(1, height - 125)};
  camera.setViewOffset(region.width, region.height, -region.x, -region.y, width, height);
  camera.updateProjectionMatrix();
  return region;
}
