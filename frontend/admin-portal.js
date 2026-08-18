import { ApiClient } from './api-client.js';
import { escapeHtml, showToast } from './utils.js';

export function initAdminPortal(switchView) {
  /* ============================================================
     👑 ADMIN MANAGEMENT PORTAL LOGIC
  ============================================================ */
  let adminUsersData = [];
  let adminAILogsLoaded = false;

  function activateAdminTab(tabName) {
    const isLogs = tabName === 'ai-logs';
    const usersTab = document.getElementById('admin-tab-users');
    const logsTab = document.getElementById('admin-tab-ai-logs');
    const usersPanel = document.getElementById('admin-users-panel');
    const logsPanel = document.getElementById('admin-ai-logs-panel');
    usersTab?.classList.toggle('is-active', !isLogs);
    logsTab?.classList.toggle('is-active', isLogs);
    usersTab?.setAttribute('aria-selected', String(!isLogs));
    logsTab?.setAttribute('aria-selected', String(isLogs));
    if (usersPanel) usersPanel.hidden = isLogs;
    if (logsPanel) logsPanel.hidden = !isLogs;
    if (isLogs && !adminAILogsLoaded) loadAdminAILogs();
  }

  function updateAILogStats(stats) {
    const mappings = {
      'ai-log-stat-total': stats.total_requests,
      'ai-log-stat-success': stats.successful_requests,
      'ai-log-stat-failed': stats.failed_requests,
      'ai-log-stat-users': stats.unique_users,
    };
    Object.entries(mappings).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element) element.textContent = value ?? 0;
    });
  }

  document.getElementById('page-download-optimized-cv')?.addEventListener('click', async () => {
    if (!currentGapResult) return;
    try {
      const template = document.getElementById('page-export-template')?.value || 'classic';
      const blob = await ApiClient.downloadCV(currentGapResult.cv_id, currentGapResult.id, template);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url; anchor.download = `optimized-cv-${template}.pdf`; anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) { showToast(`❌ ${err.message}`, 'error'); }
  });

  function renderAdminAILogs(logs) {
    const list = document.getElementById('admin-ai-log-list');
    if (!list) return;
    if (!logs.length) {
      list.innerHTML = '<div class="ai-log-empty">Không có AI log phù hợp với bộ lọc.</div>';
      return;
    }
    list.innerHTML = logs.map(log => {
      const timestamp = log.created_at
        ? new Date(log.created_at).toLocaleString('vi-VN')
        : 'Không rõ thời gian';
      const tools = (log.tools_used || []).map(tool => `<span>${escapeHtml(tool)}</span>`).join('');
      const statusLabel = log.llm_succeeded ? 'Thành công' : 'Lỗi';
      return `
        <article class="ai-log-card">
          <div class="ai-log-card-head">
            <div>
              <strong>${escapeHtml(log.user_full_name || 'User')}</strong>
              <span>${escapeHtml(log.user_email || '')}</span>
            </div>
            <span class="ai-log-status ${log.llm_succeeded ? 'is-success' : 'is-error'}">${statusLabel}</span>
          </div>
          <div class="ai-log-meta">
            <span>${escapeHtml(timestamp)}</span>
            <span>${escapeHtml(log.provider)} · ${escapeHtml(log.model)}</span>
            <span>${Number(log.latency_ms || 0)} ms</span>
            <span>Trang: ${escapeHtml(log.current_page || 'unknown')}</span>
          </div>
          <div class="ai-log-content">
            <div><span class="ai-log-label">PROMPT USER</span><p>${escapeHtml(log.prompt)}</p></div>
            <details>
              <summary>Xem phản hồi của Nova</summary>
              <p>${escapeHtml(log.response)}</p>
            </details>
          </div>
          ${tools ? `<div class="ai-log-tools"><b>Tools:</b>${tools}</div>` : ''}
          ${log.error_code ? `<div class="ai-log-error">Error: ${escapeHtml(log.error_code)}</div>` : ''}
        </article>
      `;
    }).join('');
  }

  async function loadAdminAILogs() {
    const list = document.getElementById('admin-ai-log-list');
    const search = document.getElementById('admin-ai-log-search')?.value.trim() || '';
    const success = document.getElementById('admin-ai-log-status')?.value ?? '';
    if (list) list.innerHTML = '<div class="ai-log-empty">⏳ Đang tải nhật ký AI…</div>';
    try {
      const [logs, stats] = await Promise.all([
        ApiClient.listAILogs(search, success),
        ApiClient.getAILogStats(),
      ]);
      renderAdminAILogs(logs.items || []);
      updateAILogStats(stats);
      adminAILogsLoaded = true;
    } catch (err) {
      if (list) list.innerHTML = `<div class="ai-log-empty is-error">Không thể tải AI log: ${escapeHtml(err.message)}</div>`;
      showToast(`Lỗi tải AI log: ${err.message}`, 'error');
    }
  }

  async function loadAdminUsersList() {
    const tbody = document.getElementById('admin-users-tbody');
    const user = ApiClient.getUser();

    if (!user || user.role !== 'admin') {
      showToast('❌ Bạn không có quyền truy cập Trang Quản Trị Admin', 'error');
      switchView('dashboard');
      return;
    }

    if (tbody) {
      tbody.innerHTML = `<tr><td colSpan="5" style="text-align:center;padding:30px;">⏳ Đang tải danh sách người dùng từ Server...</td></tr>`;
    }

    try {
      adminUsersData = await ApiClient.listAllUsers();
      renderAdminUsersTable(adminUsersData);
      updateAdminStats(adminUsersData);
    } catch (err) {
      if (tbody) {
        tbody.innerHTML = `<tr><td colSpan="5" style="text-align:center;padding:30px;color:#ff4e6a;">❌ Không thể tải danh sách user: ${err.message}</td></tr>`;
      }
      showToast(`Lỗi tải danh sách người dùng: ${err.message}`, 'error');
    }
  }

  function updateAdminStats(users) {
    const totalEl = document.getElementById('admin-stat-total');
    const adminEl = document.getElementById('admin-stat-admin');
    const studentEl = document.getElementById('admin-stat-student');
    const enterpriseEl = document.getElementById('admin-stat-enterprise');

    if (totalEl) totalEl.textContent = users.length;
    if (adminEl) adminEl.textContent = users.filter(u => u.role === 'admin').length;
    if (studentEl) studentEl.textContent = users.filter(u => u.role === 'student').length;
    if (enterpriseEl) enterpriseEl.textContent = users.filter(u => u.role === 'enterprise' || u.role === 'counselor').length;
  }

  function renderAdminUsersTable(users) {
    const tbody = document.getElementById('admin-users-tbody');
    if (!tbody) return;

    if (!users || users.length === 0) {
      tbody.innerHTML = `<tr><td colSpan="5" style="text-align:center;padding:30px;">Không tìm thấy người dùng nào.</td></tr>`;
      return;
    }

    tbody.innerHTML = users.map(u => {
      const createdDate = u.created_at ? new Date(u.created_at).toLocaleDateString('vi-VN') : '---';
      let roleClass = 'role-student';
      if (u.role === 'admin') roleClass = 'role-admin';
      else if (u.role === 'counselor') roleClass = 'role-counselor';
      else if (u.role === 'enterprise') roleClass = 'role-enterprise';

      return `
        <tr>
          <td><strong>${escapeHtml(u.full_name || 'Chưa đặt tên')}</strong></td>
          <td>${escapeHtml(u.email)}</td>
          <td><span class="role-badge ${roleClass}">${escapeHtml(u.role)}</span></td>
          <td>${createdDate}</td>
          <td style="text-align:center;">
            <button class="btn-action-sm btn-edit-user" data-user-id="${escapeHtml(u.id)}">✏️ Sửa</button>
            ${u.role === 'admin' ? '<span class="admin-locked-label">🔒 Admin duy nhất</span>' : `<button class="btn-action-sm btn-delete-user" data-user-id="${escapeHtml(u.id)}">🗑️ Xóa</button>`}
          </td>
        </tr>
      `;
    }).join('');

    // Attach edit and delete button events
    tbody.querySelectorAll('.btn-edit-user').forEach(btn => {
      btn.addEventListener('click', () => {
        const uId = btn.getAttribute('data-user-id');
        const targetUser = adminUsersData.find(x => x.id === uId);
        if (targetUser) openAdminUserModal('edit', targetUser);
      });
    });

    tbody.querySelectorAll('.btn-delete-user').forEach(btn => {
      btn.addEventListener('click', () => {
        const uId = btn.getAttribute('data-user-id');
        const targetUser = adminUsersData.find(x => x.id === uId);
        if (targetUser) deleteAdminUser(targetUser);
      });
    });
  }

  // Admin Search filter
  document.getElementById('admin-user-search')?.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase().trim();
    if (!q) {
      renderAdminUsersTable(adminUsersData);
    } else {
      const filtered = adminUsersData.filter(u => 
        (u.full_name && u.full_name.toLowerCase().includes(q)) || 
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.role && u.role.toLowerCase().includes(q))
      );
      renderAdminUsersTable(filtered);
    }
  });

  document.getElementById('admin-tab-users')?.addEventListener('click', () => activateAdminTab('users'));
  document.getElementById('admin-tab-ai-logs')?.addEventListener('click', () => activateAdminTab('ai-logs'));
  document.getElementById('btn-refresh-ai-logs')?.addEventListener('click', loadAdminAILogs);
  document.getElementById('admin-ai-log-status')?.addEventListener('change', loadAdminAILogs);
  let aiLogSearchTimer = null;
  document.getElementById('admin-ai-log-search')?.addEventListener('input', () => {
    window.clearTimeout(aiLogSearchTimer);
    aiLogSearchTimer = window.setTimeout(loadAdminAILogs, 350);
  });

  // Admin User Modal Logic
  const adminUserModal = document.getElementById('modal-admin-user-overlay');
  const adminUserForm = document.getElementById('admin-user-form');
  const btnAdminAddUser = document.getElementById('btn-admin-add-user');
  const btnAdminCloseUser = document.getElementById('modal-admin-user-close');

  if (btnAdminAddUser) {
    btnAdminAddUser.addEventListener('click', () => openAdminUserModal('add'));
  }

  if (btnAdminCloseUser) {
    btnAdminCloseUser.addEventListener('click', () => closeAdminUserModal());
  }

  // Update modal header icon for edit mode
  function updateAdminModalIcon(mode) {
    const avatarEl = document.getElementById('admin-modal-avatar-icon');
    if (!avatarEl) return;
    if (mode === 'edit') {
      avatarEl.innerHTML = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
    } else {
      avatarEl.innerHTML = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>`;
    }
  }

  function openAdminUserModal(mode = 'add', user = null) {
    if (!adminUserModal) return;
    const titleEl = document.getElementById('admin-user-modal-title');
    const subEl = document.getElementById('admin-user-modal-sub');
    const pwdLabel = document.getElementById('admin-label-password');

    const editIdInput = document.getElementById('admin-edit-user-id');
    const fullnameInput = document.getElementById('admin-input-fullname');
    const emailInput = document.getElementById('admin-input-email');
    const roleInput = document.getElementById('admin-input-role');
    const pwdInput = document.getElementById('admin-input-password');
    const managedRoleOptions = `
      <option value="student">Sinh viên (Student)</option>
      <option value="counselor">Cố vấn (Counselor)</option>
      <option value="enterprise">Doanh nghiệp (Enterprise)</option>`;

    if (mode === 'edit' && user) {
      if (titleEl) titleEl.textContent = 'Chỉnh Sửa Người Dùng';
      if (subEl) subEl.textContent = `Cập nhật thông tin và vai trò cho ${user.email}`;
      if (pwdLabel) pwdLabel.textContent = 'Mật khẩu mới (Để trống nếu không đổi)';
      if (editIdInput) editIdInput.value = user.id;
      if (fullnameInput) fullnameInput.value = user.full_name || '';
      if (emailInput) emailInput.value = user.email || '';
      if (roleInput) {
        roleInput.innerHTML = user.role === 'admin'
          ? '<option value="admin">Quản trị viên hệ thống duy nhất</option>'
          : managedRoleOptions;
        roleInput.value = user.role || 'student';
        roleInput.disabled = user.role === 'admin';
      }
      if (pwdInput) pwdInput.value = '';
      updateAdminModalIcon('edit');
    } else {
      if (titleEl) titleEl.textContent = 'Thêm Người Dùng Mới';
      if (subEl) subEl.textContent = 'Tạo tài khoản mới với vai trò Student, Counselor hoặc Enterprise';
      if (pwdLabel) pwdLabel.textContent = 'Mật khẩu (Tối thiểu 6 ký tự)';
      if (editIdInput) editIdInput.value = '';
      if (fullnameInput) fullnameInput.value = '';
      if (emailInput) emailInput.value = '';
      if (roleInput) {
        roleInput.innerHTML = managedRoleOptions;
        roleInput.value = 'student';
        roleInput.disabled = false;
      }
      if (pwdInput) pwdInput.value = '';
      updateAdminModalIcon('add');
    }

    adminUserModal.classList.add('open');
  }

  function closeAdminUserModal() {
    if (adminUserModal) adminUserModal.classList.remove('open');
  }

  // Close admin modal when clicking overlay background
  if (adminUserModal) {
    adminUserModal.addEventListener('click', (e) => {
      if (e.target === adminUserModal) closeAdminUserModal();
    });
  }


  if (adminUserForm) {
    adminUserForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const uId = document.getElementById('admin-edit-user-id')?.value;
      const fullName = document.getElementById('admin-input-fullname')?.value.trim();
      const email = document.getElementById('admin-input-email')?.value.trim();
      const role = document.getElementById('admin-input-role')?.value;
      const pwd = document.getElementById('admin-input-password')?.value.trim();

      try {
        if (uId) {
          // Edit mode
          const targetUser = adminUsersData.find(user => user.id === uId);
          const payload = { full_name: fullName, email: email };
          if (targetUser?.role !== 'admin') payload.role = role;
          if (pwd && pwd.length >= 6) payload.password = pwd;

          await ApiClient.updateUserByAdmin(uId, payload);
          showToast('✅ Cập nhật thông tin người dùng thành công!', 'success');
        } else {
          // Add mode
          if (!pwd || pwd.length < 6) {
            showToast('Mật khẩu tối thiểu 6 ký tự', 'warning');
            return;
          }
          await ApiClient.createUserByAdmin(email, pwd, fullName, role);
          showToast('✅ Thêm người dùng mới thành công!', 'success');
        }
        closeAdminUserModal();
        loadAdminUsersList();
      } catch (err) {
        showToast(`❌ Thao tác thất bại: ${err.message}`, 'error');
      }
    });
  }

  // ── Custom Delete Confirmation Modal ──
  const deleteConfirmOverlay = document.getElementById('modal-delete-confirm-overlay');
  const deleteConfirmTitle = document.getElementById('delete-confirm-title');
  const deleteConfirmDesc = document.getElementById('delete-confirm-desc');
  const deleteConfirmWarning = document.getElementById('delete-confirm-warning');
  const deleteConfirmCancel = document.getElementById('delete-confirm-cancel');
  const deleteConfirmOk = document.getElementById('delete-confirm-ok');
  let pendingDeleteResolve = null;

  function showDeleteConfirm({ title, description, confirmLabel, warning }) {
    return new Promise((resolve) => {
      pendingDeleteResolve = resolve;
      if (deleteConfirmTitle) deleteConfirmTitle.textContent = title;
      if (deleteConfirmDesc) deleteConfirmDesc.innerHTML = description;
      if (deleteConfirmWarning) deleteConfirmWarning.textContent = warning;
      if (deleteConfirmOk) deleteConfirmOk.textContent = confirmLabel;
      if (deleteConfirmOverlay) deleteConfirmOverlay.classList.add('open');
    });
  }

  function closeDeleteConfirm(result) {
    if (deleteConfirmOverlay) deleteConfirmOverlay.classList.remove('open');
    if (pendingDeleteResolve) {
      pendingDeleteResolve(result);
      pendingDeleteResolve = null;
    }
  }

  if (deleteConfirmCancel) {
    deleteConfirmCancel.addEventListener('click', () => closeDeleteConfirm(false));
  }
  if (deleteConfirmOk) {
    deleteConfirmOk.addEventListener('click', () => closeDeleteConfirm(true));
  }
  if (deleteConfirmOverlay) {
    deleteConfirmOverlay.addEventListener('click', (e) => {
      if (e.target === deleteConfirmOverlay) closeDeleteConfirm(false);
    });
  }

  async function deleteAdminUser(user) {
    const currentUser = ApiClient.getUser();
    if (currentUser && currentUser.id === user.id) {
      showToast('❌ Không thể tự xóa tài khoản Admin đang đăng nhập', 'error');
      return;
    }

    const confirmed = await showDeleteConfirm({
      title: 'Xác Nhận Xóa Người Dùng',
      description: `Bạn có chắc chắn muốn xóa người dùng <strong style="color:#fff;">"${escapeHtml(user.full_name || 'Không tên')}"</strong> <span style="color:rgba(255,255,255,0.5);">(${escapeHtml(user.email)})</span>?`,
      confirmLabel: 'Xóa Người Dùng',
      warning: '⚠️ Thao tác này không thể hoàn tác.',
    });
    if (!confirmed) return;

    try {
      await ApiClient.deleteUserByAdmin(user.id);
      showToast(`🗑️ Đã xóa người dùng ${user.email} thành công`, 'success');
      loadAdminUsersList();
    } catch (err) {
      showToast(`❌ Lỗi xóa người dùng: ${err.message}`, 'error');
    }
  }

  // Khôi phục phiên từ cookie HttpOnly; dữ liệu user trong localStorage chỉ là cache hiển thị.
  ApiClient.getMe().then(() => checkUserSession()).catch(() => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user_info');
    checkUserSession();
  });

  /* ── Auth Modal Logic ── */
  const authOverlay = document.getElementById('modal-overlay');
  const authClose = document.getElementById('modal-close');
  const tabLogin = document.getElementById('tab-auth-login');
  const tabRegister = document.getElementById('tab-auth-register');
  const fullnameGroup = document.getElementById('form-fullname-group');
  const roleGroup = document.getElementById('form-role-group');
  const authTitle = document.getElementById('auth-title');
  const authSub = document.getElementById('auth-sub');
  const btnSubmitLabel = document.getElementById('btn-submit-label');
  const loginForm = document.getElementById('login-form');
  const forgotPasswordButton = document.getElementById('btn-forgot-password');
  const passwordResetOverlay = document.getElementById('password-reset-overlay');
  const passwordResetCloseButton = document.getElementById('password-reset-close');
  const passwordResetForm = document.getElementById('password-reset-form');
  const resetStep1 = document.getElementById('reset-step-1');
  const resetStep2 = document.getElementById('reset-step-2');
  const resetStep3 = document.getElementById('reset-step-3');
  const btnResetStep1 = document.getElementById('btn-reset-step-1');
  const btnResetStep2 = document.getElementById('btn-reset-step-2');
  const btnResetStep3 = document.getElementById('btn-reset-step-3');
  const passwordResetBack1 = document.getElementById('btn-password-reset-back');
  const passwordResetBack2 = document.getElementById('btn-password-reset-back-2');
  const resetStep2Sub = document.getElementById('reset-step-2-sub');
  const passwordResetTimer = document.getElementById('password-reset-timer');
  const googleButtonHost = document.getElementById('google-signin-button');
  const googleAuthHelp = document.getElementById('google-auth-help');

  let isRegisterMode = false;
  let currentResetStep = 1;
  let resetCountdownInterval = null;
  let googleIdentityInitialized = false;

  document.addEventListener('click', (e) => {
    const btn = e.target && e.target.closest ? e.target.closest('.btn-toggle-password') : null;
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    const wrap = btn.closest('.password-input-wrap') || btn.parentElement;
    if (!wrap) return;
    const input = wrap.querySelector('input');
    if (!input) return;
    const isNowVisible = input.type === 'password';
    input.type = isNowVisible ? 'text' : 'password';
    wrap.classList.toggle('is-visible', isNowVisible);
    const showIcon = btn.querySelector('.eye-icon-show');
    const hideIcon = btn.querySelector('.eye-icon-hide');
    if (showIcon && hideIcon) {
      showIcon.style.display = isNowVisible ? 'none' : 'block';
      hideIcon.style.display = isNowVisible ? 'block' : 'none';
    }
    btn.setAttribute('aria-label', isNowVisible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu');
    input.focus();
  });

  function openAuthModal() {
    if (authOverlay) authOverlay.classList.add('open');
    renderGoogleSignInButton();
  }
  function closeAuthModal() {
    if (authOverlay) authOverlay.classList.remove('open');
    document.getElementById('auth-role-select')?.classList.remove('is-open');
  }
  if (authClose) authClose.addEventListener('click', closeAuthModal);

  function setAuthMode(register) {
    if (forgotPasswordButton) forgotPasswordButton.hidden = register;
    isRegisterMode = register;
    const currentLang = localStorage.getItem('career_copilot_lang') || 'vi';
    const dict = TRANSLATIONS[currentLang] || TRANSLATIONS.vi;

    if (register) {
      tabRegister?.classList.add('active'); if (tabRegister) tabRegister.style.color = '#fff';
      tabLogin?.classList.remove('active'); if (tabLogin) tabLogin.style.color = 'var(--text-dim)';
      if (fullnameGroup) fullnameGroup.style.display = 'block';
      if (roleGroup) roleGroup.style.display = 'block';
      if (authTitle) authTitle.textContent = dict['auth-title-reg'] || 'Tạo tài khoản mới';
      if (authSub) authSub.textContent = dict['auth-sub-reg'] || 'Tham gia CV Assistant để tối ưu CV & phỏng vấn';
      if (btnSubmitLabel) btnSubmitLabel.textContent = dict['btn-submit-reg'] || 'Đăng ký tài khoản';
    } else {
      tabLogin?.classList.add('active'); if (tabLogin) tabLogin.style.color = '#fff';
      tabRegister?.classList.remove('active'); if (tabRegister) tabRegister.style.color = 'var(--text-dim)';
      if (fullnameGroup) fullnameGroup.style.display = 'none';
      if (roleGroup) roleGroup.style.display = 'none';
      if (authTitle) authTitle.textContent = dict['auth-title-login'] || 'Chào mừng trở lại';
      if (authSub) authSub.textContent = dict['auth-sub-login'] || 'Đăng nhập để tiếp tục hành trình nâng cấp sự nghiệp cùng AI Agent';
      if (btnSubmitLabel) btnSubmitLabel.textContent = dict['btn-submit-login'] || 'Đăng nhập';
    }
    if (authOverlay?.classList.contains('open')) renderGoogleSignInButton();
  }

  if (tabLogin) tabLogin.addEventListener('click', () => setAuthMode(false));
  if (tabRegister) tabRegister.addEventListener('click', () => setAuthMode(true));

  function updateResetSteps() {
    if (resetStep1) resetStep1.hidden = (currentResetStep !== 1);
    if (resetStep2) resetStep2.hidden = (currentResetStep !== 2);
    if (resetStep3) resetStep3.hidden = (currentResetStep !== 3);
  }

  function setPasswordResetMode(enabled) {
    if (!passwordResetForm || !passwordResetOverlay) return;
    passwordResetOverlay.classList.toggle('open', enabled);
    if (enabled) {
      closeAuthModal();
      currentResetStep = 1;
      updateResetSteps();
      document.getElementById('reset-email')?.focus();
      return;
    }
    passwordResetForm.reset();
    clearInterval(resetCountdownInterval);
  }

  forgotPasswordButton?.addEventListener('click', () => setPasswordResetMode(true));
  passwordResetBack1?.addEventListener('click', () => {
    setPasswordResetMode(false);
    setAuthMode(false);
    openAuthModal();
  });
  passwordResetBack2?.addEventListener('click', () => {
    currentResetStep = 1;
    updateResetSteps();
  });
  passwordResetCloseButton?.addEventListener('click', () => setPasswordResetMode(false));

  passwordResetForm?.addEventListener('submit', async event => {
    event.preventDefault();
    const email = document.getElementById('reset-email')?.value.trim();
    if (!email) return;

    if (currentResetStep === 1) {
      try {
        if (btnResetStep1) btnResetStep1.disabled = true;
        await ApiClient.requestPasswordReset(email);
        if (btnResetStep1) btnResetStep1.disabled = false;
        
        currentResetStep = 2;
        updateResetSteps();
        
        if (resetStep2Sub) resetStep2Sub.textContent = `Mã 6 số đã được gửi đến ${email}.`;
        
        if (passwordResetTimer) {
          passwordResetTimer.hidden = false;
          let secondsLeft = 600; // 10 minutes
          passwordResetTimer.textContent = `Mã hết hạn trong: 10:00`;
          clearInterval(resetCountdownInterval);
          resetCountdownInterval = setInterval(() => {
            secondsLeft--;
            if (secondsLeft <= 0) {
              clearInterval(resetCountdownInterval);
              passwordResetTimer.textContent = 'Mã OTP đã hết hạn.';
              if (btnResetStep2) btnResetStep2.disabled = true;
            } else {
              const m = Math.floor(secondsLeft / 60);
              const s = secondsLeft % 60;
              passwordResetTimer.textContent = `Mã hết hạn trong: ${m}:${s.toString().padStart(2, '0')}`;
            }
          }, 1000);
        }
        
        showToast('Kiểm tra hộp thư Gmail để lấy mã OTP.', 'success');
        document.getElementById('reset-otp')?.focus();
      } catch (err) {
        if (btnResetStep1) btnResetStep1.disabled = false;
        showToast(`❌ ${err.message}`, 'error');
      }
      return;
    }

    if (currentResetStep === 2) {
      const otp = document.getElementById('reset-otp')?.value.trim();
      if (!/^\d{6}$/.test(otp || '')) {
        showToast('Vui lòng nhập mã OTP gồm 6 số.', 'error');
        return;
      }
      currentResetStep = 3;
      updateResetSteps();
      document.getElementById('reset-new-password')?.focus();
      return;
    }

    if (currentResetStep === 3) {
      const otp = document.getElementById('reset-otp')?.value.trim();
      const newPassword = document.getElementById('reset-new-password')?.value;
      const confirmPassword = document.getElementById('reset-confirm-password')?.value;
      
      if (!newPassword || newPassword.length < 8) {
        showToast('Mật khẩu mới phải có ít nhất 8 ký tự.', 'error');
        return;
      }
      if (newPassword !== confirmPassword) {
        showToast('Mật khẩu xác nhận không khớp.', 'error');
        return;
      }
      
      try {
        if (btnResetStep3) btnResetStep3.disabled = true;
        const result = await ApiClient.confirmPasswordReset(email, otp, newPassword);
        showToast(result.message || 'Đặt lại mật khẩu thành công.', 'success');
        setPasswordResetMode(false);
        setAuthMode(false);
        openAuthModal();
        document.getElementById('input-email').value = email;
        document.getElementById('input-password')?.focus();
        if (btnResetStep3) btnResetStep3.disabled = false;
      } catch (err) {
        if (btnResetStep3) btnResetStep3.disabled = false;
        showToast(`❌ ${err.message}`, 'error');
        if (err.message.toLowerCase().includes('otp') || err.message.toLowerCase().includes('mã')) {
          currentResetStep = 2;
          updateResetSteps();
          document.getElementById('reset-otp')?.focus();
        }
      }
    }
  });

  function enhanceAuthRoleSelect() {
    const select = document.getElementById('input-role');
    const shell = document.getElementById('auth-role-select');
    if (!select || !shell) return;

    let trigger = shell.querySelector('.auth-role-trigger');
    let menu = shell.querySelector('.auth-role-menu');
    if (!trigger || !menu) {
      trigger = document.createElement('button');
      trigger.type = 'button';
      trigger.className = 'auth-role-trigger';
      trigger.setAttribute('aria-haspopup', 'listbox');
      trigger.setAttribute('aria-expanded', 'false');
      trigger.setAttribute('aria-controls', 'auth-role-menu');
      trigger.innerHTML = '<span class="auth-role-current"></span><span class="auth-role-chevron" aria-hidden="true"></span>';
      menu = document.createElement('div');
      menu.id = 'auth-role-menu';
      menu.className = 'auth-role-menu';
      menu.setAttribute('role', 'listbox');
      menu.setAttribute('aria-label', 'Danh sách vai trò');
      shell.append(trigger, menu);

      trigger.addEventListener('click', () => {
        const shouldOpen = !shell.classList.contains('is-open');
        shell.classList.toggle('is-open', shouldOpen);
        trigger.setAttribute('aria-expanded', String(shouldOpen));
        if (shouldOpen) menu.querySelector('[aria-selected="true"]')?.focus();
      });
      menu.addEventListener('keydown', event => {
        const items = [...menu.querySelectorAll('.auth-role-option')];
        const currentIndex = items.indexOf(document.activeElement);
        if (event.key === 'Escape') {
          event.preventDefault();
          shell.classList.remove('is-open');
          trigger.setAttribute('aria-expanded', 'false');
          trigger.focus();
        } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault();
          const offset = event.key === 'ArrowDown' ? 1 : -1;
          items[(currentIndex + offset + items.length) % items.length]?.focus();
        }
      });
    }

    const parseLabel = label => {
      const match = label.match(/^(.*?)\s*\((.*?)\)$/);
      return { title: match?.[1] || label, meta: match?.[2] || '' };
    };
    const selectedOption = select.options[select.selectedIndex] || select.options[0];
    const selectedLabel = parseLabel(selectedOption?.textContent || 'Chọn vai trò');
    trigger.querySelector('.auth-role-current').innerHTML = `<strong>${escapeHtml(selectedLabel.title)}</strong>${selectedLabel.meta ? `<small>${escapeHtml(selectedLabel.meta)}</small>` : ''}`;
    menu.innerHTML = [...select.options].map(option => {
      const label = parseLabel(option.textContent);
      const selected = option.value === select.value;
      return `<button type="button" class="auth-role-option${selected ? ' is-selected' : ''}" role="option" data-value="${escapeHtml(option.value)}" aria-selected="${selected}">
        <span class="auth-role-option-copy"><strong>${escapeHtml(label.title)}</strong><small>${escapeHtml(label.meta)}</small></span>
        <span class="auth-role-check" aria-hidden="true">✓</span>
      </button>`;
    }).join('');
    menu.querySelectorAll('.auth-role-option').forEach(item => item.addEventListener('click', () => {
      select.value = item.dataset.value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      enhanceAuthRoleSelect();
      shell.classList.remove('is-open');
      trigger.setAttribute('aria-expanded', 'false');
      trigger.focus();
    }));
  }

  enhanceAuthRoleSelect();
  document.addEventListener('click', event => {
    const shell = document.getElementById('auth-role-select');
    if (shell && !event.target.closest('#auth-role-select')) {
      shell.classList.remove('is-open');
      shell.querySelector('.auth-role-trigger')?.setAttribute('aria-expanded', 'false');
    }
  });

  async function loadGoogleIdentityServices() {
    if (window.google?.accounts?.id) return;
    await new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-google-identity]');
      if (existing) existing.remove();
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.dataset.googleIdentity = 'true';
      script.onload = resolve;
      script.onerror = () => {
        script.remove();
        reject(new Error('Google Identity Services không tải được.'));
      };
      document.head.appendChild(script);
    });
  }

  async function handleGoogleCredential(response) {
    if (!response?.credential) {
      showToast('Google không trả về thông tin đăng nhập.', 'error');
      return;
    }
    try {
      const role = isRegisterMode ? document.getElementById('input-role')?.value || 'student' : 'student';
      await ApiClient.googleAuth(response.credential, role);
      closeAuthModal();
      checkUserSession();
      showToast('✅ Google đã xác minh và đăng nhập thành công!', 'success');
    } catch (err) {
      showToast(`❌ ${err.message}`, 'error');
    }
  }

  // Nút do Google render nhận click trực tiếp, tránh popup bị chặn do mở bằng script.
  async function renderGoogleSignInButton() {
    if (!googleButtonHost) return;
    const clientId = googleButtonHost.dataset.clientId;
    if (!clientId) {
      googleButtonHost.innerHTML = '<span class="google-auth-loading">Google OAuth chưa được cấu hình.</span>';
      return;
    }
    googleButtonHost.setAttribute('aria-busy', 'true');
    googleButtonHost.innerHTML = '<span class="google-auth-loading">Đang tải nút Google…</span>';
    if (googleAuthHelp) googleAuthHelp.hidden = true;
    try {
      await loadGoogleIdentityServices();
      if (!googleIdentityInitialized) {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: handleGoogleCredential,
          ux_mode: 'popup',
          auto_select: false,
          cancel_on_tap_outside: true,
          use_fedcm_for_prompt: true,
          itp_support: true,
        });
        googleIdentityInitialized = true;
      }
      googleButtonHost.innerHTML = '';
      const currentLang = localStorage.getItem('career_copilot_lang') || 'vi';
      window.google.accounts.id.renderButton(googleButtonHost, {
        type: 'standard',
        theme: 'filled_black',
        size: 'large',
        text: isRegisterMode ? 'signup_with' : 'continue_with',
        shape: 'pill',
        logo_alignment: 'left',
        width: Math.min(Math.max((googleButtonHost.clientWidth || 360) - 12, 240), 360),
        locale: currentLang,
      });
      googleButtonHost.removeAttribute('aria-busy');
    } catch (_err) {
      googleButtonHost.removeAttribute('aria-busy');
      googleButtonHost.innerHTML = '<button type="button" class="google-auth-retry">Tải lại nút Google</button>';
      googleButtonHost.querySelector('.google-auth-retry')?.addEventListener('click', renderGoogleSignInButton);
      if (googleAuthHelp) {
        googleAuthHelp.hidden = false;
        googleAuthHelp.textContent = 'Không tải được Google. Hãy tắt tiện ích chặn theo dõi cho trang này hoặc dùng Email.';
      }
    }
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('input-email').value.trim();
      const password = document.getElementById('input-password').value;

      if (!email || !password) {
        showToast('Vui lòng điền đầy đủ Email và Mật khẩu', 'error');
        return;
      }

      try {
        if (isRegisterMode) {
          const fullName = document.getElementById('input-fullname').value.trim() || email.split('@')[0];
          const role = document.getElementById('input-role').value;
          await ApiClient.register(email, password, fullName, role);
          showToast('🎉 Đăng ký thành công! Đang tự động đăng nhập...', 'success');
          await ApiClient.login(email, password);
        } else {
          await ApiClient.login(email, password);
          showToast('✅ Đăng nhập thành công!', 'success');
        }
        closeAuthModal();
        checkUserSession();
      } catch (err) {
        showToast(`❌ ${err.message}`, 'error');
      }
    });
  }

}
