import { S } from '../../state/store.js';
import { TYPES } from '../types.js';

/** Convert a mouse event to world-space coordinates (accounts for camera transform). */
export function worldPt(evt) {
  const wrap = document.getElementById('canvas-wrap');
  const r = wrap.getBoundingClientRect();
  const sx = evt.clientX - r.left;
  const sy = evt.clientY - r.top;
  return {
    x: (sx - S.camera.x) / S.camera.scale,
    y: (sy - S.camera.y) / S.camera.scale,
  };
}

/** Apply S.camera to the SVG camera group and update the zoom label. */
export function updateCamera() {
  const g = document.getElementById('camera');
  g.setAttribute('transform', `translate(${S.camera.x},${S.camera.y}) scale(${S.camera.scale})`);
  document.getElementById('zoom-pct').textContent = Math.round(S.camera.scale * 100) + '%';
}

/** Fit all placed components into the visible canvas. */
export function fitToScreen() {
  const comps = Object.values(S.comps);
  if (!comps.length) { S.camera = { x: 0, y: 0, scale: 1 }; updateCamera(); return; }
  const wrap = document.getElementById('canvas-wrap');
  const W = wrap.clientWidth, H = wrap.clientHeight;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const c of comps) {
    const t = TYPES[c.type];
    minX = Math.min(minX, c.x); minY = Math.min(minY, c.y);
    maxX = Math.max(maxX, c.x + t.w); maxY = Math.max(maxY, c.y + t.h);
  }
  const pad = 60, bw = maxX - minX + pad * 2, bh = maxY - minY + pad * 2;
  const sc = Math.max(0.2, Math.min(2, Math.min(W / bw, H / bh)));
  S.camera.scale = sc;
  S.camera.x = (W - bw * sc) / 2 + pad * sc - minX * sc;
  S.camera.y = (H - bh * sc) / 2 + pad * sc - minY * sc;
  updateCamera();
}

/** Compute the bezier control points for a connection. Returns null if endpoints missing. */
export function connPath(conn) {
  const a = S.comps[conn.from], b = S.comps[conn.to];
  if (!a || !b) return null;
  const ta = TYPES[a.type], tb = TYPES[b.type];
  const x1 = a.x + ta.w, y1 = a.y + ta.h / 2;
  const x2 = b.x,        y2 = b.y + tb.h / 2;
  const dx = Math.max(Math.abs(x2 - x1) * 0.45, 55);
  return { x1, y1, x2, y2, c1x: x1 + dx, c1y: y1, c2x: x2 - dx, c2y: y2 };
}

/** Evaluate a cubic bezier at parameter t (0–1). */
export function bezier(t, p) {
  const u = 1 - t;
  return {
    x: u*u*u*p.x1 + 3*u*u*t*p.c1x + 3*u*t*t*p.c2x + t*t*t*p.x2,
    y: u*u*u*p.y1 + 3*u*u*t*p.c1y + 3*u*t*t*p.c2y + t*t*t*p.y2,
  };
}

/**
 * Derive packet travel speed from destination component's base latency.
 * Higher latency → slower visual speed (more dramatic effect).
 */
export function getPacketSpeed(destTypeId) {
  const lat = TYPES[destTypeId]?.baseLatencyMs ?? 15;
  if (lat === 0) return 0.075;
  return Math.max(0.007, Math.min(0.075, 0.025 * (15 / lat)));
}

/** Map packet type to display color. */
export function packetTypeColor(type) {
  if (type === 'write')    return '#ffa657'; // orange
  if (type === 'error')    return '#f85149'; // red
  if (type === 'response') return '#79c0ff'; // hollow blue
  return '#58a6ff';                           // default blue (read)
}
