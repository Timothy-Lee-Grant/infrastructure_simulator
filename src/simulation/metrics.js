import { S } from '../state/store.js';

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, idx))];
}

/** Recompute metrics over a 5-second sliding window and store into S.sim.metrics. */
export function computeMetrics() {
  const now = performance.now();
  const win = 5000;
  const cutoff = now - win;
  S.sim.recentCompletions = S.sim.recentCompletions.filter(c => c.t > cutoff);
  S.sim.recentErrors      = S.sim.recentErrors.filter(e => e.t > cutoff);

  const total      = S.sim.recentCompletions.length + S.sim.recentErrors.length;
  const rps        = total / (win / 1000);
  const throughput = S.sim.recentCompletions.length / (win / 1000);
  const errorRate  = total > 0 ? S.sim.recentErrors.length / total : 0;
  const lats       = S.sim.recentCompletions.map(c => c.latency).sort((a, b) => a - b);
  const p50 = percentile(lats, 50);
  const p95 = percentile(lats, 95);
  const p99 = percentile(lats, 99);

  S.sim.metrics = { rps, throughput, errorRate, p50, p95, p99, active: S.sim.pkts.length };
}

function metricColor(val, warnThresh, errThresh) {
  return val > errThresh ? 'red' : val > warnThresh ? 'amber' : 'green';
}

/** Write the latest S.sim.metrics into the metrics bar DOM elements. */
export function renderMetricsPanel() {
  const m = S.sim.metrics;
  const set = (id, val, cls) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = val;
    el.className = 'm-val' + (cls ? ' ' + cls : '');
  };
  set('m-tput',   m.rps < 0.1 ? '—' : m.throughput.toFixed(1), m.throughput < 1 && m.rps > 0 ? 'amber' : 'green');
  set('m-err',    m.rps < 0.1 ? '—' : (m.errorRate * 100).toFixed(1) + '%', metricColor(m.errorRate, 0.01, 0.05));
  set('m-p50',    m.p50 ? m.p50.toFixed(0) + 'ms' : '—', metricColor(m.p50, 50, 200));
  set('m-p95',    m.p95 ? m.p95.toFixed(0) + 'ms' : '—', metricColor(m.p95, 100, 500));
  set('m-p99',    m.p99 ? m.p99.toFixed(0) + 'ms' : '—', metricColor(m.p99, 200, 1000));
  set('m-flight', m.active || 0, '');
}
