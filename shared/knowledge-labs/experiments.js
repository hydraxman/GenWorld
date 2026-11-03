export const LABS = Object.freeze({
  graph: {title: '最短路沙盘', roomId: '4-4', concept: 'BFS / Dijkstra',
    summary: '道路少，不一定代价小。调整边权，观察队列、松弛和最终路径。'},
  list: {title: '链表操作台', roomId: '3-1', concept: '节点 / next / head',
    summary: '节点不必挨在一起；连接关系由 next 决定。插入、删除，再逐步反转指针。'},
  markov: {title: '荷塘里的马尔可夫链', roomId: '15-1', concept: '状态 / 转移概率',
    summary: '青蛙下一跳只依赖当前荷叶。概率决定可能性，不保证每次的结果。'},
});
export const ROOM_LABS = Object.freeze(Object.fromEntries(Object.entries(LABS).map(([id, lab]) => [lab.roomId, id])));
export const GRAPH_NODES = Object.freeze(['A', 'B', 'C', 'D', 'E', 'F']);
export const GRAPH_EDGES = Object.freeze([
  ['A', 'B', 1], ['B', 'F', 9], ['A', 'C', 2], ['C', 'D', 2],
  ['D', 'E', 2], ['E', 'F', 2], ['B', 'D', 2], ['C', 'E', 6],
].map(Object.freeze));
export const DEFAULT_TRANSITIONS = Object.freeze([
  [0, .1, .3, .6], [.4, 0, .4, .2], [.2, .5, 0, .3], [.6, .1, .3, 0],
].map(Object.freeze));

export function createGraph({algorithm = 'bfs', weights = GRAPH_EDGES.map(edge => edge[2])} = {}) {
  if (!['bfs', 'dijkstra'].includes(algorithm)) throw new TypeError('请选择 BFS 或 Dijkstra。');
  if (!Array.isArray(weights) || weights.length !== GRAPH_EDGES.length ||
      weights.some(value => !Number.isFinite(value) || value < 1 || value > 9)) {
    throw new RangeError('本沙盘的边权必须为 1–9 的有限数。');
  }
  return {kind: 'graph', algorithm, weights: [...weights], frontier: ['A'], visited: [], current: null,
    distances: Object.fromEntries(GRAPH_NODES.map(id => [id, id === 'A' ? 0 : Infinity])),
    previous: {}, path: [], done: false, steps: 0};
}

export function stepGraph(state) {
  if (state.done) return state;
  const next = structuredClone(state);
  if (next.algorithm === 'dijkstra') next.frontier.sort((a, b) => next.distances[a] - next.distances[b] || a.localeCompare(b));
  const current = next.frontier.shift();
  if (!current) {next.done = true; return next;}
  next.current = current; next.visited.push(current); next.steps++;
  if (current === 'F') {
    next.done = true;
    for (let id = current; id; id = next.previous[id]) next.path.unshift(id);
    return next;
  }
  GRAPH_EDGES.forEach(([a, b], index) => {
    const neighbor = a === current ? b : b === current ? a : null;
    if (!neighbor || next.visited.includes(neighbor)) return;
    const distance = next.distances[current] + next.weights[index];
    const discovered = Number.isFinite(next.distances[neighbor]);
    if ((!discovered && next.algorithm === 'bfs') || (next.algorithm === 'dijkstra' && distance < next.distances[neighbor])) {
      next.distances[neighbor] = distance; next.previous[neighbor] = current;
      if (!next.frontier.includes(neighbor)) next.frontier.push(neighbor);
    }
  });
  if (next.algorithm === 'dijkstra') next.frontier.sort((a, b) => next.distances[a] - next.distances[b] || a.localeCompare(b));
  return next;
}

export function solveGraph(options) {
  let state = createGraph(options);
  while (!state.done) state = stepGraph(state);
  return state;
}

export function createList() {
  return {kind: 'list', nodes: [{id: 'n1', value: 7, next: 'n2'}, {id: 'n2', value: 13, next: 'n3'},
    {id: 'n3', value: 21, next: null}], head: 'n1', cursor: 'n1', previous: null, visited: [],
    mode: 'traverse', done: false, serial: 4, steps: 0, message: 'head 指向 7。单步沿 next 访问，不按画面位置查找。'};
}

