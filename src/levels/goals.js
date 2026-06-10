import { S } from '../state/store.js';
import { LEVELS } from './registry.js';

export function checkGoals() {
  const lvl = LEVELS[S.currentLevel];
  if (!lvl) return;
  let allMet = true;
  for (const goal of lvl.goals) {
    const met = goal.check(S);
    markGoal(goal.id, met);
    if (!met) allMet = false;
  }
  if (allMet && !S.sim.winShown) {
    S.sim.winShown = true;
    setTimeout(showWin, 1200);
  }
}

export function markGoal(id, done) {
  const row = document.getElementById(id);
  if (!row) return;
  row.classList.toggle('done', done);
}

export function showWin() {
  const lvl = LEVELS[S.currentLevel];
  document.getElementById('win-title').textContent = lvl?.winTitle || 'Level Complete!';
  document.getElementById('win-sub').textContent   = lvl?.winSub   || 'Well done!';
  document.getElementById('win-overlay').style.display = 'flex';
}

export function dismissWin() {
  document.getElementById('win-overlay').style.display = 'none';
}
