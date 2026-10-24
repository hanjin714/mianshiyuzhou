// ============================================================
// 面试宇宙 · 主程序
// ============================================================
import * as THREE from 'three';
import { WORLDS, WORLD_ORDER, GRADE_META } from './content.js';
import { createMinecraft } from './worlds/minecraft.js';
import { createEducation } from './worlds/education.js';
import { createSmarthome } from './worlds/smarthome.js';
import { Player } from './player.js';
import { NPC } from './npc.js';
import { makePortal, disposeObject, labelSprite } from './engine.js';
import { LLM, generateQuestion, generateReport, testConnection, resetQuestionMemory } from './ai.js';
import { computeResult, localNarrative, renderReportHTML, reportMarkdown } from './report.js';

const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shuffle = (arr) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// ---------------- 渲染器 ----------------
const canvas = $('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.18;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#03060a');
scene.fog = new THREE.Fog('#03060a', 20, 100);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 240);
camera.position.set(0, 1.7, 8);
scene.add(camera);

const player = new Player(camera, canvas);
let lightGroup = new THREE.Group();
scene.add(lightGroup);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------------- 状态 ----------------
const state = {
  mode: 'boot',
  order: [],
  sectorIndex: 0,
  worldId: null,
  world: null,
  npcs: [],
  portal: null,
  portalActive: false,
  perWorld: {},
  transcript: [],
  candidate: '#0000',
  doneCount: 0,
  runId: 0,
};
let focus = null;
let focusKey = '';
let currentResult = null;
let currentNarrative = null;
let currentAI = null;

const dlg = {
  npc: null,
  npcIndex: 0,
  qIndex: 0,
  question: null,
  history: [],
  busy: false,
  feedback: false,
  finished: false,
  typer: null,
};

// ---------------- 小工具 ----------------
let toastTimer;
function toast(msg, ms = 3200) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

function setAIStatus() {
  const online = LLM.isOnline();
  $('aiBadge').classList.toggle('online', online);
  $('aiBadgeText').textContent = online ? LLM.label() : 'LOCAL ENGINE';
}

function showLockHint(show) {
  const el = $('lockHint');
  if (!el) return;
  el.classList.toggle('hidden', !show);
}

player.onLockChange = (locked) => {
  $('crosshair').classList.toggle('active', locked);
  if (locked) showLockHint(false);
  else if (state.mode === 'explore') showLockHint(true);
};

// ---------------- 启动屏 ----------------
const BOOT_LINES = [
  ['> INIT candidate terminal ...', 'dim'],
  ['> MOUNT /worlds/il mango_skyblock.0x7f <span class="ok">OK</span>', ''],
  ['> MOUNT /worlds/lumen_ai_classroom <span class="ok">OK</span>', ''],
  ['> MOUNT /worlds/nest9_showroom <span class="ok">OK</span>', ''],
  ['> LOAD interviewer_personas × 9 <span class="ok">OK</span>', ''],
  ['> LLM uplink ... <span class="warn">OPTIONAL / FALLBACK READY</span>', ''],
  ['> RANDOM TELEPORT SEQUENCE <span class="ok">READY</span>', ''],
  ['<span class="dim">// 候选人，请确认：你愿意接受一条不可回头的世界线。</span>', ''],
];

async function bootSequence() {
  const box = $('bootLog');
  box.innerHTML = '';
  for (const [text, cls] of BOOT_LINES) {
    await sleep(180 + Math.random() * 160);
    const div = document.createElement('div');
    div.className = `ln ${cls}`;
    div.innerHTML = text;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
  }
  $('startBtn').disabled = false;
}

const tickerText = [
  '世界线 0x7F · 开局一棵树',
  'LUMEN 学区 · 一万名孩子',
  'NEST-9 · 89㎡ 三口之家',
  '9 位面试官正在等待',
  'A / B / C / D 四条结局',
  '面经将在终面后生成',
  '悖论矩阵 · INTERVIEWVERSE 2077',
];
$('tickerTrack').innerHTML = [...tickerText, ...tickerText].map((t) => `<span><b>◇</b> ${t}</span>`).join('');

bootSequence();

// ---------------- 世界构建 ----------------
const WORLD_FACTORY = {
  minecraft: createMinecraft,
  education: createEducation,
  smarthome: createSmarthome,
};

