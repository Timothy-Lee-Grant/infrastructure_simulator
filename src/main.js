/**
 * main.js — application entry point.
 *
 * Responsibilities:
 *   1. Import and initialise all modules
 *   2. Expose functions needed by HTML onclick="" attributes on window
 *   3. Set up keyboard shortcuts
 *   4. Bootstrap the initial level or restore from storage
 */

import { S } from './state/store.js';
import { saveToStorage, loadFromStorage } from './state/serializer.js';
import { undo, redo, updateUndoRedoBtns } from './state/history.js';
import { render } from './ui/views.js';
import { buildPalette } from './components/palette.js';
import { updateCamera, fitToScreen } from './components/canvas/camera.js';
import { onCompDown, onCompClick, onConnClick, deleteComp, deleteSelectedConn, placeComp, initDragListeners } from './components/canvas/interaction.js';
import { onCfgChange } from './components/inspector.js';
import { toggleSim, stopSim } from './simulation/engine.js';
import { setMode, clearAll, loadLevel, initCameraControls } from './ui/header.js';
import { renderLevelHUD } from './ui/level-hud.js';
import { dismissWin } from './levels/goals.js';
import { hint } from './ui/notifications.js';
import { startMetricsLoop } from './ui/metrics-panel.js';

// ── 1. Expose functions for HTML onclick="" handlers ──────
// These must be on window because inline handlers can't access ES module scope.
Object.assign(window, {
  setMode,
  toggleSim,
  undo,
  redo,
  fitToScreen,
  clearAll,
  loadLevel,
  dismissWin,
  deleteComp,
  deleteSelectedConn,
  onCfgChange,
});

// ── 2. Wire interaction forward-references ────────────────
// renderer.js dispatches through window._ so it doesn't need to import
// interaction.js (which would create a cycle through views.js → renderer.js).
window._onCompDown  = onCompDown;
window._onCompClick = onCompClick;
window._onConnClick = onConnClick;
window._isPanning   = false;
// serializer.js calls this when a config change needs saving
window._saveToStorage = saveToStorage;

// ── 3. Initialise DOM-dependent subsystems ────────────────
buildPalette();
initDragListeners();   // SVG mousemove/mouseup/click for drag
initCameraControls();  // wheel zoom, middle-click pan
updateCamera();
updateUndoRedoBtns();
startMetricsLoop();

// ── 4. Keyboard shortcuts ─────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
  const k = e.key.toLowerCase();
  if (k === 's') setMode('select');
  if (k === 'c') setMode('connect');
  if (k === 'd') setMode('delete');
  if (k === 'b') setMode('break');
  if (k === ' ') { e.preventDefault(); toggleSim(); }
  if (k === 'escape') { S.connFrom = null; S.selId = null; S.selConnId = null; setMode('select'); render(); }
  if ((k === 'delete' || k === 'backspace') && S.mode === 'select') {
    if (S.selId)     deleteComp(S.selId);
    if (S.selConnId) deleteSelectedConn();
  }
  if (e.ctrlKey || e.metaKey) {
    if (k === 'z') { e.preventDefault(); undo(); }
    if (k === 'y') { e.preventDefault(); redo(); }
  }
  if (k === 'f') fitToScreen();
});

window.addEventListener('resize', () => render());

// ── 5. Bootstrap ──────────────────────────────────────────
const restored = loadFromStorage();
if (restored) {
  updateCamera();
  renderLevelHUD();
  render();
  hint('Session restored. Press Space to simulate.');
} else {
  loadLevel(1);
  hint('👋 Drag components from the left panel. Alt+drag or middle-click to pan. Scroll to zoom.');
}
