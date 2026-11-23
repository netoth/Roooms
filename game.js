'use strict';

/* ============================================================
   Roooms — 2D roguelike
   ============================================================ */

const cvs = document.getElementById('game');
const ctx = cvs.getContext('2d');
const W = cvs.width;
const H = cvs.height;

const $ = (id) => document.getElementById(id);

// Тач-устройства получают джойстик и кнопку атаки; ПК сохраняет клавиатуру и мышь
const isTouchDevice = new URLSearchParams(location.search).has('touch')
  || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches)
  || navigator.maxTouchPoints > 0;
if (isTouchDevice) document.documentElement.classList.add('touch');

const touchMove = { active: false, x: 0, y: 0, id: null, cx: 0, cy: 0 };
const screens = {
  menu: $('menu'),
  info: $('infoScreen'),
  settings: $('settingsScreen'),
  game: $('gameScreen'),
  choice: $('choiceScreen'),
  inventory: $('inventoryScreen'),
  debug: $('debugScreen'),
  pause: $('pauseScreen'),
  exitConfirm: $('exitConfirmScreen'),
  confirm: $('confirmScreen'),
  end: $('endScreen'),
};

// Примерно в 1,5 раза больше графика (и зоны столкновений) игрока, мобов и боссов
const SIZE_SCALE = 1.5;
// Примерно в 1,5 раза выше скорость игрока, мобов и боссов
const SPEED_SCALE = 1.5;

const BASE_SPEED = Math.round(185 * SPEED_SCALE);

// Препятствия: блок 3×3 напольных квадрата, между блоками минимум 3 квадрата пустоты
const FLOOR_TILE = 24;
const BLOCK_TILES = 3;
const BLOCK_GAP_TILES = 3;
const BLOCK_CLEAR_TILES = 6; // зона центра без блоков
const WALL_TILES_W = 10;     // стена: 10 квадратов в ширину
const WALL_TILES_H = 2;      // и 2 квадрата в высоту
const COLLISION_EPS = 0.01;  // погрешность округления при касании препятствия

const SAVE_KEY = 'ten_rooms_save_v1';
const SOUND_KEY = 'ten_rooms_sound_v1';
const LEGACY_VERSION_NOTICE_ID = 'version-panel';
let pendingNoticeDismiss = false;

// ID метки привязан к номеру версии: новая версия = новый ID = метка показывается
// один раз у каждого игрока, даже на GitHub Pages, где сохранение живёт в localStorage.
function versionNoticeId() {
  const el = document.querySelector('.version-value');
  const version = (el && el.textContent ? el.textContent : '').trim() || '1.1';
  return `version-panel-${version}`;
}

// Сложность задаёт параметры врагов и правила волн.
const DIFFICULTIES = {
  easy:   { statMul: 1, countMul: 1, healOnRoom: true, xpMul: 0.5 },
  normal: { statMul: 1, countMul: 1, healOnRoom: true, xpMul: 1 },
  hard:   { statMul: 1, countMul: 0.5, healOnRoom: true, xpMul: 2 },
  ultra:  { statMul: 1.2, countMul: 3, healOnRoom: false, xpMul: 5 },
};

// min/max — размер волны; fraction — какая доля предыдущей волны должна быть
// убита для вызова следующей; timeout — через сколько секунд новая волна
// придёт в любом случае (только в сложном режиме).
const WAVE_RULES = {
  easy:   { min: 2, max: 3, fraction: 1,   timeout: 0 },
  normal: { min: 3, max: 5, fraction: 0.5, timeout: 0 },
  hard:   { min: 4, max: 5, fraction: 0.5, timeout: 5 },
  ultra:  { min: 5, max: 6, fraction: 0.2, timeout: 0 },
};

/* ---------- Сохранение ---------- */
// Основной источник — save.json рядом с игрой (через локальный сервер).
// localStorage остаётся зеркалом и запасным вариантом для file://.
const SAVE_API = '/api/save';
let saveSource = 'local';
let saveLoading = true;

function normalizeSave(data) {
  const seenNotices = data && Array.isArray(data.seenNotices)
    ? [...new Set(data.seenNotices.filter(id => typeof id === 'string'))]
    : [];
  // Старые сохранения с уже просмотренной меткой не должны получать её повторно
  if (seenNotices.includes(LEGACY_VERSION_NOTICE_ID)) {
    const old = seenNotices.indexOf(LEGACY_VERSION_NOTICE_ID);
    if (old !== -1) seenNotices.splice(old, 1);
    if (!seenNotices.includes(versionNoticeId())) seenNotices.push(versionNoticeId());
  }
  return {
    level: Math.max(1, Math.floor(Number(data && data.level) || 1)),
    xp: Math.max(0, Math.floor(Number(data && data.xp) || 0)),
    lang: data && data.lang === 'ru' ? 'ru' : 'en',
    seenNotices,
  };
}

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) return normalizeSave(JSON.parse(raw));
  } catch (e) { /* localStorage может быть недоступен */ }
  return { level: 1, xp: 0, lang: 'en', seenNotices: [] };
}

function persistLocal() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* ignore */ }
}

async function loadServerSave() {
  try {
    const res = await fetch(SAVE_API, { cache: 'no-store' });
    if (res.ok) {
      save = normalizeSave(await res.json());
      saveSource = 'server';
      // Если уведомление закрыли до загрузки серверного сохранения — не показываем его снова.
      if (pendingNoticeDismiss) {
        if (!save.seenNotices.includes(versionNoticeId())) save.seenNotices.push(versionNoticeId());
        pendingNoticeDismiss = false;
        persist();
      }
      // Язык из сохранения — такой же постоянный параметр, как уровень.
      if (window.I18N && I18N.getLanguage() !== save.lang) I18N.setLanguage(save.lang);
      refreshMenu();
      applyNotices();
    }
  } catch (e) {
    /* сервер недоступен — остаётся localStorage */
    if (window.I18N && I18N.getLanguage() !== save.lang) I18N.setLanguage(save.lang);
  }
  finally {
    saveLoading = false;
    updateSaveLoadingUI();
  }
}

function persist() {
  persistLocal();
  if (saveSource !== 'server') return;
  fetch(SAVE_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(save),
    keepalive: true,
  }).catch(() => {});
}

// Уведомления об обновлениях живут в сохранении и показываются один раз.
function applyNotices() {
  const show = !save.seenNotices.includes(versionNoticeId());
  $('settingsBtn').classList.toggle('has-notice', show);
  $('versionNotice').classList.toggle('has-notice', show);
}

function dismissVersionNotice() {
  if (!save.seenNotices.includes(versionNoticeId())) {
    save.seenNotices.push(versionNoticeId());
    if (saveLoading) pendingNoticeDismiss = true;
    persist();
  }
  applyNotices();
}

function updateSaveLoadingUI() {
  const btn = $('playBtn');
  if (!btn) return;
  btn.disabled = saveLoading;
  btn.textContent = saveLoading ? 'ЗАГРУЗКА...' : 'ИГРАТЬ';
}

let save = loadSave();
let selectedMode = 'normal'; // normal | hundred
let selectedDifficulty = 'normal'; // easy | normal | hard | ultra
let selectedLanguage = save.lang; // ru | en — берём из сохранения, как и уровень
let debugGodMode = false;
let debugFullControl = false;
let mode = 'menu';        // menu | intro | spawn | play | choice | inventory | end
let run = null;
let lastTime = performance.now();
let bannerTimer = null;
let endTimer = null;
let choiceTimer = null;
let introTimer = null;
let introPlayTimer = null;
let fadeBusy = false;
let choicePicks = [];
let choiceSelected = [];
let inventorySelected = 'melee';
let confirmReturn = null; // куда вернуться после подтверждения сброса
let pausedFrom = null;    // play | choice | inventory
let choicePendingResume = false;
let debugReturn = 'menu'; // откуда открыто меню отладки: menu | pause
let debugSpeed = 1;       // спидхак: множитель скорости игры
let debugGameplay = false;      // главный выключатель боковой панели: без него панели нет нигде
let debugGameInGame = false;    // при включённом главном — показывать панель и во время забега
let debugAutoAttack = false;    // зажатие атаки для любого оружия
let debugEnemyPause = false;    // враги замирают и не атакуют
let debugFreeChoice = false;    // меню баффов открыто из боковой панели, без завершения комнаты
let debugFreeInventory = false; // инвентарь открыт из боковой панели, без завершения комнаты

const keys = new Set();
const mouse = { x: W / 2, y: H / 2, down: false };

/* ---------- Звук: синтезируется через Web Audio, без внешних файлов ---------- */
const MASTER_VOLUME = 0.18;
let soundEnabled = true;
try {
  const storedSound = localStorage.getItem(SOUND_KEY);
  if (storedSound !== null) soundEnabled = storedSound === '1';
} catch (e) { /* localStorage может быть недоступен */ }

let audioCtx = null;
let masterGain = null;
let noiseBuffer = null;
let audioUnlocked = false;
const lastSfx = Object.create(null);

function ensureAudio() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!audioCtx) {
    try {
      audioCtx = new AC();
      masterGain = audioCtx.createGain();
      masterGain.gain.value = soundEnabled ? MASTER_VOLUME : 0;
      masterGain.connect(audioCtx.destination);
    } catch (e) {
      audioCtx = null;
      masterGain = null;
      return null;
    }
  }
  if (audioCtx.state === 'suspended') {
    const resumed = audioCtx.resume();
    if (resumed && typeof resumed.catch === 'function') resumed.catch(() => {});
  }
  return audioCtx;
}

function unlockAudio() {
  audioUnlocked = true;
  ensureAudio();
}

function getNoiseBuffer(ctx) {
  if (!noiseBuffer || noiseBuffer.sampleRate !== ctx.sampleRate) {
    const len = Math.floor(ctx.sampleRate * 0.5);
    noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  }
  return noiseBuffer;
}

function setEnvelope(gain, t, dur, vol, attack) {
  const a = Math.min(attack || 0.004, dur * 0.4);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + a);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
}

function playTone(freq, dur, opts) {
  const ctx = ensureAudio();
  if (!ctx || !masterGain) return;
  opts = opts || {};
  const t = ctx.currentTime + (opts.delay || 0);
  const osc = ctx.createOscillator();
  osc.type = opts.type || 'sine';
  const f = Math.max(20, freq * (opts.vary ? rand(0.96, 1.04) : 1));
  osc.frequency.setValueAtTime(f, t);
  if (opts.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.to), t + dur);
  const gain = ctx.createGain();
  setEnvelope(gain, t, dur, opts.vol == null ? 0.15 : opts.vol, opts.attack);
  osc.connect(gain);
  gain.connect(masterGain);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function playNoise(dur, opts) {
  const ctx = ensureAudio();
  if (!ctx || !masterGain) return;
  opts = opts || {};
  const t = ctx.currentTime + (opts.delay || 0);
  const src = ctx.createBufferSource();
  src.buffer = getNoiseBuffer(ctx);
  const filter = ctx.createBiquadFilter();
  filter.type = opts.filter || 'lowpass';
  filter.frequency.setValueAtTime(opts.freq || 1000, t);
  if (opts.to) filter.frequency.exponentialRampToValueAtTime(Math.max(60, opts.to), t + dur);
  const gain = ctx.createGain();
  setEnvelope(gain, t, dur, opts.vol == null ? 0.12 : opts.vol, opts.attack || 0.002);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(masterGain);
  src.start(t);
  src.stop(t + dur + 0.02);
}

const SFX = {
  ui: () => playTone(660, 0.055, { type: 'sine', to: 880, vol: 0.10 }),
  confirm: () => {
    playTone(520, 0.08, { type: 'triangle', vol: 0.13 });
    playTone(780, 0.12, { type: 'triangle', vol: 0.13, delay: 0.07 });
  },
  select: () => playTone(440, 0.05, { type: 'sine', to: 620, vol: 0.10 }),
  room: () => {
    playTone(392, 0.16, { type: 'sine', to: 523, vol: 0.12 });
    playTone(523, 0.18, { type: 'sine', vol: 0.10, delay: 0.09 });
  },
  boss: () => {
    playTone(110, 0.5, { type: 'sawtooth', to: 82, vol: 0.16, attack: 0.02 });
    playTone(165, 0.45, { type: 'triangle', to: 123, vol: 0.10, delay: 0.05 });
    playNoise(0.4, { freq: 400, to: 120, vol: 0.10 });
  },
  spawn: () => playTone(220, 0.11, { type: 'sine', to: 330, vol: 0.055, vary: true }),
  swing: () => {
    playNoise(0.09, { filter: 'highpass', freq: 1300, to: 700, vol: 0.11 });
    playTone(260, 0.08, { type: 'triangle', to: 150, vol: 0.08, vary: true });
  },
  axe: () => {
    playNoise(0.12, { filter: 'bandpass', freq: 900, to: 400, vol: 0.14 });
    playTone(170, 0.11, { type: 'sawtooth', to: 90, vol: 0.09, vary: true });
  },
  dash: () => {
    playTone(900, 0.18, { type: 'sine', to: 280, vol: 0.14 });
    playNoise(0.16, { filter: 'highpass', freq: 1800, to: 800, vol: 0.10 });
  },
  shot: () => {
    playTone(200, 0.07, { type: 'square', to: 90, vol: 0.12, vary: true });
    playNoise(0.07, { freq: 1800, to: 600, vol: 0.12 });
  },
  shotgun: () => {
    playNoise(0.2, { freq: 1200, to: 260, vol: 0.22, attack: 0.004 });
    playTone(120, 0.16, { type: 'square', to: 55, vol: 0.15 });
  },
  mg: () => {
    playTone(240, 0.045, { type: 'square', to: 110, vol: 0.09, vary: true });
    playNoise(0.045, { freq: 2200, to: 800, vol: 0.08 });
  },
  mgStart: () => playTone(320, 0.07, { type: 'square', to: 480, vol: 0.07 }),
  overheat: () => {
    playTone(300, 0.22, { type: 'square', to: 110, vol: 0.12 });
    playTone(220, 0.16, { type: 'sine', to: 90, vol: 0.09, delay: 0.1 });
  },
  hit: () => {
    playTone(340, 0.07, { type: 'triangle', to: 190, vol: 0.12, vary: true });
    playNoise(0.05, { freq: 2400, to: 900, vol: 0.08 });
  },
  kill: () => playTone(250, 0.14, { type: 'triangle', to: 95, vol: 0.14, vary: true }),
  bossDown: () => {
    playNoise(0.5, { freq: 900, to: 90, vol: 0.22, attack: 0.01 });
    playTone(150, 0.45, { type: 'sawtooth', to: 45, vol: 0.18 });
    playTone(520, 0.3, { type: 'sine', to: 180, vol: 0.10, delay: 0.12 });
  },
  hurt: () => {
    playTone(190, 0.17, { type: 'sawtooth', to: 70, vol: 0.18, vary: true });
    playNoise(0.09, { freq: 900, to: 300, vol: 0.10 });
  },
  stun: () => {
    playTone(150, 0.2, { type: 'square', to: 80, vol: 0.13 });
    playNoise(0.12, { filter: 'highpass', freq: 800, vol: 0.08 });
  },
  explosion: () => {
    playNoise(0.34, { freq: 900, to: 110, vol: 0.24, attack: 0.006 });
    playTone(90, 0.3, { type: 'sine', to: 38, vol: 0.18 });
  },
  choice: () => {
    playTone(523, 0.14, { type: 'triangle', vol: 0.12 });
    playTone(659, 0.18, { type: 'triangle', vol: 0.12, delay: 0.11 });
  },
  levelup: () => {
    [523, 659, 784, 1047].forEach((f, i) => playTone(f, 0.16, { type: 'triangle', vol: 0.12, delay: i * 0.09 }));
  },
  win: () => {
    [523, 659, 784, 1047, 1319].forEach((f, i) => playTone(f, 0.28, { type: 'triangle', vol: 0.14, delay: i * 0.12 }));
  },
  lose: () => {
    [330, 262, 196, 131].forEach((f, i) => playTone(f, 0.3, { type: 'sawtooth', vol: 0.12, delay: i * 0.15 }));
  },
};

const SFX_COOLDOWN = {
  hit: 0.035, kill: 0.05, shot: 0.03, mg: 0.02, spawn: 0.25, hurt: 0.15, swing: 0.06, ui: 0.03,
};

function sfx(name) {
  if (!soundEnabled || !audioUnlocked) return;
  const ctx = ensureAudio();
  if (!ctx || !SFX[name]) return;
  const now = ctx.currentTime;
  if (now - (lastSfx[name] || -10) < (SFX_COOLDOWN[name] || 0)) return;
  lastSfx[name] = now;
  try { SFX[name](); } catch (e) { /* звук не должен ломать игру */ }
}

function persistSound() {
  try { localStorage.setItem(SOUND_KEY, soundEnabled ? '1' : '0'); } catch (e) { /* ignore */ }
}

function syncSoundButtons() {
  const text = soundEnabled ? 'ЗВУК: ВКЛ' : 'ЗВУК: ВЫКЛ';
  for (const id of ['soundBtn', 'pauseSoundBtn']) {
    const btn = $(id);
    if (!btn) continue;
    btn.textContent = text;
    btn.classList.toggle('on', soundEnabled);
  }
  if (masterGain) masterGain.gain.value = soundEnabled ? MASTER_VOLUME : 0;
}

function toggleSound() {
  soundEnabled = !soundEnabled;
  persistSound();
  syncSoundButtons();
}

// Браузер разрешает звук только после действия пользователя
window.addEventListener('pointerdown', unlockAudio, { once: true });
window.addEventListener('keydown', unlockAudio, { once: true });

/* ---------- Экранные методы ---------- */
function showBase(name) {
  screens.menu.classList.toggle('active', name === 'menu');
  screens.info.classList.toggle('active', name === 'info');
  screens.settings.classList.toggle('active', name === 'settings');
  screens.game.classList.toggle('active', name === 'game');
}

// Меню и энциклопедия используют те же размеры окна, что и игровой экран.
// Игровой экран скрыт в меню, поэтому на время замера включаем его без отрисовки кадра.
function syncWindowSize() {
  const game = screens.game;
  const wasActive = game.classList.contains('active');
  const hidden = [];
  if (!wasActive) {
    // В мобильной раскладке экраны — flex-элементы: остальные надо убрать,
    // иначе игровой экран получит неполную высоту контейнера
    for (const el of [screens.menu, screens.info, screens.settings]) {
      if (el.classList.contains('active')) { el.classList.remove('active'); hidden.push(el); }
    }
    game.classList.add('active');
  }
  // Гарантируем, что flex-полоса комнат успела разложиться до замера.
  void game.offsetHeight;
  const rect = game.getBoundingClientRect();
  if (!wasActive) {
    game.classList.remove('active');
    hidden.forEach((el) => el.classList.add('active'));
  }
  document.documentElement.style.setProperty('--game-window-w', `${rect.width}px`);
  document.documentElement.style.setProperty('--game-window-h', `${rect.height}px`);
  // На ПК боковая панель отладки привязывается низом к низу игрового окна
  const bottomGap = Math.max(12, window.innerHeight - rect.bottom);
  document.documentElement.style.setProperty('--debug-panel-bottom', `${bottomGap}px`);
}
window.addEventListener('resize', syncWindowSize);

/* ---------- Оживлённое окно с врагами в главном меню ---------- */
const previewCanvas = $('previewCanvas');
const pctx = previewCanvas.getContext('2d');
let previewW = 0;
let previewH = 0;
let previewEnemies = [];
const previewParticles = [];
const PREVIEW_BASE_COUNT = 7;
const PREVIEW_MAX_ENEMIES = 140;
const PREVIEW_MAX_KILLS = 50;
const PREVIEW_IDLE_SECONDS = 15;
let previewKills = 0;
let previewIdleTimer = 0;
let previewSpawnBlocked = false;

function resizePreviewCanvas() {
  const rect = previewCanvas.getBoundingClientRect();
  const w = Math.max(1, Math.round(rect.width));
  const h = Math.max(1, Math.round(rect.height));
  if (w === previewW && h === previewH) return;
  previewW = w;
  previewH = h;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  previewCanvas.width = Math.round(w * dpr);
  previewCanvas.height = Math.round(h * dpr);
  pctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (!previewSpawnBlocked && !previewEnemies.length) {
    for (let i = 0; i < PREVIEW_BASE_COUNT; i++) previewEnemies.push(makePreviewEnemy(true));
  }
}

