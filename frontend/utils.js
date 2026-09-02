  export function escapeHtml(value = '') {
    const node = document.createElement('div');
    node.textContent = String(value);
    return node.innerHTML;
  }

  /* ── Toast Notification Helper (UI notification disabled) ── */
  export function showToast(_msg, _type = 'info') {
    // Toast UI notification disabled globally
  }