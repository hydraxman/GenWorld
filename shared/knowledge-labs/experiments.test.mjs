import test from 'node:test';
import assert from 'node:assert/strict';
import {createGraph, stepGraph, solveGraph, GRAPH_EDGES, createList, editList, stepList, listOrder,
  createMarkov, stepMarkov, sampleDestination, validateTransitions, LABS, ROOM_LABS, questions} from './experiments.js';

test('BFS minimizes edges while Dijkstra minimizes nonnegative path cost', () => {
  const bfs = solveGraph({algorithm: 'bfs'}), dijkstra = solveGraph({algorithm: 'dijkstra'});
  assert.deepEqual(bfs.path, ['A', 'B', 'F']); assert.equal(bfs.distances.F, 10);
  assert.deepEqual(dijkstra.path, ['A', 'B', 'D', 'E', 'F']); assert.equal(dijkstra.distances.F, 7);
  const initial = createGraph(), before = structuredClone(initial);
  assert.notEqual(stepGraph(initial), initial); assert.deepEqual(initial, before);
  const weights = GRAPH_EDGES.map(edge => edge[2]); weights[1] = 1;
  assert.equal(solveGraph({algorithm: 'dijkstra', weights}).distances.F, 2);
  assert.throws(() => createGraph({weights: weights.map(() => -1)}), /边权/);
  assert.throws(() => createGraph({algorithm: 'greedy'}), /BFS/);
});

test('Dijkstra matches exhaustive simple paths across varying weights', () => {
  for (let trial = 0; trial < 40; trial++) {
    const weights = GRAPH_EDGES.map((_, index) => 1 + (trial * 7 + index * 3) % 9);
    function cheapest(at, seen = [], cost = 0) {
      if (at === 'F') return cost;
      return Math.min(...GRAPH_EDGES.map(([a, b], index) => {
        const to = a === at ? b : b === at ? a : null;
        return to && !seen.includes(to) ? cheapest(to, [...seen, at], cost + weights[index]) : Infinity;
      }));
    }
    assert.equal(solveGraph({algorithm: 'dijkstra', weights}).distances.F, cheapest('A'));
  }
});

test('linked list edits and reversal retain explicit pointer identity', () => {
  const original = createList();
  let list = editList(original, 'insert', 'n1');
  assert.deepEqual(listOrder(original), ['n1', 'n2', 'n3']);
  assert.deepEqual(listOrder(list), ['n1', 'n4', 'n2', 'n3']);
  list = editList(list, 'delete', 'n2');
  assert.deepEqual(listOrder(list), ['n1', 'n4', 'n3']);
  list = stepList(list, 'reverse');
  assert.equal(list.nodes[0].next, null);
  assert.throws(() => editList(list, 'insert', 'n1'), /反转/);
  assert.throws(() => stepList(list), /反转/);
  while (!list.done) list = stepList(list, 'reverse');
  assert.deepEqual(listOrder(list), ['n3', 'n4', 'n1']);
  list = editList(list, 'delete', 'n3');
  assert.equal(list.head, 'n4');
  while (!list.done) list = stepList(list);
  assert.deepEqual(list.visited, ['n4', 'n1']);
});

test('Markov probabilities use half-open intervals and conserve distribution', () => {
  const row = [0, .1, .3, .6];
  for (const [r, destination] of [[0, 1], [.099999, 1], [.1, 2], [.399999, 2], [.4, 3], [.99999, 3]]) {
    assert.equal(sampleDestination(row, r), destination);
  }
  const initial = createMarkov(), first = stepMarkov(initial);
  assert.deepEqual(first.distribution, row);
  assert.equal(initial.steps, 0);
  let state = initial;
  for (let i = 0; i < 100; i++) state = stepMarkov(state, 100);
  assert.equal(state.steps, 10000);
  assert.equal(state.counts.reduce((a, b) => a + b), 10000);
  assert.ok(Math.abs(state.distribution.reduce((a, b) => a + b) - 1) < 1e-10);
  for (let from = 0; from < 4; from++) for (let to = 0; to < 4; to++) {
    assert.ok(Math.abs(state.transitions[from][to] / state.departures[from] - state.matrix[from][to]) < .03);
  }
  assert.deepEqual(stepMarkov(createMarkov(), 100), stepMarkov(createMarkov(), 100));
  assert.notDeepEqual(stepMarkov(createMarkov({seed: 42}), 100).counts, stepMarkov(initial, 100).counts);
  assert.throws(() => createMarkov({matrix: [[0, .1, .3, .7], ...initial.matrix.slice(1)]}), /总和/);
  assert.throws(() => validateTransitions([[NaN]]), /概率/);
  assert.throws(() => sampleDestination(row, 1), /抽样值/);
});

test('a changed transition row is used from the current state, not always A', () => {
  const matrix = [[0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1], [1, 0, 0, 0]];
  let state = createMarkov({matrix});
  for (const destination of [1, 2, 3, 0, 1]) {
    state = stepMarkov(state); assert.equal(state.current, destination);
    assert.equal(state.distribution[destination], 1);
  }
});

test('three explicit curriculum mappings and nine explained questions', () => {
  assert.deepEqual(ROOM_LABS, {'4-4': 'graph', '3-1': 'list', '15-1': 'markov'});
  for (const id of Object.keys(LABS)) {
    const entries = questions(id); assert.equal(entries.length, 3);
    for (const entry of entries) {
      assert.ok(entry.options[entry.correct]); assert.ok(entry.why.length > 20);
    }
  }
});