function makePreviewEnemy(initial = false) {
  const angle = rand(0, Math.PI * 2);
  const vx = Math.cos(angle);
  const vy = Math.sin(angle);
  const margin = 34;
  let x, y;
  if (initial) {
    x = rand(24, Math.max(25, previewW - 24));
    y = rand(24, Math.max(25, previewH - 24));
  } else if (Math.abs(vx) > Math.abs(vy)) {
    x = vx > 0 ? -margin : previewW + margin;
    y = rand(-10, previewH + 10);
  } else {
    x = rand(-10, previewW + 10);
    y = vy > 0 ? -margin : previewH + margin;
  }
  return {
    x, y, vx, vy,
    speed: rand(34, 82),
    r: rand(10, 15),
    boss: Math.random() < 0.16,
    phase: rand(0, Math.PI * 2),
    spawnAnim: 0.45,
    dead: false,
    deathAnim: 0,
    delay: initial ? rand(0, 0.8) : rand(0.25, 1.5),
  };
}

function drawPreviewGrid() {
  pctx.fillStyle = 'rgba(120,140,220,.07)';
  for (let x = 0; x <= previewW; x += 34) pctx.fillRect(x, 0, 1, previewH);
  for (let y = 0; y <= previewH; y += 34) pctx.fillRect(0, y, previewW, 1);
}

function drawPreviewEnemy(e) {
  const total = 0.45;
  const k = e.spawnAnim > 0 ? clamp(1 - e.spawnAnim / total, 0, 1) : 1;
  const boss = e.boss;
  pctx.save();
  pctx.translate(e.x, e.y);
  if (k < 1) {
    pctx.globalAlpha = 0.3 + 0.7 * k;
    pctx.scale(0.35 + 0.65 * k, 0.35 + 0.65 * k);
    pctx.strokeStyle = boss ? 'rgba(255,92,138,.9)' : 'rgba(155,123,255,.9)';
    pctx.lineWidth = 2;
    pctx.beginPath(); pctx.arc(0, 0, e.r + 16 * (1 - k), 0, Math.PI * 2); pctx.stroke();
  }
  pctx.rotate(Math.sin(performance.now() / 500 + e.phase) * 0.12);
  pctx.shadowColor = boss ? '#ff5c8a' : '#9b7bff';
  pctx.shadowBlur = boss ? 22 : 13;
  pctx.fillStyle = boss ? '#5c1d3d' : '#4a3789';
  pctx.beginPath();
  const sides = boss ? 8 : 6;
  for (let i = 0; i < sides; i++) {
    const a = Math.PI / sides + (i / sides) * Math.PI * 2;
    const rr = e.r + (boss && i % 2 === 0 ? 3 : 0);
    const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
    if (i === 0) pctx.moveTo(px, py); else pctx.lineTo(px, py);
  }
  pctx.closePath(); pctx.fill();
  pctx.shadowBlur = 0;
  pctx.strokeStyle = boss ? '#ff5c8a' : '#b49bff';
  pctx.lineWidth = 2; pctx.stroke();
  pctx.fillStyle = boss ? '#7a2a4c' : '#7058c4';
  pctx.beginPath(); pctx.arc(0, 1, e.r * 0.55, 0, Math.PI * 2); pctx.fill();
  pctx.strokeStyle = boss ? '#ffcccc' : '#c9b6ff';
  pctx.beginPath();
  pctx.moveTo(-e.r * 0.5, -e.r * 0.55); pctx.lineTo(-e.r * 0.8, -e.r * 1.1);
  pctx.moveTo(e.r * 0.5, -e.r * 0.55); pctx.lineTo(e.r * 0.8, -e.r * 1.1);
  pctx.stroke();
  pctx.fillStyle = '#eaf7ff';
  pctx.beginPath();
  pctx.arc(-e.r * 0.3, -2, 2.6, 0, Math.PI * 2);
  pctx.arc(e.r * 0.3, -2, 2.6, 0, Math.PI * 2);
  pctx.fill();
  pctx.fillStyle = '#ff5c8a';
  pctx.beginPath();
  pctx.arc(-e.r * 0.3, -2, 1.2, 0, Math.PI * 2);
  pctx.arc(e.r * 0.3, -2, 1.2, 0, Math.PI * 2);
  pctx.fill();
  if (boss) {
    pctx.fillStyle = '#ffcc66';
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      pctx.beginPath();
      pctx.arc(Math.cos(a) * (e.r + 10), Math.sin(a) * (e.r + 10), 2.5, 0, Math.PI * 2);
      pctx.fill();
    }
  }
  pctx.restore();
}

function spawnPreviewParticles(x, y, boss, big = false) {
  const count = big ? (boss ? 42 : 30) : (boss ? 20 : 12);
  for (let i = 0; i < count; i++) {
    const a = rand(0, Math.PI * 2);
    const sp = big ? rand(80, 250) : rand(40, 150);
    const life = big ? rand(0.5, 1.1) : rand(0.3, 0.7);
    previewParticles.push({
      x, y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life, maxLife: life,
      size: big ? rand(2, 5) : rand(1.5, 3.5),
      color: big ? (boss ? '#ffcc66' : '#ff5c8a') : (boss ? '#ff5c8a' : '#b49bff'),
    });
  }
}

function drawPreviewDeath(e) {
  const k = clamp(e.deathAnim / (previewSpawnBlocked ? 0.8 : 0.42), 0, 1);
  pctx.save();
  pctx.translate(e.x, e.y);
  pctx.globalAlpha = 1 - k;
  pctx.strokeStyle = e.boss ? '#ff5c8a' : '#b49bff';
  pctx.lineWidth = 2 * (1 - k) + 0.5;
  pctx.beginPath();
  pctx.arc(0, 0, e.r * (1 + k * 1.4), 0, Math.PI * 2);
  pctx.stroke();
  pctx.restore();
}

function previewTargetCount() {
  let n = PREVIEW_BASE_COUNT;
  for (let i = 0; i < previewKills; i++) n = Math.ceil(n * 1.5);
  return Math.min(n, PREVIEW_MAX_ENEMIES);
}

function resetPreviewKills() {
  previewKills = 0;
  previewIdleTimer = 0;
  previewSpawnBlocked = false;
  previewParticles.length = 0;
  previewEnemies = [];
  for (let i = 0; i < PREVIEW_BASE_COUNT; i++) previewEnemies.push(makePreviewEnemy(true));
}

function triggerPreviewFinale() {
  if (previewSpawnBlocked) return;
  previewSpawnBlocked = true;
  for (const e of previewEnemies) {
    if (e.dead) continue;
    e.dead = true;
    e.deathAnim = 0;
    spawnPreviewParticles(e.x, e.y, e.boss, true);
  }
  sfx('explosion');
}

// Клик по обитателю окна в главном меню убивает его (счётчик скрыт от игрока).
function killPreviewEnemyAt(clientX, clientY) {
  const rect = previewCanvas.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  let hit = null;
  for (let i = previewEnemies.length - 1; i >= 0; i--) {
    const e = previewEnemies[i];
    if (e.dead || e.delay > 0) continue;
    const reach = e.r + 9;
    if ((x - e.x) ** 2 + (y - e.y) ** 2 <= reach * reach) { hit = e; break; }
  }
  if (!hit) return;
  previewKills = Math.min(PREVIEW_MAX_KILLS, previewKills + 1);
  previewIdleTimer = 0;
  hit.dead = true;
  hit.deathAnim = 0;
  spawnPreviewParticles(hit.x, hit.y, hit.boss, previewKills >= PREVIEW_MAX_KILLS);
  sfx('hit');
  if (previewKills >= PREVIEW_MAX_KILLS) triggerPreviewFinale();
}
previewCanvas.addEventListener('pointerdown', (e) => killPreviewEnemyAt(e.clientX, e.clientY));

function syncPreviewEnemyCount() {
  if (previewSpawnBlocked) {
    previewEnemies = previewEnemies.filter(e => e.deathAnim < 0.8);
    return;
  }
  const target = previewTargetCount();
  while (previewEnemies.length < target) previewEnemies.push(makePreviewEnemy(false));
  while (previewEnemies.length > target) previewEnemies.pop();
}

function updateMenuPreview(dt) {
  // После финала (50) простой не сбрасывает счётчик — только выход в меню/игру.
  if (previewKills > 0 && !previewSpawnBlocked) {
    previewIdleTimer += dt;
    if (previewIdleTimer >= PREVIEW_IDLE_SECONDS) resetPreviewKills();
  }
  resizePreviewCanvas();
  syncPreviewEnemyCount();
  pctx.clearRect(0, 0, previewW, previewH);
  drawPreviewGrid();
  for (const e of previewEnemies) {
    if (e.dead) {
      e.deathAnim += dt;
      drawPreviewDeath(e);
      if (!previewSpawnBlocked && e.deathAnim >= 0.5) Object.assign(e, makePreviewEnemy(false));
      continue;
    }
    if (e.delay > 0) { e.delay -= dt; continue; }
    e.spawnAnim = Math.max(0, e.spawnAnim - dt);
    e.x += e.vx * e.speed * dt;
    e.y += e.vy * e.speed * dt;
    if (e.x < -45 || e.x > previewW + 45 || e.y < -45 || e.y > previewH + 45) {
      Object.assign(e, makePreviewEnemy(false));
      continue;
    }
    drawPreviewEnemy(e);
  }
  for (let i = previewParticles.length - 1; i >= 0; i--) {
    const p = previewParticles[i];
    p.life -= dt;
    if (p.life <= 0) { previewParticles.splice(i, 1); continue; }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.96;
    p.vy *= 0.96;
  }
  for (const p of previewParticles) {
    pctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
    pctx.fillStyle = p.color;
    pctx.beginPath();
    pctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    pctx.fill();
  }
  pctx.globalAlpha = 1;
}

// Анимированный переход между главным меню и энциклопедией
let baseSwitchTimer = null;
function animateBaseSwitch(from, to, direction) {
  if (baseSwitchTimer) return;
  resetPreviewKills();
  const fromEl = screens[from];
  const toEl = screens[to];
  const leave = direction === 'forward' ? 'base-leave-left' : 'base-leave-right';
  const enter = direction === 'forward' ? 'base-enter-right' : 'base-enter-left';
  fromEl.classList.add(leave);
  baseSwitchTimer = setTimeout(() => {
    fromEl.classList.remove(leave);
    showBase(to);
    toEl.classList.add(enter);
    setTimeout(() => {
      toEl.classList.remove(enter);
      baseSwitchTimer = null;
    }, 430);
  }, 270);
}

/* Затемнение экрана и секундное появление комнаты */
function fadeElement() { return $('screenFade'); }

function fadeOutTo(callback) {
  const fade = fadeElement();
  if (!fade || fadeBusy) return;
  fadeBusy = true;
  fade.classList.add('fade-visible');
  setTimeout(() => {
    callback();
    setTimeout(() => {
      fade.classList.remove('fade-visible');
      fadeBusy = false;
    }, 40);
  }, 320);
}

function startIntroFade() {
  const fade = fadeElement();
  if (!fade) return;
  fade.classList.add('fade-visible', 'fade-instant');
  void fade.offsetWidth;
  fade.classList.remove('fade-instant');
  fade.classList.add('fade-intro');
  void fade.offsetWidth;
  fade.classList.remove('fade-visible');
}

function finishIntroFade() {
  const fade = fadeElement();
  if (fade) fade.classList.remove('fade-intro', 'fade-visible');
}

function showOverlay(name) {
  if (name) resetPreviewKills();
  // Иначе фокус останется на скрытом поле ввода и заблокирует WASD/горячие клавиши
  const active = document.activeElement;
  if (active && active.tagName === 'INPUT' && !(name === 'debug' && active === $('debugXpInput'))) active.blur();
  screens.choice.classList.toggle('active', name === 'choice');
  screens.inventory.classList.toggle('active', name === 'inventory');
  screens.debug.classList.toggle('active', name === 'debug');
  screens.pause.classList.toggle('active', name === 'pause');
  screens.exitConfirm.classList.toggle('active', name === 'exitConfirm');
  screens.confirm.classList.toggle('active', name === 'confirm');
  screens.end.classList.toggle('active', name === 'end');
  syncPauseDebugLayer();
}

function xpNeeded(level) {
  // На больших уровнях степень переполняет Number — насыщаем, чтобы цикл
  // повышения уровня не застрял на Infinity и продолжал работать.
  return Math.min(Number.MAX_VALUE, Math.round(1000 * Math.pow(1.1, level - 1)));
}

function refreshMenu() {
  const need = xpNeeded(save.level);
  $('menuLevel').textContent = save.level;
  $('menuXpText').textContent = `${Math.floor(save.xp)} / ${need}`;
  $('menuXpFill').style.width = `${Math.min(100, (save.xp / need) * 100)}%`;
  $('menuXpLabel').textContent = `ОПЫТ | До следующего уровня ${Math.max(0, Math.ceil(need - save.xp))} XP`;
}

/* ---------- Оружие ---------- */
const WEAPONS = {
  melee:   { name: 'БЛИЖНИЙ БОЙ', icon: '🗡️', desc: 'Короткий удар очень узким сектором (~45°) перед собой. Атака в 1,5 раза быстрее, можно зажимать.' },
  axe:     { name: 'СЕКИРА', icon: '🪓', desc: 'Три быстрых удара по нажатию, но долгая перезарядка. Каждый удар на 50% слабее обычного и сильно отбрасывает врагов.' },
  rapier:  { name: 'РАПИРА', icon: '⚔️', desc: 'Рывок к курсору (КД 1,2 с) бьёт и оглушает врагов. Урон −50%, урон в рывке −75%, после рывка — замедление 30% на 2 с.' },
  pistol:  { name: 'ПИСТОЛЕТ', icon: '🔫', desc: 'Одиночные выстрелы по курсору. Можно стрелять зажатием.' },
  shotgun: { name: 'ДРОБОВИК', icon: '💣', desc: 'Задержка выстрела ×2, но за раз вылетает от 2 до 6 пуль.' },
  mg:      { name: 'ПУЛЁМЁТ', icon: '🔥', desc: 'По нажатию персонаж почти 0,7 с трясётся, затем сам выпускает залп пуль до перегрева (~3 с) и 3 с не стреляет. Удержание кнопки не работает.' },
};
const BUFF_WEAPON = { axe: 'axe', rapier: 'rapier', pistol: 'pistol', shotgun: 'shotgun', mg: 'mg' };

// Способности, которые можно включать/выключать в инвентаре
const ABILITIES = {
  explosion: {
    id: 'explosion', name: 'ВЗРЫВ ПУЛЬ', icon: '💣',
    desc: 'Пули при попадании пропадают и взрываются, нанося 50% урона пули всем врагам в области.',
    allows: (weaponId) => weaponId === 'pistol' || weaponId === 'shotgun',
    owned: (p) => p.explosion,
    enabled: (p) => p.explosionEnabled,
    set: (p, value) => { p.explosionEnabled = value; },
  },
  vampirism: {
    id: 'vampirism', name: 'ВАМПИРИЗМ', icon: '🧛',
    desc: 'При ударе по врагу восстанавливает 50% нанесённого урона, но естественная регенерация падает до +2 HP в секунду. Работает только с ближним боем и секирой.',
    allows: (weaponId) => weaponAllowsVampirism(weaponId),
    owned: (p) => p.vampirism,
    enabled: (p) => p.vampirismEnabled,
    set: (p, value) => { p.vampirismEnabled = value; },
  },
};

/* ---------- Баффы ---------- */
const BUFFS = [
  { id: 'dmg10', icon: '⚔️', name: 'Урон +10', desc: 'Каждый удар наносит на 10 единиц урона больше.', weight: 10,
    apply: (p) => { p.damage += 10; } },
  { id: 'spd10', icon: '👟', name: 'Скорость +10', desc: 'Ты движешься быстрее на 10 единиц.', weight: 10,
    apply: (p) => { p.speed += 10; } },
  { id: 'hp10', icon: '❤️', name: 'Здоровье +10', desc: 'Максимальное здоровье +10. Сразу восстанавливает 10 HP.', weight: 10,
    apply: (p) => { p.maxHp += 10; p.hp = Math.min(p.maxHp, p.hp + 10); } },
  { id: 'pistol', icon: '🔫', name: 'Пистолет', desc: 'Ближний бой заменяется одиночными выстрелами по курсору.', weight: 10, unique: true, weapon: 'pistol', tag: 'ОРУЖИЕ · УНИКАЛЬНЫЙ',
    apply: (p) => { p.weapon = 'pistol'; } },
  { id: 'as10', icon: '⚡', name: 'Скорость атаки +10', desc: 'Твои удары и выстрелы совершаются на 10% чаще.', weight: 10,
    apply: (p) => { p.attackSpeed *= 1.1; } },
  { id: 'as30', icon: '⚡', name: 'Скорость атаки +30', desc: 'Мощный эффект: все атаки и выстрелы совершаются на 30% чаще.', weight: 3, tag: 'ПОНИЖЕННЫЙ ШАНС',
    apply: (p) => { p.attackSpeed *= 1.3; } },
  { id: 'dmg30', icon: '💥', name: 'Урон +30', desc: 'Мощный эффект: +30 к урону.', weight: 3, tag: 'ПОНИЖЕННЫЙ ШАНС',
    apply: (p) => { p.damage += 30; } },
  { id: 'spd30', icon: '💨', name: 'Скорость +30', desc: 'Мощный эффект: +30 к скорости передвижения.', weight: 3, tag: 'ПОНИЖЕННЫЙ ШАНС',
    apply: (p) => { p.speed += 30; } },
  { id: 'hp30', icon: '💖', name: 'Здоровье +30', desc: 'Максимальное здоровье +30. Сразу восстанавливает 30 HP.', weight: 3, tag: 'ПОНИЖЕННЫЙ ШАНС',
    apply: (p) => { p.maxHp += 30; p.hp = Math.min(p.maxHp, p.hp + 30); } },
  { id: 'explosion', icon: '💣', name: 'Взрыв', desc: 'Пули при попадании пропадают и взрываются, нанося 50% обычного урона пули всем врагам в области. Работает только с пистолетом или дробовиком. Включать и выключать можно в инвентаре.', weight: 3, unique: true, requiresGunWeapon: true, tag: 'ПОНИЖЕННЫЙ ШАНС · УНИКАЛЬНЫЙ · НУЖЕН ПИСТОЛЕТ ИЛИ ДРОБОВИК',
    apply: (p) => { p.explosion = true; p.explosionEnabled = true; } },
  { id: 'vampirism', icon: '🧛', name: 'Вампиризм', desc: 'При ударе по врагу восстанавливает 50% нанесённого урона, но естественная регенерация падает до +2 HP в секунду. Работает только с ближним боем и секирой. Включать и выключать можно в инвентаре.', weight: 3, unique: true, tag: 'ПОНИЖЕННЫЙ ШАНС · УНИКАЛЬНЫЙ · БЛИЖНИЙ БОЙ И СЕКИРА',
    apply: (p) => { p.vampirism = true; p.vampirismEnabled = true; } },
  { id: 'shotgun', icon: '💣', name: 'Дробовик', desc: 'Задержка между выстрелами ×2, но за один выстрел вылетает от 2 до 6 пуль.', weight: 10, unique: true, weapon: 'shotgun', tag: 'ОРУЖИЕ · УНИКАЛЬНЫЙ',
    apply: (p) => { p.weapon = 'shotgun'; } },
  { id: 'axe', icon: '🪓', name: 'Секира', desc: 'Три быстрых удара за одно нажатие с длинной перезарядкой. Каждый удар на 50% слабее обычного, но отбрасывание усилено вдвое.', weight: 10, unique: true, weapon: 'axe', tag: 'ОРУЖИЕ · УНИКАЛЬНЫЙ',
    apply: (p) => { p.weapon = 'axe'; } },
  { id: 'rapier', icon: '⚔️', name: 'Рапира', desc: 'Рывок к курсору (КД 1,2 с) бьёт и оглушает врагов. Урон −50%, урон в рывке −75%, после рывка — замедление 30% на 2 с.', weight: 3, unique: true, weapon: 'rapier', tag: 'ОРУЖИЕ · УНИКАЛЬНЫЙ',
    apply: (p) => { p.weapon = 'rapier'; } },
  { id: 'mg', icon: '🔥', name: 'Пулемёт', desc: 'По нажатию — почти 0,7 с тряски и залп пуль до перегрева (~3 с), затем 3 с без стрельбы. Удержание кнопки не работает.', weight: 3, unique: true, weapon: 'mg', tag: 'ОРУЖИЕ · УНИКАЛЬНЫЙ',
    apply: (p) => { p.weapon = 'mg'; } },
  { id: 'slow10', icon: '🐌', name: 'Замедление врагов +10', desc: 'Все враги двигаются на 10 единиц медленнее.', weight: 10,
    apply: (p) => { p.slow += 10; } },
  { id: 'slow30', icon: '🧊', name: 'Замедление врагов +30', desc: 'Все враги двигаются на 30 единиц медленнее.', weight: 3, tag: 'ПОНИЖЕННЫЙ ШАНС',
    apply: (p) => { p.slow += 30; } },
];

