// ============================
// DocMS - Main Application
// ============================

const App = {
  user: null,
  currentPage: 'dashboard',
  zoomLevel: 100,
  zoomMin: 50,
  zoomMax: 200,
  zoomStep: 10,

  // API Helper
  async api(url, options = {}) {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
      body: options.body ? JSON.stringify(options.body) : undefined
    });
    return res.json();
  },

  // Toast notification
  toast(msg, type = 'info') {
    const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', info: 'fa-info-circle' };
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.innerHTML = `<i class="fas ${icons[type]} toast-icon"></i><span class="toast-text">${msg}</span>`;
    document.body.appendChild(t);
    setTimeout(() => { t.style.animation = 'toastOut 0.3s forwards'; setTimeout(() => t.remove(), 300); }, 3000);
  },

  // Initialize
  async init() {
    this.bindLogin();
    try {
      const data = await this.api('/api/auth/me');
      if (data.user) { this.user = data.user; this.showApp(); }
    } catch (e) { }
  },

  bindLogin() {
    document.getElementById('loginForm').onsubmit = async (e) => {
      e.preventDefault();
      const userEl = document.getElementById('username');
      const passEl = document.getElementById('password');
      const errEl = document.getElementById('loginError');
      errEl.style.display = 'none';

      // Clear previous inline errors
      document.querySelectorAll('.invalid-feedback').forEach(el => el.remove());
      document.querySelectorAll('.form-group').forEach(el => el.classList.remove('has-error'));

      const showFieldError = (inputEl, message) => {
        inputEl.classList.add('is-invalid');
        const formGroup = inputEl.closest('.form-group') || inputEl.parentElement;
        if (formGroup) formGroup.classList.add('has-error');
        
        const feedback = document.createElement('div');
        feedback.className = 'invalid-feedback';
        feedback.innerHTML = `<i class="fas fa-exclamation-circle"></i> <span>${message}</span>`;
        if (inputEl.parentElement.classList.contains('password-wrapper')) {
          inputEl.parentElement.after(feedback);
        } else {
          inputEl.after(feedback);
        }
      };

      let hasError = false;
      if (!userEl.value.trim()) {
        showFieldError(userEl, 'กรุณากรอกชื่อผู้ใช้');
        hasError = true;
      }
      if (!passEl.value) {
        showFieldError(passEl, 'กรุณากรอกรหัสผ่าน');
        hasError = true;
      }

      if (hasError) return;

      const data = await this.api('/api/auth/login', {
        method: 'POST',
        body: { username: userEl.value, password: passEl.value }
      });
      if (data.error) {
        showFieldError(userEl, data.error);
        showFieldError(passEl, '');
        return;
      }
      this.user = data.user;
      this.showApp();
    };

    // Auto clear invalid highlight on input change/typing
    document.addEventListener('input', (e) => {
      if (e.target.matches('input, select, textarea')) {
        e.target.classList.remove('is-invalid');
        const fg = e.target.closest('.form-group');
        if (fg) {
          fg.classList.remove('has-error');
          const fb = fg.querySelector('.invalid-feedback');
          if (fb) fb.remove();
        }
      }
    });

    document.querySelectorAll('.demo-btn').forEach(btn => {
      btn.onclick = () => {
        document.getElementById('username').value = btn.dataset.user;
        document.getElementById('password').value = btn.dataset.pass;
        document.getElementById('username').classList.remove('is-invalid');
        document.getElementById('password').classList.remove('is-invalid');
        document.getElementById('loginForm').requestSubmit();
      };
    });

    // Toggle login ↔ register
    document.getElementById('showRegister').onclick = (e) => {
      e.preventDefault();
      document.getElementById('loginForm').style.display = 'none';
      document.getElementById('forgotPwForm').style.display = 'none';
      document.getElementById('registerForm').style.display = 'block';
      document.getElementById('loginError').style.display = 'none';
    };
    document.getElementById('showLogin').onclick = (e) => {
      e.preventDefault();
      document.getElementById('registerForm').style.display = 'none';
      document.getElementById('forgotPwForm').style.display = 'none';
      document.getElementById('loginForm').style.display = 'block';
      document.getElementById('registerError').style.display = 'none';
    };

    // Toggle login ↔ forgot password
    document.getElementById('showForgotPw').onclick = (e) => {
      e.preventDefault();
      document.getElementById('loginForm').style.display = 'none';
      document.getElementById('registerForm').style.display = 'none';
      document.getElementById('forgotPwForm').style.display = 'block';
      document.getElementById('loginError').style.display = 'none';
    };
    document.getElementById('showLoginFromForgot').onclick = (e) => {
      e.preventDefault();
      document.getElementById('forgotPwForm').style.display = 'none';
      document.getElementById('loginForm').style.display = 'block';
    };

    // Forgot password submit
    document.getElementById('forgotPwForm').onsubmit = async (e) => {
      e.preventDefault();
      const errEl = document.getElementById('forgotError');
      const resultEl = document.getElementById('forgotPwResult');
      errEl.style.display = 'none';
      resultEl.style.display = 'none';

      const data = await this.api('/api/auth/forgot-password', {
        method: 'POST',
        body: {
          username: document.getElementById('forgotUsername').value.trim(),
          email: document.getElementById('forgotEmail').value.trim()
        }
      });

      if (data.error) {
        errEl.textContent = data.error;
        errEl.style.display = 'block';
        return;
      }

      resultEl.style.background = 'rgba(16,185,129,0.15)';
      resultEl.style.color = 'var(--accent-green)';
      resultEl.style.border = '1px solid var(--accent-green)';
      resultEl.innerHTML = `<i class="fas fa-check-circle"></i> รีเซ็ตสำเร็จ!<br><strong style="font-size:18px;letter-spacing:2px">${data.newPassword}</strong><br><span style="font-size:11px;color:var(--text-muted)">กรุณาจดรหัสผ่านใหม่แล้วกลับไปเข้าสู่ระบบ</span>`;
      resultEl.style.display = 'block';
    };

    // Register submit
    document.getElementById('registerForm').onsubmit = async (e) => {
      e.preventDefault();
      const errEl = document.getElementById('registerError');
      errEl.style.display = 'none';

      const pw = document.getElementById('regPassword').value;
      const pw2 = document.getElementById('regPassword2').value;
      if (pw !== pw2) { errEl.textContent = 'รหัสผ่านไม่ตรงกัน'; errEl.style.display = 'block'; return; }

      const data = await this.api('/api/auth/register', {
        method: 'POST',
        body: {
          name: document.getElementById('regName').value,
          username: document.getElementById('regUsername').value,
          email: document.getElementById('regEmail').value,
          department: document.getElementById('regDept').value,
          password: pw
        }
      });

      if (data.error) { errEl.textContent = data.error; errEl.style.display = 'block'; return; }
      this.user = data.user;
      this.showApp();
    };
  },

  showApp() {
    document.getElementById('loginPage').style.display = 'none';
    document.getElementById('appPage').style.display = 'flex';
    this.buildSidebar();
    this.bindAppEvents();
    this.updateBadges();
    const urlParams = new URLSearchParams(window.location.search);
    const docId = urlParams.get('doc');
    if (docId) {
      this.navigate('documents');
      this.viewDocument(docId);
    } else {
      this.navigate('dashboard');
    }
    // Auto-poll notification & pending badges every 15 seconds
    if (this._notifPollTimer) clearInterval(this._notifPollTimer);
    this._notifPollTimer = setInterval(() => this.updateBadges(), 15000);
  },

  buildSidebar() {
    const nav = document.getElementById('sidebarNav');
    const menus = {
      admin: [
        {
          section: 'หลัก', items: [
            { id: 'dashboard', icon: 'fa-chart-pie', label: 'แดชบอร์ด' },
            { id: 'documents', icon: 'fa-folder-open', label: 'เอกสารทั้งหมด' }
          ]
        },
        {
          section: 'จัดการ & สิทธิ์ระบบ', items: [
            { id: 'users', icon: 'fa-users-cog', label: 'จัดการผู้ใช้' },
            { id: 'certificates', icon: 'fa-certificate', label: 'ใบรับรองดิจิทัล' },
            { id: 'access_requests', icon: 'fa-key', label: 'คำร้องขอสิทธิ์', badge: true },
            { id: 'logs', icon: 'fa-history', label: 'ประวัติการใช้งาน' },
            { id: 'profile', icon: 'fa-user-cog', label: 'ข้อมูลส่วนตัว' },
            { id: 'system', icon: 'fa-server', label: 'สถานะระบบ' }
          ]
        }
      ],
      secretary: [
        {
          section: 'หลัก', items: [
            { id: 'dashboard', icon: 'fa-chart-pie', label: 'แดชบอร์ด' },
            { id: 'documents', icon: 'fa-folder-open', label: 'เอกสารทั้งหมด' },
            { id: 'upload', icon: 'fa-cloud-upload-alt', label: 'สร้างเอกสาร' }
          ]
        },
        {
          section: 'รายงาน & การจัดการ', items: [
            { id: 'reports', icon: 'fa-chart-bar', label: 'รายงาน' },
            { id: 'profile', icon: 'fa-user-cog', label: 'ข้อมูลส่วนตัว' },
            { id: 'my_logs', icon: 'fa-history', label: 'ประวัติการดำเนินการ' }
          ]
        }
      ],
      user: [
        {
          section: 'หลัก', items: [
            { id: 'dashboard', icon: 'fa-chart-pie', label: 'แดชบอร์ด' },
            { id: 'documents', icon: 'fa-folder-open', label: 'เอกสารของฉัน' }
          ]
        },
        {
          section: 'จัดการ', items: [
            { id: 'profile', icon: 'fa-user-cog', label: 'ข้อมูลส่วนตัว' },
            { id: 'access_requests', icon: 'fa-key', label: 'ขอสิทธิ์เอกสาร' },
            { id: 'my_logs', icon: 'fa-history', label: 'ประวัติการดำเนินการ' }
          ]
        }
      ],
      executive: [
        {
          section: 'หลัก', items: [
            { id: 'dashboard', icon: 'fa-chart-pie', label: 'แดชบอร์ด' },
            { id: 'documents', icon: 'fa-folder-open', label: 'เอกสารทั้งหมด' }
          ]
        },
        {
          section: 'อนุมัติ & การจัดการ', items: [
            { id: 'pending', icon: 'fa-clock', label: 'รออนุมัติ', badge: true },
            { id: 'certificates', icon: 'fa-certificate', label: 'ใบรับรองของฉัน' },
            { id: 'profile', icon: 'fa-user-cog', label: 'ข้อมูลส่วนตัว' },
            { id: 'my_logs', icon: 'fa-history', label: 'ประวัติการดำเนินการ' }
          ]
        }
      ]
    };

    const roleMenus = menus[this.user.role] || menus.user;
    nav.innerHTML = roleMenus.map(sec =>
      `<div class="nav-section"><div class="nav-section-title">${sec.section}</div>
      ${sec.items.map(it => `<div class="nav-item${it.id === 'dashboard' ? ' active' : ''}" data-page="${it.id}">
        <i class="fas ${it.icon}"></i><span>${it.label}</span>${it.badge ? '<span class="badge" style="display:none">0</span>' : ''}
      </div>`).join('')}</div>`
    ).join('');

    nav.querySelectorAll('.nav-item').forEach(item => {
      item.onclick = () => this.navigate(item.dataset.page);
    });

    const u = this.user;
    const avatarContent = u.avatar 
      ? `<img src="${u.avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%" alt="Avatar">`
      : `<i class="fas ${u.role === 'executive' ? 'fa-user-tie' : 'fa-user'}"></i>`;

    document.getElementById('sidebarUser').innerHTML = `
      <div class="sidebar-user-avatar" style="overflow:hidden">${avatarContent}</div>
      <div class="sidebar-user-info"><div class="sidebar-user-name">${u.name}</div><div class="sidebar-user-role">${u.roleName}</div></div>`;
    document.getElementById('dropdownHeader').innerHTML = `<div class="name">${u.name}</div><div class="role">${u.roleName} • ${u.department}</div>`;
    const userAvatarEl = document.getElementById('userAvatar');
    if (userAvatarEl) {
      userAvatarEl.innerHTML = avatarContent;
      userAvatarEl.style.overflow = 'hidden';
    }
  },

  bindAppEvents() {
    document.getElementById('logoutBtn').onclick = async (e) => {
      e.preventDefault();
      await this.api('/api/auth/logout', { method: 'POST' });
      window.location.href = '/login';
    };
    document.getElementById('userAvatar').onclick = () => {
      const dd = document.getElementById('userDropdown');
      dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
    };
    document.addEventListener('click', (e) => {
      if (!document.getElementById('userMenu').contains(e.target))
        document.getElementById('userDropdown').style.display = 'none';
    });
    document.getElementById('sidebarToggle').onclick = () => document.getElementById('sidebar').classList.toggle('collapsed');
    // Mobile menu toggle
    document.getElementById('mobileMenuBtn').onclick = () => {
      document.getElementById('sidebar').classList.toggle('open');
      document.getElementById('sidebarOverlay').classList.toggle('active');
    };
    document.getElementById('sidebarOverlay').onclick = () => {
      document.getElementById('sidebar').classList.remove('open');
      document.getElementById('sidebarOverlay').classList.remove('active');
    };
    document.getElementById('globalSearch').onkeydown = (e) => {
      if (e.key === 'Enter') { this.navigate('documents'); this.loadDocuments(e.target.value); }
    };
    document.getElementById('notificationBell').onclick = () => {
      if (this.currentPage === 'notifications') {
        this.navigate(this.previousPage || 'dashboard');
      } else {
        this.navigate('notifications');
      }
    };

    // Zoom controls
    document.getElementById('zoomInBtn').onclick = () => this.zoomIn();
    document.getElementById('zoomOutBtn').onclick = () => this.zoomOut();
    document.getElementById('zoomResetBtn').onclick = () => this.resetZoom();

    // Keyboard shortcuts for zoom (Ctrl + / Ctrl - / Ctrl 0)
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && (e.key === '=' || e.key === '+')) { e.preventDefault(); this.zoomIn(); }
      else if (e.ctrlKey && e.key === '-') { e.preventDefault(); this.zoomOut(); }
      else if (e.ctrlKey && e.key === '0') { e.preventDefault(); this.resetZoom(); }
    });
  },

  // ===== ZOOM =====
  setZoom(level) {
    this.zoomLevel = Math.min(this.zoomMax, Math.max(this.zoomMin, level));
    const area = document.getElementById('contentArea');
    if (area) {
      area.style.zoom = this.zoomLevel / 100;
    }
    const label = document.getElementById('zoomLevel');
    if (label) label.textContent = this.zoomLevel + '%';
  },
  zoomIn() { this.setZoom(this.zoomLevel + this.zoomStep); },
  zoomOut() { this.setZoom(this.zoomLevel - this.zoomStep); },
  resetZoom() { this.setZoom(100); },

  async updateNotifBadge() {
    try {
      const data = await this.api('/api/notifications/unread-count');
      const count = (data && data.count) || 0;
      const badge = document.getElementById('notifBadge');
      if (badge) {
        badge.textContent = count;
        badge.style.display = count > 0 ? 'flex' : 'none';
      }
      // Update sidebar badge for notifications
      const navBadges = document.querySelectorAll('.nav-item[data-page="notifications"] .badge');
      navBadges.forEach(b => {
        b.textContent = count;
        b.style.display = count > 0 ? '' : 'none';
      });
    } catch (e) { }
  },

  async updatePendingBadge() {
    try {
      const data = await this.api('/api/documents/pending-count');
      const count = (data && data.count) || 0;
      const navBadges = document.querySelectorAll('.nav-item[data-page="pending"] .badge');
      navBadges.forEach(b => {
        b.textContent = count;
        b.style.display = count > 0 ? 'inline-block' : 'none';
      });
    } catch (e) { }
  },

  async updateAccessReqBadge() {
    try {
      if (this.user && this.user.role !== 'admin') return;
      const data = await this.api('/api/access-requests/pending-count');
      const count = (data && data.count) || 0;
      const navBadges = document.querySelectorAll('.nav-item[data-page="access_requests"] .badge');
      navBadges.forEach(b => {
        b.textContent = count;
        b.style.display = count > 0 ? 'inline-block' : 'none';
      });
    } catch (e) { }
  },

  async updateBadges() {
    await Promise.all([
      this.updateNotifBadge(),
      this.updatePendingBadge(),
      this.updateAccessReqBadge()
    ]);
  },

  navigate(page) {
    if (this.currentPage && this.currentPage !== page && this.currentPage !== 'notifications') {
      this.previousPage = this.currentPage;
    }
    this.currentPage = page;
    document.querySelectorAll('.nav-item').forEach(i => i.classList.toggle('active', i.dataset.page === page));
    const bell = document.getElementById('notificationBell');
    if (bell) bell.classList.toggle('active', page === 'notifications');
    // Auto-close mobile sidebar
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('active');
    const labels = { dashboard: 'แดชบอร์ด', documents: 'เอกสาร', users: 'จัดการผู้ใช้', logs: 'ประวัติการใช้งาน', system: 'สถานะระบบ', upload: 'สร้างเอกสาร', reports: 'รายงาน', pending: 'รออนุมัติ', profile: 'ข้อมูลส่วนตัว', notifications: 'การแจ้งเตือน', access_requests: 'ขอสิทธิ์เอกสาร', my_logs: 'ประวัติการดำเนินการ', certificates: 'ใบรับรองดิจิทัล' };
    document.getElementById('breadcrumb').innerHTML = `<span>${labels[page] || page}</span>`;
    const loader = { dashboard: () => this.loadDashboard(), documents: () => this.loadDocuments(), users: () => this.loadUsers(), logs: () => this.loadLogs(), system: () => this.loadSystem(), upload: () => this.loadUploadForm(), reports: () => this.loadReports(), pending: () => this.loadPending(), profile: () => this.loadProfile(), notifications: () => this.loadNotifications(), access_requests: () => this.loadAccessRequests(), my_logs: () => this.loadMyLogs(), certificates: () => this.loadCertificates() };
    (loader[page] || loader.dashboard)();
  },

  // ===== DASHBOARD =====
  async loadDashboard() {
    const stats = await this.api('/api/stats');
    const area = document.getElementById('contentArea');
    const role = this.user.role;

    let cards = '';
    if (role === 'admin') {
      cards = `
        <div class="stat-card blue"><div class="stat-card-header"><div class="stat-card-icon"><i class="fas fa-file-alt"></i></div></div><div class="stat-card-value">${stats.totalDocuments}</div><div class="stat-card-label">เอกสารทั้งหมด</div></div>
        <div class="stat-card green"><div class="stat-card-header"><div class="stat-card-icon"><i class="fas fa-users"></i></div></div><div class="stat-card-value">${stats.totalUsers}</div><div class="stat-card-label">ผู้ใช้ทั้งหมด</div></div>
        <div class="stat-card orange"><div class="stat-card-header"><div class="stat-card-icon"><i class="fas fa-clock"></i></div></div><div class="stat-card-value">${stats.pendingApproval}</div><div class="stat-card-label">รออนุมัติ</div></div>
        <div class="stat-card purple"><div class="stat-card-header"><div class="stat-card-icon"><i class="fas fa-signature"></i></div></div><div class="stat-card-value">${stats.signed}</div><div class="stat-card-label">ลงนามแล้ว</div></div>
        ${stats.pendingAccessRequests ? `<div class="stat-card red"><div class="stat-card-header"><div class="stat-card-icon"><i class="fas fa-key"></i></div></div><div class="stat-card-value">${stats.pendingAccessRequests}</div><div class="stat-card-label">คำร้องรอดำเนินการ</div></div>` : ''}`;
    } else if (role === 'secretary') {
      cards = `
        <div class="stat-card blue"><div class="stat-card-header"><div class="stat-card-icon"><i class="fas fa-file-alt"></i></div></div><div class="stat-card-value">${stats.totalDocuments}</div><div class="stat-card-label">เอกสารทั้งหมด</div></div>
        <div class="stat-card orange"><div class="stat-card-header"><div class="stat-card-icon"><i class="fas fa-clock"></i></div></div><div class="stat-card-value">${stats.pendingApproval}</div><div class="stat-card-label">รออนุมัติ</div></div>
        <div class="stat-card green"><div class="stat-card-header"><div class="stat-card-icon"><i class="fas fa-check-circle"></i></div></div><div class="stat-card-value">${stats.approved}</div><div class="stat-card-label">อนุมัติแล้ว</div></div>
        <div class="stat-card red"><div class="stat-card-header"><div class="stat-card-icon"><i class="fas fa-file-circle-xmark"></i></div></div><div class="stat-card-value">${stats.draft}</div><div class="stat-card-label">ฉบับร่าง</div></div>`;
    } else if (role === 'executive') {
      cards = `
        <div class="stat-card blue"><div class="stat-card-header"><div class="stat-card-icon"><i class="fas fa-file-alt"></i></div></div><div class="stat-card-value">${stats.totalDocuments}</div><div class="stat-card-label">เอกสารทั้งหมด</div></div>
        <div class="stat-card orange"><div class="stat-card-header"><div class="stat-card-icon"><i class="fas fa-hourglass-half"></i></div></div><div class="stat-card-value">${stats.pendingApproval + stats.pendingSignature}</div><div class="stat-card-label">รอดำเนินการ</div></div>
        <div class="stat-card green"><div class="stat-card-header"><div class="stat-card-icon"><i class="fas fa-check-double"></i></div></div><div class="stat-card-value">${stats.approved}</div><div class="stat-card-label">อนุมัติแล้ว</div></div>
        <div class="stat-card cyan"><div class="stat-card-header"><div class="stat-card-icon"><i class="fas fa-pen-nib"></i></div></div><div class="stat-card-value">${stats.signed}</div><div class="stat-card-label">ลงนามแล้ว</div></div>`;
    } else {
      cards = `
        <div class="stat-card blue"><div class="stat-card-header"><div class="stat-card-icon"><i class="fas fa-file-alt"></i></div></div><div class="stat-card-value">${stats.totalDocuments}</div><div class="stat-card-label">เอกสารของฉัน</div></div>
        <div class="stat-card orange"><div class="stat-card-header"><div class="stat-card-icon"><i class="fas fa-clock"></i></div></div><div class="stat-card-value">${stats.pendingApproval}</div><div class="stat-card-label">รออนุมัติ</div></div>
        <div class="stat-card green"><div class="stat-card-header"><div class="stat-card-icon"><i class="fas fa-check-circle"></i></div></div><div class="stat-card-value">${stats.approved}</div><div class="stat-card-label">อนุมัติแล้ว</div></div>
        <div class="stat-card red"><div class="stat-card-header"><div class="stat-card-icon"><i class="fas fa-times-circle"></i></div></div><div class="stat-card-value">${stats.rejected}</div><div class="stat-card-label">ปฏิเสธ</div></div>`;
    }

    // Monthly chart data
    const monthNames = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    const monthlyEntries = Object.entries(stats.monthly || {});
    const maxMonthly = Math.max(...monthlyEntries.map(([, v]) => v), 1);
    const chartBars = monthlyEntries.map(([k, v]) => {
      const mon = parseInt(k.split('-')[1]) - 1;
      const pct = Math.round(v / maxMonthly * 100);
      return `<div class="chart-bar-wrap"><div class="chart-bar" style="height:${pct}%"><span>${v}</span></div><div class="chart-bar-label">${monthNames[mon]}</div></div>`;
    }).join('');

    // Category breakdown
    const catHtml = Object.entries(stats.categories || {}).map(([k, v]) =>
      `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border-color)"><span style="font-size:13px">${k}</span><strong style="font-size:13px">${v}</strong></div>`
    ).join('');

    const logIcons = { login: 'fa-sign-in-alt', logout: 'fa-sign-out-alt', upload: 'fa-upload', approve: 'fa-check', reject: 'fa-times', sign: 'fa-signature', view: 'fa-eye', submit: 'fa-paper-plane', create_user: 'fa-user-plus', update_user: 'fa-user-edit', delete_user: 'fa-user-minus', delete: 'fa-trash' };
    const logHtml = stats.recentLogs.map(l => `
      <div class="activity-item"><div class="activity-icon ${l.action}"><i class="fas ${logIcons[l.action] || 'fa-circle'}"></i></div>
      <div class="activity-content"><div class="activity-text"><strong>${l.userName}</strong> ${l.actionText}${l.targetName ? ` - ${l.targetName}` : ''}</div>
      <div class="activity-time">${new Date(l.timestamp).toLocaleString('th-TH')}</div></div></div>`).join('');

    // Quick Actions Banner
    let quickActions = '';
    if (role === 'admin') {
      quickActions = `
        <button class="btn btn-primary" onclick="App.navigate('users')"><i class="fas fa-user-plus"></i> จัดการผู้ใช้</button>
        <button class="btn btn-secondary" onclick="App.navigate('documents')"><i class="fas fa-folder-open"></i> เอกสารทั้งหมด</button>
        <button class="btn btn-outline" onclick="App.navigate('access_requests')"><i class="fas fa-key"></i> คำร้องขอสิทธิ์</button>
        <button class="btn btn-outline" onclick="App.navigate('logs')"><i class="fas fa-history"></i> ประวัติกิจกรรม</button>`;
    } else if (role === 'secretary') {
      quickActions = `
        <button class="btn btn-primary" onclick="App.navigate('upload')"><i class="fas fa-cloud-upload-alt"></i> สร้าง/อัปโหลดเอกสารใหม่</button>
        <button class="btn btn-secondary" onclick="App.navigate('documents')"><i class="fas fa-folder-open"></i> เอกสารทั้งหมด</button>
        <button class="btn btn-outline" onclick="App.navigate('reports')"><i class="fas fa-chart-bar"></i> ดูรายงานสรุป</button>`;
    } else if (role === 'executive') {
      quickActions = `
        <button class="btn btn-primary" onclick="App.navigate('pending')"><i class="fas fa-signature"></i> พิจารณาอนุมัติ/ลงนามเอกสาร (${stats.pendingApproval + stats.pendingSignature})</button>
        <button class="btn btn-secondary" onclick="App.navigate('documents')"><i class="fas fa-folder-open"></i> เอกสารทั้งหมด</button>
        <button class="btn btn-outline" onclick="App.navigate('certificates')"><i class="fas fa-certificate"></i> ใบรับรองดิจิทัล</button>`;
    } else {
      quickActions = `
        <button class="btn btn-secondary" onclick="App.navigate('documents')"><i class="fas fa-folder-open"></i> เอกสารของฉัน</button>
        <button class="btn btn-primary" onclick="App.navigate('access_requests')"><i class="fas fa-key"></i> ขอสิทธิ์เข้าถึงเอกสาร</button>
        <button class="btn btn-outline" onclick="App.navigate('profile')"><i class="fas fa-user-cog"></i> ข้อมูลส่วนตัว</button>`;
    }

    const welcomeBanner = `
      <div style="background: linear-gradient(135deg, var(--bg-card) 0%, rgba(59, 130, 246, 0.08) 100%); border: 1px solid var(--border-color); border-radius: 12px; padding: 20px; margin-bottom: 24px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
        <div>
          <h2 style="margin:0 0 6px 0; font-size: 20px; font-weight: 700; color: var(--text-main);"><i class="fas fa-hand-wave" style="color:var(--accent-orange)"></i> สวัสดีคุณ ${this.user.name}</h2>
          <p style="margin:0; font-size: 13px; color: var(--text-muted);">ยินดีต้อนรับสู่ระบบจัดการเอกสารดิจิทัล (DocMS) • บทบาท: <strong style="color:var(--accent-blue)">${this.user.roleName}</strong></p>
        </div>
        <div style="display: flex; gap: 10px; flex-wrap: wrap;">
          ${quickActions}
        </div>
      </div>`;

    area.innerHTML = `<div class="fade-in">
      ${welcomeBanner}
      <div class="stats-grid">${cards}</div>
      <div class="two-col">
        <div class="content-card"><div class="content-card-header"><h3><i class="fas fa-chart-bar" style="color:var(--accent-purple)"></i> เอกสารรายเดือน</h3></div>
        <div class="content-card-body"><div class="chart-container">${chartBars || '<p style="color:var(--text-muted)">ไม่มีข้อมูล</p>'}</div></div></div>
        <div class="content-card"><div class="content-card-header"><h3><i class="fas fa-tags" style="color:var(--accent-cyan)"></i> ตามหมวดหมู่</h3></div>
        <div class="content-card-body">${catHtml || '<p style="color:var(--text-muted)">ไม่มีข้อมูล</p>'}</div></div>
      </div>
      <div class="content-card"><div class="content-card-header"><h3><i class="fas fa-history"></i> กิจกรรมล่าสุด ${role !== 'admin' ? '(ที่เกี่ยวข้องกับคุณ)' : ''}</h3></div>
      <div class="content-card-body"><div class="activity-list">${logHtml || '<div class="empty-state"><i class="fas fa-inbox"></i><h4>ไม่มีกิจกรรม</h4></div>'}</div></div></div></div>`;

    this.updateBadges();
  },

  // ===== DOCUMENTS =====
  async loadDocuments(search) {
    const docs = await this.api(`/api/documents${search ? `?search=${encodeURIComponent(search)}` : ''}`);
    const area = document.getElementById('contentArea');
    const canCreate = ['secretary', 'admin'].includes(this.user.role);

    const statusMap = { draft: 'draft', pending_approval: 'pending', approved: 'approved', rejected: 'rejected', signed: 'signed', pending_signature: 'pending-sign' };
    const priorityIcons = { high: 'fa-arrow-up', medium: 'fa-minus', low: 'fa-arrow-down' };

    const rows = docs.map(d => `<tr>
      <td data-label="ชื่อเอกสาร"><strong style="cursor:pointer;color:var(--accent-blue)" onclick="App.viewDocument('${d.id}')">${d.title}</strong><br><span style="font-size:11px;color:var(--text-muted)">${d.category}</span></td>
      <td data-label="สถานะ"><span class="status-badge ${statusMap[d.status] || 'draft'}">${d.statusText}</span></td>
      <td data-label="ความสำคัญ"><span class="priority-badge ${d.priority}"><i class="fas ${priorityIcons[d.priority]}"></i> ${d.priority === 'high' ? 'สูง' : d.priority === 'medium' ? 'ปานกลาง' : 'ต่ำ'}</span></td>
      <td data-label="ผู้สร้าง">${d.uploadedByName}</td>
      <td data-label="วันที่">${new Date(d.createdAt).toLocaleDateString('th-TH')}</td>
      <td data-label="จัดการ"><div class="btn-group">
        <button class="btn-icon" onclick="App.viewDocument('${d.id}')" title="ดู"><i class="fas fa-eye"></i></button>
        ${d.fileName ? `<button class="btn-icon" onclick="App.${d.signatures && d.signatures.length ? 'downloadStampedPdf' : 'downloadDoc'}('${d.id}')" title="${d.signatures && d.signatures.length ? 'ดาวน์โหลด (พร้อมลายเซ็น)' : 'ดาวน์โหลด'}" style="color:var(--accent-green)"><i class="fas fa-download"></i></button>` : ''}
        ${this.getDocActions(d)}
      </div></td>
    </tr>`).join('');

    area.innerHTML = `<div class="fade-in">
      <div class="toolbar"><div class="toolbar-left">
        <div class="search-input"><i class="fas fa-search"></i><input placeholder="ค้นหาเอกสาร..." id="docSearch" value="${search || ''}"></div>
        <select class="filter-select" id="filterStatus"><option value="">สถานะทั้งหมด</option><option value="draft">ฉบับร่าง</option><option value="pending_approval">รออนุมัติ</option><option value="approved">อนุมัติแล้ว</option><option value="rejected">ปฏิเสธ</option><option value="signed">ลงนามแล้ว</option></select>
        <select class="filter-select" id="filterCategory"><option value="">หมวดหมู่ทั้งหมด</option><option value="บันทึกข้อความ">บันทึกข้อความ</option><option value="สัญญา">สัญญา</option><option value="รายงาน">รายงาน</option><option value="คำสั่ง">คำสั่ง</option><option value="ใบเสนอราคา">ใบเสนอราคา</option><option value="แผนงาน">แผนงาน</option><option value="ทั่วไป">ทั่วไป</option></select>
      </div>${canCreate ? '<button class="btn btn-primary" onclick="App.navigate(\'upload\')"><i class="fas fa-plus"></i> สร้างเอกสาร</button>' : ''}</div>
      <div class="content-card"><div class="content-card-body no-padding">
        ${docs.length ? `<table class="data-table"><thead><tr><th>ชื่อเอกสาร</th><th>สถานะ</th><th>ความสำคัญ</th><th>ผู้สร้าง</th><th>วันที่</th><th>จัดการ</th></tr></thead><tbody>${rows}</tbody></table>`
        : '<div class="empty-state"><i class="fas fa-folder-open"></i><h4>ไม่พบเอกสาร</h4><p>ยังไม่มีเอกสารในระบบ</p></div>'}
      </div></div></div>`;

    document.getElementById('docSearch').onkeydown = (e) => { if (e.key === 'Enter') this.loadDocuments(e.target.value); };
    const reloadDocs = () => {
      const s = document.getElementById('docSearch').value;
      const st = document.getElementById('filterStatus').value;
      const cat = document.getElementById('filterCategory').value;
      let qs = '';
      if (s) qs += `search=${encodeURIComponent(s)}&`;
      if (st) qs += `status=${st}&`;
      if (cat) qs += `category=${cat}&`;
      this.api(`/api/documents?${qs}`).then(() => this.loadDocuments(s));
    };
    document.getElementById('filterStatus').onchange = reloadDocs;
    document.getElementById('filterCategory').onchange = reloadDocs;
  },

  getDocActions(doc) {
    const r = this.user.role;
    let btns = '';
    
    let canApprove = false;
    if (doc.status === 'pending_approval' && doc.approvalWorkflow && doc.approvalWorkflow.length > 0) {
      const pendingStep = doc.approvalWorkflow.find(w => w.status === 'pending');
      if (pendingStep && pendingStep.role === r) canApprove = true;
    } else if (doc.status === 'pending_approval') {
      if (r === 'user' || r === 'executive' || r === 'admin') canApprove = true;
    }

    if ((r === 'secretary' || r === 'admin') && doc.status === 'draft') btns += `<button class="btn-icon" onclick="App.submitDoc('${doc.id}')" title="ส่งอนุมัติ"><i class="fas fa-paper-plane"></i></button>`;
    if (canApprove) {
      btns += `<button class="btn-icon" onclick="App.approveDoc('${doc.id}')" title="อนุมัติ" style="color:var(--accent-green)"><i class="fas fa-check"></i></button>`;
      btns += `<button class="btn-icon danger" onclick="App.rejectDoc('${doc.id}')" title="ปฏิเสธ"><i class="fas fa-times"></i></button>`;
    }
    if ((r === 'executive' || r === 'admin') && (doc.status === 'approved' || doc.status === 'pending_signature')) btns += `<button class="btn-icon" onclick="App.openSignModal('${doc.id}','${doc.title}')" title="ลงนาม" style="color:var(--accent-purple)"><i class="fas fa-signature"></i></button>`;
    if ((r === 'admin' || r === 'secretary') && (doc.status === 'draft' || doc.status === 'rejected')) btns += `<button class="btn-icon danger" onclick="App.deleteDoc('${doc.id}')" title="ลบ"><i class="fas fa-trash"></i></button>`;
    
    btns += `<button class="btn-icon" onclick="App.shareDoc('${doc.id}', '${doc.title.replace(/'/g, "\\'")}')" title="แชร์" style="color:var(--accent-blue)"><i class="fas fa-share-nodes"></i></button>`;
    return btns;
  },

  shareDoc(id, title) {
    const url = window.location.origin + window.location.pathname + '?doc=' + id;
    const shareData = {
      title: 'DocMS - ' + title,
      text: 'กรุณาตรวจสอบเอกสาร: ' + title,
      url: url
    };
    if (navigator.share) {
      navigator.share(shareData).catch((err) => {
        console.error('Error sharing:', err);
      });
    } else {
      navigator.clipboard.writeText(url).then(() => {
        this.toast('คัดลอกลิงก์สำหรับแชร์แล้ว', 'success');
      }).catch(() => {
        this.toast('ไม่สามารถคัดลอกลิงก์ได้', 'error');
      });
    }
  },

  async viewDocument(id) {
    window.history.pushState({ docId: id }, '', '?doc=' + id);
    const doc = await this.api(`/api/documents/${id}`);
    const statusMap = { draft: 'draft', pending_approval: 'pending', approved: 'approved', rejected: 'rejected', signed: 'signed', pending_signature: 'pending-sign' };
    const modal = document.getElementById('modal');
    const sigHtml = doc.signatures.length ? doc.signatures.map(s => {
      let deviceName = 'Unknown Device';
      if (s.userAgent) {
        if (s.userAgent.includes('iPhone')) deviceName = 'iPhone';
        else if (s.userAgent.includes('iPad')) deviceName = 'iPad';
        else if (s.userAgent.includes('Android')) deviceName = 'Android';
        else if (s.userAgent.includes('Mac OS')) deviceName = 'Mac';
        else if (s.userAgent.includes('Windows')) deviceName = 'Windows';
      }
      const auditTrail = s.ipAddress ? `<div style="margin-top:12px;padding:8px 12px;background:rgba(0,0,0,0.02);border-radius:6px;font-size:11px;color:var(--text-muted);border:1px solid rgba(0,0,0,0.05)"><div style="font-weight:600;margin-bottom:6px;color:var(--text-primary)">Audit Trail</div><div style="margin-bottom:4px"><span style="color:var(--accent-green)">●</span> อุปกรณ์ • ${deviceName}</div><div><span style="color:var(--accent-green)">●</span> ลงนาม • ${new Date(s.signedAt).toLocaleTimeString('th-TH', {hour:'2-digit', minute:'2-digit'})} • ${s.ipAddress}</div></div>` : '';
      return `
      <div class="signature-item" style="display:flex;flex-direction:column;padding:12px;background:var(--bg-input);border:1px solid var(--border-color);border-radius:var(--radius-sm);margin-bottom:8px">
        <div style="display:flex;align-items:center;justify-content:space-between">
          <div style="display:flex;align-items:center;gap:12px">
            ${s.signatureData && s.signatureData.startsWith('data:image') ? `<img src="${s.signatureData}" style="height:45px;max-width:120px;object-fit:contain;background:transparent;border-radius:4px;padding:2px;">` : `<div style="width:45px;height:45px;border-radius:6px;background:rgba(139,92,246,0.15);color:var(--accent-purple);display:flex;align-items:center;justify-content:center;font-size:20px"><i class="fas fa-signature"></i></div>`}
            <div class="signature-item-info">
              <div class="signature-item-name" style="font-weight:600;color:var(--text-primary)"><i class="fas fa-check-circle" style="color:var(--accent-green)"></i> ${s.signedByName}</div>
              <div class="signature-item-time" style="font-size:12px;color:var(--text-muted)"><i class="fas fa-clock"></i> ${new Date(s.signedAt).toLocaleString('th-TH')}</div>
              <div style="font-size:11px;color:var(--accent-blue)"><i class="fas fa-shield-alt"></i> ${s.certificateId || 'CERT-VERIFIED'}</div>
            </div>
          </div>
          <span class="status-badge signed" style="font-size:11px"><i class="fas fa-certificate"></i> ดิจิทัล</span>
        </div>
        ${auditTrail}
      </div>
    `}).join('') : '<p style="color:var(--text-muted);font-size:13px">ยังไม่มีลายเซ็น</p>';
    const commHtml = doc.comments.length ? doc.comments.map(c => `<div class="comment-item"><div class="comment-avatar"><i class="fas fa-user"></i></div><div class="comment-content"><div class="comment-name">${c.byName}</div><div class="comment-text">${c.text}</div><div class="comment-time">${new Date(c.at).toLocaleString('th-TH')}</div></div></div>`).join('') : '';

    // Comment input: show for users who have access (assigned) or admin/secretary
    const canComment = this.user.role === 'admin' || this.user.role === 'secretary' || doc.assignedTo.includes(this.user.id);
    const commentInput = canComment ? `
      <div class="comment-input-area" style="margin-top:16px">
        <h4 style="font-size:14px;margin-bottom:8px"><i class="fas fa-comment-dots" style="color:var(--accent-green)"></i> เพิ่มความคิดเห็น</h4>
        <div style="display:flex;gap:10px;align-items:flex-start">
          <textarea id="commentText" rows="2" placeholder="พิมพ์ความคิดเห็น..." style="flex:1;padding:10px 14px;background:var(--bg-input);border:1px solid var(--border-color);border-radius:var(--radius-sm);color:var(--text-primary);font-size:13px;font-family:inherit;resize:vertical"></textarea>
          <button class="btn btn-primary" onclick="App.addComment('${doc.id}')" style="height:fit-content"><i class="fas fa-paper-plane"></i> ส่ง</button>
        </div>
      </div>` : '';

    const downloadButtons = doc.fileStorageName ? `
      <div style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap">
        <button class="btn btn-secondary" onclick="App.viewPdf('${doc.id}')" style="background:linear-gradient(135deg,#3b82f6 0%,#6366f1 100%);color:#fff;border:none;box-shadow:0 4px 14px rgba(59,130,246,0.35)">
          <i class="fas fa-eye"></i> ดู PDF
        </button>
        <button class="btn btn-secondary" onclick="App.downloadDoc('${doc.id}')"><i class="fas fa-download"></i> ดาวน์โหลดต้นฉบับ</button>
        ${doc.signatures && doc.signatures.length ? `
          <button class="btn btn-primary" onclick="App.downloadStampedPdf('${doc.id}')" style="background:linear-gradient(135deg,#10b981 0%,#06b6d4 100%);border:none;box-shadow:0 4px 14px rgba(16,185,129,0.35)">
            <i class="fas fa-file-signature"></i> ดาวน์โหลด PDF พร้อมประทับลายเซ็นจริง ⭐
          </button>
        ` : ''}
      </div>
    ` : '';


    let workflowHtml = '';
    if (doc.approvalWorkflow && doc.approvalWorkflow.length > 0) {
      const stepsHtml = doc.approvalWorkflow.map((w, index) => {
        let statusBadge = '';
        let lineClass = '';
        if (w.status === 'approved') {
          statusBadge = `<span style="background:#e6f4ea;color:#137333;padding:4px 10px;border-radius:12px;font-size:11px;font-weight:600"><i class="fas fa-check"></i> อนุมัติแล้ว</span>`;
          lineClass = 'bg-green';
        } else if (w.status === 'rejected') {
          statusBadge = `<span style="background:#fce8e6;color:#c5221f;padding:4px 10px;border-radius:12px;font-size:11px;font-weight:600"><i class="fas fa-times"></i> ปฏิเสธ</span>`;
          lineClass = 'bg-red';
        } else {
          statusBadge = `<span style="background:#f1f3f4;color:#5f6368;padding:4px 10px;border-radius:12px;font-size:11px;font-weight:600">รออนุมัติ</span>`;
          lineClass = 'bg-gray';
        }
        const isLast = index === doc.approvalWorkflow.length - 1;
        return `
        <div style="display:flex;gap:16px;margin-bottom:12px;position:relative">
          ${!isLast ? `<div style="position:absolute;left:19px;top:38px;bottom:-20px;width:2px;background:#e8eaed;z-index:1"></div>` : ''}
          <div style="width:40px;display:flex;flex-direction:column;align-items:center">
            <div style="width:36px;height:36px;background:var(--bg-input);border:1px solid var(--border-color);border-radius:50%;display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:14px;position:relative;z-index:2"><i class="fas fa-user-tie"></i></div>
          </div>
          <div style="flex:1;background:var(--bg-input);border:1px solid var(--border-color);border-radius:8px;padding:12px;display:flex;justify-content:space-between;align-items:center;box-shadow:0 2px 4px rgba(0,0,0,0.02)">
            <div>
              <div style="font-weight:600;color:var(--text-primary);font-size:13px">${w.roleName}</div>
              <div style="color:var(--text-muted);font-size:12px;margin-top:2px">${w.name} ${w.timestamp ? `• ${new Date(w.timestamp).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'})}` : ''}</div>
            </div>
            <div>${statusBadge}</div>
          </div>
        </div>
        `;
      }).join('');
      workflowHtml = `<div style="margin-top:24px;background:#fffaf3;border:1px solid #fbe3d2;border-radius:12px;padding:20px"><h4 style="font-size:14px;margin-bottom:20px;color:var(--text-primary)"><i class="fas fa-route" style="color:var(--accent-orange)"></i> เส้นทางการอนุมัติ</h4>${stepsHtml}</div>`;
    }

    document.getElementById('modalContent').innerHTML = `
      <div class="modal-header"><h3><i class="fas fa-file-alt"></i> ${doc.title}</h3><button class="modal-close" onclick="document.getElementById('modal').style.display='none'"><i class="fas fa-times"></i></button></div>
      <div class="modal-body">
        <div class="doc-detail">
          <div class="doc-detail-item"><div class="doc-detail-label">หมวดหมู่</div><div class="doc-detail-value">${doc.category}</div></div>
          <div class="doc-detail-item"><div class="doc-detail-label">สถานะ</div><div class="doc-detail-value"><span class="status-badge ${statusMap[doc.status]}">${doc.statusText}</span></div></div>
          <div class="doc-detail-item"><div class="doc-detail-label">ผู้สร้าง</div><div class="doc-detail-value">${doc.uploadedByName}</div></div>
          <div class="doc-detail-item"><div class="doc-detail-label">วันที่สร้าง</div><div class="doc-detail-value">${new Date(doc.createdAt).toLocaleString('th-TH')}</div></div>
          <div class="doc-detail-item doc-detail-full"><div class="doc-detail-label">คำอธิบาย</div><div class="doc-detail-value">${doc.description}</div></div>
          ${doc.deadline ? `<div class="doc-detail-item"><div class="doc-detail-label">กำหนดส่ง</div><div class="doc-detail-value">${new Date(doc.deadline).toLocaleDateString('th-TH')}</div></div>` : ''}
          ${doc.expiryDate ? `<div class="doc-detail-item"><div class="doc-detail-label">วันหมดอายุ</div><div class="doc-detail-value" style="color:${new Date(doc.expiryDate) < new Date() ? 'var(--accent-red)' : 'var(--accent-orange)'}">${new Date(doc.expiryDate).toLocaleDateString('th-TH')}</div></div>` : ''}
          <div class="doc-detail-item"><div class="doc-detail-label">เวอร์ชัน</div><div class="doc-detail-value">v${doc.version || 1}</div></div>
          ${doc.fileName ? `<div class="doc-detail-item"><div class="doc-detail-label">ไฟล์</div><div class="doc-detail-value"><i class="fas fa-file-pdf" style="color:var(--accent-red)"></i> ${doc.fileName} (${(doc.fileSize / 1024 / 1024).toFixed(2)} MB)</div></div>` : ''}
        </div>
        ${downloadButtons}
        ${doc.versionHistory && doc.versionHistory.length ? `<div style="margin-top:16px"><h4 style="font-size:14px;margin-bottom:8px"><i class="fas fa-code-branch" style="color:var(--accent-orange)"></i> ประวัติเวอร์ชัน</h4>${doc.versionHistory.map(v => `<div style="padding:8px 12px;background:var(--bg-input);border-radius:var(--radius-sm);margin-bottom:6px;font-size:13px"><strong>v${v.version}</strong> — ${v.fileName} — ${new Date(v.uploadedAt).toLocaleString('th-TH')}</div>`).join('')}</div>` : ''}
        ${workflowHtml}
        <div style="margin-top:20px"><h4 style="font-size:14px;margin-bottom:8px"><i class="fas fa-signature" style="color:var(--accent-purple)"></i> ลายเซ็นที่ประทับลงในเอกสาร</h4>${sigHtml}</div>
        <div class="doc-comments" style="margin-top:16px"><h4 style="font-size:14px;margin-bottom:8px"><i class="fas fa-comments" style="color:var(--accent-cyan)"></i> ความคิดเห็น (${doc.comments.length})</h4>${commHtml || '<p style="color:var(--text-muted);font-size:13px">ยังไม่มีความคิดเห็น</p>'}</div>
        ${commentInput}
      </div>
      <div class="modal-footer">${this.getDocActions(doc) ? `<div class="btn-group">${this.getModalActions(doc)}</div>` : ''}<button class="btn btn-secondary" onclick="document.getElementById('modal').style.display='none'">ปิด</button></div>`;
    modal.style.display = 'flex';
  },

  async addComment(docId) {
    const text = document.getElementById('commentText').value.trim();
    if (!text) { this.toast('กรุณาพิมพ์ความคิดเห็น', 'error'); return; }
    const data = await this.api(`/api/documents/${docId}/comment`, { method: 'POST', body: { text } });
    if (data.error) { this.toast(data.error, 'error'); return; }
    this.toast('เพิ่มความคิดเห็นเรียบร้อย', 'success');
    this.viewDocument(docId);
  },

  getModalActions(doc) {
    const r = this.user.role;
    let btns = '';
    
    let canApprove = false;
    if (doc.status === 'pending_approval' && doc.approvalWorkflow && doc.approvalWorkflow.length > 0) {
      const pendingStep = doc.approvalWorkflow.find(w => w.status === 'pending');
      if (pendingStep && pendingStep.role === r) canApprove = true;
    } else if (doc.status === 'pending_approval') {
      if (r === 'user' || r === 'executive' || r === 'admin') canApprove = true;
    }

    if ((r === 'secretary' || r === 'admin') && doc.status === 'draft') btns += `<button class="btn btn-primary" onclick="App.submitDoc('${doc.id}')"><i class="fas fa-paper-plane"></i> ส่งอนุมัติ</button>`;
    if (canApprove) {
      btns += `<button class="btn btn-success" onclick="App.approveDoc('${doc.id}')"><i class="fas fa-check"></i> อนุมัติ</button>`;
      btns += `<button class="btn btn-danger" onclick="App.rejectDoc('${doc.id}')"><i class="fas fa-times"></i> ปฏิเสธ</button>`;
    }
    if ((r === 'executive' || r === 'admin') && (doc.status === 'approved' || doc.status === 'pending_signature')) btns += `<button class="btn btn-primary" onclick="App.openSignModal('${doc.id}','${doc.title}')"><i class="fas fa-signature"></i> ลงนาม</button>`;
    
    btns += `<button class="btn btn-secondary" onclick="App.shareDoc('${doc.id}', '${doc.title.replace(/'/g, "\\'")}')"><i class="fas fa-share-nodes"></i> แชร์</button>`;
    
    return btns;
  },

  async submitDoc(id) {
    const data = await this.api(`/api/documents/${id}/submit`, { method: 'PUT' });
    if (data.error) { this.toast(data.error, 'error'); return; }
    this.toast('ส่งเอกสารเพื่ออนุมัติแล้ว', 'success');
    document.getElementById('modal').style.display = 'none';
    this.updateBadges();
    this.navigate(this.currentPage);
  },
  approveDoc(id) {
    const modal = document.getElementById('modal');
    modal.innerHTML = `
    <div class="modal-overlay" onclick="App.closeModal()">
      <div class="modal-content" onclick="event.stopPropagation()" style="max-width:450px">
        <div class="modal-header">
          <h3><i class="fas fa-check-circle" style="color:var(--accent-green)"></i> อนุมัติเอกสาร</h3>
          <button class="modal-close" onclick="App.closeModal()">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group" style="margin-bottom:14px;">
            <label style="font-weight:600;font-size:13px;display:block;margin-bottom:6px;">ความคิดเห็นเพิ่มเติม (ถ้ามี)</label>
            <textarea id="approveCommentInput" rows="2" placeholder="ระบุข้อความหรือความคิดเห็นในการอนุมัติ..." style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--border-color);background:var(--bg-input);color:var(--text-primary);font-size:14px;resize:vertical;"></textarea>
          </div>
          <div class="form-group" style="margin-bottom:20px;">
            <label style="font-weight:600;font-size:13px;display:flex;align-items:center;gap:6px;"><i class="fas fa-key" style="color:var(--accent-blue)"></i> ยืนยันรหัส PIN 4-6 หลัก *</label>
            <input type="password" id="approvePinInput" maxlength="6" pattern="[0-9]{4,6}" placeholder="กรอกรหัส PIN ยืนยันการอนุมัติ" style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--border-color);background:var(--bg-input);color:var(--text-primary);font-size:16px;letter-spacing:4px;margin-top:4px;">
          </div>
          <div id="approveErrorBox" style="display:none;background:rgba(239,68,68,0.1);border:1px solid var(--accent-red);border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:13px;color:var(--accent-red);"></div>
          <div style="display:flex;gap:10px;justify-content:flex-end;">
            <button class="btn btn-secondary" onclick="App.closeModal()">ยกเลิก</button>
            <button class="btn btn-success" id="confirmApproveBtn"><i class="fas fa-check"></i> ยืนยันอนุมัติ</button>
          </div>
        </div>
      </div>
    </div>`;
    modal.style.display = 'block';

    document.getElementById('confirmApproveBtn').onclick = async () => {
      const comment = document.getElementById('approveCommentInput').value.trim();
      const pin = document.getElementById('approvePinInput').value.trim();
      const errBox = document.getElementById('approveErrorBox');
      errBox.style.display = 'none';

      if (!pin) {
        errBox.innerHTML = '<i class="fas fa-exclamation-circle"></i> กรุณากรอกรหัส PIN ยืนยันตัวตน';
        errBox.style.display = 'block';
        return;
      }

      const btn = document.getElementById('confirmApproveBtn');
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> กำลังดำเนินการ...';

      const data = await this.api(`/api/documents/${id}/approve`, { method: 'PUT', body: { comment, pin } });

      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-check"></i> ยืนยันอนุมัติ';

      if (data.error) {
        // แสดง error ใน modal โดยตรง
        if (data.error.includes('PIN') && data.error.includes('ยังไม่ได้ตั้งค่า')) {
          errBox.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${data.error} <a href="#" onclick="App.closeModal();App.navigate('profile')" style="color:var(--accent-blue);text-decoration:underline;margin-left:6px;">ไปตั้งค่า PIN</a>`;
        } else {
          errBox.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${data.error}`;
        }
        errBox.style.display = 'block';
        this.toast(data.error, 'error');
        return;
      }
      const msg = data.message || (data.isFullyApproved ? 'อนุมัติเอกสารเรียบร้อย' : 'อนุมัติขั้นตอนเรียบร้อยแล้ว (ส่งต่อขั้นตอนถัดไปในสายงาน)');
      this.toast(msg, 'success');
      this.closeModal();
      this.updateBadges();
      this.navigate(this.currentPage);
    };
  },
  rejectDoc(id) {
    const modal = document.getElementById('modal');
    modal.innerHTML = `
    <div class="modal-overlay" onclick="App.closeModal()">
      <div class="modal-content" onclick="event.stopPropagation()" style="max-width:450px">
        <div class="modal-header">
          <h3><i class="fas fa-times-circle" style="color:var(--accent-red)"></i> ปฏิเสธเอกสาร</h3>
          <button class="modal-close" onclick="App.closeModal()">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group" style="margin-bottom:20px;">
            <label style="font-weight:600;font-size:13px;display:block;margin-bottom:8px;">ระบุเหตุผลที่ปฏิเสธ *</label>
            <textarea id="rejectCommentInput" rows="3" placeholder="ระบุสาเหตุที่ปฏิเสธเอกสารฉบับนี้..." style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--border-color);background:var(--bg-input);color:var(--text-primary);font-size:14px;resize:vertical;"></textarea>
          </div>
          <div style="display:flex;gap:10px;justify-content:flex-end;">
            <button class="btn btn-secondary" onclick="App.closeModal()">ยกเลิก</button>
            <button class="btn btn-danger" id="confirmRejectBtn"><i class="fas fa-times"></i> ยืนยันปฏิเสธ</button>
          </div>
        </div>
      </div>
    </div>`;
    modal.style.display = 'block';

    document.getElementById('confirmRejectBtn').onclick = async () => {
      const comment = document.getElementById('rejectCommentInput').value.trim();
      if (!comment) {
        this.toast('กรุณาระบุเหตุผลที่ปฏิเสธ', 'error');
        return;
      }
      const data = await this.api(`/api/documents/${id}/reject`, { method: 'PUT', body: { comment } });
      if (data.error) { this.toast(data.error, 'error'); return; }
      this.toast('ปฏิเสธเอกสารแล้ว', 'error');
      this.closeModal();
      this.updateBadges();
      this.navigate(this.currentPage);
    };
  },
  async deleteDoc(id) {
    if (!confirm('ยืนยันการลบเอกสาร?')) return;
    await this.api(`/api/documents/${id}`, { method: 'DELETE' });
    this.toast('ลบเอกสารแล้ว', 'success');
    document.getElementById('modal').style.display = 'none';
    this.updateBadges();
    this.navigate(this.currentPage);
  },
  async downloadDoc(id) {
    try {
      const res = await fetch(`/api/documents/${id}/download`);
      if (!res.ok) {
        const data = await res.json();
        this.toast(data.error || 'ไม่สามารถดาวน์โหลดได้', 'error');
        return;
      }
      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition');
      let filename = 'document.pdf';
      if (disposition) {
        const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (match) filename = decodeURIComponent(match[1].replace(/['"]/g, ''));
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(url);
      this.toast('ดาวน์โหลดเรียบร้อย', 'success');
    } catch (e) {
      this.toast('เกิดข้อผิดพลาดในการดาวน์โหลด', 'error');
    }
  },

  async viewPdf(id) {
    try {
      this.toast('กำลังโหลด PDF...', 'info');
      const res = await fetch(`/api/documents/${id}/download`);
      if (!res.ok) {
        const data = await res.json();
        this.toast(data.error || 'ไม่สามารถโหลดไฟล์ได้', 'error');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      // เปิด PDF ใน tab ใหม่
      const newTab = window.open(url, '_blank');
      if (!newTab) {
        this.toast('กรุณาอนุญาต popup ในเบราว์เซอร์ก่อน', 'error');
        URL.revokeObjectURL(url);
        return;
      }
      // รอ tab โหลดเสร็จแล้วค่อย revoke URL (5 วินาที)
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e) {
      console.error('View PDF Error:', e);
      this.toast('เกิดข้อผิดพลาดในการเปิดไฟล์', 'error');
    }
  },

  // Create High-DPI Digital Stamp Canvas Image
  async createSignatureStampImage(sig) {
    return new Promise((resolve, reject) => {
      try {
        const scale = 2;
        const w = 180 * scale;
        const h = 100 * scale;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');

        const finishStamp = () => {
          try {
            ctx.fillStyle = '#1e293b'; // dark slate
            ctx.textAlign = 'center';
            ctx.font = `${10 * scale}px 'Noto Sans Thai', 'Inter', sans-serif`;
            
            // Name
            ctx.fillText(`( ${sig.signedByName || 'ผู้มีอำนาจลงนาม'} )`, w / 2, h - 22 * scale);
            
            // Role/Position
            if (sig.roleName) {
              ctx.font = `${9 * scale}px 'Noto Sans Thai', 'Inter', sans-serif`;
              ctx.fillText(`ตำแหน่ง: ${sig.roleName}`, w / 2, h - 6 * scale);
            }

            resolve(canvas.toDataURL('image/png'));
          } catch (e) {
            reject(e);
          }
        };

        if (sig.signatureData && sig.signatureData.startsWith('data:image')) {
          const sigImg = new Image();
          sigImg.onload = () => {
            try {
              // Draw signature image above the text
              const imgW = 160 * scale;
              const imgH = 65 * scale;
              const imgX = (w - imgW) / 2;
              const imgY = 2 * scale;
              ctx.drawImage(sigImg, imgX, imgY, imgW, imgH);
              finishStamp();
            } catch (e) {
              finishStamp();
            }
          };
          sigImg.onerror = () => {
            finishStamp();
          };
          sigImg.src = sig.signatureData;
        } else {
          finishStamp();
        }
      } catch (e) {
        reject(e);
      }
    });
  },

  async downloadStampedPdf(id) {
    try {
      this.toast('กำลังประมวลผลประทับลายเซ็นลงบน PDF...', 'info');
      const doc = await this.api(`/api/documents/${id}`);
      if (!doc || !doc.fileStorageName) {
        this.toast('ไม่พบไฟล์เอกสาร', 'error');
        return;
      }

      if (typeof PDFLib === 'undefined' || !doc.signatures || !doc.signatures.length) {
        return this.downloadDoc(id);
      }

      const res = await fetch(`/api/documents/${id}/download`);
      if (!res.ok) throw new Error('Download failed');
      const existingPdfBytes = await res.arrayBuffer();

      const pdfDoc = await PDFLib.PDFDocument.load(existingPdfBytes);
      const pages = pdfDoc.getPages();
      
      let fallbackY = 25; // Track fallback Y for legacy signatures

      for (let i = 0; i < doc.signatures.length; i++) {
        const sig = doc.signatures[i];
        const stampDataUrl = await this.createSignatureStampImage(sig);
        // แปลง data URL → Uint8Array โดยตรง (ไม่ใช้ fetch เพื่อหลีกเลี่ยง browser compatibility issues)
        const base64Data = stampDataUrl.split(',')[1];
        const binaryStr = atob(base64Data);
        const stampPngBytes = new Uint8Array(binaryStr.length);
        for (let j = 0; j < binaryStr.length; j++) stampPngBytes[j] = binaryStr.charCodeAt(j);
        const stampImage = await pdfDoc.embedPng(stampPngBytes);

        const pageNum = (sig.pageNumber && sig.pageNumber <= pages.length && sig.pageNumber > 0) ? sig.pageNumber : pages.length;
        const targetPage = pages[pageNum - 1];
        const { width, height } = targetPage.getSize();

        let stampWidth = sig.width || 210;
        let stampHeight = sig.height || 88;
        let xPos = 0, yPos = 0;
        
        if (sig.posX !== undefined && sig.posY !== undefined && sig.pageNumber) {
          xPos = sig.posX;
          // PDF-Lib uses bottom-left origin. Convert from UI top-left origin.
          yPos = height - sig.posY - stampHeight;
        } else {
          xPos = width - stampWidth - 25;
          yPos = fallbackY;
          fallbackY += (stampHeight + 12);
        }

        targetPage.drawImage(stampImage, {
          x: xPos,
          y: yPos,
          width: stampWidth,
          height: stampHeight
        });
      }

      const stampedPdfBytes = await pdfDoc.save();
      const blob = new Blob([stampedPdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `[Signed]_${doc.fileName || 'document.pdf'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      this.toast('ดาวน์โหลด PDF พร้อมประทับตราและลายเซ็นจริงสำเร็จ!', 'success');
    } catch (err) {
      console.error('PDF Stamp Error:', err);
      this.toast('เกิดข้อผิดพลาด กำลังดาวน์โหลดไฟล์ต้นฉบับแทน', 'info');
      this.downloadDoc(id);
    }
  },

  // ===== E-SIGNATURE =====
  signCtx: null, signDocId: null, signing: false,
  signPdfDoc: null, signPdfPageNum: 1, signPdfViewport: null,
  signDragState: { isDragging: false, startX: 0, startY: 0, elX: 0, elY: 0 },
  async openSignModal(id, title) {
    this.signDocId = id;
    document.getElementById('signDocTitle').textContent = `เอกสาร: ${title}`;
    const pinInput = document.getElementById('signPinInput');
    if (pinInput) pinInput.value = '';
    
    document.getElementById('signModal').style.display = 'flex';
    document.getElementById('modal').style.display = 'none';
    const canvas = document.getElementById('signatureCanvas');
    this.signCtx = canvas.getContext('2d');
    this.signCtx.clearRect(0, 0, canvas.width, canvas.height); // Make transparent
    this.signCtx.strokeStyle = '#1a1a2e'; this.signCtx.lineWidth = 2; this.signCtx.lineCap = 'round';
    this.signing = false;

    // Reset Drag state & UI
    const dragEl = document.getElementById('draggableSignature');
    const dragImg = document.getElementById('dragSigImage');
    dragEl.style.display = 'none';
    dragEl.style.transform = 'none'; // remove center transform
    dragEl.style.left = '10px'; dragEl.style.top = '10px';
    dragImg.src = '';

    let currentSigMode = 'draw';
    let savedSignatureDataUrl = null;

    const updateDragImage = () => {
      if (currentSigMode !== 'draw') return;
      // Check if canvas is entirely transparent
      const isBlank = !this.signCtx.getImageData(0, 0, canvas.width, canvas.height).data.some(channel => channel !== 0);
      if (isBlank) {
        dragEl.style.display = 'none';
        return;
      }
      const dataUrl = canvas.toDataURL();
      dragImg.src = dataUrl;
      dragEl.style.display = 'block';
    };

    // Mode Switch UI
    const btnDraw = document.getElementById('btnModeDraw');
    const btnSaved = document.getElementById('btnModeSaved');
    const secDraw = document.getElementById('sectionDrawSig');
    const secSaved = document.getElementById('sectionSavedSig');
    const stateEl = document.getElementById('savedSignatureState');
    const imgEl = document.getElementById('savedSignatureImg');
    const container = document.getElementById('savedSignatureContainer');

    const updateModeUI = () => {
      if (currentSigMode === 'draw') {
        if(btnDraw) btnDraw.classList.replace('btn-outline', 'btn-primary');
        if(btnSaved) btnSaved.classList.replace('btn-primary', 'btn-outline');
        if(secDraw) secDraw.style.display = 'block';
        if(secSaved) secSaved.style.display = 'none';
        updateDragImage();
      } else {
        if(btnSaved) btnSaved.classList.replace('btn-outline', 'btn-primary');
        if(btnDraw) btnDraw.classList.replace('btn-primary', 'btn-outline');
        if(secDraw) secDraw.style.display = 'none';
        if(secSaved) secSaved.style.display = 'block';
        if (savedSignatureDataUrl) {
          dragImg.src = savedSignatureDataUrl;
          dragEl.style.display = 'block';
        } else {
          dragEl.style.display = 'none';
          dragImg.src = '';
        }
      }
    };

    if (btnDraw) btnDraw.onclick = () => { currentSigMode = 'draw'; updateModeUI(); };
    if (btnSaved) btnSaved.onclick = () => { currentSigMode = 'saved'; updateModeUI(); };

    // Fetch saved signature
    this.api(`/api/signatures/${this.user.id}`).then(res => {
      if (res && res.exists && res.signature && res.signature.signatureData) {
        savedSignatureDataUrl = res.signature.signatureData;
        if(stateEl) stateEl.style.display = 'none';
        if(imgEl) { imgEl.src = savedSignatureDataUrl; imgEl.style.display = 'block'; }
      } else {
        if(stateEl) stateEl.innerHTML = 'ยังไม่มีลายเซ็นที่บันทึกไว้';
      }
    }).catch(err => {
      if(stateEl) stateEl.innerHTML = 'โหลดข้อมูลไม่สำเร็จ';
    });

    if (container) {
      container.onclick = () => {
        if (savedSignatureDataUrl) {
          dragImg.src = savedSignatureDataUrl;
          dragEl.style.display = 'block';
          this.toast('นำลายเซ็นที่บันทึกไว้มาใช้งานแล้ว', 'success');
        }
      };
    }

    const saveBtn = document.getElementById('saveProfileSigBtn');
    if (saveBtn) {
      saveBtn.onclick = async () => {
        const isBlank = !this.signCtx.getImageData(0, 0, canvas.width, canvas.height).data.some(channel => channel !== 0);
        if (isBlank) return this.toast('กรุณาวาดลายเซ็นก่อนบันทึก', 'error');
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> กำลังบันทึก...';
        const dataUrl = canvas.toDataURL();
        const res = await this.api('/api/signatures/upload', { method: 'POST', body: { signatureData: dataUrl } });
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> บันทึกเก็บไว้';
        if (res.error) return this.toast(res.error, 'error');
        this.toast('บันทึกลายเซ็นเข้าโปรไฟล์เรียบร้อย', 'success');
        savedSignatureDataUrl = dataUrl;
        if(stateEl) stateEl.style.display = 'none';
        if(imgEl) { imgEl.src = dataUrl; imgEl.style.display = 'block'; }
      };
    }

    const getPos = (e) => {
      const r = canvas.getBoundingClientRect();
      const t = e.touches ? e.touches[0] : e;
      return { x: t.clientX - r.left, y: t.clientY - r.top };
    };
    canvas.onmousedown = canvas.ontouchstart = (e) => { e.preventDefault(); this.signing = true; const p = getPos(e); this.signCtx.beginPath(); this.signCtx.moveTo(p.x, p.y); };
    canvas.onmousemove = canvas.ontouchmove = (e) => { if (!this.signing) return; e.preventDefault(); const p = getPos(e); this.signCtx.lineTo(p.x, p.y); this.signCtx.stroke(); };
    canvas.onmouseup = canvas.ontouchend = () => { this.signing = false; updateDragImage(); };
    canvas.onmouseleave = () => { if (this.signing) { this.signing = false; updateDragImage(); } };

    document.getElementById('clearSignature').onclick = () => { 
      this.signCtx.clearRect(0, 0, canvas.width, canvas.height);
      dragEl.style.display = 'none';
      dragImg.src = '';
    };

    // Load PDF
    const pdfCanvas = document.getElementById('signPdfCanvas');
    const loadingEl = document.getElementById('signPdfLoading');
    loadingEl.style.display = 'block';
    pdfCanvas.style.display = 'none';
    
    try {
      const res = await fetch(`/api/documents/${id}/download`);
      if (!res.ok) throw new Error('Cannot load PDF');
      const pdfBytes = await res.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: pdfBytes });
      this.signPdfDoc = await loadingTask.promise;
      this.signPdfPageNum = 1;
      document.getElementById('signPageCount').textContent = this.signPdfDoc.numPages;
      await this.renderSignPdfPage();
      loadingEl.style.display = 'none';
      pdfCanvas.style.display = 'block';
    } catch (e) {
      console.error(e);
      loadingEl.innerHTML = '<i class="fas fa-exclamation-triangle"></i> ไม่สามารถโหลด PDF ได้';
    }

    // PDF Pagination
    document.getElementById('signPrevPage').onclick = () => {
      if (this.signPdfPageNum <= 1) return;
      this.signPdfPageNum--;
      this.renderSignPdfPage();
    };
    document.getElementById('signNextPage').onclick = () => {
      if (this.signPdfPageNum >= this.signPdfDoc.numPages) return;
      this.signPdfPageNum++;
      this.renderSignPdfPage();
    };

    // Draggable Logic
    const viewerContainer = document.getElementById('pdfViewerContainer');
    const dragStart = (e) => {
      if (e.target.closest('#draggableSignature')) {
        this.signDragState.isDragging = true;
        const t = e.touches ? e.touches[0] : e;
        this.signDragState.startX = t.clientX;
        this.signDragState.startY = t.clientY;
        this.signDragState.elX = dragEl.offsetLeft;
        this.signDragState.elY = dragEl.offsetTop;
        e.preventDefault();
      }
    };
    const dragMove = (e) => {
      if (!this.signDragState.isDragging) return;
      const t = e.touches ? e.touches[0] : e;
      const dx = t.clientX - this.signDragState.startX;
      const dy = t.clientY - this.signDragState.startY;
      dragEl.style.left = (this.signDragState.elX + dx) + 'px';
      dragEl.style.top = (this.signDragState.elY + dy) + 'px';
      e.preventDefault();
    };
    const dragEnd = () => { this.signDragState.isDragging = false; };
    
    viewerContainer.onmousedown = viewerContainer.ontouchstart = dragStart;
    window.onmousemove = window.ontouchmove = dragMove;
    window.onmouseup = window.ontouchend = dragEnd;

    document.getElementById('confirmSignature').onclick = async () => {
      const pinVal = pinInput ? pinInput.value.trim() : '';
      if (!pinVal) {
        this.toast('กรุณากรอกรหัส PIN ยืนยันตัวตนก่อนลงนาม', 'error');
        return;
      }
      if (!dragImg.src || dragEl.style.display === 'none') {
        this.toast('กรุณาวาดลายเซ็นก่อน', 'error');
        return;
      }

      // --- Calculate coordinates in PDF points ---
      // Use getBoundingClientRect() which gives ACTUAL rendered position (handles transforms, scroll)
      const pdfRect = pdfCanvas.getBoundingClientRect();
      const dragRect = dragEl.getBoundingClientRect();

      // Position of drag element's top-left corner relative to the PDF canvas
      const xPx = dragRect.left - pdfRect.left;
      const yPx = dragRect.top  - pdfRect.top;

      // Convert screen pixels → PDF points using page's unscaled dimensions
      const vpScale = this.signPdfViewport ? this.signPdfViewport.scale : 1;
      const pageWidthPt  = this.signPdfViewport ? this.signPdfViewport.width  / vpScale : pdfRect.width;
      const pageHeightPt = this.signPdfViewport ? this.signPdfViewport.height / vpScale : pdfRect.height;

      const pdfX = (xPx / pdfRect.width)  * pageWidthPt;
      const pdfY = (yPx / pdfRect.height) * pageHeightPt;

      // Stamp size in PDF points (draggable element = 180×75 CSS px)
      const stampWPt = (180 / pdfRect.width)  * pageWidthPt;
      const stampHPt = (100 / pdfRect.height) * pageHeightPt;

      const btn = document.getElementById('confirmSignature');
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> กำลังบันทึก...';
      const data = currentSigMode === 'draw' ? canvas.toDataURL() : savedSignatureDataUrl;
      
      // Generate the full stamp card (with name, date, cert)
      let stampDataUrl = data;
      try {
        stampDataUrl = await this.createSignatureStampImage({
          signatureData: data,
          signedByName: this.user.name,
          roleName: this.user.roleName,
          signedAt: new Date().toISOString()
        });
      } catch(e) { console.error('Error generating stamp', e); }

      const res = await this.api(`/api/documents/${this.signDocId}/sign`, { 
        method: 'PUT', 
        body: { 
          signatureData: data, 
          stampDataUrl: stampDataUrl,
          pin: pinVal,
          pageNumber: this.signPdfPageNum,
          posX: pdfX,
          posY: pdfY,
          width: stampWPt,
          height: stampHPt
        } 
      });
      
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-check"></i> ยืนยันลงนาม';

      if (res.error) {
        this.toast(res.error, 'error');
        return;
      }
      document.getElementById('signModal').style.display = 'none';
      window.onmousemove = null;
      window.onmouseup = null;
      this.toast('ลงนามเอกสารเรียบร้อย', 'success');
      this.navigate(this.currentPage);
    };
    
    document.getElementById('closeSignModal').onclick = () => { 
      document.getElementById('signModal').style.display = 'none';
      window.onmousemove = null;
      window.onmouseup = null;
    };
  },

  async renderSignPdfPage() {
    if (!this.signPdfDoc) return;
    document.getElementById('signPageNum').textContent = this.signPdfPageNum;
    const page = await this.signPdfDoc.getPage(this.signPdfPageNum);
    
    const canvas = document.getElementById('signPdfCanvas');
    const ctx = canvas.getContext('2d');
    
    const containerWidth = document.getElementById('pdfViewerContainer').clientWidth - 20;
    const unscaledViewport = page.getViewport({ scale: 1.0 });
    const scale = Math.min(1.5, containerWidth / unscaledViewport.width);
    
    const viewport = page.getViewport({ scale });
    this.signPdfViewport = viewport;
    
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    
    const renderContext = { canvasContext: ctx, viewport: viewport };
    await page.render(renderContext).promise;
  },

  // ===== UPLOAD / CREATE DOC =====
  loadUploadForm() {
    const area = document.getElementById('contentArea');
    area.innerHTML = `<div class="fade-in"><div class="content-card"><div class="content-card-header"><h3><i class="fas fa-cloud-upload-alt"></i> สร้างเอกสารใหม่</h3></div><div class="content-card-body">
      <form id="docForm" enctype="multipart/form-data">
        <div class="doc-detail">
          <div class="doc-detail-item doc-detail-full form-group"><label>ชื่อเอกสาร *</label><input type="text" id="docTitle" required placeholder="กรอกชื่อเอกสาร"></div>
          <div class="doc-detail-item doc-detail-full form-group"><label>คำอธิบาย</label><textarea id="docDesc" rows="3" placeholder="รายละเอียดเอกสาร"></textarea></div>
          <div class="doc-detail-item doc-detail-full form-group"><label><i class="fas fa-file-pdf" style="color:var(--accent-red)"></i> ไฟล์ PDF</label>
            <div class="file-upload-area" id="fileUploadArea">
              <i class="fas fa-cloud-upload-alt"></i>
              <p>คลิกเพื่อเลือกไฟล์ PDF หรือลากวาง</p>
              <p style="font-size:11px;color:var(--text-muted)">ขนาดสูงสุด 50 MB</p>
              <input type="file" id="docFile" accept=".pdf" style="display:none">
              <span id="fileName" style="color:var(--accent-green);font-size:13px;margin-top:8px"></span>
            </div>
          </div>
          <div class="doc-detail-item form-group"><label>หมวดหมู่</label><select id="docCategory"><option>บันทึกข้อความ</option><option>สัญญา</option><option>รายงาน</option><option>คำสั่ง</option><option>ใบเสนอราคา</option><option>แผนงาน</option><option>ทั่วไป</option></select></div>
          <div class="doc-detail-item form-group"><label>ความสำคัญ</label><select id="docPriority"><option value="low">ต่ำ</option><option value="medium" selected>ปานกลาง</option><option value="high">สูง</option></select></div>
          <div class="doc-detail-item form-group"><label>กำหนดส่ง</label><input type="date" id="docDeadline"></div>
          <div class="doc-detail-item form-group"><label>วันหมดอายุ</label><input type="date" id="docExpiry"></div>
        </div>
        <div style="margin-top:20px;display:flex;gap:10px;justify-content:flex-end">
          <button type="button" class="btn btn-secondary" onclick="App.navigate('documents')">ยกเลิก</button>
          <button type="submit" class="btn btn-primary"><i class="fas fa-save"></i> บันทึกเอกสาร</button>
        </div>
      </form></div></div></div>`;

    // File upload area click & drag
    const uploadArea = document.getElementById('fileUploadArea');
    const fileInput = document.getElementById('docFile');
    uploadArea.onclick = () => fileInput.click();
    fileInput.onchange = () => { if (fileInput.files[0]) document.getElementById('fileName').textContent = '📄 ' + fileInput.files[0].name; };
    uploadArea.ondragover = (e) => { e.preventDefault(); uploadArea.style.borderColor = 'var(--accent-blue)'; };
    uploadArea.ondragleave = () => { uploadArea.style.borderColor = ''; };
    uploadArea.ondrop = (e) => { e.preventDefault(); uploadArea.style.borderColor = ''; if (e.dataTransfer.files[0]) { fileInput.files = e.dataTransfer.files; document.getElementById('fileName').textContent = '📄 ' + e.dataTransfer.files[0].name; } };

    document.getElementById('docForm').onsubmit = async (e) => {
      e.preventDefault();
      const formData = new FormData();
      formData.append('title', document.getElementById('docTitle').value);
      formData.append('description', document.getElementById('docDesc').value);
      formData.append('category', document.getElementById('docCategory').value);
      formData.append('priority', document.getElementById('docPriority').value);
      const deadline = document.getElementById('docDeadline').value;
      if (deadline) formData.append('deadline', new Date(deadline).toISOString());
      const expiry = document.getElementById('docExpiry').value;
      if (expiry) formData.append('expiryDate', new Date(expiry).toISOString());
      const fileInput = document.getElementById('docFile');
      if (fileInput.files[0]) formData.append('file', fileInput.files[0]);

      const res = await fetch('/api/documents', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.error) { this.toast(data.error, 'error'); return; }
      this.toast('สร้างเอกสารเรียบร้อย', 'success');
      this.navigate('documents');
    };
  },

  // ===== USERS (Admin) =====
  async loadUsers() {
    const users = await this.api('/api/users');
    const area = document.getElementById('contentArea');
    const rows = users.map(u => `<tr>
      <td data-label="ชื่อ"><strong>${u.name}</strong><br><span style="font-size:11px;color:var(--text-muted)">${u.username}</span></td>
      <td data-label="อีเมล">${u.email}</td>
      <td data-label="บทบาท"><span class="role-badge ${u.role}"><i class="fas fa-circle" style="font-size:6px"></i> ${u.roleName}</span></td>
      <td data-label="แผนก">${u.department}</td>
      <td data-label="สถานะ"><span class="status-dot ${u.status === 'active' ? 'online' : 'offline'}"></span>${u.status === 'active' ? 'ใช้งาน' : 'ระงับ'}</td>
      <td data-label="จัดการ"><div class="btn-group">
        <button class="btn-icon" onclick="App.editUser('${u.id}')" title="แก้ไข"><i class="fas fa-edit"></i></button>
        <button class="btn-icon danger" onclick="App.deleteUser('${u.id}')" title="ลบ"><i class="fas fa-trash"></i></button>
      </div></td>
    </tr>`).join('');

    area.innerHTML = `<div class="fade-in"><div class="toolbar"><div class="toolbar-left"><h3 style="font-size:18px">จัดการผู้ใช้</h3></div>
      <button class="btn btn-primary" onclick="App.showAddUser()"><i class="fas fa-user-plus"></i> เพิ่มผู้ใช้</button></div>
      <div class="content-card"><div class="content-card-body no-padding">
        <table class="data-table"><thead><tr><th>ชื่อ</th><th>อีเมล</th><th>บทบาท</th><th>แผนก</th><th>สถานะ</th><th>จัดการ</th></tr></thead><tbody>${rows}</tbody></table>
      </div></div></div>`;
  },

  showAddUser() {
    const modal = document.getElementById('modal');
    document.getElementById('modalContent').innerHTML = `
      <div class="modal-header"><h3><i class="fas fa-user-plus"></i> เพิ่มผู้ใช้ใหม่</h3><button class="modal-close" onclick="document.getElementById('modal').style.display='none'"><i class="fas fa-times"></i></button></div>
      <div class="modal-body"><form id="addUserForm">
        <div class="form-group"><label>ชื่อผู้ใช้ *</label><input type="text" id="newUsername" required></div>
        <div class="form-group"><label>รหัสผ่าน *</label><div class="password-wrapper"><input type="password" id="newPassword" required><button type="button" class="pw-toggle" onclick="togglePw(this)" tabindex="-1"><i class="fas fa-eye"></i></button></div><p style="font-size:11px;color:var(--text-muted);margin-top:4px">รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร ประกอบด้วยตัวอักษรและตัวเลข</p></div>
        <div class="form-group"><label>ชื่อ-นามสกุล *</label><input type="text" id="newName" required></div>
        <div class="form-group"><label>อีเมล</label><input type="email" id="newEmail"></div>
        <div class="form-group"><label>บทบาท *</label><select id="newRole"><option value="user">ผู้ใช้งานทั่วไป</option><option value="secretary">ธุรการ</option><option value="executive">ผู้บริหารระดับสูง</option><option value="admin">ผู้ดูแลระบบ</option></select></div>
        <div class="form-group"><label>แผนก</label><input type="text" id="newDept"></div>
      </form></div>
      <div class="modal-footer"><button class="btn btn-secondary" onclick="document.getElementById('modal').style.display='none'">ยกเลิก</button>
      <button class="btn btn-primary" onclick="App.addUser()"><i class="fas fa-save"></i> บันทึก</button></div>`;
    modal.style.display = 'flex';
  },

  showFieldError(inputEl, message) {
    if (!inputEl) return;
    inputEl.classList.add('is-invalid');
    const formGroup = inputEl.closest('.form-group') || inputEl.parentElement;
    if (formGroup) formGroup.classList.add('has-error');

    if (formGroup) {
      const oldFb = formGroup.querySelector('.invalid-feedback');
      if (oldFb) oldFb.remove();
    }

    if (message) {
      const feedback = document.createElement('div');
      feedback.className = 'invalid-feedback';
      feedback.innerHTML = `<i class="fas fa-exclamation-circle"></i> <span>${message}</span>`;
      if (inputEl.parentElement.classList.contains('password-wrapper')) {
        inputEl.parentElement.after(feedback);
      } else {
        inputEl.after(feedback);
      }
    }
  },

  clearModalErrors() {
    document.querySelectorAll('.modal .invalid-feedback').forEach(el => el.remove());
    document.querySelectorAll('.modal .is-invalid').forEach(el => el.classList.remove('is-invalid'));
    document.querySelectorAll('.modal .has-error').forEach(el => el.classList.remove('has-error'));
  },

  async addUser() {
    this.clearModalErrors();
    const userEl = document.getElementById('newUsername');
    const passEl = document.getElementById('newPassword');
    const nameEl = document.getElementById('newName');

    const username = userEl.value.trim();
    const password = passEl.value;
    const name = nameEl.value.trim();
    const email = document.getElementById('newEmail').value.trim();
    const role = document.getElementById('newRole').value;
    const department = document.getElementById('newDept').value.trim();

    let hasError = false;
    if (!username) { this.showFieldError(userEl, 'กรุณากรอกชื่อผู้ใช้'); hasError = true; }
    if (!password) { this.showFieldError(passEl, 'กรุณากรอกรหัสผ่าน'); hasError = true; }
    if (!name) { this.showFieldError(nameEl, 'กรุณากรอกชื่อ-นามสกุล'); hasError = true; }

    if (hasError) return;

    const data = await this.api('/api/users', {
      method: 'POST', body: {
        username,
        password,
        name,
        email,
        role,
        department
      }
    });
    if (data.error) {
      if (data.error.includes('ชื่อผู้ใช้')) {
        this.showFieldError(userEl, data.error);
      } else {
        this.toast(data.error, 'error');
      }
      return;
    }
    document.getElementById('modal').style.display = 'none';
    this.toast('เพิ่มผู้ใช้เรียบร้อย', 'success');
    this.loadUsers();
  },

  async editUser(id) {
    const users = await this.api('/api/users');
    const u = users.find(x => x.id === id);
    if (!u) return;
    const modal = document.getElementById('modal');
    document.getElementById('modalContent').innerHTML = `
      <div class="modal-header"><h3><i class="fas fa-user-edit"></i> แก้ไขผู้ใช้</h3><button class="modal-close" onclick="document.getElementById('modal').style.display='none'"><i class="fas fa-times"></i></button></div>
      <div class="modal-body">
        <div class="form-group"><label>ชื่อ-นามสกุล</label><input type="text" id="editName" value="${u.name}"></div>
        <div class="form-group"><label>อีเมล</label><input type="email" id="editEmail" value="${u.email}"></div>
        <div class="form-group"><label>รหัสผ่านใหม่ (ระบุเมื่อต้องการเปลี่ยน)</label><div class="password-wrapper"><input type="password" id="editPassword" placeholder="เว้นว่างไว้เพื่อคงรหัสผ่านเดิม"><button type="button" class="pw-toggle" onclick="togglePw(this)" tabindex="-1"><i class="fas fa-eye"></i></button></div><p style="font-size:11px;color:var(--text-muted);margin-top:4px">รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร ประกอบด้วยตัวอักษรและตัวเลข</p></div>
        <div class="form-group"><label>บทบาท</label><select id="editRole"><option value="user" ${u.role === 'user' ? 'selected' : ''}>ผู้ใช้งานทั่วไป</option><option value="secretary" ${u.role === 'secretary' ? 'selected' : ''}>ธุรการ</option><option value="executive" ${u.role === 'executive' ? 'selected' : ''}>ผู้บริหารระดับสูง</option><option value="admin" ${u.role === 'admin' ? 'selected' : ''}>ผู้ดูแลระบบ</option></select></div>
        <div class="form-group"><label>แผนก</label><input type="text" id="editDept" value="${u.department}"></div>
        <div class="form-group"><label>สถานะ</label><select id="editStatus"><option value="active" ${u.status === 'active' ? 'selected' : ''}>ใช้งาน</option><option value="inactive" ${u.status === 'inactive' ? 'selected' : ''}>ระงับ</option></select></div>
      </div>
      <div class="modal-footer"><button class="btn btn-secondary" onclick="document.getElementById('modal').style.display='none'">ยกเลิก</button>
      <button class="btn btn-primary" onclick="App.saveUser('${id}')"><i class="fas fa-save"></i> บันทึก</button></div>`;
    modal.style.display = 'flex';
  },

  async saveUser(id) {
    this.clearModalErrors();
    const nameEl = document.getElementById('editName');
    const name = nameEl.value.trim();
    const email = document.getElementById('editEmail').value.trim();
    const password = document.getElementById('editPassword').value;
    const role = document.getElementById('editRole').value;
    const department = document.getElementById('editDept').value.trim();
    const status = document.getElementById('editStatus').value;

    if (!name) {
      this.showFieldError(nameEl, 'กรุณากรอกชื่อ-นามสกุล');
      return;
    }

    const payload = {
      name,
      email,
      role,
      department,
      status
    };
    if (password) {
      payload.password = password;
    }

    const data = await this.api(`/api/users/${id}`, {
      method: 'PUT', body: payload
    });
    if (data.error) { this.toast(data.error, 'error'); return; }
    document.getElementById('modal').style.display = 'none';
    this.toast('แก้ไขผู้ใช้เรียบร้อย', 'success');
    this.loadUsers();
  },

  async deleteUser(id) {
    if (!confirm('ยืนยันการลบผู้ใช้?')) return;
    await this.api(`/api/users/${id}`, { method: 'DELETE' });
    this.toast('ลบผู้ใช้เรียบร้อย', 'success');
    this.loadUsers();
  },

  // ===== LOGS (Admin) =====
  async loadLogs() {
    const logs = await this.api('/api/logs');
    const area = document.getElementById('contentArea');
    const icons = { login: 'fa-sign-in-alt', logout: 'fa-sign-out-alt', upload: 'fa-upload', approve: 'fa-check', reject: 'fa-times', sign: 'fa-signature', view: 'fa-eye', submit: 'fa-paper-plane', create_user: 'fa-user-plus', update_user: 'fa-user-edit', delete_user: 'fa-user-minus', delete: 'fa-trash' };
    const logHtml = logs.map(l => `<div class="activity-item"><div class="activity-icon ${l.action}"><i class="fas ${icons[l.action] || 'fa-circle'}"></i></div>
      <div class="activity-content"><div class="activity-text"><strong>${l.userName}</strong> ${l.actionText}${l.targetName ? ` - ${l.targetName}` : ''}</div>
      <div class="activity-time">${new Date(l.timestamp).toLocaleString('th-TH')} • IP: ${l.ip}</div></div></div>`).join('');

    area.innerHTML = `<div class="fade-in"><div class="content-card"><div class="content-card-header"><h3><i class="fas fa-history"></i> ประวัติการใช้งานทั้งหมด</h3><span style="color:var(--text-muted);font-size:13px">${logs.length} รายการ</span></div>
      <div class="content-card-body"><div class="activity-list">${logHtml || '<div class="empty-state"><i class="fas fa-inbox"></i><h4>ไม่มีบันทึก</h4></div>'}</div></div></div></div>`;
  },

  // ===== SYSTEM STATUS (Admin) =====
  async loadSystem() {
    const backups = await this.api('/api/backups');
    const area = document.getElementById('contentArea');
    const backupList = backups.length ? backups.map(b => `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border-color)">
      <div><i class="fas fa-archive" style="color:var(--accent-blue);margin-right:8px"></i><span style="font-size:13px">${b.name}</span></div>
      <div style="font-size:12px;color:var(--text-muted)">${new Date(b.createdAt).toLocaleString('th-TH')}</div>
    </div>`).join('') : '<p style="color:var(--text-muted);font-size:13px">ยังไม่มีข้อมูลสำรอง</p>';

    area.innerHTML = `<div class="fade-in">
      <div class="content-card"><div class="content-card-header"><h3><i class="fas fa-server"></i> สถานะระบบ</h3></div><div class="content-card-body">
        <div class="system-grid">
          <div class="system-item"><i class="fas fa-server" style="color:var(--accent-green)"></i><div class="system-item-info"><h4><span class="status-dot online"></span>เซิร์ฟเวอร์</h4><p>ออนไลน์ • Node.js</p></div></div>
          <div class="system-item"><i class="fas fa-database" style="color:var(--accent-blue)"></i><div class="system-item-info"><h4><span class="status-dot online"></span>ฐานข้อมูล</h4><p>JSON Storage • ปกติ</p></div></div>
          <div class="system-item"><i class="fas fa-hdd" style="color:var(--accent-purple)"></i><div class="system-item-info"><h4><span class="status-dot online"></span>พื้นที่จัดเก็บ</h4><p>พร้อมใช้งาน</p></div></div>
          <div class="system-item"><i class="fas fa-shield-alt" style="color:var(--accent-cyan)"></i><div class="system-item-info"><h4><span class="status-dot online"></span>ความปลอดภัย</h4><p>Session + XSS Protection</p></div></div>
        </div></div></div>
      <div class="content-card"><div class="content-card-header"><h3><i class="fas fa-tools"></i> การดำเนินการ</h3></div><div class="content-card-body">
        <div class="btn-group" style="flex-wrap:wrap;gap:12px">
          <button class="btn btn-primary" onclick="App.doBackup()"><i class="fas fa-download"></i> สำรองข้อมูล</button>
          <button class="btn btn-warning" onclick="App.toast('ล้างแคชเรียบร้อย','success')"><i class="fas fa-broom"></i> ล้างแคช</button>
        </div></div></div>
      <div class="content-card"><div class="content-card-header"><h3><i class="fas fa-archive"></i> ประวัติการสำรองข้อมูล</h3><span style="color:var(--text-muted);font-size:13px">${backups.length} รายการ</span></div>
        <div class="content-card-body">${backupList}</div></div>
    </div>`;
  },

  async doBackup() {
    const data = await this.api('/api/backup', { method: 'POST' });
    if (data.success) {
      this.toast('สำรองข้อมูลเรียบร้อย: ' + data.backupName, 'success');
      this.loadSystem();
    } else {
      this.toast('เกิดข้อผิดพลาด', 'error');
    }
  },

  // ===== PENDING (Executive) =====
  async loadPending() {
    const docs = await this.api('/api/documents?status=pending_approval');
    this.currentPage = 'pending';
    const count = Array.isArray(docs) ? docs.length : 0;
    const navBadges = document.querySelectorAll('.nav-item[data-page="pending"] .badge');
    navBadges.forEach(b => {
      b.textContent = count;
      b.style.display = count > 0 ? '' : 'none';
    });
    const area = document.getElementById('contentArea');
    const rows = docs.map(d => {
      let stepInfo = '-';
      if (d.approvalWorkflow && d.approvalWorkflow.length > 0) {
        const currentStepIdx = d.approvalWorkflow.findIndex(w => w.status === 'pending');
        if (currentStepIdx !== -1) {
          const step = d.approvalWorkflow[currentStepIdx];
          stepInfo = `<span class="badge warning"><i class="fas fa-layer-group"></i> ขั้นที่ ${currentStepIdx + 1}/${d.approvalWorkflow.length}: ${step.roleName || step.role}</span>`;
        }
      }
      return `<tr>
        <td data-label="ชื่อเอกสาร"><strong style="cursor:pointer;color:var(--accent-blue)" onclick="App.viewDocument('${d.id}')">${d.title}</strong></td>
        <td data-label="หมวดหมู่">${d.category}</td>
        <td data-label="ผู้สร้าง">${d.uploadedByName}</td>
        <td data-label="ขั้นตอน">${stepInfo}</td>
        <td data-label="วันที่">${new Date(d.createdAt).toLocaleDateString('th-TH')}</td>
        <td data-label="กำหนดส่ง">${d.deadline ? new Date(d.deadline).toLocaleDateString('th-TH') : '-'}</td>
        <td data-label="จัดการ"><div class="btn-group">
          <button class="btn btn-sm btn-success" onclick="App.approveDoc('${d.id}')"><i class="fas fa-check"></i> อนุมัติ</button>
          <button class="btn btn-sm btn-danger" onclick="App.rejectDoc('${d.id}')"><i class="fas fa-times"></i> ปฏิเสธ</button>
        </div></td>
      </tr>`;
    }).join('');

    area.innerHTML = `<div class="fade-in"><div class="content-card"><div class="content-card-header"><h3><i class="fas fa-clock"></i> เอกสารรออนุมัติ</h3><span style="color:var(--text-muted);font-size:13px">${docs.length} รายการ</span></div>
  <div class="content-card-body no-padding">
    ${docs.length ? `<table class="data-table"><thead><tr><th>ชื่อเอกสาร</th><th>หมวดหมู่</th><th>ผู้สร้าง</th><th>ขั้นตอนปัจจุบัน</th><th>วันที่</th><th>กำหนดส่ง</th><th>จัดการ</th></tr></thead><tbody>${rows}</tbody></table>`
        : '<div class="empty-state"><i class="fas fa-check-circle"></i><h4>ไม่มีเอกสารรออนุมัติ</h4><p>เอกสารทั้งหมดดำเนินการแล้ว</p></div>'}
  </div></div></div>`;
  },

  // ===== REPORTS (Secretary) =====
  async loadReports() {
    const docs = await this.api('/api/documents');
    const area = document.getElementById('contentArea');
    const cats = {}; docs.forEach(d => { cats[d.category] = (cats[d.category] || 0) + 1; });
    const stats = { total: docs.length, approved: docs.filter(d => d.status === 'approved').length, pending: docs.filter(d => d.status === 'pending_approval').length, rejected: docs.filter(d => d.status === 'rejected').length, signed: docs.filter(d => d.status === 'signed').length };

    area.innerHTML = `<div class="fade-in"><div class="stats-grid">
      <div class="stat-card blue"><div class="stat-card-value">${stats.total}</div><div class="stat-card-label">เอกสารทั้งหมด</div></div>
      <div class="stat-card green"><div class="stat-card-value">${stats.approved}</div><div class="stat-card-label">อนุมัติแล้ว</div></div>
      <div class="stat-card orange"><div class="stat-card-value">${stats.pending}</div><div class="stat-card-label">รออนุมัติ</div></div>
      <div class="stat-card red"><div class="stat-card-value">${stats.rejected}</div><div class="stat-card-label">ปฏิเสธ</div></div></div>
      <div class="two-col">
        <div class="content-card"><div class="content-card-header"><h3><i class="fas fa-chart-bar"></i> ตามหมวดหมู่</h3></div><div class="content-card-body">
          ${Object.entries(cats).map(([k, v]) => `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border-color)"><span>${k}</span><strong>${v}</strong></div>`).join('')}
        </div></div>
        <div class="content-card"><div class="content-card-header"><h3><i class="fas fa-chart-pie"></i> สัดส่วนสถานะ</h3></div><div class="content-card-body">
          <div style="display:flex;flex-direction:column;gap:12px">
            ${[['อนุมัติ', stats.approved, 'var(--accent-green)'], ['รออนุมัติ', stats.pending, 'var(--accent-orange)'], ['ปฏิเสธ', stats.rejected, 'var(--accent-red)'], ['ลงนาม', stats.signed, 'var(--accent-blue)']].map(([l, v, c]) =>
      `<div><div style="display:flex;justify-content:space-between;margin-bottom:4px"><span style="font-size:13px">${l}</span><span style="font-size:13px">${v}</span></div>
              <div style="height:8px;background:var(--bg-input);border-radius:4px;overflow:hidden"><div style="height:100%;width:${stats.total ? Math.round(v / stats.total * 100) : 0}%;background:${c};border-radius:4px;transition:width 1s ease"></div></div></div>`).join('')}
          </div></div></div>
      </div></div>`;
  },

  // ===== PROFILE (User Self-Edit) =====
  async loadProfile() {
    const area = document.getElementById('contentArea');
    const u = this.user;
    const certs = await this.api('/api/certificates').catch(() => []);
    const myCert = certs.find(c => c.userId === u.id || c.userName === u.name);

    area.innerHTML = `<div class="fade-in">
  <div class="content-card" style="max-width:720px">
    <div class="content-card-header"><h3><i class="fas fa-user-cog"></i> ข้อมูลส่วนตัวและการยืนยันตัวตน</h3></div>
    <div class="content-card-body">
      <div class="profile-header" style="display:flex;align-items:center;gap:20px;margin-bottom:28px;padding-bottom:20px;border-bottom:1px solid var(--border-color)">
        <div id="profileAvatarPreview" style="width:80px;height:80px;background:var(--gradient-primary);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:32px;color:#fff;flex-shrink:0;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.15)">
          ${u.avatar ? `<img src="${u.avatar}" style="width:100%;height:100%;object-fit:cover">` : `<i class="fas ${u.role === 'executive' ? 'fa-user-tie' : 'fa-user'}"></i>`}
        </div>
        <div>
          <h3 style="font-size:22px;font-weight:700;margin-bottom:4px">${u.name}</h3>
          <p style="color:var(--text-secondary);font-size:13px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px">
            <span class="role-badge ${u.role}"><i class="fas fa-circle" style="font-size:6px"></i> ${u.roleName}</span>
            <span><i class="fas fa-building"></i> ${u.department || 'ไม่ระบุแผนก'}</span>
            ${u.position ? `<span><i class="fas fa-id-badge"></i> ${u.position}</span>` : ''}
          </p>
          <div style="display:flex;gap:8px;align-items:center">
            <input type="file" id="profileAvatarFile" accept="image/png,image/jpeg,image/jpg,image/webp" style="display:none" onchange="App.handleAvatarUpload(this)">
            <button type="button" class="btn btn-sm btn-outline" onclick="document.getElementById('profileAvatarFile').click()"><i class="fas fa-camera"></i> อัปโหลดรูปโปรไฟล์</button>
            ${u.avatar ? `<button type="button" class="btn btn-sm btn-secondary" onclick="App.removeAvatar()"><i class="fas fa-trash"></i> ลบรูป</button>` : ''}
          </div>
        </div>
      </div>

      <form id="profileForm">
        <input type="hidden" id="profileAvatarData" value="${u.avatar || ''}">
        <div class="doc-detail">
          <div class="doc-detail-item form-group"><label><i class="fas fa-user-tag"></i> รหัสผู้ใช้งาน (Username)</label><input type="text" value="${u.username}" readonly style="background: var(--bg-secondary); cursor: not-allowed; color: var(--text-muted)"></div>
          <div class="doc-detail-item form-group"><label><i class="fas fa-user"></i> ชื่อ-นามสกุลจริง</label><input type="text" id="profileName" value="${u.name}" required></div>
          <div class="doc-detail-item form-group"><label><i class="fas fa-id-card"></i> ตำแหน่งทางการ / งาน</label><input type="text" id="profilePosition" value="${u.position || ''}" placeholder="เช่น ประธานกรรมการบริหาร / CEO"></div>
          <div class="doc-detail-item form-group"><label><i class="fas fa-envelope"></i> อีเมล</label><input type="email" id="profileEmail" value="${u.email || ''}" placeholder="name@company.com"></div>
          <div class="doc-detail-item form-group"><label><i class="fas fa-phone"></i> เบอร์โทรศัพท์ติดต่อ</label><input type="tel" id="profilePhone" value="${u.phone || ''}" placeholder="เช่น 02-555-0199 หรือ 081-234-5678"></div>
          <div class="doc-detail-item form-group"><label><i class="fas fa-building"></i> แผนก / ฝ่ายงาน</label><input type="text" id="profileDept" value="${u.department || ''}" placeholder="ระบุแผนก"></div>

          <div class="doc-detail-item doc-detail-full" style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border-color)">
            <h4 style="font-size:15px;margin-bottom:12px"><i class="fas fa-lock" style="color:var(--accent-orange)"></i> เปลี่ยนรหัสผ่านเข้าสู่ระบบ <span style="font-size:12px;color:var(--text-muted);font-weight:400">(กรอกเมื่อต้องการเปลี่ยนเท่านั้น)</span></h4>
          </div>
          <div class="doc-detail-item form-group"><label>รหัสผ่านปัจจุบัน</label><div class="password-wrapper"><input type="password" id="profileCurrentPw" placeholder="กรอกรหัสผ่านปัจจุบัน"><button type="button" class="pw-toggle" onclick="togglePw(this)" tabindex="-1"><i class="fas fa-eye"></i></button></div></div>
          <div class="doc-detail-item form-group"><label>รหัสผ่านใหม่</label><div class="password-wrapper"><input type="password" id="profileNewPw" placeholder="กรอกรหัสผ่านใหม่"><button type="button" class="pw-toggle" onclick="togglePw(this)" tabindex="-1"><i class="fas fa-eye"></i></button></div></div>
        </div>

        <div style="margin-top:20px;display:flex;gap:10px;justify-content:flex-end">
          <button type="button" class="btn btn-secondary" onclick="App.navigate('dashboard')">ยกเลิก</button>
          <button type="submit" class="btn btn-primary"><i class="fas fa-save"></i> บันทึกข้อมูลส่วนตัว</button>
        </div>
      </form>

      <!-- PIN Security & MFA Section -->
      <div style="margin-top:28px;padding-top:20px;border-top:1px solid var(--border-color)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:10px">
          <h4 style="font-size:15px;margin:0;display:flex;align-items:center;gap:8px">
            <i class="fas fa-key" style="color:var(--accent-blue)"></i> รหัส PIN ยืนยันตัวตนสำหรับอนุมัติและลงนาม (MFA)
          </h4>
          <div>
            ${u.hasPin 
              ? `<span class="role-badge" style="background:rgba(46,204,113,0.15);color:var(--accent-green);border:1px solid rgba(46,204,113,0.3)"><i class="fas fa-check-circle"></i> ตั้งค่ารหัส PIN แล้ว</span>`
              : `<span class="role-badge" style="background:rgba(231,76,60,0.15);color:var(--accent-red);border:1px solid rgba(231,76,60,0.3)"><i class="fas fa-exclamation-triangle"></i> ยังไม่ได้ตั้งค่า PIN</span>`}
          </div>
        </div>

        <form id="pinSetupForm">
          <div class="doc-detail" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
            <div class="form-group" style="margin-bottom:0">
              <label style="font-size:13px">ตั้งค่ารหัส PIN ใหม่ (ตัวเลข 4-6 หลัก) *</label>
              <div class="password-wrapper">
                <input type="password" id="pinInput" maxlength="6" pattern="[0-9]{4,6}" placeholder="กรอกตัวเลข 4-6 หลัก" required style="letter-spacing:4px;font-size:16px">
                <button type="button" class="pw-toggle" onclick="togglePw(this)" tabindex="-1"><i class="fas fa-eye"></i></button>
              </div>
            </div>
            <div class="form-group" style="margin-bottom:0">
              <label style="font-size:13px">ยืนยันรหัส PIN อีกครั้ง *</label>
              <div class="password-wrapper">
                <input type="password" id="pinConfirmInput" maxlength="6" pattern="[0-9]{4,6}" placeholder="กรอกตัวเลขซ้ำอีกครั้ง" required style="letter-spacing:4px;font-size:16px">
                <button type="button" class="pw-toggle" onclick="togglePw(this)" tabindex="-1"><i class="fas fa-eye"></i></button>
              </div>
            </div>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center">
            ${u.hasPin ? `<a href="#" onclick="App.showForgotPinModal();return false;" style="font-size:13px;color:var(--accent-orange);display:flex;align-items:center;gap:5px;"><i class="fas fa-question-circle"></i> ลืมรหัส PIN?</a>` : '<span></span>'}
            <button type="submit" class="btn btn-primary" style="height:42px"><i class="fas fa-shield-alt"></i> ${u.hasPin ? 'อัปเดตรหัส PIN' : 'บันทึก PIN'}</button>
          </div>
        </form>
      </div>

      <!-- Digital Certificate & Sign Info Section -->
      <div style="margin-top:28px;padding-top:20px;border-top:1px solid var(--border-color)">
        <h4 style="font-size:15px;margin-bottom:12px;display:flex;align-items:center;gap:8px">
          <i class="fas fa-certificate" style="color:var(--accent-green)"></i> ใบรับรองดิจิทัล & ลายมือชื่ออิเล็กทรอนิกส์
        </h4>
        <div style="background:var(--bg-hover);padding:16px;border-radius:8px;font-size:13px;display:flex;justify-content:space-between;align-items:center">
          <div>
            ${myCert ? `<div><strong>ซีเรียลใบรับรอง:</strong> <code>${myCert.certSerial || myCert.id}</code></div>
            <div><strong>สถานะใบรับรอง:</strong> <span class="status-badge ${myCert.certStatus === 'active' ? 'status-signed' : 'status-rejected'}">${myCert.certStatus === 'active' ? 'ใช้งานได้' : myCert.certStatus}</span></div>
            <div style="color:var(--text-muted);font-size:12px;margin-top:4px">ผู้ออก: ${myCert.issuedBy || 'DocMS Internal CA'}</div>`
            : `<div style="color:var(--text-secondary)"><i class="fas fa-info-circle"></i> ยังไม่ได้ออกใบรับรองดิจิทัลส่วนบุคคล</div>`}
          </div>
          <div>
            <button type="button" class="btn btn-sm btn-outline" onclick="App.navigate('certificates')"><i class="fas fa-file-signature"></i> ดูใบรับรองดิจิทัล</button>
          </div>
        </div>
      </div>
    </div>
  </div>
    </div>`;

    // Handle Profile Form Submit
    document.getElementById('profileForm').onsubmit = async (e) => {
      e.preventDefault();
      const body = {
        name: document.getElementById('profileName').value,
        position: document.getElementById('profilePosition').value,
        email: document.getElementById('profileEmail').value,
        phone: document.getElementById('profilePhone').value,
        department: document.getElementById('profileDept').value,
        avatar: document.getElementById('profileAvatarData').value
      };
      const curPw = document.getElementById('profileCurrentPw').value;
      const newPw = document.getElementById('profileNewPw').value;
      if (newPw) {
        if (!curPw) { this.toast('กรุณากรอกรหัสผ่านปัจจุบัน', 'error'); return; }
        body.currentPassword = curPw;
        body.password = newPw;
      }
      const data = await this.api('/api/profile', { method: 'PUT', body });
      if (data.error) { this.toast(data.error, 'error'); return; }
      this.user = { ...this.user, ...data.user };
      this.buildSidebar();
      this.toast('บันทึกข้อมูลส่วนตัวเรียบร้อย', 'success');
      this.loadProfile();
    };

    // Handle PIN Setup Form Submit
    const pinForm = document.getElementById('pinSetupForm');
    if (pinForm) {
      pinForm.onsubmit = async (e) => {
        e.preventDefault();
        const pin = document.getElementById('pinInput').value.trim();
        const pinConfirm = document.getElementById('pinConfirmInput').value.trim();
        if (pin !== pinConfirm) {
          this.toast('รหัส PIN ทั้งสองช่องไม่ตรงกัน กรุณาตรวจสอบอีกครั้ง', 'error');
          return;
        }
        const res = await this.api('/api/profile/set-pin', { method: 'POST', body: { pin } });
        if (res.error) { this.toast(res.error, 'error'); return; }
        this.user.hasPin = true;
        this.toast('บันทึกรหัส PIN เรียบร้อยแล้ว', 'success');
        this.loadProfile();
      };
    }
  },

  handleAvatarUpload(input) {
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    if (file.size > 2 * 1024 * 1024) {
      this.toast('ขนาดไฟล์รูปโปรไฟล์ต้องไม่เกิน 2MB', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      document.getElementById('profileAvatarData').value = dataUrl;
      const preview = document.getElementById('profileAvatarPreview');
      if (preview) {
        preview.innerHTML = `<img src="${dataUrl}" style="width:100%;height:100%;object-fit:cover">`;
      }
      this.toast('เลือกรูปภาพเรียบร้อย อย่าลืมกดบันทึกข้อมูล', 'info');
    };
    reader.readAsDataURL(file);
  },

  removeAvatar() {
    document.getElementById('profileAvatarData').value = '';
    const u = this.user;
    const preview = document.getElementById('profileAvatarPreview');
    if (preview) {
      preview.innerHTML = `<i class="fas ${u.role === 'executive' ? 'fa-user-tie' : 'fa-user'}"></i>`;
    }
    this.toast('ลบรูปโปรไฟล์แล้ว อย่าลืมกดบันทึกข้อมูล', 'info');
  },

  // ===== NOTIFICATIONS =====
  async loadNotifications() {
    const area = document.getElementById('contentArea');
    // Show loading state
    area.innerHTML = `<div class="fade-in" style="display:flex;align-items:center;justify-content:center;padding:60px;color:var(--text-muted)"><i class="fas fa-spinner fa-spin" style="font-size:24px;margin-right:12px"></i> กำลังโหลด...</div>`;

    let notifs = [];
    try {
      const result = await this.api('/api/notifications');
      notifs = Array.isArray(result) ? result : [];
    } catch (e) {
      area.innerHTML = `<div class="content-card"><div class="content-card-body"><div class="empty-state"><i class="fas fa-exclamation-triangle" style="color:var(--accent-red)"></i><h4>เกิดข้อผิดพลาด</h4><p>ไม่สามารถโหลดการแจ้งเตือนได้ กรุณาลองใหม่อีกครั้ง</p><button class="btn btn-primary" onclick="App.loadNotifications()"><i class="fas fa-redo"></i> ลองอีกครั้ง</button></div></div></div>`;
      return;
    }
    const unreadCount = notifs.filter(n => !n.read).length;

    const typeIcons = {
      status_change: { icon: 'fa-exchange-alt', color: 'var(--accent-blue)' },
      comment: { icon: 'fa-comment', color: 'var(--accent-cyan)' },
      access_request: { icon: 'fa-key', color: 'var(--accent-orange)' },
      access_approved: { icon: 'fa-check-circle', color: 'var(--accent-green)' },
      access_rejected: { icon: 'fa-times-circle', color: 'var(--accent-red)' }
    };

    const notifHtml = notifs.map(n => {
      const t = typeIcons[n.type] || { icon: 'fa-bell', color: 'var(--accent-blue)' };
      return `<div class="notif-item ${n.read ? 'read' : 'unread'}" data-id="${n.id}">
        <div class="notif-icon" style="background:${t.color}15;color:${t.color}"><i class="fas ${t.icon}"></i></div>
        <div class="notif-content">
          <div class="notif-title">${n.title}</div>
          <div class="notif-message">${n.message}</div>
          <div class="notif-time"><i class="fas fa-clock"></i> ${this.timeAgo(n.createdAt)}</div>
        </div>
        <div class="notif-actions">
          ${!n.read ? `<button class="btn-icon" onclick="App.markNotifRead('${n.id}')" title="อ่านแล้ว"><i class="fas fa-check"></i></button>` : '<span style="color:var(--text-muted);font-size:11px"><i class="fas fa-check-double"></i></span>'}
          ${n.documentId ? `<button class="btn-icon" onclick="App.viewDocument('${n.documentId}')" title="ดูเอกสาร"><i class="fas fa-eye"></i></button>` : ''}
          <button class="btn-icon danger" onclick="App.deleteNotif('${n.id}')" title="ลบ"><i class="fas fa-trash"></i></button>
        </div>
      </div>`;
    }).join('');

    area.innerHTML = `<div class="fade-in">
      <div class="toolbar">
        <div class="toolbar-left" style="display:flex;align-items:center;gap:12px">
          <button class="btn btn-secondary btn-sm" onclick="App.navigate(App.previousPage || 'dashboard')" title="ย้อนกลับ"><i class="fas fa-arrow-left"></i> ย้อนกลับ</button>
          <h3 style="font-size:18px;margin:0"><i class="fas fa-bell" style="color:var(--accent-orange)"></i> การแจ้งเตือน <span style="font-size:13px;color:var(--text-muted);font-weight:400">(${notifs.length} รายการ, ${unreadCount} ยังไม่อ่าน)</span></h3>
        </div>
        <div class="toolbar-right">
          ${unreadCount > 0 ? `<button class="btn btn-secondary" onclick="App.markAllNotifRead()"><i class="fas fa-check-double"></i> อ่านทั้งหมด</button>` : ''}
        </div>
      </div>
      <div class="content-card"><div class="content-card-body${notifs.length ? ' no-padding' : ''}">
        ${notifs.length ? `<div class="notif-list">${notifHtml}</div>` : '<div class="empty-state"><i class="fas fa-bell-slash"></i><h4>ไม่มีการแจ้งเตือน</h4><p>คุณยังไม่มีการแจ้งเตือนใดๆ</p></div>'}
      </div></div>
    </div>`;

    this.updateBadges();
  },

  timeAgo(dateStr) {
    const now = new Date();
    const d = new Date(dateStr);
    const diff = Math.floor((now - d) / 1000);
    if (diff < 60) return 'เมื่อสักครู่';
    if (diff < 3600) return `${Math.floor(diff / 60)} นาทีที่แล้ว`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} ชั่วโมงที่แล้ว`;
    if (diff < 604800) return `${Math.floor(diff / 86400)} วันที่แล้ว`;
    return d.toLocaleDateString('th-TH');
  },

  async markNotifRead(id) {
    await this.api(`/api/notifications/${id}/read`, { method: 'PUT' });
    this.updateBadges();
    this.loadNotifications();
  },

  async markAllNotifRead() {
    await this.api('/api/notifications/read-all', { method: 'PUT' });
    this.toast('อ่านการแจ้งเตือนทั้งหมดแล้ว', 'success');
    this.updateBadges();
    this.loadNotifications();
  },

  async deleteNotif(id) {
    await this.api(`/api/notifications/${id}`, { method: 'DELETE' });
    this.updateBadges();
    this.loadNotifications();
  },

  // ===== ACCESS REQUESTS =====
  async loadAccessRequests() {
    const [requests, docs] = await Promise.all([
      this.api('/api/access-requests'),
      this.api('/api/documents')
    ]);
    const area = document.getElementById('contentArea');
    const isAdmin = this.user.role === 'admin';
    if (isAdmin) {
      const pendingCount = requests.filter(r => r.status === 'pending').length;
      const navBadges = document.querySelectorAll('.nav-item[data-page="access_requests"] .badge');
      navBadges.forEach(b => {
        b.textContent = pendingCount;
        b.style.display = pendingCount > 0 ? '' : 'none';
      });
    }

    const statusIcons = {
      pending: { cls: 'pending', icon: 'fa-hourglass-half' },
      approved: { cls: 'approved', icon: 'fa-check-circle' },
      rejected: { cls: 'rejected', icon: 'fa-times-circle' }
    };

    const rows = requests.map(r => {
      const st = statusIcons[r.status] || statusIcons.pending;
      return `<tr>
        ${isAdmin ? `<td><strong>${r.userName}</strong></td>` : ''}
        <td><strong style="color:var(--accent-blue);cursor:pointer" onclick="App.viewDocument('${r.documentId}')">${r.documentTitle}</strong></td>
        <td style="max-width:200px">${r.reason || '-'}</td>
        <td><span class="status-badge ${st.cls}"><i class="fas ${st.icon}"></i> ${r.statusText}</span></td>
        <td>${new Date(r.createdAt).toLocaleDateString('th-TH')}</td>
        ${isAdmin && r.status === 'pending' ? `<td><div class="btn-group">
          <button class="btn btn-sm btn-success" onclick="App.approveAccessReq('${r.id}')"><i class="fas fa-check"></i> อนุมัติ</button>
          <button class="btn btn-sm btn-danger" onclick="App.rejectAccessReq('${r.id}')"><i class="fas fa-times"></i> ปฏิเสธ</button>
        </div></td>` : `<td>${r.reviewedByName ? r.reviewedByName : '-'}</td>`}
      </tr>`;
    }).join('');

    // Build document selection for non-admin users to request access
    const allDocs = await this.api('/api/documents');
    // Show all docs that user is NOT already assigned to (for request form)
    // For general users, the /api/documents only returns assigned docs, so we need a workaround
    // We'll let the backend validate, just show a text input for document selection
    const requestForm = !isAdmin ? `
      <div class="content-card" style="margin-bottom:24px">
        <div class="content-card-header"><h3><i class="fas fa-plus-circle" style="color:var(--accent-green)"></i> ส่งคำร้องขอสิทธิ์ใหม่</h3></div>
        <div class="content-card-body">
          <form id="accessReqForm">
            <div class="doc-detail">
              <div class="doc-detail-item form-group"><label><i class="fas fa-file-alt"></i> รหัสเอกสาร</label><input type="text" id="reqDocId" placeholder="เช่น doc1740123456789" required><p style="font-size:11px;color:var(--text-muted);margin-top:4px">สอบถามรหัสเอกสารจากผู้ดูแลระบบ</p></div>
              <div class="doc-detail-item form-group"><label><i class="fas fa-comment"></i> เหตุผล</label><textarea id="reqReason" rows="2" placeholder="ระบุเหตุผลที่ต้องการเข้าถึง"></textarea></div>
            </div>
            <div style="margin-top:16px"><button type="submit" class="btn btn-primary"><i class="fas fa-paper-plane"></i> ส่งคำร้อง</button></div>
          </form>
        </div>
      </div>` : '';

    const thHeader = isAdmin
      ? '<th>ผู้ร้องขอ</th><th>เอกสาร</th><th>เหตุผล</th><th>สถานะ</th><th>วันที่</th><th>จัดการ</th>'
      : '<th>เอกสาร</th><th>เหตุผล</th><th>สถานะ</th><th>วันที่</th><th>ผู้ดำเนินการ</th>';

    area.innerHTML = `<div class="fade-in">
      ${requestForm}
      <div class="content-card">
        <div class="content-card-header"><h3><i class="fas fa-key"></i> ${isAdmin ? 'คำร้องขอสิทธิ์ทั้งหมด' : 'คำร้องของฉัน'}</h3><span style="color:var(--text-muted);font-size:13px">${requests.length} รายการ</span></div>
        <div class="content-card-body${requests.length ? ' no-padding' : ''}">
          ${requests.length ? `<table class="data-table"><thead><tr>${thHeader}</tr></thead><tbody>${rows}</tbody></table>`
        : '<div class="empty-state"><i class="fas fa-key"></i><h4>ไม่มีคำร้อง</h4><p>ยังไม่มีคำร้องขอสิทธิ์เข้าถึงเอกสาร</p></div>'}
        </div>
      </div>
    </div>`;

    if (!isAdmin) {
      const form = document.getElementById('accessReqForm');
      if (form) {
        form.onsubmit = async (e) => {
          e.preventDefault();
          const documentId = document.getElementById('reqDocId').value.trim();
          const reason = document.getElementById('reqReason').value.trim();
          if (!documentId) { this.toast('กรุณากรอกรหัสเอกสาร', 'error'); return; }
          const data = await this.api('/api/access-requests', { method: 'POST', body: { documentId, reason } });
          if (data.error) { this.toast(data.error, 'error'); return; }
          this.toast('ส่งคำร้องเรียบร้อย', 'success');
          this.loadAccessRequests();
        };
      }
    }
  },

  async approveAccessReq(id) {
    await this.api(`/api/access-requests/${id}/approve`, { method: 'PUT' });
    this.toast('อนุมัติคำร้องเรียบร้อย', 'success');
    this.updateBadges();
    this.loadAccessRequests();
  },

  async rejectAccessReq(id) {
    await this.api(`/api/access-requests/${id}/reject`, { method: 'PUT' });
    this.toast('ปฏิเสธคำร้องแล้ว', 'error');
    this.updateBadges();
    this.loadAccessRequests();
  },

  // ===== MY ACTIVITY LOGS (User) =====
  async loadMyLogs() {
    const logs = await this.api('/api/logs/me');
    const area = document.getElementById('contentArea');
    const icons = { login: 'fa-sign-in-alt', logout: 'fa-sign-out-alt', upload: 'fa-upload', approve: 'fa-check', reject: 'fa-times', sign: 'fa-signature', view: 'fa-eye', submit: 'fa-paper-plane', download: 'fa-download', update_profile: 'fa-user-edit', comment: 'fa-comment' };
    const logHtml = logs.map(l => `<div class="activity-item"><div class="activity-icon ${l.action}"><i class="fas ${icons[l.action] || 'fa-circle'}"></i></div>
      <div class="activity-content"><div class="activity-text"><strong>${l.actionText}</strong>${l.targetName ? ` — ${l.targetName}` : ''}</div>
      <div class="activity-time"><i class="fas fa-clock"></i> ${new Date(l.timestamp).toLocaleString('th-TH')} • IP: ${l.ip || '-'}</div></div></div>`).join('');

    area.innerHTML = `<div class="fade-in"><div class="content-card">
      <div class="content-card-header"><h3><i class="fas fa-history" style="color:var(--accent-purple)"></i> ประวัติการดำเนินการของฉัน</h3><span style="color:var(--text-muted);font-size:13px">${logs.length} รายการ</span></div>
      <div class="content-card-body"><div class="activity-list">${logHtml || '<div class="empty-state"><i class="fas fa-inbox"></i><h4>ไม่มีประวัติ</h4><p>คุณยังไม่มีประวัติการดำเนินการใดๆ</p></div>'}</div></div></div></div>`;
  },

  // ===== CERTIFICATE MANAGEMENT =====
  async loadCertificates() {
    let certs = await this.api('/api/certificates');
    if (!Array.isArray(certs)) certs = [];
    const area = document.getElementById('contentArea');
    const isAdmin = this.user.role === 'admin';

    const statusColors = { active: 'var(--accent-green)', revoked: 'var(--accent-red)', expired: 'var(--accent-orange)' };
    const statusTexts = { active: 'ใช้งาน', revoked: 'เพิกถอน', expired: 'หมดอายุ' };

    const rows = certs.map(c => {
      const isExpired = c.expiredDate && new Date(c.expiredDate) < new Date();
      const status = isExpired ? 'expired' : c.certStatus;
      return `<tr>
        <td data-label="Serial"><code style="background:var(--bg-tertiary);padding:2px 8px;border-radius:4px;font-size:12px">${c.certSerial}</code></td>
        <td data-label="เจ้าของ">${c.userName}</td>
        <td data-label="ออกโดย">${c.issuedBy}</td>
        <td data-label="วันออก">${new Date(c.issuedDate).toLocaleDateString('th-TH')}</td>
        <td data-label="หมดอายุ">${new Date(c.expiredDate).toLocaleDateString('th-TH')}</td>
        <td data-label="สถานะ"><span style="color:${statusColors[status]};font-weight:600"><i class="fas ${status === 'active' ? 'fa-check-circle' : status === 'revoked' ? 'fa-ban' : 'fa-exclamation-triangle'}"></i> ${statusTexts[status]}</span></td>
        ${isAdmin ? `<td data-label="จัดการ"><div class="btn-group">
          ${status === 'active' ? `<button class="btn btn-sm btn-danger" onclick="App.revokeCert('${c.id}')"><i class="fas fa-ban"></i> เพิกถอน</button>` : ''}
          <button class="btn btn-sm btn-secondary" onclick="App.deleteCert('${c.id}')"><i class="fas fa-trash"></i></button>
        </div></td>` : '<td>-</td>'}
      </tr>`;
    }).join('');

    const createForm = isAdmin ? `
      <div class="content-card" style="margin-bottom:24px">
        <div class="content-card-header"><h3><i class="fas fa-plus-circle" style="color:var(--accent-green)"></i> ออกใบรับรองดิจิทัลใหม่</h3></div>
        <div class="content-card-body">
          <form id="certForm">
            <div class="doc-detail">
              <div class="doc-detail-item form-group"><label><i class="fas fa-user"></i> รหัสผู้ใช้</label><input type="text" id="certUserId" placeholder="เช่น u1740123456" required></div>
              <div class="doc-detail-item form-group"><label><i class="fas fa-fingerprint"></i> หมายเลข Serial</label><input type="text" id="certSerial" placeholder="เว้นว่างเพื่อสร้างอัตโนมัติ"></div>
              <div class="doc-detail-item form-group"><label><i class="fas fa-building"></i> ออกโดย (CA)</label><input type="text" id="certIssuedBy" value="DocMS Internal CA"></div>
              <div class="doc-detail-item form-group"><label><i class="fas fa-calendar"></i> วันหมดอายุ</label><input type="date" id="certExpDate"></div>
            </div>
            <div style="margin-top:16px"><button type="submit" class="btn btn-primary"><i class="fas fa-certificate"></i> ออกใบรับรอง</button></div>
          </form>
        </div>
      </div>` : '';

    area.innerHTML = `<div class="fade-in">
      ${createForm}
      <div class="content-card">
        <div class="content-card-header"><h3><i class="fas fa-certificate" style="color:var(--accent-blue)"></i> ใบรับรองดิจิทัล</h3><span style="color:var(--text-muted);font-size:13px">${certs.length} รายการ</span></div>
        <div class="content-card-body${certs.length ? ' no-padding' : ''}">
          ${certs.length ? `<table class="data-table"><thead><tr><th>Serial</th><th>เจ้าของ</th><th>ออกโดย</th><th>วันออก</th><th>วันหมดอายุ</th><th>สถานะ</th><th>จัดการ</th></tr></thead><tbody>${rows}</tbody></table>`
        : '<div class="empty-state"><i class="fas fa-certificate"></i><h4>ไม่มีใบรับรอง</h4><p>ยังไม่มีใบรับรองดิจิทัลในระบบ</p></div>'}
        </div>
      </div>
    </div>`;

    if (isAdmin) {
      const form = document.getElementById('certForm');
      if (form) {
        form.onsubmit = async (e) => {
          e.preventDefault();
          const data = await this.api('/api/certificates', {
            method: 'POST', body: {
              userId: document.getElementById('certUserId').value.trim(),
              certSerial: document.getElementById('certSerial').value.trim() || undefined,
              issuedBy: document.getElementById('certIssuedBy').value.trim(),
              expiredDate: document.getElementById('certExpDate').value || undefined
            }
          });
          if (data.error) { this.toast(data.error, 'error'); return; }
          this.toast('ออกใบรับรองเรียบร้อย', 'success');
          this.loadCertificates();
        };
      }
    }
  },

  async revokeCert(id) {
    if (!confirm('ต้องการเพิกถอนใบรับรองนี้?')) return;
    await this.api(`/api/certificates/${id}/revoke`, { method: 'PUT' });
    this.toast('เพิกถอนใบรับรองแล้ว', 'success');
    this.loadCertificates();
  },

  async deleteCert(id) {
    if (!confirm('ต้องการลบใบรับรองนี้?')) return;
    await this.api(`/api/certificates/${id}`, { method: 'DELETE' });
    this.toast('ลบใบรับรองแล้ว', 'success');
    this.loadCertificates();
  },

  // ===== FORGOT PIN MODAL =====
  showForgotPinModal() {
    const modal = document.getElementById('modal');
    modal.innerHTML = `
    <div class="modal-overlay" onclick="App.closeModal()">
      <div class="modal-content" onclick="event.stopPropagation()" style="max-width:480px">
        <div class="modal-header">
          <h3><i class="fas fa-key" style="color:var(--accent-orange)"></i> รีเซ็ตรหัส PIN</h3>
          <button class="modal-close" onclick="App.closeModal()">&times;</button>
        </div>
        <div class="modal-body">
          <div style="background:rgba(255,165,0,0.08);border:1px solid rgba(255,165,0,0.3);border-radius:10px;padding:14px 16px;margin-bottom:20px;font-size:13px;color:var(--accent-orange);display:flex;gap:10px;align-items:flex-start">
            <i class="fas fa-info-circle" style="margin-top:2px;flex-shrink:0"></i>
            <span>เพื่อความปลอดภัย กรุณายืนยันตัวตนด้วย <strong>รหัสผ่านเข้าระบบ</strong> ก่อนตั้งรหัส PIN ใหม่</span>
          </div>
          <div class="form-group" style="margin-bottom:16px">
            <label style="font-weight:600;font-size:13px;display:flex;align-items:center;gap:6px"><i class="fas fa-lock" style="color:var(--accent-orange)"></i> รหัสผ่านเข้าระบบ *</label>
            <div class="password-wrapper">
              <input type="password" id="forgotPinPassword" placeholder="กรอกรหัสผ่านล็อกอินของคุณ" style="margin-top:6px">
              <button type="button" class="pw-toggle" onclick="togglePw(this)" tabindex="-1"><i class="fas fa-eye"></i></button>
            </div>
          </div>
          <div class="doc-detail" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
            <div class="form-group" style="margin-bottom:0">
              <label style="font-size:13px">รหัส PIN ใหม่ (4-6 หลัก) *</label>
              <div class="password-wrapper">
                <input type="password" id="forgotPinNew" maxlength="6" pattern="[0-9]{4,6}" placeholder="ตัวเลข 4-6 หลัก" style="letter-spacing:4px;font-size:16px;margin-top:6px">
                <button type="button" class="pw-toggle" onclick="togglePw(this)" tabindex="-1"><i class="fas fa-eye"></i></button>
              </div>
            </div>
            <div class="form-group" style="margin-bottom:0">
              <label style="font-size:13px">ยืนยัน PIN ใหม่ *</label>
              <div class="password-wrapper">
                <input type="password" id="forgotPinConfirm" maxlength="6" pattern="[0-9]{4,6}" placeholder="กรอกซ้ำอีกครั้ง" style="letter-spacing:4px;font-size:16px;margin-top:6px">
                <button type="button" class="pw-toggle" onclick="togglePw(this)" tabindex="-1"><i class="fas fa-eye"></i></button>
              </div>
            </div>
          </div>
          <div id="forgotPinError" style="display:none;background:rgba(239,68,68,0.1);border:1px solid var(--accent-red);border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:13px;color:var(--accent-red)"></div>
          <div style="display:flex;gap:10px;justify-content:flex-end">
            <button class="btn btn-secondary" onclick="App.closeModal()">ยกเลิก</button>
            <button class="btn btn-primary" id="confirmResetPinBtn" style="background:var(--accent-orange);border-color:var(--accent-orange)">
              <i class="fas fa-key"></i> ยืนยันรีเซ็ต PIN
            </button>
          </div>
        </div>
      </div>
    </div>`;
    modal.style.display = 'block';

    document.getElementById('confirmResetPinBtn').onclick = async () => {
      const password = document.getElementById('forgotPinPassword').value;
      const newPin = document.getElementById('forgotPinNew').value.trim();
      const confirmPin = document.getElementById('forgotPinConfirm').value.trim();
      const errBox = document.getElementById('forgotPinError');
      errBox.style.display = 'none';

      if (!password) {
        errBox.innerHTML = '<i class="fas fa-exclamation-circle"></i> กรุณากรอกรหัสผ่านเข้าระบบ';
        errBox.style.display = 'block'; return;
      }
      if (!newPin || newPin.length < 4) {
        errBox.innerHTML = '<i class="fas fa-exclamation-circle"></i> กรุณากรอกรหัส PIN ใหม่ (4-6 หลัก)';
        errBox.style.display = 'block'; return;
      }
      if (newPin !== confirmPin) {
        errBox.innerHTML = '<i class="fas fa-exclamation-circle"></i> รหัส PIN ทั้งสองช่องไม่ตรงกัน';
        errBox.style.display = 'block'; return;
      }

      const btn = document.getElementById('confirmResetPinBtn');
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> กำลังรีเซ็ต...';

      const res = await this.api('/api/profile/reset-pin', { method: 'POST', body: { password, newPin } });

      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-key"></i> ยืนยันรีเซ็ต PIN';

      if (res.error) {
        errBox.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${res.error}`;
        errBox.style.display = 'block'; return;
      }

      this.user.hasPin = true;
      this.closeModal();
      this.toast('รีเซ็ตรหัส PIN สำเร็จแล้ว สามารถใช้รหัส PIN ใหม่ได้ทันที', 'success');
      this.loadProfile();
    };
  },

  // ===== MFA SIGN (OTP) =====
  async showMfaSignModal(docId) {
    const modal = document.getElementById('modal');
    modal.innerHTML = `
    <div class="modal-overlay" onclick="App.closeModal()">
      <div class="modal-content" onclick="event.stopPropagation()" style="max-width:450px">
        <div class="modal-header"><h3><i class="fas fa-shield-alt" style="color:var(--accent-blue)"></i> ยืนยันตัวตน (MFA)</h3><button class="modal-close" onclick="App.closeModal()">&times;</button></div>
        <div class="modal-body">
          <div style="text-align:center;margin-bottom:20px">
            <div style="width:60px;height:60px;border-radius:50%;background:var(--accent-blue)15;color:var(--accent-blue);display:flex;align-items:center;justify-content:center;margin:0 auto 12px;font-size:24px"><i class="fas fa-key"></i></div>
            <p style="color:var(--text-muted);font-size:14px">กรุณายืนยันตัวตนด้วยรหัส OTP ก่อนลงนาม</p>
          </div>
          <div id="otpStep1">
            <button class="btn btn-primary" style="width:100%" onclick="App.requestOtp('${docId}')"><i class="fas fa-paper-plane"></i> ส่งรหัส OTP</button>
          </div>
          <div id="otpStep2" style="display:none">
            <div class="form-group" style="margin-bottom:16px">
              <label><i class="fas fa-lock"></i> รหัส OTP (6 หลัก)</label>
              <input type="text" id="otpInput" maxlength="6" placeholder="กรอกรหัส OTP" style="text-align:center;font-size:24px;letter-spacing:8px;font-weight:700">
              <p id="otpDisplay" style="font-size:12px;color:var(--accent-green);margin-top:8px"></p>
            </div>
            <button class="btn btn-success" style="width:100%" onclick="App.verifyAndSign('${docId}')"><i class="fas fa-signature"></i> ยืนยันและลงนาม</button>
          </div>
        </div>
      </div>
    </div>`;
    modal.style.display = 'block';
  },

  async requestOtp(docId) {
    const data = await this.api('/api/otp/generate', { method: 'POST' });
    if (data.error) { this.toast(data.error, 'error'); return; }
    document.getElementById('otpStep1').style.display = 'none';
    document.getElementById('otpStep2').style.display = 'block';
    // For demo: show OTP
    document.getElementById('otpDisplay').textContent = `(Demo) รหัส OTP ของคุณ: ${data.otp}`;
    this.toast('ส่งรหัส OTP แล้ว', 'success');
  },

  async verifyAndSign(docId) {
    const otp = document.getElementById('otpInput').value.trim();
    if (!otp || otp.length !== 6) { this.toast('กรุณากรอกรหัส OTP 6 หลัก', 'error'); return; }

    // Step 1: Verify OTP
    const verifyData = await this.api('/api/otp/verify', { method: 'POST', body: { otp } });
    if (verifyData.error) { this.toast(verifyData.error, 'error'); return; }

    // Step 2: Sign with OTP
    const signData = await this.api(`/api/documents/${docId}/sign-with-otp`, { method: 'PUT', body: { signatureType: 'approve' } });
    if (signData.error) { this.toast(signData.error, 'error'); return; }

    this.closeModal();
    this.toast('ลงนามเอกสารเรียบร้อย (ยืนยัน MFA)', 'success');
    this.navigate(this.currentPage);
  },

  closeModal() {
    const modal = document.getElementById('modal');
    if (modal) { modal.style.display = 'none'; modal.innerHTML = ''; }
    if (window.location.search.includes('doc=')) {
      window.history.pushState({}, '', window.location.pathname);
    }
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
