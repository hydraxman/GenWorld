window.KNOWLEDGE = {
  sources: {
    blueprint: { title: "AI时代大学教育重构蓝图（新版）", kind: "教育框架", note: "18 页 · 通识底座、三类知识、双轨评价与 PBL 推演" },
    ie: { title: "AI赋能工业工程教学建设与思考", kind: "教学建设", note: "37 页 · 知识原子、最小先修、路径规划与自主建构" },
    fish: { title: "竞速先锋 · 仿生金枪鱼水下机器人", kind: "项目报告", note: "12 页 · 机构、电控、水下测试与尚未达成的目标" },
    snake: { title: "面向在轨组装的超冗余自由度蛇形机器人", kind: "项目报告", note: "18 页 · 机械、电控、视觉、规划与通信" },
    isip: { title: "ISIP学术节课程典型课题 · 2026", kind: "案例总览", note: "3 页 · 金枪鱼与蛇形机器人案例海报" },
    ml1: { title: "从训练规模到可用系统", kind: "课程整理", note: "模型训练、scaling laws、成本与缓存；编者重组文章" },
    ml2: { title: "语言模型的学习与内部机制", kind: "课程整理", note: "概率分布、表示、SAE、机制解释及证据限制" },
    ml3: { title: "并行训练与推理优化专题", kind: "课程整理", note: "Roofline、显存、并行、KV cache、调度与量化" }
  },
  types: {
    base: { name: "通识底座", color: "#7a8a9b", short: "基" },
    threshold: { name: "门槛知识", color: "#d09549", short: "门" },
    hub: { name: "纽结知识", color: "#427d75", short: "纽" },
    transfer: { name: "同构知识", color: "#8070b6", short: "迁" }
  },
  domains: { all: "全部知识", general: "通识与判断", robot: "机器人与工程", ml: "机器学习系统", system: "跨域结构" },
  nodes: [
    { id: "math", name: "数学建模", en: "Mathematical modeling", type: "base", domain: "general", x: 120, y: 112, prereqs: [], desc: "把真实问题转成变量、目标与约束。重要的不是写出公式，而是知道公式保留了什么、忽略了什么。", question: "如果目标函数最优，但物理上不可执行，问题出在哪里？", mistake: "模型有解，不等于真实系统可行。", refs: [["blueprint", 5], ["ie", 13]] },
    { id: "physics", name: "物理机制", en: "Physical mechanisms", type: "base", domain: "general", x: 120, y: 230, prereqs: [], desc: "从受力、运动、能量和材料出发解释系统行为，为机构、控制和实验建立物理边界。", question: "为什么空中摆动正常的鱼尾，下水后不一定产生有效推进？", mistake: "能动起来，不等于能在真实负载下工作。", refs: [["blueprint", 5], ["fish", 7]] },
    { id: "ai", name: "AI 原理与边界", en: "AI literacy", type: "base", domain: "general", x: 120, y: 348, prereqs: [], desc: "理解 AI 的基本工作方式，并分清生成答案、可解释机制与可验证事实。", question: "AI 给出了完整报告，你还需要独立验证哪些部分？", mistake: "输出流畅不等于机制正确。", refs: [["blueprint", 3], ["ml2", "一、七"]] },
    { id: "ethics", name: "价值与判断", en: "Values & judgment", type: "base", domain: "general", x: 120, y: 466, prereqs: [], desc: "先判断为了谁、解决什么问题，再权衡效率、安全与人的福祉。不能把价值判断完全交给优化器。", question: "当成本最低的方案损害安全或可达性，你会怎样修改目标？", mistake: "把可量化的目标当成全部价值。", refs: [["blueprint", 9]] },
    { id: "thrust", name: "流体推进", en: "Fluid propulsion", type: "threshold", domain: "robot", x: 355, y: 90, prereqs: ["physics", "math"], desc: "把鱼尾摆动与流体中的推力联系起来，需要结合尾鳍形变、频率和真实水下实验理解。", question: "摆尾频率增加，游速是否一定单调增加？应如何验证？", mistake: "把电机频率直接当作推进效率。", refs: [["blueprint", 14], ["fish", 8]] },
    { id: "linkage", name: "曲柄连杆", en: "Crank-link mechanism", type: "hub", domain: "robot", x: 355, y: 204, prereqs: ["physics"], desc: "把电机连续转动转换为往复摆动，连接动力输入、传动结构与柔性鱼尾的输出。", question: "不增加电机数量，怎样改变尾部摆动幅度？", mistake: "只考虑运动学，不考虑强度、摩擦与水下阻力。", refs: [["fish", 3], ["fish", 4]] },
    { id: "control", name: "控制与反馈", en: "Control & feedback", type: "hub", domain: "robot", x: 355, y: 318, prereqs: ["physics", "interfaces"], desc: "将目标、测量与执行器联系起来。金枪鱼当前的遥控直游与计划引入 IMU 的航向稳定，必须区分。", question: "从开环遥控变成航向稳定闭环，至少需要新增哪些信息？", mistake: "收到控制指令，不代表实际运动已被闭环验证。", refs: [["fish", 6], ["fish", 9], ["snake", 10]] },
    { id: "perception", name: "视觉定位", en: "Perception & localization", type: "threshold", domain: "robot", x: 355, y: 432, prereqs: ["ai", "math"], desc: "蛇形机器人用 D405 的 RGB 与深度、YOLO 检测和目标锁定，构建面向运动与抓取的空间位置输入。", question: "目标框检测正确，为什么机械臂仍可能抓偏？", mistake: "检测框不是可直接执行的三维抓取位姿。", refs: [["snake", 11]] },
    { id: "planning", name: "高维运动规划", en: "High-dimensional planning", type: "threshold", domain: "robot", x: 355, y: 546, prereqs: ["optimization", "perception"], desc: "高自由度扩大可行构型，也增加搜索代价。项目报告讨论引导式采样、可微目标与约束处理。", question: "为什么自由度更多，规划反而可能更困难？", mistake: "把仿真中找到路径等同于真实硬件可稳定执行。", refs: [["snake", 12], ["snake", 17]] },
    { id: "probability", name: "概率与学习目标", en: "Probability & learning", type: "threshold", domain: "ml", x: 610, y: 90, prereqs: ["math", "ai"], desc: "区分数据分布、模型分布与有限样本上的经验损失；下一个 token 预测目标不能单独解释内部机制。", question: "验证 loss 降低，能否证明模型学到了真实因果机制？", mistake: "把最大似然的理想化结论当成有限样本训练的保证。", refs: [["ml2", "一、二"]] },
    { id: "transformer", name: "Transformer", en: "Architecture & computation", type: "hub", domain: "ml", x: 610, y: 204, prereqs: ["probability"], desc: "嵌入、位置编码、注意力、FFN、归一化与残差共同构成语言模型，理解结构才能解释训练与推理的资源开销。", question: "为什么看 attention 权重还不足以解释一个答案？", mistake: "将 attention、参数知识与 KV cache 当成同一种记忆。", refs: [["ml1", "二"], ["ml2", "三"]] },
    { id: "representation", name: "特征与机制解释", en: "Features & interpretability", type: "threshold", domain: "ml", x: 610, y: 318, prereqs: ["transformer", "experimental"], desc: "SAE 与 circuit tracing 为内部表示提出可检验假说；候选特征、关联和因果干预证据要分层理解。", question: "某个特征与答案同时出现，下一步应设计什么对照？", mistake: "把特征被激活当成它对答案有因果贡献的证明。", refs: [["ml2", "四、五、七"]] },
    { id: "scaling", name: "规模与预算", en: "Scaling & compute budget", type: "hub", domain: "ml", x: 610, y: 432, prereqs: ["optimization", "transformer"], desc: "在固定算力下共同安排参数量与训练 token 数，再通过可比的小模型实验研究损失变化与外推边界。", question: "同一算力预算下，模型更大是否一定更好？", mistake: "将 C≈6ND 的粗略算力估算当成硬件耗时公式。", refs: [["ml1", "三"]] },
    { id: "parallel", name: "并行与显存", en: "Parallelism & memory", type: "threshold", domain: "ml", x: 610, y: 546, prereqs: ["transformer", "interfaces"], desc: "先分清切分的是样本、矩阵、层还是训练状态，再讨论通信、重计算和显存之间的权衡。", question: "为什么权重放得下，训练仍可能显存不足？", mistake: "只统计模型权重，忽略梯度、优化器状态和激活。", refs: [["ml3", "五、六、七"]] },
    { id: "roofline", name: "Roofline 模型", en: "Compute vs. memory", type: "hub", domain: "ml", x: 855, y: 90, prereqs: ["math"], desc: "用算术强度把运算与数据搬运放到同一性能模型中：可达性能受峰值算力与带宽上界共同约束。", question: "GPU 利用率很高，为什么有效吞吐仍可能很低？", mistake: "将显存容量与带宽混淆，或把理论上界当作实测性能。", refs: [["ml3", "一、二、三"]] },
    { id: "kv", name: "KV 缓存", en: "KV cache", type: "hub", domain: "ml", x: 855, y: 204, prereqs: ["transformer"], desc: "保存历史位置的 Key、Value，减少重复计算，同时增加随上下文与并发增长的存储和访存负担。", question: "长上下文、高并发时，缓存节省了什么，又消耗了什么？", mistake: "系统缓存复用与账单中的命中折扣不是同一层概念。", refs: [["ml1", "五、六"], ["ml3", "九 · 9.2"]] },
    { id: "batching", name: "调度与 Goodput", en: "Scheduling & goodput", type: "hub", domain: "ml", x: 855, y: 318, prereqs: ["kv", "bottleneck"], desc: "连续批处理减少固定批次的等待，但还需用满足延迟约束的有效吞吐评价体验，而不是只追求总 TPS。", question: "总吞吐上升但首 token 等待恶化，方案算更好吗？", mistake: "将系统总 token/s 与单用户生成速度直接比较。", refs: [["ml3", "九 · 9.1、9.3"]] },
    { id: "optimization", name: "资源约束与优化", en: "Constrained optimization", type: "transfer", domain: "system", x: 855, y: 432, prereqs: ["math"], desc: "从生产系统到 GPU 训练，先明确资源、决策与目标；变量形式可以相似，但真实约束必须重新验证。", question: "怎样把 GPU 调度问题与生产线排程作有限度类比？", mistake: "只迁移优化算法，不检查约束和目标是否同构。", refs: [["ie", 8], ["ie", 13], ["ml1", "三"]] },
    { id: "bottleneck", name: "瓶颈与系统效率", en: "Bottlenecks & system efficiency", type: "transfer", domain: "system", x: 855, y: 546, prereqs: ["math"], desc: "软件系统的瓶颈、生产线的瓶颈工序与交通拥堵点，体现同一种结构：局部能力不等于系统能力，关键约束会随优化转移。", question: "把最快的环节再加速一倍，为什么总产出几乎不变？", mistake: "把局部指标提升当成端到端收益；类比时忽略队列、负载与拓扑差异。", refs: [["blueprint", 7], ["ml3", "一、二、九"]] },
    { id: "interfaces", name: "模块与接口", en: "Modules & interfaces", type: "transfer", domain: "system", x: 120, y: 584, prereqs: ["math"], desc: "机器人依赖视觉、规划和电控接口，大模型系统依赖计算、通信和存储的协作。接口让跨模块假设变得可检查。", question: "模块单测都通过，整机仍失败，先检查什么？", mistake: "通信连通不等于单位、坐标系、时序与语义一致。", refs: [["snake", 13], ["blueprint", 6], ["ml1", "四"]] },
    { id: "experimental", name: "试验与因果证据", en: "Experiments & evidence", type: "base", domain: "general", x: 120, y: 56, prereqs: [], desc: "控制变量、记录条件、设置对照，并区分观察、相关与因果；这同样适用于水池测试和模型内部干预。", question: "只改摆尾频率时，你还需要固定或记录哪些条件？", mistake: "一次成功演示不等于稳定、可重复的结论。", refs: [["blueprint", 8], ["ml2", "五"], ["fish", 8]] },
    { id: "validation", name: "端到端验证", en: "End-to-end validation", type: "transfer", domain: "system", x: 480, y: 602, prereqs: ["experimental", "interfaces"], desc: "用真实任务的验收标准验证整条链路。模型、模块和最终系统的有效性不能互相代替。", question: "怎样区分演示成功、性能达标与可持续运行？", mistake: "把目标描述、教学推演或计划中的能力写成已实现成果。", refs: [["fish", 9], ["snake", 17], ["ml3", "十"]] },
    { id: "dual", name: "双轨能力评价", en: "Dual-track assessment", type: "hub", domain: "general", x: 480, y: 30, prereqs: ["ethics", "validation"], desc: "无 AI 轨道检验独立理解与判断，有 AI 轨道检验任务拆解、审查修正与系统集成；两条轨道不能互相替代。", question: "一份 AI 写得很好的报告，应如何补充人的能力证据？", mistake: "以最终交付物的完整程度推断学生已掌握机制。", refs: [["blueprint", 11], ["blueprint", 15]] },
    { id: "reflection", name: "实践与反思", en: "Practice & reflection", type: "hub", domain: "general", x: 735, y: 602, prereqs: ["validation"], desc: "让失败与差异暴露知识缺口，再回到概念、假设和试验设计，形成非直线的自主建构学习循环。", question: "这次失败推翻的是某个参数、一个假设，还是整个模型？", mistake: "只记录做了什么，不记录判断如何改变。", refs: [["blueprint", 12], ["ie", 34]] }
  ],
  transfers: [["bottleneck", "roofline"], ["bottleneck", "control"], ["optimization", "planning"], ["interfaces", "parallel"], ["experimental", "representation"]],
  projects: [
    {
      id: "fish", number: "01", name: "让仿生金枪鱼真正游起来", short: "仿生金枪鱼", category: "机构 × 流体 × 控制",
      intro: "从电机转动到水下推进，用真实试验检验机构、柔性鱼尾与控制方案。",
      image: "fish.svg", goals: ["thrust", "linkage", "control", "validation", "reflection"], refs: [["fish", 3], ["fish", 7], ["fish", 8], ["fish", 9]],
      boundary: "项目报告记载已实现遥控直线游动，高频段约 0.3 m/s；可控转向尚未达成。教育蓝图第 14 页将转向写入教学推演，不能据此认定项目已实现。",
      deliverable: "一份记录频率、尾鳍条件、配重、航向与游速的可复查水池试验表。",
      cells: [
        { status: "recorded", title: "机构与推进链", evidence: "报告给出单电机—曲柄连杆—柔性鱼尾—直线运动的结构链。", solo: "画出转动到摆动的转换，并解释柔性尾鳍为何影响水下推进。", ai: "让 AI 比较两种尾鳍参数，指出其忽略水阻或变形的假设。", refs: [["fish", 3], ["fish", 4]] },
        { status: "proposed", title: "频率—游速模型", evidence: "报告有频率区间与速度概述，未提供完整可拟合的逐点数据表。", solo: "说明模型变量、单位与适用范围，不把相关性当作因果关系。", ai: "用 AI 辅助拟合后检查外推、样本量与误差，而不是直接采用曲线。", refs: [["fish", 8]] },
        { status: "recorded", title: "两轮水下迭代", evidence: "报告记录配重不足、硅胶包裹前半段与增加配重等迭代。", solo: "针对配重变化设计对照，区分姿态变化与尾鳍推进变化。", ai: "审查 AI 生成的试验计划，补齐控制变量与重复试验。", refs: [["fish", 7]] },
        { status: "proposed", title: "性能数据取证", evidence: "约 0.3 m/s 是报告中的概述，不构成带条件、误差与重复次数的完整数据集。", solo: "解释测速、体长归一化与误差来源。", ai: "用 AI 清洗测量记录，逐项核对异常值和单位。", refs: [["fish", 8], ["fish", 9]] },
        { status: "recorded", title: "机电软协同", evidence: "报告记载 ESP32、蓝牙遥控、电源与 CAN 电机控制链路。", solo: "说明每个模块的输入、输出与故障定位顺序。", ai: "审查控制代码的通信协议与异常处理，不只验证编译通过。", refs: [["fish", 6]] },
        { status: "proposed", title: "转向目标的边界", evidence: "项目第 9 页明确尚未达到转向目标；不能把教育蓝图的推演当作实测。", solo: "解释当前哪些成果有证据，哪些仍是目标，提出下一次验收标准。", ai: "要求 AI 核对相互冲突的材料，保留差异而非合并成成功叙事。", refs: [["fish", 9], ["blueprint", 14]] }
      ]
    },
    {
      id: "snake", number: "02", name: "让蛇形机械臂看见、规划并执行", short: "蛇形机器人", category: "视觉 × 规划 × 通信",
      intro: "把高自由度机械臂的视觉输入、运动规划和电控接口串成一条可验证的系统链。",
      image: "snake.svg", goals: ["perception", "planning", "control", "validation", "reflection"], refs: [["snake", 10], ["snake", 11], ["snake", 12], ["snake", 13], ["snake", 17]],
      boundary: "材料说明设计、定位和通信路线，也指出重力、空程、规划约束与视觉鲁棒性等挑战；不把面向在轨组装的愿景当成已完成空间环境验证。",
      deliverable: "一条包含目标坐标、规划构型、通信帧与执行反馈的带时间戳链路记录。",
      cells: [
        { status: "recorded", title: "感知到执行链", evidence: "报告描述 D405 RGB/深度、YOLO、目标锁定与深度融合定位。", solo: "区分二维目标框、相机坐标和机械臂执行所需的空间信息。", ai: "审查 AI 给出的视觉方案，查出遗漏的标定与坐标转换。", refs: [["snake", 11]] },
        { status: "recorded", title: "高维搜索与约束", evidence: "报告讨论维数灾难、引导式采样与目标价值函数。", solo: "解释自由度优势与搜索代价的冲突，列举硬约束。", ai: "让 AI 比较规划方案，检查代价函数与真实电机约束是否一致。", refs: [["snake", 12]] },
        { status: "proposed", title: "物理条件对照", evidence: "报告提出重力与电机空程挑战，以及未来用气浮台卸载重力的设想。", solo: "说明地面实验与空间工况的差异，以及对结论的限制。", ai: "审查 AI 生成的验证方案，补充故障注入和负载条件。", refs: [["snake", 17]] },
        { status: "proposed", title: "定位误差与鲁棒性", evidence: "报告描述技术路线，但所读材料未给出完整量化定位误差与成功率表。", solo: "设计遮挡、光照与目标深度的分组评测。", ai: "用 AI 汇总试验记录，核对误差统计是否覆盖失败样本。", refs: [["snake", 11], ["snake", 17]] },
        { status: "recorded", title: "跨模块通信", evidence: "视觉与算法用 JSON 文件桥；算法到电控用长连接 TCP 与 Python 转换。", solo: "描述帧格式、时序和数据失效后的安全策略。", ai: "检查 AI 生成的接口代码是否处理过期帧与单位错误。", refs: [["snake", 13]] },
        { status: "proposed", title: "愿景与可验证成果", evidence: "在轨组装是项目背景，报告仍列出真实物理条件与自主抓取方面的挑战。", solo: "不夸大部署成熟度，定义下一阶段可观察的成功标准。", ai: "要求 AI 对技术愿景、地面演示和实测数据分栏陈述。", refs: [["snake", 4], ["snake", 17]] }
      ]
    },
    {
      id: "llm", number: "03", name: "让大模型既能跑，也用得起", short: "大模型系统", category: "学习目标 × 资源 × 服务",
      intro: "从训练正确性出发，理解算力、显存、缓存和调度如何共同约束有效服务。",
      image: "framework.svg", goals: ["probability", "scaling", "roofline", "parallel", "batching", "validation", "dual"], refs: [["ml1", "二、三"], ["ml3", "二、六、九"]],
      boundary: "这是依据课程整理稿设计的学习任务，不是已完成的实验报告。性能、成本与模型规模的数字不能脱离硬件、精度、负载和测量条件比较。",
      deliverable: "一份固定模型与质量目标、同时报告吞吐、延迟分布和显存的可复现实验记录。",
      cells: [
        { status: "recorded", title: "学习目标与计算结构", evidence: "整理文章解释语言建模目标、Transformer 模块与内部机制的区别。", solo: "区分优化目标、行为能力与机制解释，并说明交叉熵的条件。", ai: "检查 AI 对模型原理的解释，指出将比喻写成定理的地方。", refs: [["ml2", "一、二、三"]] },
        { status: "proposed", title: "固定预算的规模实验", evidence: "录音中的作业要求研究约 0.2B 模型与 scaling laws；材料不是作业完成证明。", solo: "解释参数量与 token 数的取舍，以及粗略预算模型的局限。", ai: "让 AI 辅助实验脚本后，独立检查预算、验证集和拟合可比性。", refs: [["ml1", "二、三"]] },
        { status: "proposed", title: "系统性能对照", evidence: "课程给出 Roofline、并行和推理优化框架，网页未实际运行 GPU 基准。", solo: "固定输入输出长度、并发与精度，提出可复现对照。", ai: "审查 AI 的测速脚本，确认同步、预热与采样口径。", refs: [["ml3", "二、十"]] },
        { status: "proposed", title: "吞吐与延迟分布", evidence: "整理文章要求区分 TTFT、TPOT、系统 TPS 与 goodput。", solo: "解释为什么总 TPS 上升不必然改善用户体验。", ai: "用 AI 分析日志，并检查是否遗漏排队与尾延迟。", refs: [["ml3", "九 · 9.1"]] },
        { status: "recorded", title: "缓存、通信与调度", evidence: "文章从并行切分、KV cache 与连续批处理解释系统层权衡。", solo: "指出缓存、显存、通信与调度的不同责任边界。", ai: "让 AI 建议优化后，检查它优化的是当前瓶颈还是局部指标。", refs: [["ml3", "六、七、九"]] },
        { status: "proposed", title: "可解释与可扩展", evidence: "课程强调 AI 辅助披露和规模扩大后验证；没有学生能力评分数据。", solo: "独立解释实现，说明未测过的规模和不能推广的结论。", ai: "保留 AI 修改记录，以实测反驳不成立的优化建议。", refs: [["ml1", "七、八"], ["blueprint", 11]] }
      ]
    }
  ],
  capabilities: [
    { name: "机制理解", en: "MECHANISM", desc: "解释为什么发生" },
    { name: "计算建模", en: "MODELING", desc: "说明变量与约束" },
    { name: "试验设计", en: "EXPERIMENT", desc: "建立对照与复现" },
    { name: "数据证据", en: "EVIDENCE", desc: "检查测量与误差" },
    { name: "系统集成", en: "SYSTEM", desc: "检查接口与连锁影响" },
    { name: "判断与反思", en: "JUDGMENT", desc: "识别边界并对结果负责" }
  ]
};