// Взрыв работает только с пушками; с остальным оружием бафф просто не действует
function weaponAllowsExplosion() {
  return run.player.weapon === 'pistol' || run.player.weapon === 'shotgun';
}

// Вампиризм работает только с ближним боем и секирой
function weaponAllowsVampirism(weaponId) {
  const w = weaponId || run.player.weapon;
  return w === 'melee' || w === 'axe';
}

/* ---------- Энциклопедия / меню инфо ---------- */
const FULL_BUFF_WEIGHT = BUFFS.reduce((sum, b) => sum + b.weight, 0);

// Порядок эффектов в энциклопедии. Остальные карточки описаны отдельно
// в разделах «Способности» и «Оружие», поэтому здесь не дублируются.
const EFFECT_ORDER = [
  'dmg10', 'spd10', 'hp10', 'as10', 'slow10',
  'dmg30', 'spd30', 'hp30', 'as30', 'slow30',
];

function dropChanceText(weight) {
  // За выбор берутся две разные карточки без возврата. После первого выбора
  // общий вес пула уменьшается на вес убранной карточки, поэтому нельзя
  // считать второй выбор как w / (total - 1) — нужно усреднить по всем
  // возможным первым карточкам.
  const total = FULL_BUFF_WEIGHT;
  const ownTerm = weight / (total - weight);
  const otherTerms = BUFFS.reduce((sum, buff) => sum + buff.weight / (total - buff.weight), 0);
  const chance = (weight / total) * (1 + otherTerms - ownTerm);
  return `Шанс появиться между уровнями: ~${(chance * 100).toFixed(1).replace('.', ',')}% за выбор из полного пула (две карточки).`;
}

function weaponAbilityLine(weaponId) {
  const explosion = ABILITIES.explosion.allows(weaponId) ? 'работает' : 'не работает';
  const vampirism = ABILITIES.vampirism.allows(weaponId) ? 'работает' : 'не работает';
  return `Способности: взрыв пуль — ${explosion}; вампиризм — ${vampirism}.`;
}

const WEAPON_INFO = {
  melee: [
    'Дальность 96, удар сектором ~45°, перезарядка 0,33 с (скорость атаки ×1,5), урон 100%, отбрасывание 170. Зажатие ЛКМ или Пробела работает по умолчанию.',
    'Получение: стартовое оружие. Заменяется карточкой любого другого оружия.',
  ],
  axe: [
    'Дальность 105, перезарядка 1,3 с. Одно нажатие наносит три удара, каждый — 50% обычного урона и с отбрасыванием 640.',
    'Получение: уникальная карточка «Секира».',
  ],
  rapier: [
    'КД 1,2 с. Рывок на 456 пикселей за 0,55 с в фиксированном направлении; клавиатура во время рывка не влияет на путь.',
    'Урон 50%, каждый враг получает только одно попадание за рывок и оглушается на 2 с. Входящий урон в рывке ×0,25. Удар о стену прерывает рывок и оглушает игрока на 1 с; после обычного рывка скорость −30% на 2 с.',
    'Получение: уникальная карточка «Рапира».',
  ],
  pistol: [
    'Перезарядка 0,35 с, одна пуля со скоростью 560. Прицел — курсор. Зажатие ЛКМ или Пробела работает по умолчанию.',
    'Получение: уникальная карточка «Пистолет».',
  ],
  shotgun: [
    'Перезарядка 0,7 с, за выстрел вылетает от 2 до 6 пуль с разлётом 0,55 рад. Зажатие по умолчанию не работает.',
    'Получение: уникальная карточка «Дробовик».',
  ],
  mg: [
    'По нажатию ~0,66 с тряски, затем автоматическая стрельба ~3 с с интервалом 0,09 с. После этого перегрев на 3 с; зажатие кнопки не работает.',
    'Получение: уникальная карточка «Пулемёт».',
  ],
};

const INFO_SECTIONS = [
  {
    title: 'ЭФФЕКТЫ',
    items: EFFECT_ORDER.map((id) => BUFFS.find((b) => b.id === id)).filter(Boolean).map((b) => ({
      id: `effect-${b.id}`,
      name: b.name,
      icon: b.icon,
      tag: b.tag || '',
      lines: [
        b.desc,
        dropChanceText(b.weight),
        ...(b.unique ? ['Уникальный эффект: после получения больше не выпадает.'] : []),
        ...(b.requiresGunWeapon
          ? ['Доступен только с пистолетом или дробовиком: с другим оружием шанс 0%.']
          : []),
      ],
    })),
  },
  {
    title: 'СПОСОБНОСТИ',
    items: [
      {
        id: 'ability-explosion',
        name: ABILITIES.explosion.name,
        icon: ABILITIES.explosion.icon,
        tag: 'ПОНИЖЕННЫЙ ШАНС · УНИКАЛЬНЫЙ',
        lines: [
          'Пули при попадании во врага или препятствие исчезают и взрываются в радиусе 78. Взрыв наносит 50% урона пули всем врагам в зоне; враги за укрытием получают 50% урона взрыва.',
          'Совместимость: пистолет и дробовик. С ближним боем, секирой, рапирой и пулемётом не работает.',
          `Включается и выключается в инвентаре. Уникальный дроп. ${dropChanceText(BUFFS.find((b) => b.id === 'explosion').weight)} Карточка появляется только если у вас уже есть пистолет или дробовик.`,
        ],
      },
      {
        id: 'ability-vampirism',
        name: ABILITIES.vampirism.name,
        icon: ABILITIES.vampirism.icon,
        tag: 'ПОНИЖЕННЫЙ ШАНС · УНИКАЛЬНЫЙ',
        lines: [
          'При ударе по врагу восстанавливает 50% нанесённого урона. Естественная регенерация падает с +5 до +2 HP в секунду.',
          'Совместимость: ближний бой и секира. С рапирой, пистолетом, дробовиком и пулемётом не работает.',
          `Включается и выключается в инвентаре. Уникальный дроп. ${dropChanceText(BUFFS.find((b) => b.id === 'vampirism').weight)}`,
        ],
      },
    ],
  },
  {
    title: 'ОРУЖИЕ',
    items: Object.entries(WEAPONS).map(([id, w]) => ({
      id: `weapon-${id}`,
      name: w.name,
      icon: w.icon,
      tag: id === 'melee' ? 'СТАРТОВОЕ' : 'УНИКАЛЬНЫЙ ДРОП',
      lines: [
        ...WEAPON_INFO[id],
        weaponAbilityLine(id),
        ...(id === 'melee' ? [] : [dropChanceText(BUFFS.find((b) => b.id === id)?.weight || 10)]),
      ],
    })),
  },
  {
    title: 'СЛОЖНОСТЬ',
    items: [
      {
        id: 'diff-easy', name: 'ЛЕГКИЙ', icon: '🌿', tag: 'ОПЫТ ×0,5',
        lines: [
          'Характеристики врагов ×1, количество врагов ×1.',
          'Волны по 2–3 врага; следующая приходит только после 100% убитых врагов предыдущей волны.',
          'Новая комната полностью восстанавливает HP.',
        ],
      },
      {
        id: 'diff-normal', name: 'ОБЫЧНЫЙ', icon: '⚖️', tag: 'ОПЫТ ×1',
        lines: [
          'Характеристики врагов ×1, количество врагов ×1.',
          'Волны по 3–5 врагов; следующая приходит после 50% убитых.',
          'Новая комната полностью восстанавливает HP.',
        ],
      },
      {
        id: 'diff-hard', name: 'СЛОЖНЫЙ', icon: '🔥', tag: 'ОПЫТ ×2',
        lines: [
          'Характеристики врагов ×1, количество врагов ×0,5.',
          'Волны по 4–5 врагов; следующая приходит после 50% убитых или через 5 секунд.',
          'Новая комната полностью восстанавливает HP.',
        ],
      },
      {
        id: 'diff-ultra', name: 'СВЕРХТЯЖЁЛЫЙ', icon: '💀', tag: 'ОПЫТ ×5',
        lines: [
          'Характеристики врагов ×1,2 (HP, урон и скорость), количество врагов ×3.',
          'Волны по 5–6 врагов; следующая приходит после 20% убитых.',
          'Новая комната НЕ лечит: здоровье приходится возвращать баффами и вампиризмом.',
        ],
      },
    ],
  },
  {
    title: 'РЕЖИМЫ',
    items: [
      {
        id: 'mode-normal', name: 'ОБЫЧНЫЙ', icon: '🏠', tag: '10 КОМНАТ',
        lines: [
          'Стандартный забег из 10 комнат. Обычные враги сильнеют от комнаты к комнате на 5–30%.',
          'Боссы: на 5-й комнате 750 HP и 30 урона, на 10-й — 1500 HP и 50 урона.',
          'В комнатах с боссом препятствия не создаются.',
        ],
      },
      {
        id: 'mode-hundred', name: '100 КОМНАТ', icon: '🏙️', tag: 'СКОРОСТЬ ×1,5',
        lines: [
          'Забег из 100 комнат: весь геймплей ускорен в 1,5 раза.',
          'Босс каждые 10 комнат: 1000 HP и 50 урона, каждый следующий сильнее в 1,5 раза; на 100-й комнате параметры сбрасываются к первому боссу.',
          'Опыт не делится: итоговый множитель зависит только от выбранной сложности.',
        ],
      },
    ],
  },
  {
    title: 'УРОВЕНЬ',
    items: [
      {
        id: 'level', name: 'УРОВЕНЬ ИГРОКА', icon: '⭐', tag: 'СОХРАНЯЕТСЯ В save.json',
        lines: [
          'Уровень растёт от опыта, начисленного после забега, и сохраняется между запусками.',
          'Требуемый опыт: 1000 × 1,1^(уровень−1) с округлением; на очень высоких уровнях значение ограничено числовым лимитом JS.',
          'В конце забега считается разница нанесённого и полученного урона. При поражении удерживается 70–90% (зависит от уровня), затем применяется множитель сложности. Отрицательный результат обнуляется.',
          'В меню отладки можно добавить целое число опыта любой длины, в том числе отрицательное.',
        ],
      },
    ],
  },
  {
    title: 'УПРАВЛЕНИЕ',
    items: [
      {
        id: 'control-move', name: 'ДВИЖЕНИЕ', icon: '🎮',
        lines: [
          'WASD или стрелки. Используются физические коды клавиш, поэтому раскладка не важна: на русской раскладке работают ЦФЫВ.',
          'Столкновения с препятствиями и краями комнаты не дают выйти за поле.',
        ],
      },
      {
        id: 'control-attack', name: 'АТАКА И ПРИЦЕЛ', icon: '🖱️',
        lines: [
          'ЛКМ или Пробел — удар/выстрел; направление задаёт курсор.',
          'По умолчанию зажатие повторяет атаку только у пистолета. В меню отладки игры переключатель «Автоматическая атака» разрешает зажатие для любого оружия.',
        ],
      },
      {
        id: 'control-pause', name: 'ПАУЗА И ВЫХОД', icon: '⏸️',
        lines: [
          'T, P или Esc открывают паузу в бою, выборе эффекта и инвентаре; повторное нажатие возвращает из паузы в игру.',
          'В паузе: «ПРОДОЛЖИТЬ», переключатель звука и «ВЫЙТИ В МЕНЮ» с подтверждением.',
          'Ё на русской раскладке или ` на английской открывает меню отладки; повторное нажатие закрывает его.',
        ],
      },
      {
        id: 'control-choice', name: 'ВЫБОР ЭФФЕКТА', icon: '🃏',
        lines: [
          'После пройденной комнаты предлагаются две карточки. Клик по карточке выбирает эффект, «ПОДТВЕРДИТЬ» применяет его и открывает инвентарь.',
          'При включённом «Полном контроле» доступны все эффекты сразу и можно отметить несколько.',
        ],
      },
      {
        id: 'control-inventory', name: 'ИНВЕНТАРЬ', icon: '🎒',
        lines: [
          'Выбери одно оружие и при желании включи/выключи имеющиеся способности, затем нажми «ВЫБРАТЬ».',
          'Наведение на квадратную карточку скрывает иконку и показывает описание в непрозрачном окошке.',
        ],
      },
      {
        id: 'control-input', name: 'ПОЛЯ ВВОДА', icon: '⌨️',
        lines: [
          'Числовые поля работают по одной схеме: поле ввода, кнопка справа и ENTER. Принимаются только целые числа; некорректный ввод очищает поле.',
          'Пока поле ввода в фокусе, WASD и горячие клавиши игры не срабатывают.',
        ],
      },
    ],
  },
  {
    title: 'ОТЛАДКА',
    items: [
      {
        id: 'debug-menu', name: 'МЕНЮ ОТЛАДКИ', icon: '🛠️', tag: 'ОТКРЫВАЕТСЯ С ВКЛАДКИ «ОТЛАДКА»',
        lines: [
          '«Режим бога» — полностью убирает входящий урон.',
          '«Полный контроль» — все эффекты на выбор, можно выбрать несколько.',
          '«Отладка игрового процесса» — главный выключатель боковой панели: если он выключен, панель не показывается ни в паузе, ни в игре.',
          '«Скорость игры» — пресеты 0,25×, 0,5×, 1×, 1,5× и 2×.',
          '«Добавить опыт» — целое число любой длины через BigInt; кнопка «Ввести» или ENTER, отрицательные значения обнуляют опыт.',
          '«Сбросить уровень» — возвращает уровень 1 и опыт 0 после подтверждения; «Назад» возвращает в меню или паузу.',
        ],
      },
      {
        id: 'debug-game', name: 'МЕНЮ ОТЛАДКИ ИГРЫ', icon: '📊', tag: 'БОКОВАЯ ПАНЕЛЬ',
        lines: [
          'Пять полей с плюсом/минусом: урон, скорость, здоровье, скорость атаки (в процентах) и замедление врагов.',
          '«Автоматическая атака» — зажатие ЛКМ/Пробела работает для любого оружия; сама по себе кнопка атаку не начинает.',
          '«Пауза врагов» — враги, боссы, их пули, спавн и подкрепления замирают; игрок может двигаться, атаковать и менять настройки.',
          '«Показывать в игре» — работает только при включённом главном переключателе: выключено — панель только в паузе, включено — и в паузе, и во время забега.',
          'Кнопки: «ЕЩЕ» — полный контроль без завершения комнаты; «ИНВЕНТАРЬ» — тоже без перехода; «ЗАВЕРШИТЬ УРОВЕНЬ» — обычный проход комнаты; «МЕНЮ ОТЛАДКИ» — открывает общую отладку через паузу.',
        ],
      },
    ],
  },
];

function buildInfoScreen() {
  const list = $('infoList');
  list.innerHTML = '';
  for (const section of INFO_SECTIONS) {
    const sec = document.createElement('section');
    sec.className = 'info-section';
    const title = document.createElement('h3');
    title.textContent = `${section.title} · ${section.items.length}`;
    sec.appendChild(title);
    for (const item of section.items) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'info-item';
      btn.dataset.infoId = item.id;
      const icon = document.createElement('span');
      icon.className = 'info-item-icon';
      icon.textContent = item.icon || '•';
      const label = document.createElement('span');
      label.textContent = item.name;
      btn.append(icon, label);
      btn.addEventListener('click', () => showInfoItem(item));
      sec.appendChild(btn);
    }
    list.appendChild(sec);
  }
}

function resetInfoDetail() {
  document.querySelectorAll('.info-item.active').forEach((el) => el.classList.remove('active'));
  const detail = $('infoDetail');
  detail.innerHTML = '<div class="info-placeholder">ВЫБЕРИТЕ ОБЪЕКТ</div>';
  detail.scrollTop = 0;
}

function showInfoItem(item) {
  document.querySelectorAll('.info-item').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.infoId === item.id);
  });
  const detail = $('infoDetail');
  detail.innerHTML = '';
  const head = document.createElement('div');
  head.className = 'info-detail-head';
  const icon = document.createElement('span');
  icon.className = 'info-detail-icon';
  icon.textContent = item.icon || '•';
  const title = document.createElement('h3');
  title.textContent = item.name;
  head.append(icon, title);
  if (item.tag) {
    const tag = document.createElement('span');
    tag.className = 'info-detail-tag';
    tag.textContent = item.tag;
    head.appendChild(tag);
  }
  detail.appendChild(head);
  for (const line of item.lines) {
    const p = document.createElement('p');
    p.textContent = line;
    detail.appendChild(p);
  }
  detail.scrollTop = 0;
}

function buffAllowed(buff) {
  if (buff.unique && run.buffsTaken.includes(buff.id)) return false;
  if (buff.requiresGunWeapon && !weaponAllowsExplosion()) return false;
  return true;
}

function applyBuff(buff) {
  buff.apply(run.player);
  if (!run.buffsTaken.includes(buff.id)) run.buffsTaken.push(buff.id);
  if (buff.weapon && !run.weaponsOwned.includes(buff.weapon)) run.weaponsOwned.push(buff.weapon);
}

/* ---------- Случайные числа ---------- */
const rand = (min, max) => min + Math.random() * (max - min);
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

// Случайная текстура пола из квадратов, генерируется заново для каждой комнаты
function makeFloor() {
  const colors = ['#12172c', '#151b33', '#181e39', '#101529', '#1a2040', '#141a31'];
  const tiles = [];
  const size = FLOOR_TILE;
  for (let y = 0; y < H; y += size) {
    for (let x = 0; x < W; x += size) {
      if (Math.random() < 0.12) continue;
      tiles.push({ x, y, size, color: colors[Math.floor(Math.random() * colors.length)], alpha: rand(0.25, 0.7) });
    }
  }
  return tiles;
}

// Минимальный зазор между любыми двумя препятствиями — 3 квадрата
function obstaclesTooClose(a, b) {
  const hGap = Math.max(a.c - (b.c + b.wTiles), b.c - (a.c + a.wTiles));
  const vGap = Math.max(a.r - (b.r + b.hTiles), b.r - (a.r + a.hTiles));
  return hGap < BLOCK_GAP_TILES && vGap < BLOCK_GAP_TILES;
}

// Случайные блоки-препятствия 3×3 квадрата. Между любыми двумя препятствиями
// остаётся минимум 3 пустых квадрата, центр карты свободен, на боссе их нет.
function makeBlocks(isBoss) {
  if (isBoss) return [];
  const cols = Math.floor(W / FLOOR_TILE);
  const rows = Math.floor(H / FLOOR_TILE);
  const maxCol = cols - BLOCK_TILES;
  const maxRow = rows - BLOCK_TILES;
  const cc = cols / 2, cr = rows / 2;
  const blocks = [];
  const target = Math.floor(rand(3, 6)); // 3–5 блоков за комнату

  for (let attempt = 0; attempt < 240 && blocks.length < target; attempt++) {
    // Отступ от краёв, чтобы вокруг блока всегда можно было пройти
    const c = Math.floor(rand(BLOCK_GAP_TILES, maxCol - BLOCK_GAP_TILES + 1));
    const r = Math.floor(rand(BLOCK_GAP_TILES, maxRow - BLOCK_GAP_TILES + 1));

    // Не ставим блок в центр карты
    if (c < cc + BLOCK_CLEAR_TILES && c + BLOCK_TILES > cc - BLOCK_CLEAR_TILES &&
        r < cr + BLOCK_CLEAR_TILES && r + BLOCK_TILES > cr - BLOCK_CLEAR_TILES) continue;

    const candidate = { c, r, wTiles: BLOCK_TILES, hTiles: BLOCK_TILES };
    if (blocks.some((b) => obstaclesTooClose(candidate, b))) continue;

    blocks.push({
      c, r,
      wTiles: BLOCK_TILES, hTiles: BLOCK_TILES,
      x: c * FLOOR_TILE,
      y: r * FLOOR_TILE,
      w: BLOCK_TILES * FLOOR_TILE,
      h: BLOCK_TILES * FLOOR_TILE,
      size: BLOCK_TILES * FLOOR_TILE,
    });
  }
  return blocks;
}

