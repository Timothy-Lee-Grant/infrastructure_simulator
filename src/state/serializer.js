import { S } from './store.js';

const STORAGE_KEY = 'infra-sim-v2';
const STORAGE_VERSION = '0.2';

let saveTimer = null;
let toastTimer = null;

export function saveToStorage() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        version: STORAGE_VERSION,
        currentLevel: S.currentLevel,
        comps: S.comps,
        conns: S.conns,
        camera: S.camera,
      }));
      flashSaveToast();
    } catch (_) {}
  }, 800);
}

/**
 * Restores state from localStorage.
 * Callers are responsible for calling updateCamera(), renderLevelHUD(), render() after.
 */
export function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (data.version !== STORAGE_VERSION) return false;
    S.currentLevel = data.currentLevel || 1;
    S.comps = data.comps || {};
    S.conns = Array.isArray(data.conns) ? data.conns : [];
    S.camera = data.camera || { x: 0, y: 0, scale: 1 };
    const sel = document.getElementById('level-sel');
    if (sel) sel.value = S.currentLevel;
    return true;
  } catch (_) {
    return false;
  }
}

function flashSaveToast() {
  const t = document.getElementById('save-toast');
  if (!t) return;
  t.style.opacity = 1;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.style.opacity = 0; }, 1200);
}
