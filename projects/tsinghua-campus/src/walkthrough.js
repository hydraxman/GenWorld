import * as THREE from 'three';

const contains = ([x, z], region, padding = 0) => x >= region.min[0] - padding && x <= region.max[0] + padding
  && z >= region.min[1] - padding && z <= region.max[1] + padding;

export function visitorFloor(spec, position) {
  const region = spec.zones.find(zone => contains(position, zone));
  return region?.floor;
}

export function visitorCanStand(spec, position) {
  const radius = .24;
  for (let i = 0; i < 8; i++) {
    const angle = i * Math.PI / 4, point = [position[0] + Math.cos(angle) * radius, position[1] + Math.sin(angle) * radius];
    if (!spec.zones.some(zone => contains(point, zone))) return false;
  }
  return !spec.obstacles.some(obstacle => contains(position, obstacle, radius));
}

export function stepVisitor(spec, from, delta) {
  if (![...from, ...delta].every(Number.isFinite)) throw new TypeError('Visitor movement requires finite local coordinates.');
  const position = [...from], steps = Math.max(1, Math.ceil(Math.hypot(...delta) / .1));
  for (let i = 0; i < steps; i++) {
    for (const axis of [0, 1]) {
      const next = [...position]; next[axis] += delta[axis] / steps;
      if (visitorCanStand(spec, next)) position[axis] = next[axis];
    }
  }
  return position;
}

export function advanceVisitorVelocity(velocity, target, seconds) {
  if (velocity.length !== 2 || target.length !== 2 || ![...velocity, ...target, seconds].every(Number.isFinite) || seconds < 0) {
    throw new TypeError('Visitor velocity requires two finite axes and nonnegative seconds.');
  }
  const decay = Math.exp(-12 * seconds);
  return {velocity: target.map((value, index) => value + (velocity[index] - value) * decay),
    delta: target.map((value, index) => value * seconds + (velocity[index] - value) * (1 - decay) / 12)};
}

export function setWalkViewport(camera, width, height, freeHeight) {
  camera.aspect = width / height; camera.fov = 65;
  if (width <= 850) {
    const visibleHeight = Math.max(120, freeHeight);
    // Keep at least 60 degrees horizontally as the compact panel reveals more height.
    camera.fov = Math.max(65, THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(Math.PI / 6) * visibleHeight / width)));
    camera.setViewOffset(width, visibleHeight, 0, 0, width, height);
  } else camera.clearViewOffset();
  camera.updateProjectionMatrix();
}

