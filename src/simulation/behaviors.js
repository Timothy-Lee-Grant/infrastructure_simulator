/**
 * Per-arrival bookkeeping: RPS tracking, health state, queue depth,
 * completion recording, and latency flash visuals.
 */
import { S } from '../state/store.js';
import { TYPES } from '../components/types.js';
import { el } from '../utils/svg.js';
import { spawnResponsePkt } from './packets.js';

/** Record a packet arrival at a component — updates currentRPS and healthState. */
export function recordArrival(comp) {
  const now = performance.now();
  if (!comp.arrivalTimes) comp.arrivalTimes = [];
  comp.arrivalTimes.push(now);
  // Prune entries older than 3 s
  const cutoff = now - 3000;
  let i = 0;
  while (i < comp.arrivalTimes.length && comp.arrivalTimes[i] < cutoff) i++;
  if (i > 0) comp.arrivalTimes = comp.arrivalTimes.slice(i);
  // RPS = arrivals within the last 1 s
  comp.currentRPS = comp.arrivalTimes.filter(t => t >= now - 1000).length;

  // Queue health is driven by depth, not RPS
  if (TYPES[comp.type].id === 'message_queue') return;
  if (comp.healthState === 'failed') return;

  const t = TYPES[comp.type];
  const maxRPS = comp.config?.maxRPS ?? t.defaultMaxRPS ?? 99999;
  if (maxRPS >= 100000) { comp.healthState = 'healthy'; return; }
  const ratio = comp.currentRPS / maxRPS;
  comp.healthState = ratio > 1.0 ? 'overloaded' : ratio > 0.7 ? 'stressed' : 'healthy';
}

/** Update a message_queue's healthState based on queueDepth vs maxDepth. */
export function updateQueueHealth(comp) {
  if (comp.healthState === 'failed') return;
  const maxDepth = comp.config?.maxDepth ?? 10000;
  const ratio = (comp.queueDepth || 0) / maxDepth;
  comp.healthState = ratio >= 1.0 ? 'overloaded' : ratio >= 0.8 ? 'stressed' : 'healthy';
}

/**
 * Record a successful round-trip and spawn the corresponding response packet.
 * fullPath is the array of connIds the forward packet traversed.
 */
export function recordCompletion(pkt, fullPath, finalLatency) {
  S.sim.successCount++;
  S.sim.recentCompletions.push({ t: performance.now(), latency: finalLatency });
  if (fullPath.length > 0) {
    const returnPath = [...fullPath].reverse();
    spawnResponsePkt(returnPath, pkt.color, finalLatency);
  }
}

// Debounce map so we don't flood the canvas with overlapping flash labels
const _flashTimers = {};

/**
 * Render a floating "+Xms" label near a component that fades upward.
 * Color encodes whether latency is good, warning, or bad.
 */
export function showLatencyFlash(comp, latencyMs) {
  const key = comp.id;
  if (_flashTimers[key]) return; // debounce
  _flashTimers[key] = setTimeout(() => { delete _flashTimers[key]; }, 600);

  const t = TYPES[comp.type];
  const cx = comp.x + t.w / 2;
  let cy = comp.y - 14;
  const layer = document.getElementById('layer-pkts');
  const lbl = el('text', {
    x: cx, y: cy,
    'text-anchor': 'middle', 'dominant-baseline': 'middle',
    'font-size': 9, 'font-weight': '700',
    fill: latencyMs < 50 ? '#3fb950' : latencyMs < 200 ? '#f0883e' : '#f85149',
    opacity: 1,
    'font-family': "'Segoe UI',system-ui,sans-serif",
    style: 'user-select:none; pointer-events:none',
  });
  lbl.textContent = `+${Math.round(latencyMs)}ms`;
  layer.appendChild(lbl);

  let op = 1;
  const fade = setInterval(() => {
    op -= 0.07; cy -= 0.6;
    if (op <= 0) { clearInterval(fade); lbl.remove(); return; }
    lbl.setAttribute('opacity', op.toFixed(2));
    lbl.setAttribute('y', cy.toFixed(1));
  }, 30);
}