// Длинные стены 10×2 квадрата. Также не ставятся в центр, не выходят за края
// и отстоят минимум на 3 квадрата от любого другого препятствия.
function makeWalls(isBoss, blocks) {
  if (isBoss) return [];
  const cols = Math.floor(W / FLOOR_TILE);
  const rows = Math.floor(H / FLOOR_TILE);
  const maxCol = cols - WALL_TILES_W;
  const maxRow = rows - WALL_TILES_H;
  const cc = cols / 2, cr = rows / 2;
  const walls = [];
  const target = Math.floor(rand(2, 4)); // 2–3 стены за комнату

  for (let attempt = 0; attempt < 320 && walls.length < target; attempt++) {
    const c = Math.floor(rand(BLOCK_GAP_TILES, maxCol - BLOCK_GAP_TILES + 1));
    const r = Math.floor(rand(BLOCK_GAP_TILES, maxRow - BLOCK_GAP_TILES + 1));

    if (c < cc + BLOCK_CLEAR_TILES && c + WALL_TILES_W > cc - BLOCK_CLEAR_TILES &&
        r < cr + BLOCK_CLEAR_TILES && r + WALL_TILES_H > cr - BLOCK_CLEAR_TILES) continue;

    const candidate = { c, r, wTiles: WALL_TILES_W, hTiles: WALL_TILES_H };
    if ([...blocks, ...walls].some((o) => obstaclesTooClose(candidate, o))) continue;

    walls.push({
      c, r,
      wTiles: WALL_TILES_W, hTiles: WALL_TILES_H,
      x: c * FLOOR_TILE,
      y: r * FLOOR_TILE,
      w: WALL_TILES_W * FLOOR_TILE,
      h: WALL_TILES_H * FLOOR_TILE,
    });
  }
  return walls;
}

// Попадает ли круг радиуса r в какое-либо препятствие
function pointBlocked(x, y, r) {
  const rr = Math.max(0, r - COLLISION_EPS);
  for (const b of run.obstacles) {
    const cx = clamp(x, b.x, b.x + b.w);
    const cy = clamp(y, b.y, b.y + b.h);
    const dx = x - cx, dy = y - cy;
    if (dx * dx + dy * dy < rr * rr) return true;
  }
  return false;
}

// Пересекает ли отрезок какое-либо препятствие (меняем Liang–Barsky).
// pad расширяет препятствие — используется для корпуса игрока при рывке.
function segmentBlocked(x1, y1, x2, y2, pad) {
  const dx = x2 - x1, dy = y2 - y1;
  pad = pad || 0;
  for (const b of run.obstacles) {
    const left = b.x - pad, right = b.x + b.w + pad;
    const top = b.y - pad, bottom = b.y + b.h + pad;
    const p = [-dx, dx, -dy, dy];
    const q = [x1 - left, right - x1, y1 - top, bottom - y1];
    let t0 = 0, t1 = 1, inside = true;
    for (let i = 0; i < 4; i++) {
      if (p[i] === 0) {
        if (q[i] < 0) { inside = false; break; }
      } else {
        const t = q[i] / p[i];
        if (p[i] < 0) {
          if (t > t1) { inside = false; break; }
          if (t > t0) t0 = t;
        } else {
          if (t < t0) { inside = false; break; }
          if (t < t1) t1 = t;
        }
      }
    }
    if (inside) return true;
  }
  return false;
}

// Точка касания пули с препятствием: чуть раньше стены, чтобы взрыв
// начинался на этой стороне; враги за стеной получают половинный урон.
function bulletImpactPoint(x1, y1, x2, y2) {
  let lo = 0, hi = 1;
  for (let i = 0; i < 12; i++) {
    const t = (lo + hi) / 2;
    if (segmentBlocked(x1, y1, x1 + (x2 - x1) * t, y1 + (y2 - y1) * t)) hi = t;
    else lo = t;
  }
  const len = Math.hypot(x2 - x1, y2 - y1) || 1;
  const t = Math.max(0, lo - 2 / len);
  return { x: x1 + (x2 - x1) * t, y: y1 + (y2 - y1) * t };
}

// Выталкивает круг из препятствий по ближайшему направлению
function pushOutOfBlocks(o) {
  const rr = Math.max(0, o.r - COLLISION_EPS);
  for (const b of run.obstacles) {
    const cx = clamp(o.x, b.x, b.x + b.w);
    const cy = clamp(o.y, b.y, b.y + b.h);
    let dx = o.x - cx, dy = o.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 >= rr * rr) continue;
    if (d2 > 0.0001) {
      const d = Math.sqrt(d2);
      o.x = cx + (dx / d) * o.r;
      o.y = cy + (dy / d) * o.r;
    } else {
      // Центр внутри препятствия — выталкиваем к ближайшей грани
      const left = o.x - b.x, right = b.x + b.w - o.x;
      const top = o.y - b.y, bottom = b.y + b.h - o.y;
      const m = Math.min(left, right, top, bottom);
      if (m === left) o.x = b.x - o.r;
      else if (m === right) o.x = b.x + b.w + o.r;
      else if (m === top) o.y = b.y - o.r;
      else o.y = b.y + b.h + o.r;
    }
  }
  o.x = clamp(o.x, o.r + 8, W - o.r - 8);
  o.y = clamp(o.y, o.r + 8, H - o.r - 8);
}

/* ---------- Создание забега ---------- */
function newRun() {
  resetPreviewKills();
  if (choiceTimer) { clearTimeout(choiceTimer); choiceTimer = null; }
  pausedFrom = null;
  choicePendingResume = false;
  debugFreeChoice = false;
  debugFreeInventory = false;
  const hundred = selectedMode === 'hundred';
  const diff = DIFFICULTIES[selectedDifficulty];
  run = {
    room: 0,
    totalRooms: hundred ? 100 : 10,
    timeScale: hundred ? 1.5 : 1,
    xpDivisor: 1,
    statMul: diff.statMul,
    countMul: diff.countMul,
    healOnRoom: diff.healOnRoom,
    xpMul: diff.xpMul,
    waveRule: WAVE_RULES[selectedDifficulty] || WAVE_RULES.normal,
    scale: { count: 10, hp: 20, dmg: 20 },
    toSpawn: 0,
    waveSize: 0,
    waveTimer: 0,
    enemies: [],
    bullets: [],
    playerBullets: [],
    particles: [],
    slashes: [],
    explosions: [],
    floorTiles: [],
    blocks: [],
    walls: [],
    obstacles: [],
    boss: null,
    bossDead: false,
    bossMobCount: 0,
    bossRespawnTimer: null,
    introRoom: 0,
    introBoss: false,
    introSpawned: false,
    roomComplete: false,
    damageDealt: 0,
    damageTaken: 0,
    buffsTaken: [],
    weaponsOwned: ['melee'],
    shake: 0,
    player: {
      x: W / 2, y: H / 2, r: Math.round(15 * SIZE_SCALE),
      hp: 100, maxHp: 100,
      damage: 10,
      speed: BASE_SPEED,
      attackSpeed: 1,
      weapon: 'melee',
      explosion: false,
      explosionEnabled: true,
      vampirism: false,
      vampirismEnabled: true,
      slow: 0,
      mgHeat: 0,
      mgOverheat: 0,
      mgBurst: null,
      mgShake: 0,
      dash: null,
      axeCombo: null,
      dashSlow: 0,
      stun: 0,
      attackCd: 0,
      invuln: 0,
      spawnAnim: 0,
      angle: -Math.PI / 2,
    },
  };
  mode = 'intro';
  showOverlay(null);
  startIntroFade();
  showBase('game');
  enterRoom(1, true);
  updateHud();

  // 0–1 с — уход затемнения и пустое поле, 1–2 с — появление арены, затем игра
  if (introTimer) clearTimeout(introTimer);
  if (introPlayTimer) clearTimeout(introPlayTimer);
  introTimer = setTimeout(beginIntroSpawn, 1000);
}

function beginIntroSpawn() {
  if (introTimer) { clearTimeout(introTimer); introTimer = null; }
  if (mode !== 'intro' || !run) return;
  if (!run.introSpawned) {
    if (run.introBoss) spawnBoss(run.introRoom);
    spawnWave();
    run.introSpawned = true;
  }
  mode = 'spawn';
  run.player.spawnAnim = 0.95;
  introPlayTimer = setTimeout(finishGameIntro, 1000);
}

function finishGameIntro() {
  if (introTimer) { clearTimeout(introTimer); introTimer = null; }
  if (introPlayTimer) { clearTimeout(introPlayTimer); introPlayTimer = null; }
  if ((mode !== 'intro' && mode !== 'spawn') || !run) return;
  if (!run.introSpawned) {
    if (run.introBoss) spawnBoss(run.introRoom);
    spawnWave();
    run.introSpawned = true;
  }
  finishIntroFade();
  run.player.spawnAnim = 0;
  showRoomBanner(run.introBoss ? `БОСС · КОМНАТА ${run.introRoom}` : `КОМНАТА ${run.introRoom}`, run.introBoss);
  sfx(run.introBoss ? 'boss' : 'room');
  run.introRoom = 0;
  run.introBoss = false;
  keys.clear();
  mouse.down = false;
  mode = 'play';
  updateHud();
}

function enterRoom(n, deferSpawn = false) {
  run.room = n;

  // Рост характеристик врагов на 5–30% за каждую комнату
  if (n > 1) {
    const growth = rand(1.05, 1.30);
    run.scale.count *= growth;
    run.scale.hp *= growth;
    run.scale.dmg *= growth;
  }

  const isBoss = run.totalRooms === 100 ? (n % 10 === 0) : (n % 5 === 0);
  let count = Math.round(run.scale.count);
  if (isBoss) count = Math.round(count * 0.25); // на 75% меньше мобов
  count = clamp(count, 2, 30);
  count = Math.max(1, Math.round(count * run.countMul)); // множитель монстров по сложности

  run.toSpawn = count;
  run.waveSize = 0;
  run.waveTimer = 0;
  run.enemies = [];
  run.bullets = [];
  run.playerBullets = [];
  run.boss = null;
  run.bossDead = false;
  run.bossMobCount = isBoss ? count : 0;
  run.bossRespawnTimer = null;
  run.roomComplete = false;
  run.floorTiles = makeFloor();
  run.blocks = makeBlocks(isBoss);
  run.walls = makeWalls(isBoss, run.blocks);
  run.obstacles = [...run.blocks, ...run.walls];

  const p = run.player;
  p.x = W / 2;
  p.y = H / 2 + 110;
  pushOutOfBlocks(p);
  p.invuln = 1.2;
  p.attackCd = 0.25;
  p.mgHeat = 0;
  p.mgOverheat = 0;
  p.mgBurst = null;
  p.mgShake = 0;
  p.dash = null;
  p.axeCombo = null;
  p.dashSlow = 0;
  p.stun = 0;
  if (run.healOnRoom) p.hp = p.maxHp; // полное лечение на новой комнате, кроме сверхтяжёлого режима

  if (deferSpawn) {
    run.introRoom = n;
    run.introBoss = isBoss;
  } else {
    if (isBoss) spawnBoss(n);
    spawnWave();
  }

  updateTrack();
  if (!deferSpawn) {
    showRoomBanner(isBoss ? `БОСС · КОМНАТА ${n}` : `КОМНАТА ${n}`, isBoss);
    sfx(isBoss ? 'boss' : 'room');
  }
  updateHud();
}

function spawnBoss(level) {
  let hp, damage;
  if (run.totalRooms === 100) {
    // Боссы на каждой 10-й комнате: 1000 HP / 50 урона,
    // каждый следующий сильнее в 1,5 раза, на 100-й — сброс к первому.
    const index = level === 100 ? 1 : level / 10;
    const mul = Math.pow(1.5, index - 1);
    hp = Math.round(1000 * mul);
    damage = Math.round(50 * mul);
  } else {
    // Обычный режим: 750 HP на 5-й и 1500 HP на 10-й
    hp = level === 5 ? 750 : 1500;
    damage = level % 10 === 0 ? 50 : 30;
  }
  // Сверхтяжёлый режим: +20% к здоровью, скорости и урону всех врагов
  hp = Math.round(hp * run.statMul);
  damage = Math.round(damage * run.statMul);
  const boss = {
    type: 'boss',
    x: W / 2, y: 115, r: Math.round(32 * SIZE_SCALE),
    hp, maxHp: hp,
    damage,
    speed: 58 * SPEED_SCALE * run.statMul,
    speedVar: rand(0.92, 1.08), wobble: rand(0, Math.PI * 2),
    cdA: 1.6, cdB: 3.8, cdC: 5.6,
    spiralAngle: 0,
    telegraph: 0, pendingAttack: null,
    spawnAnim: 0.5,
    flash: 0, stun: 0, kx: 0, ky: 0,
  };
  run.boss = boss;
  run.enemies.push(boss);
}

// Живые обычные враги (босс в счёт волн не входит)
function aliveMobs() {
  let n = 0;
  for (const e of run.enemies) if (e.type !== 'boss') n++;
  return n;
}

// Размер волны зависит от сложности, но никогда не превышает лимит комнаты.
// Последняя волна может быть меньше минимального размера, если в лимите осталось мало врагов.
function spawnWave() {
  const rule = run.waveRule || WAVE_RULES.normal;
  const size = Math.min(run.toSpawn, Math.floor(rand(rule.min, rule.max + 1)));
  if (size <= 0) return;
  spawnBatch(size);
  run.waveSize = size;
  run.waveTimer = rule.timeout;
}

function spawnBatch(amount) {
  const p = run.player;
  const mobR = Math.round(15 * SIZE_SCALE);
  const limit = Math.min(amount, run.toSpawn); // не выходим за лимит комнаты
  for (let i = 0; i < limit && run.toSpawn > 0; i++) {
    // Выбираем точку у края поля подальше от игрока и вне блоков
    let x = 34, y = 34, bestDist = -1;
    for (let t = 0; t < 24; t++) {
      const side = Math.floor(Math.random() * 4);
      let cx, cy;
      if (side === 0) { cx = rand(30, W - 30); cy = 34; }
      else if (side === 1) { cx = rand(30, W - 30); cy = H - 34; }
      else if (side === 2) { cx = 34; cy = rand(30, H - 30); }
      else { cx = W - 34; cy = rand(30, H - 30); }
      if (pointBlocked(cx, cy, mobR)) continue;
      const d = Math.hypot(cx - p.x, cy - p.y);
      if (d > bestDist) { bestDist = d; x = cx; y = cy; }
      if (d > 200) break;
    }
    if (bestDist < 0) { x = W / 2; y = H / 2; } // центр всегда свободен от блоков

    const hp = Math.max(1, Math.round(run.scale.hp * run.statMul));
    run.enemies.push({
      type: 'mob',
      x, y, r: Math.round(15 * SIZE_SCALE),
      hp, maxHp: hp,
      damage: Math.max(1, Math.round(run.scale.dmg * run.statMul)),
      speed: rand(80, 102) * SPEED_SCALE * run.statMul,
      speedVar: rand(0.92, 1.08), wobble: rand(0, Math.PI * 2),
      touchCd: rand(0, 0.4),
      spawnAnim: 0.45,
      flash: 0, stun: 0, kx: 0, ky: 0,
    });
    run.toSpawn--;
  }
  if (limit > 0) sfx('spawn');
}

/* ---------- Боевые действия ---------- */
// Параметры ближнего оружия: half — полуугол сектора, push — сила отбрасывания,
// dmgMul — множитель урона одного удара относительно обычного ближнего боя
const MELEE = {
  // Ближний бой: базовый интервал 0,5 с делён на 1,5 — скорость атаки ×1,5.
  // Сектор сужен ещё вдвое — до ~45° (восьмая круга), дальность осталась увеличенной.
  melee:  { reach: 96,  half: Math.PI / 8, cd: 0.5 / 1.5, push: 170, combo: 1, dmgMul: 1, dash: 0 },
  axe:    { reach: 105, half: Math.PI, cd: 1.3, push: 640, combo: 3, dmgMul: 0.5, dash: 0 },
  rapier: { reach: 140, half: 0.34,    cd: 1.2, push: 0,   combo: 1, dmgMul: 0.5, dash: 456, dashTime: 0.55 },
};

// Пулемёт: тряска перед залпом, интервал выстрелов и время стрельбы до перегрева
const MG_WINDUP = 0.66;
const MG_SHOT_CD = 0.09;
const MG_FIRE_TIME = 3;
const MG_OVERHEAT_TIME = 3;

function meleeStrike(w, aim, targets, hitSet) {
  const p = run.player;
  const cfg = MELEE[w] || MELEE.melee;
  const life = w === 'rapier' && p.dash ? p.dash.duration + 0.05 : 0.2;
  const slash = { x: p.x, y: p.y, angle: aim, weapon: w, life, maxLife: life, dashZone: w === 'rapier' && !!p.dash };
  run.slashes.push(slash);

  const lifesteal = p.vampirism && p.vampirismEnabled && weaponAllowsVampirism();
  const hits = [];
  for (const e of (targets || [...run.enemies])) {
    if (!run.enemies.includes(e)) continue; // враг мог погибнуть в предыдущем ударе серии
    if (hitSet && hitSet.has(e)) continue;  // в рывке каждый враг получает только один удар
    if (segmentBlocked(p.x, p.y, e.x, e.y)) continue; // стена перекрывает удар
    const dx = e.x - p.x, dy = e.y - p.y;
    const dist = Math.hypot(dx, dy);
    if (!targets) {
      if (dist > cfg.reach + e.r) continue;
      if (cfg.half < Math.PI) {
        const ang = Math.atan2(dy, dx);
        const diff = Math.atan2(Math.sin(ang - aim), Math.cos(ang - aim));
        if (Math.abs(diff) > cfg.half) continue;
      }
    }
    hitEnemy(e, Math.max(1, Math.round(p.damage * cfg.dmgMul)), lifesteal);
    hits.push(e);
    if (hitSet) hitSet.add(e);

    if (w === 'rapier') {
      // Вместо отбрасывания — оглушение на 2 секунды
      e.stun = 2;
    } else {
      const push = cfg.push * (e.type === 'boss' ? 0.2 : 1);
      e.kx += (dx / (dist || 1)) * push;
      e.ky += (dy / (dist || 1)) * push;
    }
  }
  return { hits, slash };
}

// Секира запоминает цели в начале серии, чтобы все три удара доходили
function axeTargets(aim) {
  const p = run.player;
  return [...run.enemies].filter((e) => Math.hypot(e.x - p.x, e.y - p.y) <= MELEE.axe.reach + e.r);
}

function startRapierDash(aim) {
  const p = run.player;
  p.dash = {
    t: 0, duration: MELEE.rapier.dashTime, progress: 0,
    distance: MELEE.rapier.dash,
    vx: Math.cos(aim), vy: Math.sin(aim),
    hit: new Set(),
  };
  burst(p.x, p.y, '#9ffcf8', 12, 200);
  sfx('dash');
  return p.dash;
}

function playerAttack() {
  if (mode !== 'play') return;
  const p = run.player;
  if (p.attackCd > 0 || p.stun > 0) return;
  const w = p.weapon;

  // Пулемёт: нажатие запускает короткую тряску, затем залп до перегрева
  if (w === 'mg') {
    if (p.mgOverheat > 0 || p.mgBurst) return;
    const windup = MG_WINDUP / p.attackSpeed;
    p.mgBurst = { windup, timer: 0 };
    p.mgShake = windup;
    p.attackCd = windup;
    sfx('mgStart');
    return;
  }

  // Огнестрельное оружие
  if (w === 'pistol' || w === 'shotgun') {
    let cd, pellets = 1, spread = 0.035;
    if (w === 'pistol') cd = 0.35;
    else { cd = 0.7; pellets = Math.floor(rand(2, 7)); spread = 0.55; }
    p.attackCd = cd / p.attackSpeed;

    const baseAng = Math.atan2(mouse.y - p.y, mouse.x - p.x);
    for (let i = 0; i < pellets; i++) {
      const ang = baseAng + rand(-spread / 2, spread / 2);
      run.playerBullets.push({
        x: p.x + Math.cos(ang) * 19, y: p.y + Math.sin(ang) * 19,
        vx: Math.cos(ang) * 560, vy: Math.sin(ang) * 560,
        r: 5, damage: p.damage, life: 1.4,
      });
    }
    sfx(w === 'shotgun' ? 'shotgun' : 'shot');
    return;
  }

  // Холодное оружие
  const cfg = MELEE[w] || MELEE.melee;
  p.attackCd = cfg.cd / p.attackSpeed;
  const aim = Math.atan2(mouse.y - p.y, mouse.x - p.x);
  p.angle = aim;

  if (w === 'axe') {
    // Три быстрых удара за одно нажатие, но с увеличенной перезарядкой
    p.axeCombo = { left: cfg.combo, timer: 0, angle: aim, targets: axeTargets(aim) };
    return;
  }
  if (w === 'rapier') {
    // Зона атаки живёт весь рывок; каждый враг может быть задет только один раз
    const dash = startRapierDash(aim);
    const { slash } = meleeStrike(w, aim, null, dash.hit);
    dash.slash = slash;
    return;
  }
  sfx('swing');
  meleeStrike(w, aim);
}

