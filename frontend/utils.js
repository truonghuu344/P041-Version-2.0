  export function escapeHtml(value = '') {
    const node = document.createElement('div');
    node.textContent = String(value);
    return node.innerHTML;
  }

  /* ── Toast Notification Helper ── */
  export function showToast(msg, type = 'info') {
    const old = document.querySelector('.toast');
    if (old) old.remove();
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.textContent = msg;
    document.body.appendChild(t);
    requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add('show')));
    setTimeout(() => {
      t.classList.remove('show');
      setTimeout(() => t.remove(), 350);
    }, 3200);
  }