export function listOrder(state, head = state.head) {
  const ids = [], seen = new Set();
  for (let id = head; id !== null;) {
    if (seen.has(id)) throw new Error('链表出现环，无法作为线性链表遍历。');
    const node = state.nodes.find(entry => entry.id === id);
    if (!node) throw new Error('next 指向不存在的节点。');
    seen.add(id); ids.push(id); id = node.next;
  }
  return ids;
}

export function editList(state, action, selected) {
  if (state.mode === 'reverse' && !state.done) throw new Error('请先完成本轮反转，再修改节点。');
  if (!['insert', 'delete'].includes(action)) throw new Error('未知链表操作。');
  const next = structuredClone(state), node = next.nodes.find(entry => entry.id === selected);
  if (!node) throw new Error('请先选择一个存在的节点。');
  if (action === 'insert') {
    if (next.nodes.length >= 6) throw new Error('首版展台最多展示六个节点；可先删除节点或重置。');
    const added = {id: `n${next.serial}`, value: next.serial * 8 + 2, next: node.next};
    next.serial++; node.next = added.id; next.nodes.push(added);
    next.message = `先保存原 next，再令新节点接向后继，最后让 ${node.value}.next 指向 ${added.value}。`;
  } else {
    if (next.nodes.length === 1) throw new Error('首版展台保留至少一个节点；可重置初始链表。');
    for (const entry of next.nodes) if (entry.next === node.id) entry.next = node.next;
    if (next.head === node.id) next.head = node.next;
    next.nodes = next.nodes.filter(entry => entry.id !== node.id);
    next.message = `已跳过节点 ${node.value}：更新前驱 next；若删除头节点，则更新 head。`;
  }
  next.mode = 'traverse'; next.cursor = next.head; next.previous = null; next.visited = []; next.done = false; next.steps = 0;
  return next;
}

export function stepList(state, mode = 'traverse') {
  if (!['traverse', 'reverse'].includes(mode)) throw new Error('未知链表模式。');
  if (state.mode === 'reverse' && !state.done && mode !== 'reverse') throw new Error('反转尚未完成，请继续单步或重置。');
  const next = structuredClone(state);
  if (next.mode !== mode || next.done) {
    next.mode = mode; next.cursor = next.head; next.previous = null; next.visited = []; next.done = false; next.steps = 0;
  }
  const current = next.nodes.find(node => node.id === next.cursor);
  if (!current) throw new Error('当前链表游标无效。');
  const following = current.next;
  next.visited.push(current.id); next.steps++;
  if (mode === 'reverse') {
    current.next = next.previous;
    next.message = `保存 next → ${following ?? 'null'}；${current.value}.next → ${next.previous ?? 'null'}；再推进 prev 和 current。`;
    next.previous = current.id;
  } else next.message = `访问 ${current.value}，下一节点为 ${following ?? 'null'}。读取第 k 个节点需沿指针前进。`;
  next.cursor = following;
  if (following === null) {
    next.done = true;
    if (mode === 'reverse') {next.head = next.previous; next.message = '反转完成：head = prev。节点值没变，next 方向全部改变。';}
    else next.message += ' 已到链尾。';
  }
  return next;
}

export function validateTransitions(matrix) {
  if (!Array.isArray(matrix) || matrix.length !== 4 || matrix.some(row => !Array.isArray(row) || row.length !== 4 ||
      row.some(p => !Number.isFinite(p) || p < 0 || p > 1) || Math.abs(row.reduce((a, b) => a + b, 0) - 1) > 1e-9)) {
    throw new RangeError('每行必须有四个 0–1 的概率，且总和为 1；不会自动归一化。');
  }
}

export function createMarkov({matrix = DEFAULT_TRANSITIONS, seed = 2026} = {}) {
  validateTransitions(matrix);
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new RangeError('随机种子必须是无符号 32 位整数。');
  return {kind: 'markov', matrix: matrix.map(row => [...row]), seed, randomState: seed, current: 0, previous: 0,
    steps: 0, counts: [0, 0, 0, 0], departures: [0, 0, 0, 0], transitions: matrix.map(() => [0, 0, 0, 0]),
    distribution: [1, 0, 0, 0], sample: null};
}

