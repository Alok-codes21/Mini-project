// Explicit action below each module's inputs. Selecting tabs never calculates.
export function solveButton(afterSelector, run, label = 'Solve') {
  const wrap = document.createElement('div');
  wrap.className = 'solve-action';
  const button = document.createElement('button');
  button.type = 'button'; button.className = 'primary-btn';
  button.id = 'solveBtn'; button.textContent = label;
  wrap.append(button); document.querySelector(afterSelector)?.after(wrap);
  button.addEventListener('click', async () => {
    if (button.disabled) return;
    button.disabled = true; button.textContent = 'Solving…';
    try { await run(); } finally { button.disabled = false; button.textContent = label; }
  });
  return button;
}