function applyEnvironment(env) {
  scene.background = new THREE.Color(env.bg);
  scene.fog = new THREE.Fog(env.fog.color, env.fog.near, env.fog.far);

  scene.remove(lightGroup);
  lightGroup.traverse((o) => { if (o.isLight) o.dispose?.(); });
  lightGroup = new THREE.Group();

  const amb = new THREE.AmbientLight(env.ambient.color, env.ambient.intensity);
  lightGroup.add(amb);
  const hemi = new THREE.HemisphereLight(env.hemi.sky, env.hemi.ground, env.hemi.intensity);
  lightGroup.add(hemi);
  const dir = new THREE.DirectionalLight(env.dir.color, env.dir.intensity);
  dir.position.set(...env.dir.pos);
  lightGroup.add(dir);
  scene.add(lightGroup);
}

function teardown() {
  if (state.world) {
    scene.remove(state.world.group);
    disposeObject(state.world.group);
  }
  state.world = null;
  state.npcs = [];
  state.portal = null;
  state.portalActive = false;
}

function buildWorld(id) {
  teardown();
  const world = WORLD_FACTORY[id]();
  scene.add(world.group);
  applyEnvironment(world.environment);

  state.worldId = id;
  state.world = world;
  state.doneCount = 0;
  state.perWorld[id] = {
    dims: Object.fromEntries(WORLDS[id].dims.map((d) => [d.key, 0])),
    answers: [],
  };

  const data = WORLDS[id];
  state.npcs = data.npcs.map((npcData, i) => {
    const npc = new NPC(npcData, world.npcSpots[i], i);
    world.group.add(npc.obj);
    return npc;
  });

  const portal = makePortal(data.accent);
  portal.position.x = world.portalPos.x;
  portal.position.z = world.portalPos.z;
  portal.visible = false;
  world.group.add(portal);
  state.portal = portal;

  player.setWorld(world.spawn, world.bounds, world.colliders);
  player.enabled = true;
  state.mode = 'explore';

  $('sectorCode').textContent = data.code;
  $('sectorWorld').textContent = data.name;
  updateProgress();

  $('worldTitleMain').textContent = data.name;
  $('worldTitleSub').textContent = `${data.en} · ${data.kicker.replace('// ', '')}`;
  const wt = $('worldTitle');
  wt.classList.remove('show');
  void wt.offsetWidth;
  wt.classList.add('show');

  showLockHint(!player.locked);
  setTimeout(() => toast('WASD 移动 · SHIFT 疾跑 · 靠近面试官按 E'), 1200);
}

function updateProgress() {
  $('npcProgress').textContent = `已面试 ${state.doneCount} / 3`;
  const pips = $('pipRow').children;
  for (let i = 0; i < 3; i++) pips[i].classList.toggle('on', i < state.doneCount);
}

// ---------------- 章节流程 ----------------
async function showTransition(index, final = false) {
  const world = !final ? WORLDS[state.order[index]] : null;
  $('trKicker').textContent = final ? '// FINAL SUBMISSION' : '// RECALIBRATING SPACETIME';
  $('trTitle').textContent = final ? 'FINAL' : `SECTOR 0${index + 1}`;
  $('trSub').textContent = final ? '提交终面 · 生成面经' : `${world.name} / ${world.en}`;
  $('trTip').textContent = final ? '所有世界线即将收束' : world.kicker.replace('// ', '');
  const el = $('transition');
  el.classList.remove('hidden');
  await sleep(2300);
  el.classList.add('hidden');
}

async function loadSector(i) {
  if (i >= state.order.length) {
    await finishRun();
    return;
  }
  state.mode = 'transition';
  player.enabled = false;
  player.unlock();
  hideDialogue();
  $('interact').classList.add('hidden');
  showLockHint(false);

  await showTransition(i, false);
  buildWorld(state.order[i]);
}

async function goNextSector() {
  if (!state.portalActive) return;
  state.portalActive = false;
  state.mode = 'transition';
  player.unlock();
  player.enabled = false;
  const next = state.sectorIndex + 1;
  if (next >= state.order.length) {
    await showTransition(next, true);
    await finishRun();
  } else {
    $('interact').classList.add('hidden');
    await showTransition(next, false);
    state.sectorIndex = next;
    buildWorld(state.order[next]);
  }
}

