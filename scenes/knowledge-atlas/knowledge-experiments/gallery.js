(() => {
  "use strict";
  const D = window.KNOWLEDGE;
  const $ = (s, root = document) => root.querySelector(s);
  const nodes = Object.fromEntries(D.nodes.map(n => [n.id, n]));
  const domainKeys = ["general", "robot", "ml", "system"];
  const palette = { general: "#91b8e4", robot: "#e8ae76", ml: "#83c9b0", system: "#b9a2d8" };
  const typeNames = { base: "通识底座", threshold: "门槛知识", hub: "纽结知识", transfer: "同构知识" };
  const exhibit = {
    cosmos: {
      name: "3D 知识星团", short: "知识星团", kind: "3D", icon: "orbit",
      title: "走进知识的纵深。",
      desc: "旋转四个领域的知识星团，沿着先修与跨域连接，发现平面目录看不见的相遇。",
      suitable: "适合开放探索与发现跨学科连接",
      caution: "空间是布局，不是测量。",
      caption: "拖动旋转 · 滚轮缩放 · 点击星点查看知识 · 焦点在画布时可用方向键旋转，+ / − 缩放",
      rule: "四种颜色对应四个知识领域。实线与箭头表示先修 → 后续知识，虚线表示跨域关联。节点在真实三维坐标中投影，近大远小；分组位置与距离由布局确定，不表示难度或相似度。",
      why: "先看整个知识网络，再聚焦一个概念的邻居。三维让跨域连线有了纵深，但精确查找仍由下方列表承接。"
    },
    city: {
      name: "3D 知识城", short: "知识城", kind: "3D", icon: "city",
      title: "把知识结构，建成一座城。",
      desc: "学科是街区，概念是建筑。转动视角，看先修基础如何支撑更高层的系统理解。",
      suitable: "适合看领域分布与依赖层级",
      caution: "高度不是能力评分。",
      caption: "拖动环视 · 滚轮缩放 · 点击建筑查看知识 · 重置视角回到总览",
      rule: "四个街区对应四个领域。每座建筑代表一个知识点；高度编码“最长先修链的边数 + 1”，每层等高。位置用于避免重叠，体积与地价没有数据含义。选中建筑会显示相邻关系。",
      why: "建筑高度使“这个概念站在哪些基础上”变成可感知的结构。它不是知识重要性排名，更不是学习者的完成情况。"
    },
    metro: {
      name: "学习地铁图", short: "学习地铁", kind: "路线", icon: "metro",
      title: "换乘一次，进入另一个问题。",
      desc: "金枪鱼、蛇形机器人与大模型各是一条线路，用关键站点看见不同学习目标之间的换乘。",
      suitable: "适合目标驱动与跨项目学习",
      caution: "线路是建议顺序。",
      caption: "选择线路高亮目标 · 点击站点打开知识 · 终点任务保留原始材料的成果边界",
      rule: "为了可读性，线路只展示人工挑选的关键知识站，不是完整先修图或可执行课表；共用站点只画一次，供项目间换乘。选择项目后，下方知识列表保留其全部目标与递归先修。相邻站不表示直接先修，站点间距不表示学习时间。",
      why: "比一条学习清单更擅长表达“不同任务可以共用哪些基础”。换乘点让先学一个项目、再迁移到另一个项目的策略直观可见。"
    },
    radial: {
      name: "径向知识轮", short: "知识轮", kind: "层级", icon: "radial",
      title: "从一个圆心，读懂全貌。",
      desc: "由内向外阅读领域、概念与知识类型，用一圈结构替代不断展开的目录。",
      suitable: "适合分类总览、查漏与局部聚焦",
      caution: "扇区大小只编码条目数。",
      caption: "点击内圈筛选领域 · 点击外圈选择知识 · 圆心返回全部",
      rule: "内圈按各领域节点数量分配角度，外圈每个知识点等角。外沿色条表示通识、门槛、纽结、同构四类知识。不表示熟练度、重要性或学分。",
      why: "轮形强调“整体—局部”的包含关系。它比自由关系图更适合看分类边界，但不承担展示所有先修关系的任务。"
    },
    river: {
      name: "跨域知识流", short: "知识流", kind: "流向", icon: "river",
      title: "知识在哪些任务里汇合？",
      desc: "从领域出发，经过知识类型，流向三个真实任务；看共同基础如何被不同项目反复调用。",
      suitable: "适合看知识复用与项目支撑",
      caution: "流量是映射计数，不是行为日志。",
      caption: "选择项目查看完整支撑流 · 点击领域或知识类型查看组成 · 右侧可逐项回查知识",
      rule: "对每个项目递归收集先修与目标节点，并在项目内去重。每个“知识点—项目”组合计 1 单位，因此共用知识可在不同项目重复计数。左右两段按同一组映射计数，保证守恒；带宽不代表时间、资金或学生人数。",
      why: "比分类目录更适合解释“为什么这个项目需要跨学科”。流图揭示支撑结构和复用，不假装在展示真实学习行为。"
    },
    lab: {
      name: "机制实验台", short: "机制实验台", kind: "实验", icon: "lab",
      title: "动一个参数，看系统怎样回答。",
      desc: "把“瓶颈限制系统能力”变成可操作的模型：先预测，再调参，最后检查直觉是否成立。",
      suitable: "适合机制教学、预测与反例",
      caution: "理想化教学模型，非项目实测。",
      caption: "调节三个串行环节的容量 · 单步观察单位通过 · 对比优化前后 · 无自动播放",
      rule: "假设连续流体、稳态串行、无限缓冲、无损耗且服务率恒定。到达率固定为 12 单位/秒；系统有效速率 R=min(12, C₁, C₂, C₃)。每次单步用 Δt=1 秒的分段守恒计算，图中储量可暂存于缓冲，不是离散事件或真实生产线仿真。",
      why: "静态图擅长解释“有什么”，可操纵的模型擅长解释“为什么”。它能制造一个反例：只加速非瓶颈环节，系统吞吐可能完全不变。"
    }
  };
  const startView = new URLSearchParams(location.search).get("view");
  const S = {
    view: exhibit[startView] ? startView : "cosmos", node: "bottleneck", domain: "all",
    project: "all", category: "all", arrangement: "clusters", neighbors: false,
    yaw: -.38, pitch: .30, zoom: 1, auto: false, labels: true,
    query: "", capacities: [8, 4, 10], baseline: [8, 4, 10],
    ticks: 0, stock: [0, 0, 0], output: 0
  };
  let canvas = null, ctx = null, hitAreas = [], drag = null, frame = 0, lastFrame = 0, stageObserver = null, inView = true;
  const esc = text => String(text).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const depthCache = {};
  function depth(id) {
    if (depthCache[id] !== undefined) return depthCache[id];
    return depthCache[id] = nodes[id].prereqs.length ? Math.max(...nodes[id].prereqs.map(depth)) + 1 : 0;
  }
  function projectPath(p) {
    const seen = new Set(), ordered = [];
    function visit(id) {
      if (seen.has(id)) return;
      seen.add(id);
      nodes[id].prereqs.forEach(visit);
      ordered.push(id);
    }
    p.goals.forEach(visit);
    return ordered;
  }
  const paths = Object.fromEntries(D.projects.map(p => [p.id, projectPath(p)]));
  const mappings = D.projects.flatMap(p => paths[p.id].map(id => ({ node: nodes[id], project: p.id })));
  const projectColors = { fish: "#be6c36", snake: "#567ab4", llm: "#49856b" };
  function svgIcon(name) {
    const paths = {
      orbit: '<ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(-35 12 12)"/><circle cx="12" cy="12" r="6"/><circle cx="17" cy="6" r="1.5" fill="currentColor"/>',
      city: '<path d="M3 21V10l5-3 5 3v11m0-14 4-3 4 3v14M8 7V3M1 21h22M6 12v2m4-2v2m7-5v2m0 4v2"/>',
      metro: '<path d="M3 4h6l6 8h6M3 20h6L18 4h3"/><circle cx="12" cy="13" r="3" fill="var(--bg)"/>',
      radial: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M12 3v5m4 4h5m-6 3 4 4M8 12H3"/>',
      river: '<path d="M2 5c10 0 10 5 20 5M2 12h20M2 19c10 0 10-5 20-5"/>',
      lab: '<path d="M8 3h8m-6 0v6L4 19c-.5 1 .2 2 1.4 2h13.2c1.2 0 1.9-1 1.4-2L14 9V3M7 15h10"/><circle cx="11" cy="17" r=".7"/>'
    };
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]}</svg>`;
  }
  function sourceURL(key, page) {
    const url = new URL("sources.html", location.href);
    url.hash = key;
    return url.href;
  }
  function sourceLinks(refs) {
    return `<div class="source-links">${refs.map(([key, page]) => `<a href="${sourceURL(key, page)}" target="_blank" rel="noopener"><span>${D.sources[key].title}<small>${typeof page === "number" ? `第 ${page} 页` : `章节 ${page}`}</small></span><span aria-hidden="true">↗</span></a>`).join("")}</div>`;
  }
  function pill(id) {
    return `<button class="node-pill ${S.node === id ? "selected" : ""}" data-node="${id}"><i style="background:${palette[nodes[id].domain]}"></i>${nodes[id].name}</button>`;
  }
  function announce(text) { $("#announcement").textContent = text; }
  function allDomainButtons() {
    return `<div class="segmented" aria-label="领域筛选"><button data-domain="all" aria-pressed="${S.domain === "all"}">全部</button>${domainKeys.map(id => `<button data-domain="${id}" aria-pressed="${S.domain === id}"><i style="background:${palette[id]}"></i>${D.domains[id]}</button>`).join("")}</div>`;
  }
  function projectButtons() {
    return `<div class="segmented" aria-label="项目筛选"><button data-project="all" aria-pressed="${S.project === "all"}">全部项目</button>${D.projects.map(p => `<button data-project="${p.id}" aria-pressed="${S.project === p.id}"><i style="background:${projectColors[p.id]}"></i>${p.short}</button>`).join("")}</div>`;
  }
  function render() {
    stopAnimation();
    drag = null;
    if (stageObserver) stageObserver.disconnect();
    document.body.dataset.view = S.view;
    const v = exhibit[S.view];
    $("#exhibit-nav").innerHTML = Object.entries(exhibit).map(([id, item]) => `<button data-view="${id}" aria-current="${S.view === id ? "page" : "false"}">${svgIcon(item.icon)}<span>${item.short}</span><small>${item.kind}</small></button>`).join("");
    $("#exhibit-title").textContent = v.title;
    $("#exhibit-description").textContent = v.desc;
    $("#view-facts").innerHTML = `<span>${v.suitable}</span><b>${v.caution}</b>`;
    $("#stage-caption").innerHTML = `<span>${v.caption}</span><a href="#inspector">查看所选知识详情</a>`;
    $("#reading-guide").innerHTML = `<div><h2>怎样阅读这张图</h2><p>${v.rule}</p></div><div><h2>为什么试这一种</h2><p>${v.why}</p></div>`;
    $("#toolbar").innerHTML = toolbar();
    const stage = $("#stage");
    stage.className = `stage ${["cosmos", "city"].includes(S.view) ? "spatial-stage" : S.view + "-stage"}`;
    canvas = null; ctx = null; hitAreas = [];
    if (["cosmos", "city"].includes(S.view)) {
      stage.innerHTML = `<canvas id="space-canvas" tabindex="0" role="img" aria-label="${v.name}，可拖动旋转、滚轮缩放、方向键旋转。点击节点或用下方知识列表选择。"></canvas><div class="spatial-heading"><span>${S.view === "cosmos" ? "知识有深度，也有连接。" : "先修是地基，理解有层次。"}</span><small>${S.view === "cosmos" ? "24 个概念 · 四个领域 · 三维透视投影" : "24 座建筑 · 四个街区 · 高度编码先修层级"}</small></div><div class="space-controls"><button data-camera="left" aria-label="向左旋转">${arrowIcon(-1)}</button><button data-camera="right" aria-label="向右旋转">${arrowIcon(1)}</button><button data-camera="out" aria-label="缩小">−</button><output id="zoom-value">${Math.round(S.zoom * 100)}%</output><button data-camera="in" aria-label="放大">+</button><button data-camera="reset">重置视角</button></div><div id="space-tooltip" class="space-tooltip" hidden></div><div class="spatial-readout" id="spatial-readout"></div>`;
      initSpace();
    } else if (S.view === "metro") drawMetro();
    else if (S.view === "radial") drawRadial();
    else if (S.view === "river") drawRiver();
    else renderLab();
    renderInspector();
    renderIndex();
  }
  function toolbar() {
    if (["cosmos", "city"].includes(S.view)) {
      return `${allDomainButtons()}<div class="tool-group">${S.view === "cosmos" ? `<label>布局<select id="arrangement"><option value="clusters" ${S.arrangement === "clusters" ? "selected" : ""}>领域星团</option><option value="sphere" ${S.arrangement === "sphere" ? "selected" : ""}>球形网络</option></select></label>` : ""}<label><input id="neighbors" type="checkbox" ${S.neighbors ? "checked" : ""}>仅突出相邻</label><label><input id="labels" type="checkbox" ${S.labels ? "checked" : ""}>标签</label><button data-auto aria-pressed="${S.auto}">${S.auto ? "暂停环视" : "自动环视"}</button></div>`;
    }
    if (S.view === "metro" || S.view === "river") return projectButtons();
    if (S.view === "radial") return allDomainButtons();
    return `<div class="segmented" aria-label="教学场景"><button data-scenario="factory" aria-pressed="${scenario === "factory"}">生产线类比</button><button data-scenario="serving" aria-pressed="${scenario === "serving"}">模型服务类比</button></div><span class="toolbar-note">同一串行容量模型，仅替换语境；不是硬件基准。</span>`;
  }
  function arrowIcon(direction) {
    return `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="${direction < 0 ? "M16 10H4m5-5-5 5 5 5" : "M4 10h12m-5-5 5 5-5 5"}"/></svg>`;
  }
  function setView(view) {
    if (!exhibit[view]) return;
    S.view = view; S.auto = false; S.domain = "all"; S.category = "all"; S.project = "all";
    S.yaw = view === "city" ? -.55 : -.38; S.pitch = view === "city" ? .62 : .30; S.zoom = 1;
    const url = new URL(location.href);
    url.searchParams.set("view", view);
    history.replaceState(null, "", url);
    render();
    announce(`已切换到${exhibit[view].name}`);
  }
  function renderInspector() {
    const n = nodes[S.node], next = D.nodes.filter(x => x.prereqs.includes(n.id));
    const transfers = D.transfers.filter(pair => pair.includes(n.id)).map(pair => pair.find(id => id !== n.id));
    const project = D.projects.find(p => p.id === S.project);
    const contextual = S.view === "river" ? `<div class="context-box"><h3>当前知识流</h3><p>${project ? project.short : "全部项目"} · ${S.category === "all" ? "全部知识类型" : typeNames[S.category]} · ${filteredMappings().length} 组知识—项目映射。</p></div>` : S.view === "city" ? `<div class="height-key"><b>${depth(n.id) + 1}</b><span>先修层级<br><small>最长先修链 ${depth(n.id)} 条边 + 1</small></span></div>` : "";
    $("#inspector").innerHTML = `<div class="inspector-heading"><span>选中的知识</span><span class="type-mark">${typeNames[n.type]}</span></div><div class="domain-label"><i style="background:${palette[n.domain]}"></i>${D.domains[n.domain]}</div><h2>${n.name}</h2><p class="english-name">${n.en}</p>${contextual}<p class="node-description">${n.desc}</p><div class="question"><h3>不看答案，试着解释</h3><p>${n.question}</p></div>
      <section class="relations"><h3>先修知识 <small>${n.prereqs.length}</small></h3><div>${n.prereqs.length ? n.prereqs.map(pill).join("") : '<span class="empty-note">这是本图中的基础节点。</span>'}</div></section>
      ${next.length ? `<section class="relations"><h3>它支撑的知识 <small>${next.length}</small></h3><div>${next.map(x => pill(x.id)).join("")}</div></section>` : ""}
      ${transfers.length ? `<section class="relations"><h3>跨域关联</h3><div>${transfers.map(pill).join("")}</div></section>` : ""}
      <details class="misconception"><summary>容易误解的地方</summary><p>${n.mistake}</p></details><section class="node-sources"><h3>回到材料</h3>${sourceLinks(n.refs)}</section>
      ${project ? `<div class="project-boundary"><h3>${project.short} · 成果边界</h3><p>${project.boundary}</p></div>` : ""}`;
  }
  function renderIndex() {
    const q = S.query.toLowerCase().trim();
    const filtered = D.nodes.filter(n => (S.domain === "all" || n.domain === S.domain) && (S.category === "all" || S.view !== "river" || n.type === S.category) && (S.project === "all" || !["metro", "river"].includes(S.view) || paths[S.project].includes(n.id)) && (!q || [n.name, n.en, n.desc].join(" ").toLowerCase().includes(q)));
    $("#node-index").innerHTML = filtered.map(n => pill(n.id)).join("");
    $("#index-empty").hidden = filtered.length !== 0;
  }
  function selectNode(id) {
    if (!nodes[id]) return;
    const focused = document.activeElement.closest("[data-node]");
    const focusRegion = focused?.closest("#node-index") ? "#node-index" : focused?.closest("#stage") ? "#stage" : null;
    S.node = id;
    renderInspector(); renderIndex();
    if (canvas) drawSpace();
    else if (S.view === "metro") drawMetro();
    else if (S.view === "radial") drawRadial();
    if (focusRegion) $(`${focusRegion} [data-node="${id}"]`)?.focus({ preventScroll: true });
    announce(`选中${nodes[id].name}，${typeNames[nodes[id].type]}`);
  }
  function neighborIds() {
    const set = new Set([S.node, ...nodes[S.node].prereqs]);
    D.nodes.forEach(n => { if (n.prereqs.includes(S.node)) set.add(n.id); });
    D.transfers.forEach(([a, b]) => { if (a === S.node) set.add(b); if (b === S.node) set.add(a); });
    return set;
  }
  function spacePositions() {
    if (S.view === "city") {
      const positions = {};
      const centers = [[-195, -170], [155, -170], [-195, 175], [155, 175]];
      domainKeys.forEach((key, di) => {
        D.nodes.filter(n => n.domain === key).forEach((n, i) => {
          positions[n.id] = { x: centers[di][0] + (i % 3 - 1) * 86, y: 0, z: centers[di][1] + (Math.floor(i / 3) - .7) * 88, h: (depth(n.id) + 1) * 36 };
        });
      });
      return positions;
    }
    if (S.arrangement === "sphere") {
      return Object.fromEntries(D.nodes.map((n, i) => {
        const yy = 1 - (i + .5) * 2 / D.nodes.length, angle = i * Math.PI * (3 - Math.sqrt(5)), r = Math.sqrt(1 - yy * yy);
        return [n.id, { x: r * Math.cos(angle) * 340, y: yy * 290, z: r * Math.sin(angle) * 340 }];
      }));
    }
    const centers = [[-235, 140, -90], [210, 135, 80], [-140, -155, 145], [230, -125, -145]];
    const positions = {};
    domainKeys.forEach((key, di) => {
      const group = D.nodes.filter(n => n.domain === key);
      group.forEach((n, i) => {
        const t = i * 2.39996, yy = 1 - (i + .5) * 2 / group.length;
        const r = Math.sqrt(1 - yy * yy);
        positions[n.id] = { x: centers[di][0] + Math.cos(t) * r * 140, y: centers[di][1] + yy * 115, z: centers[di][2] + Math.sin(t) * r * 145 };
      });
    });
    return positions;
  }
  function project3D(p) {
    const cy = Math.cos(S.yaw), sy = Math.sin(S.yaw), cp = Math.cos(S.pitch), sp = Math.sin(S.pitch);
    const x = p.x * cy - p.z * sy, z1 = p.x * sy + p.z * cy;
    const y = p.y * cp - z1 * sp, z = p.y * sp + z1 * cp;
    const width = canvas.clientWidth, height = canvas.clientHeight;
    const unit = Math.min(width / 1050, height / 790) * S.zoom;
    const perspective = 1250 / (1250 + z);
    return { x: width / 2 + x * perspective * unit, y: height / 2 + (S.view === "city" ? height * .13 : 10) - y * perspective * unit, z, k: perspective * unit };
  }
  function path2D(points, fill, stroke, lineWidth = 1) {
    ctx.beginPath(); points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth; ctx.stroke(); }
  }
  function shade(hex, factor) {
    const parts = hex.slice(1).match(/../g).map(x => Math.round(parseInt(x, 16) * factor));
    return `rgb(${parts.join(",")})`;
  }
  function drawSpace() {
    if (!ctx || !canvas.isConnected) return;
    const width = canvas.clientWidth, height = canvas.clientHeight;
    const ratio = Math.min(devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
      canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    }
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    hitAreas = [];
    const positions = spacePositions(), near = neighborIds();
    if (S.view === "cosmos") drawCosmos(positions, near, width, height);
    else drawCity(positions, near);
    $("#spatial-readout").textContent = `水平 ${Math.round(S.yaw * 180 / Math.PI)}° / 俯仰 ${Math.round(S.pitch * 180 / Math.PI)}° · ${S.domain === "all" ? "全部领域" : D.domains[S.domain]} · ${S.auto ? "自动环视中" : "手动视角"}`;
    $("#zoom-value").textContent = `${Math.round(S.zoom * 100)}%`;
  }
  function edge3D(a, b, color, dashed, selected, arrow) {
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = color; ctx.lineWidth = selected ? 1.7 : .7;
    ctx.setLineDash(dashed ? [4, 5] : []); ctx.stroke(); ctx.setLineDash([]);
    if (arrow && selected) {
      const t = .72, x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t;
      const theta = Math.atan2(b.y - a.y, b.x - a.x);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - Math.cos(theta - .45) * 8, y - Math.sin(theta - .45) * 8); ctx.moveTo(x, y); ctx.lineTo(x - Math.cos(theta + .45) * 8, y - Math.sin(theta + .45) * 8); ctx.stroke();
    }
  }
  function drawCosmos(positions, near, w, h) {
    ctx.fillStyle = "#b7d2df";
    for (let i = 0; i < 95; i++) {
      const x = ((i * 193.43 + 83) % 991) / 991 * w, y = ((i * 78.17 + 17) % 607) / 607 * h;
      ctx.globalAlpha = .12 + i % 4 * .04;
      ctx.beginPath(); ctx.arc(x, y, i % 7 === 0 ? 1 : .55, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    const projected = Object.fromEntries(D.nodes.map(n => [n.id, project3D(positions[n.id])]));
    const rings = [0, 1, 2].map(j => Array.from({ length: 97 }, (_, i) => {
      const angle = i / 96 * Math.PI * 2;
      return project3D({ x: Math.cos(angle) * (410 + j * 36), y: -300 + j * 24, z: Math.sin(angle) * (410 + j * 36) });
    }));
    rings.forEach(points => path2D(points, null, "#263845", .6));
    D.nodes.forEach(n => n.prereqs.forEach(id => {
      const chosen = n.id === S.node || id === S.node;
      const active = (S.domain === "all" || n.domain === S.domain || nodes[id].domain === S.domain) && (!S.neighbors || chosen);
      edge3D(projected[id], projected[n.id], chosen ? "#c4decb" : active ? "#45657770" : "#33435325", false, chosen, true);
    }));
    D.transfers.forEach(([a, b]) => edge3D(projected[a], projected[b], a === S.node || b === S.node ? "#c2a8e0" : "#887ba544", true, a === S.node || b === S.node, false));
    const sorted = D.nodes.toSorted((a, b) => projected[b.id].z - projected[a.id].z);
    const labels = [];
    sorted.forEach(n => {
      const p = projected[n.id], selected = n.id === S.node;
      const match = (S.domain === "all" || S.domain === n.domain) && (!S.neighbors || near.has(n.id));
      const r = Math.max(4, Math.min(12, 9.5 * p.k)) + (selected ? 3 : 0);
      ctx.globalAlpha = match ? Math.max(.55, Math.min(1, 1 - p.z / 1200)) : .12;
      if (selected) {
        ctx.beginPath(); ctx.arc(p.x, p.y, r + 7, 0, Math.PI * 2); ctx.strokeStyle = "#d9e3be"; ctx.lineWidth = 1; ctx.stroke();
        ctx.beginPath(); ctx.arc(p.x, p.y, r + 12, 0, Math.PI * 2); ctx.strokeStyle = "#d9e3be35"; ctx.stroke();
      }
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fillStyle = palette[n.domain]; ctx.fill();
      ctx.beginPath(); ctx.arc(p.x - r * .27, p.y - r * .28, r * .37, 0, Math.PI * 2); ctx.fillStyle = "#ffffff65"; ctx.fill();
      if ((S.labels && match && (canvas.clientWidth >= 600 || near.has(n.id))) || selected) labels.push({ n, x: p.x + r + 10, y: p.y + 4, anchor: p, selected });
      hitAreas.push({ id: n.id, x: p.x, y: p.y, w: Math.max(24, r * 3), h: Math.max(24, r * 3) });
      ctx.globalAlpha = 1;
    });
    drawLabels(labels);
  }
  function drawLabels(labels) {
    const occupied = [];
    labels.toSorted((a, b) => Number(b.selected) - Number(a.selected)).forEach(item => {
      ctx.font = `${item.selected ? "600" : "400"} ${item.selected ? 13 : 11}px "Microsoft YaHei",sans-serif`;
      const width = ctx.measureText(item.n.name).width + 8;
      const x = Math.max(12, Math.min(canvas.clientWidth - width - 12, item.x));
      const candidates = [0, -20, 20, -40, 40, -60, 60, -80, 80].map(offset => ({ x, y: Math.max(100, Math.min(canvas.clientHeight - 92, item.y + offset)), w: width, h: 18 }));
      const box = candidates.find(b => !occupied.some(o => b.x < o.x + o.w && b.x + b.w > o.x && b.y - 14 < o.y + 5 && b.y + 5 > o.y - 14)) || candidates[0];
      occupied.push(box);
      if (Math.abs(box.y - item.y) > 5 || Math.abs(box.x - item.x) > 5) edge3D(item.anchor, { x: box.x, y: box.y - 4 }, palette[item.n.domain] + "70", false, false, false);
      ctx.lineWidth = 4; ctx.strokeStyle = S.view === "city" ? "#12292c" : "#101b27"; ctx.strokeText(item.n.name, box.x + 3, box.y);
      ctx.fillStyle = item.selected ? "#fff0bc" : palette[item.n.domain]; ctx.fillText(item.n.name, box.x + 3, box.y);
      hitAreas.push({ id: item.n.id, x: box.x + box.w / 2, y: box.y - 5, w: box.w, h: 20 });
    });
  }
  function drawCity(positions, near) {
    const corners = [[-400, -325], [375, -325], [375, 370], [-400, 370]].map(([x, z]) => project3D({ x, y: -2, z }));
    path2D(corners, "#152b30", "#365457");
    for (let i = -4; i <= 4; i++) {
      const a = project3D({ x: i * 90, y: 0, z: -325 }), b = project3D({ x: i * 90, y: 0, z: 370 });
      edge3D(a, b, "#34505360", false, false, false);
      const c = project3D({ x: -400, y: 0, z: i * 80 }), d = project3D({ x: 375, y: 0, z: i * 80 });
      edge3D(c, d, "#34505360", false, false, false);
    }
    domainKeys.forEach((key, di) => {
      const center = [[-195, -170], [155, -170], [-195, 175], [155, 175]][di];
      const p = project3D({ x: center[0], y: 1, z: center[1] + 175 });
      ctx.font = '12px "Microsoft YaHei",sans-serif'; ctx.textAlign = "center"; ctx.fillStyle = palette[key]; ctx.fillText(D.domains[key], p.x, p.y); ctx.textAlign = "left";
    });
    const sorted = D.nodes.toSorted((a, b) => project3D(positions[b.id]).z - project3D(positions[a.id]).z);
    const labels = [];
    sorted.forEach(n => {
      const p = positions[n.id], r = 28, selected = n.id === S.node, color = palette[n.domain];
      const visible = (S.domain === "all" || S.domain === n.domain) && (!S.neighbors || near.has(n.id));
      ctx.globalAlpha = visible ? 1 : .15;
      const base = [[-r, -r], [r, -r], [r, r], [-r, r]].map(([x, z]) => project3D({ x: p.x + x, y: 1, z: p.z + z }));
      const top = [[-r, -r], [r, -r], [r, r], [-r, r]].map(([x, z]) => project3D({ x: p.x + x, y: p.h, z: p.z + z }));
      const faces = base.map((_, i) => ({ i, z: (base[i].z + base[(i + 1) % 4].z) / 2 })).toSorted((a, b) => b.z - a.z);
      faces.forEach(({ i }) => {
        const j = (i + 1) % 4;
        path2D([base[i], base[j], top[j], top[i]], shade(color, i % 2 ? .40 : .56), shade(color, .64), .7);
        for (let floor = 1; floor <= depth(n.id); floor++) {
          const a = project3D({ x: p.x + (i === 0 || i === 3 ? -r : r), y: floor * 36, z: p.z + (i < 2 ? -r : r) });
          const b = project3D({ x: p.x + (j === 0 || j === 3 ? -r : r), y: floor * 36, z: p.z + (j < 2 ? -r : r) });
          edge3D(a, b, shade(color, .75), false, false, false);
        }
      });
      path2D(top, shade(color, selected ? 1 : .83), selected ? "#fff3c9" : shade(color, 1.1), selected ? 2 : 1);
      const center = project3D({ x: p.x, y: p.h, z: p.z });
      ctx.font = '11px "Segoe UI",sans-serif'; ctx.textAlign = "center"; ctx.fillStyle = "#172d30"; ctx.fillText(String(depth(n.id) + 1), center.x, center.y + 3); ctx.textAlign = "left";
      const xs = [...base, ...top].map(v => v.x), ys = [...base, ...top].map(v => v.y);
      hitAreas.push({ id: n.id, x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2, w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) });
      if ((S.labels && visible && (canvas.clientWidth >= 600 || near.has(n.id))) || selected) labels.push({ n, x: center.x - 25, y: center.y - 18, anchor: center, selected });
      ctx.globalAlpha = 1;
    });
    const selected = positions[S.node], from = project3D({ x: selected.x, y: selected.h + 12, z: selected.z });
    D.nodes.forEach(n => n.prereqs.forEach(id => {
      if (n.id === S.node || id === S.node) {
        const p = positions[id], q = positions[n.id];
        edge3D(project3D({ x: p.x, y: p.h + 12, z: p.z }), project3D({ x: q.x, y: q.h + 12, z: q.z }), "#e0e6b8", false, true, true);
      }
    }));
    drawLabels(labels);
    ctx.beginPath(); ctx.arc(from.x, from.y - 15, 5, 0, Math.PI * 2); ctx.strokeStyle = "#f4e3a8"; ctx.stroke();
  }
  function initSpace() {
    canvas = $("#space-canvas"); ctx = canvas.getContext("2d");
    if (!ctx) {
      $("#stage").innerHTML = '<div class="canvas-error"><h2>浏览器无法创建画布。</h2><p>请换用 Edge 或 Chrome，或使用下方知识列表继续阅读。</p></div>';
      canvas = null; return;
    }
    canvas.addEventListener("pointerdown", event => {
      if (event.button !== 0) return;
      drag = { startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY, moved: false };
      canvas.setPointerCapture(event.pointerId); canvas.focus({ preventScroll: true });
    });
    canvas.addEventListener("pointermove", event => {
      if (drag) {
        if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 5) drag.moved = true;
        S.yaw += (event.clientX - drag.x) * .007;
        S.pitch = Math.max(-.9, Math.min(1.15, S.pitch + (event.clientY - drag.y) * .005));
        drag.x = event.clientX; drag.y = event.clientY;
        $("#space-tooltip").hidden = true; drawSpace();
      } else {
        const r = canvas.getBoundingClientRect(), hit = hitTest(event.clientX - r.left, event.clientY - r.top);
        canvas.style.cursor = hit ? "pointer" : "grab";
        const tooltip = $("#space-tooltip");
        tooltip.hidden = !hit;
        if (hit) { tooltip.textContent = nodes[hit.id].name; tooltip.style.left = `${Math.min(event.clientX - r.left + 12, r.width - 170)}px`; tooltip.style.top = `${event.clientY - r.top + 16}px`; }
      }
    });
    canvas.addEventListener("pointerup", event => {
      if (drag && !drag.moved) { const r = canvas.getBoundingClientRect(), hit = hitTest(event.clientX - r.left, event.clientY - r.top); if (hit) selectNode(hit.id); }
      drag = null;
    });
    canvas.addEventListener("pointercancel", () => { drag = null; });
    canvas.addEventListener("pointerleave", () => { $("#space-tooltip").hidden = true; });
    canvas.addEventListener("wheel", event => { event.preventDefault(); S.zoom = Math.max(.65, Math.min(1.8, S.zoom * Math.exp(-event.deltaY * .001))); drawSpace(); }, { passive: false });
    canvas.addEventListener("keydown", event => {
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "+", "=", "-", "0"].includes(event.key)) {
        event.preventDefault();
        if (event.key === "ArrowLeft") S.yaw -= .13;
        if (event.key === "ArrowRight") S.yaw += .13;
        if (event.key === "ArrowUp") S.pitch = Math.min(1.15, S.pitch + .1);
        if (event.key === "ArrowDown") S.pitch = Math.max(-.9, S.pitch - .1);
        if (["+", "="].includes(event.key)) S.zoom = Math.min(1.8, S.zoom + .1);
        if (event.key === "-") S.zoom = Math.max(.65, S.zoom - .1);
        if (event.key === "0") resetCamera();
        drawSpace();
      }
    });
    stageObserver = new IntersectionObserver(entries => {
      inView = entries[0].isIntersecting;
      if (inView && S.auto) startAnimation(); else stopAnimation();
    });
    stageObserver.observe(canvas);
    drawSpace();
    if (S.auto) startAnimation();
  }
  function hitTest(x, y) {
    return hitAreas.toReversed().find(a => Math.abs(x - a.x) <= a.w / 2 && Math.abs(y - a.y) <= a.h / 2);
  }
  function resetCamera() { S.yaw = S.view === "city" ? -.55 : -.38; S.pitch = S.view === "city" ? .62 : .30; S.zoom = 1; }
  function stopAnimation() { if (frame) cancelAnimationFrame(frame); frame = 0; lastFrame = 0; }
  function startAnimation() {
    if (frame || document.hidden || !canvas || !inView) return;
    function tick(time) {
      frame = 0;
      if (!S.auto || document.hidden || !canvas || !canvas.isConnected || !inView) return;
      if (lastFrame && !drag) S.yaw += Math.min(time - lastFrame, 50) * .00012;
      lastFrame = time; drawSpace(); frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
  }
  function svgButton(id, content, cls = "") {
    return `<g role="button" tabindex="0" data-node="${id}" class="svg-node ${cls} ${S.node === id ? "is-selected" : ""}" aria-label="${nodes[id].name}" aria-pressed="${S.node === id}">${content}</g>`;
  }
  function drawMetro() {
    const coords = {
      math: [90, 330], physics: [235, 145], thrust: [390, 145], linkage: [545, 145], control: [700, 145],
      ai: [235, 515], perception: [390, 330], optimization: [545, 330], planning: [700, 330],
      probability: [390, 515], transformer: [545, 515], kv: [700, 515], batching: [855, 515],
      validation: [855, 330], reflection: [1010, 330], dual: [1010, 515]
    };
    const routes = {
      fish: ["math", "physics", "thrust", "linkage", "control", "validation", "reflection"],
      snake: ["math", "ai", "perception", "optimization", "planning", "validation", "reflection"],
      llm: ["math", "ai", "probability", "transformer", "kv", "batching", "validation", "dual"]
    };
    const selectedPath = new Set(S.project === "all" ? Object.values(routes).flat() : routes[S.project]);
    const count = Object.values(routes).filter(ids => ids.includes(S.node)).length;
    $("#stage").innerHTML = `<div class="svg-scroll"><svg class="metro-map" viewBox="0 0 1110 700" role="group" aria-label="三个项目的关键学习站点与共用换乘站"><g class="metro-grid"><text x="60" y="58">关键站点示意 · 完整先修见下方知识列表</text><text x="60" y="97" fill="${projectColors.fish}">仿生金枪鱼 / 机构—流体—控制</text><text x="400" y="97" fill="${projectColors.snake}">蛇形机器人 / 感知—规划—执行</text><text x="760" y="97" fill="${projectColors.llm}">大模型 / 原理—缓存—调度</text></g>
      ${D.projects.map((p, pi) => {
        const offset = (pi - 1) * 7;
        const points = routes[p.id].map(id => ({ x: coords[id][0], y: coords[id][1] + offset }));
        const d = points.map((point, i) => i ? `L${point.x},${point.y}` : `M${point.x},${point.y}`).join(" ");
        return `<path d="${d}" fill="none" stroke="${projectColors[p.id]}" stroke-width="6" stroke-linejoin="round" stroke-linecap="round" opacity="${S.project === "all" || S.project === p.id ? .85 : .10}"/>`;
      }).join("")}
      ${D.nodes.filter(n => coords[n.id]).map(n => {
        const [x, y] = coords[n.id], uses = Object.values(routes).filter(ids => ids.includes(n.id)).length;
        const enabled = selectedPath.has(n.id);
        return svgButton(n.id, `<circle cx="${x}" cy="${y}" r="${uses > 1 ? 11 : 8}" fill="#f8f6ed" stroke="${S.node === n.id ? "#2e5144" : "#3e4e53"}" stroke-width="${S.node === n.id ? 4 : 2}"/>${uses > 1 ? `<circle cx="${x}" cy="${y}" r="3" fill="#3e4e53"/>` : ""}<text x="${x}" y="${y - 25}" text-anchor="middle">${n.name}</text>`, enabled ? "" : "dimmed");
      }).join("")}
      <g class="metro-key"><circle cx="70" cy="620" r="8" fill="#f8f6ed" stroke="#3e4e53" stroke-width="2"/><circle cx="70" cy="620" r="2.5" fill="#3e4e53"/><text x="88" y="625">多项目共用站</text><text x="350" y="625">${nodes[S.node].name} · ${count ? `被 ${count} 条关键线路使用` : "非关键站，详情仍可查阅"}</text><text x="60" y="660">线路是问题导向的阅读导航，不是完整先修课表；相邻站不等于直接先修。</text></g></svg></div>`;
  }
  function polar(cx, cy, r, angle) { return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r }; }
  function arcPath(start, end, inner, outer, cx = 460, cy = 355) {
    const a = polar(cx, cy, outer, start), b = polar(cx, cy, outer, end), c = polar(cx, cy, inner, end), d = polar(cx, cy, inner, start);
    return `M${a.x},${a.y} A${outer},${outer} 0 ${end - start > Math.PI ? 1 : 0} 1 ${b.x},${b.y} L${c.x},${c.y} A${inner},${inner} 0 ${end - start > Math.PI ? 1 : 0} 0 ${d.x},${d.y}Z`;
  }
  function drawRadial() {
    let angle = -Math.PI / 2;
    const domains = [], segments = [];
    domainKeys.forEach(key => {
      const group = D.nodes.filter(n => n.domain === key), end = angle + group.length / D.nodes.length * Math.PI * 2;
      const middle = (angle + end) / 2, p = polar(460, 355, 143, middle);
      let rotation = middle * 180 / Math.PI + 90;
      if (rotation > 90 && rotation < 270) rotation -= 180;
      domains.push(`<g role="button" tabindex="0" data-domain="${key}" class="domain-arc ${S.domain === key ? "active" : ""}" aria-label="筛选${D.domains[key]}"><path d="${arcPath(angle + .008, end - .008, 104, 186)}" fill="${palette[key]}" opacity="${S.domain === "all" || S.domain === key ? .92 : .20}"/><text x="${p.x}" y="${p.y}" text-anchor="middle" fill="#213738" transform="rotate(${rotation} ${p.x} ${p.y})">${D.domains[key]}</text></g>`);
      group.forEach((n, i) => {
        const start = angle + i / D.nodes.length * Math.PI * 2, stop = start + Math.PI * 2 / D.nodes.length, mid = (start + stop) / 2;
        const position = polar(460, 355, 247, mid), rotate = mid * 180 / Math.PI + (Math.cos(mid) < 0 ? 180 : 0);
        segments.push(svgButton(n.id, `<path d="${arcPath(start + .008, stop - .008, 191, 300)}" fill="${palette[key]}" fill-opacity="${S.node === n.id ? .6 : .18}" stroke="${S.node === n.id ? "#b77737" : "#d3d5ca"}" stroke-width="${S.node === n.id ? 2 : .6}"/><path d="${arcPath(start + .01, stop - .01, 303, 312)}" fill="${D.types[n.type].color}"/><text x="${position.x}" y="${position.y}" text-anchor="middle" transform="rotate(${rotate} ${position.x} ${position.y})">${n.name}</text>`, S.domain !== "all" && S.domain !== key ? "dimmed" : ""));
      });
      angle = end;
    });
    $("#stage").innerHTML = `<div class="svg-scroll"><svg class="radial-wheel" viewBox="0 0 930 720" role="group" aria-label="领域与知识点的径向分类图">${domains.join("")}${segments.join("")}<g class="wheel-center" role="button" tabindex="0" data-domain="all" aria-label="返回全部领域"><circle cx="460" cy="355" r="96" fill="#f7f3e8"/><text x="460" y="340" text-anchor="middle" class="wheel-title">${S.domain === "all" ? "知识的全貌" : D.domains[S.domain]}</text><text x="460" y="372" text-anchor="middle">${S.domain === "all" ? "24" : D.nodes.filter(n => n.domain === S.domain).length} 个知识点</text><text x="460" y="398" text-anchor="middle" class="wheel-reset">点击返回全部</text></g></svg></div><div class="wheel-legend">${Object.entries(D.types).map(([, t]) => `<span><i style="background:${t.color}"></i>${t.name}</span>`).join("")}</div>`;
  }
  function filteredMappings() {
    return mappings.filter(m => (S.project === "all" || m.project === S.project) && (S.domain === "all" || m.node.domain === S.domain) && (S.category === "all" || m.node.type === S.category));
  }
  function drawRiver() {
    const active = filteredMappings(), typeKeys = Object.keys(D.types);
    const H = 435, top = 120, gap = 23, unit = (H - 3 * gap) / Math.max(active.length, 1);
    function layout(keys, field) {
      let y = top;
      return keys.map(key => {
        const members = active.filter(m => field(m) === key), count = members.length, h = count * unit;
        const item = { key, count, y, h, out: y, in: y };
        if (count) y += h + gap;
        return item;
      });
    }
    const left = layout(domainKeys, m => m.node.domain), middle = layout(typeKeys, m => m.node.type), right = layout(D.projects.map(p => p.id), m => m.project);
    const ribbons = [];
    function ribbon(a, b, count, x1, x2, color) {
      if (!count) return;
      const h = count * unit, y1 = a.out, y2 = b.in, mid = (x1 + x2) / 2;
      ribbons.push(`<path d="M${x1} ${y1} C${mid} ${y1} ${mid} ${y2} ${x2} ${y2} L${x2} ${y2 + h} C${mid} ${y2 + h} ${mid} ${y1 + h} ${x1} ${y1 + h}Z" fill="${color}" fill-opacity=".29"><title>${count} 组知识—项目映射</title></path>`);
      a.out += h; b.in += h;
    }
    left.forEach(a => middle.forEach(b => ribbon(a, b, active.filter(m => m.node.domain === a.key && m.node.type === b.key).length, 175, 465, palette[a.key])));
    middle.forEach(a => { a.out = a.y; right.forEach(b => ribbon(a, b, active.filter(m => m.node.type === a.key && m.project === b.key).length, 483, 795, D.types[a.key].color)); });
    function bar(item, x, action, label, color, align) {
      if (!item.count) return "";
      return `<g role="button" tabindex="0" data-${action}="${item.key}" class="river-bar" aria-label="${label}，${item.count} 组映射"><rect x="${x}" y="${item.y}" width="18" height="${item.h}" rx="3" fill="${color}"/><text x="${align === "end" ? x - 12 : x + 31}" y="${item.y + item.h / 2 - 2}" text-anchor="${align}">${label}</text><text x="${align === "end" ? x - 12 : x + 31}" y="${item.y + item.h / 2 + 17}" text-anchor="${align}" class="flow-count">${item.count} 组</text></g>`;
    }
    $("#stage").innerHTML = `<div class="svg-scroll"><svg class="river-map" viewBox="0 0 1040 680" role="group" aria-label="领域、知识类型到项目的支撑流图"><text x="95" y="62" class="flow-column">从哪些领域出发</text><text x="430" y="62" class="flow-column">以什么知识类型连接</text><text x="800" y="62" class="flow-column">在哪些项目汇合</text>${active.length ? "" : '<text x="520" y="300" text-anchor="middle">当前组合没有映射。点击下方“清除流图筛选”恢复总览。</text>'}${ribbons.join("")}${left.map(item => bar(item, 157, "domain", D.domains[item.key], palette[item.key], "end")).join("")}${middle.map(item => bar(item, 465, "category", D.types[item.key].name, D.types[item.key].color, "start")).join("")}${right.map(item => bar(item, 795, "project", D.projects.find(p => p.id === item.key).short, projectColors[item.key], "start")).join("")}<text x="80" y="620" class="flow-total">${active.length} 组知识—项目映射 · 项目内去重，跨项目允许重复</text><text x="80" y="647" class="flow-note">一组映射穿过左右两段，计数守恒；不是实测学习人数或学习时长。</text></svg></div><div class="flow-reset"><button data-flow-reset>清除流图筛选</button><span>${S.domain === "all" ? "全部领域" : D.domains[S.domain]} / ${S.category === "all" ? "全部类型" : typeNames[S.category]}</span></div>`;
  }
  const scenarioNames = { factory: ["加工", "装配", "检测"], serving: ["输入准备", "模型计算", "输出处理"] };
  let scenario = "factory";
  function renderLab() {
    $("#stage").innerHTML = `<div class="lab-intro"><div><h2>为什么局部更快，整体没变？</h2><p>这是一个带缓冲的理想串行系统。把最慢环节找出来，再试着改变它。</p></div><span>到达率固定<br><b>12</b> 单位 / 秒</span></div><div class="lab-controls">${S.capacities.map((value, i) => `<label><span class="station-label">${scenarioNames[scenario][i]}</span><output id="capacity-${i}">${value}</output><input type="range" min="1" max="16" step="1" value="${value}" data-capacity="${i}" aria-label="${scenarioNames[scenario][i]}容量"><small>容量：单位 / 秒</small></label>`).join("")}</div><div id="lab-diagram"></div><div class="experiment-actions"><button data-lab="step">前进一步 · 1 秒</button><button data-lab="reset">重置缓冲与时间</button><button data-lab="baseline">把当前参数设为基线</button><button data-lab="restore">恢复示例参数</button></div><div class="lab-readouts"><div><span>当前稳态上界</span><strong id="rate-current"></strong></div><div><span>基线稳态上界</span><strong id="rate-baseline"></strong></div><div><span>相对基线</span><strong id="rate-delta"></strong></div></div><p class="lab-model-note">R = min(到达率 12, 三个环节容量) · 画面表示理想流体模型，无损耗、无限缓冲，不用于预测实际鱼速、GPU 性能或生产线产能。</p><div class="prediction"><h3>试一试这个反例</h3><p>先把“${scenarioNames[scenario][0]}”从 8 调到 16，再把“${scenarioNames[scenario][1]}”从 4 调到 8。两次调整中，哪一次改变了系统上界？为什么？</p><button data-node="bottleneck">回到“瓶颈与系统效率”</button></div>`;
    $(".lab-model-note").append(" 修改容量会重置模拟时间、缓冲与累计输出；已设定的基线会保留。");
    updateLab();
  }
  function rate(capacities) { return Math.min(12, ...capacities); }
  function updateLab() {
    const current = rate(S.capacities), baseline = rate(S.baseline), delta = (current / baseline - 1) * 100;
    $("#rate-current").innerHTML = `${current}<small> 单位 / 秒</small>`;
    $("#rate-baseline").innerHTML = `${baseline}<small> 单位 / 秒</small>`;
    $("#rate-delta").textContent = `${delta >= 0 ? "+" : ""}${Math.round(delta)}%`;
    S.capacities.forEach((value, i) => { $(`#capacity-${i}`).textContent = value; });
    const slowest = Math.min(...S.capacities), bottlenecks = S.capacities.map((v, i) => v === current && v === slowest ? i : -1).filter(i => i >= 0);
    const stationXs = [230, 505, 780];
    $("#lab-diagram").innerHTML = `<svg class="lab-svg" viewBox="0 0 1020 320" role="img" aria-label="串行系统：${bottlenecks.length ? bottlenecks.map(i => scenarioNames[scenario][i]).join("、") + "为容量瓶颈" : "输入到达率限制系统"}，当前输出累计${S.output}，时间${S.ticks}秒"><defs><marker id="lab-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="m0 0 10 5-10 5" fill="#999275"/></marker></defs>${[50, 323, 600, 873].map(x => `<path d="M${x} 135h86" stroke="#999275" stroke-width="2" marker-end="url(#lab-arrow)"/>`).join("")}${stationXs.map((x, i) => `<g class="lab-station ${bottlenecks.includes(i) ? "bottleneck-station" : ""}"><rect x="${x - 90}" y="72" width="180" height="128" rx="8" fill="${bottlenecks.includes(i) ? "#e8cfaa" : "#e6e9dc"}" stroke="${bottlenecks.includes(i) ? "#ac753c" : "#a5af91"}"/><text x="${x}" y="110" text-anchor="middle">${scenarioNames[scenario][i]}</text><text x="${x}" y="154" text-anchor="middle" class="capacity-number">${S.capacities[i]}</text><text x="${x}" y="181" text-anchor="middle" class="lab-small">单位 / 秒${bottlenecks.includes(i) ? " · 容量瓶颈" : ""}</text><text x="${x - 85}" y="236" class="lab-small">环节前缓冲</text><text x="${x + 80}" y="236" text-anchor="end">${S.stock[i]} 单位</text><rect x="${x - 85}" y="251" width="165" height="5" rx="2" fill="#e1dccd"/><rect x="${x - 85}" y="251" width="${Math.min(S.stock[i] / 120, 1) * 165}" height="5" rx="2" fill="#a28d67"/></g>`).join("")}<text x="45" y="48" class="lab-small">当前模拟时间 ${S.ticks} 秒</text><text x="975" y="48" text-anchor="end" class="lab-small">累计输出 ${S.output} 单位</text><text x="510" y="300" text-anchor="middle" class="lab-small">缓冲条显示范围 0—120 单位，超出仅保留精确数字；库存遵守 输入 = 缓冲 + 累计输出</text></svg>`;
  }
  function labStep() {
    S.stock[0] += 12;
    for (let i = 0; i < 3; i++) {
      const transferred = Math.min(S.stock[i], S.capacities[i]);
      S.stock[i] -= transferred;
      if (i < 2) S.stock[i + 1] += transferred; else S.output += transferred;
    }
    S.ticks++; updateLab();
    announce(`模拟时间${S.ticks}秒，累计输出${S.output}单位`);
  }
  function refreshView() {
    $("#toolbar").innerHTML = toolbar();
    if (canvas) drawSpace();
    else if (S.view === "metro") drawMetro();
    else if (S.view === "radial") drawRadial();
    else if (S.view === "river") drawRiver();
    renderInspector(); renderIndex();
  }
  document.addEventListener("click", event => {
    const el = event.target.closest("button[data-view],[data-node],[data-domain],[data-project],[data-category],[data-camera],[data-auto],[data-flow-reset],[data-lab],[data-scenario]");
    if (!el) return;
    const d = el.dataset;
    if (d.view) setView(d.view);
    else if (d.node) {
      selectNode(d.node);
      if (el.closest("#node-index") && matchMedia("(max-width:800px)").matches) $("#inspector").scrollIntoView({ block: "start" });
    }
    else if (d.domain) { S.domain = d.domain; refreshView(); }
    else if (d.project) { S.project = d.project; refreshView(); }
    else if (d.category) { S.category = d.category; refreshView(); }
    else if (d.camera) {
      if (d.camera === "reset") resetCamera();
      if (d.camera === "left") S.yaw -= .18;
      if (d.camera === "right") S.yaw += .18;
      if (d.camera === "in") S.zoom = Math.min(1.8, S.zoom + .1);
      if (d.camera === "out") S.zoom = Math.max(.65, S.zoom - .1);
      drawSpace();
    }
    else if ("auto" in d) { S.auto = !S.auto; if (S.auto) startAnimation(); else stopAnimation(); el.textContent = S.auto ? "暂停环视" : "自动环视"; el.setAttribute("aria-pressed", String(S.auto)); drawSpace(); }
    else if ("flowReset" in d) { S.domain = "all"; S.category = "all"; S.project = "all"; refreshView(); }
    else if (d.lab) {
      if (d.lab === "step") labStep();
      if (d.lab === "baseline") { S.baseline = [...S.capacities]; updateLab(); }
      if (d.lab === "reset") { S.stock = [0, 0, 0]; S.output = 0; S.ticks = 0; updateLab(); }
      if (d.lab === "restore") { S.capacities = [8, 4, 10]; S.baseline = [8, 4, 10]; S.stock = [0, 0, 0]; S.output = 0; S.ticks = 0; renderLab(); }
    }
    else if (d.scenario) {
      scenario = d.scenario; renderLab();
      document.querySelectorAll("[data-scenario]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.scenario === scenario)));
    }
  });
  document.addEventListener("input", event => {
    const el = event.target;
    if (el.id === "node-search") { S.query = el.value; renderIndex(); }
    if (el.dataset.capacity !== undefined) {
      S.capacities[Number(el.dataset.capacity)] = Number(el.value);
      S.stock = [0, 0, 0]; S.output = 0; S.ticks = 0; updateLab();
    }
  });
  document.addEventListener("change", event => {
    const el = event.target;
    if (el.id === "arrangement") { S.arrangement = el.value; drawSpace(); }
    if (el.id === "neighbors") { S.neighbors = el.checked; drawSpace(); }
    if (el.id === "labels") { S.labels = el.checked; drawSpace(); }
  });
  document.addEventListener("keydown", event => {
    if (event.target.closest('input,select,textarea,canvas,[contenteditable="true"]')) return;
    const svgControl = event.target.closest('g[role="button"]');
    if (svgControl && [" ", "Enter"].includes(event.key)) { event.preventDefault(); svgControl.dispatchEvent(new MouseEvent("click", { bubbles: true })); }
  });
  document.addEventListener("visibilitychange", () => { if (document.hidden) stopAnimation(); else if (S.auto) startAnimation(); });
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  reducedMotion.addEventListener("change", () => { if (reducedMotion.matches) { S.auto = false; stopAnimation(); if (canvas) refreshView(); } });
  let resizeFrame = 0;
  window.addEventListener("resize", () => {
    cancelAnimationFrame(resizeFrame); resizeFrame = requestAnimationFrame(() => { if (canvas) drawSpace(); });
  });
  window.addEventListener("popstate", () => {
    const value = new URLSearchParams(location.search).get("view");
    S.view = exhibit[value] ? value : "cosmos"; S.auto = false; resetCamera(); render();
  });
  $("#materials-list").innerHTML = Object.entries(D.sources).map(([key, s]) => `<a href="${sourceURL(key)}" target="_blank" rel="noopener">${s.title}<span>${s.kind} ↗</span></a>`).join("");
  render();
  window.__sceneReady = true;
})();
