import test from 'node:test';
import assert from 'node:assert/strict';
import { FLOORS, ROUTES, getFloor, getRoom, searchCurriculum } from '../src/curriculum.js';
import { INITIAL_STATE, transition, describeSelection } from '../src/navigation.js';

test('curriculum has sixteen complete floors, sixty-four rooms and 192 explained concepts', () => {
  assert.equal(FLOORS.length, 16);
  const rooms = FLOORS.flatMap(floor => floor.rooms);
  assert.equal(rooms.length, 64);
  assert.equal(new Set(rooms.map(room => room.id)).size, 64);
  assert.equal(rooms.flatMap(room => room.topics).length, 192);
  FLOORS.forEach((floor, index) => {
    assert.equal(floor.number, index + 1);
    assert.match(floor.color, /^#[a-f0-9]{6}$/i);
    assert.equal(floor.rooms.length, 4);
    for (const room of floor.rooms) {
      assert.equal(room.floor, floor.number);
      assert.ok(room.question.length > 8);
      assert.ok(room.challenge.length > 12);
      assert.equal(room.topics.length, 3);
      room.topics.forEach(topic => assert.ok(topic.name && topic.summary.length > 15));
    }
  });
});

test('every prerequisite resolves and the room dependency graph is acyclic', () => {
  const complete = new Set();
  function visit(id, path = []) {
    assert.ok(!path.includes(id), `Prerequisite cycle: ${[...path, id].join(' -> ')}`);
    if (complete.has(id)) return;
    const room = getRoom(id);
    assert.equal(new Set(room.requires).size, room.requires.length);
    room.requires.forEach(parent => visit(parent, [...path, id]));
    complete.add(id);
  }
  FLOORS.flatMap(floor => floor.rooms).forEach(room => visit(room.id));
  assert.equal(complete.size, 64);
  assert.ok(getRoom('4-2').requires.includes('13-1'), 'Mathematics must connect back to algorithms');
  assert.ok(getRoom('16-1').requires.includes('14-4'));
});

test('search covers concepts, explanations, English headings and multiple terms', () => {
  const dynamic = searchCurriculum('动态规划');
  assert.ok(dynamic.some(result => result.roomId === '4-3'));
  const mvcc = searchCurriculum('mvcc');
  assert.equal(mvcc[0].roomId, '8-3');
  assert.equal(mvcc[0].topicIndex, 1);
  assert.equal(searchCurriculum('量词顺序')[0].roomId, '13-1');
  assert.ok(searchCurriculum('computer systems').every(result => result.floor === 6));
  assert.ok(searchCurriculum('概率 期望').some(result => result.roomId === '15-1'));
  assert.deepEqual(searchCurriculum('不存在的术语xyz'), []);
  assert.deepEqual(searchCurriculum('   '), []);
  assert.throws(() => getFloor(0), RangeError);
  assert.throws(() => getRoom('17-1'), RangeError);
});

test('navigation selects the matching floor and topic without modifying previous state', () => {
  const next = transition(INITIAL_STATE, { type: 'room', id: '8-3', topicIndex: 1 });
  assert.equal(next.floor, 8);
  assert.equal(next.mode, 'floor');
  assert.equal(next.roomId, '8-3');
  assert.equal(next.topicIndex, 1);
  assert.equal(INITIAL_STATE.floor, 1);
  const selection = describeSelection(next);
  assert.equal(selection.floor.title, '数据库与数据工程');
  assert.deepEqual(selection.prerequisites.map(room => room.id), ['8-2', '6-3']);
  const overview = transition(next, { type: 'mode', mode: 'exploded' });
  assert.equal(overview.roomId, next.roomId);
  const otherFloor = transition(overview, { type: 'floor', number: 13 });
  assert.equal(otherFloor.roomId, null);
  assert.equal(otherFloor.topicIndex, 0);
});

test('all five learning routes can be followed exactly, including non-monotonic math shortcuts', () => {
  assert.equal(ROUTES.length, 5);
  for (const route of ROUTES) {
    route.floors.forEach(getFloor);
    assert.equal(new Set(route.floors).size, route.floors.length);
    let state = transition(INITIAL_STATE, { type: 'route', id: route.id });
    assert.equal(state.floor, route.floors[0]);
    assert.throws(() => transition(state, { type: 'step', delta: -1 }), RangeError);
    for (let index = 1; index < route.floors.length; index++) {
      state = transition(state, { type: 'step', delta: 1 });
      assert.equal(state.floor, route.floors[index]);
    }
    assert.throws(() => transition(state, { type: 'step', delta: 1 }), RangeError);
    state = transition(state, { type: 'step', delta: -1 });
    assert.equal(state.floor, route.floors.at(-2));
  }
  const routeState = transition(INITIAL_STATE, { type: 'route', id: 'delivery' });
  const outside = transition(routeState, { type: 'floor', number: 16 });
  assert.equal(describeSelection(outside).routeIndex, -1);
  assert.equal(transition(outside, { type: 'step', delta: 1 }).floor, 1);
  assert.equal(transition(outside, { type: 'route', id: null }).routeId, null);
});

test('invalid navigation requests fail explicitly', () => {
  for (const action of [
    { type: 'mode', mode: 'invalid' }, { type: 'floor', number: 17 },
    { type: 'room', id: '1-1', topicIndex: 3 }, { type: 'topic', index: 0 },
    { type: 'route', id: 'unknown' }, { type: 'step', delta: 1 }, { type: 'unknown' },
  ]) assert.throws(() => transition(INITIAL_STATE, action), RangeError);
  assert.throws(() => transition(INITIAL_STATE, { type: 'query', query: null }), TypeError);
});
