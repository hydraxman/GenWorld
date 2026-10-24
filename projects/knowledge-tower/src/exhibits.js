/**
 * Curated, texture-free teaching models. Every room has a semantic identity;
 * repeated primitives encode actual edges, cells, gates or pipeline stages.
 * Sculpture coordinates fit a 3.6 x 2.8 table and rise less than 2.2 metres.
 */
const catalogue = [
  [
    ['binary-tiles', '八位信息', '亮暗位组成二进制字节；上排权重对应下排的位值。'],
    ['control-flow', '条件与回路', '菱形条件把控制分成两条路径，回边表示有终止条件的循环。'],
    ['typed-memory', '类型与生命周期', '分隔的内存槽接收不同类型的值；引用连线指向仍然存活的对象。'],
    ['paradigm-composition', '组合而非堆叠', '左侧顺序步骤、中央封装对象、右侧纯函数组合表达三种编程范式。'],
  ],
  [
    ['debug-stack', '断点观察台', '调用帧逐级展开，红色断点与右侧变量格共同定位当前执行状态。'],
    ['git-branches', '提交的汇流', '主线分出功能分支，经审查后合并；每个节点是一份提交而非服务器。'],
    ['build-dag', '可复现构建', '源文件和锁定依赖汇入编译节点，生成唯一制品，形成无环构建依赖。'],
    ['ci-pipeline', '协作验收线', 'Issue、代码审查、构建和测试依次成为可交付制品的质量关卡。'],
  ],
  [
    ['array-links', '连续与链接', '上排连续地址表示数组，下排带指针的离散节点表示链表。'],
    ['bplus-tree', '索引的叶层', '多路内部节点缩小搜索范围，横向相连的叶页支持范围扫描。'],
    ['hash-buckets', '散列与碰撞', '键经过哈希分配到桶，同桶的双值展示碰撞而非一一映射。'],
    ['adjacency-graph', '关系与遍历', '非树状连接允许环，前沿颜色显示广度优先遍历的距离层。'],
  ],
  [
    ['sorting-bars', '有序的代价', '两组相同数值柱从乱序到升序，金色枢轴提示比较与分区。'],
    ['divide-tree', '分治递归树', '问题分成独立子问题，叶子求解后沿树合并结果。'],
    ['dp-lattice', '状态转移表', '网格中每个状态依赖左侧或上方子问题，金色路径表示选出的解。'],
    ['weighted-path', '最短而非最少边', '不同粗细的边表示权重，高亮路线按总权重选择最短路径。'],
  ],
  [
    ['complexity-curves', '增长率与边界', '三排采样柱分别表达线性、n log n 与平方增长，比较规模增长的成本。'],
    ['capacity-flow', '容量限制的流', '源点经两条有容量的管道汇入汇点，细亮管表示可行流量不超过容量。'],
    ['trie-prefix', '共享前缀', '相同开头共用树枝，终止标记区分完整单词与仅有前缀。'],
    ['approximation-cover', '近似的覆盖', '三个候选集合覆盖离散需求点，突出贪心覆盖与最优解之间的权衡。'],
  ],
  [
    ['cpu-board', '处理器与缓存', '芯片、引脚、缓存和总线组成微型主板，展示指令执行与存储层次。'],
    ['process-memory', '进程的地址空间', '并行进程通道拥有隔离的页格，共享物理页通过映射连线访问。'],
    ['mutex-gate', '临界区闸门', '两条线程路径竞争同一把锁，只有持锁路径进入共享临界区。'],
    ['compiler-stages', '从语法到执行', '词元经过语法树、优化与代码生成，旁侧回收格表示运行时内存管理。'],
  ],
  [
    ['network-layers', '封装与路由', '嵌套数据包逐层封装，经路由节点转发，再由接收端解封装。'],
    ['tcp-window', '序号与确认', '发送窗口内的报文向接收端移动，反向确认路径驱动可靠传输。'],
    ['http-cache', '请求与缓存', '客户端经代理访问源站，短回路表示缓存命中而非每次访问源站。'],
    ['async-contract', '异步接口', '契约门分隔客户端与服务，事件回调路径与请求路径分别返回状态。'],
  ],
  [
    ['relational-tables', '主键与外键', '两张行列表格通过主外键连接，约束把实体关系变成可查询结构。'],
    ['query-index', '索引到数据页', '索引树定位数据页，侧面的日志条记录存储引擎的持久化写入。'],
    ['transaction-log', '提交的边界', '两个版本的数据圆柱经日志抵达提交门，分离未提交状态与可见状态。'],
    ['data-lineage', '批流汇合', '批量数据与事件流经质量检查汇入仓库，连线保留数据血缘。'],
  ],
  [
    ['requirements-tests', '需求到验收', '需求卡经领域模型和实现，最终逐一对应验收测试，不以代码量代替完成。'],
    ['refactor-seam', '拆开耦合', '左侧交错依赖通过接口接缝重组为右侧高内聚模块。'],
    ['test-pyramid', '验证金字塔', '宽底单元测试、中层集成测试、少量端到端测试形成分层验证。'],
    ['iteration-feedback', '迭代反馈环', '计划、实现、评审与维护围绕反馈中心，风险条提示每轮验收。'],
  ],
  [
    ['module-boundaries', '依赖朝内', '分层模块围绕稳定领域核心，外部适配器通过明确端口连接。'],
    ['event-services', '事件与服务', '独立服务通过中央事件总线集成，边界而非外观数量决定拆分。'],
    ['capacity-queue', '测量与排队', '到达任务排队进入工作节点，旁侧容量柱显示吞吐瓶颈。'],
    ['migration-strangler', '渐进替换', '入口逐步把流量从旧系统切换到新模块，保留可回退的迁移路径。'],
  ],
  [
    ['logical-clocks', '消息决定先后', '三条时间线由消息建立因果偏序，断开的路径表示部分失败。'],
    ['replica-quorum', '多数而非全体', '领导者向副本复制，三个亮节点形成仲裁；暗节点不必同时在线。'],
    ['saga-compensation', '长事务的补偿', '正向业务步骤与反向补偿分轨排列，去重闸门保护重复消息。'],
    ['shard-merge', '分片与合并', '数据分布在三个分片，合并路径把可交换更新汇成一致状态。'],
  ],
  [
    ['container-cluster', '隔离与编排', '节点承载隔离容器，中央调度器把工作负载分配到可用资源。'],
    ['canary-release', '小流量先行', '发布流水线分出少量金丝雀流量，旁路允许快速回滚旧制品。'],
    ['security-shield', '身份与授权', '盾形边界保护数据，密钥经过认证门后仍需通过分级授权。'],
    ['sre-gauges', '可靠性的预算', '三个刻度仪分别观察延迟、错误与饱和度，剩余预算决定变更空间。'],
  ],
  [
    ['logic-gates', '命题的电路', '两路输入经与、非门生成输出，真值格把逻辑表达式变成可检验命题。'],
    ['set-intersection', '交集与关系', '两个平面集合共享中央元素，偏序连线强调包含与等价并不相同。'],
    ['combinatorial-graph', '计数与生成树', '完整关系图中的高亮无环边形成生成树，展示组合选择的约束。'],
    ['finite-automaton', '状态与语言', '起始箭头、接受状态和回边构成有限自动机，输入驱动状态迁移。'],
  ],
  [
    ['basis-vectors', '基与投影', '三根有方向的基向量张成坐标空间，投影线展示矩阵变换的几何意义。'],
    ['gradient-surface', '变化率的地形', '曲面采样柱与切向箭头显示局部导数，累积面积对应积分。'],
    ['numerical-iterations', '收敛与误差', '逐次逼近的点走向目标，误差柱缩短但不把浮点数当作无限精确。'],
    ['constrained-descent', '约束下的下降', '碗形目标面上的下降路径逼近极小值，边界标出可行域。'],
  ],
  [
    ['bayes-paths', '条件改变判断', '先验分支经过观测证据重新汇合，路径宽度表达不同条件下的概率。'],
    ['bell-histogram', '样本与区间', '钟形频数柱围绕均值，横向区间杆强调估计的不确定性。'],
    ['randomized-trial', '对照而非相关', '同一总体随机分流到对照组与实验组，结果柱比较干预效应。'],
    ['information-tree', '频率与码长', '高频符号走短路径，低频符号走长路径，构成可区分的前缀编码树。'],
  ],
  [
    ['neural-network', '学习的权重', '输入、隐藏层与输出之间的加权连接表达模型，独立样本格表示评估集。'],
    ['rag-pipeline', '检索后生成', '文档进入向量索引，与查询共同生成上下文，再经过模型与评测护栏。'],
    ['camera-frustum', '相机看见什么', '相机锥体连到成像平面，几何体与光源在视锥内形成可渲染场景。'],
    ['research-reproduction', '假设到复现', '假设、方法、实验和独立复现形成证据链，验证门检查最终结论。'],
  ],
];