// ---------------- 交互 ----------------
function updateInteract() {
  let target = null;
  let text = '';
  let key = '';

  if (state.mode === 'explore' && state.world) {
    let best = null;
    let bestD = 3.8;
    for (const npc of state.npcs) {
      if (npc.interviewed) continue;
      const d = npc.distanceTo(player.pos);
      if (d < bestD && player.facingDot(npc.obj.position) > 0.15) { best = npc; bestD = d; }
    }
    if (best) {
      target = { type: 'npc', npc: best };
      text = `E 与 ${best.data.full} 对话`;
      key = `npc-${best.index}`;
    } else if (state.portalActive && state.portal) {
      const dx = player.pos.x - state.portal.position.x;
      const dz = player.pos.z - state.portal.position.z;
      if (Math.hypot(dx, dz) < 3.2) {
        target = { type: 'portal' };
        text = state.sectorIndex + 1 >= state.order.length ? 'E 提交终面 · 查看结果' : 'E 进入下一世界';
        key = 'portal';
      }
    }
  }

  if (key !== focusKey) {
    focusKey = key;
    focus = target;
    $('interact').classList.toggle('hidden', !key);
    if (key) $('interactText').textContent = text;
  }
}

function interact() {
  if (!focus) return;
  if (focus.type === 'npc') startDialogue(focus.npc);
  else if (focus.type === 'portal') goNextSector();
}

document.addEventListener('keydown', (e) => {
  if (state.mode === 'dialogue') {
    if (dlg.finished && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      closeDialogue();
    } else if (dlg.feedback && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      nextAfterFeedback();
    } else if (!dlg.busy && !dlg.feedback && dlg.question && /^[1-4]$/.test(e.key)) {
      chooseOption(Number(e.key) - 1);
    }
    return;
  }
  if (state.mode !== 'explore') return;
  const k = e.key.toLowerCase();
  if (k === 'e' || k === 'f') interact();
});

// ---------------- 对话 ----------------
function hideDialogue() {
  $('dialogue').classList.add('hidden');
  dlg.npc = null;
  dlg.busy = true;
  dlg.feedback = false;
  dlg.finished = false;
  dlg.question = null;
  clearInterval(dlg.typer);
}

function startDialogue(npc) {
  if (state.mode !== 'explore') return;
  state.mode = 'dialogue';
  player.enabled = false;
  player.unlock();
  showLockHint(false);
  $('interact').classList.add('hidden');
  focusKey = '';
  focus = null;

  const world = WORLDS[state.worldId];
  const idx = npc.index;
  dlg.npc = npc;
  dlg.npcIndex = idx;
  dlg.qIndex = 0;
  dlg.feedback = false;
  dlg.finished = false;
  dlg.question = null;
  dlg.busy = true;
  dlg.history = state.perWorld[state.worldId].answers
    .filter((a) => a.npcIndex === idx)
    .map((a) => ({ question: a.question, answer: a.answer }));

  const dlgEl = $('dialogue');
  dlgEl.classList.remove('hidden');

  $('dlgAvatar').textContent = npc.data.glyph;
  $('dlgAvatar').style.color = npc.data.accent;
  $('dlgAvatar').style.borderColor = npc.data.accent;
  $('dlgAvatar').style.background = 'rgba(255,255,255,.03)';
  $('dlgName').textContent = npc.data.full;
  $('dlgRole').textContent = npc.data.role;
  $('dlgRound').textContent = 'QUESTION 01 / 02';
  $('dlgSource').textContent = LLM.isOnline() ? 'AI LIVE' : 'LOCAL ENGINE';
  $('dlgHint').textContent = '面试官正在读取你的世界线…';

  $('dlgQuestion').innerHTML = '';
  $('dlgOptions').innerHTML = '';
  $('dlgFeedback').classList.add('hidden');
  $('dlgLoading').classList.remove('hidden');
  $('dlgLoadingText').textContent = `${npc.data.full} 正在根据你的世界线生成题目…`;

  setTimeout(() => loadQuestion(), 550);
}

async function loadQuestion() {
  const npc = dlg.npc;
  if (!npc) return;
  dlg.busy = true;
  dlg.question = null;
  dlg.feedback = false;
  $('dlgFeedback').classList.add('hidden');
  $('dlgOptions').innerHTML = '';
  $('dlgQuestion').innerHTML = '';
  $('dlgLoading').classList.remove('hidden');
  $('dlgRound').textContent = `QUESTION 0${dlg.qIndex + 1} / 02`;
  $('dlgHint').textContent = '面试官正在读取你的世界线…';

  const res = await generateQuestion({
    worldId: state.worldId,
    npcIndex: npc.index,
    qIndex: dlg.qIndex,
    history: dlg.history,
  });

  if (state.mode !== 'dialogue' || dlg.npc !== npc) return;

  dlg.busy = false;
  dlg.question = res;
  $('dlgLoading').classList.add('hidden');
  $('dlgSource').textContent = res.source === 'ai' ? 'AI LIVE' : 'LOCAL ENGINE';
  $('dlgHint').textContent = '按 1 – 4 选择，或点击选项';
  typeQuestion(res.question);
  renderOptions(res);
  if (res.error) toast('LLM 未响应，已切换本地题库');
}

