import { S } from '../state/store.js';
import { LEVELS } from '../levels/registry.js';

/** Re-render the floating level HUD (badge, title, description, goals). */
export function renderLevelHUD() {
  const lvl = LEVELS[S.currentLevel];
  if (!lvl) return;
  document.getElementById('lhud-badge').textContent = lvl.badge;
  document.getElementById('lhud-title').textContent = lvl.name;
  document.getElementById('lhud-desc').textContent  = lvl.desc;
  const goalsDiv = document.getElementById('lhud-goals');
  goalsDiv.innerHTML = '';
  for (const goal of lvl.goals) {
    const row = document.createElement('div');
    row.className = 'goal-row';
    row.id = goal.id;
    row.innerHTML = `<div class="goal-dot">✓</div>${goal.label}`;
    goalsDiv.appendChild(row);
  }
}
