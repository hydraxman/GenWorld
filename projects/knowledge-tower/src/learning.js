import { FLOORS } from './curriculum.js';
import { gradeAssessment, getFloorAssessment } from './assessments.js';

export const STORAGE_KEY = 'knowledge-tower.learning.v1';

const ROOMS = FLOORS.flatMap(floor => floor.rooms);
const ROOM_FLOORS = new Map(ROOMS.map(room => [room.id, room.floor]));
const PROFILE_KEYS = ['version', 'rooms', 'attempts', 'position', 'updatedAt'];
const ROOM_KEYS = ['selfRating', 'examScore', 'visitedAt'];
const ATTEMPT_KEYS = ['floor', 'score', 'passed', 'at', 'answers'];
const ACTION_KEYS = {
  visit: ['type', 'roomId', 'at'],
  position: ['type', 'floor', 'roomId', 'at'],
  rate: ['type', 'roomId', 'score', 'at'],
  exam: ['type', 'floor', 'answers', 'at'],
};

function invalid(path, message) {
  throw new TypeError(`${path}: ${message}`);
}

// Reject accessors, symbols, custom prototypes and extra fields before reading data.
// This also rejects __proto__/constructor payloads rather than merging them.
function record(value, path, expectedKeys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    invalid(path, 'must be a plain object');
  }
  const keys = Reflect.ownKeys(value);
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (typeof key !== 'string' || !descriptor || !('value' in descriptor)
      || !descriptor.enumerable) {
      invalid(path, 'must contain only enumerable data fields');
    }
  }
  if (expectedKeys && (keys.length !== expectedKeys.length
    || expectedKeys.some(key => !Object.hasOwn(value, key)))) {
    invalid(path, `expected exactly these fields: ${expectedKeys.join(', ')}`);
  }
  return keys;
}

function array(value, path, maximum) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype
    || value.length > maximum
    || Reflect.ownKeys(value).length !== value.length + 1) {
    invalid(path, `must be a dense array with at most ${maximum} entries`);
  }
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) {
      invalid(path, 'must contain only indexed data entries');
    }
  }
}

function floorNumber(value, path) {
  if (!Number.isInteger(value) || value < 1 || value > 16) {
    invalid(path, 'must be an integer from 1 to 16');
  }
}

function roomId(value, path) {
  if (typeof value !== 'string' || !ROOM_FLOORS.has(value)) {
    invalid(path, 'must be a curriculum room id (1-1 through 16-4)');
  }
}

function score(value, path) {
  if (value !== null && (typeof value !== 'number' || !Number.isFinite(value)
    || value < 0 || value > 100)) {
    invalid(path, 'must be null or a finite number from 0 to 100');
  }
}

function timestamp(value, path, nullable = false) {
  if (nullable && value === null) return;
  // Full ISO instants only; reject impossible calendar dates that Date.parse normalizes.
  const match = typeof value === 'string'
    && /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(?:Z|[+-](\d{2}):(\d{2}))$/.exec(value);
  if (!match) invalid(path, 'must be a valid ISO timestamp with a timezone');
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, zoneHour, zoneMinute] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month < 1 || month > 12 || day < 1 || day > days[month - 1]
    || Number(hourText) > 23 || Number(minuteText) > 59 || Number(secondText) > 59
    || (zoneHour !== undefined && (Number(zoneHour) > 23 || Number(zoneMinute) > 59))
    || !Number.isFinite(Date.parse(value))) {
    invalid(path, 'must be a valid ISO timestamp with a timezone');
  }
}

function position(value, path) {
  record(value, path, ['floor', 'roomId']);
  floorNumber(value.floor, `${path}.floor`);
  if (value.roomId !== null) {
    roomId(value.roomId, `${path}.roomId`);
    if (ROOM_FLOORS.get(value.roomId) !== value.floor) {
      invalid(path, 'roomId must belong to floor');
    }
  }
}

