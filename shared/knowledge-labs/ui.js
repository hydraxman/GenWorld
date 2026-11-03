import {LABS, GRAPH_EDGES, GRAPH_NODES, createGraph, stepGraph, createList, editList, stepList, listOrder,
  createMarkov, stepMarkov, initialExperiment, questions} from './experiments.js';

// Bundled with both hosts, including the campus single-file offline build.
const styles = `
.viewport.lab-active {position:fixed!important;inset:0!important;width:100vw!important;height:100dvh!important;z-index:100;background:#142d38}
.lab-active > :not(canvas):not(.lab-panel):not(.lab-heading) {visibility:hidden!important;pointer-events:none!important}
.lab-panel,.lab-heading {font:14px/1.6 "Segoe UI","Microsoft YaHei",sans-serif;color:#e9f0e9;box-sizing:border-box}
.lab-panel *,.lab-heading * {box-sizing:border-box}
.lab-panel[hidden],.lab-heading[hidden] {display:none!important}
.lab-panel {position:absolute;z-index:105;right:18px;top:18px;bottom:18px;width:350px;overflow:auto;padding:22px;background:#173742;border:1px solid #547373;border-radius:12px;box-shadow:0 12px 40px #071a2440;scrollbar-color:#859d98 #173742;overscroll-behavior:contain}
.lab-heading {position:absolute;z-index:105;left:24px;top:20px;max-width:calc(100% - 425px);padding:14px 18px;background:#173742;border-radius:8px;border:1px solid #547373}
.lab-heading h2 {font-size:24px;line-height:1.3;margin:0 0 6px;font-weight:600;color:#fff}
.lab-heading p {margin:0;color:#c6d9d7;font-size:13px}
.lab-panel h3 {font-size:18px;color:#fff;margin:0 0 12px}
.lab-panel p {margin:10px 0;color:#d3e4df}
.lab-panel button,.lab-panel select,.lab-panel input {font:inherit;letter-spacing:normal;min-height:42px;max-width:100%;border-radius:5px}
.lab-panel button {cursor:pointer;border:1px solid #829b96;padding:8px 12px;background:#284b52;color:#f1f5eb}
.lab-panel button:hover:not(:disabled) {background:#3c6266}
.lab-panel button.primary {background:#e5c489;color:#18323a;border-color:#e5c489;font-weight:600}
.lab-panel button:disabled {opacity:.5;cursor:default}
.lab-panel button:focus-visible,.lab-panel select:focus-visible,.lab-panel input:focus-visible,.lab-panel summary:focus-visible {outline:3px solid #e5c489;outline-offset:3px}
.lab-panel ::selection {background:#e5c489;color:#173742}
.lab-panel label {display:block;margin:12px 0 5px;color:#e2ece7}
.lab-panel input,.lab-panel select {width:100%;padding:7px 9px;background:#102b35;color:#fff;border:1px solid #829b96;caret-color:#e5c489}
.lab-panel .lab-actions {display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}
.lab-panel .lab-actions button {flex:1}
.lab-panel .lab-status {font-variant-numeric:tabular-nums;padding:14px 0;border-block:1px solid #547373;white-space:pre-line}
.lab-panel table {width:100%;border-collapse:collapse;font-size:12px;font-variant-numeric:tabular-nums;margin:12px 0;color:#e2ece7}
.lab-panel th,.lab-panel td {padding:6px 4px;text-align:left;border-bottom:1px solid #547373}
.lab-panel details {margin-top:18px;border-top:1px solid #547373;padding-top:12px}
.lab-panel summary {cursor:pointer;color:#f1d39e;min-height:34px}
.lab-panel .lab-probabilities {display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
.lab-panel .lab-probabilities label {margin:6px 0}
.lab-panel .lab-probabilities input {padding:5px;width:100%}
.lab-panel .lab-quiz fieldset {border:0;padding:0;margin:18px 0 24px;min-width:0}
.lab-panel .lab-quiz legend {padding:0;font-weight:600;color:#fff}
.lab-panel .lab-quiz label {display:flex;align-items:flex-start;gap:8px;font-size:13px;cursor:pointer;padding:4px 0}
.lab-panel .lab-quiz input {width:18px;height:18px;min-height:18px;flex:0 0 18px;accent-color:#e5c489;margin-top:3px}
.lab-panel .lab-quiz output {display:block;margin-top:10px;color:#e7cf9d}
.lab-panel .lab-error {color:#ffd6be;border:1px solid #c88061;padding:10px}
.lab-panel .lab-note {font-size:12px;color:#c1d5d0}
.lab-panel .lab-close {width:100%;margin-bottom:18px}
.lab-launches {display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}
.lab-launches button {min-height:40px}
@media(max-width:760px) {
  .lab-heading {top:10px;left:10px;right:10px;max-width:none;padding:9px 12px}
  .lab-heading h2 {font-size:18px}
  .lab-heading p {font-size:11px}
  .lab-panel {top:auto;bottom:0;left:0;right:0;width:100%;height:47%;padding:14px 18px;border-radius:12px 12px 0 0}
  .lab-panel .lab-close {margin-bottom:12px}
}
`;

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