const EXPLOSION_RADIUS = 78;

function explodeAt(x, y, amount) {
  run.explosions.push({ x, y, life: 0.3, maxLife: 0.3 });
  burst(x, y, '#ffb347', 14, 250);
  sfx('explosion');
  for (const e of [...run.enemies]) {
    const d = Math.hypot(e.x - x, e.y - y);
    if (d > EXPLOSION_RADIUS + e.r) continue;
    // Враги за препятствием получают половину урона взрыва, а не игнорируются.
    const blocked = segmentBlocked(x, y, e.x, e.y);
    hitEnemy(e, blocked ? amount * 0.5 : amount);
  }
  run.shake = Math.max(run.shake, 3);
}

function hitEnemy(e, amount, lifesteal) {
  const actual = Math.min(amount, Math.max(0, e.hp));
  e.hp -= amount;
  e.flash = 0.12;
  run.damageDealt += actual;
  if (lifesteal) {
    const p = run.player;
    p.hp = Math.min(p.maxHp, p.hp + actual * 0.5);
  }
  burst(e.x, e.y, '#ffd166', 5, 120);
  sfx('hit');
  if (e.hp <= 0) killEnemy(e);
  return actual;
}

function killEnemy(e) {
  const idx = run.enemies.indexOf(e);
  if (idx !== -1) run.enemies.splice(idx, 1);
  sfx(e.type === 'boss' ? 'bossDown' : 'kill');
  burst(e.x, e.y, e.type === 'boss' ? '#ff5c8a' : '#9b7bff', e.type === 'boss' ? 46 : 12, e.type === 'boss' ? 300 : 180);
  if (e.type === 'boss') {
    run.boss = null;
    run.bossDead = true;
    run.bossRespawnTimer = null;
    run.toSpawn = 0; // после победы над боссом подкрепление больше не приходит
    run.shake = Math.max(run.shake, 14);
  } else {
    run.shake = Math.max(run.shake, 3);
  }
}

function hurtPlayer(amount) {
  const p = run.player;
  if (debugGodMode || p.invuln > 0 || mode !== 'play') return;
  // В рывке рапиры игрок уязвим, но получает на 75% меньше урона
  if (p.dash) amount *= 0.25;
  const actual = Math.min(amount, Math.max(0, p.hp));
  p.hp -= actual;
  run.damageTaken += actual;
  sfx('hurt');
  p.invuln = 0.38;
  run.shake = Math.max(run.shake, 7);
  burst(p.x, p.y, '#ff5c8a', 8, 160);
  if (p.hp <= 0) {
    p.hp = 0;
    finish(false);
  }
}

function burst(x, y, color, count, speed) {
  for (let i = 0; i < count; i++) {
    const a = rand(0, Math.PI * 2);
    const s = rand(speed * 0.3, speed);
    run.particles.push({
      x, y,
      vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: rand(0.25, 0.6), maxLife: 0.6,
      color, size: rand(2, 4.5),
    });
  }
}

function enemyShoot(x, y, angle, speed, damage, radius = 7) {
  run.bullets.push({
    x, y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    r: radius, damage,
    life: 3.2,
  });
}

// Атака босса срабатывает после короткого предупреждения (telegraph)
function fireBossAttack(e, atk) {
  if (atk.type === 'fan') {
    for (let i = -2; i <= 2; i++) enemyShoot(e.x, e.y, atk.angle + i * 0.16, 235, e.damage);
    burst(e.x, e.y, '#ff5c8a', 12, 170);
  } else if (atk.type === 'ring') {
    for (let i = 0; i < 14; i++) {
      enemyShoot(e.x, e.y, (i / 14) * Math.PI * 2 + rand(-0.05, 0.05), 190, e.damage);
    }
    burst(e.x, e.y, '#ffcc66', 18, 210);
  } else if (atk.type === 'spiral') {
    for (let i = 0; i < 9; i++) {
      const a = e.spiralAngle + i * 0.34;
      enemyShoot(e.x, e.y, a, 150 + i * 14, e.damage, 6);
    }
    e.spiralAngle += 0.55;
    burst(e.x, e.y, '#9b7bff', 16, 190);
  }
}

/* ---------- Коллизии тел ---------- */
// Монстры не слипаются друг с другом и не проходят сквозь игрока.
// Рывок рапиры намеренно игнорирует коллизии, чтобы пробиваться сквозь толпу.
function resolveCollisions() {
  const p = run.player;
  const list = run.enemies;

  for (let pass = 0; pass < 2; pass++) {
    // Монстры друг с другом
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        let dx = b.x - a.x, dy = b.y - a.y;
        const min = a.r + b.r;
        let d2 = dx * dx + dy * dy;
        if (d2 >= min * min) continue;
        let d = Math.sqrt(d2);
        if (d < 0.001) { dx = rand(-1, 1); dy = rand(-1, 1); d = Math.hypot(dx, dy) || 1; }
        const nx = dx / d, ny = dy / d;
        const push = min - d;
        // Босс массивнее — его сдвигают меньше, чем обычных монстров
        const wa = a.type === 'boss' ? 0.15 : 1;
        const wb = b.type === 'boss' ? 0.15 : 1;
        const sum = wa + wb;
        a.x -= nx * push * (wa / sum);
        a.y -= ny * push * (wa / sum);
        b.x += nx * push * (wb / sum);
        b.y += ny * push * (wb / sum);
      }
    }

    // Игрок vs монстры
    if (!p.dash) {
      for (const e of list) {
        let dx = e.x - p.x, dy = e.y - p.y;
        const min = p.r + e.r;
        let d2 = dx * dx + dy * dy;
        if (d2 >= min * min) continue;
        let d = Math.sqrt(d2);
        if (d < 0.001) { dx = rand(-1, 1); dy = rand(-1, 1); d = Math.hypot(dx, dy) || 1; }
        const nx = dx / d, ny = dy / d;
        const push = min - d;
        const ew = e.type === 'boss' ? 0.1 : 0.6;
        const pw = 1 - ew;
        p.x -= nx * push * pw;
        p.y -= ny * push * pw;
        e.x += nx * push * ew;
        e.y += ny * push * ew;
      }
    }
  }

  p.x = clamp(p.x, p.r + 8, W - p.r - 8);
  p.y = clamp(p.y, p.r + 8, H - p.r - 8);
  pushOutOfBlocks(p);
  for (const e of list) {
    e.x = clamp(e.x, e.r, W - e.r);
    e.y = clamp(e.y, e.r, H - e.r);
    pushOutOfBlocks(e);
  }
}

/* ---------- Обновление ---------- */
function update(dt) {
  // Фаза появления: крутится только анимация спавна, движение и бой выключены
  if (mode === 'spawn' && run) {
    run.player.spawnAnim = Math.max(0, (run.player.spawnAnim || 0) - dt);
    for (const e of run.enemies) e.spawnAnim = Math.max(0, (e.spawnAnim || 0) - dt);
    return;
  }
  if (mode !== 'play') return;
  const p = run.player;
  updateTouchAim();
  p.dashSlow = Math.max(0, p.dashSlow - dt);
  p.stun = Math.max(0, p.stun - dt);

  // Движение игрока: после удара о стену оглушение блокирует движение,
  // а после обычного рывка рапиры скорость снижена на 30% в течение 2 с
  let dx = 0, dy = 0;
  if (keys.has('w') || keys.has('arrowup')) dy -= 1;
  if (keys.has('s') || keys.has('arrowdown')) dy += 1;
  if (keys.has('a') || keys.has('arrowleft')) dx -= 1;
  if (keys.has('d') || keys.has('arrowright')) dx += 1;
  if (touchMove.active) { dx += touchMove.x; dy += touchMove.y; }
  // Во время рывка направление уже зафиксировано: клавиатура не должна его подправлять
  if ((dx || dy) && p.stun <= 0 && !p.dash) {
    const len = Math.hypot(dx, dy);
    let speed = p.speed;
    if (p.dashSlow > 0) speed *= 0.7;
    p.x += (dx / len) * speed * dt;
    p.y += (dy / len) * speed * dt;
  }
  p.x = clamp(p.x, p.r + 8, W - p.r - 8);
  p.y = clamp(p.y, p.r + 8, H - p.r - 8);
  pushOutOfBlocks(p);

  // Резкий рывок рапиры: направление фиксируется в момент нажатия удара
  // и больше не меняется; неуязвимости нет, урон в рывке снижен на 75%,
  // а после его окончания игрок замедляется на 30% на 2 с
  let facing = Math.atan2(mouse.y - p.y, mouse.x - p.x);
  if (p.dash) {
    const d = p.dash;
    const na = Math.atan2(d.vy, d.vx); // курсор во время рывка уже не влияет на путь
    facing = na;

    d.t += dt;
    const raw = clamp(d.t / d.duration, 0, 1);
    const eased = 1 - Math.pow(1 - raw, 3); // резкий рывок вперёд с быстрым затуханием скорости
    const step = (eased - d.progress) * d.distance;
    d.progress = eased;
    const nx = clamp(p.x + d.vx * step, p.r + 8, W - p.r - 8);
    const ny = clamp(p.y + d.vy * step, p.r + 8, H - p.r - 8);
    // Столкновение рывка со стеной прерывает его и оглушает игрока на 1 с
    // Учитываем радиус игрока, чтобы рывок не задевал угол стены корпусом.
    // Небольшой отступ от r не даёт ложного удара при движении вдоль стены.
    const hitWall = pointBlocked(nx, ny, p.r)
      || segmentBlocked(p.x, p.y, nx, ny, Math.max(0, p.r - 1));
    p.x = nx;
    p.y = ny;
    pushOutOfBlocks(p); // рывок не проходит сквозь блоки
    // Игла видна и бьёт весь рывок: каждый вошедший в сектор враг получает один удар
    const cfgR = MELEE.rapier;
    for (const e of [...run.enemies]) {
      if (d.hit.has(e)) continue;
      if (segmentBlocked(p.x, p.y, e.x, e.y)) continue; // удар не проходит сквозь стены
      const dx = e.x - p.x, dy = e.y - p.y;
      if (Math.hypot(dx, dy) > cfgR.reach + e.r) continue;
      const ea = Math.atan2(dy, dx);
      const diff = Math.atan2(Math.sin(ea - na), Math.cos(ea - na));
      if (Math.abs(diff) > cfgR.half) continue;
      hitEnemy(e, Math.max(1, Math.round(p.damage * cfgR.dmgMul)));
      e.stun = 2;
      d.hit.add(e);
      burst(e.x, e.y, '#9ffcf8', 7, 120);
    }
    // Визуальная зона атаки следует за игроком всё время рывка
    if (d.slash) { d.slash.x = p.x; d.slash.y = p.y; d.slash.angle = na; }
    if (step > 0 && Math.random() < 0.8) {
      run.particles.push({
        x: p.x, y: p.y,
        vx: -d.vx * rand(20, 60), vy: -d.vy * rand(20, 60),
        life: 0.25, maxLife: 0.25, color: '#9ffcf8', size: rand(2, 4),
      });
    }
    if (hitWall) {
      p.dash = null;
      p.stun = 1; // удар о стену — оглушение на секунду
      sfx('stun');
      burst(p.x, p.y, '#9ffcf8', 12, 200);
      run.shake = Math.max(run.shake, 6);
    } else if (d.t >= d.duration) {
      p.dash = null;
      p.dashSlow = 2; // после рывка игрок замедлен на 30% в течение 2 с
    }
  }

  p.angle = facing;

  // Таймеры игрока
  p.attackCd = Math.max(0, p.attackCd - dt);
  p.invuln = Math.max(0, p.invuln - dt);
  // Удержание кнопки работает у пистолета и ближнего боя;
  // отладка разрешает зажатие для всех оружий
  const firing = (debugAutoAttack || p.weapon === 'pistol' || p.weapon === 'melee')
    && (mouse.down || keys.has('space'));
  if (firing && p.attackCd <= 0) playerAttack();

  // Пулемёт: короткая тряска перед залпом, затем стрельба до перегрева
  if (p.mgBurst) {
    const b = p.mgBurst;
    p.mgShake = Math.max(0, p.mgShake - dt);
    if (b.windup > 0) {
      b.windup -= dt;
    } else {
      b.timer -= dt;
      if (b.timer <= 0 && p.mgOverheat <= 0) {
        b.timer = MG_SHOT_CD / p.attackSpeed;
        p.mgHeat += MG_SHOT_CD;
        const baseAng = Math.atan2(mouse.y - p.y, mouse.x - p.x);
        const ang = baseAng + rand(-0.0175, 0.0175);
        run.playerBullets.push({
          x: p.x + Math.cos(ang) * 19, y: p.y + Math.sin(ang) * 19,
          vx: Math.cos(ang) * 560, vy: Math.sin(ang) * 560,
          r: 5, damage: p.damage, life: 1.4,
        });
        sfx('mg');
        if (p.mgHeat >= MG_FIRE_TIME) {
          p.mgHeat = 0;
          p.mgOverheat = MG_OVERHEAT_TIME;
          p.mgBurst = null;
          p.mgShake = 0;
          p.attackCd = 0;
          burst(p.x, p.y, '#ff7a45', 22, 220);
          sfx('overheat');
        }
      }
    }
  }

  // Секира: три быстрых удара за одно нажатие
  if (p.axeCombo) {
    p.axeCombo.timer -= dt;
    if (p.axeCombo.timer <= 0) {
      sfx('axe');
      meleeStrike('axe', p.axeCombo.angle, p.axeCombo.targets);
      p.axeCombo.left--;
      p.axeCombo.timer = 0.12;
      if (p.axeCombo.left <= 0) p.axeCombo = null;
    }
  }

  // Перегрев длится 3 секунды; вне залпа накопленный жар остывает
  if (p.mgOverheat > 0) {
    p.mgOverheat = Math.max(0, p.mgOverheat - dt);
    if (p.mgOverheat === 0) p.mgHeat = 0;
  } else if (!p.mgBurst) {
    p.mgHeat = Math.max(0, p.mgHeat - dt);
  }

  // Естественная регенерация +5 HP/с; активный вампиризм снижает её до +2 HP/с
  if (p.hp > 0 && p.hp < p.maxHp) {
    const regen = p.vampirism && p.vampirismEnabled ? 2 : 5;
    p.hp = Math.min(p.maxHp, p.hp + regen * dt);
  }

  // Пауза врагов: спавн, ИИ, столкновения и подкрепления не работают,
  // но игрок по-прежнему движется, атакует и меняет настройки в боковом меню.
  if (!debugEnemyPause) {
    // Спавн волнами по правилам выбранной сложности
    if (run.toSpawn > 0 && !run.bossDead) {
      const rule = run.waveRule || WAVE_RULES.normal;
      const needKills = Math.ceil(run.waveSize * rule.fraction);
      let ready = aliveMobs() <= run.waveSize - needKills;
      if (rule.timeout > 0) {
        run.waveTimer = Math.max(0, run.waveTimer - dt);
        if (run.waveTimer === 0) ready = true; // не уложились в 5 с — приходит подкрепление
      }
      if (ready) spawnWave();
    }

    // Враги
    for (const e of [...run.enemies]) {
      const ex = e.x - p.x, ey = e.y - p.y;
      const dist = Math.hypot(ex, ey) || 1;
      // Небольшой разброс скорости: индивидуальный множитель + плавные колебания ±5%
      e.wobble = (e.wobble || 0) + dt * 2.5;
      const variedSpeed = e.speed * (e.speedVar || 1) * (1 + 0.05 * Math.sin(e.wobble));
      const eSpeed = Math.max(20, variedSpeed - p.slow); // эффекты замедления врагов
      e.flash = Math.max(0, e.flash - dt);
      e.spawnAnim = Math.max(0, (e.spawnAnim || 0) - dt); // анимация появления
      e.telegraph = Math.max(0, (e.telegraph || 0) - dt);
      e.stun = Math.max(0, (e.stun || 0) - dt);

      if (e.stun > 0) {
        // Оглушённый враг неподвижен, не атакует и не отталкивается
        e.kx = 0; e.ky = 0;
      } else {
        if (e.type === 'boss') {
          // Босс тоже направляется к игроку, но ведёт и стрелковый огонь
          let mx = -ex / dist, my = -ey / dist;
          // лёгкое боковое движение
          mx += (ey / dist) * 0.25;
          my += (-ex / dist) * 0.25;
          const ml = Math.hypot(mx, my) || 1;
          e.x += (mx / ml) * eSpeed * dt;
          e.y += (my / ml) * eSpeed * dt;

          // Предупреждение, затем выстрел
          if (e.pendingAttack) {
            e.pendingAttack.delay -= dt;
            if (e.pendingAttack.delay <= 0) {
              fireBossAttack(e, e.pendingAttack);
              e.pendingAttack = null;
              e.telegraph = 0.3;
            }
          }
          e.cdA -= dt; e.cdB -= dt; e.cdC -= dt;
          if (e.cdA <= 0 && !e.pendingAttack) {
            e.cdA = 2.1;
            e.pendingAttack = { type: 'fan', angle: Math.atan2(ey, ex), delay: 0.55, total: 0.55 };
          }
          if (e.cdB <= 0 && !e.pendingAttack) {
            e.cdB = 4.5;
            e.pendingAttack = { type: 'ring', delay: 0.65, total: 0.65 };
          }
          if (e.cdC <= 0 && !e.pendingAttack) {
            e.cdC = 6.4;
            e.pendingAttack = { type: 'spiral', delay: 0.7, total: 0.7 };
          }
        } else {
          // Обычные враги преследуют игрока
          e.x -= (ex / dist) * eSpeed * dt;
          e.y -= (ey / dist) * eSpeed * dt;
          e.touchCd -= dt;
          if (dist < e.r + p.r + 2 && e.touchCd <= 0) {
            e.touchCd = 0.9;
            hurtPlayer(e.damage);
          }
        }

        // Отталкивание после удара
        e.x += e.kx * dt;
        e.y += e.ky * dt;
        e.kx *= Math.pow(0.001, dt);
        e.ky *= Math.pow(0.001, dt);
      }
      e.x = clamp(e.x, e.r, W - e.r);
      e.y = clamp(e.y, e.r, H - e.r);
      pushOutOfBlocks(e);
    }

    resolveCollisions();

    // Босс вызывает подкрепление, когда обычные враги истреблены
    const mobsAlive = run.enemies.some((e) => e.type !== 'boss');
    if (run.boss && !run.bossDead && run.bossMobCount > 0 && run.toSpawn === 0 && !mobsAlive) {
      if (run.bossRespawnTimer === null) run.bossRespawnTimer = 3.2;
      else {
        run.bossRespawnTimer -= dt;
        if (run.bossRespawnTimer <= 0) {
          run.bossRespawnTimer = null;
          run.toSpawn = run.bossMobCount;
          run.waveSize = 0; // следующая волна подкрепления придёт сразу
          showRoomBanner('ПОДКРЕПЛЕНИЕ', true);
        }
      }
    } else if (mobsAlive || run.bossDead || !run.boss) {
      run.bossRespawnTimer = null;
    }
  }

  // Снаряды игрока
  for (let i = run.playerBullets.length - 1; i >= 0; i--) {
    const b = run.playerBullets[i];
    const ox = b.x, oy = b.y;
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    let used = false;
    if (segmentBlocked(ox, oy, b.x, b.y)) {
      // Взрывные пули детонируют у стены так же, как при попадании во врага.
      // Обычные пули просто разбиваются, не нанося урона врагам за стеной.
      if (p.explosion && p.explosionEnabled && weaponAllowsExplosion()) {
        const impact = bulletImpactPoint(ox, oy, b.x, b.y);
        explodeAt(impact.x, impact.y, b.damage * 0.5);
      } else {
        burst(b.x, b.y, '#4ee2e0', 4, 80);
      }
      used = true;
    } else {
      for (const e of [...run.enemies]) {
        if (Math.hypot(e.x - b.x, e.y - b.y) < e.r + b.r) {
          if (p.explosion && p.explosionEnabled && weaponAllowsExplosion()) {
            // При попадании пуля исчезает и бьёт area-уроном вместо обычного попадания
            explodeAt(b.x, b.y, b.damage * 0.5);
          } else {
            hitEnemy(e, b.damage);
          }
          used = true;
          break;
        }
      }
    }
    const gone = used || b.life <= 0 || b.x < -20 || b.x > W + 20 || b.y < -20 || b.y > H + 20;
    if (gone) run.playerBullets.splice(i, 1);
  }

  // Снаряды врагов тоже замирают, пока включена пауза врагов
  if (!debugEnemyPause) {
    for (let i = run.bullets.length - 1; i >= 0; i--) {
      const b = run.bullets[i];
      const ox = b.x, oy = b.y;
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      if (segmentBlocked(ox, oy, b.x, b.y)) {
        // Вражеская пуля тоже не проходит сквозь стены
        burst(b.x, b.y, '#ff5c8a', 4, 80);
        run.bullets.splice(i, 1);
        continue;
      }
      const hit = Math.hypot(p.x - b.x, p.y - b.y) < p.r + b.r;
      if (hit) hurtPlayer(b.damage);
      if (hit || b.life <= 0 || b.x < -20 || b.x > W + 20 || b.y < -20 || b.y > H + 20) {
        run.bullets.splice(i, 1);
      }
    }
  }

  // Частицы и следы ударов
  for (let i = run.particles.length - 1; i >= 0; i--) {
    const q = run.particles[i];
    q.x += q.vx * dt; q.y += q.vy * dt;
    q.vx *= Math.pow(0.02, dt); q.vy *= Math.pow(0.02, dt);
    q.life -= dt;
    if (q.life <= 0) run.particles.splice(i, 1);
  }
  for (let i = run.slashes.length - 1; i >= 0; i--) {
    run.slashes[i].life -= dt;
    if (run.slashes[i].life <= 0) run.slashes.splice(i, 1);
  }
  for (let i = run.explosions.length - 1; i >= 0; i--) {
    run.explosions[i].life -= dt;
    if (run.explosions[i].life <= 0) run.explosions.splice(i, 1);
  }

  run.shake = Math.max(0, run.shake - dt * 24);
  updateHud();

  // Комната пройдена
  if (run.toSpawn === 0 && run.enemies.length === 0) {
    if (run.room >= run.totalRooms) finish(true);
    else openChoice();
  }
}

