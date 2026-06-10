import { S } from './store.js';
import { render } from '../ui/views.js';
import { saveToStorage } from './serializer.js';

export function cloneForHistory() {
  return JSON.parse(JSON.stringify({ comps: S.comps, conns: S.conns }));
}

export function pushHistory() {
  S.history.push(cloneForHistory());
  if (S.history.length > 50) S.history.shift();
  S.future = [];
  updateUndoRedoBtns();
}

export function undo() {
  if (!S.history.length) return;
  S.future.push(cloneForHistory());
  const prev = S.history.pop();
  S.comps = prev.comps; S.conns = prev.conns;
  S.selId = null; S.selConnId = null;
  updateUndoRedoBtns();
  render(); saveToStorage();
}

export function redo() {
  if (!S.future.length) return;
  S.history.push(cloneForHistory());
  const next = S.future.pop();
  S.comps = next.comps; S.conns = next.conns;
  S.selId = null; S.selConnId = null;
  updateUndoRedoBtns();
  render(); saveToStorage();
}

export function updateUndoRedoBtns() {
  document.getElementById('btn-undo').disabled = S.history.length === 0;
  document.getElementById('btn-redo').disabled = S.future.length === 0;
}
