import {refineShunde} from './shunde-refinement.js';
import {refineSEM, SEM_ID} from './sem-refinement.js';
import {refineAuditorium, AUDITORIUM_ID} from './auditorium-refinement.js';
import {refineMainBuilding, MAIN_BUILDING_IDS} from './main-building-refinement.js';
import {refineSchool, SCHOOL_ID} from './school-refinement.js';
import {refineWestGym, WEST_GYM_ID} from './west-gym-refinement.js';
import {refineOldLibrary, OLD_LIBRARY_IDS} from './old-library-refinement.js';
import {refineGongzi, GONGZI_IDS} from './gongzi-refinement.js';
import {refineScienceHall, SCIENCE_HALL_ID} from './science-hall-refinement.js';
import {refineTongfang, TONGFANG_ID} from './tongfang-refinement.js';
import {refineChemistryHall, CHEMISTRY_HALL_ID} from './chemistry-hall-refinement.js';
import {refineModernBuilding, MODERN_BUILDINGS} from './modern-buildings.js';
import {refineZijing} from './zijing.js';
import {ZIJING_SOURCES, ZIJING_IDS} from './zijing-sources.js';
import {refineDining, DINING_SOURCES} from './zijing-dining.js';
import {refineBiologyHall, BIOLOGY_HALL_ID} from './biology-hall.js';

export const REFINEMENT_SITES = [
  {
    featureId: BIOLOGY_HALL_ID, referenceSite: 'biology-hall',
    buttonId: 'view-biology-hall', label: '生物学馆 · 原庭院',
    viewDirection: [.24, .5, 1.1], reconstructionExtent: 'partial',
    aliases: ['老生物馆', '原Courtyard', '庭院模型'],
    additionalViews: [{buttonId: 'view-biology-north', label: '生物学馆北门', viewDirection: [-.22, .23, -1.1],
      focusObject: 'Photo-refined north bridge entrance'}],
    apply: refineBiologyHall,
  },
  {
    featureId: 'building:geometry:6bd0154b26cfe7cf654cdd3b',
    referenceSite: 'shunde-building',
    buttonId: 'view-shunde', label: '舜德楼', viewDirection: [0.35, 0.7, -1.1],
    apply: (campus, data) => refineShunde(campus, data, 'building:geometry:6bd0154b26cfe7cf654cdd3b'),
  },
  {
    featureId: SEM_ID, referenceSite: 'sem-complex', buttonId: 'view-sem', label: '经管红楼', viewDirection: [0.6, 0.7, -1.1],
    apply: refineSEM,
  },
  {
    featureId: AUDITORIUM_ID, referenceSite: 'auditorium', buttonId: 'view-auditorium', label: '大礼堂', viewDirection: [-0.5, 0.65, 1.1],
    apply: refineAuditorium,
  },
  ...MAIN_BUILDING_IDS.map((featureId, index) => ({
    featureId, referenceSite: 'main-building', buttonId: index === 0 ? 'view-main-building' : null,
    label: ['中央主楼', '西主楼', '东主楼'][index], viewDirection: [0.2, 0.55, 1.1],
    groupFeatureIds: MAIN_BUILDING_IDS,
    apply: (campus, data) => refineMainBuilding(campus, data, featureId),
  })),
  {
    featureId: SCHOOL_ID, referenceSite: 'tsinghua-school', buttonId: 'view-school', label: '清华学堂',
    viewDirection: [0.804178, 0.65, 0.594389],
    apply: (campus, data) => refineSchool(campus, data),
  },
  {
    featureId: WEST_GYM_ID, referenceSite: 'west-gym', buttonId: 'view-west-gym', label: '西体育馆',
    reconstructionExtent: 'partial',
    viewDirection: [0.08, 0.28, 1.1],
    apply: (campus, data) => refineWestGym(campus, data),
  },
  ...OLD_LIBRARY_IDS.map((featureId, index) => ({
    featureId, referenceSite: 'old-library', buttonId: index === 0 ? 'view-old-library' : null,
    label: '老图书馆', viewDirection: [-1.1, 0.35, 0.06],
    displayName: '老图书馆 · 历史入口与连通组团',
    displayNameSource: 'Official old-library photographs and verified relation match; display label, not an upstream map-name tag.',
    aliases: ['老图书馆', '老馆', '图书馆老馆', 'Old Library'],
    groupFeatureIds: OLD_LIBRARY_IDS, reconstructionExtent: 'partial',
    apply: (campus, data) => refineOldLibrary(campus, data, featureId),
  })),
  ...GONGZI_IDS.map((featureId, index) => ({
    featureId, referenceSite: 'gongzi-shuimu', buttonId: index === 0 ? 'view-gongzi' : null,
    label: index === 0 ? '工字厅' : '工字厅门房',
    viewDirection: [0.35, 0.5, 1.1], groupFeatureIds: GONGZI_IDS,
    additionalViews: index === 0 ? [{
      buttonId: 'view-shuimu', label: '水木清华', viewDirection: [-0.08, 0.45, -1.1],
    }] : [],
    apply: (campus, data) => refineGongzi(campus, data, featureId),
  })),
  {
    featureId: SCIENCE_HALL_ID, referenceSite: 'science-hall', buttonId: 'view-science-hall', label: '科学馆',
    viewDirection: [0.997752, 0.3, -0.067013],
    apply: (campus, data) => refineScienceHall(campus, data),
  },
  {
    featureId: TONGFANG_ID, referenceSite: 'tongfang', buttonId: 'view-tongfang', label: '同方部',
    viewDirection: [-1.1, 0.3, -0.35], reconstructionExtent: 'partial',
    apply: (campus, data) => refineTongfang(campus, data),
  },
  {
    featureId: CHEMISTRY_HALL_ID, referenceSite: 'chemistry-hall',
    buttonId: 'view-chemistry-hall', label: '老化学馆',
    displayName: '化学馆 · 1932年老馆',
    displayNameSource: 'Official chemistry centenary history and old-hall photographs; display label, not an upstream map-name tag.',
    aliases: ['老化学馆', '化学馆老馆', 'Old Chemistry Hall'],
    viewDirection: [0.063163, 0.28, 0.998003], reconstructionExtent: 'partial',
    apply: (campus, data) => refineChemistryHall(campus, data),
  },
  ...MODERN_BUILDINGS.map(source => ({
    featureId: source.featureId, referenceSite: source.referenceSite,
    buttonId: `view-${source.referenceSite}`,
    label: {'art-museum': '艺术博物馆', 'sports-center': '综合体育馆', 'music-hall': '蒙民伟音乐厅'}[source.referenceSite],
    viewDirection: source.referenceSite === 'art-museum' ? [.55, .45, 1.1]
      : source.referenceSite === 'music-hall' ? [.08, .02, 1.1] : [.12, .02, 1.1],
    reconstructionExtent: source.referenceSite === 'music-hall' ? 'partial' : 'whole-footprint-estimate',
    apply: (campus, data) => refineModernBuilding(campus, data, source.featureId),
  })),
  ...ZIJING_SOURCES.map((source, index) => ({
    featureId: source.featureId, referenceSite: source.referenceSite,
    buttonId: index === 0 ? 'view-zijing' : null, label: `紫荆公寓${source.numbers.join('–')}号楼`,
    groupFeatureIds: ZIJING_IDS, viewDirection: [.15, .7, 1.1],
    referenceBasis: 'group-photo-typology-estimate',
    ...(source.numbers.length > 1 ? {
      displayName: '紫荆学生公寓14–17号楼 · W楼组团',
      displayNameSource: 'Frozen footprint POI labels and independent named OSM way shared boundaries; official W-building group caption. Not a replacement upstream map-name tag.',
    } : {}),
    aliases: source.numbers.flatMap(number => [`紫荆${number}号楼`, `紫荆公寓${number}`, `紫荆学生公寓${number}号楼`, `Zijing ${number}`]),
    apply: (campus, data) => refineZijing(campus, data, source.featureId),
  })),
  ...DINING_SOURCES.map(source => ({
    featureId: source.featureId, referenceSite: source.referenceSite, buttonId: `view-${source.referenceSite}`,
    label: source.name, viewDirection: source.referenceSite === 'taoli-dining' ? [-1.1, .65, .7] : [-.4, .8, 1.1],
    reconstructionExtent: 'partial',
    aliases: [source.name.replace('餐厅', '食堂')],
    apply: (campus, data) => refineDining(campus, data, source.featureId),
  })),
];