/* ---------- Отрисовка ---------- */
function draw() {
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  if (run && run.shake > 0) {
    ctx.translate(rand(-run.shake, run.shake), rand(-run.shake, run.shake));
  }

  // Фон
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#11152a');
  bg.addColorStop(1, '#0a0c18');
  ctx.fillStyle = bg;
  ctx.fillRect(-20, -20, W + 40, H + 40);

  ctx.strokeStyle = 'rgba(120,140,220,0.07)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= W; x += 40) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = 0; y <= H; y += 40) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }

  // Пол из случайных квадратов, свой для каждой комнаты
  if (run && run.floorTiles) {
    for (const t of run.floorTiles) {
      ctx.globalAlpha = t.alpha;
      ctx.fillStyle = t.color;
      ctx.fillRect(t.x, t.y, t.size, t.size);
      ctx.globalAlpha = t.alpha * 0.5;
      ctx.fillStyle = 'rgba(190,210,255,0.06)';
      ctx.fillRect(t.x + 3, t.y + 3, t.size - 6, t.size - 6);
    }
    ctx.globalAlpha = 1;
  }

  // Блоки-препятствия
  if (run && run.blocks) {
    for (const b of run.blocks) {
      ctx.fillStyle = '#2a2e4d';
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = 'rgba(155,123,255,0.10)';
      for (let y = b.y + 5; y < b.y + b.h - 5; y += 12) {
        for (let x = b.x + 5; x < b.x + b.w - 5; x += 12) ctx.fillRect(x, y, 5, 5);
      }
      ctx.strokeStyle = '#6c74aa';
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
    }
  }

  // Длинные стены 10×2 квадрата
  if (run && run.walls) {
    for (const b of run.walls) {
      ctx.fillStyle = '#303452';
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = 'rgba(120,160,255,0.13)';
      for (let x = b.x + 6; x < b.x + b.w - 6; x += 18) ctx.fillRect(x, b.y + 6, 9, b.h - 12);
      ctx.strokeStyle = '#7e88c4';
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
    }
  }

  ctx.strokeStyle = 'rgba(78,226,224,0.25)';
  ctx.lineWidth = 2;
  ctx.strokeRect(5, 5, W - 10, H - 10);

  if (run) {
    drawParticles();
    drawExplosions();
    drawSlash();
    for (const e of run.enemies) drawEnemy(e);
    drawBullets();
    if (mode !== 'intro') drawPlayer();
    drawBossBar();
  }

  // Небольшие вспышки экрана, когда осталось меньше 30% здоровья
  if (run && mode === 'play' && run.player.hp > 0 && run.player.hp < run.player.maxHp * 0.3) {
    const pulse = Math.pow(Math.max(0, Math.sin(performance.now() / 160)), 10);
    if (pulse > 0) {
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.fillStyle = `rgba(255,60,90,${(pulse * 0.18).toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
  }

  ctx.restore();
}

function drawParticles() {
  for (const q of run.particles) {
    ctx.globalAlpha = clamp(q.life / q.maxLife, 0, 1);
    ctx.fillStyle = q.color;
    ctx.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size);
  }
  ctx.globalAlpha = 1;
}

function drawExplosions() {
  for (const ex of run.explosions) {
    const k = ex.life / ex.maxLife;
    const r = EXPLOSION_RADIUS * (1.15 - k * 0.55);
    ctx.save();
    ctx.globalAlpha = k * 0.9;
    ctx.strokeStyle = '#ffb347';
    ctx.lineWidth = 6 * k + 1;
    ctx.shadowColor = '#ff7a45';
    ctx.shadowBlur = 22;
    ctx.beginPath(); ctx.arc(ex.x, ex.y, r, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = k * 0.25;
    ctx.fillStyle = '#ff7a45';
    ctx.beginPath(); ctx.arc(ex.x, ex.y, r, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

function drawSlash() {
  for (const s of run.slashes) {
    // Зона рывка рапиры держит полную яркость до самого конца, остальные удары плавно гаснут
    const k = s.dashZone ? Math.min(1, s.life / 0.25) : s.life / s.maxLife;
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.angle);
    ctx.globalAlpha = k;

    if (s.weapon === 'rapier') {
      // Чуть более широкая игла с рывком
      const edge = Math.cos(0.34) * 132, side = Math.sin(0.34) * 132;
      ctx.globalAlpha = k * 0.4;
      ctx.strokeStyle = '#ffcc66';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(8, 0); ctx.lineTo(edge, side);
      ctx.moveTo(8, 0); ctx.lineTo(edge, -side);
      ctx.stroke();
      ctx.globalAlpha = k;
      ctx.strokeStyle = '#ffe0a3';
      ctx.lineWidth = 6 * k + 1;
      ctx.shadowColor = '#ffb347';
      ctx.shadowBlur = 22;
      ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(140, 0); ctx.stroke();
      ctx.lineWidth = 2 * k + 1;
      ctx.beginPath(); ctx.moveTo(140, 0); ctx.lineTo(122, -10); ctx.moveTo(140, 0); ctx.lineTo(122, 10); ctx.stroke();
    } else if (s.weapon === 'axe') {
      ctx.strokeStyle = '#ffb347';
      ctx.lineWidth = 8 * k + 2;
      ctx.shadowColor = '#ff8c42';
      ctx.shadowBlur = 18;
      ctx.beginPath(); ctx.arc(0, 0, 100, 0, Math.PI * 2); ctx.stroke();
    } else {
      const cfg = MELEE.melee;
      const r = cfg.reach - 6;
      const half = cfg.half;
      // Только дуга по границе зоны поражения (~45°)
      ctx.strokeStyle = '#9ffcf8';
      ctx.lineWidth = 8 * k + 2;
      ctx.shadowColor = '#4ee2e0';
      ctx.shadowBlur = 18;
      ctx.beginPath(); ctx.arc(0, 0, r, -half, half); ctx.stroke();
    }
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
}

function drawEnemy(e) {
  const isBoss = e.type === 'boss';
  const total = isBoss ? 0.5 : 0.45;
  const k = e.spawnAnim > 0 ? clamp(1 - e.spawnAnim / total, 0, 1) : 1;

  ctx.save();
  ctx.translate(e.x, e.y);
  if (e.stun > 0) {
    // Оглушение: враг слегка покачивается
    ctx.rotate(Math.sin(performance.now() / 65) * 0.11);
  }
  if (k < 1) {
    // Появление: враг вырастает из расширяющегося кольца
    ctx.globalAlpha = 0.3 + 0.7 * k;
    ctx.scale(0.35 + 0.65 * k, 0.35 + 0.65 * k);
    ctx.strokeStyle = isBoss ? 'rgba(255,92,138,.9)' : 'rgba(155,123,255,.9)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, e.r + 18 * (1 - k), 0, Math.PI * 2); ctx.stroke();
  }

  if (isBoss) {
    // Аура и предупреждение об атаке
    ctx.save();
    ctx.globalAlpha = 0.16 + 0.1 * Math.sin(performance.now() / 220);
    ctx.fillStyle = '#ff5c8a';
    ctx.beginPath(); ctx.arc(0, 0, e.r + 18, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    if (e.pendingAttack) {
      const t = 1 - e.pendingAttack.delay / e.pendingAttack.total;
      ctx.strokeStyle = `rgba(255,92,138,${(0.35 + 0.5 * t).toFixed(3)})`;
      ctx.lineWidth = 3 + 5 * t;
      ctx.beginPath(); ctx.arc(0, 0, e.r + 16 + 10 * t, 0, Math.PI * 2); ctx.stroke();
      if (e.pendingAttack.type === 'fan') {
        ctx.strokeStyle = `rgba(255,204,102,${(0.5 + 0.5 * t).toFixed(3)})`;
        ctx.lineWidth = 3;
        const a = e.pendingAttack.angle;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * e.r, Math.sin(a) * e.r);
        ctx.lineTo(Math.cos(a) * (e.r + 70), Math.sin(a) * (e.r + 70));
        ctx.stroke();
      }
    }
    if (e.telegraph > 0) {
      ctx.strokeStyle = `rgba(255,255,255,${(e.telegraph / 0.3).toFixed(3)})`;
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(0, 0, e.r + 10, 0, Math.PI * 2); ctx.stroke();
    }

    // Гранёное ядро
    ctx.shadowColor = '#ff5c8a';
    ctx.shadowBlur = 26;
    ctx.fillStyle = e.flash > 0 ? '#ffffff' : '#5c1d3d';
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 - Math.PI / 8;
      const rr = e.r + (i % 2 === 0 ? 4 : -2);
      const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#ff5c8a'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, e.r + 6, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,204,102,.7)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, e.r + 12, 0, Math.PI * 2); ctx.stroke();
    // "корона"
    ctx.fillStyle = '#ffcc66';
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * (e.r + 12), Math.sin(a) * (e.r + 12), 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#ffcccc';
    ctx.beginPath(); ctx.arc(-10, -5, 5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(10, -5, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(-9, -6, 2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(11, -6, 2, 0, Math.PI * 2); ctx.fill();
  } else {
    // Монстр: шестиугольное тело, рожки и светящиеся глаза
    ctx.shadowColor = '#9b7bff';
    ctx.shadowBlur = 14;
    ctx.fillStyle = e.flash > 0 ? '#ffffff' : '#4a3789';
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 6 + (i / 6) * Math.PI * 2;
      const px = Math.cos(a) * e.r, py = Math.sin(a) * e.r;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#b49bff'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#7058c4';
    ctx.beginPath(); ctx.arc(0, 1, e.r * 0.55, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#c9b6ff'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-8, -9); ctx.lineTo(-13, -18);
    ctx.moveTo(8, -9); ctx.lineTo(13, -18);
    ctx.stroke();
    ctx.fillStyle = '#eaf7ff';
    ctx.beginPath(); ctx.arc(-5, -3, 2.8, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(5, -3, 2.8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ff5c8a';
    ctx.beginPath(); ctx.arc(-5, -3, 1.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(5, -3, 1.2, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();

  // Небольшая анимация оглушения: звёздочки кружатся над головой
  if (e.stun > 0) {
    const t = performance.now() / 260;
    ctx.save();
    ctx.translate(e.x, e.y - e.r - 14);
    ctx.fillStyle = '#ffe066';
    ctx.shadowColor = '#ffcc66';
    ctx.shadowBlur = 8;
    for (let i = 0; i < 3; i++) {
      const a = t + (i / 3) * Math.PI * 2;
      const sx = Math.cos(a) * (e.r + 8);
      const sy = Math.sin(a) * 4;
      ctx.beginPath();
      ctx.moveTo(sx, sy - 4);
      ctx.lineTo(sx + 1.6, sy - 1.6);
      ctx.lineTo(sx + 4, sy);
      ctx.lineTo(sx + 1.6, sy + 1.6);
      ctx.lineTo(sx, sy + 4);
      ctx.lineTo(sx - 1.6, sy + 1.6);
      ctx.lineTo(sx - 4, sy);
      ctx.lineTo(sx - 1.6, sy - 1.6);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    ctx.shadowBlur = 0;
  }

  // Полоска здоровья врага
  if (e.hp < e.maxHp) {
    const bw = isBoss ? 80 : 32;
    const bh = isBoss ? 6 : 4;
    const y = e.y - e.r - (isBoss ? 22 : 12);
    ctx.fillStyle = 'rgba(0,0,0,.6)';
    ctx.fillRect(e.x - bw / 2, y, bw, bh);
    ctx.fillStyle = isBoss ? '#ff5c8a' : '#ffcc66';
    ctx.fillRect(e.x - bw / 2, y, bw * clamp(e.hp / e.maxHp, 0, 1), bh);
  }
}

function drawPlayer() {
  const p = run.player;
  const total = 0.95;
  const k = p.spawnAnim > 0 ? clamp(1 - p.spawnAnim / total, 0, 1) : 1;
  ctx.save();
  ctx.translate(p.x, p.y);
  if (k < 1) {
    // Появление игрока: вырастает из расширяющегося кольца, как враги
    ctx.globalAlpha = 0.3 + 0.7 * k;
    ctx.scale(0.35 + 0.65 * k, 0.35 + 0.65 * k);
    ctx.strokeStyle = 'rgba(78,226,224,.95)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, p.r + 18 * (1 - k), 0, Math.PI * 2); ctx.stroke();
  }

  // Небольшая тряска перед залпом пулемёта
  if (p.mgShake > 0) {
    const amp = Math.min(1, p.mgShake / MG_WINDUP) * 3.5;
    ctx.translate(rand(-amp, amp), rand(-amp, amp));
  }

  if (p.invuln > 0 && Math.floor(p.invuln * 18) % 2 === 0) ctx.globalAlpha *= 0.45;

  // Мягкая аура вокруг игрока
  ctx.save();
  ctx.globalAlpha *= 0.22;
  ctx.fillStyle = '#4ee2e0';
  ctx.beginPath(); ctx.arc(0, 0, p.r + 10, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // Гранёный корпус
  ctx.shadowColor = '#4ee2e0';
  ctx.shadowBlur = 22;
  ctx.fillStyle = '#123840';
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const px = Math.cos(a) * p.r, py = Math.sin(a) * p.r;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath(); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#4ee2e0'; ctx.lineWidth = 3; ctx.stroke();

  // Внутренняя броня и реактор
  ctx.fillStyle = '#1c5b63';
  ctx.beginPath(); ctx.arc(0, 0, p.r * 0.62, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(174,255,249,.6)'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = p.weapon === 'mg' ? '#ffb347' : '#b6fffd';
  ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();

  ctx.rotate(p.angle);
  // Визор / направление атаки
  ctx.fillStyle = '#aafff9';
  ctx.beginPath();
  ctx.moveTo(p.r + 13, 0);
  ctx.lineTo(4, -8);
  ctx.lineTo(4, 8);
  ctx.closePath();
  ctx.fill();
  // Боковые пластины
  ctx.fillStyle = '#2b7f87';
  ctx.beginPath(); ctx.moveTo(-2, -p.r + 1); ctx.lineTo(9, -6); ctx.lineTo(3, -2); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-2, p.r - 1); ctx.lineTo(9, 6); ctx.lineTo(3, 2); ctx.closePath(); ctx.fill();

  ctx.restore();

  // Полоска перегрева под игроком: заполняется при стрельбе,
  // а в перегреве убывает и полностью исчезает вместе с его сбросом
  const cooling = p.mgOverheat > 0;
  const heating = p.weapon === 'mg' && p.mgBurst && !cooling && p.mgHeat > 0;
  if (cooling || heating) {
    const bw = 46, bh = 5;
    const bx = p.x - bw / 2, by = p.y + p.r + 12;
    const progress = cooling
      ? clamp(p.mgOverheat / MG_OVERHEAT_TIME, 0, 1)
      : clamp(p.mgHeat / MG_FIRE_TIME, 0, 1);
    ctx.save();
    ctx.fillStyle = 'rgba(6,7,16,.85)';
    ctx.fillRect(bx - 2, by - 2, bw + 4, bh + 4);
    ctx.fillStyle = cooling ? '#ff5c8a' : '#ff7a45';
    ctx.fillRect(bx, by, bw * progress, bh);
    ctx.strokeStyle = cooling ? '#ff5c8a' : '#ffb347';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx - 0.5, by - 0.5, bw + 1, bh + 1);
    ctx.restore();
  }
  ctx.globalAlpha = 1;

  // Замедление после рывка рапиры — мерцающее кольцо вокруг игрока
  if (p.dashSlow > 0) {
    ctx.save();
    ctx.strokeStyle = '#9ffcf8';
    ctx.globalAlpha = 0.3 + 0.25 * Math.max(0, Math.sin(performance.now() / 130));
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r + 13, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Оглушение после удара о стену — вращающиеся искры над игроком
  if (p.stun > 0) {
    ctx.save();
    ctx.fillStyle = '#ffd166';
    for (let i = 0; i < 3; i++) {
      const a = performance.now() / 220 + (i * Math.PI * 2) / 3;
      ctx.beginPath();
      ctx.arc(p.x + Math.cos(a) * 13, p.y - p.r - 14 + Math.sin(a) * 4, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawBullets() {
  for (const b of run.playerBullets) {
    ctx.save();
    ctx.shadowColor = '#4ee2e0'; ctx.shadowBlur = 14;
    ctx.fillStyle = '#b6fffd';
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  for (const b of run.bullets) {
    ctx.save();
    ctx.shadowColor = '#ff5c8a'; ctx.shadowBlur = 16;
    ctx.fillStyle = '#ff9ab3';
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

function drawBossBar() {
  if (!run.boss) return;
  const bw = 460, bh = 13;
  const x = (W - bw) / 2, y = 22;
  ctx.fillStyle = 'rgba(0,0,0,.7)';
  ctx.fillRect(x - 3, y - 3, bw + 6, bh + 6);
  ctx.fillStyle = '#3a1730';
  ctx.fillRect(x, y, bw, bh);
  ctx.fillStyle = '#ff5c8a';
  ctx.fillRect(x, y, bw * clamp(run.boss.hp / run.boss.maxHp, 0, 1), bh);
  ctx.strokeStyle = '#ffcc66'; ctx.lineWidth = 1;
  ctx.strokeRect(x - 3, y - 3, bw + 6, bh + 6);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(I18N.t(`БОСС · ${run.boss.damage} УРОНА · ${Math.ceil(run.boss.hp)} / ${run.boss.maxHp} HP`), W / 2, y + bh + 17);
}

/* ---------- HUD ---------- */
function updateHud() {
  if (!run) return;
  const p = run.player;
  $('hpFill').style.width = `${clamp((p.hp / p.maxHp) * 100, 0, 100)}%`;
  $('hpText').textContent = `${Math.ceil(p.hp)} / ${p.maxHp}`;
  $('statDamage').textContent = p.damage;
  $('statSpeed').textContent = `${Math.round((p.speed / BASE_SPEED) * 100)}%`;
  $('statAtkSpeed').textContent = `${Math.round(p.attackSpeed * 100)}%`;
  $('roomNum').textContent = run.room;
  $('roomTotal').textContent = run.totalRooms;
  $('enemyCounter').textContent = `Врагов: ${run.enemies.length + run.toSpawn}`;
  $('weaponChip').textContent = `ОРУЖИЕ: ${WEAPONS[p.weapon].name}`;
  for (const wid of ['pistol', 'shotgun', 'axe', 'rapier', 'mg']) {
    $(`${wid}Chip`).classList.toggle('chip-hidden', !run.weaponsOwned.includes(wid));
  }
  $('explosionChip').classList.toggle('chip-hidden', !p.explosion);
  $('explosionChip').textContent = p.explosionEnabled ? 'ВЗРЫВ' : 'ВЗРЫВ ВЫКЛ';
  $('explosionChip').classList.toggle('chip-explosion', p.explosion && p.explosionEnabled && weaponAllowsExplosion());
  $('vampirismChip').classList.toggle('chip-hidden', !p.vampirism);
  $('vampirismChip').textContent = p.vampirismEnabled ? 'ВАМПИРИЗМ' : 'ВАМПИРИЗМ ВЫКЛ';
  $('vampirismChip').classList.toggle('chip-vampirism', p.vampirism && p.vampirismEnabled && weaponAllowsVampirism());
  $('overheatChip').classList.toggle('chip-hidden', p.mgOverheat <= 0);
  $('overheatChip').textContent = `ПЕРЕГРЕВ ${p.mgOverheat.toFixed(1)}с`;
  $('slowChip').textContent = `ЗАМЕДЛЕНИЕ +${p.slow}`;
  $('slowChip').classList.toggle('chip-hidden', p.slow === 0);
  syncGameDebugPanel();
}

function updateTrack() {
  const track = $('roomTrack');
  track.innerHTML = '';
  track.classList.toggle('many', run.totalRooms === 100);
  for (let i = 1; i <= run.totalRooms; i++) {
    const node = document.createElement('div');
    node.className = 'room-node';
    const isBossRoom = run.totalRooms === 100 ? (i % 10 === 0) : (i % 5 === 0);
    if (isBossRoom) node.classList.add('boss');
    if (i < run.room) node.classList.add('done', 'closed');
    else if (i === run.room) node.classList.add('current');
    track.appendChild(node);
  }
}

function showRoomBanner(text, isBoss) {
  const banner = $('roomBanner');
  banner.textContent = text;
  banner.classList.toggle('boss-banner', isBoss);
  banner.classList.add('show');
  if (bannerTimer) clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => banner.classList.remove('show'), 1400);
}

/* ---------- Выбор баффа ---------- */
function pickBuffs() {
  const pool = BUFFS.filter(buffAllowed);
  const picks = [];
  while (picks.length < 2 && pool.length > 0) {
    const total = pool.reduce((s, b) => s + b.weight, 0);
    let r = Math.random() * total;
    let idx = 0;
    for (; idx < pool.length; idx++) {
      r -= pool[idx].weight;
      if (r <= 0) break;
    }
    picks.push(pool.splice(Math.min(idx, pool.length - 1), 1)[0]);
  }
  return picks;
}

function scheduleChoiceMenu() {
  if (choiceTimer) clearTimeout(choiceTimer);
  choiceTimer = setTimeout(showChoiceMenu, 650 / debugSpeed);
}

function openChoice() {
  if (mode !== 'play' || run.roomComplete) return;
  run.roomComplete = true;
  mode = 'choice';
  sfx('choice');
  // Небольшая задержка перед появлением меню
  scheduleChoiceMenu();
}

function showChoiceMenu() {
  choiceTimer = null;
  if (mode !== 'choice' || !run) return; // забег мог быть завершён до появления меню
  choiceSelected = [];
  const fullControl = debugFullControl || debugFreeChoice;
  choicePicks = fullControl ? BUFFS.slice() : pickBuffs();

  $('choiceTitle').textContent = fullControl ? 'ПОЛНЫЙ КОНТРОЛЬ' : 'КОМНАТА ПРОЙДЕНА';
  $('choiceSub').textContent = fullControl
    ? 'Выбери любые эффекты и подтверди выбор'
    : 'Выбери эффект и подтверди выбор — до нажатия можно передумать';
  $('choiceDescription').textContent = fullControl
    ? 'Доступны все эффекты. Можно выбрать несколько.'
    : 'Выбери эффект, чтобы увидеть его описание';

  const wrap = $('choiceCards');
  wrap.innerHTML = '';
  for (const buff of choicePicks) {
    const card = document.createElement('button');
    card.className = 'buff-card';
    card.dataset.buff = buff.id;
    card.innerHTML = `
      <span class="buff-icon">${buff.icon}</span>
      <span class="buff-name">${buff.name}</span>
      <span class="buff-desc">${buff.desc}</span>
      ${buff.tag ? `<span class="buff-tag">${buff.tag}</span>` : ''}
    `;
    card.addEventListener('click', () => toggleChoice(buff));
    wrap.appendChild(card);
  }
  $('confirmChoice').disabled = true;
  showOverlay('choice');
}

function toggleChoice(buff) {
  const i = choiceSelected.indexOf(buff.id);
  const fullControl = debugFullControl || debugFreeChoice;
  if (fullControl) {
    if (i >= 0) choiceSelected.splice(i, 1);
    else choiceSelected.push(buff.id);
  } else {
    choiceSelected = [buff.id];
  }
  document.querySelectorAll('#choiceCards .buff-card').forEach((c) => {
    c.classList.toggle('selected', choiceSelected.includes(c.dataset.buff));
  });
  $('choiceDescription').textContent = choiceSelected.includes(buff.id)
    ? `${buff.name}: ${buff.desc}${buff.tag ? ` [${buff.tag}]` : ''}`
    : fullControl
      ? `«${buff.name}» снят. Выбери эффекты и подтверди.`
      : 'Выбери эффект, чтобы увидеть его описание';
  sfx('select');
  $('confirmChoice').disabled = choiceSelected.length === 0;
}

function confirmBuffSelection() {
  if (!choiceSelected.length) return;
  sfx('confirm');
  for (const id of choiceSelected) {
    const buff = BUFFS.find((b) => b.id === id);
    if (buff) applyBuff(buff);
  }
  choiceSelected = [];
  if (debugFreeChoice) {
    // Меню открыто из боковой панели: остаёмся в той же комнате.
    debugFreeChoice = false;
    showOverlay(null);
    mode = 'play';
    updateHud();
    return;
  }
  showOverlay(null);
  proceedAfterBuffs();
}

function proceedAfterBuffs() {
  // Инвентарь нужен и для смены оружия, и для настройки взрыва
  if (run.weaponsOwned.length > 1 || run.player.explosion) openInventory();
  else {
    mode = 'play';
    enterRoom(run.room + 1);
  }
}

/* ---------- Инвентарь ---------- */
function hideInventoryPopup() {
  $('inventoryPopup').classList.remove('visible');
}

function showInventoryPopup(card, name, desc, state) {
  const popup = $('inventoryPopup');
  popup.innerHTML = `<span class="popup-name">${name}</span>`
    + `<span class="popup-desc">${desc}</span>`
    + (state ? `<span class="popup-state">${state}</span>` : '');

  // Размещаем окошко рядом с карточкой, но строго внутри окна инвентаря
  const host = $('inventoryScreen').querySelector('.inventory-card');
  const cardRect = card.getBoundingClientRect();
  const hostRect = host.getBoundingClientRect();
  const pw = popup.offsetWidth;
  const ph = popup.offsetHeight;
  let left = cardRect.left - hostRect.left + cardRect.width + 12;
  if (left + pw > hostRect.width - 14) left = cardRect.left - hostRect.left - pw - 12;
  left = clamp(left, 14, Math.max(14, hostRect.width - pw - 14));
  let top = cardRect.top - hostRect.top;
  top = clamp(top, 14, Math.max(14, hostRect.height - ph - 14));
  popup.style.left = `${left}px`;
  popup.style.top = `${top}px`;
  popup.classList.add('visible');
}

function bindInventoryPopup(card, name, desc, state) {
  if (isTouchDevice) {
    card.addEventListener('pointerdown', () => showInventoryPopup(card, name, desc, state));
  } else {
    card.addEventListener('mouseenter', () => showInventoryPopup(card, name, desc, state));
    card.addEventListener('mouseleave', hideInventoryPopup);
  }
  card.addEventListener('focus', () => showInventoryPopup(card, name, desc, state));
  card.addEventListener('blur', hideInventoryPopup);
}

function renderInventoryWeapons() {
  const wrap = $('inventoryCards');
  wrap.innerHTML = '';
  for (const wid of run.weaponsOwned) {
    const w = WEAPONS[wid];
    if (!w) continue;
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'buff-card inventory-item' + (wid === inventorySelected ? ' selected' : '');
    card.dataset.weapon = wid;
    card.innerHTML = `
      <span class="buff-icon">${w.icon}</span>
      <span class="buff-name">${w.name}</span>
    `;
    bindInventoryPopup(card, w.name, w.desc);
    card.addEventListener('click', () => {
      inventorySelected = wid;
      wrap.querySelectorAll('.buff-card').forEach((c) => {
        c.classList.toggle('selected', c.dataset.weapon === wid);
      });
      $('confirmWeapon').disabled = false;
      if (!isTouchDevice) hideInventoryPopup();
      renderInventoryAbilities();
    });
    wrap.appendChild(card);
  }
}

function renderInventoryAbilities() {
  const p = run.player;
  const abilities = Object.values(ABILITIES).filter((a) => a.owned(p));
  $('inventoryAbilityColumn').classList.toggle('chip-hidden', abilities.length === 0);
  $('inventoryGrid').classList.toggle('inventory-single', abilities.length === 0);
  $('inventoryAbilityHint').textContent = abilities.length
    ? 'Нажми на карточку, чтобы включить или выключить способность. Можно включить несколько.'
    : '';

  // Способность, несовместимая с выбранным оружием, выключается и блокируется
  for (const a of abilities) {
    if (!a.allows(inventorySelected) && a.enabled(p)) a.set(p, false);
  }

  const wrap = $('inventoryAbilities');
  wrap.innerHTML = '';
  for (const a of abilities) {
    const allowed = a.allows(inventorySelected);
    const enabled = a.enabled(p);
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'buff-card inventory-item ability-card'
      + (enabled ? ' selected' : '')
      + (allowed ? '' : ' locked');
    card.disabled = !allowed;
    card.dataset.ability = a.id;
    const stateText = !allowed
      ? 'НЕДОСТУПНО С ЭТИМ ОРУЖИЕМ'
      : (enabled ? 'ВКЛЮЧЕНО' : 'НАЖМИ, ЧТОБЫ ВКЛЮЧИТЬ');
    card.innerHTML = `
      <span class="buff-icon">${a.icon}</span>
      <span class="buff-name">${a.name}</span>
      <span class="ability-state">${stateText}</span>
    `;
    bindInventoryPopup(card, a.name, a.desc, stateText);
    card.addEventListener('click', () => {
      if (!a.allows(inventorySelected)) return;
      a.set(p, !a.enabled(p));
      if (!isTouchDevice) hideInventoryPopup();
      renderInventoryAbilities();
    });
    wrap.appendChild(card);
  }
  updateHud();
}

function openInventory() {
  mode = 'inventory';
  inventorySelected = run.player.weapon; // по умолчанию — оружие прошлой комнаты
  const current = WEAPONS[inventorySelected];
  $('currentWeapon').textContent = current.name;
  $('confirmWeapon').disabled = false;
  hideInventoryPopup();
  renderInventoryWeapons();
  renderInventoryAbilities();
  showOverlay('inventory');
}

function confirmWeaponChoice() {
  sfx('confirm');
  run.player.weapon = inventorySelected;
  run.player.mgBurst = null;
  run.player.mgShake = 0;
  hideInventoryPopup();
  showOverlay(null);
  mode = 'play';
  if (debugFreeInventory) {
    // Инвентарь открыт из боковой панели: остаёмся в той же комнате.
    debugFreeInventory = false;
    updateHud();
    return;
  }
  enterRoom(run.room + 1);
}

/* ---------- Пауза ---------- */
function openPause() {
  if (!['play', 'choice', 'inventory'].includes(mode)) return;
  pausedFrom = mode;
  if (choiceTimer) {
    // если меню баффа ещё не успело появиться — перенесём его на выход из паузы
    clearTimeout(choiceTimer);
    choiceTimer = null;
    choicePendingResume = true;
  }
  mode = 'pause';
  keys.clear();
  mouse.down = false;
  showOverlay('pause');
  syncGameDebugPanel();
}

function resumeGame() {
  if (mode !== 'pause') return;
  const back = pausedFrom || 'play';
  mode = back;
  pausedFrom = null;
  if (choicePendingResume) {
    choicePendingResume = false;
    showOverlay(null);
    scheduleChoiceMenu();
  } else {
    showOverlay(back === 'play' ? null : back);
  }
  syncGameDebugPanel();
}

/* ---------- Завершение забега ---------- */
function finish(victory) {
  if (mode === 'end') return;
  mode = 'end';
  debugFreeChoice = false;
  debugFreeInventory = false;
  syncGameDebugPanel();
  sfx(victory ? 'win' : 'lose');
  const net = Math.max(0, Math.round(run.damageDealt - run.damageTaken));
  const penalty = victory ? 0 : 0.30 - 0.20 * Math.min(1, (save.level - 1) / 9);
  const gained = Math.max(0, Math.round(net * (1 - penalty) * run.xpMul / run.xpDivisor));

  save.xp += gained;
  let levelUps = 0;
  while (save.xp >= xpNeeded(save.level)) {
    save.xp -= xpNeeded(save.level);
    save.level++;
    levelUps++;
  }
  if (levelUps > 0) sfx('levelup');
  persist();

  $('endTitle').textContent = victory ? `ВСЕ ${run.totalRooms} КОМНАТ ПРОЙДЕНЫ!` : 'ТЫ ПОГИБ';
  $('endTitle').className = victory ? 'win' : 'lose';
  const xpNotes = [];
  if (run.xpMul !== 1) xpNotes.push(`Опыт ×${run.xpMul} за сложность.`);
  const xpNote = gained > 0 && xpNotes.length ? ' ' + xpNotes.join(' ') : '';
  $('endSubtitle').textContent = victory
    ? `Победа! Опыт начислен полностью.${xpNote}`
    : gained > 0
      ? `Поражение: вычтено ${Math.round(penalty * 100)}% опыта, удержано ${Math.round((1 - penalty) * 100)}%.${xpNote}`
      : `Поражение: опыт не начислен.${xpNote}`;
  $('endRooms').textContent = `${victory ? run.totalRooms : run.room - 1} / ${run.totalRooms}`;
  $('endDealt').textContent = Math.round(run.damageDealt);
  $('endTaken').textContent = Math.round(run.damageTaken);
  const xpEl = $('endXp');
  xpEl.textContent = gained > 0 ? `+${gained} XP` : '0 XP';
  xpEl.className = gained > 0 ? 'positive' : '';
  $('endLevel').textContent = save.level + (levelUps > 0 ? `  (+${levelUps})` : '');
  const need = xpNeeded(save.level);
  $('endXpFill').style.width = `${Math.min(100, (save.xp / need) * 100)}%`;

  showOverlay('end');
  refreshMenu();

  // Возврат в меню после показа результатов
  let seconds = 6;
  const btn = $('menuBtn');
  btn.textContent = `В МЕНЮ (${seconds})`;
  if (endTimer) clearInterval(endTimer);
  endTimer = setInterval(() => {
    seconds--;
    if (seconds <= 0) fadeOutTo(returnToMenu);
    else btn.textContent = `В МЕНЮ (${seconds})`;
  }, 1000);
}

function returnToMenu() {
  resetPreviewKills();
  if (endTimer) { clearInterval(endTimer); endTimer = null; }
  if (choiceTimer) { clearTimeout(choiceTimer); choiceTimer = null; }
  if (introTimer) { clearTimeout(introTimer); introTimer = null; }
  if (introPlayTimer) { clearTimeout(introPlayTimer); introPlayTimer = null; }
  finishIntroFade();
  pausedFrom = null;
  choicePendingResume = false;
  closeSetup();
  $('menuBtn').textContent = 'В МЕНЮ';
  showOverlay(null);
  showBase('menu');
  mode = 'menu';
  run = null;
  debugFreeChoice = false;
  debugFreeInventory = false;
  syncGameDebugPanel();
  refreshMenu();
}

/* ---------- Главный цикл ---------- */
let touchControlsVisible = false;
function loop(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  if (isTouchDevice) {
    const visible = mode === 'play';
    if (visible !== touchControlsVisible) {
      touchControlsVisible = visible;
      $('touchControls').classList.toggle('visible', visible);
      $('touchControls').setAttribute('aria-hidden', visible ? 'false' : 'true');
      if (!visible) { resetJoystick(); mouse.down = false; }
    }
  }
  // В режиме 100 комнат весь геймплей ускорен в 1,5 раза; спидхак умножает темп дополнительно
  update(dt * (run ? run.timeScale : 1) * debugSpeed);
  if (mode === 'menu') {
    if (screens.menu.classList.contains('active')) updateMenuPreview(dt);
  } else draw();
  requestAnimationFrame(loop);
}

/* ---------- Ввод ---------- */
// Используем физические коды клавиш: WASD работают и на русской раскладке (ЦФЫВ)
function keyCode(e) {
  const map = {
    KeyW: 'w', KeyA: 'a', KeyS: 's', KeyD: 'd', KeyT: 't', KeyP: 'p',
    Escape: 'escape',
    ArrowUp: 'arrowup', ArrowDown: 'arrowdown', ArrowLeft: 'arrowleft', ArrowRight: 'arrowright',
    Space: 'space',
  };
  if (map[e.code]) return map[e.code];
  const k = (e.key || '').toLowerCase();
  return k === ' ' ? 'space' : k;
}

// Пока игрок печатает в поле, игровые горячие клавиши не должны срабатывать
function isTypingTarget(e) {
  const t = e.target;
  return !!(t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable));
}

window.addEventListener('keydown', (e) => {
  if (isTypingTarget(e)) return;
  if (mode === 'intro' || mode === 'spawn') { e.preventDefault(); return; }
  const k = keyCode(e);
  keys.add(k);
  if (['space', 'escape', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();

  // Esc сворачивает развёрнутую кнопку версии, не открывая паузу
  if (k === 'escape' && $('versionBtn').classList.contains('expanded')) {
    collapseVersion();
    return;
  }

  // Esc закрывает выезжающее меню выбора, если оно открыто
  if (k === 'escape' && mode === 'menu' && document.querySelector('.menu-card').classList.contains('setup-open')) {
    closeSetup();
  }

  // T / P / Esc открывают и закрывают паузу (KeyP работает и на русской раскладке — «З»)
  if (['t', 'p', 'escape'].includes(k) && !e.repeat) {
    if (mode === 'pause') {
      if (screens.debug.classList.contains('active')) {
        // из отладки, открытой через паузу, возвращаемся обратно в паузу
        showOverlay('pause');
      } else if (!screens.exitConfirm.classList.contains('active')) {
        resumeGame();
      }
    } else {
      openPause();
    }
  }

  // Ё на русской раскладке и ` на английской — открытие/закрытие меню отладки
  const debugHotkey = e.code === 'Backquote' || e.key === 'ё' || e.key === '`';
  if (debugHotkey && !e.repeat) toggleDebugMenu();

  if (k === 'space' && mode === 'play' && !e.repeat) playerAttack();
});

window.addEventListener('keyup', (e) => keys.delete(keyCode(e)));
window.addEventListener('blur', () => { keys.clear(); mouse.down = false; });

cvs.addEventListener('mousemove', (e) => {
  const r = cvs.getBoundingClientRect();
  mouse.x = (e.clientX - r.left) * (W / r.width);
  mouse.y = (e.clientY - r.top) * (H / r.height);
});

cvs.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  mouse.down = true;
  playerAttack();
});
window.addEventListener('mouseup', () => { mouse.down = false; });
cvs.addEventListener('contextmenu', (e) => e.preventDefault());

