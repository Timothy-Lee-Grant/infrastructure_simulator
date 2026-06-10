/**
 * Central mutable state object — single source of truth.
 * All modules import and mutate this object in-place.
 */
export const S = {
  comps: {},       // { [id]: Component }
  conns: [],       // Connection[]
  mode: 'select',  // 'select' | 'connect' | 'delete' | 'break'
  selId: null,     // selected component id
  selConnId: null, // selected connection id
  connFrom: null,  // connect-mode: source component id
  uid: 1,          // auto-increment for generated IDs
  camera: { x: 0, y: 0, scale: 1 },
  history: [],     // undo stack
  future: [],      // redo stack
  currentLevel: 1,
  sim: {
    on: false,
    pkts: [],        // active packets
    raf: null,       // requestAnimationFrame handle
    successCount: 0,
    winShown: false,
    recentCompletions: [], // [{ t: DOMHighResTimeStamp, latency: number }]
    recentErrors: [],      // [{ t: DOMHighResTimeStamp }]
    metrics: { rps: 0, throughput: 0, errorRate: 0, p50: 0, p95: 0, p99: 0, active: 0 },
  },
};