function typeQuestion(text) {
  const el = $('dlgQuestion');
  clearInterval(dlg.typer);
  const mark = document.createElement('span');
  mark.className = 'qmark';
  mark.textContent = `Q.0${dlg.qIndex + 1} // ${dlg.npc ? dlg.npc.data.name : ''} 面试官`;
  const body = document.createElement('span');
  el.innerHTML = '';
  el.append(mark, body);
  let i = 0;
  dlg.typer = setInterval(() => {
    i += 2;
    body.textContent = text.slice(0, i);
    if (i >= text.length) {
      body.textContent = text;
      clearInterval(dlg.typer);
    }
  }, 14);
}

function renderOptions(res) {
  const box = $('dlgOptions');
  box.innerHTML = '';
  res.options.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'opt-btn';
    btn.style.animation = 'riseIn .35s cubic-bezier(.16,1,.3,1) both';
    btn.style.animationDelay = `${0.15 + i * 0.07}s`;
    btn.innerHTML = `<span class="o-idx">${'ABCD'[i]}</span><span>${opt.text}</span>`;
    btn.addEventListener('click', () => chooseOption(i));
    box.appendChild(btn);
  });
}

function chooseOption(i) {
  if (state.mode !== 'dialogue' || dlg.busy || dlg.feedback || dlg.finished || !dlg.question) return;
  const opt = dlg.question.options[i];
  if (!opt) return;

  const world = WORLDS[state.worldId];
  const data = state.perWorld[state.worldId];
  const buttons = [...$('dlgOptions').children];
  buttons.forEach((b, bi) => {
    b.classList.toggle('chosen', bi === i);
    if (bi !== i) b.classList.add('dim');
  });

  const dimKeys = world.dims.map((d) => d.key);
  dimKeys.forEach((k) => { data.dims[k] += opt.scores[k] || 0; });

  const sums = dlg.question.options.map((o) => dimKeys.reduce((s, k) => s + (o.scores[k] || 0), 0));
  const chosenSum = dimKeys.reduce((s, k) => s + (opt.scores[k] || 0), 0);
  const isBest = chosenSum === Math.max(...sums);
  const isLow = chosenSum < 6;

  const answer = {
    npcIndex: dlg.npc.index,
    npcName: dlg.npc.data.full,
    question: dlg.question.question,
    answer: opt.text,
    scores: { ...opt.scores },
    isBest,
    isLow,
  };
  data.answers.push(answer);
  state.transcript.push({ ...answer, world: world.name });

  dlg.history.push({ question: dlg.question.question, answer: opt.text });
  dlg.feedback = true;

  const sorted = dimKeys.map((k) => ({ key: k, name: world.dims.find((d) => d.key === k).name, v: opt.scores[k] || 0 }))
    .sort((a, b) => b.v - a.v)
    .slice(0, 2);

  const last = dlg.qIndex >= 1;
  const fb = $('dlgFeedback');
  fb.innerHTML = `
    <div class="fb-head"><span>▣</span>${dlg.npc.data.name} 的反应</div>
    <div>${opt.reaction}</div>
    <div class="fb-tags">${sorted.map((d) => `<span class="fb-tag">${d.name} ${d.v >= 3 ? '+' : '±'}${d.v}</span>`).join('')}</div>
    <div style="margin-top:14px;display:flex;justify-content:flex-end">
      <button type="button" class="ghost-btn" id="fbNext">${last ? '结束本轮面试 →' : '继续第 2 题 →'}</button>
    </div>`;
  fb.classList.remove('hidden');
  $('dlgHint').textContent = '按 Enter 继续';
  $('fbNext').addEventListener('click', nextAfterFeedback);
}

function nextAfterFeedback() {
  if (!dlg.feedback) return;
  dlg.feedback = false;
  $('dlgFeedback').classList.add('hidden');
  if (dlg.qIndex === 0) {
    dlg.qIndex = 1;
    loadQuestion();
  } else {
    finishNpc();
  }
}