/* ---------- Сенсорное управление: джойстик + кнопка атаки ---------- */
function updateTouchAim() {
  if (!isTouchDevice || !run) return;
  const p = run.player;
  let best = null;
  let bestDist = Infinity;
  for (const e of run.enemies) {
    const dx = e.x - p.x, dy = e.y - p.y;
    const d = dx * dx + dy * dy;
    if (d < bestDist) { bestDist = d; best = e; }
  }
  if (run.boss && !run.bossDead) {
    const dx = run.boss.x - p.x, dy = run.boss.y - p.y;
    const d = dx * dx + dy * dy;
    if (d < bestDist) { bestDist = d; best = run.boss; }
  }
  if (best) {
    mouse.x = best.x;
    mouse.y = best.y;
  } else if (touchMove.active) {
    mouse.x = p.x + touchMove.x * 140;
    mouse.y = p.y + touchMove.y * 140;
  }
}

function setJoystick(clientX, clientY) {
  const max = 34;
  let dx = clientX - touchMove.cx;
  let dy = clientY - touchMove.cy;
  const dist = Math.hypot(dx, dy);
  if (dist > max) { dx = (dx / dist) * max; dy = (dy / dist) * max; }
  const len = Math.hypot(dx, dy);
  touchMove.x = len > 3 ? dx / max : 0;
  touchMove.y = len > 3 ? dy / max : 0;
  $('joystickKnob').style.transform = `translate(${dx}px, ${dy}px)`;
}