export function createLabUI({host, onClose, onState = () => {}}) {
  const style = element('style', styles); document.head.append(style);
  const heading = element('div', undefined, 'lab-heading'), panel = element('section', undefined, 'lab-panel');
  panel.id = 'knowledge-lab-panel'; panel.setAttribute('aria-label', '交互知识展台');
  const closeButton = element('button', '收起展台 · 返回场景', 'lab-close');
  closeButton.id = 'lab-close';
  const title = element('h2'), caption = element('p');
  heading.append(title, caption);
  const controls = element('div'), status = element('p', '', 'lab-status'), data = element('div');
  status.id = 'lab-status'; status.setAttribute('aria-live', 'polite');
  const error = element('p', '', 'lab-error'); error.setAttribute('role', 'alert'); error.hidden = true;
  const quiz = element('details', undefined, 'lab-quiz');
  const note = element('p', '初版教学实验；本次操作和答题不计入掌握度。关闭展台会重置，不上传数据。', 'lab-note');
  panel.append(closeButton, element('h3', '动手试验'), controls, status, data, quiz, note, error);
  panel.hidden = heading.hidden = true; host.append(heading, panel);
  let id = null, state = null, view = null, returnFocus = null, edgeIndex = 1, selectedNode = 'n1', rowIndex = 0, priorFocus = null;
  let inertSiblings = [];
  const abort = new AbortController();
  function safely(handler) {
    return event => {
      try {handler(event); error.hidden = true;}
      catch (failure) {console.error(failure); error.textContent = failure.message; error.hidden = false;}
    };
  }
  function button(parent, text, name, handler, primary = false, disabled = false) {
    const node = element('button', text, primary ? 'primary' : '');
    node.type = 'button'; node.dataset.labAction = name; node.disabled = disabled;
    node.addEventListener('click', safely(handler)); parent.append(node); return node;
  }
  function select(parent, label, name, entries, value, handler) {
    const container = element('label', label), node = element('select');
    node.id = `lab-${name}`;
    for (const [value, text] of entries) {const option = element('option', text); option.value = value; node.append(option);}
    node.value = String(value); container.append(node); parent.append(container);
    node.addEventListener('change', safely(event => handler(event.target.value)));
    return node;
  }
  function table(parent, headings, rows, label) {
    const node = element('table'); node.setAttribute('aria-label', label);
    const head = element('tr'); headings.forEach(text => head.append(element('th', text)));
    const thead = element('thead'); thead.append(head); node.append(thead);
    const body = element('tbody');
    for (const row of rows) {const tr = element('tr'); row.forEach(value => tr.append(element('td', String(value)))); body.append(tr);}
    node.append(body); parent.append(node);
  }
  function update(next, hop = false) {
    state = next; view.sync(state, {animateHop: hop});
    paint(); onState(state);
  }
  function paint() {
    priorFocus = panel.contains(document.activeElement) ? document.activeElement.dataset.labAction || document.activeElement.id : null;
    controls.replaceChildren(); data.replaceChildren();
    if (id === 'graph') {
      select(controls, '搜索方法', 'algorithm', [['bfs', 'BFS · 最少边数'], ['dijkstra', 'Dijkstra · 最低总权重']],
        state.algorithm, algorithm => update(createGraph({algorithm, weights: state.weights})));
      const actions = element('div', undefined, 'lab-actions');
      button(actions, state.done ? '已到终点 F' : '单步扩展', 'step', () => update(stepGraph(state)), true, state.done);
      button(actions, '重跑当前图', 'reset', () => update(createGraph({algorithm: state.algorithm, weights: state.weights})));
      controls.append(actions);
      select(controls, '改变道路代价', 'edge', GRAPH_EDGES.map(([a, b], i) => [i, `${a} — ${b}`]), edgeIndex, value => {edgeIndex = Number(value); paint();});
      const label = element('label', '边权（1–9）；应用后重新开始'), weight = element('input');
      weight.type = 'number'; weight.min = '1'; weight.max = '9'; weight.step = '1'; weight.value = state.weights[edgeIndex]; weight.id = 'lab-weight';
      label.append(weight); controls.append(label);
      button(controls, '应用边权', 'weight', () => {
        if (!weight.checkValidity() || weight.value.trim() === '') throw new Error('边权请输入 1–9 的整数。');
        const weights = [...state.weights]; weights[edgeIndex] = Number(weight.value);
        update(createGraph({algorithm: state.algorithm, weights}));
      });
      status.textContent = state.done ? `路径：${state.path.join(' → ')}\n${state.path.length - 1} 条边 · 总代价 ${state.distances.F}`
        : `当前：${state.current ?? '尚未扩展'} · 已扩展 ${state.steps} 个节点\n${state.algorithm === 'bfs' ? '先进先出队列' : '按暂定距离排序'}：${state.frontier.join(' → ') || '空'}`;
      table(data, ['节点', '暂定代价', '前驱'], GRAPH_NODES.map(node =>
        [node, Number.isFinite(state.distances[node]) ? state.distances[node] : '未发现', state.previous[node] ?? '—']), '搜索状态');
      data.append(element('p', state.algorithm === 'bfs'
        ? 'BFS 首次发现就入队。这里显示累计权重供比较，但它并不按权重挑选路径。'
        : '每次取暂定距离最小的节点；更便宜的路线会更新距离与前驱，这一步叫松弛。'));
    } else if (id === 'list') {
      const reversing = state.mode === 'reverse' && !state.done;
      const actions = element('div', undefined, 'lab-actions');
      button(actions, '沿 next 单步', 'step', () => update(stepList(state)), true, reversing);
      button(actions, '反转一根指针', 'reverse', () => update(stepList(state, 'reverse')));
      controls.append(actions);
      if (!state.nodes.some(node => node.id === selectedNode)) selectedNode = state.head;
      select(controls, '操作节点', 'node', state.nodes.map(node => [node.id, `${node.value} · ${node.id}`]),
        selectedNode, value => {selectedNode = value;});
      const edits = element('div', undefined, 'lab-actions');
      button(edits, '在其后插入', 'insert', () => update(editList(state, 'insert', selectedNode)), false, reversing || state.nodes.length >= 6);
      button(edits, '删除该节点', 'delete', () => update(editList(state, 'delete', selectedNode)), false, reversing || state.nodes.length === 1);
      button(edits, '重置', 'reset', () => update(createList())); controls.append(edits);
      status.textContent = state.message;
      table(data, ['节点', '值', 'next'], state.nodes.map(node => [node.id, node.value, node.next ?? 'null']), '链表指针');
      data.append(element('p', reversing ? `正在拆开再接回：prev=${state.previous ?? 'null'}；current=${state.cursor ?? 'null'}。中途不是完整的一条链。`
        : `从 head 出发：${listOrder(state).map(id => state.nodes.find(node => node.id === id).value).join(' → ')} → null`));
    } else {
      const actions = element('div', undefined, 'lab-actions');
      button(actions, '青蛙跳一步', 'step', () => update(stepMarkov(state), true), true);
      button(actions, '快速运行 100 跳', 'hundred', () => update(stepMarkov(state, 100)));
      button(actions, '同种子重跑', 'reset', () => update(createMarkov({matrix: state.matrix, seed: state.seed})));
      controls.append(actions);
      status.textContent = `当前荷叶 ${'ABCD'[state.current]} · 已跳 ${state.steps} 步\n下一跳概率：${state.matrix[state.current].map((p, i) => `${'ABCD'[i]} ${Math.round(p * 100)}%`).join(' / ')}`
        + (state.sample === null ? '' : `\n上一跳 ${'ABCD'[state.previous]} → ${'ABCD'[state.current]}；抽样值 ${state.sample.toFixed(4)}`);
      select(controls, '编辑哪片荷叶的转移概率', 'row', [...'ABCD'].map((letter, i) => [i, `从 ${letter} 出发`]), rowIndex,
        value => {rowIndex = Number(value); paint();});
      const row = element('div', undefined, 'lab-probabilities'), inputs = [];
      for (let to = 0; to < 4; to++) {
        const label = element('label', `到 ${'ABCD'[to]}`), input = element('input');
        input.id = `lab-probability-${to}`; input.type = 'number'; input.min = '0'; input.max = '1'; input.step = '.1';
        input.value = state.matrix[rowIndex][to]; label.append(input); row.append(label); inputs.push(input);
      }
      controls.append(row);
      button(controls, '应用概率并从 A 重跑', 'probabilities', () => {
        if (inputs.some(input => input.value.trim() === '' || !input.checkValidity())) throw new Error('请填写 0–1 的概率，步长为 0.1。');
        const matrix = state.matrix.map(row => [...row]); matrix[rowIndex] = inputs.map(input => Number(input.value));
        update(createMarkov({matrix, seed: state.seed}));
      });
      data.append(element('p', '默认 A → B / C / D = 0.1 / 0.3 / 0.6。每跳读取当前位置那一行；整行之和必须为 1。'));
      const details = element('details'); details.append(element('summary', '转移矩阵与分布：不要混淆两种统计'));
      table(details, ['从 / 到', 'A', 'B', 'C', 'D'], state.matrix.map((row, i) => ['ABCD'[i], ...row.map(p => p.toFixed(1))]), '转移矩阵');
      table(details, ['荷叶', '第 n 步理论概率', '单条轨迹到达次数'],
        state.counts.map((count, i) => ['ABCD'[i], `${(state.distribution[i] * 100).toFixed(1)}%`, count]), '理论分布与轨迹统计');
      details.append(element('p', `理论分布用 q(n+1)=q(n)P 计算；到达次数是这一条随机轨迹的累计值，不是第 n 步概率。随机种子 ${state.seed}，重跑可复现。`));
      data.append(details);
    }
    if (priorFocus) {
      const target = [...controls.querySelectorAll('button,input,select')].find(node => node.dataset.labAction === priorFocus || node.id === priorFocus);
      if (target && !target.disabled) target.focus({preventScroll: true});
    }
  }
  function paintQuiz() {
    quiz.replaceChildren(element('summary', '先预测，再解释 · 三个小挑战'));
    const form = element('form');
    const entries = questions(id);
    entries.forEach((entry, index) => {
      const field = element('fieldset'), legend = element('legend', `${index + 1}. ${entry.text}`);
      field.append(legend);
      entry.options.forEach((text, option) => {
        const label = element('label'), radio = element('input');
        radio.type = 'radio'; radio.name = `lab-question-${index}`; radio.value = option; radio.required = true;
        label.append(radio, document.createTextNode(text)); field.append(label);
      });
      const feedback = element('output'); feedback.id = `lab-feedback-${index}`; field.append(feedback); form.append(field);
    });
    const submit = element('button', '核对解释', 'primary'); submit.type = 'submit'; form.append(submit);
    form.addEventListener('submit', safely(event => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const answers = new FormData(form);
      entries.forEach((entry, index) => {
        const correct = Number(answers.get(`lab-question-${index}`)) === entry.correct;
        form.querySelector(`#lab-feedback-${index}`).textContent = `${correct ? '判断正确。' : '再想一步。'}${entry.why}`;
      });
    }));
    quiz.append(form);
  }
  function close() {
    if (!id) return;
    view.expand(false); panel.hidden = heading.hidden = true; host.classList.remove('lab-active');
    for (const [node, wasInert] of inertSiblings) node.inert = wasInert;
    inertSiblings = [];
    id = null; state = null; view = null;
    onClose();
    if (returnFocus?.isConnected) returnFocus.focus({preventScroll: true});
  }
  closeButton.addEventListener('click', close);
  document.addEventListener('keydown', event => {
    if (id && event.key === 'Escape') {event.preventDefault(); event.stopImmediatePropagation(); close();}
  }, {capture: true, signal: abort.signal});
  return {get active() {return id !== null;}, close,
    open(nextId, exhibit, location) {
      if (id) close();
      if (!LABS[nextId]) throw new Error(`未知实验：${nextId}`);
      returnFocus = document.activeElement; id = nextId; view = exhibit; state = initialExperiment(id);
      edgeIndex = 1; selectedNode = 'n1'; rowIndex = 0;
      title.textContent = LABS[id].title;
      caption.textContent = `${location} · ${LABS[id].concept} · 点击操作，图解悬浮展开`;
      panel.hidden = heading.hidden = false; error.hidden = true; quiz.open = false;
      host.classList.add('lab-active');
      for (let branch = host; branch && branch !== document.body; branch = branch.parentElement) {
        for (const sibling of branch.parentElement.children) {
          if (sibling === branch || sibling.tagName === 'SCRIPT') continue;
          inertSiblings.push([sibling, sibling.inert]); sibling.inert = true;
        }
      }
      view.sync(state); view.expand(true); paint(); paintQuiz(); closeButton.focus({preventScroll: true}); onState(state);
    },
    state: () => state ? structuredClone(state) : null,
    dispose() {close(); abort.abort(); panel.remove(); heading.remove(); style.remove();}};
}