function validateProfile(profile) {
  record(profile, 'profile', PROFILE_KEYS);
  if (profile.version !== 1) invalid('profile.version', 'unsupported schema version (expected 1)');
  const ids = record(profile.rooms, 'profile.rooms');
  if (ids.length > ROOMS.length) invalid('profile.rooms', 'too many rooms');
  for (const id of ids) {
    roomId(id, 'profile.rooms key');
    const entry = profile.rooms[id];
    record(entry, `profile.rooms.${id}`, ROOM_KEYS);
    score(entry.selfRating, `profile.rooms.${id}.selfRating`);
    if (entry.examScore !== null && entry.examScore !== 0 && entry.examScore !== 100) {
      invalid(`profile.rooms.${id}.examScore`, 'must be null, 0 or 100');
    }
    timestamp(entry.visitedAt, `profile.rooms.${id}.visitedAt`, true);
  }
  position(profile.position, 'profile.position');
  timestamp(profile.updatedAt, 'profile.updatedAt', true);
  array(profile.attempts, 'profile.attempts', 100);
  profile.attempts.forEach((attempt, index) => {
    const path = `profile.attempts[${index}]`;
    record(attempt, path, ATTEMPT_KEYS);
    floorNumber(attempt.floor, `${path}.floor`);
    timestamp(attempt.at, `${path}.at`);
    const graded = gradeAssessment(attempt.floor, attempt.answers);
    if (attempt.score !== graded.score || attempt.passed !== graded.passed) {
      invalid(path, 'score and passed must match the graded answers');
    }
  });
}

function blankRoom() {
  return { selfRating: null, examScore: null, visitedAt: null };
}

function cloneProfile(profile) {
  return {
    version: 1,
    rooms: Object.fromEntries(Object.entries(profile.rooms).map(([id, entry]) => [id, { ...entry }])),
    attempts: profile.attempts.map(attempt => ({ ...attempt, answers: [...attempt.answers] })),
    position: { ...profile.position },
    updatedAt: profile.updatedAt,
  };
}

function effective(entry) {
  if (entry?.examScore !== null && entry?.examScore !== undefined) {
    return { score: entry.examScore, source: 'exam' };
  }
  if (entry?.selfRating !== null && entry?.selfRating !== undefined) {
    return { score: entry.selfRating, source: 'self' };
  }
  return { score: null, source: 'unknown' };
}

export function createProfile() {
  return {
    version: 1,
    rooms: {},
    attempts: [],
    position: { floor: 1, roomId: null },
    updatedAt: null,
  };
}

export function updateProfile(profile, action) {
  validateProfile(profile);
  record(action, 'action');
  if (typeof action.type !== 'string' || !Object.hasOwn(ACTION_KEYS, action.type)) {
    invalid('action.type', 'unsupported action');
  }
  record(action, 'action', ACTION_KEYS[action.type]);
  timestamp(action.at, 'action.at');
  let graded;
  switch (action.type) {
    case 'visit':
      roomId(action.roomId, 'action.roomId');
      break;
    case 'position':
      position({ floor: action.floor, roomId: action.roomId }, 'action.position');
      break;
    case 'rate':
      roomId(action.roomId, 'action.roomId');
      score(action.score, 'action.score');
      break;
    case 'exam':
      graded = gradeAssessment(action.floor, action.answers);
      break;
    default:
      invalid('action.type', 'unsupported action');
  }

  // All input validation finishes before any new state is changed.
  const next = cloneProfile(profile);
  const ensureRoom = id => {
    if (!Object.hasOwn(next.rooms, id)) next.rooms[id] = blankRoom();
    return next.rooms[id];
  };
  if (action.type === 'visit') ensureRoom(action.roomId).visitedAt = action.at;
  if (action.type === 'position') next.position = { floor: action.floor, roomId: action.roomId };
  if (action.type === 'rate') ensureRoom(action.roomId).selfRating = action.score;
  if (action.type === 'exam') {
    for (const result of graded.results) {
      ensureRoom(result.roomId).examScore = result.correct ? 100 : 0;
    }
    next.attempts.push({
      floor: graded.floor,
      score: graded.score,
      passed: graded.passed,
      at: action.at,
      answers: [...action.answers],
    });
    next.attempts = next.attempts.slice(-100);
  }
  next.updatedAt = action.at;
  return next;
}

export function getMastery(profile) {
  validateProfile(profile);
  return Object.fromEntries(ROOMS.map(room => [room.id, effective(profile.rooms[room.id]).score]));
}

