import {FOOTPRINT} from '../../../../shunde/src/footprint.js';

export const DURATION = 4;
export const FOV = 2 * Math.atan(1.07 / 2) * 180 / Math.PI;
export const FINAL_DISTANCE = 40;
export const FINAL_OFFSET = 0;
export const FRONT = FOOTPRINT[1].map((v, i) => (v + FOOTPRINT[2][i]) / 2);
const dx = FOOTPRINT[2][0] - FOOTPRINT[1][0];
const dz = FOOTPRINT[2][1] - FOOTPRINT[1][1];
const length = Math.hypot(dx, dz);
export const OUTWARD = [dz / length, -dx / length];
const mix = (a, b, p) => a + (b - a) * p;
export const smooth = (t, a, b) => {
  const u = Math.max(0, Math.min(1, (t - a) / (b - a)));
  return u ** 3 * (u * (u * 6 - 15) + 10);
};
const bezier = (a, b, c, d, u) =>
  (1 - u) ** 3 * a + 3 * (1 - u) ** 2 * u * b + 3 * (1 - u) * u * u * c + u ** 3 * d;

export function flightAt(seconds) {
  if (!Number.isFinite(seconds)) throw new Error('Flight time must be finite.');
  const t = Math.max(0, Math.min(DURATION, seconds));
  const travel = smooth(t, .95, 3.4);
  const final = [FRONT[0] + OUTWARD[0] * FINAL_DISTANCE + FINAL_OFFSET, 8.5,
    FRONT[1] + OUTWARD[1] * FINAL_DISTANCE];
  const position = [0, 1, 2].map(i => bezier(
    [-43, 230, -85][i], [-31, 215, -81][i], final[i], final[i], travel));
  const aim = [mix(15, FRONT[0] + FINAL_OFFSET, travel), mix(3, 17, travel), mix(20, FRONT[1], travel)];
  const delta = aim.map((v, i) => v - position[i]);
  const tilt = smooth(t, .65, 1.35);
  const pitch = mix(.76, Math.atan2(delta[1], Math.hypot(delta[0], delta[2])), tilt);
  const yaw = mix(0, Math.atan2(delta[0], delta[2]), tilt);
  return {position, pitch, yaw, fov: mix(FOV, 63, smooth(t, 2.15, 3.4)), travel,
    target: position.map((v, i) => v + [
      Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch),
    ][i] * 100),
    stage: t <= .65 ? 'original sky' : t < 1.35 ? 'pitch down' : t < 2.75 ? 'aerial descent'
      : t < 3.4 ? 'level toward north entrance' : 'frontal hold'};
}

export function badgeAt(seconds) {
  if (!Number.isFinite(seconds)) throw new Error('Badge time must be finite.');
  const p = smooth(seconds, 1.85, 2.75);
  return {scale: p === 1 ? .42 : mix(1, .42, p), y: mix(0, 1.55, p)};
}
