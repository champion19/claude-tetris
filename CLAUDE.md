# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Vanilla-JS Tetris. No `package.json`, no bundler, no transpiler, no test suite, no lint config. Three source files: `index.html`, `style.css`, `game.js`.

## Running

Open the file directly (`open index.html`) or serve statically (`python3 -m http.server 8000`, `npx serve .`). Either works — there is no build step. To verify a change, reload the page; there are no tests to run.

## Architecture (`game.js`)

All game logic lives in one file as module-level functions over shared `let` globals (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropAccum`, `dropInterval`, `animId`). No classes, no state object. `init()` resets every global and is also the restart-button handler.

Key invariants that span files/functions:

- **Cell value == color index == piece type.** A board cell holds `0` or `1..8`; `PIECES[n]` is filled entirely with the literal `n`, and `COLORS[n]` is that piece's color. Both arrays are 1-indexed with a leading `null`. Adding or reordering a piece means editing `PIECES` and `COLORS` together; `randomPiece()` derives the count from `PIECES.length - 1`. Piece 8 is the "tuerca" challenge piece: a 3×3 ring whose center `0` leaves an enclosed hole once locked.
- **Canvas size is duplicated in HTML.** `<canvas id="board">` is hardcoded `300 × 600` in `index.html` and must equal `COLS * BLOCK` × `ROWS * BLOCK`. Changing `COLS`/`ROWS`/`BLOCK` without updating the HTML silently rescales the board.
- **Rotation has no per-piece kick tables.** `rotateCW` is transpose+reverse on the piece's own square matrix; `tryRotate` retries horizontal offsets `[0,-1,1,-2,2]` and abandons the rotation if all collide. This is not SRS.
- **The render loop is the only clock.** `loop()` accumulates `dt` and drops one row when `dropAccum >= dropInterval`; `dropAccum` is reset to `0` (not decremented), so a long frame loses the remainder. Level, `dropInterval`, and score are all recomputed inside `clearLines()`: `level = baseLevel + floor(lines/10)`, `dropInterval = intervalFor(level)`. `startLevel` is the menu selection for the *next* game (persisted in `localStorage` `tetris-start-level`); `init()` copies it into `baseLevel`, so changing the selector mid-game never alters the running game.
- **`lockPiece()` is the single commit path** — `merge()` → `clearLines()` → `spawn()` — reached from gravity in `loop()`, from `softDrop()`, and from `hardDrop()`.
- **Pause/resume restarts the rAF chain.** `P`/`Escape` → `togglePause()` → `openPauseMenu()` (cancels the frame, shows `#pause-menu`) or `resumeGame()` (hides the menu, blurs menu focus, resets `lastTime`, calls `loop(lastTime)` so `dt` does not jump). Any new code path that stops the loop must do the same or the piece will teleport downward. `#overlay` is only for game over.
- **Pause menu blocks game input.** While `paused`, keydown ignores every game key (and `preventDefault`s Space/arrows outside the menu) and Tab is trapped inside the menu. `resumeGame()` clears `freshKeys`; afterwards an auto-repeat keydown (`e.repeat`) whose code has not had a fresh press since resume is dropped, so a key held through the menu cannot move the piece. Resume also blurs whatever element has focus so Space/Enter can't re-activate a button.
- **Game over stops the loop in two places.** `endGame()` calls `cancelAnimationFrame(animId)`, which only covers a pending frame (key-triggered drops). When game over happens via gravity inside `loop()`, that frame is already running, so `loop()` checks `gameOver` after `draw()` and returns without scheduling the next frame. Keep both when touching loop or game-over handling.

## Language

UI strings, README, and comments are in Spanish. Match that when adding user-facing text.