export const EXHIBIT_DESCRIPTIONS = Object.freeze(Object.fromEntries(
  catalogue.flatMap((row, floor) => row.map(([type, title, summary], index) => {
    const id = `${floor + 1}-${index + 1}`;
    return [id, Object.freeze({ id, type, title, summary })];
  })),
));

export function addSemanticExhibit(THREE, parent, description, kit) {
  const { box, cylinder, mesh, geometries, material, steel, dark, tint } = kit;
  const exhibit = new THREE.Group();
  exhibit.name = `exhibit-${description.type}`;
  exhibit.position.y = 1.08;
  exhibit.userData = {
    role: 'exhibit', exhibitId: description.id, exhibitKind: description.type,
    title: description.title, summary: description.summary,
  };
  parent.add(exhibit);
  const bright = material(tint, { roughness: 0.4, metalness: 0.24 });
  const accent = material('#f3c879', { emissive: '#f3c879', emissiveIntensity: 0.16 });
  const pale = kit.pale;
  const b = (name, p, s, mat = bright) => box(exhibit, name, mat, p, s, true);
  const c = (name, p, r, h, mat = bright) => cylinder(exhibit, name, mat, p, r, h, true);
  const dot = (name, p, mat = bright, r = 0.14) =>
    mesh(exhibit, name, geometries.sphere, mat, p, [r, r, r], true);
  const edge = (name, a, z, mat = steel, radius = 0.035) => {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...z);
    const direction = end.clone().sub(start);
    const link = c(name, start.clone().add(end).multiplyScalar(0.5).toArray(), radius, direction.length(), mat);
    link.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    return link;
  };
  const arrow = (name, a, z, mat = accent) => {
    edge(name, a, z, mat);
    const direction = new THREE.Vector3(...z).sub(new THREE.Vector3(...a)).normalize();
    const head = mesh(exhibit, `${name}-arrow`, geometries.cone, mat,
      z, [0.09, 0.23, 0.09], true);
    head.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
  };
  const ring = (name, p, radius, mat = bright) => {
    const object = mesh(exhibit, name, geometries.ring, mat, p, [radius, radius, radius]);
    return object;
  };
  const graph = (points, links, { boxes = false, selected = [], directed = false } = {}) => {
    points.forEach((p, i) => boxes
      ? b(`state-${i}`, p, [0.43, 0.32, 0.38], selected.includes(i) ? accent : bright)
      : dot(`node-${i}`, p, selected.includes(i) ? accent : bright, 0.18));
    links.forEach(([a, z], i) => (directed ? arrow : edge)(`edge-${a}-${z}`, points[a], points[z],
      selected.includes(i) ? accent : steel));
  };
  const pipeline = (labels, { fork = false } = {}) => {
    const points = labels.map((label, i) => [-1.4 + i * 2.8 / (labels.length - 1), 0.48, 0]);
    points.forEach((p, i) => {
      b(labels[i], p, [0.42, 0.75, 0.68], i === labels.length - 1 ? accent : bright);
      if (i) arrow(`handoff-${i}`, points[i - 1], p);
    });
    if (fork) {
      b('side-input', [-0.7, 0.2, 1], [0.5, 0.35, 0.4], pale);
      arrow('side-input-edge', [-0.7, 0.4, 1], points[1]);
    }
  };
  const tree = (depth = 2, linkedLeaves = false) => {
    const pts = [[0, 1.65, 0], [-0.85, 1, 0], [0.85, 1, 0],
      [-1.35, 0.25, 0], [-0.45, 0.25, 0], [0.45, 0.25, 0], [1.35, 0.25, 0]];
    graph(depth === 1 ? pts.slice(0, 3) : pts,
      depth === 1 ? [[0, 1], [0, 2]] : [[0, 1], [0, 2], [1, 3], [1, 4], [2, 5], [2, 6]], { boxes: true });
    if (linkedLeaves) for (let i = 3; i < 6; i++) arrow(`leaf-scan-${i}`, pts[i], pts[i + 1]);
  };
  const grid = (rows, cols, height, highlight = () => false) => {
    for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) {
      const h = height(r, k);
      b(`cell-${r}-${k}`, [(k - (cols - 1) / 2) * 0.52, h / 2, (r - (rows - 1) / 2) * 0.55],
        [0.45, h, 0.46], highlight(r, k) ? accent : bright);
    }
  };
  const network = [[-1.35, 0.3, 0], [-0.6, 1.55, 0], [0.2, 0.65, 0.65],
    [0.8, 1.55, 0], [1.35, 0.3, 0]];
  const links = [[0, 1], [0, 2], [1, 3], [2, 3], [2, 4], [3, 4]];
  const type = description.type;
  switch (type) {
    case 'binary-tiles':
      for (let i = 0; i < 8; i++) {
        b(`bit-${i}-${i % 3 ? 1 : 0}`, [-1.4 + i * 0.4, 0.18, 0.3], [0.32, 0.3, 0.6], i % 3 ? bright : dark);
        b(`weight-${7 - i}`, [-1.4 + i * 0.4, 0.65 + (7 - i) * 0.08, -0.4], [0.24, 0.15, 0.38], accent);
      }
      break;
    case 'control-flow': {
      const pts = [[0, 1.7, 0], [0, 1.05, 0], [-1.1, 0.5, 0], [1.1, 0.5, 0]];
      graph(pts, [[0, 1], [1, 2], [1, 3], [3, 0]], { boxes: true, directed: true });
      exhibit.getObjectByName('state-1').rotation.z = Math.PI / 4;
      break;
    }
    case 'typed-memory':
      grid(2, 4, (r, k) => r ? 0.3 : 0.5 + k * 0.1, (r, k) => r === k % 2);
      arrow('reference', [-0.8, 0.85, 0.3], [0.8, 0.85, -0.3]);
      b('lifetime-boundary', [0, 0.03, 0], [2.8, 0.05, 1.8], dark);
      break;
    case 'paradigm-composition':
      for (let i = 0; i < 3; i++) b(`procedure-step-${i}`, [-1.1, 0.18 + i * 0.4, 0], [0.5, 0.28, 0.6]);
      b('encapsulated-object', [0, 0.65, 0], [0.6, 1.25, 0.8], pale);
      for (let i = 0; i < 3; i++) {
        dot(`pure-function-${i}`, [1.1, 0.25 + i * 0.55, 0], accent, 0.2);
        if (i) arrow(`composition-${i}`, [1.1, i * 0.55 - 0.15, 0], [1.1, i * 0.55 + 0.15, 0]);
      }
      break;
    case 'debug-stack':
      for (let i = 0; i < 4; i++) b(`call-frame-${i}`, [-0.65, 0.15 + i * 0.34, 0], [1.3, 0.23, 1]);
      dot('breakpoint', [-0.65, 1.4, 0.58], accent);
      for (let i = 0; i < 3; i++) b(`watched-variable-${i}`, [1, 0.25 + i * 0.38, 0], [0.55, 0.22, 0.7], pale);
      break;
    case 'git-branches':
      graph([[-1.4, 0.3, 0], [-0.5, 0.3, 0], [0.45, 0.3, 0], [1.4, 0.3, 0], [-0.15, 1.25, 0], [0.75, 1.25, 0]],
        [[0, 1], [1, 2], [2, 3], [1, 4], [4, 5], [5, 3]], { selected: [4, 5], directed: true });
      break;
    case 'build-dag':
      graph([[-1.3, 0.25, -0.5], [-1.3, 0.25, 0.6], [-0.35, 0.9, 0], [0.6, 0.9, 0], [1.4, 0.35, 0]],
        [[0, 2], [1, 2], [2, 3], [3, 4]], { boxes: true, directed: true, selected: [4] });
      break;
    case 'ci-pipeline': pipeline(['issue', 'review', 'build', 'tests', 'artifact']); break;
    case 'array-links':
      for (let i = 0; i < 5; i++) {
        b(`array-address-${i}`, [-1.2 + i * 0.6, 0.85, -0.45], [0.56, 0.35, 0.5]);
        const p = [-1.2 + i * 0.6, 0.25, 0.45 + (i % 2) * 0.22];
        b(`linked-value-${i}`, p, [0.36, 0.25, 0.35], accent);
        if (i < 4) arrow(`next-pointer-${i}`, p, [-0.6 + i * 0.6, 0.25, 0.45 + ((i + 1) % 2) * 0.22]);
      }
      break;
    case 'bplus-tree': case 'query-index':
      tree(2, true);
      if (type === 'query-index') {
        for (let i = 0; i < 3; i++) b(`write-ahead-log-${i}`, [0, 0.08 + i * 0.12, 0.95], [2.7, 0.08, 0.22], pale);
      }
      break;
    case 'hash-buckets':
      for (let i = 0; i < 4; i++) {
        c(`bucket-${i}`, [-1.1 + i * 0.73, 0.3, 0.4], 0.28, 0.6);
        dot(`key-${i}`, [-1.1 + i * 0.73, 1.25, -0.6], accent);
        arrow(`hash-${i}`, [-1.1 + i * 0.73, 1.15, -0.6], [-1.1 + (i % 3) * 0.73, 0.7, 0.4]);
      }
      dot('collision', [-1.1, 0.85, 0.4], pale);
      break;
    case 'adjacency-graph': graph(network, [...links, [1, 4]], { selected: [0, 1, 2] }); break;
    case 'sorting-bars':
      [3, 1, 5, 2, 4].forEach((v, i) => {
        b(`unsorted-${v}`, [-1.2 + i * 0.6, v * 0.12, -0.55], [0.4, v * 0.24, 0.42], v === 3 ? accent : bright);
        b(`sorted-${i + 1}`, [-1.2 + i * 0.6, (i + 1) * 0.12, 0.55], [0.4, (i + 1) * 0.24, 0.42]);
      });
      break;
    case 'divide-tree': tree(); b('merge-result', [0, 0.13, 0.85], [2.9, 0.22, 0.3], accent); break;
    case 'dp-lattice': grid(4, 5, (r, k) => 0.12 + (r + k) * 0.09, (r, k) => k === r || k === r + 1); break;
    case 'weighted-path':
      graph(network, links, { selected: [0, 2, 4] });
      links.forEach(([a, z], i) => edge(`weight-${i + 1}`, network[a], network[z], i % 2 ? accent : bright, 0.04 + i * 0.012));
      break;
    case 'complexity-curves':
      grid(3, 5, (r, k) => 0.1 + (r === 0 ? (k + 1) * 0.12 : r === 1 ? (k + 1) * Math.log2(k + 2) * 0.1 : (k + 1) ** 2 * 0.065),
        (r, k) => k === 4);
      break;
    case 'capacity-flow':
      graph([[-1.4, 0.7, 0], [-0.45, 1.45, 0], [0.45, 0.25, 0], [1.4, 0.7, 0]],
        [[0, 1], [0, 2], [1, 3], [2, 3], [1, 2]], { directed: true });
      edge('capacity-upper', [-1.4, 0.7, 0], [-0.45, 1.45, 0], bright, 0.12);
      edge('used-flow', [-1.4, 0.7, 0.14], [-0.45, 1.45, 0.14], accent, 0.045);
      break;
    case 'trie-prefix':
      tree();
      for (const x of [-1.35, 0.45, 1.35]) c('word-terminator', [x, 0.25, 0], 0.27, 0.08, accent);
      break;
    case 'approximation-cover':
      for (let i = 0; i < 3; i++) {
        const disk = c(`candidate-set-${i}`, [-0.8 + i * 0.8, 0.05 + i * 0.05, 0], 0.78, 0.05, i === 1 ? accent : bright);
        disk.scale.z *= 0.8;
      }
      for (let i = 0; i < 7; i++) dot(`demand-${i}`, [-1.35 + i * 0.45, 0.3, i % 2 ? 0.35 : -0.35], pale, 0.09);
      break;
    case 'cpu-board':
      b('motherboard', [0, 0.1, 0], [3.1, 0.18, 2.1], dark);
      b('processor', [-0.45, 0.4, 0], [1.1, 0.5, 1.1]);
      for (let i = 0; i < 6; i++) {
        b(`cpu-pin-${i}`, [-0.85 + i * 0.16, 0.29, 0.7], [0.06, 0.12, 0.3], accent);
        b(`memory-chip-${i}`, [0.6 + (i % 2) * 0.48, 0.28, -0.65 + Math.floor(i / 2) * 0.65], [0.3, 0.25, 0.4], pale);
      }
      break;
    case 'process-memory':
      for (let i = 0; i < 3; i++) {
        b(`process-lane-${i}`, [-1 + i, 0.12, 0], [0.75, 0.2, 2.1], dark);
        for (let j = 0; j < 3; j++) b(`virtual-page-${i}-${j}`, [-1 + i, 0.4, -0.65 + j * 0.65], [0.53, 0.3, 0.4], j === 1 ? accent : bright);
      }
      edge('shared-page-mapping', [-1, 0.7, 0], [1, 0.7, 0], pale);
      break;
    case 'mutex-gate':
      for (const z of [-0.6, 0.6]) arrow('thread', [-1.4, 0.3, z], [0, 0.3, z]);
      b('critical-section', [0.9, 0.4, 0], [0.9, 0.75, 1.6], pale);
      b('mutex-barrier', [0, 0.65, 0], [0.12, 1.2, 1.8], bright);
      dot('single-lock-token', [0, 1.45, 0], accent, 0.22);
      arrow('lock-holder', [0, 0.3, -0.6], [0.9, 0.8, 0]);
      break;
    case 'compiler-stages': pipeline(['tokens', 'syntax-tree', 'optimizer', 'machine-code'], { fork: true }); break;
    case 'network-layers':
      for (let i = 0; i < 4; i++) b(`encapsulation-${i}`, [-0.9, 0.16 + i * 0.25, 0], [1.25 - i * 0.2, 0.19, 1.5 - i * 0.24], i % 2 ? pale : bright);
      c('router', [0.9, 0.3, 0], 0.55, 0.5, dark);
      arrow('routed-packet', [-0.1, 0.65, 0], [0.9, 0.65, 0], accent);
      break;
    case 'tcp-window':
      b('sender', [-1.4, 0.6, 0], [0.3, 1.1, 1.4], dark);
      b('receiver', [1.4, 0.6, 0], [0.3, 1.1, 1.4], dark);
      for (let i = 0; i < 4; i++) b(`sequence-${i}`, [-0.9 + i * 0.6, 0.9, -0.25], [0.4, 0.3, 0.38], i === 3 ? pale : bright);
      arrow('acknowledgement', [1.1, 0.25, 0.5], [-1.1, 0.25, 0.5]);
      break;
    case 'http-cache':
      pipeline(['client', 'cache-proxy', 'origin']);
      arrow('cache-hit', [0, 1.1, 0], [-1.4, 1.1, 0]);
      b('cached-response', [0, 1, 0], [0.55, 0.22, 0.85], pale);
      break;
    case 'async-contract':
      pipeline(['client', 'contract', 'service']);
      arrow('callback', [1.4, 1.2, 0.7], [-1.4, 1.2, 0.7]);
      b('event-state', [-0.5, 0.2, 0.8], [0.4, 0.3, 0.4], pale);
      break;
    case 'relational-tables':
      for (const x of [-0.85, 0.85]) for (let r = 0; r < 3; r++) for (let k = 0; k < 2; k++)
        b(`relation-${x}-${r}-${k}`, [x + k * 0.42 - 0.21, 0.2 + r * 0.35, 0], [0.36, 0.26, 0.85], k ? bright : accent);
      edge('foreign-key', [-0.6, 1.25, 0], [0.6, 1.25, 0], accent);
      break;
    case 'transaction-log':
      for (const x of [-1.05, 1.05]) for (let i = 0; i < 3; i++)
        c(`version-${x}-${i}`, [x, 0.18 + i * 0.32, 0], 0.45, 0.25, x < 0 ? bright : accent);
      b('commit-gate', [0, 0.8, 0], [0.18, 1.5, 0.9], pale);
      for (let i = 0; i < 4; i++) b(`log-record-${i}`, [-0.65 + i * 0.42, 0.12, 0.9], [0.3, 0.18, 0.3], dark);
      break;
    case 'data-lineage': pipeline(['batch', 'quality', 'warehouse'], { fork: true }); break;
    case 'requirements-tests': pipeline(['requirements', 'domain', 'implementation', 'acceptance']);
      for (let i = 0; i < 3; i++) dot(`acceptance-case-${i}`, [1.4, 1.1 + i * 0.22, 0], accent, 0.08);
      break;
    case 'refactor-seam':
      graph([[-1.3, 0.3, 0], [-1.3, 1.1, 0], [-0.5, 0.3, 0], [-0.5, 1.1, 0]],
        [[0, 3], [1, 2], [0, 1], [2, 3]], { boxes: true });
      for (let i = 0; i < 3; i++) b(`cohesive-module-${i}`, [0.9, 0.2 + i * 0.5, 0], [0.9, 0.35, 1]);
      b('stable-interface', [0.25, 0.8, 0], [0.1, 1.5, 1.2], accent);
      break;
    case 'test-pyramid':
      for (let i = 0; i < 3; i++) {
        b(['unit-tests', 'integration-tests', 'end-to-end-tests'][i],
          [0, 0.2 + i * 0.5, 0], [2.8 - i * 0.85, 0.4, 1.8 - i * 0.5], i === 2 ? accent : bright);
        for (let test = 0; test < 5 - i * 2; test++) {
          b(`test-case-${i}-${test}`, [(test - (4 - i * 2) / 2) * 0.42, 0.2 + i * 0.5, 0.92 - i * 0.25],
            [0.16, 0.16, 0.03], pale);
        }
      }
      break;
    case 'iteration-feedback':
      graph([[-1.1, 0.35, -0.7], [1.1, 0.35, -0.7], [1.1, 0.35, 0.7], [-1.1, 0.35, 0.7]],
        [[0, 1], [1, 2], [2, 3], [3, 0]], { boxes: true, directed: true });
      c('feedback', [0, 0.6, 0], 0.35, 1, accent);
      break;
    case 'module-boundaries':
      for (let i = 0; i < 3; i++) b(['adapters', 'application', 'domain'][i],
        [0, 0.2 + i * 0.48, 0], [2.9 - i * 0.7, 0.3, 1.9 - i * 0.5], i === 2 ? accent : bright);
      arrow('inward-dependency', [-1.3, 0.5, 0], [-0.3, 1.5, 0]);
      break;
    case 'event-services':
      b('event-bus', [0, 0.3, 0], [3, 0.2, 0.22], accent);
      for (let i = 0; i < 4; i++) {
        const x = -1.1 + i * 0.73, z = i % 2 ? 0.85 : -0.85;
        b(`service-${i}`, [x, 0.55, z], [0.5, 0.9, 0.5]);
        arrow(`event-${i}`, [x, 0.3, 0], [x, 0.55, z]);
      }
      break;
    case 'capacity-queue':
      for (let i = 0; i < 5; i++) b(`queued-task-${i}`, [-1.4 + i * 0.38, 0.3, 0.5], [0.28, 0.4, 0.5]);
      for (let i = 0; i < 3; i++) b(`capacity-${i}`, [0.7 + i * 0.4, 0.3 + i * 0.2, -0.35], [0.28, 0.6 + i * 0.4, 0.7], accent);
      arrow('dequeue', [0.2, 0.3, 0.5], [1.1, 0.3, -0.35]);
      break;
    case 'migration-strangler':
      graph([[-1.3, 0.7, 0], [0.25, 0.4, -0.65], [0.25, 1.3, 0.65], [1.35, 0.7, 0]],
        [[0, 1], [1, 3], [0, 2], [2, 3]], { boxes: true, selected: [2, 3], directed: true });
      break;
    case 'logical-clocks':
      for (let r = 0; r < 3; r++) {
        const z = -0.7 + r * 0.7;
        edge(`timeline-${r}`, [-1.4, 0.2, z], [1.4, 0.2, z]);
        for (let i = 0; i < 3; i++) dot(`event-${r}-${i}`, [-1 + i, 0.2, z], i === r ? accent : bright);
      }
      arrow('happens-before', [-1, 0.25, -0.7], [0, 0.25, 0]);
      arrow('message-delivery', [0, 0.25, 0], [1, 0.25, 0.7]);
      break;
    case 'replica-quorum':
      graph([[0, 1.5, 0], [-1.2, 0.3, -0.6], [1.2, 0.3, -0.6], [-1.2, 0.3, 0.6], [1.2, 0.3, 0.6]],
        [[0, 1], [0, 2], [0, 3], [0, 4]], { boxes: true, selected: [0, 1, 2], directed: true });
      break;
    case 'saga-compensation':
      pipeline(['reserve', 'pay', 'ship']);
      arrow('compensate-payment', [1.4, 1.3, 0.65], [0, 1.3, 0.65], pale);
      arrow('release-reservation', [0, 1.3, 0.65], [-1.4, 1.3, 0.65], pale);
      break;
    case 'shard-merge':
      for (let i = 0; i < 3; i++) {
        c(`shard-${i}`, [-1 + i, 0.4, 0.6], 0.34, 0.75);
        arrow(`merge-${i}`, [-1 + i, 0.8, 0.6], [0, 1.4, -0.5]);
      }
      b('converged-state', [0, 1.4, -0.5], [0.8, 0.4, 0.55], accent);
      break;
    case 'container-cluster':
      for (let i = 0; i < 3; i++) {
        b(`host-node-${i}`, [-1.05 + i * 1.05, 0.12, 0], [0.92, 0.2, 1.6], dark);
        for (let k = 0; k < 2; k++) b(`isolated-container-${i}-${k}`, [-1.05 + i * 1.05, 0.43, -0.4 + k * 0.8], [0.65, 0.4, 0.55]);
      }
      dot('scheduler', [0, 1.55, 0], accent, 0.24);
      break;
    case 'canary-release':
      pipeline(['build', 'verify', 'release']);
      arrow('canary-one-tenth', [1.3, 1, 0], [0.3, 1.3, 0.9]);
      b('canary', [0.3, 1.3, 0.9], [0.3, 0.3, 0.3], accent);
      arrow('rollback', [1.4, 0.25, 0.9], [-1.4, 0.25, 0.9], pale);
      break;
    case 'security-shield': {
      b('protected-data', [0, 0.5, -0.45], [0.85, 0.9, 0.65], dark);
      b('shield-center', [0, 0.9, 0.2], [1.2, 1.25, 0.18]);
      for (const x of [-0.45, 0.45]) {
        const side = b('shield-taper', [x, 0.3, 0.2], [0.65, 0.2, 0.18]);
        side.rotation.z = x < 0 ? -0.65 : 0.65;
      }
      ring('authentication-key', [0, 1.1, 0.35], 0.19, accent);
      b('authorization-key-shaft', [0, 0.75, 0.35], [0.07, 0.5, 0.07], accent);
      break;
    }
    case 'sre-gauges':
      for (let i = 0; i < 3; i++) {
        const x = -1.05 + i * 1.05;
        ring(['latency', 'errors', 'saturation'][i], [x, 0.9, 0], 0.45);
        edge(`gauge-needle-${i}`, [x, 0.9, 0], [x - 0.3 + i * 0.27, 1.2, 0], accent);
        const budgetHeight = 0.1 + i * 0.12;
        b(`error-budget-${i}`, [x, budgetHeight / 2, 0], [0.65, budgetHeight, 0.45], pale);
      }
      break;
    case 'logic-gates':
      graph([[-1.3, 0.3, 0], [-1.3, 1.1, 0], [-0.3, 0.7, 0], [0.65, 0.7, 0], [1.4, 0.7, 0]],
        [[0, 2], [1, 2], [2, 3], [3, 4]], { boxes: true, directed: true, selected: [4] });
      b('truth-table', [0, 0.07, 0.8], [2.5, 0.12, 0.4], pale);
      break;
    case 'set-intersection':
      for (const x of [-0.6, 0.6]) {
        const circle = ring('set-boundary', [x, 0.12, 0], 0.9);
        circle.rotation.x = Math.PI / 2;
      }
      for (const x of [-1, 0, 1]) dot('set-element', [x, 0.3, 0], x === 0 ? accent : bright);
      arrow('subset-relation', [-1, 0.7, 0], [0, 1.1, 0]);
      break;
    case 'combinatorial-graph':
      graph(network, [...links, [0, 3], [0, 4], [1, 4]], { selected: [0, 2, 3, 5] });
      break;
    case 'finite-automaton':
      graph([[-1, 0.6, 0], [0, 1.3, 0], [1, 0.6, 0]], [[0, 1], [1, 2], [2, 0]], { directed: true });
      ring('accepting-state', [1, 0.6, 0], 0.3, accent);
      arrow('start', [-1.6, 0.6, 0], [-1.2, 0.6, 0]);
      break;
    case 'basis-vectors':
      arrow('basis-x', [-1, 0.1, 0.6], [1.4, 0.1, 0.6], bright);
      arrow('basis-y', [-1, 0.1, 0.6], [-1, 1.9, 0.6], accent);
      arrow('basis-z', [-1, 0.1, 0.6], [-1, 0.1, -1], pale);
      edge('projection', [0.6, 1.3, -0.5], [0.6, 0.1, -0.5], steel);
      dot('transformed-vector', [0.6, 1.3, -0.5]);
      break;
    case 'gradient-surface':
      grid(4, 5, (r, k) => 0.15 + 0.09 * k * k + 0.06 * r, (r, k) => r === 1);
      arrow('local-gradient', [-0.7, 0.45, -0.2], [0.65, 1.5, -0.2]);
      break;
    case 'numerical-iterations':
      for (let i = 0; i < 6; i++) {
        const x = -1.4 + i * 0.55, h = 1.5 * 0.6 ** i;
        b(`error-${i}`, [x, h / 2, 0.5], [0.35, h, 0.4]);
        dot(`iterate-${i}`, [x, 0.2 + h / 2, -0.5], accent, 0.1);
        if (i) edge(`convergence-${i}`, [x - 0.55, 0.2 + h / 1.2, -0.5], [x, 0.2 + h / 2, -0.5]);
      }
      break;
    case 'constrained-descent':
      grid(4, 5, (r, k) => 0.12 + (k - 2) ** 2 * 0.22 + (r - 1.5) ** 2 * 0.18);
      graph([[-1, 1.6, 0.8], [-0.5, 0.75, 0.3], [0, 0.3, 0]], [[0, 1], [1, 2]], { selected: [0, 1, 2], directed: true });
      break;
    case 'bayes-paths':
      graph([[-1.4, 0.8, 0], [-0.45, 1.45, 0], [-0.45, 0.3, 0], [0.6, 1.3, 0], [0.6, 0.3, 0], [1.4, 0.8, 0]],
        [[0, 1], [0, 2], [1, 3], [2, 4], [3, 5], [4, 5]], { directed: true, selected: [1, 3, 4] });
      edge('posterior-mass', [0.6, 1.3, 0], [1.4, 0.8, 0], accent, 0.1);
      break;
    case 'bell-histogram':
      for (let i = 0; i < 9; i++) {
        const h = 1.6 * Math.exp(-(((i - 4) / 2.2) ** 2));
        b(`frequency-${i}`, [-1.4 + i * 0.35, h / 2, 0], [0.28, h, 0.65], i === 4 ? accent : bright);
      }
      edge('confidence-interval', [-0.7, 1.85, 0], [0.7, 1.85, 0], pale);
      break;
    case 'randomized-trial':
      graph([[0, 1.65, 0], [-0.9, 0.85, 0], [0.9, 0.85, 0]], [[0, 1], [0, 2]], { directed: true });
      for (let i = 0; i < 6; i++) {
        const height = i < 3 ? 0.3 : 0.65;
        b(`outcome-${i}`, [-1.4 + i * 0.55, height / 2, 0.7], [0.35, height, 0.4], i < 3 ? bright : accent);
      }
      break;
    case 'information-tree':
      graph([[-1.3, 1.6, 0], [-1.3, 0.4, 0], [0, 1.2, 0], [-0.1, 0.4, 0], [1, 0.9, 0], [0.7, 0.25, 0], [1.5, 0.25, 0]],
        [[0, 1], [0, 2], [2, 3], [2, 4], [4, 5], [4, 6]], { boxes: true, selected: [1, 3, 5, 6] });
      break;
    case 'neural-network': {
      const pts = [];
      for (let layer = 0; layer < 3; layer++) for (let n = 0; n < 3; n++)
        pts.push([-1.2 + layer * 1.2, 0.3 + n * 0.65, layer === 1 ? -0.2 : 0.2]);
      const edges = [];
      for (let l = 0; l < 2; l++) for (let a = 0; a < 3; a++) for (let z = 0; z < 3; z++) edges.push([l * 3 + a, (l + 1) * 3 + z]);
      graph(pts, edges, { selected: [6, 7, 8] });
      b('held-out-evaluation', [0, 0.1, 0.95], [1.2, 0.15, 0.35], pale);
      break;
    }
    case 'rag-pipeline':
      pipeline(['documents', 'vector-index', 'context', 'model', 'evaluation'], { fork: true });
      b('guardrail', [1.1, 0.9, 0], [0.07, 1.65, 1.1], pale);
      break;
    case 'camera-frustum': {
      b('camera', [-1.2, 0.6, 0], [0.5, 0.5, 0.55], dark);
      const corners = [[1.2, 0.15, -0.85], [1.2, 1.65, -0.85], [1.2, 1.65, 0.85], [1.2, 0.15, 0.85]];
      corners.forEach((p, i) => {
        edge(`frustum-ray-${i}`, [-1, 0.6, 0], p, accent);
        edge(`image-plane-${i}`, p, corners[(i + 1) % 4], pale);
      });
      b('scene-object', [0.4, 0.5, 0], [0.45, 0.9, 0.45]);
      dot('light', [0, 1.7, -0.6], accent);
      break;
    }
    case 'research-reproduction':
      pipeline(['hypothesis', 'method', 'experiment', 'reproduction'], { fork: true });
      b('verification-gate', [0.95, 1, 0], [0.06, 1.7, 1], pale);
      break;
    default: throw new RangeError(`No semantic exhibit for ${type}`);
  }
  exhibit.traverse(object => {
    if (object.isMesh) Object.assign(object.userData, {
      exhibitId: description.id, exhibitKind: description.type, semanticPart: object.name,
    });
  });
  return exhibit;
}
