import { S } from '../state/store.js';
import { TYPES } from '../components/types.js';
import { getPacketSpeed, packetTypeColor } from '../components/canvas/camera.js';

let pktId = 0;

/** Get a connection by ID from S.conns. */
export function getConn(id) {
  return S.conns.find(c => c.id === id);
}

/**
 * Validate whether a directed connection from → to is architecturally legal.
 * Returns { valid, reason }.
 */
export function validateConnection(fromId, toId) {
  if (fromId === toId) return { valid: false, reason: 'Cannot connect to self' };
  const from = S.comps[fromId], to = S.comps[toId];
  if (!from || !to) return { valid: false, reason: 'Component not found' };
  const ft = TYPES[from.type], tt = TYPES[to.type];
  if (ft.isSink)    return { valid: false, reason: `${ft.name} is a sink — it has no outputs` };
  if (tt.isSource)  return { valid: false, reason: `${tt.name} is a source — it cannot receive connections` };
  if (ft.maxOut === 0) return { valid: false, reason: `${ft.name} has no outputs` };
  if (tt.maxIn  === 0) return { valid: false, reason: `${tt.name} has no inputs` };
  return { valid: true };
}

/**
 * Spawn a new forward packet on a connection.
 * path[] tracks connIds traversed so far (for response routing).
 */
export function spawnPkt(connId, color, speed, accLatency, packetType, path) {
  if (!connId) return;
  const conn = getConn(connId);
  if (!conn) return;
  if (conn.valid === false) return; // invalid connections carry no traffic
  const destType = S.comps[conn.to]?.type;
  const p = {
    id: pktId++,
    connId,
    t: 0,
    color: color ?? packetTypeColor(packetType || 'read'),
    speed: speed ?? getPacketSpeed(destType),
    accLatency: accLatency || 0,
    packetType: packetType || 'read',
    path: path ? [...path] : [],
    isResponse: false,
  };
  S.sim.pkts.push(p);
  return p.id;
}

/**
 * Spawn a hollow response packet that travels backwards along returnPath.
 * returnPath is an array of connIds in reverse order.
 */
export function spawnResponsePkt(returnPath, color, totalLatency) {
  if (!returnPath || !returnPath.length) return;
  const p = {
    id: pktId++,
    connId: returnPath[0],
    t: 1.0,           // starts at destination end, travels toward source
    color,
    speed: 0.04,       // fixed visual speed
    accLatency: totalLatency,
    packetType: 'response',
    isResponse: true,
    returnPath,
    pathIdx: 0,
  };
  S.sim.pkts.push(p);
}
