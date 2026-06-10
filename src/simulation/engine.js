import { S } from '../state/store.js';
import { TYPES } from '../components/types.js';
import { applyMode } from '../ui/mode.js';
import { render } from '../ui/views.js';
import { hint } from '../ui/notifications.js';
import { spawnPkt, spawnResponsePkt, getConn } from './packets.js';
import { packetTypeColor, connPath, bezier, getPacketSpeed } from '../components/canvas/camera.js';
import { recordArrival, recordCompletion, updateQueueHealth, showLatencyFlash } from './behaviors.js';
import { el } from '../utils/svg.js';

const SPAWN_INTERVAL = 200; // ms
let spawnTimer = null;

export function toggleSim() {
  S.sim.on ? stopSim() : startSim();
}

export function startSim() {
  const sources = Object.values(S.comps).filter(c => TYPES[c.type].isSource);
  if (!sources.length) { hint('⚠️ Place a Client first!'); return; }
  if (!S.conns.length) { hint('⚠️ Connect components first!'); return; }

  S.sim.on = true;
  S.sim.pkts = [];
  S.sim.recentCompletions = [];
  S.sim.recentErrors      = [];

  document.getElementById('btn-sim').innerHTML = '⏹ Stop <span class="kbd">Space</span>';
  document.getElementById('btn-sim').classList.add('active');
  document.getElementById('metrics-bar').classList.add('visible');

  // Reset per-component tracking
  for (const comp of Object.values(S.comps)) {
    comp.arrivalTimes = []; comp.currentRPS = 0; comp._bucket = 0; comp.rrIdx = 0;
    comp.queueDepth = 0;
    if (comp.healthState !== 'failed') comp.healthState = 'healthy';
  }

  applyMode('select'); // switch to select without calling stopSim (engine doesn't import header)
  render();
  spawnCycle();
  animLoop();
}

export function stopSim() {
  S.sim.on = false;
  S.sim.pkts = [];
  clearTimeout(spawnTimer);
  if (S.sim.raf) cancelAnimationFrame(S.sim.raf);

  document.getElementById('layer-pkts').innerHTML = '';
  document.getElementById('btn-sim').innerHTML = '▶ Simulate <span class="kbd">Space</span>';
  document.getElementById('btn-sim').classList.remove('active');
  document.getElementById('metrics-bar').classList.remove('visible');

  for (const comp of Object.values(S.comps)) {
    if (comp.healthState !== 'failed') comp.healthState = 'healthy';
    comp.currentRPS = 0;
    comp.queueDepth = 0;
  }
  render();
}

// ── Packet spawning ───────────────────────────────────────

function spawnCycle() {
  if (!S.sim.on) return;
  const sources = Object.values(S.comps).filter(c => TYPES[c.type].isSource && c.healthState !== 'failed');
  for (const src of sources) {
    const rps = src.config?.rps ?? 5;
    src._bucket = (src._bucket || 0) + rps * (SPAWN_INTERVAL / 1000);
    const n = Math.floor(src._bucket); src._bucket -= n;
    const outs = S.conns.filter(c => c.from === src.id && c.valid !== false);
    if (!outs.length) continue;
    const rwRatio = src.config?.readWriteRatio ?? 0.8;
    for (let i = 0; i < n; i++) {
      const conn  = outs[src.rrIdx % outs.length]; src.rrIdx++;
      const pType = Math.random() < rwRatio ? 'read' : 'write';
      spawnPkt(conn.id, packetTypeColor(pType), null, 0, pType, []);
    }
  }
  spawnTimer = setTimeout(spawnCycle, SPAWN_INTERVAL);
}

// ── Animation loop ────────────────────────────────────────