function resetJoystick() {
  touchMove.active = false;
  touchMove.x = 0;
  touchMove.y = 0;
  touchMove.id = null;
  $('joystickKnob').style.transform = 'translate(0px, 0px)';
}

if (isTouchDevice) {
  const zone = $('joystickZone');
  const attackBtn = $('attackBtn');

  zone.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const r = zone.getBoundingClientRect();
    touchMove.id = e.pointerId;
    touchMove.cx = r.left + r.width / 2;
    touchMove.cy = r.top + r.height / 2;
    touchMove.active = true;
    try { zone.setPointerCapture(e.pointerId); } catch (_) { /* синтетические события */ }
    setJoystick(e.clientX, e.clientY);
  });
  zone.addEventListener('pointermove', (e) => {
    if (e.pointerId !== touchMove.id) return;
    e.preventDefault();
    setJoystick(e.clientX, e.clientY);
  });
  const endJoystick = (e) => {
    if (e.pointerId !== touchMove.id) return;
    resetJoystick();
  };
  zone.addEventListener('pointerup', endJoystick);
  zone.addEventListener('pointercancel', endJoystick);
  zone.addEventListener('lostpointercapture', endJoystick);

  attackBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    updateTouchAim();
    mouse.down = true;
    playerAttack();
    try { attackBtn.setPointerCapture(e.pointerId); } catch (_) { /* синтетические события */ }
  });
  const endAttack = (e) => {
    e.preventDefault();
    mouse.down = false;
  };
  attackBtn.addEventListener('pointerup', endAttack);
  attackBtn.addEventListener('pointercancel', endAttack);
  attackBtn.addEventListener('lostpointercapture', endAttack);
}

// Короткий звук нажатия для всех кнопок интерфейса (кроме кнопки атаки)
document.addEventListener('click', (e) => {
  if (!e.target || !e.target.closest) return;
  if (e.target.closest('#attackBtn')) return;
  if (e.target.closest('button')) sfx('ui');
});

// Выезжающее меню выбора режима и сложности
function openSetup() {
  document.querySelector('.menu-card').classList.add('setup-open');
  $('setupPanel').setAttribute('aria-hidden', 'false');
}
function closeSetup() {
  document.querySelector('.menu-card').classList.remove('setup-open');
  $('setupPanel').setAttribute('aria-hidden', 'true');
}

$('playBtn').addEventListener('click', openSetup);
$('startRunBtn').addEventListener('click', () => { closeSetup(); newRun(); });
$('setupBackBtn').addEventListener('click', closeSetup);
$('menuBtn').addEventListener('click', () => fadeOutTo(returnToMenu));
$('soundBtn').addEventListener('click', toggleSound);
$('pauseSoundBtn').addEventListener('click', toggleSound);

// На телефоне нет клавиш P/Esc/Ё — пауза в правом верхнем углу,
// отладка — невидимая зона в левом верхнем углу
$('touchPauseBtn').addEventListener('click', openPause);
$('touchDebugHotspot').addEventListener('click', toggleDebugMenu);

/* ---------- Меню отладки ---------- */
function syncDebugToggles() {
  $('godToggle').classList.toggle('on', debugGodMode);
  $('godToggle').textContent = debugGodMode ? 'ВКЛ' : 'ВЫКЛ';
  $('controlToggle').classList.toggle('on', debugFullControl);
  $('controlToggle').textContent = debugFullControl ? 'ВКЛ' : 'ВЫКЛ';
  $('gameDebugToggle').classList.toggle('on', debugGameplay);
  $('gameDebugToggle').textContent = debugGameplay ? 'ВКЛ' : 'ВЫКЛ';
  $('gameDebugInGameToggle').classList.toggle('on', debugGameInGame);
  $('gameDebugInGameToggle').textContent = debugGameInGame ? 'ВКЛ' : 'ВЫКЛ';
  $('autoAttackToggle').classList.toggle('on', debugAutoAttack);
  $('autoAttackToggle').textContent = debugAutoAttack ? 'ВКЛ' : 'ВЫКЛ';
  $('enemyPauseToggle').classList.toggle('on', debugEnemyPause);
  $('enemyPauseToggle').textContent = debugEnemyPause ? 'ВКЛ' : 'ВЫКЛ';
  document.querySelectorAll('.speed-btn').forEach((btn) => {
    btn.classList.toggle('active', Number(btn.dataset.speed) === debugSpeed);
  });
}

function openDebug(from) {
  debugReturn = from;
  syncDebugToggles();
  const hint = $('debugXpHint');
  if (hint) hint.textContent = '';
  showOverlay('debug');
}

// Открытие/закрытие отладки с клавиатуры и через невидимую кнопку на телефоне
function toggleDebugMenu() {
  if (screens.debug.classList.contains('active')) {
    showOverlay(debugReturn === 'pause' ? 'pause' : null);
  } else if (mode === 'menu' || mode === 'end') {
    openDebug('menu');
  } else {
    if (mode !== 'pause') openPause();
    openDebug('pause');
  }
}

// Единая схема полей ввода отладки: текст + кнопка справа, ENTER,
// только целые числа через BigInt, некорректный ввод очищает поле.
function bindNumberField(inputId, btnId, hintId, apply) {
  const input = $(inputId);
  const btn = $(btnId);
  const hint = hintId ? $(hintId) : null;
  const submit = () => {
    const raw = (input.value || '').trim();
    if (!/^[+-]?\d+$/.test(raw)) {
      input.value = '';
      if (hint) hint.textContent = 'НУЖНО ЦЕЛОЕ ЧИСЛО';
      return;
    }
    // BigInt снимает лимит Number.isSafeInteger: принимаем числа любой длины.
    const delta = BigInt(raw);
    input.value = '';
    const note = apply(delta);
    if (hint) hint.textContent = `${delta > 0n ? '+' : ''}${delta}${note ? ` ${note}` : ''}`;
  };
  btn.addEventListener('click', submit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submit();
    }
  });
  return { clearHint: () => { if (hint) hint.textContent = ''; } };
}

bindNumberField('debugXpInput', 'debugXpBtn', 'debugXpHint', (delta) => {
  const maxXp = BigInt(Number.MAX_VALUE);
  let xp = BigInt(Math.max(0, Math.floor(Number(save.xp)) || 0)) + delta;
  if (xp < 0n) xp = 0n;
  const capped = xp > maxXp;
  if (capped) xp = maxXp;

  let level = Math.max(1, Math.floor(Number(save.level)) || 1);
  const beforeLevel = level;
  let levelUps = 0;
  while (true) {
    const need = BigInt(xpNeeded(level));
    if (xp < need) break;
    xp -= need;
    level++;
    levelUps++;
  }

  save.xp = Number(xp);
  save.level = level;
  if (levelUps > 0) sfx('levelup');
  else sfx('confirm');
  persist();
  refreshMenu();
  return `XP${level !== beforeLevel ? ` · УРОВЕНЬ ${level}` : ''}${capped ? ' · ПРЕДЕЛ ЧИСЛА JS' : ''}`;
});

$('infoBtn').addEventListener('click', () => {
  showOverlay(null);
  closeSetup();
  animateBaseSwitch('menu', 'info', 'forward');
  resetInfoDetail();
});
$('infoExitBtn').addEventListener('click', () => {
  animateBaseSwitch('info', 'menu', 'back');
  refreshMenu();
});
$('settingsBtn').addEventListener('click', () => {
  showOverlay(null);
  closeSetup();
  collapseVersion();
  animateBaseSwitch('menu', 'settings', 'forward');
});
$('settingsExitBtn').addEventListener('click', () => {
  collapseVersion();
  animateBaseSwitch('settings', 'menu', 'back');
  refreshMenu();
});

// Кнопка версии разворачивается в прокручиваемую панель прямо на месте.
function expandVersion() {
  const btn = $('versionBtn');
  const rect = btn.getBoundingClientRect();
  // ×1.5 по ширине и ×5 по высоте; центрирование и ограничение ширины делает CSS.
  btn.style.width = `${rect.width * 1.5}px`;
  btn.style.height = `${rect.height * 5}px`;
  btn.style.maxWidth = '';
  $('versionNotice').classList.add('expanded');
  btn.classList.add('expanded');
  btn.scrollIntoView({ block: 'center', behavior: 'smooth' });
}
function collapseVersion() {
  const btn = $('versionBtn');
  if (!btn.classList.contains('expanded')) return;
  btn.classList.remove('expanded');
  $('versionNotice').classList.remove('expanded');
  btn.style.width = '';
  btn.style.height = '';
}
$('versionBtn').addEventListener('click', (e) => {
  if (e.target.closest('#versionContent')) return;
  dismissVersionNotice();
  if ($('versionBtn').classList.contains('expanded')) collapseVersion();
  else expandVersion();
});
// Прокрутка текста не должна сворачивать панель
$('versionContent').addEventListener('click', (e) => e.stopPropagation());
$('versionContent').addEventListener('pointerdown', (e) => e.stopPropagation());
$('debugBack').addEventListener('click', () => showOverlay(debugReturn === 'pause' ? 'pause' : null));
$('godToggle').addEventListener('click', () => {
  debugGodMode = !debugGodMode;
  syncDebugToggles();
});
$('controlToggle').addEventListener('click', () => {
  debugFullControl = !debugFullControl;
  syncDebugToggles();
});
$('gameDebugToggle').addEventListener('click', () => {
  debugGameplay = !debugGameplay;
  syncDebugToggles();
  syncGameDebugPanel();
});
$('gameDebugInGameToggle').addEventListener('click', () => {
  debugGameInGame = !debugGameInGame;
  syncDebugToggles();
  syncGameDebugPanel();
});
$('autoAttackToggle').addEventListener('click', () => {
  debugAutoAttack = !debugAutoAttack;
  syncDebugToggles();
});
$('enemyPauseToggle').addEventListener('click', () => {
  debugEnemyPause = !debugEnemyPause;
  syncDebugToggles();
});
document.querySelectorAll('.speed-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    debugSpeed = Number(btn.dataset.speed);
    syncDebugToggles();
  });
});

/* ---------- Боковое меню отладки игрового процесса ---------- */
const MAX_STAT_DELTA = Number.MAX_SAFE_INTEGER;
function statDelta(delta) {
  const n = Number(delta);
  if (!Number.isFinite(n)) return delta > 0n ? MAX_STAT_DELTA : -MAX_STAT_DELTA;
  return clamp(n, -MAX_STAT_DELTA, MAX_STAT_DELTA);
}

function debugChangeStat(kind, delta) {
  if (!run) return 'НЕТ ЗАБЕГА';
  const p = run.player;
  const n = statDelta(delta);

  if (kind === 'damage') {
    p.damage = Math.max(0, p.damage + n);
  } else if (kind === 'speed') {
    p.speed = Math.max(0, p.speed + n);
  } else if (kind === 'health') {
    p.maxHp = Math.max(1, p.maxHp + n);
    p.hp = clamp(p.hp + n, 1, p.maxHp);
  } else if (kind === 'attackSpeed') {
    // Как и бафф «Скорость атаки +10»: число означает проценты.
    p.attackSpeed = Math.max(0.05, p.attackSpeed * (1 + n / 100));
  } else if (kind === 'slow') {
    p.slow += n;
  }

  sfx('confirm');
  updateHud();
  if (kind === 'damage') return `УРОН ${Math.round(p.damage)}`;
  if (kind === 'speed') return `СКОРОСТЬ ${Math.round(p.speed)}`;
  if (kind === 'health') return `HP ${Math.ceil(p.hp)}/${p.maxHp}`;
  if (kind === 'attackSpeed') return `АТАКА ${Math.round(p.attackSpeed * 100)}%`;
  return `ЗАМЕДЛЕНИЕ ${p.slow}`;
}

const gameDebugFields = {
  damage: bindNumberField('gdpDamageInput', 'gdpDamageBtn', 'gdpDamageHint', (d) => debugChangeStat('damage', d)),
  speed: bindNumberField('gdpSpeedInput', 'gdpSpeedBtn', 'gdpSpeedHint', (d) => debugChangeStat('speed', d)),
  health: bindNumberField('gdpHealthInput', 'gdpHealthBtn', 'gdpHealthHint', (d) => debugChangeStat('health', d)),
  attack: bindNumberField('gdpAttackInput', 'gdpAttackBtn', 'gdpAttackHint', (d) => debugChangeStat('attackSpeed', d)),
  slow: bindNumberField('gdpSlowInput', 'gdpSlowBtn', 'gdpSlowHint', (d) => debugChangeStat('slow', d)),
};

function syncGameDebugPanel() {
  const panel = $('gameDebugPanel');
  // Главный переключатель разрешает панель вообще. Без него её нет нигде.
  // При включённом — в паузе она есть всегда, а «ПОКАЗЫВАТЬ В ИГРЕ»
  // дополнительно оставляет её видимой во время забега.
  const inRun = !!run && mode !== 'menu' && mode !== 'end';
  const visible = inRun && debugGameplay && (mode === 'pause' || debugGameInGame);
  if (visible && !isTouchDevice) {
    const gap = Math.max(12, window.innerHeight - screens.game.getBoundingClientRect().bottom);
    document.documentElement.style.setProperty('--debug-panel-bottom', `${gap}px`);
  }
  panel.classList.toggle('visible', visible);
  panel.setAttribute('aria-hidden', visible ? 'false' : 'true');
  // На телефоне сдвигаем игровое поле влево только тогда, когда панель
  // реально мешает бою: включены оба переключателя. В паузе при одном
  // главном переключателе интерфейс остаётся нетронутым.
  const shiftInterface = inRun && debugGameplay && debugGameInGame;
  document.body.classList.toggle('game-debug-open', shiftInterface);
  syncPauseDebugLayer();
  if (!visible) {
    const active = document.activeElement;
    if (active && panel.contains(active)) active.blur();
    Object.values(gameDebugFields).forEach((f) => f.clearHint());
    return;
  }
  const p = run.player;
  $('gdpRoom').textContent = `КОМНАТА ${run.room}/${run.totalRooms}`;
  $('gdpDamageVal').textContent = Math.round(p.damage);
  $('gdpSpeedVal').textContent = Math.round(p.speed);
  $('gdpHealthVal').textContent = `${Math.ceil(p.hp)}/${p.maxHp}`;
  $('gdpAttackVal').textContent = `${Math.round(p.attackSpeed * 100)}%`;
  $('gdpSlowVal').textContent = p.slow;
}

// В паузе боковая панель отладки должна оставаться поверх затемнения
// и принимать клики, но не мешать вложенным окнам (отладка, подтверждения).
function syncPauseDebugLayer() {
  const panelVisible = $('gameDebugPanel').classList.contains('visible');
  const pauseOnTop = mode === 'pause'
    && screens.pause.classList.contains('active')
    && !screens.debug.classList.contains('active')
    && !screens.exitConfirm.classList.contains('active')
    && !screens.confirm.classList.contains('active');
  document.body.classList.toggle('pause-debug-open', panelVisible && pauseOnTop);
}

// Меню из боковой панели: не завершаем комнату и не переходим в следующую.
function debugOpenFreeChoice() {
  if (!run || mode !== 'play') return;
  debugFreeChoice = true;
  choiceSelected = [];
  mode = 'choice';
  showChoiceMenu();
}

function debugOpenFreeInventory() {
  if (!run || mode !== 'play') return;
  debugFreeInventory = true;
  openInventory();
}

function debugCompleteRoom() {
  if (!run || mode !== 'play' || run.roomComplete) return;
  if (run.room >= run.totalRooms) finish(true);
  else openChoice();
}

$('gdpMore').addEventListener('click', debugOpenFreeChoice);
$('gdpInventory').addEventListener('click', debugOpenFreeInventory);
$('gdpComplete').addEventListener('click', debugCompleteRoom);
$('gdpDebug').addEventListener('click', () => {
  if (!run || !['play', 'pause'].includes(mode)) return;
  if (mode === 'play') openPause();
  openDebug('pause');
});

// Сброс уровня только после подтверждения (кнопка живёт в меню отладки)
$('resetBtn').addEventListener('click', () => {
  confirmReturn = 'debug';
  showOverlay('confirm');
});
$('cancelReset').addEventListener('click', () => {
  showOverlay(confirmReturn);
  confirmReturn = null;
});
$('confirmReset').addEventListener('click', () => {
  // язык и просмотренные уведомления сохраняем при сбросе уровня
  save = { level: 1, xp: 0, lang: save.lang, seenNotices: [...save.seenNotices] };
  persist();
  refreshMenu();
  showOverlay(confirmReturn);
  confirmReturn = null;
});

// Подтверждение выбора баффов и оружия
$('confirmChoice').addEventListener('click', confirmBuffSelection);
$('confirmWeapon').addEventListener('click', confirmWeaponChoice);

// Пауза и подтверждение выхода
$('resumeBtn').addEventListener('click', resumeGame);
$('exitBtn').addEventListener('click', () => showOverlay('exitConfirm'));
$('cancelExit').addEventListener('click', () => showOverlay('pause'));
$('confirmExit').addEventListener('click', () => {
  pausedFrom = null;
  choicePendingResume = false;
  fadeOutTo(returnToMenu);
});

// Выбор режима игры (только карточки самого меню режимов)
document.querySelectorAll('#modeSelect .mode-card').forEach((card) => {
  card.addEventListener('click', () => {
    selectedMode = card.dataset.mode;
    document.querySelectorAll('#modeSelect .mode-card').forEach((c) => c.classList.toggle('active', c === card));
  });
});

// Выбор языка интерфейса: карточки следуют за I18N, язык пишется в save.json.
function applyLanguageCards() {
  selectedLanguage = I18N.getLanguage();
  document.querySelectorAll('#langSelect .mode-card').forEach((c) => {
    c.classList.toggle('active', c.dataset.lang === selectedLanguage);
  });
  $('langHint').textContent = selectedLanguage === 'en'
    ? 'Интерфейс на английском языке.'
    : 'Интерфейс на русском языке.';
}
function syncLanguageUI() {
  applyLanguageCards();
  // Пока сохранение не загрузилось, не перезаписываем язык из save.json.
  if (!saveLoading) {
    save.lang = I18N.getLanguage();
    persist();
  }
}
document.querySelectorAll('#langSelect .mode-card').forEach((card) => {
  card.addEventListener('click', () => I18N.setLanguage(card.dataset.lang));
});
window.addEventListener('languagechange', syncLanguageUI);

// Выбор сложности (правила волн и параметры врагов)
document.querySelectorAll('.diff-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    selectedDifficulty = btn.dataset.diff;
    document.querySelectorAll('.diff-btn').forEach((b) => b.classList.toggle('active', b === btn));
  });
});

/* ---------- Старт ---------- */
buildInfoScreen();
syncLanguageUI();
syncDebugToggles();
syncSoundButtons();
updateSaveLoadingUI();
loadServerSave();
refreshMenu();
applyNotices();
showBase('menu');
syncWindowSize();
requestAnimationFrame(loop);
