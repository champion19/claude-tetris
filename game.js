'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

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
const SKIN_KEY = 'tetris-skin';

// Cada skin define su paleta (1-indexada como PIECES) y su función de dibujo de bloque.
// `grid` opcional fuerza el color de la cuadrícula ignorando el tema claro/oscuro.
const SKINS = {
  retro: {
    colors: [
      null,
      '#4dd0e1', // I - cyan
      '#ffd54f', // O - yellow
      '#ba68c8', // T - purple
      '#81c784', // S - green
      '#e57373', // Z - red
      '#64b5f6', // J - azul pálido
      '#ffb74d', // L - orange
      '#b0bec5', // N - tuerca (gris metálico)
    ],
    drawBlock: drawRetroBlock,
  },
  neon: {
    colors: [
      null,
      '#00f0ff', // I
      '#fff200', // O
      '#d000ff', // T
      '#39ff14', // S
      '#ff073a', // Z
      '#1f51ff', // J
      '#ff9e00', // L
      '#e0e0ff', // N - tuerca
    ],
    grid: '#12121c',
    drawBlock: drawNeonBlock,
  },
  pastel: {
    colors: [
      null,
      '#a8e6ef', // I
      '#fdf3b0', // O
      '#d7bde2', // T
      '#c1e8c1', // S
      '#f8b8b8', // Z
      '#b8d4f8', // J
      '#fdd5b1', // L
      '#d5dbe0', // N - tuerca
    ],
    drawBlock: drawPastelBlock,
  },
  pixel: {
    colors: [
      null,
      '#3cbcfc', // I
      '#f8b800', // O
      '#9878f8', // T
      '#58d854', // S
      '#e40058', // Z
      '#0058f8', // J
      '#fc7460', // L
      '#bcbcbc', // N - tuerca
    ],
    drawBlock: drawPixelBlock,
  },
};

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
const skinSelect = document.getElementById('skin-select');

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId, theme, skin;

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
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
  }
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
  const def = SKINS[skin];
  context.save();
  context.globalAlpha = alpha ?? 1;
  def.drawBlock(context, x * size, y * size, size, def.colors[colorIndex]);
  context.restore();
}

// Retro: bloque cuadrado de color plano con franja de brillo superior.
function drawRetroBlock(context, px, py, size, color) {
  context.fillStyle = color;
  context.fillRect(px + 1, py + 1, size - 2, size - 2);
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(px + 1, py + 1, size - 2, 4);
}

// Neon: contorno brillante con resplandor (shadowBlur) y relleno translúcido.
function drawNeonBlock(context, px, py, size, color) {
  context.shadowColor = color;
  context.shadowBlur = size / 2;
  context.fillStyle = color + '33';
  context.fillRect(px + 3, py + 3, size - 6, size - 6);
  context.strokeStyle = color;
  context.lineWidth = 2;
  context.strokeRect(px + 3, py + 3, size - 6, size - 6);
  context.shadowBlur = 0;
  context.fillStyle = color;
  context.fillRect(px + size / 2 - 2, py + size / 2 - 2, 4, 4);
}

// Pastel: rectángulo de esquinas redondeadas trazado a mano con arcTo.
function drawPastelBlock(context, px, py, size, color) {
  const x = px + 2, y = py + 2, w = size - 4, h = size - 4, r = size / 4;
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + w, y, x + w, y + h, r);
  context.arcTo(x + w, y + h, x, y + h, r);
  context.arcTo(x, y + h, x, y, r);
  context.arcTo(x, y, x + w, y, r);
  context.closePath();
  context.fillStyle = color;
  context.fill();
  context.strokeStyle = 'rgba(255,255,255,0.6)';
  context.lineWidth = 1.5;
  context.stroke();
  context.fillStyle = 'rgba(255,255,255,0.35)';
  context.beginPath();
  context.ellipse(px + size * 0.35, py + size * 0.3, size * 0.15, size * 0.08, 0, 0, Math.PI * 2);
  context.fill();
}

// Patrón 6×6 del skin pixel art: 1 = luz, 2 = sombra, 0 = color base.
const PIXEL_PATTERN = [
  [1,1,1,1,1,2],
  [1,0,0,0,0,2],
  [1,0,1,0,0,2],
  [1,0,0,0,0,2],
  [1,0,0,0,0,2],
  [2,2,2,2,2,2],
];

// Pixel art: color base con textura de "píxeles" grandes de luz y sombra.
function drawPixelBlock(context, px, py, size, color) {
  context.fillStyle = color;
  context.fillRect(px, py, size, size);
  const n = PIXEL_PATTERN.length;
  const p = size / n;
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) {
      const v = PIXEL_PATTERN[r][c];
      if (!v) continue;
      context.fillStyle = v === 1 ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.35)';
      context.fillRect(px + c * p, py + r * p, Math.ceil(p), Math.ceil(p));
    }
}

function drawGrid() {
  ctx.strokeStyle = SKINS[skin].grid || GRID_COLORS[theme];
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
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
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

function applySkin(k) {
  skin = SKINS[k] ? k : 'retro';
  document.documentElement.setAttribute('data-skin', skin);
  skinSelect.value = skin;
}

function loadSkin() {
  applySkin(localStorage.getItem(SKIN_KEY));
}

function changeSkin() {
  applySkin(skinSelect.value);
  localStorage.setItem(SKIN_KEY, skin);
  skinSelect.blur(); // evita que las flechas del juego sigan cambiando el selector
  // Redibuja ya: en pausa o game over el loop está detenido
  if (current) draw();
  if (next) drawNext();
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
  }
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
  level = 1;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.target === skinSelect) return; // el selector maneja sus propias teclas
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver) return;
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

restartBtn.addEventListener('click', init);
themeToggleBtn.addEventListener('click', toggleTheme);
skinSelect.addEventListener('change', changeSkin);

loadTheme();
loadSkin();
init();
