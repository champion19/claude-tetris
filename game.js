'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#64b5f6', // J - azul pálido
  '#ffb74d', // L - orange
  '#b0bec5', // N - tuerca (gris metálico)
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8,8,8],[8,0,8],[8,8,8]],                  // Tuerca (reto): hueco central vacío
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const GRID_COLORS = { dark: '#22222e', light: '#d8d8e4' };
const THEME_KEY = 'tetris-theme';
const START_LEVEL_KEY = 'tetris-start-level';
const MAX_START_LEVEL = 10;
const RECORDS_KEY = 'tetris-records';
const PLAYER_KEY = 'tetris-player';
const MAX_RECORDS = 5;

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const themeToggleBtn = document.getElementById('theme-toggle');
const pauseMenu = document.getElementById('pause-menu');
const resumeBtn = document.getElementById('resume-btn');
const pauseRestartBtn = document.getElementById('pause-restart-btn');
const controlsBtn = document.getElementById('controls-btn');
const pauseControls = document.getElementById('pause-controls');
const startLevelSelect = document.getElementById('start-level');
const newRecordEl = document.getElementById('new-record');
const nameForm = document.getElementById('name-form');
const nameInput = document.getElementById('name-input');
const recordsEl = document.getElementById('records');
const recordsBody = document.getElementById('records-body');
const recordsBests = document.getElementById('records-bests');
const resetRecordsBtn = document.getElementById('reset-records-btn');

// Teclas pulsadas con el menú abierto: se ignoran en el juego hasta soltarlas
const blockedKeys = new Set();

let board, current, next, score, lines, level, startLevel, paused, gameOver, lastTime, dropAccum, dropInterval, animId, theme;
// combo: piezas seguidas que limpian líneas; maxCombo: el mejor de la partida
let combo, maxCombo;
// records: { top: [{ name, score, lines, combo }], bestCombo, maxLines }
// pendingRank: puesto (0..4) que ocupará la partida recién terminada, o -1
// highlightIndex: fila de la tabla a resaltar, o -1
let records, pendingRank = -1, highlightIndex = -1;

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * (PIECES.length - 1)) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  combo = cleared ? combo + 1 : 0;
  maxCombo = Math.max(maxCombo, combo);
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.max(startLevel, Math.floor(lines / 10) + 1);
    dropInterval = speedFor(level);
    updateHUD();
  }
}

function speedFor(lvl) {
  return Math.max(100, 1000 - (lvl - 1) * 90);
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  clearLines();
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = GRID_COLORS[theme];
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  records.bestCombo = Math.max(records.bestCombo, maxCombo);
  records.maxLines = Math.max(records.maxLines, lines);
  saveRecords();
  pendingRank = recordRank(score);
  highlightIndex = -1;
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()} · Líneas: ${lines} · Combo: ${maxCombo}`;
  showOverlay('Reiniciar', true);
  updateNewRecord();
  if (pendingRank !== -1) {
    nameInput.value = localStorage.getItem(PLAYER_KEY) || '';
    nameInput.focus();
    nameInput.select();
  }
}

// ---- Tabla de récords (localStorage) ----

function loadRecords() {
  let data = null;
  try {
    data = JSON.parse(localStorage.getItem(RECORDS_KEY));
  } catch {
    data = null;
  }
  const top = Array.isArray(data?.top) ? data.top : [];
  records = {
    top: top
      .filter(r => r && Number.isFinite(r.score))
      .map(r => ({ name: String(r.name), score: r.score, lines: Number(r.lines) || 0, combo: Number(r.combo) || 0 }))
      .slice(0, MAX_RECORDS),
    bestCombo: Number(data?.bestCombo) || 0,
    maxLines: Number(data?.maxLines) || 0,
  };
}

function saveRecords() {
  localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
}

// Puesto que ocuparía `s` en el top, o -1 si no entra. A igualdad de puntos, gana el récord antiguo.
function recordRank(s) {
  if (s <= 0) return -1;
  const i = records.top.findIndex(r => s > r.score);
  if (i !== -1) return i;
  return records.top.length < MAX_RECORDS ? records.top.length : -1;
}

function renderRecords() {
  recordsBody.replaceChildren();
  if (!records.top.length) {
    const td = document.createElement('td');
    td.colSpan = 5;
    td.className = 'empty';
    td.textContent = 'Sin récords todavía';
    recordsBody.appendChild(document.createElement('tr')).appendChild(td);
  }
  records.top.forEach((r, i) => {
    const tr = document.createElement('tr');
    if (i === highlightIndex) tr.classList.add('highlight');
    for (const v of [i + 1, r.name, r.score.toLocaleString(), r.lines, r.combo]) {
      const td = document.createElement('td');
      td.textContent = v;
      tr.appendChild(td);
    }
    recordsBody.appendChild(tr);
  });
  recordsBests.textContent = `Mejor combo: ${records.bestCombo} · Líneas máx.: ${records.maxLines}`;
}

// Muestra el aviso de "nuevo récord" y el campo de nombre si la partida entra en el top
function updateNewRecord() {
  const qualifies = pendingRank !== -1;
  newRecordEl.classList.toggle('hidden', !qualifies && highlightIndex === -1);
  nameForm.classList.toggle('hidden', !qualifies);
  if (qualifies) newRecordEl.textContent = `¡Nuevo récord! Puesto #${pendingRank + 1}`;
}

