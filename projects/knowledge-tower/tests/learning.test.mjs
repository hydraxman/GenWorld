import test from 'node:test';
import assert from 'node:assert/strict';
import { FLOORS } from '../src/curriculum.js';
import { getFloorAssessment, gradeAssessment } from '../src/assessments.js';
import {
  STORAGE_KEY,
  createProfile,
  updateProfile,
  getMastery,
  summarizeProfile,
  describeRoom,
  loadProfile,
  saveProfile,
  createDemoProfile,
} from '../src/learning.js';

const AT = '2026-10-15T12:00:00.000Z';
const LATER = '2026-10-16T12:00:00.000Z';
const ids = FLOORS.flatMap(floor => floor.rooms.map(room => room.id));
const correctAnswers = floor => getFloorAssessment(floor).map(question => question.correctIndex);
const wrongAnswers = floor => correctAnswers(floor).map(index => (index + 1) % 4);
const act = (profile, action) => updateProfile(profile, { at: AT, ...action });
const exam = (profile, floor, answers = correctAnswers(floor), at = AT) =>
  updateProfile(profile, { type: 'exam', floor, answers, at });
const rate = (profile, roomId, score) => act(profile, { type: 'rate', roomId, score });
const visit = (profile, roomId, at = AT) => act(profile, { type: 'visit', roomId, at });

function storage(initial = null) {
  let value = initial;
  const calls = [];
  return {
    calls,
    getItem(key) {
      calls.push(['get', key]);
      return value;
    },
    setItem(key, next) {
      calls.push(['set', key, next]);
      value = next;
    },
  };
}

