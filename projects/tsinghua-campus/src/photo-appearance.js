import evidence from '../data/appearance-profiles.json' with {type: 'json'};
import {architectureSignature} from './architecture-contract.js';

const center = [116.32003975, 40.00164005];
export const APPEARANCE_SITES = evidence.sites.map(site => ({
  ...site, status: 'photo-appearance-only-not-full-reconstruction',
  images: site.images.map(image => ({...image, license: evidence.license, downloadedAt: evidence.reviewedAt})),
}));
export const PHOTO_APPEARANCES = evidence.buildings;
const profiles = new Map(PHOTO_APPEARANCES.map(profile => [profile.featureId, profile]));
const sites = new Map(APPEARANCE_SITES.map(site => [site.id, site]));

export function appearanceProfile(feature) {
  const profile = profiles.get(feature.id);
  if (!profile) return null;
  if (profile.signature !== architectureSignature(feature, center) ||
      feature.properties.name !== profile.name || feature.properties.nameRole !== 'building-name' ||
      feature.properties.nameSourceFeatureId !== profile.sourceId || !sites.has(profile.site)) {
    throw new Error(`Photo appearance identity/footprint changed: ${feature.id}`);
  }
  if (profile.facade) {
    const facade = profile.facade, site = sites.get(profile.site);
    if (!['loggia', 'flat-canopy', 'square-canopy', 'masonry-portal', 'civic-colonnade'].includes(facade.style) ||
        !Number.isInteger(facade.polygon) || facade.polygon < 0 || !Number.isInteger(facade.edge) || facade.edge < 0 ||
        !(Number.isFinite(facade.width) && facade.width > 3 && facade.width < 40) ||
        !site.images.some(image => image.path.replaceAll('\\', '/') === facade.image) || !facade.observed?.length || !facade.limitations) {
      throw new Error(`Invalid photo facade evidence: ${profile.id}`);
    }
  }
  return profile;
}

export function appearanceSource(profile) {
  const site = sites.get(profile.site);
  if (!site) throw new Error(`Unknown appearance source: ${profile.site}`);
  return site;
}

export function appearanceLimitations(profile) {
  const site = appearanceSource(profile);
  return `程序建筑估算，非照片逐面复原。已按对应照片调整配色与有限特征：${site.observations.join('；')}。`
    + `${site.unknowns.join('；')}。`
    + (profile.facade ? `本次入口精调：${profile.facade.observed.join('、')}。${profile.facade.limitations}` : '')
    + '朝向、尺度与未入镜表面仍含推定，无照片贴图。';
}