function saveRecord(e) {
  e.preventDefault();
  if (pendingRank === -1) return;
  const name = nameInput.value.trim() || 'Anónimo';
  localStorage.setItem(PLAYER_KEY, name);
  records.top.splice(pendingRank, 0, { name, score, lines, combo: maxCombo });
  records.top.length = Math.min(records.top.length, MAX_RECORDS);
  saveRecords();
  highlightIndex = pendingRank;
  pendingRank = -1;
  updateNewRecord();
  renderRecords();
  restartBtn.focus();
}

function resetRecords() {
  if (!confirm('¿Borrar todos los récords?')) return;
  localStorage.removeItem(RECORDS_KEY);
  loadRecords();
  highlightIndex = -1;
  // Tras el game over, la partida actual vuelve a poder entrar en la tabla vacía
  if (gameOver && current) {
    pendingRank = recordRank(score);
    updateNewRecord();
  }
  renderRecords();
}

// Overlay compartido por inicio y game over (la pausa usa #pause-menu)
function showOverlay(buttonText, withRecords) {
  restartBtn.textContent = buttonText;
  newRecordEl.classList.add('hidden');
  nameForm.classList.add('hidden');
  recordsEl.classList.toggle('hidden', !withRecords);
  if (withRecords) renderRecords();
  overlay.classList.remove('hidden');
}

function showStartScreen() {
  gameOver = true; // no hay partida en curso: el teclado y la pausa se ignoran
  overlayTitle.textContent = 'TETRIS';
  overlayScore.textContent = '';
  showOverlay('Jugar', true);
}

function applyTheme(t) {
  theme = t;
  document.documentElement.setAttribute('data-theme', t);
  themeToggleBtn.textContent = t === 'light' ? '☀️' : '🌙';
}

function loadTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  applyTheme(saved === 'light' ? 'light' : 'dark');
}

function toggleTheme() {
  const t = theme === 'light' ? 'dark' : 'light';
  applyTheme(t);
  localStorage.setItem(THEME_KEY, t);
}

function loadStartLevel() {
  for (let n = 1; n <= MAX_START_LEVEL; n++) {
    const opt = document.createElement('option');
    opt.value = n;
    opt.textContent = n;
    startLevelSelect.appendChild(opt);
  }
  const saved = parseInt(localStorage.getItem(START_LEVEL_KEY), 10);
  startLevelSelect.value = saved >= 1 && saved <= MAX_START_LEVEL ? saved : 1;
}

// Solo se guarda: la partida en curso no cambia, init() lo lee al reiniciar
function changeStartLevel() {
  localStorage.setItem(START_LEVEL_KEY, startLevelSelect.value);
}

function showControls(show) {
  pauseControls.classList.toggle('hidden', !show);
  controlsBtn.textContent = show ? 'Ocultar controles' : 'Ver controles';
  controlsBtn.setAttribute('aria-expanded', show);
}

function pauseGame() {
  if (paused || gameOver) return;
  paused = true;
  cancelAnimationFrame(animId);
  showControls(false);
  pauseMenu.classList.remove('hidden');
  resumeBtn.focus();
}

function resumeGame() {
  if (!paused) return;
  paused = false;
  pauseMenu.classList.add('hidden');
  document.activeElement.blur();
  lastTime = performance.now();
  loop(lastTime);
}

function togglePause() {
  if (paused) resumeGame(); else pauseGame();
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  if (gameOver) return; // endGame() no puede cancelar el frame en curso
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  startLevel = parseInt(startLevelSelect.value, 10);
  level = startLevel;
  combo = 0;
  maxCombo = 0;
  pendingRank = -1;
  highlightIndex = -1;
  paused = false;
  gameOver = false;
  dropInterval = speedFor(level);
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  pauseMenu.classList.add('hidden');
  // Quita el foco del botón pulsado para que Space no lo vuelva a activar durante la partida
  document.activeElement?.blur();
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP' || e.code === 'Escape') {
    // Ignorar autorrepetición: mantener P pulsada no debe alternar la pausa
    if (!e.repeat) togglePause();
    return;
  }
  if (paused) {
    // Bloquear inputs del juego con el menú abierto. Space no debe activar
    // el botón con foco (p. ej. Reiniciar por reflejo de hard drop); Enter sí.
    blockedKeys.add(e.code);
    if (e.code === 'Space' || (e.code.startsWith('Arrow') && e.target !== startLevelSelect)) e.preventDefault();
    return;
  }
  // Una tecla que se mantenía pulsada al cerrar el menú no mueve la pieza
  if (blockedKeys.has(e.code)) { e.preventDefault(); return; }
  if (gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

document.addEventListener('keyup', e => {
  blockedKeys.delete(e.code);
  // Chrome activa los botones con Space en keyup
  if (paused && e.code === 'Space') e.preventDefault();
});

// Si se suelta una tecla con la ventana sin foco, el keyup nunca llega
window.addEventListener('blur', () => blockedKeys.clear());

restartBtn.addEventListener('click', init);
themeToggleBtn.addEventListener('click', toggleTheme);
resumeBtn.addEventListener('click', resumeGame);
pauseRestartBtn.addEventListener('click', init);
controlsBtn.addEventListener('click', () => showControls(pauseControls.classList.contains('hidden')));
startLevelSelect.addEventListener('change', changeStartLevel);
nameForm.addEventListener('submit', saveRecord);
resetRecordsBtn.addEventListener('click', resetRecords);

loadTheme();
loadStartLevel();
loadRecords();
showStartScreen();
