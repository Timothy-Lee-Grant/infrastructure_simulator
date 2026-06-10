import { S } from '../state/store.js';
import { applyMode } from './mode.js';
import { stopSim } from '../simulation/engine.js';
import { render } from './views.js';
import { hint } from './notifications.js';
import { saveToStorage } from '../state/serializer.js';
import { updateUndoRedoBtns } from '../state/history.js';
import { placeComp } from '../components/canvas/interaction.js';
import { renderLevelHUD } from './level-hud.js';
import { LEVELS } from '../levels/registry.js';
import { updateCamera } from '../components/canvas/camera.js';

/**
 * High-level mode switcher — also calls stopSim() if simulation is active.
 * engine.js uses applyMode() directly to avoid circular imports.
 */
export function setMode(m) {
  if (S.sim.on && m !== 'select') stopSim();
  applyMode(m);
  if (m === 'connect') hint('Click a source, then click the destination to connect.');
  if (m === 'delete')  hint('Click any component or connection to delete it.');
  if (m === 'break')   hint('☠️ Click a component to force-fail or recover it. Watch what happens to the metrics.');
  render();
}

export function clearAll() {
  if (!confirm('Clear the canvas? This resets the level.')) return;
  stopSim();
  loadLevel(S.currentLevel);
}

export function loadLevel(id) {
  stopSim();
  S.currentLevel = id;
  const lvl = LEVELS[id];
  S.comps = {}; S.conns = [];
  S.selId = null; S.selConnId = null; S.connFrom = null;
  S.sim.successCount = 0; S.sim.winShown = false;
  S.sim.recentCompletions = []; S.sim.recentErrors = [];
  S.history = []; S.future = [];
  updateUndoRedoBtns();

  // Place locked (level-provided) components and connections
  for (const lc of (lvl.locked || []))    placeComp(lc.type, lc.x, lc.y, lc.id, lc.config, true);
  for (const lk of (lvl.lockedConns || [])) S.conns.push({ id: lk.id, from: lk.from, to: lk.to, locked: true });

  const sel = document.getElementById('level-sel');
  if (sel) sel.value = id;
  document.getElementById('win-overlay').style.display = 'none';
  renderLevelHUD();
  render();
  saveToStorage();
  hint(lvl.desc.split('.')[0] + '.');
}

export function initCameraControls() {
  const canvasWrap = document.getElementById('canvas-wrap');
  let isPanning = false, panStartX = 0, panStartY = 0, camStartX = 0, camStartY = 0;

  canvasWrap.addEventListener('wheel', e => {
    e.preventDefault();
    const r      = canvasWrap.getBoundingClientRect();
    const mx     = e.clientX - r.left, my = e.clientY - r.top;
    const factor = e.deltaY > 0 ? 0.88 : 1.14;
    const ns     = Math.max(0.2, Math.min(5, S.camera.scale * factor));
    S.camera.x   = mx - (mx - S.camera.x) * (ns / S.camera.scale);
    S.camera.y   = my - (my - S.camera.y) * (ns / S.camera.scale);
    S.camera.scale = ns;
    updateCamera();
  }, { passive: false });

  document.getElementById('game-svg').addEventListener('mousedown', e => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      e.preventDefault();
      isPanning = true;
      panStartX = e.clientX; panStartY = e.clientY;
      camStartX = S.camera.x; camStartY = S.camera.y;
      document.body.classList.add('mode-panning');
      window._isPanning = false; // will be true once moved
    }
  });
  document.addEventListener('mousemove', e => {
    if (!isPanning) return;
    S.camera.x = camStartX + (e.clientX - panStartX);
    S.camera.y = camStartY + (e.clientY - panStartY);
    window._isPanning = true;
    updateCamera();
  });
  document.addEventListener('mouseup', e => {
    if (e.button === 1 || isPanning) {
      isPanning = false;
      document.body.classList.remove('mode-panning');
      setTimeout(() => { window._isPanning = false; }, 0);
    }
  });
}