function deepFreeze(value) {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

test('assessment bank covers exactly 64 curriculum rooms with independent, substantive questions', () => {
  const covered = [];
  const questionIds = new Set();
  const prompts = new Set();
  const correctDistribution = [0, 0, 0, 0];
  for (const floor of FLOORS) {
    const questions = getFloorAssessment(floor.number);
    assert.equal(questions.length, 4);
    assert.deepEqual(questions.map(question => question.roomId), floor.rooms.map(room => room.id));
    for (const question of questions) {
      assert.deepEqual(Object.keys(question).sort(),
        ['id', 'roomId', 'prompt', 'options', 'correctIndex', 'explanation'].sort());
      assert.equal(typeof question.id, 'string');
      assert.ok(question.id.length > 0);
      assert.ok(!questionIds.has(question.id));
      questionIds.add(question.id);
      assert.ok(!prompts.has(question.prompt));
      prompts.add(question.prompt);
      covered.push(question.roomId);
      assert.match(question.prompt, /[\u4e00-\u9fff]/);
      assert.ok(question.prompt.length >= 25, `short prompt: ${question.roomId}`);
      assert.notEqual(question.prompt, floor.rooms.find(room => room.id === question.roomId).question);
      assert.ok(question.explanation.length >= 35, `short explanation: ${question.roomId}`);
      assert.equal(question.options.length, 4);
      assert.equal(new Set(question.options).size, 4);
      assert.ok(question.options.every(option => typeof option === 'string' && option.trim().length >= 8));
      assert.ok(Number.isInteger(question.correctIndex));
      assert.ok(question.correctIndex >= 0 && question.correctIndex <= 3);
      correctDistribution[question.correctIndex] += 1;
    }
  }
  assert.deepEqual(covered, ids);
  assert.equal(questionIds.size, 64);
  assert.deepEqual(correctDistribution, [16, 16, 16, 16]);
  const altered = getFloorAssessment(1);
  altered[0].prompt = 'changed';
  altered[0].options[0] = 'changed';
  altered[0].correctIndex = -1;
  altered.splice(1);
  assert.equal(getFloorAssessment(1).length, 4);
  assert.notEqual(getFloorAssessment(1)[0].options[0], 'changed');
  assert.ok(gradeAssessment(1, correctAnswers(1)).passed);
});

test('every floor grades all correct, all wrong, 75 pass and 50 fail with per-room results', () => {
  for (const floor of FLOORS) {
    const answers = correctAnswers(floor.number);
    const questions = getFloorAssessment(floor.number);
    const perfect = gradeAssessment(floor.number, deepFreeze([...answers]));
    assert.deepEqual(perfect, {
      floor: floor.number,
      score: 100,
      passed: true,
      results: questions.map(question => ({
        roomId: question.roomId,
        correct: true,
        selectedIndex: question.correctIndex,
        correctIndex: question.correctIndex,
        explanation: question.explanation,
      })),
    });
    const wrong = gradeAssessment(floor.number, wrongAnswers(floor.number));
    assert.equal(wrong.score, 0);
    assert.equal(wrong.passed, false);
    assert.ok(wrong.results.every(result => !result.correct));
    const three = [...answers];
    three[0] = (three[0] + 1) % 4;
    assert.equal(gradeAssessment(floor.number, three).score, 75);
    assert.equal(gradeAssessment(floor.number, three).passed, true);
    three[1] = (three[1] + 1) % 4;
    assert.equal(gradeAssessment(floor.number, three).score, 50);
    assert.equal(gradeAssessment(floor.number, three).passed, false);
  }
});

test('assessment inputs reject invalid floors and non-dense, non-integer or out-of-range answers', () => {
  for (const floor of [0, 17, -1, 1.5, '1', null, undefined, NaN, Infinity, {}, 1n]) {
    assert.throws(() => getFloorAssessment(floor), /floor/);
    assert.throws(() => gradeAssessment(floor, [0, 0, 0, 0]), /floor/);
  }
  const accessor = [0, 0, 0, 0];
  Object.defineProperty(accessor, '2', { get() { throw new Error('getter executed'); } });
  const extra = Object.assign([0, 0, 0, 0], { extra: true });
  const inherited = [0, 0, 0, 0];
  Object.setPrototypeOf(inherited, { 0: 0 });
  for (const answers of [
    undefined, null, {}, '0000', new Uint8Array(4), [], [0, 0, 0], [0, 0, 0, 0, 0],
    new Array(4), [0, , 0, 0], [0, 0, 0, -1], [0, 0, 0, 4],
    [0, 0, 0, 0.5], [0, 0, 0, '0'], [0, 0, 0, null], [0, 0, 0, true],
    [0, 0, 0, NaN], [0, 0, 0, Infinity], [0, 0, 0, 0n], accessor, extra, inherited,
  ]) {
    assert.throws(() => gradeAssessment(1, answers), /answers/);
  }
  // 0 and 3 are both valid selected indexes, not truthiness or off-by-one errors.
  assert.equal(gradeAssessment(1, [0, 3, 0, 3]).results[0].selectedIndex, 0);
  assert.equal(gradeAssessment(1, [0, 3, 0, 3]).results[1].selectedIndex, 3);
});

test('blank profile has no fabricated knowledge, visits or identity; returned profiles are independent', () => {
  assert.match(STORAGE_KEY, /v1/);
  assert.deepEqual(createProfile(), {
    version: 1, rooms: {}, attempts: [], position: { floor: 1, roomId: null }, updatedAt: null,
  });
  const mastery = getMastery(createProfile());
  assert.deepEqual(Object.keys(mastery), ids);
  assert.ok(Object.values(mastery).every(value => value === null));
  assert.deepEqual(summarizeProfile(createProfile()), {
    visited: 0, rated: 0, assessed: 0, weak: 0, strong: 0, known: 0,
    average: null, passedFloors: [], recent: [],
  });
  assert.deepEqual(describeRoom(createProfile(), '1-1'), {
    score: null, source: 'unknown', label: '未评估', color: '#65778d',
    visitedAt: null, selfRating: null, examScore: null,
  });
  const one = createProfile();
  one.position.floor = 16;
  one.rooms['1-1'] = { selfRating: 0, examScore: null, visitedAt: null };
  assert.deepEqual(createProfile().rooms, {});
  assert.equal(createProfile().position.floor, 1);
});

test('visiting records no score and does not change navigation or ratings', () => {
  const blank = deepFreeze(createProfile());
  const next = visit(blank, '16-4');
  assert.deepEqual(next.rooms['16-4'], { selfRating: null, examScore: null, visitedAt: AT });
  assert.deepEqual(next.position, blank.position);
  assert.equal(next.updatedAt, AT);
  assert.equal(describeRoom(next, '16-4').source, 'unknown');
  assert.equal(getMastery(next)['16-4'], null);
  assert.equal(summarizeProfile(next).known, 0);
  assert.equal(summarizeProfile(next).visited, 1);
  const rated = rate(next, '16-4', 0);
  const revisited = visit(rated, '16-4', LATER);
  assert.equal(revisited.rooms['16-4'].selfRating, 0);
  assert.equal(revisited.rooms['16-4'].visitedAt, LATER);
  assert.equal(next.rooms['16-4'].visitedAt, AT);
  assert.deepEqual(blank.rooms, {});
});

test('position is independent of assessment; floor 16 is freely accessible without passing floor 1', () => {
  const original = deepFreeze(createProfile());
  const moved = act(original, { type: 'position', floor: 16, roomId: '16-4' });
  assert.deepEqual(moved.position, { floor: 16, roomId: '16-4' });
  assert.deepEqual(moved.rooms, {});
  assert.deepEqual(moved.attempts, []);
  const floorOnly = act(moved, { type: 'position', floor: 1, roomId: null });
  assert.deepEqual(floorOnly.position, { floor: 1, roomId: null });
  assert.equal(summarizeProfile(floorOnly).known, 0);
});

test('self ratings are independent between floor 1 and 16, zero differs from unknown, null clears', () => {
  const original = deepFreeze(createProfile());
  const rated = rate(rate(original, '1-1', 0), '16-1', 95.5);
  assert.equal(getMastery(rated)['1-1'], 0);
  assert.equal(getMastery(rated)['16-1'], 95.5);
  assert.equal(getMastery(rated)['1-2'], null);
  assert.equal(describeRoom(rated, '1-1').source, 'self');
  assert.equal(describeRoom(rated, '1-1').label, '薄弱');
  assert.equal(rated.rooms['16-1'].visitedAt, null);
  assert.equal(summarizeProfile(rated).average, 47.75);
  const cleared = rate(rated, '1-1', null);
  assert.equal(describeRoom(cleared, '1-1').source, 'unknown');
  assert.equal(summarizeProfile(cleared).known, 1);
  assert.equal(summarizeProfile(cleared).rated, 1);
  assert.equal(getMastery(rated)['1-1'], 0);
});

test('describeRoom uses exact score buckets and colors, including boundary values', () => {
  for (const [value, label, color] of [
    [null, '未评估', '#65778d'], [0, '薄弱', '#e77b78'], [39.99, '薄弱', '#e77b78'],
    [40, '巩固中', '#e8b96a'], [69.99, '巩固中', '#e8b96a'],
    [70, '熟悉', '#59cdb7'], [84.99, '熟悉', '#59cdb7'],
    [85, '熟练', '#7baff5'], [100, '熟练', '#7baff5'],
  ]) {
    const description = describeRoom(rate(createProfile(), '1-1', value), '1-1');
    assert.equal(description.score, value);
    assert.equal(description.label, label);
    assert.equal(description.color, color);
    assert.equal(description.source, value === null ? 'unknown' : 'self');
  }
});

test('exam updates four rooms independently, preserves self ratings and visits, and records answers', () => {
  const answers = correctAnswers(1);
  answers[0] = (answers[0] + 1) % 4;
  const original = deepFreeze(visit(rate(rate(createProfile(), '1-1', 95), '1-2', 20), '1-1'));
  const action = deepFreeze({ type: 'exam', floor: 1, answers, at: LATER });
  const next = updateProfile(original, action);
  assert.deepEqual(next.rooms['1-1'], { selfRating: 95, examScore: 0, visitedAt: AT });
  assert.deepEqual(next.rooms['1-2'], { selfRating: 20, examScore: 100, visitedAt: null });
  assert.deepEqual(next.rooms['1-3'], { selfRating: null, examScore: 100, visitedAt: null });
  assert.deepEqual(next.rooms['1-4'], { selfRating: null, examScore: 100, visitedAt: null });
  assert.deepEqual(next.attempts, [{ floor: 1, score: 75, passed: true, answers, at: LATER }]);
  assert.notEqual(next.attempts[0].answers, answers);
  assert.deepEqual(next.position, original.position);
  assert.equal(next.updatedAt, LATER);
  assert.deepEqual(describeRoom(next, '1-1'), {
    score: 0, source: 'exam', label: '薄弱', color: '#e77b78',
    selfRating: 95, examScore: 0, visitedAt: AT,
  });
  assert.equal(describeRoom(next, '1-2').source, 'exam');
  assert.equal(describeRoom(next, '1-2').score, 100);
  assert.deepEqual(summarizeProfile(next), {
    visited: 1, rated: 2, assessed: 4, weak: 1, strong: 3, known: 4,
    average: 75, passedFloors: [1], recent: [{ roomId: '1-1', visitedAt: AT }],
  });
});

test('latest exam can decrease mastery, and changing or clearing self rating does not hide exam weakness', () => {
  const perfect = exam(createProfile(), 16);
  const failed = exam(deepFreeze(perfect), 16, wrongAnswers(16), LATER);
  for (const id of ['16-1', '16-2', '16-3', '16-4']) {
    assert.equal(getMastery(perfect)[id], 100);
    assert.equal(getMastery(failed)[id], 0);
    assert.equal(describeRoom(failed, id).source, 'exam');
  }
  const highSelf = rate(failed, '16-1', 100);
  assert.equal(getMastery(highSelf)['16-1'], 0);
  const clearedSelf = rate(highSelf, '16-1', null);
  assert.equal(getMastery(clearedSelf)['16-1'], 0);
  assert.equal(describeRoom(clearedSelf, '16-1').source, 'exam');
  assert.equal(summarizeProfile(failed).weak, 4);
  assert.deepEqual(summarizeProfile(failed).passedFloors, []);
  assert.equal(failed.attempts[0].score, 100);
  assert.equal(failed.attempts[1].score, 0);
});

test('passedFloors uses last appended attempt per floor, not best score or client clock; sorted numerically', () => {
  let profile = exam(createProfile(), 16);
  profile = exam(profile, 2);
  profile = exam(profile, 10);
  profile = exam(profile, 16, wrongAnswers(16), '2020-01-01T00:00:00Z');
  assert.deepEqual(summarizeProfile(profile).passedFloors, [2, 10]);
  const seventyFive = correctAnswers(16);
  seventyFive[3] = (seventyFive[3] + 1) % 4;
  profile = exam(profile, 16, seventyFive);
  assert.deepEqual(summarizeProfile(profile).passedFloors, [2, 10, 16]);
});

test('summary counts effective mastery without double counting; recent visits sorted by instant and capped at five', () => {
  let profile = rate(rate(rate(rate(createProfile(), '1-1', 0), '1-2', 40), '1-3', 70), '1-4', 85);
  profile = exam(profile, 16);
  const visited = ['1-1', '1-2', '1-3', '1-4', '16-1', '16-2', '16-3'];
  visited.forEach((id, index) => {
    profile = visit(profile, id, `2026-10-${String(index + 10).padStart(2, '0')}T12:00:00.000Z`);
  });
  const summary = summarizeProfile(profile);
  assert.equal(summary.visited, 7);
  assert.equal(summary.rated, 4);
  assert.equal(summary.assessed, 4);
  assert.equal(summary.known, 8);
  assert.equal(summary.weak, 1);
  assert.equal(summary.strong, 5);
  assert.equal(summary.average, (0 + 40 + 70 + 85 + 400) / 8);
  assert.deepEqual(summary.recent.map(item => item.roomId), visited.slice(2).reverse());
  summary.recent[0].visitedAt = 'changed';
  summary.passedFloors.push(99);
  assert.notEqual(profile.rooms['16-3'].visitedAt, 'changed');
  assert.deepEqual(summarizeProfile(profile).passedFloors, [16]);
  let offsets = visit(createProfile(), '1-1', '2026-10-15T20:00:00+08:00');
  offsets = visit(offsets, '1-2', '2026-10-15T13:00:00Z');
  assert.deepEqual(summarizeProfile(offsets).recent.map(item => item.roomId), ['1-2', '1-1']);
});

test('updates are immutable down to room records, position, history arrays and action answers', () => {
  const original = exam(visit(createProfile(), '1-1'), 1);
  const snapshot = structuredClone(original);
  const next = act(deepFreeze(original), { type: 'position', floor: 16, roomId: null });
  assert.deepEqual(original, snapshot);
  assert.notEqual(next.rooms, original.rooms);
  assert.notEqual(next.rooms['1-1'], original.rooms['1-1']);
  assert.notEqual(next.position, original.position);
  assert.notEqual(next.attempts, original.attempts);
  assert.notEqual(next.attempts[0], original.attempts[0]);
  assert.notEqual(next.attempts[0].answers, original.attempts[0].answers);
  next.rooms['1-1'].selfRating = 12;
  next.attempts[0].answers[0] = 99;
  next.position.floor = 3;
  assert.deepEqual(original, snapshot);
  const answers = correctAnswers(2);
  const recorded = exam(createProfile(), 2, answers);
  answers[0] = 99;
  assert.notEqual(recorded.attempts[0].answers[0], 99);
});

test('exam history keeps the latest 100 attempts and their independent answer snapshots', () => {
  let profile = exam(createProfile(), 1);
  const snapshot = structuredClone(profile);
  for (let index = 0; index < 101; index += 1) {
    profile = exam(profile, 16, index % 2 ? wrongAnswers(16) : correctAnswers(16));
  }
  assert.equal(profile.attempts.length, 100);
  assert.ok(profile.attempts.every(attempt => attempt.floor === 16));
  assert.equal(profile.attempts[0].score, 0);
  assert.equal(profile.attempts.at(-1).score, 100);
  assert.deepEqual(summarizeProfile(profile).passedFloors, [16]);
  assert.deepEqual(snapshot.attempts[0].answers, correctAnswers(1));
  const store = storage();
  saveProfile(store, deepFreeze(profile));
  assert.deepEqual(loadProfile(store), profile);
});

test('injected persistence round-trips exact schema and values, missing key creates blank, no implicit writes', () => {
  const store = storage();
  const blank = loadProfile(store);
  assert.deepEqual(blank, createProfile());
  assert.deepEqual(store.calls, [['get', STORAGE_KEY]]);
  const profile = visit(exam(rate(blank, '1-1', 0), 16), '16-1');
  saveProfile(store, deepFreeze(profile));
  assert.deepEqual(store.calls[1], ['set', STORAGE_KEY, JSON.stringify(profile)]);
  const loaded = loadProfile(store);
  assert.deepEqual(loaded, profile);
  assert.notEqual(loaded, profile);
  loaded.rooms['1-1'].selfRating = 33;
  assert.equal(profile.rooms['1-1'].selfRating, 0);
  assert.equal(loadProfile(store).rooms['1-1'].selfRating, 0);
});

test('corrupted JSON, unsupported versions and wrong storage return types throw instead of resetting', () => {
  for (const text of ['', '{broken', '[', 'undefined']) {
    assert.throws(() => loadProfile(storage(text)), /Corrupted.*JSON/);
  }
  for (const value of [null, [], {}, 0, 'text', true,
    { ...createProfile(), version: 2 }, { ...createProfile(), version: '1' }]) {
    assert.throws(() => loadProfile(storage(JSON.stringify(value))), /profile/);
  }
  for (const value of [undefined, false, 123, {}]) {
    assert.throws(() => loadProfile({ getItem: () => value }), /JSON string/);
  }
  assert.throws(() => loadProfile(null), /getItem/);
  assert.throws(() => saveProfile({}, createProfile()), /setItem/);
});

test('blocked reads and quota/blocked writes are explicit errors retaining the original cause', () => {
  const readError = new Error('SecurityError');
  const writeError = new Error('QuotaExceededError');
  assert.throws(() => loadProfile({ getItem() { throw readError; } }),
    error => /read.*storage/.test(error.message) && error.cause === readError);
  assert.throws(() => saveProfile({ setItem() { throw writeError; } }, createProfile()),
    error => /write.*storage.*quota/.test(error.message) && error.cause === writeError);
});

test('full profile validation rejects malformed or malicious structures in every public consumer', () => {
  const malformed = [];
  function bad(change) {
    const profile = structuredClone(exam(visit(rate(createProfile(), '1-1', 50), '1-1'), 1));
    change(profile);
    malformed.push(profile);
  }
  bad(profile => { delete profile.version; });
  bad(profile => { profile.version = 2; });
  bad(profile => { profile.extra = 'unexpected'; });
  bad(profile => { profile.rooms = []; });
  bad(profile => { profile.rooms = new Map(); });
  bad(profile => { profile.rooms['17-1'] = profile.rooms['1-1']; });
  bad(profile => { profile.rooms['01-1'] = profile.rooms['1-1']; });
  bad(profile => { profile.rooms['1-5'] = profile.rooms['1-1']; });
  bad(profile => { profile.rooms['1-1'] = null; });
  bad(profile => { delete profile.rooms['1-1'].selfRating; });
  bad(profile => { profile.rooms['1-1'].extra = 1; });
  for (const value of ['50', undefined, NaN, Infinity, -Infinity, -1, 101, {}, false]) {
    bad(profile => { profile.rooms['1-1'].selfRating = value; });
  }
  for (const value of [50, '100', false, undefined, NaN]) {
    bad(profile => { profile.rooms['1-1'].examScore = value; });
  }
  for (const value of ['', 'today', '2026-02-30T00:00:00Z', 0, undefined]) {
    bad(profile => { profile.rooms['1-1'].visitedAt = value; });
  }
  bad(profile => { profile.position = null; });
  bad(profile => { profile.position.floor = 0; });
  bad(profile => { profile.position.floor = '1'; });
  bad(profile => { profile.position.roomId = '16-1'; });
  bad(profile => { delete profile.position.roomId; });
  bad(profile => { profile.position.extra = true; });
  bad(profile => { profile.updatedAt = '2026-10-15'; });
  bad(profile => { profile.attempts = {}; });
  bad(profile => { profile.attempts = new Array(1); });
  bad(profile => { profile.attempts.push(null); });
  bad(profile => { profile.attempts = Array.from({ length: 101 }, () => profile.attempts[0]); });
  bad(profile => { profile.attempts[0].floor = 17; });
  bad(profile => { profile.attempts[0].score = 75; });
  bad(profile => { profile.attempts[0].score = '100'; });
  bad(profile => { profile.attempts[0].passed = false; });
  bad(profile => { profile.attempts[0].passed = 1; });
  bad(profile => { profile.attempts[0].at = null; });
  bad(profile => { profile.attempts[0].answers = [0, 0, 0]; });
  bad(profile => { profile.attempts[0].answers[0] = 4; });
  bad(profile => { profile.attempts[0].extra = 'bad'; });
  bad(profile => { Object.setPrototypeOf(profile.rooms, { injected: true }); });
  bad(profile => { profile.rooms[Symbol('bad')] = {}; });
  malformed.push(JSON.parse('{"version":1,"rooms":{"__proto__":{}},"attempts":[],"position":{"floor":1,"roomId":null},"updatedAt":null}'));
  malformed.push(JSON.parse('{"version":1,"rooms":{},"attempts":[],"position":{"floor":1,"roomId":null},"updatedAt":null,"__proto__":{}}'));
  bad(profile => {
    Object.defineProperty(profile.rooms['1-1'], 'selfRating', {
      get() { throw new Error('getter must not execute'); }, enumerable: true,
    });
  });
  for (const profile of malformed) {
    const store = storage();
    for (const consume of [
      () => updateProfile(profile, { type: 'visit', roomId: '1-2', at: AT }),
      () => getMastery(profile),
      () => describeRoom(profile, '1-1'),
      () => summarizeProfile(profile),
      () => saveProfile(store, profile),
    ]) {
      assert.throws(consume, error => error instanceof Error && !/getter must/.test(error.message));
    }
    assert.equal(store.calls.length, 0, 'invalid data must never reach setItem');
  }
  for (const modify of [
    profile => { profile.version = 99; },
    profile => { profile.rooms.constructor = {}; },
    profile => { profile.rooms['1-1'] = { selfRating: 200, examScore: null, visitedAt: null }; },
    profile => { profile.position = { floor: 16, roomId: '1-1' }; },
  ]) {
    const profile = createProfile();
    modify(profile);
    const store = storage(JSON.stringify(profile));
    assert.throws(() => loadProfile(store));
    assert.equal(store.calls.filter(call => call[0] === 'set').length, 0);
  }
  assert.equal({}.injected, undefined);
});

test('invalid actions and room lookups reject before mutation; timestamps must be real full ISO instants', () => {
  const profile = deepFreeze(exam(visit(createProfile(), '1-1'), 1));
  const snapshot = structuredClone(profile);
  const actions = [
    null, {}, [], { type: 'unknown', at: AT }, { type: '__proto__', at: AT },
    { type: { toString() { throw new Error('must not coerce'); } }, at: AT },
    { type: 'visit', roomId: '1-1' },
    { type: 'visit', roomId: '1-1', at: AT, score: 50 },
    { type: 'position', floor: 1, roomId: '16-1', at: AT },
    { type: 'position', floor: 1, at: AT },
    { type: 'position', floor: 1.1, roomId: null, at: AT },
    { type: 'position', floor: '1', roomId: null, at: AT },
    { type: 'position', floor: 17, roomId: null, at: AT },
    { type: 'rate', roomId: '1-1', at: AT },
    { type: 'exam', floor: 1, answers: [0, 0, 0], at: AT },
    { type: 'exam', floor: 1, answers: [0, 0, 0, 4], at: AT },
    { type: 'exam', floor: 0, answers: [0, 0, 0, 0], at: AT },
  ];
  for (const id of ['0-1', '17-1', '1-0', '1-5', '01-1', '1-1 ', '__proto__', 'constructor', null, 1, {}]) {
    actions.push({ type: 'visit', roomId: id, at: AT });
    actions.push({ type: 'rate', roomId: id, score: 50, at: AT });
    assert.throws(() => describeRoom(profile, id), /roomId/);
  }
  for (const value of [-0.01, 100.01, NaN, Infinity, '50', true, undefined]) {
    actions.push({ type: 'rate', roomId: '1-1', score: value, at: AT });
  }
  for (const at of [null, '', 'today', '2026-10-15', '2026-10-15T12:00:00',
    '2026-02-29T00:00:00Z', '2026-02-30T00:00:00Z', '2026-13-01T00:00:00Z',
    '2026-10-15T24:00:00Z', '2026-10-15T12:60:00Z', '2026-10-15T12:00:60Z',
    '2026-10-15T12:00:00+24:00', 0, new Date(AT)]) {
    for (const action of [
      { type: 'visit', roomId: '1-1' },
      { type: 'rate', roomId: '1-1', score: 50 },
      { type: 'position', floor: 1, roomId: null },
      { type: 'exam', floor: 1, answers: correctAnswers(1) },
    ]) actions.push({ ...action, at });
  }
  for (const action of actions) {
    assert.throws(() => updateProfile(profile, action),
      error => error instanceof Error && !/must not coerce/.test(error.message));
    assert.deepEqual(profile, snapshot);
  }
  for (const at of ['2024-02-29T12:00:00Z', '2000-02-29T12:00:00.123Z', AT,
    '2026-10-15T20:00:00+08:00']) {
    assert.equal(visit(createProfile(), '1-1', at).rooms['1-1'].visitedAt, at);
  }
  assert.throws(() => updateProfile({ ...createProfile(), version: 7 }, null), /profile.version/,
    'full profile must be validated before even reading action');
});

test('parent UI contract: independent 0/100 ratings, floor 4 three-right quiz, recent shape and isolated demo', () => {
  let own = rate(rate(createProfile(), '1-1', 0), '16-1', 100);
  assert.equal(describeRoom(own, '1-1').selfRating, 0);
  assert.equal(describeRoom(own, '1-1').examScore, null);
  assert.equal(describeRoom(own, '1-1').score, 0);
  assert.equal(describeRoom(own, '16-1').selfRating, 100);
  assert.equal(describeRoom(own, '16-1').score, 100);
  assert.equal(describeRoom(own, '1-2').score, null);
  assert.notEqual(describeRoom(own, '1-1').label, describeRoom(own, '1-2').label);
  const questions = getFloorAssessment(4);
  assert.equal(questions.length, 4);
  assert.ok(questions.every(question => question.options.length === 4));
  const answers = questions.map(question => question.correctIndex);
  answers[3] = (answers[3] + 1) % 4;
  assert.equal(gradeAssessment(4, answers).score, 75);
  own = exam(own, 4, answers);
  assert.equal(own.attempts.at(-1).score, 75);
  assert.equal(own.attempts.at(-1).passed, true);
  assert.deepEqual(questions.map(question => describeRoom(own, question.roomId).examScore),
    [100, 100, 100, 0]);
  own = visit(own, '16-1');
  assert.deepEqual(summarizeProfile(own).recent, [{ roomId: '16-1', visitedAt: AT }]);
  const store = storage();
  saveProfile(store, own);
  const callsBeforeDemo = structuredClone(store.calls);
  let demo = createDemoProfile();
  assert.deepEqual(demo.position, { floor: 16, roomId: '16-1' });
  assert.equal(describeRoom(demo, demo.position.roomId).score, 100);
  assert.equal(describeRoom(demo, '1-1').score, 0);
  demo = rate(demo, '1-1', 100);
  demo = exam(demo, 16, wrongAnswers(16));
  assert.equal(describeRoom(demo, '16-1').score, 0);
  assert.deepEqual(store.calls, callsBeforeDemo);
  assert.deepEqual(loadProfile(store), own);
  assert.equal(describeRoom(own, '16-1').score, 100);
});

test('demo is deterministic, uneven and explicit; no ambient localStorage access or persistence', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() { throw new Error('ambient localStorage must never be read'); },
  });
  try {
    const store = storage();
    const own = loadProfile(store);
    const before = structuredClone(own);
    const first = createDemoProfile();
    const second = createDemoProfile();
    assert.deepEqual(first, second);
    assert.deepEqual(first.position, { floor: 16, roomId: '16-1' });
    assert.notEqual(first, second);
    assert.deepEqual(own, before);
    assert.deepEqual(store.calls, [['get', STORAGE_KEY]]);
    assert.equal(getMastery(first)['1-1'], 0);
    assert.equal(getMastery(first)['14-1'], 100);
    assert.equal(getMastery(first)['16-1'], 100);
    assert.equal(getMastery(first)['4-1'], null);
    assert.ok(summarizeProfile(first).weak > 0);
    assert.ok(summarizeProfile(first).strong > 0);
    assert.deepEqual(summarizeProfile(first).passedFloors, [14, 15, 16]);
    assert.deepEqual(Object.keys(first).sort(), Object.keys(createProfile()).sort());
    first.rooms['1-1'].selfRating = 100;
    assert.equal(second.rooms['1-1'].selfRating, 25);
    saveProfile(store, own);
    assert.deepEqual(loadProfile(store), before);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else delete globalThis.localStorage;
  }
});
