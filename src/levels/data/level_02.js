export const level2 = {
  id: 2,
  name: 'The Bottleneck',
  badge: 'Level 2 · Horizontal Scaling',
  desc: 'The web server is overwhelmed at 15 RPS but can only handle 10 RPS. Add a Load Balancer and a second Web Server to distribute the load. Watch the error rate fall.',
  locked: [
    { id: 'lc1', type: 'client',     x: 75,  y: 240, config: { rps: 15, trafficPattern: 'steady' } },
    { id: 'lc2', type: 'web_server', x: 300, y: 240, config: { maxRPS: 10 } },
    { id: 'lc3', type: 'sql_db',     x: 515, y: 240, config: { maxRPS: 50 } },
  ],
  lockedConns: [
    { id: 'lk1', from: 'lc1', to: 'lc2' },
    { id: 'lk2', from: 'lc2', to: 'lc3' },
  ],
  winTitle: 'Bottleneck Solved!',
  winSub: 'Load is distributed. Error rate under 1%. You just learned horizontal scaling.',
  goals: [
    { id: 'g-lb2',   label: 'Add a Load Balancer',  check: s => Object.values(s.comps).some(c => c.type === 'load_balancer') },
    { id: 'g-srv2',  label: 'Add a 2nd Web Server', check: s => Object.values(s.comps).filter(c => c.type === 'web_server' || c.type === 'app_server').length >= 2 },
    { id: 'g-wire2', label: 'Wire it up & simulate', check: s => s.sim.on },
    { id: 'g-err2',  label: 'Error rate < 1%',       check: s => s.sim.on && s.sim.metrics.rps > 5 && s.sim.metrics.errorRate < 0.01 },
    { id: 'g-tput2', label: 'Throughput ≥ 14 req/s', check: s => s.sim.on && s.sim.metrics.throughput >= 14 },
  ],
};
