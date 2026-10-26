export function architectureSignature(feature, center) {
  const text = JSON.stringify([center, feature.geometry, feature.properties.renderHeight,
    feature.properties.minHeight, feature.properties.extrude]);
  let value = 2166136261;
  for (let i = 0; i < text.length; i++) value = Math.imul(value ^ text.charCodeAt(i), 16777619) >>> 0;
  return `${text.length}:${value.toString(16).padStart(8, '0')}`;
}
