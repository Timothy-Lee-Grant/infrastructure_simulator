let hintTimer = null;

/** Show a transient message in the hint bar. Auto-hides after 3.5 s. */
export function hint(msg) {
  const bar = document.getElementById('hint-bar');
  if (!bar) return;
  bar.textContent = msg;
  bar.style.opacity = 1;
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => { bar.style.opacity = 0; }, 3500);
}