function animLoop() {
  if (!S.sim.on) return;

  const pktsLayer = document.getElementById('layer-pkts');
  pktsLayer.innerHTML = '';
  const dead = [], newPkts = [];

  for (let i = 0; i < S.sim.pkts.length; i++) {
    const pkt = S.sim.pkts[i];

    // ── Response packet (traveling backward) ─────────────
    if (pkt.isResponse) {
      pkt.t -= pkt.speed;
      if (pkt.t <= 0) {
        pkt.pathIdx++;
        if (pkt.pathIdx >= pkt.returnPath.length) {
          // Reached the source — show latency flash
          dead.push(i);
          const conn = getConn(pkt.returnPath[pkt.returnPath.length - 1]);
          const src  = conn ? S.comps[conn.from] : null;
          if (src && TYPES[src.type].isSource) {
            showLatencyFlash(src, pkt.accLatency);
          }
          continue;
        }
        pkt.connId = pkt.returnPath[pkt.pathIdx];
        pkt.t = 1.0;
      }
      const conn = getConn(pkt.connId); if (!conn) { dead.push(i); continue; }
      const p    = connPath(conn);      if (!p)    { dead.push(i); continue; }
      const pos  = bezier(pkt.t, p);
      // Hollow ring to distinguish response from forward packet
      pktsLayer.appendChild(el('circle', { cx: pos.x, cy: pos.y, r: 7,   fill: pkt.color, opacity: 0.07 }));
      pktsLayer.appendChild(el('circle', { cx: pos.x, cy: pos.y, r: 3.5, fill: 'none', stroke: pkt.color, 'stroke-width': 1.5, opacity: 0.7 }));
      pktsLayer.appendChild(el('circle', { cx: pos.x, cy: pos.y, r: 1.5, fill: pkt.color, opacity: 0.9 }));
      continue;
    }

    // ── Forward packet ────────────────────────────────────
    pkt.t += pkt.speed;

    if (pkt.t >= 1) {
      dead.push(i);
      const conn = getConn(pkt.connId); if (!conn) continue;
      if (conn.valid === false) continue;
      const dest = S.comps[conn.to];   if (!dest) continue;
      const dt   = TYPES[dest.type];
      const newLat  = pkt.accLatency + (dt.baseLatencyMs || 0);
      const fullPath = [...pkt.path, pkt.connId];

      recordArrival(dest);

      // Failed → error
      if (dest.healthState === 'failed') {
        S.sim.recentErrors.push({ t: performance.now() });
        continue;
      }

      // Overloaded → probabilistic drop
      if (dest.healthState === 'overloaded') {
        const maxRPS = dest.config?.maxRPS ?? dt.defaultMaxRPS ?? 99999;
        if (maxRPS < 100000) {
          const dropRate = Math.min(0.9, Math.max(0, (dest.currentRPS - maxRPS) / Math.max(1, dest.currentRPS)));
          if (Math.random() < dropRate) {
            S.sim.recentErrors.push({ t: performance.now() });
            continue;
          }
        }
      }

      // Reached a SINK → success
      if (dt.isSink) { recordCompletion(pkt, fullPath, newLat); continue; }

      const outs = S.conns.filter(c => c.from === dest.id && c.valid !== false);
      if (!outs.length) continue;

      // ── Per-type routing behaviors ────────────────────
      if (dt.id === 'load_balancer') {
        const next = outs[dest.rrIdx % outs.length]; dest.rrIdx++;
        newPkts.push({ connId: next.id, color: pkt.color, accLatency: newLat, packetType: pkt.packetType, path: fullPath });

      } else if (dt.id === 'cache') {
        if (pkt.packetType === 'write') {
          // Writes bypass cache — go straight to DB
          for (const c of outs)
            newPkts.push({ connId: c.id, color: pkt.color, accLatency: newLat, packetType: 'write', path: fullPath });
        } else {
          const hr = dest.config?.hitRate ?? 0.8;
          if (Math.random() < hr) {
            recordCompletion(pkt, fullPath, newLat); // cache hit
          } else {
            // Cache miss → forward read to DB
            for (const c of outs)
              newPkts.push({ connId: c.id, color: '#f0883e', accLatency: newLat, packetType: 'read', path: fullPath });
          }
        }

      } else if (dt.id === 'cdn') {
        const hr = dest.config?.hitRate ?? 0.85;
        if (Math.random() < hr) {
          recordCompletion(pkt, fullPath, newLat);
        } else {
          for (const c of outs)
            newPkts.push({ connId: c.id, color: pkt.color, accLatency: newLat, packetType: pkt.packetType, path: fullPath });
        }

      } else if (dt.id === 'message_queue') {
        const maxDepth = dest.config?.maxDepth ?? 10000;
        dest.queueDepth = (dest.queueDepth || 0) + 1;
        updateQueueHealth(dest);
        if (dest.queueDepth > maxDepth) {
          dest.queueDepth--;
          S.sim.recentErrors.push({ t: performance.now() });
          updateQueueHealth(dest);
          continue;
        }
        const delay      = dest.config?.deliveryDelayMs ?? 800;
        const savedPath  = [...fullPath];
        const savedColor = pkt.color;
        const savedType  = pkt.packetType;
        setTimeout(() => {
          if (!S.sim.on) return;
          dest.queueDepth = Math.max(0, (dest.queueDepth || 0) - 1);
          updateQueueHealth(dest);
          for (const c of outs) spawnPkt(c.id, savedColor, null, newLat, savedType, savedPath);
        }, delay + Math.random() * 400);

      } else {
        for (const c of outs)
          newPkts.push({ connId: c.id, color: pkt.color, accLatency: newLat, packetType: pkt.packetType, path: fullPath });
      }
      continue;
    }

    // ── Draw forward packet in flight ─────────────────────
    const conn = getConn(pkt.connId); if (!conn) { dead.push(i); continue; }
    const p    = connPath(conn);      if (!p)    { dead.push(i); continue; }
    const pos  = bezier(pkt.t, p);

    pktsLayer.appendChild(el('circle', { cx: pos.x, cy: pos.y, r: 8, fill: pkt.color, opacity: 0.12 }));
    pktsLayer.appendChild(el('circle', { cx: pos.x, cy: pos.y, r: 4, fill: pkt.color, filter: 'url(#glow-sm)' }));
    pktsLayer.appendChild(el('circle', { cx: pos.x, cy: pos.y, r: 2, fill: '#fff', opacity: 0.8 }));
    // Write packets get a rotated-square diamond marker
    if (pkt.packetType === 'write') {
      pktsLayer.appendChild(el('rect', {
        x: pos.x - 2.5, y: pos.y - 2.5, width: 5, height: 5,
        fill: pkt.color, opacity: 0.9,
        transform: `rotate(45,${pos.x},${pos.y})`,
      }));
    }
  }

  // Prune dead packets (reverse to preserve indices)
  for (let i = dead.length - 1; i >= 0; i--) S.sim.pkts.splice(dead[i], 1);
  // Append propagated forward packets
  for (const p of newPkts) spawnPkt(p.connId, p.color, null, p.accLatency, p.packetType, p.path);

  S.sim.raf = requestAnimationFrame(animLoop);
}
