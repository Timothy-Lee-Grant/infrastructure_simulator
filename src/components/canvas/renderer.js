import { S } from '../../state/store.js';
import { TYPES } from '../types.js';
import { el } from '../../utils/svg.js';
import { connPath, bezier } from './camera.js';
import { hint } from '../../ui/notifications.js';

/** Re-draw all connections in #layer-conns. */
export function renderConns() {
  const layer = document.getElementById('layer-conns');
  layer.innerHTML = '';
  for (const conn of S.conns) {
    const p = connPath(conn);
    if (!p) continue;
    const d = `M${p.x1},${p.y1} C${p.c1x},${p.c1y} ${p.c2x},${p.c2y} ${p.x2},${p.y2}`;
    const isSel     = conn.id === S.selConnId;
    const isLive    = S.sim.on;
    const isInvalid = conn.valid === false;

    const stroke = isInvalid ? '#f85149' :
                   isSel     ? '#58a6ff' :
                   isLive    ? '#58a6ff' : '#30363d';

    // Visible path
    const vp = el('path', {
      d, fill: 'none',
      stroke,
      'stroke-width': isSel ? 2.5 : 1.5,
      'stroke-dasharray': isInvalid ? '6,4' : 'none',
      'marker-end': isSel ? 'url(#arr-sel)' : isInvalid ? 'url(#arr-invalid)' : isLive ? 'url(#arr-live)' : 'url(#arr)',
      opacity: isInvalid ? 0.7 : isSel ? 1 : isLive ? 0.5 : 0.7,
      'pointer-events': 'none',
    });
    layer.appendChild(vp);

    // Warning icon at midpoint for invalid connections
    if (isInvalid) {
      const mid = bezier(0.5, p);
      const warn = el('text', {
        x: mid.x, y: mid.y - 10,
        'text-anchor': 'middle', 'dominant-baseline': 'middle',
        'font-size': 11, style: 'user-select:none; pointer-events:none',
      });
      warn.textContent = '⚠️';
      layer.appendChild(warn);
    }

    // Wide invisible hit area for click/hover detection
    const hp = el('path', {
      d, fill: 'none', stroke: 'transparent', 'stroke-width': 16, cursor: 'pointer',
    });
    hp.addEventListener('mouseenter', () => {
      vp.setAttribute('stroke', isInvalid ? '#ff7b72' : '#8b949e');
      if (isInvalid && conn.reason) hint(`⚠️ Invalid connection: ${conn.reason}`);
    });
    hp.addEventListener('mouseleave', () => { vp.setAttribute('stroke', stroke); });
    hp.addEventListener('click', ev => { ev.stopPropagation(); onConnClick(conn.id); });
    layer.appendChild(hp);
  }
}

