import { S } from '../../state/store.js';
import { TYPES } from '../types.js';
import { pushHistory } from '../../state/history.js';
import { saveToStorage } from '../../state/serializer.js';
import { hint } from '../../ui/notifications.js';
import { render } from '../../ui/views.js';
import { renderInspector } from '../inspector.js';
import { validateConnection } from '../../simulation/packets.js';
import { worldPt } from './camera.js';

// ── Component drag ────────────────────────────────────────

let dragging = null, dox = 0, doy = 0, hasMoved = false;

export function onCompDown(e, id) {
  if (S.mode === 'connect' || S.mode === 'delete' || S.mode === 'break') return;
  if (S.sim.on) return;
  if (S.comps[id]?.locked) return;
  e.stopPropagation();
  hasMoved = false;
  S.selId = id; S.selConnId = null;
  dragging = id;
  const pt = worldPt(e);
  dox = pt.x - S.comps[id].x;
  doy = pt.y - S.comps[id].y;
  render();
}

export function initDragListeners() {
  const svg = document.getElementById('game-svg');
  svg.addEventListener('mousemove', e => {
    if (!dragging) return;
    if (!hasMoved) { hasMoved = true; pushHistory(); }
    const pt = worldPt(e);
    S.comps[dragging].x = pt.x - dox;
    S.comps[dragging].y = pt.y - doy;
    render();
  });
  svg.addEventListener('mouseup', () => {
    if (dragging && hasMoved) saveToStorage();
    dragging = null;
  });
  svg.addEventListener('click', e => {
    if (window._isPanning) return;
    const onGroup = e.target.closest('g[data-no-desel]');
    if (!onGroup) {
      if (S.mode === 'connect' && S.connFrom) { S.connFrom = null; render(); }
      S.selId = null; S.selConnId = null; render();
    }
  });
}

// ── Component click ───────────────────────────────────────

export function onCompClick(e, id) {
  e.stopPropagation();
  if (S.mode === 'delete') { deleteComp(id); return; }
  if (S.mode === 'break') {
    const comp = S.comps[id];
    if (!comp) return;
    comp.healthState = comp.healthState === 'failed' ? 'healthy' : 'failed';
    render(); renderInspector();
    hint(comp.healthState === 'failed'
      ? `☠️ ${TYPES[comp.type].name} is now FAILED — watch the error rate`
      : `✓ ${TYPES[comp.type].name} recovered`);
    return;
  }
  if (S.mode === 'connect') {
    if (!S.connFrom) {
      S.connFrom = id; render();
      hint('Click the destination component to create a connection →');
    } else if (S.connFrom === id) {
      S.connFrom = null; render();
    } else {
      const exists = S.conns.find(c => c.from === S.connFrom && c.to === id);
      if (!exists) {
        const v = validateConnection(S.connFrom, id);
        pushHistory();
        S.conns.push({ id: 'k' + S.uid++, from: S.connFrom, to: id, valid: v.valid, reason: v.reason });
        hint(v.valid
          ? 'Connection created!'
          : `⚠️ Invalid: ${v.reason} — connection shown in red and carries no traffic`);
        saveToStorage();
      } else {
        hint('Already connected.');
      }
      S.connFrom = null; render();
    }
    return;
  }
  S.selId = id; S.selConnId = null; render();
}

// ── Connection click ──────────────────────────────────────

export function onConnClick(id) {
  if (S.mode === 'delete') {
    pushHistory();
    S.conns = S.conns.filter(c => c.id !== id);
    render(); saveToStorage();
    return;
  }
  S.selConnId = S.selConnId === id ? null : id;
  S.selId = null;
  render();
}

export function deleteSelectedConn() {
  if (!S.selConnId) return;
  pushHistory();
  S.conns = S.conns.filter(c => c.id !== S.selConnId);
  S.selConnId = null;
  render(); saveToStorage();
}

// ── Delete component ──────────────────────────────────────

export function deleteComp(id) {
  if (S.comps[id]?.locked) { hint('Locked components cannot be deleted in this level.'); return; }
  pushHistory();
  delete S.comps[id];
  S.conns = S.conns.filter(c => c.from !== id && c.to !== id);
  if (S.selId === id) S.selId = null;
  render(); saveToStorage();
}

// ── Place component ───────────────────────────────────────

export function placeComp(type, x, y, overrideId, overrideConfig, locked) {
  const t  = TYPES[type];
  const id = overrideId || ('c' + S.uid++);
  S.comps[id] = {
    id, type, x, y, locked: !!locked,
    rrIdx: 0, healthState: 'healthy',
    currentRPS: 0, arrivalTimes: [], _bucket: 0,
    queueDepth: 0,
    config: { ...(t.defaultConfig || {}), ...(overrideConfig || {}) },
  };
  S.selId = id;
  render();
  if (!locked) {
    hint(`Placed ${t.name} — switch to Connect mode (C) to wire it up`);
    saveToStorage();
  }
  return id;
}
