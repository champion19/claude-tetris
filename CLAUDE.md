# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Vanilla-JS Tetris. No `package.json`, no bundler, no transpiler, no test suite, no lint config. Three source files: `index.html`, `style.css`, `game.js`.

## Running

Open the file directly (`open index.html`) or serve statically (`python3 -m http.server 8000`, `npx serve .`). Either works — there is no build step. To verify a change, reload the page; there are no tests to run.

## Architecture (`game.js`)

All game logic lives in one file as module-level functions over shared `let` globals (`board`, `current`, `next`, `score`, `lines`, `level`, `startLevel`, `paused`, `gameOver`, `dropAccum`, `dropInterval`, `animId`, `theme`, `skin`, `combo`, `maxCombo`, `records`, `pendingRank`, `highlightIndex`). No classes, no state object. `init()` resets every per-game global and is also the restart/play-button handler.

Key invariants that span files/functions:

- **Cell value == color index == piece type.** A board cell holds `0` or `1..8`; `PIECES[n]` is filled entirely with the literal `n`, and `SKINS[skin].colors[n]` is that piece's color in the active skin. `PIECES` and every skin's `colors` are 1-indexed with a leading `null`. Adding or reordering a piece means editing `PIECES` and the `colors` of **every** skin in `SKINS` together; `randomPiece()` derives the count from `PIECES.length - 1`. Piece 8 is the "tuerca" challenge piece: a 3×3 ring whose center `0` leaves an enclosed hole once locked.
- **Canvas size is duplicated in HTML.** `<canvas id="board">` is hardcoded `300 × 600` in `index.html` and must equal `COLS * BLOCK` × `ROWS * BLOCK`. Changing `COLS`/`ROWS`/`BLOCK` without updating the HTML silently rescales the board.
- **Rotation has no per-piece kick tables.** `rotateCW` is transpose+reverse on the piece's own square matrix; `tryRotate` retries horizontal offsets `[0,-1,1,-2,2]` and abandons the rotation if all collide. This is not SRS.
- **The render loop is the only clock.** `loop()` accumulates `dt` and drops one row when `dropAccum >= dropInterval`; `dropAccum` is reset to `0` (not decremented), so a long frame loses the remainder. Level, `dropInterval`, and score are all recomputed inside `clearLines()`; level is `max(startLevel, floor(lines/10)+1)` and `speedFor(level)` gives `dropInterval`.
- **`lockPiece()` is the single commit path** — `merge()` → `clearLines()` → `spawn()` — reached from gravity in `loop()`, from `softDrop()`, and from `hardDrop()`.
- **Pause/resume restarts the rAF chain.** `resumeGame()` calls `loop(lastTime)` directly after resetting `lastTime`, so `dt` does not jump. Any new code path that stops the loop must do the same or the piece will teleport downward. `togglePause()` just dispatches to `pauseGame()`/`resumeGame()`.
- **Pause menu is a separate overlay** (`#pause-menu`); `#overlay` is shared only by the start screen and game over via `showOverlay()`. The start-level `<select>` is read by `init()` into `startLevel`, so changing it never affects the running game. While paused the keydown handler swallows game keys and records them in `blockedKeys`; a code stays blocked until its `keyup` (or window `blur`), so a key held across resume does not move the piece. Space is `preventDefault`ed on keydown and keyup while paused so it never activates the focused menu button.
- **The page opens on a start screen, not a running game.** `showStartScreen()` sets `gameOver = true` (meaning "no game in progress") so `keydown` and `pauseGame()` ignore input; `current` is still `undefined` there, so nothing may call `draw()` before the first `init()`.
- **Records live in `localStorage` under `tetris-records`** as `{ top, bestCombo, maxLines }` (`top` sorted desc, max `MAX_RECORDS`). `endGame()` always updates `bestCombo`/`maxLines` and computes `pendingRank`; the top-5 entry is only inserted when the player submits the name form. Names are rendered with `textContent` — keep it that way. `combo` counts consecutive locks that clear lines and is updated in `clearLines()`, so it relies on `clearLines()` running on every lock.
- **Game over stops the loop in two places.** `endGame()` calls `cancelAnimationFrame(animId)`, which only covers a pending frame (key-triggered drops). When game over happens via gravity inside `loop()`, that frame is already running, so `loop()` checks `gameOver` after `draw()` and returns without scheduling the next frame. Keep both when touching loop or game-over handling.
- **Skins are a render-only layer.** `SKINS` maps a key (`retro`, `neon`, `pastel`, `pixel`) to `{ colors, drawBlock, grid? }`. The shared `drawBlock()` wraps the skin's function in `save()`/`restore()` so per-skin state (`shadowBlur`, `globalAlpha`, `lineWidth`) never leaks. Skin keys are duplicated as `<option value>` in `index.html` `#skin-select` and as `[data-skin="..."]` CSS rules (neon forces a black canvas background); keep them in sync. Skin (`tetris-skin`) is independent from the light/dark theme (`tetris-theme`); both persist in `localStorage`. `changeSkin()` redraws immediately because the loop is stopped while paused or after game over.

## Language

UI strings, README, and comments are in Spanish. Match that when adding user-facing text.
