import { S } from '../state/store.js';

/**
 * Low-level mode applier — updates DOM and state without side effects.
 * Does NOT call stopSim(). Used by engine.js to switch to 'select'
 * without creating a circular import (engine ← header ← engine).
 */
export function applyMode(m) {
  S.mode = m;
  S.connFrom = null;
  document.body.className = `mode-${m}`;
  ['select', 'connect', 'delete', 'break'].forEach(n =>
    document.getElementById('btn-' + n)?.classList.toggle('active', n === m));
}
