import { S } from '../state/store.js';
import { computeMetrics, renderMetricsPanel } from '../simulation/metrics.js';
import { checkGoals } from '../levels/goals.js';
import { renderInspector } from '../components/inspector.js';

/** Start the 500 ms polling loop for metrics, goals, and live inspector updates. */
export function startMetricsLoop() {
  setInterval(() => {
    if (!S.sim.on) return;
    computeMetrics();
    renderMetricsPanel();
    checkGoals();
    // Refresh inspector live stats without a full canvas re-render
    if (S.selId && S.comps[S.selId]) renderInspector();
  }, 500);
}
