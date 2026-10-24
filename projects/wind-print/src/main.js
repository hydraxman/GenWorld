import { SIZE, PALETTES, randomSource, createComposition, makeBranch, windOffset, sampleStroke } from './model.js';

const $ = id => document.getElementById(id);
const state = { seed: 240724, density: 60, palette: 'teal', locked: false, mode: 'push', strokes: [] };
let art, paper, lines = [], branches = [], pointer = null, activePointer = null, stroke = null;
let growthStart = 0, renderedGrowth = 0, canvas, exporting = false;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

function announce(message, error = false) {
  $('status').textContent = message;
  $('status').classList.toggle('error', error);
  $('status').setAttribute('role', error ? 'alert' : 'status');
}

function updateDrawingActions() {
  $('undo').disabled = $('clear').disabled = state.strokes.length === 0;
  $('composition-count').textContent = `${branches.reduce((sum, branch) => sum + branch.leaves.length, 0)} LEAVES / SEED ${state.seed}`;
}

function rebuild() {
  branches = createComposition(state.seed, state.density);
  for (const [index, points] of state.strokes.entries()) {
    branches.push(makeBranch(points, state.density, (state.seed + index * 7919) % 999999999 || 1));
  }
  growthStart = performance.now();
  renderedGrowth = 0;
  updateDrawingActions();
  art?.loop();
}

function makeLetterLines() {
  const mask = document.createElement('canvas');
  mask.width = SIZE;
  mask.height = 460;
  const context = mask.getContext('2d', { willReadFrequently: true });
  context.font = '900 296px Arial, sans-serif';
  const width = context.measureText('WIND').width;
  context.save();
  context.translate(66, 407);
  context.scale(868 / width, 1);
  context.fillStyle = '#ffffff';
  context.fillText('WIND', 0, 0);
  context.restore();
  const pixels = context.getImageData(0, 0, SIZE, 460).data;
  lines = [];
  for (let y = 188; y < 411; y += 4) {
    let run = [];
    for (let x = 61; x < 941; x += 4) {
      if (pixels[(y * SIZE + x) * 4 + 3] > 90) run.push({ x, y, dx: 0, dy: 0 });
      else if (run.length) { lines.push(run); run = []; }
    }
    if (run.length) lines.push(run);
  }
}

function makePaper(p) {
  paper = p.createGraphics(SIZE, SIZE);
  paper.pixelDensity(1);
  paper.background('#f8f5ec');
  const random = randomSource(3817);
  paper.noStroke();
  for (let i = 0; i < 11000; i++) {
    paper.fill(124, 115, 88, 10 + random() * 12);
    paper.circle(random() * SIZE, random() * SIZE, .35 + random() * .8);
  }
}

function drawLeaf(p, leaf, amount, palette) {
  const length = leaf.length * amount;
  const width = length * leaf.width;
  p.push();
  p.translate(leaf.x, leaf.y);
  p.rotate(leaf.angle);
  p.noStroke();
  p.fill(palette.leaves[leaf.color]);
  p.beginShape();
  p.vertex(0, 0);
  p.bezierVertex(length * .33, -width, length * .77, -width * .65 + leaf.bend * length, length, leaf.bend * length);
  p.bezierVertex(length * .65, width * .7 + leaf.bend * length, length * .22, width * .9, 0, 0);
  p.endShape(p.CLOSE);
  p.stroke('#f8f5ecaa');
  p.strokeWeight(.65);
  p.line(0, 0, length * .9, leaf.bend * length * .85);
  p.pop();
}

