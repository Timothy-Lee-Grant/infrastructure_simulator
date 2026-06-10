import { S } from '../state/store.js';
import { TYPES, PALETTE_GROUPS } from './types.js';
import { worldPt } from './canvas/camera.js';
import { pushHistory } from '../state/history.js';
import { placeComp } from './canvas/interaction.js';

let palDragType = null;

export function buildPalette() {
  const pal = document.getElementById('palette');
  pal.innerHTML = '';
  for (const grp of PALETTE_GROUPS) {
    const sec = document.createElement('div');
    sec.className = 'pal-section';
    sec.innerHTML = `<div class="pal-section-label">${grp.label}</div>`;
    for (const tid of grp.types) {
      const t = TYPES[tid];
      const item = document.createElement('div');
      item.className = 'pal-item';
      item.dataset.type = tid;
      item.innerHTML = `
        <div class="pal-icon" style="background:${t.bg};border:1px solid ${t.color}30">${t.icon}</div>
        <div>
          <div class="pal-name" style="color:${t.color}">${t.name}</div>
          <div class="pal-hint">${t.desc.split('.')[0]}</div>
        </div>`;
      item.addEventListener('mousedown', ev => startPalDrag(ev, tid));
      sec.appendChild(item);
    }
    pal.appendChild(sec);
  }
}

const ghost = () => document.getElementById('drag-ghost');

function startPalDrag(e, tid) {
  e.preventDefault();
  palDragType = tid;
  const t = TYPES[tid];
  const g = ghost();
  g.innerHTML = `${t.icon} ${t.name}`;
  g.style.cssText += `;background:${t.bg};border-color:${t.color};color:${t.color};display:flex`;
  moveGhost(e);
  document.addEventListener('mousemove', moveGhost);
  document.addEventListener('mouseup', endPalDrag);
}

function moveGhost(e) {
  const g = ghost();
  g.style.left = (e.clientX + 12) + 'px';
  g.style.top  = (e.clientY - 14) + 'px';
}

function endPalDrag(e) {
  document.removeEventListener('mousemove', moveGhost);
  document.removeEventListener('mouseup', endPalDrag);
  ghost().style.display = 'none';
  if (!palDragType) return;
  const canvasWrap = document.getElementById('canvas-wrap');
  const r = canvasWrap.getBoundingClientRect();
  if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
    const pt = worldPt(e);
    const t  = TYPES[palDragType];
    pushHistory();
    placeComp(palDragType, pt.x - t.w / 2, pt.y - t.h / 2);
  }
  palDragType = null;
}