export const REFINEMENT_VIEWS = REFINEMENT_SITES.flatMap(site => [
  {featureId: site.featureId, buttonId: site.buttonId, label: site.label,
    viewDirection: site.viewDirection, groupFeatureIds: site.groupFeatureIds},
  ...(site.additionalViews || []).map(view => ({featureId: site.featureId, ...view})),
]).filter(view => view.buttonId);

export function* buildCampusRefinements(campus, data, options = {}) {
  const ids = [];
  for (const site of REFINEMENT_SITES) {
    if (!campus.buildings.has(site.featureId)) {
      throw new Error(`${site.label} footprint ID changed; re-match the source before rebuilding.`);
    }
    const target = site.apply(campus, data, options);
    if (target !== campus.buildings.get(site.featureId) || target.userData.refinementStatus !== 'detailed') {
      throw new Error(`${site.label} refinement did not replace the registered building.`);
    }
    if (!target.userData.refinementSummary || target.userData.referenceSite !== site.referenceSite) {
      throw new Error(`${site.label} refinement needs its own description and reference-site identity.`);
    }
    target.userData.referenceBasis = site.referenceBasis || 'building-photo-informed';
    target.userData.reconstructionLevel = site.referenceBasis === 'group-photo-typology-estimate'
      ? 'group-photo-typology-estimate-not-surveyed' : 'photo-informed-estimate-not-surveyed';
    target.userData.reconstructionExtent = site.reconstructionExtent || 'whole-footprint-estimate';
    if (site.displayName) {
      if (!site.displayNameSource) throw new Error(`${site.label} display name needs its own source.`);
      target.name = target.userData.name = site.displayName;
      target.userData.displayNameSource = site.displayNameSource;
    }
    if (site.aliases) target.userData.aliases = [...new Set([...(target.userData.aliases || []), ...site.aliases])];
    ids.push(site.featureId);
    yield site.featureId;
  }
  campus.group.userData.levelOfDetail = 'Map base with registered photo-informed reconstructions; not surveyed.';
  campus.group.userData.refinedBuildingIds = ids;
}

export function applyCampusRefinements(campus, data, options = {}) {
  return [...buildCampusRefinements(campus, data, options)];
}
