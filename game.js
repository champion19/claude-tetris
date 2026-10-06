'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

// Skins visuales. Cada skin define `colors` (1-indexado con `null` delante:
// colors[n] es el color de la pieza n, igual que en PIECES), `grid` y `boardBg`
// opcionales (si faltan se usan GRID_COLORS[theme] y el fondo CSS del tema) y
// `drawBlock(context, x, y, color, size, alpha)` en coordenadas de celda.
const SKINS = {
  retro: {
    label: 'Retro',
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
    grid: null,
    boardBg: null,
    drawBlock(context, x, y, color, size) {
      context.fillStyle = color;
      context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
      // highlight
      context.fillStyle = 'rgba(255,255,255,0.12)';
      context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
    },
  },
  neon: {
    label: 'Neon',
    colors: [
      null,
      '#00f0ff', // I
      '#fff200', // O
      '#d000ff', // T
      '#39ff14', // S
      '#ff073a', // Z
      '#1f51ff', // J
      '#ff9f00', // L
      '#e0e0ff', // N - tuerca
    ],
    grid: '#101024',
    boardBg: '#000000',
    drawBlock(context, x, y, color, size) {
      const px = x * size + 3, py = y * size + 3, s = size - 6;
      context.shadowColor = color;
      context.shadowBlur = 14;
      context.strokeStyle = color;
      context.lineWidth = 2;
      context.strokeRect(px, py, s, s);
      context.shadowBlur = 6;
      context.fillStyle = color;
      context.globalAlpha *= 0.35;
      context.fillRect(px + 2, py + 2, s - 4, s - 4);
    },
  },
  pastel: {
    label: 'Pastel',
    colors: [
      null,
      '#a8e6ef', // I
      '#fdf1a6', // O
      '#d7b8f3', // T
      '#b8e6c1', // S
      '#f7b5b5', // Z
      '#b3d4fc', // J
      '#fdd3a8', // L
      '#d5dde3', // N - tuerca
    ],
    grid: null,
    boardBg: null,
    drawBlock(context, x, y, color, size) {
      const px = x * size + 2, py = y * size + 2, s = size - 4, r = 6;
      // roundRect simulado con arcos
      context.beginPath();
      context.moveTo(px + r, py);
      context.lineTo(px + s - r, py);
      context.arc(px + s - r, py + r, r, -Math.PI / 2, 0);
      context.lineTo(px + s, py + s - r);
      context.arc(px + s - r, py + s - r, r, 0, Math.PI / 2);
      context.lineTo(px + r, py + s);
      context.arc(px + r, py + s - r, r, Math.PI / 2, Math.PI);
      context.lineTo(px, py + r);
      context.arc(px + r, py + r, r, Math.PI, Math.PI * 1.5);
      context.closePath();
      context.fillStyle = color;
      context.fill();
      context.strokeStyle = 'rgba(255,255,255,0.6)';
      context.lineWidth = 1.5;
      context.stroke();
    },
  },
  pixel: {
    label: 'Pixel art',
    colors: [
      null,
      '#3ec6d8', // I
      '#f2c12e', // O
      '#9b4fc0', // T
      '#5cb85c', // S
      '#d9534f', // Z
      '#3a7bd5', // J
      '#f0883e', // L
      '#8a9ba8', // N - tuerca
    ],
    grid: null,
    boardBg: null,
    drawBlock(context, x, y, color, size) {
      const px = x * size, py = y * size;
      const p = size / 6; // "píxel" del sprite (5 px con BLOCK = 30)
      context.fillStyle = color;
      context.fillRect(px, py, size, size);
      // bisel: luz arriba/izquierda, sombra abajo/derecha
      context.fillStyle = 'rgba(255,255,255,0.35)';
      context.fillRect(px, py, size - p, p);
      context.fillRect(px, py, p, size - p);
      context.fillStyle = 'rgba(0,0,0,0.35)';
      context.fillRect(px + p, py + size - p, size - p, p);
      context.fillRect(px + size - p, py + p, p, size - p);
      // textura interior 4×4 en damero
      context.fillStyle = 'rgba(0,0,0,0.15)';
      for (let r = 0; r < 4; r++)
        for (let c = 0; c < 4; c++)
          if ((r + c) % 2 === 0)
            context.fillRect(px + p + c * p, py + p + r * p, p, p);
    },
  },
};

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
const DEFAULT_SKIN = 'retro';

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
  context.save();
  context.globalAlpha = alpha ?? 1;
  skin.drawBlock(context, x, y, skin.colors[colorIndex], size, alpha ?? 1);
  context.restore(); // restablece globalAlpha, shadowBlur, shadowColor...
}

// Rellena el fondo del canvas si la skin lo define; si no, queda el fondo CSS del tema.
function drawBackground(context, c) {
  context.clearRect(0, 0, c.width, c.height);
  if (skin.boardBg) {
    context.fillStyle = skin.boardBg;
    context.fillRect(0, 0, c.width, c.height);
  }
}

function drawGrid() {
  ctx.strokeStyle = skin.grid || GRID_COLORS[theme];
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
  drawBackground(ctx, canvas);
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
  drawBackground(nextCtx, nextCanvas);
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

function applySkin(name) {
  if (!Object.hasOwn(SKINS, name)) name = DEFAULT_SKIN;
  skin = SKINS[name];
  skinSelect.value = name;
  // Redibujar al momento: con pausa o game over el bucle no está corriendo.
  if (current) draw();
  if (next) drawNext();
}

function loadSkin() {
  let saved = null;
  try { saved = localStorage.getItem(SKIN_KEY); } catch (e) { /* almacenamiento no disponible */ }
  applySkin(saved);
}

function changeSkin() {
  const name = skinSelect.value;
  applySkin(name);
  try { localStorage.setItem(SKIN_KEY, skinSelect.value); } catch (e) { /* almacenamiento no disponible */ }
  skinSelect.blur(); // que las flechas/Espacio vuelvan a controlar el juego
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

const GAME_KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', 'Space', 'KeyX', 'KeyP'];

document.addEventListener('keydown', e => {
  // Si el selector de skin tiene el foco, las teclas de juego no deben cambiar su valor.
  if (e.target === skinSelect && GAME_KEYS.includes(e.code)) {
    e.preventDefault();
    skinSelect.blur();
  }
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