function finishNpc() {
  const npc = dlg.npc;
  if (!npc || dlg.finished) return;
  dlg.finished = true;
  dlg.feedback = false;
  npc.markDone();
  state.doneCount++;
  updateProgress();

  const closing = document.createElement('div');
  closing.className = 'dlg-feedback';
  closing.innerHTML = `
    <div class="fb-head"><span>▣</span>${npc.data.full} 的结语</div>
    <div>${npc.data.closing}</div>
    <div style="margin-top:14px;display:flex;justify-content:flex-end">
      <button type="button" class="ghost-btn" id="leaveDlg">返回世界 →</button>
    </div>`;
  const body = $('dlgFeedback');
  body.innerHTML = closing.innerHTML;
  body.classList.remove('hidden');
  $('dlgQuestion').innerHTML = '<span class="qmark">// INTERVIEW COMPLETE</span><span>本轮面试结束。世界线已记录。</span>';
  $('dlgOptions').innerHTML = '';
  $('dlgHint').textContent = '按 Enter 返回世界';
  $('dlgRound').textContent = 'COMPLETE / 02';
  dlg.busy = true;
  dlg.feedback = true;

  const leave = () => closeDialogue();
  $('leaveDlg').addEventListener('click', leave);
  setTimeout(() => {
    const btn = $('leaveDlg');
    if (btn) btn.addEventListener('click', leave);
  }, 10);

  if (state.doneCount >= 3) {
    setTimeout(() => activatePortal(), 700);
  }
}

function closeDialogue() {
  hideDialogue();
  const el = $('dialogue');
  el.classList.add('hidden');
  state.mode = 'explore';
  player.enabled = true;
  player.lock();
  showLockHint(!player.locked);
}

function activatePortal() {
  if (!state.portal) return;
  state.portalActive = true;
  state.portal.visible = true;
  state.portal.userData.grow = 0;
  toast('世界线收束 · 传送门已开启', 4200);
}

// ---------------- 结算 ----------------
async function finishRun() {
  state.mode = 'report';
  player.unlock();
  player.enabled = false;
  showLockHint(false);
  $('interact').classList.add('hidden');

  currentResult = computeResult(state);
  currentNarrative = localNarrative(currentResult);
  currentAI = null;

  $('reportTitle').textContent = `${currentResult.grade} 级 · 面试结果`;
  $('reportBody').innerHTML = '<div class="report-loading">正在合成面经…<br><br>读取 3 条世界线 / 18 道题 / 9 位面试官</div>';
  $('report').classList.remove('hidden');
  $('hud').classList.add('hidden');

  let ai = null;
  if (LLM.isOnline()) {
    try {
      ai = await generateReport({
        grade: currentResult.grade,
        score: currentResult.overall,
        worldStats: currentResult.worldStats.map((w) => ({
          name: w.name, score: w.score, grade: w.grade, line: w.line,
        })),
        transcript: state.transcript,
      });
    } catch { ai = null; }
  }
  currentAI = ai;
  $('reportBody').innerHTML = renderReportHTML(currentResult, currentNarrative, ai);
}

function downloadReport() {
  if (!currentResult) return;
  const md = reportMarkdown(currentResult, currentNarrative, currentAI);
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `面试宇宙-面经-${currentResult.candidate}.md`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast('面经已下载');
}

function resetRun() {
  $('report').classList.add('hidden');
  $('hud').classList.remove('hidden');
  state.runId++;
  state.order = shuffle(WORLD_ORDER);
  state.sectorIndex = 0;
  state.perWorld = {};
  state.transcript = [];
  state.doneCount = 0;
  state.portalActive = false;
  state.candidate = '#' + Math.floor(Math.random() * 0xffff).toString(16).toUpperCase().padStart(4, '0');
  $('candidateCode').textContent = state.candidate;
  resetQuestionMemory();
  loadSector(0);
}

