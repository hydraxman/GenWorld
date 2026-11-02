(async () => {
  const results = [];
  function check(name, ok) {
    results.push({ name, pass: !!ok });
    if (!ok) throw Error(name);
  }
  const click = selector => {
    const el = document.querySelector(selector);
    if (!el) throw Error("Missing " + selector);
    el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  };
  click('button[data-variant="A"]');
  check("24 interactive graph nodes", document.querySelectorAll(".graph-node").length === 24);
  click('.graph-node[data-node="kv"]');
  check("node selection updates detail", document.querySelector("#node-detail h2").textContent === "KV 缓存");
  const input = document.querySelector("#knowledge-search");
  input.value = "Roofline";
  input.dispatchEvent(new Event("input", { bubbles: true }));
  check("search filters matching graph nodes", document.querySelectorAll(".graph-node:not(.is-muted)").length === 1);
  input.value = "不存在的知识xyz";
  input.dispatchEvent(new Event("input", { bubbles: true }));
  check("empty search has recovery", !document.querySelector("#empty-search").hidden);
  click('[data-action="reset-search"]');
  click('[data-type="threshold"]');
  check("type filter selects six threshold nodes", document.querySelectorAll(".graph-node:not(.is-muted)").length === 6);
  click('[data-type="all"]');
  click('[data-domain="robot"]');
  check("domain filter shows five robot nodes", document.querySelectorAll(".graph-node:not(.is-muted)").length === 5);
  click('[data-domain="all"]');
  click('[data-zoom="0.2"]');
  check("zoom control updates viewbox", document.querySelector("#zoom-label").textContent === "120%");
  click('[data-action="reset-zoom"]');
  click(".node-index summary");
  check("native details remain open", document.querySelector(".node-index").open);
  click(".node-index summary");
  for (const n of window.KNOWLEDGE.nodes) {
    click(`.graph-node[data-node="${n.id}"]`);
    check("graph detail: " + n.id, document.querySelector("#node-detail h2").textContent === n.name);
  }
  click('[data-action="sources"]');
  check("source library opens", document.querySelector("#source-dialog").open);
  check("eight local material links", document.querySelectorAll(".source-item").length === 8);
  check("public bibliography anchor and original page label", new URL(document.querySelector(".source-item").href).pathname.endsWith("/sources.html") && Array.from(document.querySelectorAll("#node-detail a")).some(a => a.href.endsWith("#blueprint") && a.textContent.includes("第 12 页")));
  click("#close-sources");
  click('[data-variant="B"]');
  check("B writes shareable variant URL", new URL(location.href).searchParams.get("variant") === "B");
  const img = document.querySelector(".path-project img");
  if (!img.complete) await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; });
  check("original schematic loads without a source screenshot", img.naturalWidth > 0 && img.src.endsWith(".svg"));
  const originalCount = document.querySelectorAll(".timeline-step").length;
  click('[data-known="math"]');
  check("known foundation removes one route step", document.querySelectorAll(".timeline-step").length === originalCount - 1);
  click('[data-known="math"]');
  const mark = document.querySelector(".step-number");
  const before = mark.getAttribute("aria-pressed") === "true";
  const id = mark.dataset.toggleDone;
  click(`.step-number[data-toggle-done="${id}"]`);
  check("self-check progress updates", document.querySelector(`.step-number[data-toggle-done="${id}"]`).getAttribute("aria-pressed") === String(!before));
  const byId = Object.fromEntries(window.KNOWLEDGE.nodes.map(n => [n.id, n]));
  for (const p of window.KNOWLEDGE.projects) {
    click(`[data-project="${p.id}"]`);
    const ids = Array.from(document.querySelectorAll(".step-body")).map(x => x.dataset.step);
    check("route includes all goals: " + p.id, p.goals.every(id => ids.includes(id)));
    check("topological prerequisite order: " + p.id, ids.every((id, i) => byId[id].prereqs.every(pre => ids.indexOf(pre) >= 0 && ids.indexOf(pre) < i)));
    for (const id of ids) {
      click(`.step-body[data-step="${id}"]`);
      check("route detail: " + p.id + "/" + id, document.querySelector("#path-detail h2").textContent === byId[id].name);
    }
  }
  click('[data-variant="C"]');
  check("matrix has 18 interactive cells", document.querySelectorAll(".evidence-cell").length === 18);
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 6; col++) {
      click(`.evidence-cell[data-cell="${row},${col}"]`);
      const cell = window.KNOWLEDGE.projects[row].cells[col];
      check(`matrix source ${row},${col}`, document.querySelector(".evidence-quote").textContent === cell.evidence);
      for (const track of ["solo", "ai"]) {
        click(`[data-track="${track}"]`);
        check(`assessment ${row},${col}/${track}`, document.querySelector(".assessment-card h3").textContent === cell[track]);
      }
    }
  }
  click('[data-cell="0,5"]');
  check("fish turn remains unachieved", document.querySelector(".evidence-quote").textContent.includes("尚未达到转向目标"));
  click('[data-cell="2,2"]');
  check("GPU experiments not fabricated", document.querySelector(".evidence-quote").textContent.includes("未实际运行 GPU"));
  check("no horizontal page overflow", document.documentElement.scrollWidth <= innerWidth);
  click('[data-variant="A"]');
  document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
  check("keyboard variant navigation", new URL(location.href).searchParams.get("variant") === "B");
  click('[data-variant="A"]');
  const search = document.querySelector("#knowledge-search");
  search.focus();
  search.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
  check("input arrow does not change variant", new URL(location.href).searchParams.get("variant") === "A");
  search.blur();
  click('.graph-node[data-node="bottleneck"]');
  return { assertions: results.length, passed: results.filter(r => r.pass).length, results };
})()