export function sampleDestination(row, random) {
  if (!Number.isFinite(random) || random < 0 || random >= 1) throw new RangeError('抽样值必须在 [0, 1) 内。');
  if (!Array.isArray(row) || row.length !== 4 || row.some(p => !Number.isFinite(p) || p < 0 || p > 1) ||
      Math.abs(row.reduce((a, b) => a + b, 0) - 1) > 1e-9) throw new RangeError('转移行不是有效概率分布。');
  let cumulative = 0;
  for (let i = 0; i < row.length; i++) {
    cumulative += row[i];
    if (row[i] > 0 && (random < cumulative || i === row.findLastIndex(p => p > 0))) return i;
  }
  throw new Error('抽样未落在有效区间。');
}

export function stepMarkov(state, count = 1) {
  if (!Number.isInteger(count) || count < 1 || count > 100) throw new RangeError('每次运行 1–100 跳。');
  const next = structuredClone(state);
  for (let i = 0; i < count; i++) {
    next.randomState = (Math.imul(1664525, next.randomState) + 1013904223) >>> 0;
    next.sample = next.randomState / 0x100000000;
    next.previous = next.current;
    next.current = sampleDestination(next.matrix[next.previous], next.sample);
    next.departures[next.previous]++; next.transitions[next.previous][next.current]++;
    next.counts[next.current]++; next.steps++;
    next.distribution = next.matrix.map((_, column) =>
      next.distribution.reduce((sum, p, row) => sum + p * next.matrix[row][column], 0));
  }
  return next;
}

export function initialExperiment(id) {
  if (id === 'graph') return createGraph();
  if (id === 'list') return createList();
  if (id === 'markov') return createMarkov();
  throw new Error(`未知实验：${id}`);
}

export function questions(id) {
  if (id === 'graph') return [
    {text: '默认沙盘中，BFS 找到 A→B→F。它最小化什么？', options: ['总边权', '经过的边数', '访问节点的字母顺序'], correct: 1, why: 'BFS 按层扩展，保证最少边数；默认这条路权重为 10，并非最小总权重。'},
    {text: '默认沙盘中，Dijkstra 的最小总权重是多少？', options: ['7', '10', '2'], correct: 0, why: 'A→B→D→E→F 的代价是 1+2+2+2=7，比两条边的路线更便宜。'},
    {text: '把一个边权改为负数，可以直接照用标准 Dijkstra 吗？', options: ['可以，权重不影响正确性', '不可以，需要重新选择算法并分析负环', '只要节点少就可以'], correct: 1, why: '标准 Dijkstra 依赖非负权。这个初版只允许正权，不能把它的结果外推到负权图。'},
  ];
  if (id === 'list') return [
    {text: '已持有节点 X，要把 Y 插在它后面，安全顺序是什么？', options: ['X.next=Y；Y.next=X.next', 'Y.next=X.next；X.next=Y', '只修改 Y 的值'], correct: 1, why: '必须先保留原后继。反过来会丢掉旧链接，并可能让 Y 指向自己。'},
    {text: '逐步反转时，改写 current.next 之前必须保存什么？', options: ['原 next', '链表长度', '最大节点值'], correct: 0, why: '原 next 是尚未处理部分的入口；不保存就无法继续向前。'},
    {text: '单链表读取第 k 个节点，通常需要什么？', options: ['直接用下标 O(1) 定位', '从 head 沿 next 遍历，O(k)', '先对节点值排序'], correct: 1, why: '链表没有数组的连续寻址条件。已知前驱的插入可以 O(1)，寻找前驱本身仍需要遍历。'},
  ];
  if (id === 'markov') return [
    {text: '从 A 跳到 D 的概率为 0.6，是否意味着下一跳一定到 D？', options: ['一定到 D', '不一定，只是 D 最有可能', '前三跳后才生效'], correct: 1, why: '0.6 是条件概率，不是承诺。单次结果可以是 B、C 或 D。'},
    {text: '这只青蛙已经到 C，下一跳应该读取哪一行？', options: ['始终读取 A 行', '读取 C 行，与更早的路径无关', '把所有行相加'], correct: 1, why: '本模型是齐次一阶马尔可夫链：给定当前状态，下一步分布不再依赖更早历史。'},
    {text: '从 A 独立出发抽样十次，一定有六次到 D 吗？', options: ['一定，0.6×10=6', '不一定，6 是期望次数', '一定至少六次'], correct: 1, why: '有限样本会波动。另外，连续跳十次会经过不同起点，不能当成十次都从 A 出发。'},
  ];
  throw new Error(`未知题库：${id}`);
}
