import { FLOORS, getFloor, getRoom } from './curriculum.js';
import { STORAGE_KEY, createProfile, createDemoProfile, loadProfile, saveProfile, updateProfile,
  getMastery, summarizeProfile, describeRoom } from './learning.js';
import { getFloorAssessment } from './assessments.js';

const $ = id => document.getElementById(id);
function element(tag, className, text) {
  const entry = document.createElement(tag);
  if (className) entry.className = className;
  if (text !== undefined) entry.textContent = text;
  return entry;
}

export function createLearningUI({ navigate, onChange, reportError }) {
  let own = createProfile();
  let demo = createDemoProfile();
  let profileId = 'own';
  let heatmap = false;
  let persistent = true;
  let selectedFloor = 1;
  let selectedRoom = null;
  let examFloor = null;
  let submitted = false;
  function storageProblem(error) {
    persistent = false;
    $('storage-warning').textContent = `本地记录未能读取或保存：${error.message}。当前改动仅临时保留，原数据未覆盖；请先导出记录，排查浏览器存储设置后再清空重建。`;
    $('storage-warning').hidden = false;
    console.error(error);
  }
  try {
    own = loadProfile(window.localStorage);
  } catch (error) {
    storageProblem(error);
  }
  const active = () => profileId === 'own' ? own : demo;
  function commit(next) {
    if (profileId === 'own') {
      if (persistent) {
        try { saveProfile(window.localStorage, next); }
        catch (error) { storageProblem(error); }
      }
      own = next;
    } else demo = next;
    onChange();
  }
  function safe(handler) {
    return event => {
      try { handler(event); }
      catch (error) { reportError(error); }
    };
  }
  const now = () => new Date().toISOString();
  const date = at => at ? new Date(at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';

  function paintMap() {
    const profile = active();
    const summary = summarizeProfile(profile);
    $('learning-title').textContent = profileId === 'own' ? '我的学习地图' : '示例访客 · 非真实学习记录';
    $('learning-disclaimer').textContent = profileId === 'own'
      ? '你的知识可以是一座不规则的岛：高层熟练、底层薄弱都正常。这里分别记录探索、自评和概念测评，不把一次浏览当作学习成果。'
      : '这是用于展示热力图的虚构档案；你可以试着修改或做题，但不会写入“我的档案”。其他访客也是展示角色，不是在线用户。';
    $('learning-summary').replaceChildren();
    for (const [value, label] of [[summary.visited, '探索过的展厅'], [summary.known, '已有掌握度'], [summary.weak, '薄弱区域'], [summary.passedFloors.length, '楼层徽章']]) {
      const card = element('div', '');
      card.append(element('b', '', String(value)), element('span', '', label));
      $('learning-summary').append(card);
    }
    $('mastery-grid').replaceChildren();
    for (const floor of [...FLOORS].reverse()) {
      const row = element('div', 'mastery-row');
      const title = element('span', 'mastery-row-title', `${String(floor.number).padStart(2, '0')}F · ${floor.title}`);
      row.append(title);
      for (const room of floor.rooms) {
        const mastery = describeRoom(profile, room.id);
        const button = element('button', 'mastery-cell');
        button.dataset.mapRoom = room.id;
        button.style.setProperty('--mastery', mastery.color);
        button.append(element('span', '', room.name), element('b', '', mastery.score === null ? '—' : String(mastery.score)));
        button.title = `${room.name}：${mastery.label}，${mastery.source === 'exam' ? '测评' : mastery.source === 'self' ? '自评' : '暂无记录'}`;
        button.setAttribute('aria-label', `${floor.number}层${button.title}`);
        row.append(button);
      }
      $('mastery-grid').append(row);
    }
    $('visit-history').replaceChildren();
    for (const visit of summary.recent) {
      const room = getRoom(visit.roomId);
      const button = element('button', 'history-entry', `${room.floor}F · ${room.name}`);
      button.dataset.mapRoom = room.id;
      button.append(element('small', '', date(visit.visitedAt)));
      $('visit-history').append(button);
    }
    if (!summary.recent.length) $('visit-history').append(element('p', 'muted', '还没有探索记录，选择一个展厅开始。'));
    $('exam-history').replaceChildren();
    for (const attempt of [...profile.attempts].reverse().slice(0, 5)) {
      const entry = element('div', 'history-entry', `${attempt.floor}F · ${attempt.score} 分 / ${attempt.passed ? '已过关' : '待复习'}`);
      entry.append(element('small', '', date(attempt.at)));
      $('exam-history').append(entry);
    }
    if (!profile.attempts.length) $('exam-history').append(element('p', 'muted', '还没有试炼记录，随时可以挑战任意楼层。'));
    $('export-profile').disabled = profileId !== 'own';
    $('reset-profile').disabled = profileId !== 'own';
  }

  function paint(floorNumber, roomId) {
    selectedFloor = floorNumber;
    selectedRoom = roomId;
    const profile = active();
    const summary = summarizeProfile(profile);
    document.querySelectorAll('[data-profile]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.profile === profileId)));
    $('profile-name').textContent = profileId === 'own' ? '我的学习空间' : '示例访客 · 林同学';
    $('profile-badge').textContent = profileId === 'demo' ? '虚构示例' : persistent ? '仅本机保存' : '临时记录';
    $('profile-caption').textContent = profileId === 'demo' ? '数学熟练，部分基础待巩固。不是从低到高的单一等级。'
      : `${summary.passedFloors.length} 枚楼层徽章 · 浏览与掌握分别记录。`;
    $('visited-count').textContent = summary.visited;
    $('known-count').textContent = summary.known;
    $('weak-count').textContent = summary.weak;
    $('heatmap-toggle').setAttribute('aria-pressed', String(heatmap));
    $('heatmap-legend').hidden = !heatmap;
    const floor = getFloor(floorNumber);
    const scores = floor.rooms.map(room => describeRoom(profile, room.id).score).filter(score => score !== null);
    $('floor-mastery').textContent = scores.length ? `${scores.length}/4 个区域已评估 · 均值 ${Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)}` : '本层尚未评估';
    $('floor-heat-strip').replaceChildren();
    for (const room of floor.rooms) {
      const mastery = describeRoom(profile, room.id);
      const button = element('button', '');
      button.dataset.learningRoom = room.id;
      button.style.setProperty('--mastery', mastery.color);
      button.title = `${room.name} · ${mastery.label}${mastery.score === null ? '' : ` ${mastery.score}`}`;
      button.setAttribute('aria-label', button.title);
      button.textContent = mastery.score === null ? '—' : mastery.score;
      $('floor-heat-strip').append(button);
    }
    const latest = [...profile.attempts].reverse().find(attempt => attempt.floor === floorNumber);
    $('floor-exam-note').textContent = latest ? `最近试炼 ${latest.score} 分 · ${latest.passed ? '本层徽章已获得' : '错题待巩固'}；不限制继续探索。` : '4 道概念题 · 75 分过关 · 不限制楼层探索。';
    if (roomId) {
      const mastery = describeRoom(profile, roomId);
      $('room-mastery').textContent = `${mastery.label}${mastery.score === null ? '' : ` · ${mastery.score}`}`;
      $('room-mastery').style.color = mastery.color;
      $('mastery-source').textContent = { exam: '来自最近测评', self: '来自个人自评', unknown: '尚无掌握度记录' }[mastery.source];
      $('self-rating').querySelectorAll('[data-recorded-rating]').forEach(option => option.remove());
      if (mastery.selfRating !== null && ![0, 25, 50, 75, 100].includes(mastery.selfRating)) {
        const option = element('option', '', `${mastery.selfRating} · 已有自评记录`);
        option.value = mastery.selfRating;
        option.dataset.recordedRating = 'true';
        $('self-rating').append(option);
      }
      $('self-rating').value = mastery.selfRating === null ? '' : String(mastery.selfRating);
      $('self-rating-note').textContent = mastery.examScore === null ? '自评与测评分开保存；浏览不等于掌握。' : `最近概念题：${mastery.examScore} 分。热力图优先显示测评；可重做试炼更新。`;
    }
    document.querySelectorAll('#floor-nav [data-floor]').forEach(button => {
      const entries = getFloor(Number(button.dataset.floor)).rooms.map(room => describeRoom(profile, room.id));
      const known = entries.filter(entry => entry.score !== null);
      const weak = known.some(entry => entry.score < 40);
      button.classList.toggle('has-weakness', heatmap && weak);
      let dots = button.querySelector('.floor-mastery-dots');
      if (!dots) { dots = element('span', 'floor-mastery-dots'); button.append(dots); }
      dots.hidden = !heatmap;
      dots.replaceChildren();
      for (const entry of entries) {
        const dot = element('i', '');
        dot.style.background = entry.color;
        dot.title = entry.label;
        dots.append(dot);
      }
    });
    $('learner-roster').replaceChildren();
    const occupants = getSceneState().occupants;
    for (const occupant of occupants) {
      const button = element('button', 'learner-chip');
      const name = occupant.id === 'me' ? '我' : { lin: '林同学', chen: '陈同学', zhou: '周同学' }[occupant.id];
      button.dataset.learner = occupant.id;
      button.append(element('i', ''), document.createTextNode(`${name} · ${occupant.floor}F`));
      button.style.setProperty('--person', occupant.color);
      button.title = occupant.id === 'me' ? '当前探索位置，不代表掌握等级' : '虚构的示例访客位置';
      $('learner-roster').append(button);
    }
    if (profileId === 'demo') $('learner-roster').append(element('small', '', '示例角色 / 非在线用户'));
    if ($('learning-dialog').open) paintMap();
    window.__learningState = { profileId, heatmap, summary, mastery: getMastery(profile), position: profile.position };
  }

  function getSceneState() {
    const profile = active();
    return {
      heatmap, mastery: getMastery(profile), passedFloors: summarizeProfile(profile).passedFloors,
      occupants: profileId === 'own'
        ? [{ id: 'me', ...profile.position, color: '#f3cb82' }]
        : [{ id: 'lin', ...profile.position, color: '#83cfd0' },
          { id: 'chen', floor: 6, roomId: '6-2', color: '#c4ade5' },
          { id: 'zhou', floor: 11, roomId: '11-3', color: '#efa191' }],
    };
  }

  function recordVisit(floor, roomId) {
    let next = updateProfile(active(), { type: 'position', floor, roomId, at: now() });
    if (roomId) next = updateProfile(next, { type: 'visit', roomId, at: now() });
    commit(next);
  }

  function openExam(number = selectedFloor) {
    examFloor = number;
    submitted = false;
    const questions = getFloorAssessment(number);
    $('exam-title').textContent = `${String(number).padStart(2, '0')}F · ${getFloor(number).title} / ${profileId === 'demo' ? '示例试炼' : '知识试炼'}`;
    $('exam-questions').replaceChildren();
    questions.forEach((question, index) => {
      const fieldset = element('fieldset', 'exam-question');
      fieldset.append(element('legend', '', `${index + 1}. ${question.prompt}`), element('span', 'exam-room', getRoom(question.roomId).name));
      question.options.forEach((option, optionIndex) => {
        const label = element('label', 'exam-option');
        const input = element('input', '');
        input.type = 'radio';
        input.name = `question-${index}`;
        input.value = optionIndex;
        input.required = true;
        label.append(input, element('span', '', option));
        fieldset.append(label);
      });
      $('exam-questions').append(fieldset);
    });
    $('submit-exam').disabled = false;
    $('submit-exam').hidden = false;
    $('exam-result').hidden = true;
    $('exam-next-actions').hidden = true;
    if (!$('exam-dialog').open) $('exam-dialog').showModal();
  }

  document.querySelectorAll('[data-profile]').forEach(button => button.addEventListener('click', safe(() => {
    if (profileId === button.dataset.profile) return;
    profileId = button.dataset.profile;
    heatmap = profileId === 'demo';
    onChange();
  })));
  $('heatmap-toggle').addEventListener('click', safe(() => { heatmap = !heatmap; onChange(); }));
  $('locate-me').addEventListener('click', safe(() => {
    const { floor, roomId } = active().position;
    navigate(roomId ? { type: 'room', id: roomId } : { type: 'floor', number: floor });
  }));
  $('learner-roster').addEventListener('click', safe(event => {
    const button = event.target.closest('[data-learner]');
    if (!button) return;
    const person = getSceneState().occupants.find(entry => entry.id === button.dataset.learner);
    navigate(person.roomId ? { type: 'room', id: person.roomId } : { type: 'floor', number: person.floor });
  }));
  $('floor-heat-strip').addEventListener('click', safe(event => {
    const button = event.target.closest('[data-learning-room]');
    if (button) navigate({ type: 'room', id: button.dataset.learningRoom });
  }));
  $('self-rating').addEventListener('change', safe(event => {
    if (!selectedRoom) throw new Error('请先选择展厅');
    commit(updateProfile(active(), { type: 'rate', roomId: selectedRoom, score: event.target.value === '' ? null : Number(event.target.value), at: now() }));
  }));
  $('open-learning').addEventListener('click', safe(() => { paintMap(); $('learning-dialog').showModal(); }));
  $('close-learning').addEventListener('click', () => $('learning-dialog').close());
  for (const id of ['mastery-grid', 'visit-history']) $(id).addEventListener('click', safe(event => {
    const button = event.target.closest('[data-map-room]');
    if (button) { $('learning-dialog').close(); navigate({ type: 'room', id: button.dataset.mapRoom }); }
  }));
  $('export-profile').addEventListener('click', safe(() => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(own, null, 2)], { type: 'application/json' }));
    const link = element('a', '');
    link.href = url;
    link.download = `knowledge-profile-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }));
  $('reset-profile').addEventListener('click', safe(() => {
    if (!window.confirm('确定清空“我的档案”中的全部自评、探索和试炼记录？建议先导出；示例档案不会受影响。')) return;
    const next = createProfile();
    window.localStorage.removeItem(STORAGE_KEY);
    saveProfile(window.localStorage, next);
    own = next;
    persistent = true;
    $('storage-warning').hidden = true;
    onChange();
  }));
  for (const id of ['start-exam', 'checkpoint-label']) $(id).addEventListener('click', safe(() => openExam()));
  $('close-exam').addEventListener('click', () => $('exam-dialog').close());
  $('retry-exam').addEventListener('click', safe(() => openExam(examFloor)));
  $('next-floor').addEventListener('click', safe(() => {
    $('exam-dialog').close();
    navigate({ type: 'floor', number: examFloor === 16 ? 1 : examFloor + 1 });
  }));
  $('exam-form').addEventListener('submit', safe(event => {
    event.preventDefault();
    if (submitted || !$('exam-form').reportValidity()) return;
    const answers = Array.from({ length: 4 }, (_, index) => Number(new FormData($('exam-form')).get(`question-${index}`)));
    const next = updateProfile(active(), { type: 'exam', floor: examFloor, answers, at: now() });
    commit(next);
    submitted = true;
    $('submit-exam').hidden = true;
    $('exam-questions').querySelectorAll('input').forEach(input => { input.disabled = true; });
    const attempt = next.attempts.at(-1);
    $('exam-result').replaceChildren();
    $('exam-result').append(element('span', 'eyebrow', attempt.passed ? 'CHECKPOINT CLEARED' : 'A NEW WAY TO LEARN'),
      element('h3', '', `${attempt.score} 分 · ${attempt.passed ? '本层徽章已点亮' : '找到值得加强的地方'}`),
      element('p', '', profileId === 'demo' ? '结果仅更新示例档案，不写入你的记录。' : persistent ? '结果已保存在本机；四个展厅按各自答题结果更新。' : '结果仅在本页临时保留，请导出并检查存储。'));
    getFloorAssessment(examFloor).forEach((question, index) => {
      const correct = answers[index] === question.correctIndex;
      const entry = element('div', `answer-review ${correct ? 'correct' : 'incorrect'}`);
      entry.append(element('b', '', `${correct ? '✓' : '✕'} ${getRoom(question.roomId).name}`),
        element('p', '', `正确答案：${question.options[question.correctIndex]}`), element('p', '', question.explanation));
      $('exam-result').append(entry);
    });
    $('exam-result').hidden = false;
    $('exam-next-actions').hidden = false;
    $('next-floor').textContent = examFloor === 16 ? '回到底层继续探索 →' : '探索下一层 →';
    $('exam-result').scrollIntoView({ block: 'nearest' });
  }));

  return { paint, getSceneState, recordVisit };
}