function draw(p) {
  const palette = PALETTES[state.palette];
  p.image(paper, 0, 0);
  p.fill(palette.ink);
  p.noStroke();
  p.textFont('sans-serif');
  p.textSize(23);
  p.textAlign(p.LEFT);
  p.text('风向印刷所', 72, 79);
  p.textFont('monospace');
  p.textSize(11);
  p.textAlign(p.RIGHT);
  p.text('FIELD NOTES / No. ' + String(state.seed).padStart(6, '0'), 928, 78);
  p.stroke(palette.ink);
  p.strokeWeight(.8);
  p.line(72, 113, 928, 113);
  p.noFill();
  p.strokeWeight(2.05);
  let maxMotion = 0;
  for (const line of lines) {
    p.beginShape();
    for (const point of line) {
      const [dx, dy] = windOffset(point.x, point.y, pointer, state.mode);
      const speed = reducedMotion ? 1 : .17;
      point.dx += (dx - point.dx) * speed;
      point.dy += (dy - point.dy) * speed;
      if (Math.abs(point.dx - dx) < .08) point.dx = dx;
      if (Math.abs(point.dy - dy) < .08) point.dy = dy;
      maxMotion = Math.max(maxMotion, Math.abs(dx - point.dx), Math.abs(dy - point.dy));
      p.vertex(point.x + point.dx, point.y + point.dy);
    }
    p.endShape();
  }
  const growth = reducedMotion || exporting ? 1 : Math.min(1, (performance.now() - growthStart) / 650);
  renderedGrowth = growth;
  for (const branch of branches) {
    p.noFill();
    p.stroke(palette.ink + 'bb');
    p.strokeWeight(1.3);
    p.beginShape();
    for (const [x, y] of branch.points) p.vertex(x, y);
    p.endShape();
    for (const leaf of branch.leaves) {
      const amount = Math.max(0, Math.min(1, (growth * 1.5 - leaf.progress * .5)));
      drawLeaf(p, leaf, amount, palette);
    }
  }
  if (stroke?.length > 1) {
    const pending = makeBranch(stroke, state.density, state.seed);
    for (const leaf of pending.leaves) drawLeaf(p, leaf, 1, palette);
    p.noFill(); p.stroke(palette.ink); p.strokeWeight(1); p.beginShape();
    for (const point of stroke) p.vertex(...point);
    p.endShape();
  }
  p.noStroke();
  p.fill(palette.ink);
  p.textAlign(p.LEFT);
  p.textFont('sans-serif');
  p.textSize(20);
  p.text('让风，留下形状。', 72, 905);
  p.textFont('monospace');
  p.textSize(9);
  p.text('A STUDY OF WIND, LEAVES & LITTLE CHANCES.', 74, 932);
  p.textAlign(p.RIGHT);
  p.textSize(10);
  p.text('WIND / ' + state.palette.toUpperCase(), 928, 905);
  p.text('GENERATIVE PRINT · 1000 × 1000', 928, 932);
  if (growth >= 1 && maxMotion < .08 && !stroke) p.noLoop();
}

function position(event) {
  const rect = canvas.getBoundingClientRect();
  return [(event.clientX - rect.left) / rect.width * SIZE, (event.clientY - rect.top) / rect.height * SIZE];
}

function finishStroke(event) {
  if (event.pointerId !== activePointer) return;
  const committed = stroke?.length > 1;
  if (stroke?.length > 1) {
    state.strokes.push(stroke);
    announce(`已种下第 ${state.strokes.length} 枝。可以继续拖动，或导出这张印迹。`);
  }
  stroke = null;
  activePointer = null;
  pointer = null;
  if (committed) rebuild();
  else art.loop();
}