// ---------------- 雷达 ----------------
const radar = $('radar');
const rctx = radar.getContext('2d');
let radarAcc = 0;
function drawRadar(t, dt) {
  radarAcc += dt;
  if (radarAcc < 1 / 18) return;
  radarAcc = 0;
  const w = radar.width, h = radar.height;
  const cx = w / 2, cy = h / 2;
  const range = 26;
  rctx.clearRect(0, 0, w, h);

  rctx.strokeStyle = 'rgba(92,242,255,.16)';
  rctx.lineWidth = 1;
  for (let r = 0.33; r <= 1; r += 0.33) {
    rctx.beginPath();
    rctx.arc(cx, cy, (w / 2 - 8) * r, 0, Math.PI * 2);
    rctx.stroke();
  }
  rctx.beginPath();
  rctx.moveTo(cx, 8); rctx.lineTo(cx, h - 8);
  rctx.moveTo(8, cy); rctx.lineTo(w - 8, cy);
  rctx.stroke();

  const sweep = t * 1.2;
  const grad = rctx.createLinearGradient(cx, cy, cx + Math.cos(sweep) * w, cy + Math.sin(sweep) * h);
  grad.addColorStop(0, 'rgba(200,255,77,.35)');
  grad.addColorStop(1, 'rgba(200,255,77,0)');
  rctx.strokeStyle = grad;
  rctx.lineWidth = 2;
  rctx.beginPath();
  rctx.moveTo(cx, cy);
  rctx.lineTo(cx + Math.cos(sweep) * (w / 2 - 8), cy + Math.sin(sweep) * (w / 2 - 8));
  rctx.stroke();

  if (!state.world) return;
  const yaw = player.yaw;
  const sin = Math.sin(yaw), cos = Math.cos(yaw);
  const toScreen = (x, z) => {
    const dx = x - player.pos.x;
    const dz = z - player.pos.z;
    const rx = dx * cos - dz * sin;
    const ry = dx * sin + dz * cos;
    return [cx + (rx / range) * (w / 2 - 12), cy + (ry / range) * (h / 2 - 12)];
  };

  const data = WORLDS[state.worldId];
  state.npcs.forEach((npc) => {
    const [x, y] = toScreen(npc.obj.position.x, npc.obj.position.z);
    if (x < 0 || x > w || y < 0 || y > h) return;
    rctx.beginPath();
    rctx.arc(x, y, npc.interviewed ? 2.5 : 4, 0, Math.PI * 2);
    rctx.fillStyle = npc.interviewed ? 'rgba(120,150,160,.55)' : data.accent;
    rctx.shadowColor = data.accent;
    rctx.shadowBlur = npc.interviewed ? 0 : 8;
    rctx.fill();
    rctx.shadowBlur = 0;
  });

  if (state.portalActive && state.portal) {
    const [x, y] = toScreen(state.portal.position.x, state.portal.position.z);
    rctx.beginPath();
    rctx.arc(x, y, 4 + Math.sin(t * 4) * 1.2, 0, Math.PI * 2);
    rctx.strokeStyle = '#c8ff4d';
    rctx.lineWidth = 1.5;
    rctx.stroke();
  }

  rctx.save();
  rctx.translate(cx, cy);
  rctx.fillStyle = '#e9f6f2';
  rctx.beginPath();
  rctx.moveTo(0, -7);
  rctx.lineTo(5, 6);
  rctx.lineTo(0, 3);
  rctx.lineTo(-5, 6);
  rctx.closePath();
  rctx.fill();
  rctx.restore();

  $('radarCoord').textContent = `X ${player.pos.x.toFixed(0)} · Z ${player.pos.z.toFixed(0)}`;
}

// ---------------- 主循环 ----------------
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  if (state.world) {
    state.world.update(t);
    state.npcs.forEach((npc) => npc.update(t, player.pos));
    if (state.portal && state.portal.visible) {
      const p = state.portal;
      p.rotation.z = t * 0.4;
      p.userData.dust.rotation.z = -t * 0.9;
      p.userData.grow = Math.min(1, (p.userData.grow || 0) + dt * 1.6);
      const g = 1 - Math.pow(1 - p.userData.grow, 3);
      p.scale.setScalar(0.2 + g * 0.8);
    }
  }

  player.update(dt, t);
  updateInteract();
  drawRadar(t, dt);
  renderer.render(scene, camera);
}
animate();

// ---------------- 本地调试钩子（仅 localhost） ----------------
if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
  window.__IV__ = {
    state,
    dlg,
    talk: (i = 0) => startDialogue(state.npcs[i], i),
    close: () => closeDialogue(),
    sector: (i = 0) => loadSector(i),
    finish: () => {
      const blank = (id) => ({
        dims: Object.fromEntries(WORLDS[id].dims.map((d) => [d.key, 0])),
        answers: [],
      });
      state.order.forEach((id) => { if (!state.perWorld[id]) state.perWorld[id] = blank(id); });
      if (!state.perWorld[state.worldId]) state.perWorld[state.worldId] = blank(state.worldId);
      finishRun();
    },
  };
}

