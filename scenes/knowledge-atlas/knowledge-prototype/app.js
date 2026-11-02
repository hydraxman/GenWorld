(() => {
  "use strict";
  const D = window.KNOWLEDGE;
  const byId = Object.fromEntries(D.nodes.map(n => [n.id, n]));
  const variants = { A: "知识星图", B: "目标学习路线", C: "项目能力矩阵" };
  const initial = new URLSearchParams(location.search).get("variant");
  const state = {
    variant: variants[initial] ? initial : "A", selected: "bottleneck", domain: "all",
    type: "all", query: "", project: "fish", done: new Set(), known: new Set(),
    step: "thrust", cell: [0, 0], track: "solo", zoom: 1
  };
  const $ = (s, root = document) => root.querySelector(s);
  const esc = value => String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const icon = (name, cls = "") => {
    const paths = {
      graph: '<circle cx="6" cy="6" r="3"/><circle cx="18" cy="8" r="3"/><circle cx="11" cy="19" r="3"/><path d="m8 8 8-1M7 9l3 7m6-6-4 6"/>',
      path: '<circle cx="5" cy="5" r="2"/><circle cx="19" cy="19" r="2"/><path d="M7 5h8a4 4 0 0 1 0 8H9a4 4 0 0 0 0 6h8"/>',
      matrix: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>',
      search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
      arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
      book: '<path d="M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1Zm0 0v15"/>',
      check: '<path d="m5 12 4 4L19 6"/>',
      link: '<path d="m10 13 4-4m-6 6-2 2a3.5 3.5 0 0 1-5-5l5-5a3.5 3.5 0 0 1 5 0m2 2 2-2a3.5 3.5 0 0 1 5 5l-5 5a3.5 3.5 0 0 1-5 0"/>',
      globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18"/>'
    };
    return `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.graph}</svg>`;
  };
  function sourceHref(key, page) {
    const url = new URL("sources.html", location.href);
    url.hash = key;
    return url.href;
  }
  function refs(items) {
    return `<div class="source-links">${items.map(([key, page]) => `<a href="${sourceHref(key, page)}" target="_blank" rel="noopener">${icon("book")}<span>${esc(D.sources[key].title)}<small>${typeof page === "number" ? `第 ${page} 页` : `章节 ${esc(page)}`}</small></span><b>↗</b></a>`).join("")}</div>`;
  }
  function tag(type) {
    return `<span class="tag ${type}"><i></i>${D.types[type].name}</span>`;
  }
  function header() {
    return `<header class="topbar"><a class="brand" href="?variant=A" aria-label="知序首页"><span class="brand-symbol">${icon("graph")}</span><b>知序<span>KNOWLEDGE ATLAS</span></b></a><nav class="main-nav" aria-label="知识展示方式">${Object.entries(variants).map(([v, name], i) => `<button data-variant="${v}" class="${state.variant === v ? "active" : ""}" ${state.variant === v ? 'aria-current="page"' : ""}>${icon(["graph", "path", "matrix"][i])}${name}</button>`).join("")}</nav><button class="source-button" data-action="sources">${icon("book")}材料与来源<span>08</span></button></header>`;
  }
  function footerState(text) {
    return `<div class="state-line" aria-live="polite"><span class="status-dot"></span>${text}<span class="state-right"><a href="./">六种扩展展示</a> · <a href="sources.html#papers">论文灵感</a> · <a href="../../">GenWorld</a></span></div>`;
  }
  function render() {
    document.body.dataset.variant = state.variant;
    $("#app").innerHTML = header() + (state.variant === "A" ? VariantA() : state.variant === "B" ? VariantB() : VariantC());
    $("#variant-label").textContent = `${state.variant} / ${variants[state.variant]}`;
    if (state.variant === "A") drawGraph();
    if (state.variant === "B") renderPathContent();
    if (state.variant === "C") renderMatrixDetail();
  }
  function setVariant(v) {
    state.variant = v;
    const url = new URL(location.href);
    url.searchParams.set("variant", v);
    history.replaceState(null, "", url);
    render();
  }
  function cycle(delta) {
    const keys = Object.keys(variants);
    setVariant(keys[(keys.indexOf(state.variant) + delta + keys.length) % keys.length]);
  }
  function VariantA() {
    return `<div class="atlas-layout"><aside class="atlas-sidebar"><span class="eyebrow">YOUR KNOWLEDGE SPACE</span><h2>把知识连成体系</h2><p class="muted small">先看见结构，再走进细节。</p><div class="sidebar-title">知识领域 <span>${D.nodes.length}</span></div><nav class="domain-nav" aria-label="按知识领域筛选">${Object.entries(D.domains).map(([id, name]) => `<button data-domain="${id}" class="${state.domain === id ? "active" : ""}">${icon(id === "all" ? "globe" : id === "robot" ? "path" : id === "ml" ? "matrix" : "graph")}<span>${name}</span><small>${id === "all" ? D.nodes.length : D.nodes.filter(n => n.domain === id).length}</small></button>`).join("")}</nav><div class="sidebar-title second">从真实问题出发</div>${D.projects.map(p => `<button class="sidebar-project" data-project-route="${p.id}"><span>${p.number}</span><div><b>${p.short}</b><small>${p.category}</small></div>${icon("arrow")}</button>`).join("")}<div class="sidebar-note"><span class="tiny-label">不是又一份知识目录</span><p>从“知道一个概念”，<br>走向“理解它与什么有关”。</p><a href="${sourceHref("blueprint", 7)}" target="_blank" rel="noopener">门槛 · 纽结 · 同构 ↗</a></div></aside>
      <main id="main" class="atlas-main"><section class="page-heading"><div><span class="eyebrow">01 / EXPLORE THE CONNECTIONS</span><h1>知识不是孤岛<span>。</span></h1><p>从通识底座到真实工程，发现概念之间值得理解的连接。</p></div><span class="outline-label">交互式知识图谱</span></section>
      <div class="atlas-workspace"><section class="graph-panel" aria-label="知识关系探索"><div class="graph-toolbar"><label class="search">${icon("search")}<input id="knowledge-search" type="search" placeholder="搜索知识、概念或关键词…" value="${esc(state.query)}" aria-label="搜索知识点"><kbd>/</kbd></label><span id="match-count"></span></div><div class="type-filters" aria-label="按知识类型筛选"><button data-type="all" class="${state.type === "all" ? "active" : ""}" aria-pressed="${state.type === "all"}">全部类型</button>${Object.entries(D.types).map(([id, t]) => `<button data-type="${id}" class="${state.type === id ? "active" : ""}" aria-pressed="${state.type === id}"><i style="background:${t.color}"></i>${t.name}</button>`).join("")}</div><div class="graph-container"><svg id="knowledge-graph" viewBox="0 0 1000 760" role="group" aria-label="知识关系图，节点可点击或按回车查看"></svg><div id="empty-search" hidden>没有匹配的知识点。<br><button data-action="reset-search">清除筛选</button></div><div class="graph-controls"><button data-zoom="-0.2" aria-label="缩小图谱">−</button><button data-action="reset-zoom" id="zoom-label" aria-label="重置图谱缩放">100%</button><button data-zoom="0.2" aria-label="放大图谱">+</button></div></div><div class="graph-legend"><span><i class="line solid"></i>先修 → 后续知识</span><span><i class="line dashed"></i>跨领域迁移</span><small>连线与分类为整理建议 · 非自动推断</small></div><details class="node-index"><summary>用列表浏览全部知识点 <span>更适合键盘与小屏幕</span></summary><div id="node-list"></div></details></section><aside id="node-detail" class="detail-panel" aria-label="所选知识详情"></aside></div>
      <section class="insight-strip"><span class="insight-mark">↔</span><div><b>同一种结构，可以在不同学科里重逢。</b><p>生产线瓶颈、GPU 访存瓶颈、系统接口约束——迁移的是结构，不是未经检验的结论。</p></div><button data-node="bottleneck">探索一个连接 ${icon("arrow")}</button></section>${footerState('当前视图 A · <span id="graph-state"></span>')}</main></div>`;
  }
  function matchedNodes() {
    const q = state.query.trim().toLowerCase();
    return D.nodes.filter(n => (state.domain === "all" || n.domain === state.domain) && (state.type === "all" || n.type === state.type) && (!q || [n.name, n.en, n.desc, n.question].join(" ").toLowerCase().includes(q)));
  }
  function drawGraph() {
    const matches = matchedNodes();
    const visible = new Set(matches.map(n => n.id));
    const neighbors = new Set([state.selected]);
    D.nodes.forEach(n => n.prereqs.forEach(id => {
      if (n.id === state.selected) neighbors.add(id);
      if (id === state.selected) neighbors.add(n.id);
    }));
    D.transfers.forEach(([a, b]) => { if (a === state.selected) neighbors.add(b); if (b === state.selected) neighbors.add(a); });
    const edge = (a, b, transfer) => {
      const from = byId[a], to = byId[b];
      const selected = a === state.selected || b === state.selected;
      const direction = Math.sign(to.x - from.x);
      const sx = from.x + direction * Math.max(136, from.name.length * 14 + 35) / 2;
      const tx = to.x - direction * Math.max(136, to.name.length * 14 + 35) / 2;
      const vertical = direction ? 0 : Math.sign(to.y - from.y) * 22;
      const sy = from.y + 70 + vertical, ty = to.y + 70 - vertical;
      return `<path d="M${sx},${sy} C${(sx + tx) / 2},${sy} ${(sx + tx) / 2},${ty} ${tx},${ty}" class="graph-edge ${transfer ? "transfer-edge" : ""} ${selected ? "selected-edge" : ""}" ${!transfer ? `marker-end="url(#${selected ? "arrow-selected" : "arrow-default"})"` : ""}/>`;
    };
    const scale = state.zoom;
    $("#knowledge-graph").setAttribute("viewBox", `${500 - 500 / scale} ${380 - 380 / scale} ${1000 / scale} ${760 / scale}`);
    $("#knowledge-graph").innerHTML = `<defs><pattern id="dots" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".8" fill="#dbe4df"/></pattern><marker id="arrow-default" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="m0 0 10 5-10 5" fill="#c6d3ce"/></marker><marker id="arrow-selected" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="m0 0 10 5-10 5" fill="#4a8d7b"/></marker></defs><rect width="1000" height="760" fill="url(#dots)"/>
      <g class="graph-column-label"><text x="45" y="40">FOUNDATIONS</text><text x="280" y="40">ROBOTICS</text><text x="535" y="40">LEARNING</text><text x="780" y="40">SYSTEMS</text></g>
      ${D.nodes.flatMap(n => n.prereqs.map(p => edge(p, n.id, false))).join("")}${D.transfers.map(([a, b]) => edge(a, b, true)).join("")}
      ${D.nodes.map(n => {
        const selected = n.id === state.selected;
        const faded = !visible.has(n.id);
        const w = Math.max(136, n.name.length * 14 + 35);
        return `<g class="graph-node ${selected ? "is-selected" : ""} ${faded ? "is-muted" : ""} ${neighbors.has(n.id) ? "is-neighbor" : ""}" transform="translate(${n.x},${n.y + 70})" role="button" tabindex="0" data-node="${n.id}" aria-label="${esc(n.name)}，${D.types[n.type].name}${faded ? "，不匹配当前筛选" : ""}" aria-pressed="${selected}"><title>${esc(n.name)} · ${D.types[n.type].name}</title><rect x="${-w / 2}" y="-22" width="${w}" height="44" rx="10"/><circle cx="${-w / 2 + 17}" cy="0" r="4" fill="${D.types[n.type].color}"/><text x="7" y="5" text-anchor="middle">${esc(n.name)}</text>${selected ? `<circle cx="${w / 2 - 2}" cy="-18" r="5" fill="#b9ddba" stroke="#fff" stroke-width="2"/>` : ""}</g>`;
      }).join("")}`;
    $("#match-count").textContent = `${matches.length} / ${D.nodes.length} 节点`;
    $("#empty-search").hidden = matches.length > 0;
    $("#node-list").innerHTML = matches.map(n => `<button data-node="${n.id}" class="${n.id === state.selected ? "active" : ""}">${tag(n.type)}${esc(n.name)}</button>`).join("") || '<p class="muted">没有匹配的知识点。</p>';
    $("#node-detail").innerHTML = nodeDetail(byId[state.selected]);
    $("#graph-state").textContent = `领域：${D.domains[state.domain]} · 类型：${state.type === "all" ? "全部" : D.types[state.type].name} · 搜索：${state.query || "无"} · 已选：${byId[state.selected].name}`;
    $("#zoom-label").textContent = `${Math.round(scale * 100)}%`;
  }
  function nodeDetail(n, isPath = false) {
    const downstream = D.nodes.filter(x => x.prereqs.includes(n.id));
    const transfers = D.transfers.filter(pair => pair.includes(n.id)).map(pair => byId[pair.find(id => id !== n.id)]);
    return `<div class="detail-topline"><span class="eyebrow">${isPath ? "LEARNING ATOM" : "KNOWLEDGE ATOM"}</span><span class="tiny-label">人工整理</span></div>${tag(n.type)}<h2>${esc(n.name)}</h2><span class="english-title">${n.en}</span><p class="detail-desc">${esc(n.desc)}</p>
      <div class="atom-section"><h3>先修知识 <span>${n.prereqs.length ? "PREREQUISITES" : "START HERE"}</span></h3><div class="related-chips">${n.prereqs.length ? n.prereqs.map(id => `<button data-${isPath ? "step" : "node"}="${id}">${byId[id].name} ↗</button>`).join("") : '<span class="muted small">可作为本路线的起点</span>'}</div></div>
      ${!isPath && downstream.length ? `<div class="atom-section"><h3>通向哪里 <span>NEXT CONNECTIONS</span></h3><div class="related-chips">${downstream.map(x => `<button data-node="${x.id}">${x.name} ↗</button>`).join("")}</div></div>` : ""}
      ${transfers.length ? `<div class="atom-section"><h3>跨域迁移 <span>TRANSFER</span></h3><div class="related-chips">${transfers.map(x => `<button data-node="${x.id}">${x.name} ↔</button>`).join("")}</div></div>` : ""}
      <div class="question-box"><span>试着解释，而不是记住</span><p>${esc(n.question)}</p></div><details class="misconception"><summary>一个常见误区</summary><p>${esc(n.mistake)}</p></details><div class="atom-section"><h3>回到原始材料 <span>SOURCES</span></h3>${refs(n.refs)}</div>
      ${isPath ? `<button class="primary-button wide" data-toggle-done="${n.id}">${state.done.has(n.id) ? icon("check") + " 已标记理解 · 点击撤销" : "我能解释这个问题 " + icon("check")}</button><p class="tiny muted">仅为自查标记，不代表测评通过；刷新即重置。</p>` : `<button class="text-button" data-action="learn-selected">放进真实问题中学习 ${icon("arrow")}</button>`}`;
  }
  function VariantB() {
    const project = D.projects.find(p => p.id === state.project);
    return `<main id="main" class="path-page"><section class="path-intro"><div><span class="eyebrow">02 / LEARN WITH A PURPOSE</span><h1>不必从第一页，<br>开始学习<span>。</span></h1><p>先选一个想解决的问题，再沿着最小先修，<br>走向能解释、能验证的理解。</p></div><div class="path-manifesto"><span>THE LEARNING LOOP</span><div>问 <i>→</i> 学 <i>→</i> 用 <i>→</i> 研</div><p>实践暴露缺口，反思重建知识。</p><a href="${sourceHref("ie", 34)}" target="_blank" rel="noopener">自主建构式学习 · 第 34 页 ↗</a></div></section>
      <section class="project-picker" aria-label="选择学习目标">${D.projects.map(p => `<button data-project="${p.id}" class="project-option ${p.id === project.id ? "active" : ""}" aria-pressed="${p.id === project.id}"><span class="project-number">${p.number}</span><div><small>${p.category}</small><h2>${p.short}</h2></div><span class="project-arrow">↗</span></button>`).join("")}</section>
      <section class="path-project"><img src="knowledge-prototype/${project.image}" alt="${project.short}原创概念示意图，非实物或报告截图"><div><span class="eyebrow">YOUR MISSION / ${project.number}</span><h2>${project.name}</h2><p>${project.intro}</p><p class="deliverable"><b>建议交付</b>${project.deliverable}</p></div><span class="material-badge">原创示意<br>× 整理路线</span></section>
      <div class="path-layout"><section class="timeline-panel"><div class="section-heading"><div><span class="eyebrow">A ROUTE, NOT A SYLLABUS</span><h2>把缺失的台阶，补回来。</h2></div><span id="path-count" class="tiny-label"></span></div><div class="known-controls"><span>我已掌握的基础</span>${["math", "physics", "ai", "experimental"].map(id => `<label><input type="checkbox" data-known="${id}" ${state.known.has(id) ? "checked" : ""}>${byId[id].name}</label>`).join("")}</div><div class="progress-label"><span id="progress-text"></span><span>自查进度 · 非能力评分</span></div><div class="progress-track"><div id="progress-fill"></div></div><div id="timeline"></div><div class="notice"><strong>关于这条路线</strong><p>用本页人工整理的先修图，递归补齐目标所需的基础，再按依赖顺序排列。勾选已掌握的节点后，仍会保留未勾选的先修知识。不估算学习时长，不声称是唯一或最优课程路径。</p><a href="${sourceHref("ie", 10)}" target="_blank" rel="noopener">路径设计依据：子问题拆解 → 最小先修 → 学习目标 ↗</a></div></section><aside class="path-aside"><div id="path-detail" class="path-detail"></div><div class="boundary-card"><span class="tiny-label">先分清“目标”和“已证实”</span><p>${project.boundary}</p>${refs(project.refs.slice(-2))}</div></aside></div>${footerState(`当前视图 B · 目标：${project.short} · <span id="path-state"></span>`)}</main>`;
  }
  function learningPath() {
    const project = D.projects.find(p => p.id === state.project);
    const result = [], visited = new Set();
    function visit(id) {
      if (visited.has(id)) return;
      visited.add(id);
      byId[id].prereqs.forEach(visit);
      if (!state.known.has(id)) result.push(byId[id]);
    }
    project.goals.forEach(visit);
    return result;
  }
  function renderPathContent() {
    const path = learningPath();
    const project = D.projects.find(p => p.id === state.project);
    if (!path.some(n => n.id === state.step)) state.step = path[0]?.id;
    const complete = path.filter(n => state.done.has(n.id)).length;
    $("#path-count").textContent = `${path.length} 个知识台阶`;
    $("#progress-text").textContent = `${complete} / ${path.length} 已自查`;
    $("#progress-fill").style.width = `${path.length ? complete / path.length * 100 : 0}%`;
    $("#timeline").innerHTML = path.map((n, i) => `<article class="timeline-step ${state.step === n.id ? "active" : ""} ${state.done.has(n.id) ? "complete" : ""}"><button class="step-number" data-toggle-done="${n.id}" aria-label="${state.done.has(n.id) ? "取消" : "标记"}已理解${n.name}" aria-pressed="${state.done.has(n.id)}">${state.done.has(n.id) ? icon("check") : String(i + 1).padStart(2, "0")}</button><button class="step-body" data-step="${n.id}" aria-pressed="${state.step === n.id}"><div>${tag(n.type)}<span class="step-role">${project.goals.includes(n.id) ? "目标知识" : "补齐先修"}</span></div><h3>${n.name}</h3><p>${n.question}</p></button><button class="step-open" data-step="${n.id}" aria-label="查看${n.name}详情">${icon("arrow")}</button></article>`).join("");
    $("#path-detail").innerHTML = state.step ? nodeDetail(byId[state.step], true) : "<h2>基础已补齐</h2>";
    $("#path-state").textContent = `排除 ${state.known.size} 个已知基础 · ${path.length} 个待学节点 · 当前：${state.step ? byId[state.step].name : "无"}`;
  }
  function VariantC() {
    const recorded = D.projects.flatMap(p => p.cells).filter(c => c.status === "recorded").length;
    return `<main id="main" class="matrix-page"><section class="matrix-heading"><div><span class="eyebrow">03 / MAKE UNDERSTANDING VISIBLE</span><h1>交付作品，<br>也交代<span>理解的证据。</span></h1><p>把真实项目挂到能力结构上。每一格不问“做过没有”，<br>而问“依据是什么，接下来怎样验证”。</p></div><div class="matrix-stats"><div><strong>03</strong><span>真实材料中的任务场景</span></div><div><strong>06</strong><span>能力观察维度</span></div><div><strong>02</strong><span>独立理解 / AI 协同轨道</span></div></div></section>
      <section class="matrix-workbench"><div class="matrix-toolbar"><div><span class="live-dot"></span><b>项目 × 能力 · 证据索引</b><span>点击任意单元格</span></div><div class="matrix-legend"><span><i class="evidence-dot recorded"></i>材料有记载 (${recorded})</span><span><i class="evidence-dot proposed"></i>建议补充取证 (${18 - recorded})</span></div></div><div class="table-scroll"><table class="evidence-table"><caption class="sr-only">三个项目的六个能力维度，点击查看原始记载与建议的双轨评价</caption><thead><tr><th scope="col">真实任务 <small>PROJECT / CAPABILITY</small></th>${D.capabilities.map(c => `<th scope="col">${c.name}<small>${c.en}</small></th>`).join("")}</tr></thead><tbody>${D.projects.map((p, row) => `<tr><th scope="row"><button data-cell="${row},0"><span>${p.number} / ${p.category}</span><strong>${p.short}</strong><small>${p.id === "llm" ? "课程要求 ≠ 已完成实验" : "项目愿景 ≠ 全部已实现"}</small></button></th>${p.cells.map((c, col) => `<td><button class="evidence-cell ${c.status} ${state.cell[0] === row && state.cell[1] === col ? "active" : ""}" data-cell="${row},${col}" aria-label="${p.short}，${D.capabilities[col].name}，${c.status === "recorded" ? "材料有记载" : "建议补充取证"}" aria-pressed="${state.cell[0] === row && state.cell[1] === col}"><span class="cell-symbol">${c.status === "recorded" ? "◈" : "+"}</span><strong>${c.title}</strong><small>${c.status === "recorded" ? "查看记载与出处" : "查看取证建议"} ↗</small></button></td>`).join("")}</tr>`).join("")}</tbody></table></div><p class="matrix-disclaimer">“材料有记载”只说明原文讨论过，不代表成果经独立复核，也不代表学生已通过能力评价。维度与任务映射为本次整理。</p></section>
      <section id="matrix-detail" class="matrix-detail" aria-label="选中能力的证据与评价"></section><section class="matrix-principle"><span>THE PRINCIPLE</span><h2>最终答案正确，<em>还不够。</em></h2><p>无 AI 看底座，有 AI 看驾驭。把机制解释、实验数据与修正过程一起留下。</p><a href="${sourceHref("blueprint", 11)}" target="_blank" rel="noopener">双轨评价的原始框架 · 第 11 页 ↗</a></section>${footerState('当前视图 C · <span id="matrix-state"></span>')}</main>`;
  }
  function renderMatrixDetail() {
    const [row, col] = state.cell;
    const p = D.projects[row], cell = p.cells[col], cap = D.capabilities[col];
    document.querySelectorAll(".evidence-cell").forEach(button => {
      const selected = button.dataset.cell === `${row},${col}`;
      button.classList.toggle("active", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
    $("#matrix-detail").innerHTML = `<div class="evidence-reading"><span class="eyebrow">SELECTED EVIDENCE / ${p.number}</span><h2>${p.short}<span> / ${cap.name}</span></h2><div class="evidence-status ${cell.status}">${cell.status === "recorded" ? "材料有记载 · 非独立核验" : "建议补充取证 · 非已完成成果"}</div><p class="evidence-quote">${cell.evidence}</p>${refs(cell.refs)}<div class="source-boundary"><b>项目边界</b><p>${p.boundary}</p></div></div><div class="assessment-card"><div class="assessment-heading"><span class="eyebrow">HOW TO ASSESS</span><span class="tiny-label">建议的验收问题</span></div><div class="track-toggle" aria-label="切换评价轨道"><button data-track="solo" class="${state.track === "solo" ? "active" : ""}" aria-pressed="${state.track === "solo"}">01 / 无 AI · 独立理解</button><button data-track="ai" class="${state.track === "ai" ? "active" : ""}" aria-pressed="${state.track === "ai"}">02 / 有 AI · 协同驾驭</button></div><span class="assessment-caption">${state.track === "solo" ? "合上工具，解释机制与假设" : "打开工具，保留审查与修正"}</span><h3>${state.track === "solo" ? cell.solo : cell.ai}</h3><div class="evidence-request"><span>建议留下的证据</span><p>${state.track === "solo" ? "一段独立口述、手绘机制图或关键计算，连同教师追问及回答。" : "原始提示、AI 输出、人工发现的问题、修改记录，以及最终验证结果。"}</p></div><button class="matrix-route-button" data-project-route="${p.id}">沿知识路线补齐这项能力 ${icon("arrow")}</button><p class="tiny">页面不自动评分，不采集学生信息，也不生成“已掌握”的假数据。</p></div>`;
    $("#matrix-state").textContent = `任务：${p.short} · 维度：${cap.name} · 轨道：${state.track === "solo" ? "无 AI" : "有 AI"} · 状态：${cell.status === "recorded" ? "原文有记载" : "待取证"}`;
  }
  $("#source-list").innerHTML = Object.entries(D.sources).map(([id, s], i) => `<a class="source-item" href="${sourceHref(id)}" target="_blank" rel="noopener"><span>${String(i + 1).padStart(2, "0")}</span><div><b>${s.title}</b><p>${s.note}</p></div><small>${s.kind} ↗</small></a>`).join("");
  $("#close-sources").addEventListener("click", () => $("#source-dialog").close());
  $("#source-dialog").addEventListener("click", event => { if (event.target === $("#source-dialog")) { const r = event.target.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) event.target.close(); } });
  $("#previous-variant").addEventListener("click", () => cycle(-1));
  $("#next-variant").addEventListener("click", () => cycle(1));
  document.addEventListener("input", event => {
    if (event.target.id === "knowledge-search") { state.query = event.target.value; drawGraph(); }
  });
  document.addEventListener("change", event => {
    const id = event.target.dataset.known;
    if (id) { if (event.target.checked) state.known.add(id); else state.known.delete(id); renderPathContent(); }
  });
  document.addEventListener("click", event => {
    const el = event.target.closest("button[data-variant],[data-domain],[data-type],[data-node],[data-project],[data-project-route],[data-step],[data-toggle-done],[data-cell],[data-track],[data-action],[data-zoom]");
    if (!el) return;
    const d = el.dataset;
    if (d.variant) setVariant(d.variant);
    else if (d.domain) { state.domain = d.domain; render(); }
    else if (d.type) { state.type = d.type; render(); }
    else if (d.node) { state.selected = d.node; if (state.variant !== "A") setVariant("A"); else drawGraph(); }
    else if (d.projectRoute || d.project) {
      state.project = d.projectRoute || d.project;
      state.step = D.projects.find(p => p.id === state.project).goals[0];
      if (state.variant !== "B") setVariant("B"); else render();
    }
    else if (d.step) {
      if (state.known.has(d.step)) state.known.delete(d.step);
      state.step = d.step;
      render();
      if (matchMedia("(max-width:720px)").matches) $("#path-detail").scrollIntoView({ block: "start" });
    }
    else if (d.toggleDone) { if (state.done.has(d.toggleDone)) state.done.delete(d.toggleDone); else state.done.add(d.toggleDone); renderPathContent(); }
    else if (d.cell) { state.cell = d.cell.split(",").map(Number); renderMatrixDetail(); }
    else if (d.track) { state.track = d.track; renderMatrixDetail(); }
    else if (d.zoom) { state.zoom = Math.max(0.7, Math.min(1.6, state.zoom + Number(d.zoom))); drawGraph(); }
    else if (d.action === "sources") $("#source-dialog").showModal();
    else if (d.action === "reset-zoom") { state.zoom = 1; drawGraph(); }
    else if (d.action === "reset-search") { state.domain = "all"; state.type = "all"; state.query = ""; render(); }
    else if (d.action === "learn-selected") {
      const n = byId[state.selected];
      state.project = n.domain === "ml" || n.id === "bottleneck" ? "llm" : ["perception", "planning", "interfaces"].includes(n.id) ? "snake" : "fish";
      state.step = state.selected;
      setVariant("B");
    }
  });
  document.addEventListener("keydown", event => {
    if (event.target.closest('input,textarea,select,[contenteditable="true"]') || $("#source-dialog").open) return;
    const graphNode = event.target.closest(".graph-node");
    if (graphNode && ["Enter", " "].includes(event.key)) { event.preventDefault(); graphNode.dispatchEvent(new MouseEvent("click", { bubbles: true })); return; }
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); cycle(event.key === "ArrowLeft" ? -1 : 1); }
    if (event.key === "/" && state.variant === "A") { event.preventDefault(); $("#knowledge-search").focus(); }
  });
  window.addEventListener("popstate", () => {
    const v = new URLSearchParams(location.search).get("variant");
    state.variant = variants[v] ? v : "A";
    render();
  });
  render();
})();
