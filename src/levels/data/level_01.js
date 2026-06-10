// ── Level 1 helper functions ──────────────────────────────

function hasType(s, type) {
  return Object.values(s.comps).some(c => c.type === type);
}

function level1PathOk(s) {
  const comps = Object.values(s.comps);
  const dbTypes     = new Set(['sql_db', 'nosql_db']);
  const serverTypes = new Set(['web_server', 'app_server']);
  const lbTypes     = new Set(['load_balancer']);
  const reach = (startId, targetSet) => {
    const vis = new Set(), q = [startId];
    while (q.length) {
      const cur = q.shift();
      if (vis.has(cur)) continue; vis.add(cur);
      const c = s.comps[cur]; if (!c) continue;
      if (targetSet.has(c.type)) return true;
      s.conns.filter(k => k.from === cur).forEach(k => q.push(k.to));
    }
    return false;
  };
  for (const cl of comps.filter(c => c.type === 'client'))
    if (reach(cl.id, lbTypes))
      for (const lb of comps.filter(c => c.type === 'load_balancer'))
        if (reach(lb.id, serverTypes))
          for (const sv of comps.filter(c => serverTypes.has(c.type)))
            if (reach(sv.id, dbTypes)) return true;
  return false;
}

// ── Level 1 definition ────────────────────────────────────

export const level1 = {
  id: 1,
  name: 'Hello, Infrastructure!',
  badge: 'Level 1 · Foundations',
  desc: 'Connect a Client → Load Balancer → Web Server → Database, then run the simulation.',
  locked: [],
  lockedConns: [],
  winTitle: 'System Online!',
  winSub: 'Your infrastructure is handling requests end-to-end. Level complete!',
  goals: [
    { id: 'g-client', label: 'Place a Client',        check: s => hasType(s, 'client') },
    { id: 'g-lb',     label: 'Place a Load Balancer', check: s => hasType(s, 'load_balancer') },
    { id: 'g-server', label: 'Place a Web Server',    check: s => hasType(s, 'web_server') || hasType(s, 'app_server') },
    { id: 'g-db',     label: 'Place a Database',      check: s => hasType(s, 'sql_db') || hasType(s, 'nosql_db') },
    { id: 'g-path',   label: 'Connect them in order', check: s => level1PathOk(s) },
    { id: 'g-sim',    label: 'Run the simulation',    check: s => s.sim.successCount >= 3 },
  ],
};