export function describeRoom(profile, id) {
  validateProfile(profile);
  roomId(id, 'roomId');
  const entry = profile.rooms[id] ?? blankRoom();
  const { score: value, source } = effective(entry);
  const [label, color] = value === null ? ['未评估', '#65778d']
    : value < 40 ? ['薄弱', '#e77b78']
      : value < 70 ? ['巩固中', '#e8b96a']
        : value < 85 ? ['熟悉', '#59cdb7']
          : ['熟练', '#7baff5'];
  return {
    score: value,
    source,
    label,
    color,
    visitedAt: entry.visitedAt,
    selfRating: entry.selfRating,
    examScore: entry.examScore,
  };
}

export function summarizeProfile(profile) {
  validateProfile(profile);
  const entries = Object.entries(profile.rooms);
  const values = entries.map(([, entry]) => effective(entry).score).filter(value => value !== null);
  const latest = new Map();
  // History order (not best score or a client clock) defines the latest attempt.
  for (const attempt of profile.attempts) latest.set(attempt.floor, attempt.passed);
  return {
    visited: entries.filter(([, entry]) => entry.visitedAt !== null).length,
    rated: entries.filter(([, entry]) => entry.selfRating !== null).length,
    assessed: entries.filter(([, entry]) => entry.examScore !== null).length,
    weak: values.filter(value => value < 40).length,
    strong: values.filter(value => value >= 85).length,
    known: values.length,
    average: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null,
    passedFloors: [...latest].filter(([, passed]) => passed).map(([floor]) => floor).sort((a, b) => a - b),
    recent: entries
      .filter(([, entry]) => entry.visitedAt !== null)
      .map(([id, entry]) => ({ roomId: id, visitedAt: entry.visitedAt }))
      .sort((a, b) => Date.parse(b.visitedAt) - Date.parse(a.visitedAt)
        || a.roomId.localeCompare(b.roomId))
      .slice(0, 5),
  };
}

export function loadProfile(storage) {
  if (!storage || typeof storage.getItem !== 'function') {
    throw new TypeError('storage.getItem must be a function');
  }
  let serialized;
  try {
    serialized = storage.getItem(STORAGE_KEY);
  } catch (cause) {
    throw new Error('Unable to read learning profile storage', { cause });
  }
  if (serialized === null) return createProfile();
  if (typeof serialized !== 'string') invalid('storage profile', 'must be a JSON string or a missing key');
  let profile;
  try {
    profile = JSON.parse(serialized);
  } catch (cause) {
    throw new Error('Corrupted learning profile JSON', { cause });
  }
  validateProfile(profile);
  return profile;
}

export function saveProfile(storage, profile) {
  validateProfile(profile);
  if (!storage || typeof storage.setItem !== 'function') {
    throw new TypeError('storage.setItem must be a function');
  }
  const serialized = JSON.stringify(profile);
  try {
    storage.setItem(STORAGE_KEY, serialized);
  } catch (cause) {
    throw new Error('Unable to write learning profile storage (blocked or quota exceeded)', { cause });
  }
}

export function createDemoProfile() {
  // An explicit, fictional demonstration of uneven skills, never persisted here.
  // No identity, ambient clock, or visits inferred from mere assessment activity.
  let profile = createProfile();
  const at = '2026-01-01T12:00:00.000Z';
  const ratings = {
    '1-1': 25, '1-2': 35, '1-3': 20, '1-4': 45,
    '2-2': 65, '6-3': 30, '8-3': 50, '11-1': 35,
    '13-1': 90, '13-2': 95, '14-1': 95, '14-2': 90,
    '15-1': 95, '15-2': 90, '16-1': 95, '16-2': 90,
  };
  for (const [id, value] of Object.entries(ratings)) {
    profile = updateProfile(profile, { type: 'rate', roomId: id, score: value, at });
  }
  for (const floor of [14, 15, 16]) {
    const answers = getFloorAssessment(floor).map(question => question.correctIndex);
    profile = updateProfile(profile, { type: 'exam', floor, answers, at });
  }
  const foundationAnswers = getFloorAssessment(1).map(question => (question.correctIndex + 1) % 4);
  profile = updateProfile(profile, { type: 'exam', floor: 1, answers: foundationAnswers, at });
  for (const id of ['1-3', '14-1', '16-1']) {
    profile = updateProfile(profile, { type: 'visit', roomId: id, at });
  }
  return updateProfile(profile, { type: 'position', floor: 16, roomId: '16-1', at });
}