function installPointer() {
  canvas.addEventListener('pointerdown', event => {
    if (activePointer !== null || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.preventDefault();
    activePointer = event.pointerId;
    canvas.setPointerCapture(event.pointerId);
    const [x, y] = position(event);
    if (y >= 485 && y <= 845) {
      if (state.strokes.length >= 40) {
        announce('已达到 40 枝手绘上限，请撤销或清空后继续。', true);
      } else stroke = sampleStroke([], [x, y]);
    } else pointer = { x, y };
    art.loop();
  });
  canvas.addEventListener('pointermove', event => {
    if (activePointer !== null && activePointer !== event.pointerId) return;
    if (event.pointerType !== 'mouse' && activePointer === null) return;
    const [x, y] = position(event);
    if (stroke) stroke = sampleStroke(stroke, [x, y]);
    else pointer = { x, y };
    art.loop();
  });
  canvas.addEventListener('pointerleave', () => { if (activePointer === null) { pointer = null; art.loop(); } });
  canvas.addEventListener('pointerup', finishStroke);
  canvas.addEventListener('pointercancel', event => {
    if (event.pointerId !== activePointer) return;
    stroke = null; activePointer = null; pointer = null; art.loop();
  });
  canvas.addEventListener('lostpointercapture', event => {
    if (event.pointerId === activePointer) finishStroke(event);
  });
}

function readSeed() {
  const value = Number($('seed').value);
  if (!$('seed').checkValidity() || !Number.isInteger(value) || value < 1 || value > 999999999) {
    announce('种子需为 1 至 999999999 之间的整数。', true);
    $('seed').reportValidity();
    return null;
  }
  return value;
}

function regenerate() {
  const seed = readSeed();
  if (seed === null) return;
  if (state.locked) state.seed = seed;
  else {
    const values = crypto.getRandomValues(new Uint32Array(1));
    const next = 1 + values[0] % 999999999;
    state.seed = next === state.seed ? state.seed % 999999999 + 1 : next;
  }
  $('seed').value = state.seed;
  state.strokes = [];
  pointer = null;
  for (const line of lines) for (const point of line) { point.dx = 0; point.dy = 0; }
  rebuild();
  announce(state.locked ? '已用锁定种子重现构图，手绘已重置。' : '一阵新的风，一张新的印迹。');
}

async function exportPrint() {
  if (exporting) return;
  exporting = true;
  $('export').disabled = true;
  try {
    art.redraw();
    const blob = await new Promise((resolve, reject) => canvas.toBlob(value =>
      value ? resolve(value) : reject(new Error('无法编码 PNG 图片')), 'image/png'));
    const image = await createImageBitmap(blob);
    const valid = image.width === SIZE && image.height === SIZE;
    image.close();
    if (!valid) throw new Error('导出尺寸与画布不一致');
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url;
    link.download = `wind-${state.seed}-${state.palette}.png`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    announce('已导出 PNG · 1000 × 1000 px，文字与叶片均已包含。');
  } catch (error) {
    console.error(error);
    announce(`导出失败：${error.message}`, true);
  } finally {
    exporting = false;
    $('export').disabled = false;
  }
}

function bindControls() {
  document.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => {
    state.mode = button.dataset.mode;
    document.querySelectorAll('[data-mode]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    pointer = null;
    art.loop();
    announce(state.mode === 'restore' ? '风停了，文字正在回到原处。' : '在 WIND 上移动指针，感受' + (state.mode === 'push' ? '推开的风。' : '吸引的风。'));
  }));
  document.querySelectorAll('[data-palette]').forEach(button => button.addEventListener('click', () => {
    state.palette = button.dataset.palette;
    document.querySelectorAll('[data-palette]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    art.loop();
    announce(`已切换${state.palette === 'teal' ? '青绿' : '珊瑚'}油墨，构图保持不变。`);
  }));
  $('density').addEventListener('input', () => {
    state.density = Number($('density').value);
    $('density-value').value = state.density + '%';
    rebuild();
  });
  $('seed-lock').addEventListener('click', () => {
    if (!state.locked && readSeed() === null) return;
    state.locked = !state.locked;
    $('seed-lock').setAttribute('aria-pressed', String(state.locked));
    $('seed-lock').setAttribute('aria-label', state.locked ? '解锁随机种子' : '锁定随机种子');
    $('seed-lock').textContent = state.locked ? '已锁定' : '锁定';
    $('seed').disabled = state.locked;
    announce(state.locked ? '种子已锁定。重新生成将复现相同构图。' : '种子已解锁。重新生成将使用新种子。');
  });
  $('seed').addEventListener('change', () => {
    const seed = readSeed();
    if (seed === null) return;
    state.seed = seed; state.strokes = []; rebuild();
    announce(`正在使用种子 ${state.seed}。`);
  });
  $('regenerate').addEventListener('click', regenerate);
  $('undo').addEventListener('click', () => { state.strokes.pop(); rebuild(); announce('已撤销上一枝。'); });
  $('clear').addEventListener('click', () => { state.strokes = []; rebuild(); announce('已清空手绘，保留初始构图。'); });
  $('add-branch').addEventListener('click', () => {
    if (state.strokes.length >= 40) { announce('已达到 40 枝手绘上限，请撤销或清空后继续。', true); return; }
    const random = randomSource((state.seed + state.strokes.length * 7919) % 999999999 || 1);
    const x = 180 + random() * 420, y = 590 + random() * 125;
    state.strokes.push(Array.from({ length: 25 }, (_, i) => [x + i * 6, y + Math.sin(i / 24 * Math.PI) * 40 - i * 2]));
    rebuild(); announce('已添一枝，也可以在纸上拖动自由绘制。');
  });
  $('export').addEventListener('click', exportPrint);
}

function reportFailure(error) {
  window.__sceneError = String(error.stack || error);
  console.error(error);
  $('load-error').hidden = false;
  announce(`画布初始化失败：${error.message}`, true);
}

function setup(p) {
  art = p;
  const frame = p.createCanvas(SIZE, SIZE);
  frame.parent('poster');
  canvas = frame.elt;
  canvas.setAttribute('aria-label', '风向印刷海报：上方 WIND 线条可推开与吸引，下方拖动生长叶片。键盘可使用左侧添一枝及所有控制按钮。');
  canvas.setAttribute('role', 'img');
  p.pixelDensity(1);
  p.frameRate(30);
  makePaper(p);
  makeLetterLines();
  bindControls();
  installPointer();
  rebuild();
  window.windPrint = { getState: () => ({
    ...state, strokes: state.strokes.map(points => points.map(point => [...point])),
    leafCount: branches.reduce((sum, branch) => sum + branch.leaves.length, 0),
    displacement: Math.max(0, ...lines.flat().map(point => Math.hypot(point.dx, point.dy))),
    growing: renderedGrowth < 1,
    width: canvas.width, height: canvas.height,
  }) };
  window.__sceneReady = true;
  announce('纸张已就绪。移动指针起风，拖动种下叶片。');
}

try {
  if (!window.p5) throw new Error('p5.js 未能载入');
  new window.p5(p => {
    p.setup = () => {
      try { setup(p); }
      catch (error) { p.noLoop(); reportFailure(error); }
    };
    p.draw = () => {
      if (window.__sceneError) return;
      try { draw(p); }
      catch (error) { p.noLoop(); reportFailure(error); }
    };
  });
} catch (error) {
  reportFailure(error);
}
