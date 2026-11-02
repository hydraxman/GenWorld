(async () => {
  const results = [];
  function check(name, value) {
    results.push({ name, pass: !!value });
    if (!value) throw new Error(name);
  }
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const click = s => {
    const el = $(s);
    if (!el) throw new Error("Missing " + s);
    el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  };
  const change = (s, value) => {
    const el = $(s);
    el.value = value;
    el.dispatchEvent(new Event("change", { bubbles: true }));
  };
  const input = (s, value) => {
    const el = $(s);
    el.value = value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
  };
  const tick = () => new Promise(resolve => requestAnimationFrame(resolve));
  const selected = () => $("#inspector h2").textContent;
  const expectedDepth = {};
  const nodes = Object.fromEntries(window.KNOWLEDGE.nodes.map(n => [n.id, n]));
  function depth(id) {
    return expectedDepth[id] ??= nodes[id].prereqs.length ? Math.max(...nodes[id].prereqs.map(depth)) + 1 : 0;
  }
  function route(project) {
    const ids = new Set();
    function visit(id) {
      if (ids.has(id)) return;
      nodes[id].prereqs.forEach(visit);
      ids.add(id);
    }
    project.goals.forEach(visit);
    return ids;
  }
  check("six additional exhibit tabs", $$("#exhibit-nav button").length === 6);
  check("original examples have independent link", $(".original-link").href.endsWith("knowledge-prototype.html"));
  const isBibliography = a => new URL(a.href).pathname.endsWith("/sources.html") && new URL(a.href).origin === location.origin;
  check("all eight sources link to public bibliography", $$("#materials-list a").length === 8 && $$("#materials-list a").every(isBibliography));
  for (const view of ["cosmos", "city", "metro", "radial", "river", "lab"]) {
    click(`button[data-view="${view}"]`);
    check("URL reflects exhibit " + view, new URL(location.href).searchParams.get("view") === view);
    check("accessible node list has all 24 nodes: " + view, $$("#node-index button").length === 24);
    check("page does not overflow: " + view, document.documentElement.scrollWidth <= innerWidth);
    check("reading guide carries data meaning: " + view, $("#reading-guide").textContent.length > 100);
    check("all source anchors resolve to bibliography: " + view, $$("#inspector .source-links a").every(isBibliography));
    for (const n of window.KNOWLEDGE.nodes) {
      click(`#node-index [data-node="${n.id}"]`);
      check("node selection " + view + "/" + n.id, selected() === n.name);
      if (view === "city") check("city height encoding " + n.id, $(".height-key b").textContent === String(depth(n.id) + 1));
    }
    input("#node-search", "Roofline");
    check("search narrows accessible list: " + view, $$("#node-index button").length === 1);
    input("#node-search", "no-matching-node-8891");
    check("search exposes recoverable empty state: " + view, !$("#index-empty").hidden);
    input("#node-search", "");
    if (["cosmos", "city"].includes(view)) {
      const canvas = $("#space-canvas");
      const initial = canvas.toDataURL();
      const cameraBefore = $("#spatial-readout").textContent;
      click('[data-camera="right"]');
      check("3D camera rotation redraws " + view, canvas.toDataURL() !== initial && $("#spatial-readout").textContent !== cameraBefore);
      click('[data-camera="in"]');
      check("3D zoom control " + view, $("#zoom-value").textContent === "110%");
      click('[data-camera="reset"]');
      check("3D camera reset " + view, $("#zoom-value").textContent === "100%");
      const zoomBefore = $("#zoom-value").textContent;
      canvas.dispatchEvent(new WheelEvent("wheel", { deltaY: -120, bubbles: true, cancelable: true }));
      check("3D wheel changes scale " + view, $("#zoom-value").textContent !== zoomBefore);
      const keyBefore = $("#spatial-readout").textContent;
      canvas.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
      check("3D keyboard rotates " + view, $("#spatial-readout").textContent !== keyBefore);
      click('[data-domain="robot"]');
      check("3D domain filter " + view, $$("#node-index button").length === 5);
      click('[data-domain="all"]');
      $("#labels").checked = false;
      $("#labels").dispatchEvent(new Event("change", { bubbles: true }));
      check("3D label toggle " + view, !$("#labels").checked);
      $("#labels").checked = true;
      $("#labels").dispatchEvent(new Event("change", { bubbles: true }));
      $("#neighbors").checked = true;
      $("#neighbors").dispatchEvent(new Event("change", { bubbles: true }));
      check("neighbor filter usable " + view, $("#neighbors").checked);
      $("#neighbors").checked = false;
      $("#neighbors").dispatchEvent(new Event("change", { bubbles: true }));
      if (view === "cosmos") {
        const beforeLayout = canvas.toDataURL();
        change("#arrangement", "sphere");
        check("sphere layout changes projected coordinates", canvas.toDataURL() !== beforeLayout);
        change("#arrangement", "clusters");
      }
      click('[data-camera="reset"]');
      window.scrollTo(0, 0);
      await tick();
      click("[data-auto]");
      check("auto rotation explicit enabled " + view, $("[data-auto]").getAttribute("aria-pressed") === "true");
      await tick();
      click("[data-auto]");
      check("auto rotation can pause " + view, $("[data-auto]").getAttribute("aria-pressed") === "false");
    }
    if (view === "metro") {
      check("metro has 16 meaningful landmark stations", $$(".metro-map .svg-node").length === 16);
      for (const p of window.KNOWLEDGE.projects) {
        click(`[data-project="${p.id}"]`);
        check("complete prerequisites still accessible for " + p.id, $$("#node-index button").length === route(p).size);
        check("project boundary preserved for " + p.id, $(".project-boundary").textContent.includes(p.boundary));
      }
      click('[data-project="all"]');
      click('.metro-map [data-node="math"]');
      check("SVG station selection updates inspector", selected() === nodes.math.name);
    }
    if (view === "radial") {
      check("radial renders 24 equal node sectors", $$(".radial-wheel .svg-node").length === 24);
      for (const domain of ["general", "robot", "ml", "system"]) {
        click(`.domain-arc[data-domain="${domain}"]`);
        check("radial inner ring filters " + domain, $$("#node-index button").length === window.KNOWLEDGE.nodes.filter(n => n.domain === domain).length);
      }
      click(".wheel-center");
      check("radial center returns all", $$("#node-index button").length === 24);
      const node = $('.radial-wheel [data-node="kv"]');
      node.focus({ preventScroll: true });
      node.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      check("SVG keyboard accessible", selected() === nodes.kv.name);
      check("SVG focus survives diagram redraw", document.activeElement?.dataset.node === "kv");
    }
    if (view === "river") {
      check("alluvial total is actual mapping count", $(".flow-total").textContent.startsWith("36 "));
      for (const p of window.KNOWLEDGE.projects) {
        click(`[data-project="${p.id}"]`);
        check("flow count agrees with recursive prerequisites " + p.id, $(".flow-total").textContent.startsWith(route(p).size + " "));
        const bars = $$(".river-bar");
        const domainSum = bars.filter(b => b.dataset.domain).reduce((s, b) => s + Number(b.getAttribute("aria-label").match(/，(\d+)/)[1]), 0);
        const typeSum = bars.filter(b => b.dataset.category).reduce((s, b) => s + Number(b.getAttribute("aria-label").match(/，(\d+)/)[1]), 0);
        const projectSum = bars.filter(b => b.dataset.project).reduce((s, b) => s + Number(b.getAttribute("aria-label").match(/，(\d+)/)[1]), 0);
        check("alluvial flow is conserved " + p.id, domainSum === route(p).size && typeSum === domainSum && projectSum === domainSum);
      }
      click("[data-flow-reset]");
      click('.river-bar[data-category="threshold"]');
      check("knowledge type filter applies", $$("#node-index button").every(b => nodes[b.dataset.node].type === "threshold"));
      click("[data-flow-reset]");
      click('.river-bar[data-domain="ml"]');
      click('[data-project="fish"]');
      check("zero mapping has explicit recovery", $(".flow-total").textContent.startsWith("0 ") && $(".river-map").textContent.includes("当前组合没有映射"));
      click("[data-flow-reset]");
      check("clear all filters restores 36 mappings", $(".flow-total").textContent.startsWith("36 "));
    }
    if (view === "lab") {
      click('[data-lab="restore"]');
      const currentRate = () => Number($("#rate-current").firstChild.textContent);
      check("example bottleneck rate equals four", currentRate() === 4);
      input('[data-capacity="0"]', "16");
      check("non-bottleneck speedup cannot raise throughput", currentRate() === 4);
      input('[data-capacity="1"]', "8");
      check("bottleneck speedup raises rate to eight", currentRate() === 8);
      check("comparison reports exact 100 percent increase", $("#rate-delta").textContent === "+100%");
      click('[data-lab="baseline"]');
      check("baseline is adjustable", $("#rate-delta").textContent === "+0%");
      input('[data-capacity="0"]', "16");
      input('[data-capacity="1"]', "16");
      input('[data-capacity="2"]', "16");
      check("arrival rate caps throughput at twelve", currentRate() === 12);
      check("no station bottleneck when arrival-limited", $$(".bottleneck-station").length === 0);
      click('[data-lab="restore"]');
      for (let i = 0; i < 10; i++) click('[data-lab="step"]');
      const svg = $(".lab-svg"), text = svg.textContent;
      check("single step advances simulated time", text.includes("当前模拟时间 10 秒"));
      check("ten ticks output exact forty units", text.includes("累计输出 40 单位"));
      const stocks = Array.from(text.matchAll(/环节前缓冲(\d+) 单位/g)).map(m => Number(m[1]));
      check("mass conserved across buffers and output", stocks.length === 3 && stocks.reduce((a, b) => a + b, 40) === 120);
      click('[data-scenario="serving"]');
      check("service analogy changes vocabulary not outcome", $(".station-label").textContent === "输入准备" && currentRate() === 4 && $(".lab-svg").textContent.includes("累计输出 40"));
      click('[data-lab="reset"]');
      check("simulation reset clears time and inventories", $(".lab-svg").textContent.includes("当前模拟时间 0 秒") && $(".lab-svg").textContent.includes("累计输出 0"));
      click('[data-view="cosmos"]');
      click('[data-view="lab"]');
      check("analogy selection survives navigation consistently", $('[data-scenario="serving"]').getAttribute("aria-pressed") === "true" && $(".station-label").textContent === "输入准备");
      click('[data-scenario="factory"]');
    }
  }
  click('[data-view="cosmos"]');
  click('#node-index [data-node="bottleneck"]');
  check("no external fetched assets", performance.getEntriesByType("resource").every(r => new URL(r.name).origin === location.origin));
  check("citation preserves source and original page label", $$("#inspector .source-links a").some(a => a.href.endsWith("#blueprint") && a.textContent.includes("第 7 页")));
  check("both materials and misconception are native details", $$(".materials summary,.misconception summary").length === 2);
  return { viewport: innerWidth, assertions: results.length, passed: results.filter(r => r.pass).length, results };
})()