/** Re-draw all components in #layer-comps. */
export function renderComps() {
  const layer = document.getElementById('layer-comps');
  layer.innerHTML = '';
  for (const comp of Object.values(S.comps)) {
    const t      = TYPES[comp.type];
    const isSel  = comp.id === S.selId;
    const isFrom = comp.id === S.connFrom;
    const hs     = comp.healthState || 'healthy';
    const maxRPS = comp.config?.maxRPS ?? t.defaultMaxRPS ?? 9999;
    const ratio  = t.isSource ? 0 : Math.min(1.5, (comp.currentRPS || 0) / maxRPS);

    const g = el('g', { transform: `translate(${comp.x},${comp.y})`, style: 'cursor:pointer' });

    // Selection / connect-from ring
    if (isSel || isFrom) {
      g.appendChild(el('rect', {
        x: -5, y: -5, width: t.w + 10, height: t.h + 10, rx: 13,
        fill: 'none',
        stroke: isFrom ? '#ffa657' : '#58a6ff',
        'stroke-width': 2, opacity: 0.6, filter: 'url(#glow)',
      }));
    }

    // Card border color based on health
    const cardStroke =
      hs === 'failed'     ? '#f85149' :
      hs === 'overloaded' ? '#f85149' :
      hs === 'stressed'   ? '#f0883e' :
      isSel   ? '#58a6ff' :
      isFrom  ? '#ffa657' : t.color + '55';

    // Card body
    g.appendChild(el('rect', {
      x: 0, y: 0, width: t.w, height: t.h, rx: 9,
      fill: t.bg, stroke: cardStroke,
      'stroke-width': hs === 'healthy' && !isSel && !isFrom ? 1 : 2,
    }));

    // Top accent strip
    g.appendChild(el('rect', { x: 0, y: 0, width: t.w, height: 3, rx: 9, fill: t.color, opacity: 0.7 }));
    g.appendChild(el('rect', { x: 0, y: 1.5, width: t.w, height: 1.5, fill: t.color, opacity: 0.7 }));

    // Icon
    const icon = el('text', {
      x: t.w / 2, y: t.isSource || t.isSink ? 28 : 30,
      'text-anchor': 'middle', 'dominant-baseline': 'middle', 'font-size': 17, style: 'user-select:none',
    });
    icon.textContent = t.icon;
    g.appendChild(icon);

    // Name label
    const name = el('text', {
      x: t.w / 2, y: 49,
      'text-anchor': 'middle', 'dominant-baseline': 'middle',
      'font-size': 10, 'font-weight': '700', fill: t.color,
      'font-family': "'Segoe UI',system-ui,sans-serif", style: 'user-select:none',
    });
    name.textContent = t.name;
    g.appendChild(name);

    // SOURCE / SINK / LOCKED sublabel
    const sublabel = t.isSource ? 'SOURCE' : t.isSink ? 'SINK' : comp.locked ? '🔒' : '';
    if (sublabel) {
      const lbl = el('text', {
        x: t.w / 2, y: 61, 'text-anchor': 'middle', 'dominant-baseline': 'middle',
        'font-size': 7, fill: t.color + '70',
        'font-family': "'Segoe UI',system-ui,sans-serif", style: 'user-select:none',
      });
      lbl.textContent = sublabel;
      g.appendChild(lbl);
    }

    // Queue depth gauge (message_queue only)
    if (t.id === 'message_queue') {
      const maxDepth   = comp.config?.maxDepth ?? 10000;
      const depth      = comp.queueDepth || 0;
      const depthRatio = Math.min(1, depth / maxDepth);
      const bx = 5, by = t.h - 10, bw = t.w - 10;
      const dlbl = el('text', {
        x: t.w / 2, y: by - 2,
        'text-anchor': 'middle', 'dominant-baseline': 'middle',
        'font-size': 7, fill: '#e3b34190',
        'font-family': "'Segoe UI',system-ui,sans-serif", style: 'user-select:none',
      });
      dlbl.textContent = depth >= 1000
        ? `${(depth / 1000).toFixed(1)}k/${(maxDepth / 1000).toFixed(0)}k`
        : `${depth}/${maxDepth}`;
      g.appendChild(dlbl);
      g.appendChild(el('rect', { x: bx, y: by, width: bw, height: 4, rx: 2, fill: '#0d1117' }));
      if (depthRatio > 0) {
        const bc = depthRatio >= 1 ? '#f85149' : depthRatio >= 0.8 ? '#f0883e' : '#e3b341';
        g.appendChild(el('rect', { x: bx, y: by, width: bw * depthRatio, height: 4, rx: 2, fill: bc }));
      }
    }
    // RPS load bar (non-source, non-queue, finite maxRPS)
    else if (!t.isSource && maxRPS < 100000) {
      const bx = 5, by = t.h - 7, bw = t.w - 10;
      g.appendChild(el('rect', { x: bx, y: by, width: bw, height: 4, rx: 2, fill: '#0d1117' }));
      const fw = bw * Math.min(1, ratio);
      if (fw > 0) {
        const bc = ratio > 1 ? '#f85149' : ratio > 0.7 ? '#f0883e' : '#3fb950';
        g.appendChild(el('rect', { x: bx, y: by, width: fw, height: 4, rx: 2, fill: bc }));
      }
    }

    // Input / output port dots
    if (t.maxIn  > 0) g.appendChild(el('circle', { cx: 0,    cy: t.h / 2, r: 5, fill: '#0d1117', stroke: t.color + '70', 'stroke-width': 1.5 }));
    if (t.maxOut > 0) g.appendChild(el('circle', { cx: t.w,  cy: t.h / 2, r: 5, fill: '#0d1117', stroke: t.color + '70', 'stroke-width': 1.5 }));

    // Failed X overlay
    if (hs === 'failed') {
      g.appendChild(el('rect', { x: 0, y: 0, width: t.w, height: t.h, rx: 9, fill: '#f8514920' }));
      g.appendChild(el('line', { x1: 12, y1: 12, x2: t.w - 12, y2: t.h - 12, stroke: '#f85149', 'stroke-width': 2.5, 'stroke-linecap': 'round' }));
      g.appendChild(el('line', { x1: t.w - 12, y1: 12, x2: 12, y2: t.h - 12, stroke: '#f85149', 'stroke-width': 2.5, 'stroke-linecap': 'round' }));
    }

    // Invisible hit rect (topmost, catches events)
    const hit = el('rect', { x: 0, y: 0, width: t.w, height: t.h, rx: 9, fill: 'transparent' });
    g.appendChild(hit);

    // Events are wired in interaction.js — use a data attribute for lookup
    g.dataset.compId = comp.id;
    g.addEventListener('mousedown', ev => window._onCompDown(ev, comp.id));
    g.addEventListener('click',     ev => window._onCompClick(ev, comp.id));
    layer.appendChild(g);
  }
}

// Forward reference — set by interaction.js at init time
function onConnClick(id) { window._onConnClick(id); }
