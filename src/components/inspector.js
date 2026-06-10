import { S } from '../state/store.js';
import { TYPES } from './types.js';

/** Rebuild the inspector panel for the currently selected component or connection. */
export function renderInspector() {
  const body = document.getElementById('insp-body');

  // ── Connection selected ───────────────────────────────────
  if (S.selConnId && !S.selId) {
    const conn = S.conns.find(c => c.id === S.selConnId);
    if (!conn) { body.innerHTML = '<div class="insp-empty">Select a component</div>'; return; }
    const fc = S.comps[conn.from], tc = S.comps[conn.to];
    const ft = TYPES[fc?.type], tt = TYPES[tc?.type];
    body.innerHTML = `
      <div class="insp-label" style="margin-bottom:10px">Connection</div>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;padding:10px;background:#0d1117;border-radius:8px">
        <span style="font-size:20px">${ft?.icon || '?'}</span>
        <div style="flex:1;min-width:0">
          <div style="font-size:11px;color:${ft?.color || '#ccc'};font-weight:700">${ft?.name || '?'}</div>
        </div>
        <span style="color:#58a6ff;font-size:14px">→</span>
        <div style="flex:1;min-width:0;text-align:right">
          <div style="font-size:11px;color:${tt?.color || '#ccc'};font-weight:700">${tt?.name || '?'}</div>
        </div>
        <span style="font-size:20px">${tt?.icon || '?'}</span>
      </div>
      ${conn.locked
        ? '<div class="insp-desc">This connection is part of the level setup and cannot be deleted.</div>'
        : `<button onclick="deleteSelectedConn()" style="
            width:100%;background:#21262d;border:1px solid #f8514930;border-radius:6px;
            color:#f85149;font-size:11px;font-weight:600;padding:7px;cursor:pointer">
            🗑️ Delete Connection
           </button>`}
    `;
    return;
  }

  // ── Nothing selected ─────────────────────────────────────
  if (!S.selId || !S.comps[S.selId]) {
    body.innerHTML = '<div class="insp-empty">Click a component<br>to inspect &amp; configure it</div>';
    return;
  }

  // ── Component selected ───────────────────────────────────
  const comp   = S.comps[S.selId];
  const t      = TYPES[comp.type];
  const hs     = comp.healthState || 'healthy';
  const maxRPS = comp.config?.maxRPS ?? t.defaultMaxRPS ?? 9999;
  const inC    = S.conns.filter(c => c.to   === comp.id).length;
  const outC   = S.conns.filter(c => c.from === comp.id).length;

  const healthHTML = `
    <div class="health-badge health-${hs}">
      ${hs === 'failed' ? '☠️ FAILED' : hs === 'overloaded' ? '🔴 OVERLOADED' : hs === 'stressed' ? '🟡 STRESSED' : '🟢 HEALTHY'}
    </div>`;

  const statsHTML = S.sim.on && !t.isSource ? `
    <div class="insp-label">Live Load</div>
    <div class="insp-stat">
      <span class="insp-stat-label">Current RPS</span>
      <span class="insp-stat-val">${(comp.currentRPS || 0).toFixed(1)}</span>
    </div>
    <div class="insp-stat">
      <span class="insp-stat-label">Max RPS</span>
      <span class="insp-stat-val">${maxRPS >= 100000 ? '∞' : maxRPS}</span>
    </div>
    <div class="insp-stat">
      <span class="insp-stat-label">Load</span>
      <span class="insp-stat-val" style="color:${hs === 'overloaded' ? '#f85149' : hs === 'stressed' ? '#f0883e' : '#3fb950'}">
        ${maxRPS >= 100000 ? '—' : Math.round(Math.min(150, (comp.currentRPS || 0) / maxRPS * 100)) + '%'}
      </span>
    </div>
    <hr style="border:none;border-top:1px solid #21262d;margin:8px 0">
  ` : '';

  // Build config fields HTML
  const fields = t.configFields || [];
  const cfgHTML = fields.map(f => {
    const val = comp.config?.[f.key] ?? f.default ?? 0;
    if (f.type === 'number') {
      return `
        <div class="cfg-field">
          <div class="cfg-label">${f.label} <span>${val}</span></div>
          <input class="cfg-input" type="number" min="${f.min}" max="${f.max}" step="${f.step || 1}" value="${val}"
            ${comp.locked && f.key !== 'rps' ? 'disabled' : ''}
            onchange="onCfgChange('${comp.id}','${f.key}',+this.value);this.previousElementSibling.querySelector('span').textContent=this.value">
        </div>`;
    }
    if (f.type === 'range') {
      const isPercent = f.key.includes('Rate') || f.key === 'hitRate' || f.key === 'readWriteRatio';
      const dispVal = f.key === 'readWriteRatio'
        ? Math.round(val * 100) + '% reads'
        : isPercent ? Math.round(val * 100) + '%' : val;
      return `
        <div class="cfg-field">
          <div class="cfg-label">${f.label} <span>${dispVal}</span></div>
          <input class="cfg-range" type="range" min="${f.min}" max="${f.max}" step="${f.step || 0.05}" value="${val}"
            oninput="onCfgChange('${comp.id}','${f.key}',+this.value);this.previousElementSibling.querySelector('span').textContent=(${JSON.stringify(f.key === 'readWriteRatio')}?Math.round(+this.value*100)+'% reads':${JSON.stringify(isPercent)}?Math.round(+this.value*100)+'%':+this.value)">
        </div>`;
    }
    if (f.type === 'select') {
      return `
        <div class="cfg-field">
          <div class="cfg-label">${f.label}</div>
          <select class="cfg-select" onchange="onCfgChange('${comp.id}','${f.key}',this.value)">
            ${(f.options || []).map(o => `<option value="${o.v}" ${val === o.v ? 'selected' : ''}>${o.l}</option>`).join('')}
          </select>
        </div>`;
    }
    return '';
  }).join('');

  body.innerHTML = `
    <div style="text-align:center;margin-bottom:12px">
      <div style="font-size:30px;margin-bottom:5px">${t.icon}</div>
      <div style="font-size:14px;font-weight:700;color:${t.color}">${t.name}</div>
      ${comp.locked ? '<div style="font-size:9px;color:#6e7681;margin-top:3px">🔒 LEVEL COMPONENT</div>' : ''}
    </div>
    ${healthHTML}
    ${statsHTML}
    <div class="insp-label">Description</div>
    <div class="insp-desc">${t.desc}</div>
    <div class="insp-label">Sim Behavior</div>
    <div class="insp-desc" style="color:#e3b34190;border-left:2px solid #e3b34140;padding-left:8px">${t.behavior}</div>
    <div class="insp-label">Connections</div>
    <div class="insp-value">↙ ${inC} in · ${outC} out ↗</div>
    ${cfgHTML ? `<hr style="border:none;border-top:1px solid #21262d;margin:8px 0"><div class="insp-label">Configuration</div>${cfgHTML}` : ''}
    ${comp.locked ? '' : `
      <hr style="border:none;border-top:1px solid #21262d;margin:10px 0">
      <button onclick="deleteComp('${comp.id}')" style="
        width:100%;background:#21262d;border:1px solid #f8514930;border-radius:6px;
        color:#f85149;font-size:11px;font-weight:600;padding:6px;cursor:pointer">
        🗑️ Delete Component
      </button>`}
  `;
}

/** Called from inline onchange handlers in the inspector. */
export function onCfgChange(compId, key, value) {
  const comp = S.comps[compId];
  if (!comp) return;
  if (!comp.config) comp.config = {};
  comp.config[key] = value;
  // Config changes are frequent (range sliders) — no history push, just save
  window._saveToStorage?.();
}
