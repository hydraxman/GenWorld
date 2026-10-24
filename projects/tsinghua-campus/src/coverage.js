export function createCoverage(campus, data, catalog) {
  const features = data.features.filter(feature => feature.properties.kind === 'building');
  if (features.length !== campus.buildings.size) throw new Error('Coverage must include every frozen map building.');
  const records = features.map(feature => {
    const object = campus.buildings.get(feature.id);
    if (!object || object.userData.featureId !== feature.id) throw new Error(`Coverage identity mismatch: ${feature.id}`);
    const p = object.userData;
    if (!['base', 'detailed'].includes(p.refinementStatus)) throw new Error(`Unknown reconstruction stage: ${feature.id}`);
    if (p.refinementStatus === 'detailed' && !p.referenceSite) throw new Error(`Missing photo provenance: ${feature.id}`);
    return {
      featureId: feature.id, name: p.name || null, mapName: feature.properties.name || null,
      stage: p.refinementStatus === 'detailed'
        ? p.reconstructionExtent === 'partial' ? 'photo-informed-partial' : 'photo-informed-estimate'
        : 'footprint-base',
      referenceSite: p.referenceSite || null,
      coordinates: feature.properties.localOrigin || null,
      mapHeight: feature.properties.renderHeight, mapHeightSource: feature.properties.heightSource,
      currentHeight: p.renderHeight, currentHeightSource: p.heightSource,
      limitations: p.refinementStatus === 'detailed'
        ? p.refinementSummary : 'Only the map footprint and upstream visualization height; roof and facade not reconstructed.',
    };
  });
  const reconstructed = records.filter(record => record.stage !== 'footprint-base');
  const partial = reconstructed.filter(record => record.stage === 'photo-informed-partial');
  const landmarks = [...campus.landmarks.values()].map(object => ({
    featureId: object.userData.featureId, name: object.userData.name,
    referenceSite: object.userData.referenceSite,
    stage: 'photo-informed-estimate', limitations: object.userData.refinementSummary,
  }));
  const references = catalog.sites.map(site => {
    const buildingIds = reconstructed.filter(record => record.referenceSite === site.id).map(record => record.featureId);
    const landmarkIds = landmarks.filter(record => record.referenceSite === site.id).map(record => record.featureId);
    return {
      siteId: site.id, name: site.name, photos: site.images.length, buildingIds, landmarkIds,
      stage: buildingIds.length || landmarkIds.length ? 'model-present-with-estimates' : 'photos-ready-identity-or-model-pending',
      unknowns: site.unknowns,
    };
  });
  return {
    schemaVersion: 1, scope: data.metadata.name,
    limitations: 'Stage coverage, not a fidelity score. Photo-informed geometry still includes estimated scale, hidden facades and unverified details. Map outlines can merge connected buildings.',
    counts: {
      mapBuildingObjects: records.length, photoModelBuildingObjects: reconstructed.length,
      remainingBaseBuildingObjects: records.length - reconstructed.length,
      partialPhotoModelBuildingObjects: partial.length,
      remainingWorkBuildingObjects: records.length - reconstructed.length + partial.length,
      independentLandmarks: landmarks.length,
      photoModelSites: new Set([...reconstructed, ...landmarks].map(record => record.referenceSite)).size,
      surveyedBuildingObjects: 0,
    },
    allFootprintsHavePhotoModels: reconstructed.length === records.length,
    completeFaithfulReplication: false,
    buildings: records, landmarks, references,
  };
}
