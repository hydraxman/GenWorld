export function createCoverage(campus, data, catalog) {
  const features = data.features.filter(feature => feature.properties.kind === 'building');
  if (features.length !== campus.buildings.size) throw new Error('Coverage must include every frozen map building.');
  const records = features.map(feature => {
    const object = campus.buildings.get(feature.id);
    if (!object || object.userData.featureId !== feature.id) throw new Error(`Coverage identity mismatch: ${feature.id}`);
    const p = object.userData;
    if (!['base', 'procedural', 'detailed'].includes(p.refinementStatus)) throw new Error(`Unknown reconstruction stage: ${feature.id}`);
    if (p.refinementStatus === 'detailed' && !p.referenceSite) throw new Error(`Missing photo provenance: ${feature.id}`);
    if (p.refinementStatus === 'procedural' && (!p.architectureFamily || !p.architectureSource || p.referenceSite)) {
      throw new Error(`Missing or misleading procedural architecture provenance: ${feature.id}`);
    }
    if (p.appearanceProfileId && (p.refinementStatus !== 'procedural' || !p.appearanceReferenceSite ||
        !p.appearanceBasis || !p.appearanceReferencePages?.length)) {
      throw new Error(`Missing or misleading photo appearance provenance: ${feature.id}`);
    }
    return {
      featureId: feature.id, name: p.name || null, mapName: feature.properties.name || null,
      stage: p.refinementStatus === 'detailed'
        ? p.referenceBasis === 'group-photo-typology-estimate' ? 'group-photo-typology-estimate'
          : p.reconstructionExtent === 'partial' ? 'photo-informed-partial' : 'photo-informed-estimate'
        : p.refinementStatus === 'procedural' ? 'procedural-architecture-estimate' : 'footprint-base',
      referenceBasis: p.referenceBasis || null, apartmentNumbers: p.apartmentNumbers || [],
      architectureFamily: p.architectureFamily || null, architectureSource: p.architectureSource || null,
      estimatedFloors: p.estimatedFloors ?? null, floorsSource: p.floorsSource || null,
      referenceSite: p.referenceSite || null,
      appearanceProfileId: p.appearanceProfileId || null,
      appearanceReferenceSite: p.appearanceReferenceSite || null,
      appearanceBasis: p.appearanceBasis || null,
      appearanceStage: p.appearanceProfileId ? 'photo-guided-appearance-on-estimated-envelope' : null,
      coordinates: feature.properties.localOrigin || null,
      mapHeight: feature.properties.renderHeight, mapHeightSource: feature.properties.heightSource,
      currentHeight: p.renderHeight, currentHeightSource: p.heightSource,
      limitations: p.refinementStatus !== 'base'
        ? p.refinementSummary : 'Only the map footprint and upstream visualization height; roof and facade not reconstructed.',
    };
  });
  const reconstructed = records.filter(record => record.stage.startsWith('photo-informed') || record.stage === 'group-photo-typology-estimate');
  const procedural = records.filter(record => record.stage === 'procedural-architecture-estimate');
  const base = records.filter(record => record.stage === 'footprint-base');
  const appearance = procedural.filter(record => record.appearanceProfileId);
  const partial = reconstructed.filter(record => record.stage === 'photo-informed-partial');
  const typology = reconstructed.filter(record => record.stage === 'group-photo-typology-estimate');
  const landmarks = [...campus.landmarks.values()].map(object => ({
    featureId: object.userData.featureId, name: object.userData.name,
    referenceSite: object.userData.referenceSite,
    stage: 'photo-informed-estimate', limitations: object.userData.refinementSummary,
  }));
  const references = catalog.sites.map(site => {
    const buildingIds = reconstructed.filter(record => record.referenceSite === site.id).map(record => record.featureId);
    const landmarkIds = landmarks.filter(record => record.referenceSite === site.id).map(record => record.featureId);
    const appearanceBuildingIds = appearance.filter(record => record.appearanceReferenceSite === site.id).map(record => record.featureId);
    return {
      siteId: site.id, name: site.name, photos: site.images.length, buildingIds, landmarkIds, appearanceBuildingIds,
      stage: buildingIds.length || landmarkIds.length ? 'model-present-with-estimates'
        : appearanceBuildingIds.length ? 'photo-appearance-only-estimated-envelope' : 'photos-ready-identity-or-model-pending',
      unknowns: site.unknowns,
    };
  });
  return {
    schemaVersion: 2, scope: data.metadata.name,
    limitations: 'Architecture-stage coverage, not a fidelity score. Photo-guided palettes/features on procedural envelopes are counted separately, not promoted to photo reconstructions. Group-photo typology models are not per-building photo verification. Geometry includes estimated scale, hidden facades and unverified details. Scope is the frozen map, not a certified current campus inventory.',
    counts: {
      mapBuildingObjects: records.length, photoModelBuildingObjects: reconstructed.length,
      architectureModelBuildingObjects: reconstructed.length + procedural.length,
      proceduralArchitectureBuildingObjects: procedural.length,
      photoAppearanceBuildingObjects: appearance.length,
      photoAppearanceSites: new Set(appearance.map(record => record.appearanceReferenceSite)).size,
      remainingBaseBuildingObjects: base.length,
      partialPhotoModelBuildingObjects: partial.length,
      groupTypologyBuildingObjects: typology.length,
      remainingWorkBuildingObjects: records.length - reconstructed.length + partial.length + typology.length,
      independentLandmarks: landmarks.length,
      photoModelSites: new Set([...reconstructed, ...landmarks].map(record => record.referenceSite)).size,
      surveyedBuildingObjects: 0,
    },
    allFootprintsHaveArchitecture: base.length === 0,
    allFootprintsHavePhotoModels: reconstructed.length === records.length,
    completeFaithfulReplication: false,
    logicalApartmentNumbers: [...new Set(records.flatMap(record => record.apartmentNumbers))].sort((a, b) => a - b),
    buildings: records, landmarks, references,
  };
}