export function createWalkthrough({camera, controls, canvas, panel, onChange, onEnter = () => {}, onExit = () => {}, onInteract = () => {}}) {
  const keys = new Set(), held = new Set(), listeners = new AbortController();
  const options = {signal: listeners.signal};
  let anchor = null, spec = null, position, yaw = Math.PI, pitch = 0, snapshot = null, pointer = null, drag;
  let suspended = false, obstacles = [], velocity = [0, 0], entry = null;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const editable = target => target?.isContentEditable || /^(INPUT|SELECT|TEXTAREA)$/.test(target?.tagName);
  const allowed = new Set(['w', 'a', 's', 'd', 'q', 'e', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright']);
  const updateCamera = () => {
    anchor.updateWorldMatrix(true, false);
    const floor = visitorFloor(spec, position);
    if (floor === undefined) throw new Error('Visitor left the bounded lobby floor.');
    const eye = new THREE.Vector3(position[0], floor + spec.eyeHeight, position[1]);
    const target = eye.clone().add(new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)));
    camera.position.copy(anchor.localToWorld(eye)); camera.lookAt(anchor.localToWorld(target));
    const width = canvas.clientWidth, height = canvas.clientHeight;
    setWalkViewport(camera, width, height, panel.getBoundingClientRect().top - canvas.getBoundingClientRect().top);
    camera.updateMatrixWorld(true); onChange();
  };
  const release = () => {
    keys.clear(); held.clear(); velocity = [0, 0];
    if (pointer !== null && canvas.hasPointerCapture(pointer)) canvas.releasePointerCapture(pointer);
    pointer = null;
  };
  const exit = () => {
    if (!anchor) return;
    entry = null; onExit(); suspended = false; obstacles = [];
    release(); anchor = null; spec = null; panel.hidden = true;
    document.getElementById('workspace').classList.remove('walking');
    camera.position.copy(snapshot.position); camera.quaternion.copy(snapshot.quaternion);
    camera.fov = snapshot.fov; camera.near = snapshot.near; camera.far = snapshot.far;
    camera.aspect = canvas.clientWidth / canvas.clientHeight;
    if (snapshot.view?.enabled) {
      const view = snapshot.view, width = canvas.clientWidth, height = canvas.clientHeight;
      camera.setViewOffset(width, height, view.offsetX * width / view.fullWidth, view.offsetY * height / view.fullHeight,
        view.width * width / view.fullWidth, view.height * height / view.fullHeight);
    } else camera.clearViewOffset();
    camera.updateProjectionMatrix();
    controls.target.copy(snapshot.target); controls.enabled = snapshot.enabled; controls.update();
    document.getElementById('visit-building').value = '';
    document.getElementById('visit-building').focus({preventScroll: true});
    onChange();
  };
  document.addEventListener('keydown', event => {
    if (!anchor || suspended || editable(event.target)) return;
    if (event.key === 'Escape') {event.preventDefault(); exit(); return;}
    const key = event.key.toLowerCase();
    if (key === 'f' && !event.repeat && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault(); onInteract(); return;
    }
    if (allowed.has(key) && !event.ctrlKey && !event.metaKey && !event.altKey) {event.preventDefault(); keys.add(key);}
  }, options);
  document.addEventListener('keyup', event => {keys.delete(event.key.toLowerCase());}, options);
  const interrupt = () => {entry = null; release();};
  window.addEventListener('blur', interrupt, options);
  document.addEventListener('visibilitychange', () => {if (document.hidden) interrupt();}, options);
  window.addEventListener('resize', () => {if (anchor && !suspended) updateCamera();}, options);
  canvas.addEventListener('pointerdown', event => {
    if (!anchor || suspended || event.button !== 0 || pointer !== null) return;
    entry = null;
    pointer = event.pointerId; drag = [event.clientX, event.clientY]; canvas.setPointerCapture(pointer);
  }, options);
  canvas.addEventListener('pointermove', event => {
    if (!anchor || suspended || pointer !== event.pointerId) return;
    yaw -= (event.clientX - drag[0]) * .005;
    pitch = THREE.MathUtils.clamp(pitch - (event.clientY - drag[1]) * .004, -1.05, 1.05);
    drag = [event.clientX, event.clientY]; updateCamera();
  }, options);
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(name, () => {pointer = null;}, options);
  for (const button of panel.querySelectorAll('[data-walk]')) {
    const action = button.dataset.walk;
    button.addEventListener('pointerdown', event => {held.add(action); button.setPointerCapture(event.pointerId); event.preventDefault();}, options);
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(name, () => held.delete(action), options);
    button.addEventListener('click', event => {
      if (event.detail === 0 && anchor) {held.add(action); update(.15); held.delete(action);}
    }, options);
  }
  panel.querySelector('#exit-building').addEventListener('click', exit, options);
  panel.querySelector('#interact-exhibit').addEventListener('click', onInteract, options);
  function update(seconds) {
    if (!anchor || suspended || document.hidden) return false;
    const active = (...names) => names.some(name => held.has(name) || keys.has(name));
    const forward = Number(active('forward', 'w', 'arrowup')) - Number(active('back', 's', 'arrowdown'));
    const right = Number(active('right', 'd', 'arrowright')) - Number(active('left', 'a', 'arrowleft'));
    const turn = Number(active('turn-left', 'q')) - Number(active('turn-right', 'e'));
    const dt = Math.min(.15, Math.max(0, seconds));
    const collision = {...spec, obstacles: [...spec.obstacles, ...obstacles]};
    if (entry && !forward && !right && !turn) {
      entry.elapsed = Math.min(1.5, entry.elapsed + dt);
      const t = entry.elapsed / 1.5, ease = t * t * (3 - 2 * t);
      const next = spec.spawn.map((value, index) => value + (spec.entryTarget[index] - value) * ease);
      position = stepVisitor(collision, position, next.map((value, index) => value - position[index]));
      if (t === 1 || reducedMotion.matches) entry = null;
      updateCamera(); return true;
    }
    entry = null;
    if (!forward && !right && !turn && Math.hypot(...velocity) < .005) {velocity = [0, 0]; return false;}
    const speed = 2.4 / Math.max(1, Math.hypot(forward, right));
    yaw += turn * dt * 1.3;
    const motion = advanceVisitorVelocity(velocity, [(Math.sin(yaw) * forward - Math.cos(yaw) * right) * speed,
      (Math.cos(yaw) * forward + Math.sin(yaw) * right) * speed], dt);
    const next = stepVisitor(collision, position, motion.delta);
    velocity = motion.velocity.map((value, index) => Math.abs(next[index] - position[index] - motion.delta[index]) > .00001 ? 0 : value);
    position = next;
    updateCamera(); return true;
  }
  return {get active() {return Boolean(anchor);}, update, exit,
    suspend() {entry = null; release(); suspended = true;},
    resume() {suspended = false; if (anchor) updateCamera();},
    setObstacles(value) {obstacles = value;},
    enter(object) {
      if (!object?.userData.walkthrough) throw new Error('This building has no authored visitor lobby.');
      exit();
      const next = object.userData.walkthrough;
      if (!visitorCanStand(next, next.spawn)) throw new Error('Visitor spawn is obstructed.');
      if (next.entryTarget && !visitorCanStand(next, next.entryTarget)) throw new Error('Visitor entry destination is obstructed.');
      snapshot = {position: camera.position.clone(), quaternion: camera.quaternion.clone(), fov: camera.fov,
        near: camera.near, far: camera.far, view: camera.view ? {...camera.view} : null,
        target: controls.target.clone(), enabled: controls.enabled};
      anchor = object; spec = next; position = [...spec.spawn]; yaw = spec.yaw; pitch = 0;
      entry = spec.entryTarget && !reducedMotion.matches ? {elapsed: 0} : null;
      camera.clearViewOffset();
      controls.enabled = false; camera.fov = 65; camera.near = .06; camera.far = 6000; camera.updateProjectionMatrix();
      panel.querySelector('#walk-title').textContent = spec.title;
      panel.hidden = false; document.getElementById('workspace').classList.add('walking');
      onEnter(object);
      panel.querySelector('#exit-building').focus({preventScroll: true}); updateCamera();
    },
    state: () => ({active: Boolean(anchor), suspended, phase: !anchor ? 'outside' : entry ? 'entering' : 'inside',
      id: spec?.id ?? null, position: position ? [...position] : null, yaw, pitch}),
    dispose() {exit(); listeners.abort();}};
}