// ---------------- 设置 ----------------
let provider = LLM.cfg.provider;
function fillSettings() {
  $('inBase').value = LLM.cfg.baseURL;
  $('inKey').value = LLM.cfg.apiKey;
  $('inModel').value = LLM.cfg.model;
  $('inGeminiModel').value = LLM.cfg.geminiModel;
  provider = LLM.cfg.provider;
  [...$('providerSeg').children].forEach((b) => b.classList.toggle('active', b.dataset.provider === provider));
  syncProviderFields();
  $('settingsStatus').className = 'modal-status';
  $('settingsStatus').textContent = LLM.isOnline()
    ? `已接入：${LLM.label()}。出题与面经将实时调用大模型。`
    : '未连接外部模型，将使用内置题库与评分。';
}

function syncProviderFields() {
  const isLocal = provider === 'local';
  $('fieldBase').style.display = isLocal ? 'none' : '';
  $('fieldKey').style.display = isLocal ? 'none' : '';
  $('fieldModel').style.display = isLocal || provider === 'gemini' ? 'none' : '';
  $('fieldGeminiModel').style.display = provider === 'gemini' ? '' : 'none';
}

function openSettings() {
  fillSettings();
  $('settings').classList.remove('hidden');
}
function closeSettings() {
  $('settings').classList.add('hidden');
  if (state.mode === 'explore') player.lock();
}

$('bootSettings').addEventListener('click', openSettings);
$('hudSettings').addEventListener('click', openSettings);
$('closeSettings').addEventListener('click', closeSettings);

[...$('providerSeg').children].forEach((btn) => {
  btn.addEventListener('click', () => {
    provider = btn.dataset.provider;
    [...$('providerSeg').children].forEach((b) => b.classList.toggle('active', b === btn));
    syncProviderFields();
  });
});

$('saveSettings').addEventListener('click', () => {
  LLM.save({
    provider,
    baseURL: $('inBase').value.trim() || LLM.cfg.baseURL,
    apiKey: $('inKey').value.trim(),
    model: $('inModel').value.trim() || LLM.cfg.model,
    geminiModel: $('inGeminiModel').value.trim() || LLM.cfg.geminiModel,
  });
  setAIStatus();
  $('settingsStatus').className = 'modal-status ok';
  $('settingsStatus').textContent = LLM.isOnline() ? `已保存：${LLM.label()}` : '已切换为本地引擎。';
  toast(LLM.isOnline() ? 'LLM 已接入' : '已使用本地题库');
});

$('testConn').addEventListener('click', async () => {
  LLM.cfg = {
    ...LLM.cfg,
    provider,
    baseURL: $('inBase').value.trim() || LLM.cfg.baseURL,
    apiKey: $('inKey').value.trim(),
    model: $('inModel').value.trim() || LLM.cfg.model,
    geminiModel: $('inGeminiModel').value.trim() || LLM.cfg.geminiModel,
  };
  const st = $('settingsStatus');
  st.className = 'modal-status';
  st.textContent = '正在连接模型…';
  try {
    await testConnection();
    st.className = 'modal-status ok';
    st.textContent = `连接成功：${LLM.label()}。点击保存并应用。`;
  } catch (e) {
    st.className = 'modal-status err';
    st.textContent = `连接失败：${e.message}`;
  }
});

// ---------------- 报告按钮 ----------------
$('closeReport').addEventListener('click', () => {
  $('report').classList.add('hidden');
  $('hud').classList.remove('hidden');
  state.mode = 'explore';
  player.enabled = true;
  showLockHint(true);
});
$('downloadReport').addEventListener('click', downloadReport);
$('replayBtn').addEventListener('click', resetRun);

// ---------------- 启动 ----------------
$('startBtn').addEventListener('click', () => {
  state.candidate = '#' + Math.floor(Math.random() * 0xffff).toString(16).toUpperCase().padStart(4, '0');
  $('candidateCode').textContent = state.candidate;
  $('boot').classList.add('hidden');
  $('hud').classList.remove('hidden');
  setAIStatus();
  setAIStatus();
  resetQuestionMemory();
  state.order = shuffle(WORLD_ORDER);
  loadSector(0);
});

setAIStatus();
