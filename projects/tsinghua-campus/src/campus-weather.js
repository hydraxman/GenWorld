// Directions point from the ground to the sun in campus coordinates: east, up, south.
export const CAMPUS_WEATHER = {
  clear: {
    label: '晴日', direction: [.55, .9, .75], sun: ['#fff4e3', 3], fill: ['#dfedff', '#b6aea0', .8],
    environment: .12, exposure: 1.05, shadow: 1, water: '#6da4b2', wet: 0, visibility: [1800, 10500],
    sky: {horizon: '#8acbfa', zenith: '#0867d2', cloud: '#ffffff', cloudLow: '#edf4ff',
      cover: [.52, .69], light: 2.95, base: 1.85},
  },
  overcast: {
    label: '阴天', direction: [.35, .9, .55], sun: ['#e6eaf0', .46], fill: ['#e2e8ef', '#b1b1a7', 1.45],
    environment: .36, exposure: 1.02, shadow: .38, water: '#788f94', wet: 0, visibility: [520, 3900],
    sky: {horizon: '#c4ccd0', zenith: '#8292a3', cloud: '#e9e9e6', cloudLow: '#8998a7',
      cover: [.16, .55], light: 1.62, base: .93},
  },
  'after-rain': {
    label: '雨后', direction: [-.64, .62, -.28], sun: ['#fff1d2', 1.65], fill: ['#d3e4ee', '#9fa9a0', 1.05],
    environment: .29, exposure: 1.03, shadow: .78, water: '#4e8190', wet: .9, visibility: [700, 5600],
    sky: {horizon: '#aad0d6', zenith: '#316e9a', cloud: '#fffff4', cloudLow: '#8497a4',
      cover: [.36, .63], light: 2.55, base: .96},
  },
  sunset: {
    label: '夕照', direction: [-1, .29, .22], sun: ['#ffbf83', 2.85], fill: ['#ced9f3', '#ae8d7c', .86],
    environment: .22, exposure: 1.04, shadow: .94, water: '#697f91', wet: 0, visibility: [1200, 7400],
    sky: {horizon: '#d2adb1', zenith: '#55739e', cloud: '#ffcf9c', cloudLow: '#a495ac',
      cover: [.49, .69], light: 2.48, base: 1.1, glow: '#ffc281'},
  },
};

export function campusWeather(id) {
  if (!Object.hasOwn(CAMPUS_WEATHER, id)) throw new RangeError(`未知校园天气：${id}`);
  return CAMPUS_WEATHER[id];
}
