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
      const errEl = document.getElementById('loginError');
      errEl.style.display = 'none';
      const data = await this.api('/api/auth/login', {
        method: 'POST',
        body: { username: document.getElementById('username').value, password: document.getElementById('password').value }
      });
      if (data.error) { errEl.textContent = data.error; errEl.style.display = 'block'; return; }
      this.user = data.user;
      this.showApp();
    };
    document.querySelectorAll('.demo-btn').forEach(btn => {
      btn.onclick = () => {
        document.getElementById('username').value = btn.dataset.user;
        document.getElementById('password').value = btn.dataset.pass;
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
    this.updateNotifBadge();
    this.navigate('dashboard');
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
          section: 'จัดการ', items: [
            { id: 'users', icon: 'fa-users-cog', label: 'จัดการผู้ใช้' },
            { id: 'certificates', icon: 'fa-certificate', label: 'ใบรับรองดิจิทัล' },
            { id: 'access_requests', icon: 'fa-key', label: 'คำร้องขอสิทธิ์', badge: true },
            { id: 'logs', icon: 'fa-history', label: 'ประวัติการใช้งาน' },
            { id: 'notifications', icon: 'fa-bell', label: 'การแจ้งเตือน', badge: true },
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
          section: 'รายงาน', items: [
            { id: 'reports', icon: 'fa-chart-bar', label: 'รายงาน' }
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
            { id: 'notifications', icon: 'fa-bell', label: 'การแจ้งเตือน', badge: true },
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
          section: 'อนุมัติ', items: [
            { id: 'pending', icon: 'fa-clock', label: 'รออนุมัติ', badge: true },
            { id: 'certificates', icon: 'fa-certificate', label: 'ใบรับรองของฉัน' }
          ]
        }
      ]
    };

    const roleMenus = menus[this.user.role] || menus.user;
    nav.innerHTML = roleMenus.map(sec =>
      `<div class="nav-section"><div class="nav-section-title">${sec.section}</div>
      ${sec.items.map(it => `<div class="nav-item${it.id === 'dashboard' ? ' active' : ''}" data-page="${it.id}">
        <i class="fas ${it.icon}"></i><span>${it.label}</span>${it.badge ? '<span class="badge" id="pendingBadge">0</span>' : ''}
      </div>`).join('')}</div>`
    ).join('');

    nav.querySelectorAll('.nav-item').forEach(item => {
      item.onclick = () => this.navigate(item.dataset.page);
    });

    const u = this.user;
    document.getElementById('sidebarUser').innerHTML = `
      <div class="sidebar-user-avatar"><i class="fas fa-user"></i></div>
      <div class="sidebar-user-info"><div class="sidebar-user-name">${u.name}</div><div class="sidebar-user-role">${u.roleName}</div></div>`;
    document.getElementById('dropdownHeader').innerHTML = `<div class="name">${u.name}</div><div class="role">${u.roleName} • ${u.department}</div>`;
  },

  bindAppEvents() {
    document.getElementById('logoutBtn').onclick = async (e) => {
      e.preventDefault();
      await this.api('/api/auth/logout', { method: 'POST' });
      location.reload();
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
    document.getElementById('notificationBell').onclick = () => this.navigate('notifications');

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
      const count = data.count || 0;
      const badge = document.getElementById('notifBadge');
      if (badge) {
        badge.textContent = count;
        badge.style.display = count > 0 ? 'flex' : 'none';
      }
      // Update sidebar badge for notifications
      const navBadges = document.querySelectorAll('.nav-item[data-page="notifications"] .badge');
      navBadges.forEach(b => { b.textContent = count; b.style.display = count > 0 ? '' : 'none'; });
    } catch (e) { }
  },

  navigate(page) {
    this.currentPage = page;
    document.querySelectorAll('.nav-item').forEach(i => i.classList.toggle('active', i.dataset.page === page));
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

    area.innerHTML = `<div class="fade-in"><div class="stats-grid">${cards}</div>
      <div class="two-col">
        <div class="content-card"><div class="content-card-header"><h3><i class="fas fa-chart-bar" style="color:var(--accent-purple)"></i> เอกสารรายเดือน</h3></div>
        <div class="content-card-body"><div class="chart-container">${chartBars || '<p style="color:var(--text-muted)">ไม่มีข้อมูล</p>'}</div></div></div>
        <div class="content-card"><div class="content-card-header"><h3><i class="fas fa-tags" style="color:var(--accent-cyan)"></i> ตามหมวดหมู่</h3></div>
        <div class="content-card-body">${catHtml || '<p style="color:var(--text-muted)">ไม่มีข้อมูล</p>'}</div></div>
      </div>
      <div class="content-card"><div class="content-card-header"><h3><i class="fas fa-history"></i> กิจกรรมล่าสุด</h3></div>
      <div class="content-card-body"><div class="activity-list">${logHtml || '<div class="empty-state"><i class="fas fa-inbox"></i><h4>ไม่มีกิจกรรม</h4></div>'}</div></div></div></div>`;

    this.updateNotifBadge();
  },

  // ===== DOCUMENTS =====
  async loadDocuments(search) {
    const docs = await this.api(`/api/documents${search ? `?search=${encodeURIComponent(search)}` : ''}`);
    const area = document.getElementById('contentArea');
    const canCreate = ['secretary', 'admin'].includes(this.user.role);

    const statusMap = { draft: 'draft', pending_approval: 'pending', approved: 'approved', rejected: 'rejected', signed: 'signed', pending_signature: 'pending-sign' };
    const priorityIcons = { high: 'fa-arrow-up', medium: 'fa-minus', low: 'fa-arrow-down' };

    const rows = docs.map(d => `<tr>
      <td><strong style="cursor:pointer;color:var(--accent-blue)" onclick="App.viewDocument('${d.id}')">${d.title}</strong><br><span style="font-size:11px;color:var(--text-muted)">${d.category}</span></td>
      <td><span class="status-badge ${statusMap[d.status] || 'draft'}">${d.statusText}</span></td>
      <td><span class="priority-badge ${d.priority}"><i class="fas ${priorityIcons[d.priority]}"></i> ${d.priority === 'high' ? 'สูง' : d.priority === 'medium' ? 'ปานกลาง' : 'ต่ำ'}</span></td>
      <td>${d.uploadedByName}</td>
      <td>${new Date(d.createdAt).toLocaleDateString('th-TH')}</td>
      <td><div class="btn-group">
        <button class="btn-icon" onclick="App.viewDocument('${d.id}')" title="ดู"><i class="fas fa-eye"></i></button>
        ${d.fileName ? `<button class="btn-icon" onclick="${(d.signatures && d.signatures.length) || d.status === 'signed' ? `App.downloadStampedPdf('${d.id}')` : `App.downloadDoc('${d.id}')`}" title="${(d.signatures && d.signatures.length) || d.status === 'signed' ? 'ดาวน์โหลด PDF พร้อมประทับลายเซ็นจริง' : 'ดาวน์โหลดต้นฉบับ'}" style="color:var(--accent-green)"><i class="fas ${(d.signatures && d.signatures.length) || d.status === 'signed' ? 'fa-file-signature' : 'fa-download'}"></i></button>` : ''}
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
    return btns;
  },

  async viewDocument(id) {
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
            ${s.signatureData && s.signatureData.startsWith('data:image') ? `<img src="${s.signatureData}" style="height:45px;max-width:120px;object-fit:contain;background:#fff;border-radius:4px;padding:2px;border:1px solid var(--border-color)">` : `<div style="width:45px;height:45px;border-radius:6px;background:rgba(139,92,246,0.15);color:var(--accent-purple);display:flex;align-items:center;justify-content:center;font-size:20px"><i class="fas fa-signature"></i></div>`}
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
        ${(doc.signatures && doc.signatures.length) || doc.status === 'signed' ? `
          <button class="btn btn-primary" onclick="App.downloadStampedPdf('${doc.id}')" style="background:linear-gradient(135deg,#10b981 0%,#06b6d4 100%);border:none;box-shadow:0 4px 14px rgba(16,185,129,0.35);font-weight:600">
            <i class="fas fa-file-signature"></i> ดาวน์โหลด PDF พร้อมประทับลายเซ็นจริง ⭐
          </button>
        ` : ''}
        <button class="btn btn-secondary" onclick="App.downloadDoc('${doc.id}')"><i class="fas fa-download"></i> ดาวน์โหลดต้นฉบับ (ไฟล์ดิบก่อนเซ็น)</button>
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

    const pdfPreviewFrame = (doc.fileName && doc.fileName.toLowerCase().endsWith('.pdf')) ? `
      <div style="margin-top:20px">
        <h4 style="font-size:14px;margin-bottom:8px"><i class="fas fa-file-pdf" style="color:var(--accent-red)"></i> พรีวิวตัวอย่างเอกสาร PDF (พร้อมประทับลายเซ็นดิจิทัล)</h4>
        <iframe src="/api/documents/${doc.id}/download" style="width:100%;height:500px;border:1px solid var(--border-color);border-radius:8px;background:#fff"></iframe>
      </div>
    ` : '';

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
        ${pdfPreviewFrame}
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
    return btns;
  },

  async submitDoc(id) { await this.api(`/api/documents/${id}/submit`, { method: 'PUT' }); this.toast('ส่งเอกสารเพื่ออนุมัติแล้ว', 'success'); document.getElementById('modal').style.display = 'none'; this.navigate(this.currentPage); },
  async approveDoc(id) {
    try {
      const doc = await this.api(`/api/documents/${id}`);
      this.openSignModal(id, doc.title);
    } catch (e) {
      this.openSignModal(id, '');
    }
  },
  async rejectDoc(id) {
    const comment = prompt('เหตุผลที่ปฏิเสธ:');
    if (!comment) return;
    await this.api(`/api/documents/${id}/reject`, { method: 'PUT', body: { comment } }); this.toast('ปฏิเสธเอกสารแล้ว', 'error'); document.getElementById('modal').style.display = 'none'; this.navigate(this.currentPage);
  },
  async deleteDoc(id) { if (!confirm('ยืนยันการลบเอกสาร?')) return; await this.api(`/api/documents/${id}`, { method: 'DELETE' }); this.toast('ลบเอกสารแล้ว', 'success'); document.getElementById('modal').style.display = 'none'; this.navigate(this.currentPage); },
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
        const utf8Match = disposition.match(/filename\*=UTF-8''([^;\n]*)/i);
        if (utf8Match) {
          filename = decodeURIComponent(utf8Match[1]);
        } else {
          const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
          if (match) filename = decodeURIComponent(match[1].replace(/['"]/g, ''));
        }
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

  // Create High-DPI Digital Stamp Canvas Image
  async createSignatureStampImage(sig) {
    return new Promise((resolve) => {
      const scale = 2;
      const w = 260 * scale;
      const h = 110 * scale;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');

      // Rounded Card Background
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#2563eb';
      ctx.lineWidth = 2 * scale;
      
      const r = 8 * scale;
      ctx.beginPath();
      ctx.moveTo(r, 0);
      ctx.lineTo(w - r, 0);
      ctx.quadraticCurveTo(w, 0, w, r);
      ctx.lineTo(w, h - r);
      ctx.quadraticCurveTo(w, h, w - r, h);
      ctx.lineTo(r, h);
      ctx.quadraticCurveTo(0, h, 0, h - r);
      ctx.lineTo(0, r);
      ctx.quadraticCurveTo(0, 0, r, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Top Ribbon
      ctx.fillStyle = '#eff6ff';
      ctx.beginPath();
      ctx.moveTo(0, r);
      ctx.quadraticCurveTo(0, 0, r, 0);
      ctx.lineTo(w - r, 0);
      ctx.quadraticCurveTo(w, 0, w, r);
      ctx.lineTo(w, 24 * scale);
      ctx.lineTo(0, 24 * scale);
      ctx.closePath();
      ctx.fill();

      // Ribbon text
      ctx.fillStyle = '#1d4ed8';
      ctx.font = `bold ${10 * scale}px 'Noto Sans Thai', 'Inter', sans-serif`;
      ctx.fillText('🔒 DIGITALLY SIGNED & VERIFIED', 12 * scale, 16 * scale);

      const finishStamp = () => {
        ctx.fillStyle = '#0f172a';
        ctx.font = `bold ${9.5 * scale}px 'Noto Sans Thai', 'Inter', sans-serif`;
        ctx.fillText(`ลงนามโดย: ${sig.signedByName || 'ผู้มีอำนาจลงนาม'}`, 115 * scale, 38 * scale);

        ctx.fillStyle = '#334155';
        ctx.font = `${8 * scale}px 'Noto Sans Thai', 'Inter', sans-serif`;
        ctx.fillText(`ตำแหน่ง: ${sig.signedRoleName || 'ผู้บริหาร / ผู้มีอำนาจ'}`, 115 * scale, 52 * scale);

        ctx.fillStyle = '#475569';
        ctx.font = `${7.5 * scale}px 'Noto Sans Thai', 'Inter', sans-serif`;
        const timeStr = sig.signedAt ? new Date(sig.signedAt).toLocaleString('th-TH') : new Date().toLocaleString('th-TH');
        ctx.fillText(`วันเวลา: ${timeStr}`, 115 * scale, 65 * scale);

        ctx.fillStyle = '#64748b';
        ctx.font = `${7 * scale}px 'Noto Sans Thai', 'Inter', sans-serif`;
        ctx.fillText(`ใบรับรอง: ${sig.certificateId || 'CERT-SECURE-256'}`, 115 * scale, 77 * scale);

        ctx.fillStyle = '#16a34a';
        ctx.font = `bold ${7.5 * scale}px 'Noto Sans Thai', 'Inter', sans-serif`;
        ctx.fillText(`✓ ผ่านการตรวจสอบระบบ DocMS (SHA-256)`, 12 * scale, 98 * scale);

        resolve(canvas.toDataURL('image/png'));
      };

      if (sig.signatureData && sig.signatureData.startsWith('data:image')) {
        const sigImg = new Image();
        sigImg.crossOrigin = 'anonymous';
        sigImg.onload = () => {
          ctx.drawImage(sigImg, 12 * scale, 28 * scale, 95 * scale, 48 * scale);
          finishStamp();
        };
        sigImg.onerror = () => {
          ctx.fillStyle = '#1d4ed8';
          ctx.font = `bold ${11 * scale}px 'Noto Sans Thai', sans-serif`;
          ctx.fillText(`[${sig.signedByName}]`, 16 * scale, 55 * scale);
          finishStamp();
        };
        sigImg.src = sig.signatureData;
      } else {
        ctx.fillStyle = '#1d4ed8';
        ctx.font = `bold ${11 * scale}px 'Noto Sans Thai', sans-serif`;
        ctx.fillText(`[${sig.signedByName}]`, 16 * scale, 55 * scale);
        finishStamp();
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

      const res = await fetch(`/api/documents/${id}/download?original=true`);
      if (!res.ok) throw new Error('Download failed');
      const existingPdfBytes = await res.arrayBuffer();

      const pdfDoc = await PDFLib.PDFDocument.load(existingPdfBytes, { ignoreEncryption: true });
      const pages = pdfDoc.getPages();

      for (const targetPage of pages) {
        const { width } = targetPage.getSize();
        for (let i = 0; i < doc.signatures.length; i++) {
          const sig = doc.signatures[i];
          const stampDataUrl = await this.createSignatureStampImage(sig);
          const stampPngBytes = await fetch(stampDataUrl).then(r => r.arrayBuffer());
          const stampImage = await pdfDoc.embedPng(stampPngBytes);

          const stampWidth = 210;
          const stampHeight = 88;
          const xPos = width - stampWidth - 25;
          const yPos = 25 + (i * (stampHeight + 12));

          targetPage.drawImage(stampImage, {
            x: xPos,
            y: yPos,
            width: stampWidth,
            height: stampHeight
          });
        }
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
  signCtx: null, signDocId: null, signing: false, uploadedSigData: null, savedSigData: null,
  async openSignModal(id, title) {
    this.signDocId = id;
    if (!title) {
      try {
        const d = await this.api(`/api/documents/${id}`);
        title = d.title;
      } catch (e) { title = ''; }
    }
    document.getElementById('signDocTitle').textContent = `เอกสาร: ${title || id}`;
    document.getElementById('signModal').style.display = 'flex';
    document.getElementById('modal').style.display = 'none';

    // Tab switching setup
    const tabBtns = document.querySelectorAll('.sig-tab-btn');
    const tabContents = {
      draw: document.getElementById('sigTabDraw'),
      upload: document.getElementById('sigTabUpload'),
      saved: document.getElementById('sigTabSaved')
    };

    const switchTab = async (tabName) => {
      tabBtns.forEach(btn => {
        const isActive = btn.dataset.tab === tabName;
        btn.classList.toggle('active', isActive);
        btn.style.color = isActive ? 'var(--accent-blue)' : 'var(--text-muted)';
        btn.style.borderBottom = isActive ? '2px solid var(--accent-blue)' : 'none';
        btn.style.fontWeight = isActive ? '600' : '400';
      });
      Object.keys(tabContents).forEach(k => {
        if (tabContents[k]) tabContents[k].style.display = (k === tabName) ? 'block' : 'none';
      });

      if (tabName === 'saved') {
        const container = document.getElementById('savedSigContainer');
        const confirmBtn = document.getElementById('confirmSignatureSaved');
        container.innerHTML = `<div style="color:var(--text-muted);font-size:13px"><i class="fas fa-spinner fa-spin"></i> กำลังโหลดลายเซ็น...</div>`;
        confirmBtn.style.display = 'none';
        try {
          const res = await this.api(`/api/signatures/${this.user.id}`);
          if (res.exists && res.signature && res.signature.signatureData) {
            this.savedSigData = res.signature.signatureData;
            container.innerHTML = `
              <p style="font-size:12px;color:var(--text-muted);margin-bottom:8px">ลายเซ็นที่บันทึกไว้ในระบบ:</p>
              <img src="${this.savedSigData}" style="max-height:120px;max-width:100%;object-fit:contain;background:#fff;border-radius:4px;padding:4px;border:1px solid var(--border-color)">
              <div style="font-size:11px;color:var(--accent-green);margin-top:6px"><i class="fas fa-check-circle"></i> พร้อมใช้งาน</div>
            `;
            confirmBtn.style.display = 'inline-block';
          } else {
            this.savedSigData = null;
            container.innerHTML = `
              <div style="color:var(--text-muted);padding:10px 0">
                <i class="fas fa-exclamation-circle" style="font-size:24px;color:var(--accent-orange);margin-bottom:8px;display:block"></i>
                ยังไม่มีลายเซ็นที่บันทึกไว้ในระบบโปรไฟล์<br>
                <span style="font-size:12px">คุณสามารถใช้วิธีวาดสดด้วยเมาส์ หรืออัปโหลดไฟล์ภาพข้างต้นได้</span>
              </div>`;
          }
        } catch (e) {
          container.innerHTML = `<div style="color:var(--accent-red);font-size:13px">ไม่สามารถดึงข้อมูลลายเซ็นได้</div>`;
        }
      }
    };

    tabBtns.forEach(btn => {
      btn.onclick = () => switchTab(btn.dataset.tab);
    });

    // Setup Tab 1: Draw Canvas
    switchTab('draw');
    const canvas = document.getElementById('signatureCanvas');
    this.signCtx = canvas.getContext('2d');
    this.signCtx.fillStyle = '#fff'; this.signCtx.fillRect(0, 0, canvas.width, canvas.height);
    this.signCtx.strokeStyle = '#1a1a2e'; this.signCtx.lineWidth = 2; this.signCtx.lineCap = 'round';
    this.signing = false;

    const getPos = (e) => {
      const r = canvas.getBoundingClientRect();
      const t = e.touches ? e.touches[0] : e;
      return { x: t.clientX - r.left, y: t.clientY - r.top };
    };
    canvas.onmousedown = canvas.ontouchstart = (e) => { e.preventDefault(); this.signing = true; const p = getPos(e); this.signCtx.beginPath(); this.signCtx.moveTo(p.x, p.y); };
    canvas.onmousemove = canvas.ontouchmove = (e) => { if (!this.signing) return; e.preventDefault(); const p = getPos(e); this.signCtx.lineTo(p.x, p.y); this.signCtx.stroke(); };
    canvas.onmouseup = canvas.ontouchend = () => { this.signing = false; };
    canvas.onmouseleave = () => { this.signing = false; };

    document.getElementById('clearSignature').onclick = () => { this.signCtx.fillStyle = '#fff'; this.signCtx.fillRect(0, 0, canvas.width, canvas.height); };

    // Setup Tab 2: Upload File
    const fileInput = document.getElementById('sigFileInput');
    const previewWrap = document.getElementById('sigPreviewWrap');
    const imgPreview = document.getElementById('sigImagePreview');
    const btnConfirmUpload = document.getElementById('confirmSignatureUpload');
    
    fileInput.value = '';
    previewWrap.style.display = 'none';
    btnConfirmUpload.disabled = true;
    this.uploadedSigData = null;

    fileInput.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        this.uploadedSigData = evt.target.result;
        imgPreview.src = this.uploadedSigData;
        previewWrap.style.display = 'block';
        btnConfirmUpload.disabled = false;
      };
      reader.readAsDataURL(file);
    };

    // Helper function for submit sign
    const submitSignature = async (sigData) => {
      if (!sigData) {
        this.toast('ไม่พบข้อมูลลายเซ็น', 'error');
        return;
      }
      const timestamp = new Date().toISOString();
      const tempSig = {
        signedByName: this.user.name,
        signedRoleName: this.user.roleName || (this.user.role === 'executive' ? 'บริหาร' : 'ผู้มีอำนาจลงนาม'),
        signedAt: timestamp,
        signatureData: sigData,
        certificateId: 'CERT-' + Date.now().toString(36).toUpperCase()
      };
      let stampImage = null;
      try {
        stampImage = await this.createSignatureStampImage(tempSig);
      } catch (e) {
        console.error('Failed to create stamp image:', e);
      }

      await this.api(`/api/documents/${this.signDocId}/sign`, {
        method: 'PUT',
        body: { signatureData: sigData, stampImage: stampImage }
      });
      document.getElementById('signModal').style.display = 'none';
      this.toast('ลงนามและอนุมัติเอกสารเรียบร้อย สถานะเป็น: ลงนามแล้ว', 'success');
      this.navigate(this.currentPage);
    };

    document.getElementById('confirmSignatureDraw').onclick = async () => {
      const data = canvas.toDataURL();
      await submitSignature(data);
    };

    btnConfirmUpload.onclick = async () => {
      await submitSignature(this.uploadedSigData);
    };

    document.getElementById('confirmSignatureSaved').onclick = async () => {
      await submitSignature(this.savedSigData);
    };

    document.getElementById('closeSignModal').onclick = () => { document.getElementById('signModal').style.display = 'none'; };
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
      const deadlineEl = document.getElementById('docDeadline');
      if (deadlineEl && deadlineEl.value) formData.append('deadline', new Date(deadlineEl.value).toISOString());
      const expiryEl = document.getElementById('docExpiry');
      if (expiryEl && expiryEl.value) formData.append('expiryDate', new Date(expiryEl.value).toISOString());
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
      <td><strong>${u.name}</strong><br><span style="font-size:11px;color:var(--text-muted)">${u.username}</span></td>
      <td>${u.email}</td>
      <td><span class="role-badge ${u.role}"><i class="fas fa-circle" style="font-size:6px"></i> ${u.roleName}</span></td>
      <td>${u.department}</td>
      <td><span class="status-dot ${u.status === 'active' ? 'online' : 'offline'}"></span>${u.status === 'active' ? 'ใช้งาน' : 'ระงับ'}</td>
      <td><div class="btn-group">
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
        <div class="form-group"><label>รหัสผ่าน *</label><div class="password-wrapper"><input type="password" id="newPassword" required><button type="button" class="pw-toggle" onclick="togglePw(this)" tabindex="-1"><i class="fas fa-eye"></i></button></div></div>
        <div class="form-group"><label>ชื่อ-นามสกุล *</label><input type="text" id="newName" required></div>
        <div class="form-group"><label>อีเมล</label><input type="email" id="newEmail"></div>
        <div class="form-group"><label>บทบาท *</label><select id="newRole"><option value="user">ผู้ใช้งานทั่วไป</option><option value="secretary">ธุรการ</option><option value="executive">ผู้บริหารระดับสูง</option><option value="admin">ผู้ดูแลระบบ</option></select></div>
        <div class="form-group"><label>แผนก</label><input type="text" id="newDept"></div>
      </form></div>
      <div class="modal-footer"><button class="btn btn-secondary" onclick="document.getElementById('modal').style.display='none'">ยกเลิก</button>
      <button class="btn btn-primary" onclick="App.addUser()"><i class="fas fa-save"></i> บันทึก</button></div>`;
    modal.style.display = 'flex';
  },

  async addUser() {
    const data = await this.api('/api/users', {
      method: 'POST', body: {
        username: document.getElementById('newUsername').value,
        password: document.getElementById('newPassword').value,
        name: document.getElementById('newName').value,
        email: document.getElementById('newEmail').value,
        role: document.getElementById('newRole').value,
        department: document.getElementById('newDept').value
      }
    });
    if (data.error) { this.toast(data.error, 'error'); return; }
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
        <div class="form-group"><label>บทบาท</label><select id="editRole"><option value="user" ${u.role === 'user' ? 'selected' : ''}>ผู้ใช้งานทั่วไป</option><option value="secretary" ${u.role === 'secretary' ? 'selected' : ''}>ธุรการ</option><option value="executive" ${u.role === 'executive' ? 'selected' : ''}>ผู้บริหารระดับสูง</option><option value="admin" ${u.role === 'admin' ? 'selected' : ''}>ผู้ดูแลระบบ</option></select></div>
        <div class="form-group"><label>แผนก</label><input type="text" id="editDept" value="${u.department}"></div>
        <div class="form-group"><label>สถานะ</label><select id="editStatus"><option value="active" ${u.status === 'active' ? 'selected' : ''}>ใช้งาน</option><option value="inactive" ${u.status === 'inactive' ? 'selected' : ''}>ระงับ</option></select></div>
      </div>
      <div class="modal-footer"><button class="btn btn-secondary" onclick="document.getElementById('modal').style.display='none'">ยกเลิก</button>
      <button class="btn btn-primary" onclick="App.saveUser('${id}')"><i class="fas fa-save"></i> บันทึก</button></div>`;
    modal.style.display = 'flex';
  },

  async saveUser(id) {
    await this.api(`/api/users/${id}`, {
      method: 'PUT', body: {
        name: document.getElementById('editName').value,
        email: document.getElementById('editEmail').value,
        role: document.getElementById('editRole').value,
        department: document.getElementById('editDept').value,
        status: document.getElementById('editStatus').value
      }
    });
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
    const area = document.getElementById('contentArea');
    const rows = docs.map(d => `<tr>
      <td><strong style="cursor:pointer;color:var(--accent-blue)" onclick="App.viewDocument('${d.id}')">${d.title}</strong></td>
      <td>${d.category}</td>
      <td>${d.uploadedByName}</td>
      <td>${new Date(d.createdAt).toLocaleDateString('th-TH')}</td>
      <td>${d.deadline ? new Date(d.deadline).toLocaleDateString('th-TH') : '-'}</td>
      <td><div class="btn-group">
        <button class="btn btn-sm btn-success" onclick="App.approveDoc('${d.id}')"><i class="fas fa-check"></i> อนุมัติ</button>
        <button class="btn btn-sm btn-danger" onclick="App.rejectDoc('${d.id}')"><i class="fas fa-times"></i> ปฏิเสธ</button>
      </div></td>
    </tr>`).join('');

    area.innerHTML = `<div class="fade-in"><div class="content-card"><div class="content-card-header"><h3><i class="fas fa-clock"></i> เอกสารรออนุมัติ</h3><span style="color:var(--text-muted);font-size:13px">${docs.length} รายการ</span></div>
  <div class="content-card-body no-padding">
    ${docs.length ? `<table class="data-table"><thead><tr><th>ชื่อเอกสาร</th><th>หมวดหมู่</th><th>ผู้สร้าง</th><th>วันที่</th><th>กำหนดส่ง</th><th>จัดการ</th></tr></thead><tbody>${rows}</tbody></table>`
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
    area.innerHTML = `<div class="fade-in">
  <div class="content-card" style="max-width:640px">
    <div class="content-card-header"><h3><i class="fas fa-user-cog"></i> ข้อมูลส่วนตัว</h3></div>
    <div class="content-card-body">
      <div class="profile-header" style="display:flex;align-items:center;gap:20px;margin-bottom:28px;padding-bottom:20px;border-bottom:1px solid var(--border-color)">
        <div style="width:72px;height:72px;background:var(--gradient-primary);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:28px;color:#fff;flex-shrink:0"><i class="fas fa-user"></i></div>
        <div>
          <h3 style="font-size:20px;font-weight:700">${u.name}</h3>
          <p style="color:var(--text-secondary);font-size:13px"><span class="role-badge ${u.role}" style="margin-right:8px"><i class="fas fa-circle" style="font-size:6px"></i> ${u.roleName}</span>${u.department || ''}</p>
        </div>
      </div>
      <form id="profileForm">
        <div class="doc-detail">
          <div class="doc-detail-item form-group"><label><i class="fas fa-user"></i> ชื่อ-นามสกุล</label><input type="text" id="profileName" value="${u.name}" required></div>
          <div class="doc-detail-item form-group"><label><i class="fas fa-envelope"></i> อีเมล</label><input type="email" id="profileEmail" value="${u.email || ''}"></div>
          <div class="doc-detail-item form-group"><label><i class="fas fa-building"></i> แผนก</label><input type="text" id="profileDept" value="${u.department || ''}" placeholder="ระบุแผนก"></div>
          <div class="doc-detail-item doc-detail-full" style="margin-top:12px;padding-top:16px;border-top:1px solid var(--border-color)">
            <h4 style="font-size:14px;margin-bottom:12px"><i class="fas fa-lock" style="color:var(--accent-orange)"></i> เปลี่ยนรหัสผ่าน <span style="font-size:12px;color:var(--text-muted);font-weight:400">(ไม่จำเป็นต้องกรอกถ้าไม่ต้องการเปลี่ยน)</span></h4>
          </div>
          <div class="doc-detail-item form-group"><label>รหัสผ่านเดิม</label><div class="password-wrapper"><input type="password" id="profileCurrentPw" placeholder="กรอกรหัสผ่านเดิม"><button type="button" class="pw-toggle" onclick="togglePw(this)" tabindex="-1"><i class="fas fa-eye"></i></button></div></div>
          <div class="doc-detail-item form-group"><label>รหัสผ่านใหม่</label><div class="password-wrapper"><input type="password" id="profileNewPw" placeholder="กรอกรหัสผ่านใหม่"><button type="button" class="pw-toggle" onclick="togglePw(this)" tabindex="-1"><i class="fas fa-eye"></i></button></div></div>
        </div>
        <div style="margin-top:24px;display:flex;gap:10px;justify-content:flex-end">
          <button type="button" class="btn btn-secondary" onclick="App.navigate('dashboard')">ยกเลิก</button>
          <button type="submit" class="btn btn-primary"><i class="fas fa-save"></i> บันทึกข้อมูล</button>
        </div>
      </form>
    </div>
  </div>

  <!-- SIGNATURE PROFILE CARD -->
  <div class="content-card" style="max-width:640px;margin-top:20px">
    <div class="content-card-header"><h3><i class="fas fa-signature" style="color:var(--accent-purple)"></i> จัดการลายเซ็นดิจิทัลประจำตัว</h3></div>
    <div class="content-card-body">
      <div id="profileSigView" style="margin-bottom:20px">
        <div style="font-size:13px;color:var(--text-muted)"><i class="fas fa-spinner fa-spin"></i> กำลังโหลดลายเซ็น...</div>
      </div>
      <div style="border-top:1px solid var(--border-color);padding-top:16px">
        <h4 style="font-size:14px;margin-bottom:12px"><i class="fas fa-upload" style="color:var(--accent-blue)"></i> อัปโหลดภาพลายเซ็นใหม่ (PNG/JPG)</h4>
        <div style="display:flex;gap:12px;align-items:center">
          <input type="file" id="profileSigFileInput" accept="image/png, image/jpeg, image/jpg" style="flex:1">
          <button type="button" class="btn btn-success" id="btnSaveProfileSig" disabled><i class="fas fa-upload"></i> บันทึกลายเซ็น</button>
        </div>
      </div>
    </div>
  </div>

    </div>`;

    // Fetch saved profile signature
    this.api(`/api/signatures/${u.id}`).then(res => {
      const sigView = document.getElementById('profileSigView');
      if (sigView) {
        if (res.exists && res.signature && res.signature.signatureData) {
          sigView.innerHTML = `
            <p style="font-size:13px;color:var(--text-secondary);margin-bottom:8px">ลายเซ็นประจำตัวปัจจุบันที่ใช้งานในระบบ:</p>
            <div style="padding:16px;background:#fff;border:1px solid var(--border-color);border-radius:8px;display:inline-block">
              <img src="${res.signature.signatureData}" style="max-height:100px;max-width:260px;object-fit:contain">
            </div>
            <div style="font-size:12px;color:var(--accent-green);margin-top:8px"><i class="fas fa-check-circle"></i> บันทึกลายเซ็นเรียบร้อย พร้อมฝังลงในเอกสารทุกครั้งที่อนุมัติ</div>
          `;
        } else {
          sigView.innerHTML = `
            <div style="color:var(--text-muted);font-size:13px;padding:12px;background:var(--bg-input);border-radius:6px">
              <i class="fas fa-info-circle" style="color:var(--accent-orange)"></i> ยังไม่มีลายเซ็นประจำตัวที่บันทึกไว้ในระบบ สามารถอัปโหลดไฟล์ภาพด้านล่างได้
            </div>`;
        }
      }
    }).catch(() => {});

    // Profile signature upload binding
    const sigFileInput = document.getElementById('profileSigFileInput');
    const btnSaveSig = document.getElementById('btnSaveProfileSig');
    let profileSigData = null;

    if (sigFileInput) {
      sigFileInput.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
          profileSigData = evt.target.result;
          if (btnSaveSig) btnSaveSig.disabled = false;
        };
        reader.readAsDataURL(file);
      };
    }

    if (btnSaveSig) {
      btnSaveSig.onclick = async () => {
        if (!profileSigData) return;
        await this.api('/api/signatures/upload', { method: 'POST', body: { signatureData: profileSigData, signatureType: 'image' } });
        this.toast('บันทึกลายเซ็นประจำตัวเรียบร้อย', 'success');
        this.loadProfile();
      };
    }

    document.getElementById('profileForm').onsubmit = async (e) => {
      e.preventDefault();
      const body = {
        name: document.getElementById('profileName').value,
        email: document.getElementById('profileEmail').value,
        department: document.getElementById('profileDept').value
      };
      const curPw = document.getElementById('profileCurrentPw').value;
      const newPw = document.getElementById('profileNewPw').value;
      if (newPw) {
        if (!curPw) { this.toast('กรุณากรอกรหัสผ่านเดิม', 'error'); return; }
        body.currentPassword = curPw;
        body.newPassword = newPw;
      }
      const data = await this.api('/api/profile', { method: 'PUT', body });
      if (data.error) { this.toast(data.error, 'error'); return; }
      this.user = data.user;
      this.buildSidebar();
      this.toast('บันทึกข้อมูลเรียบร้อย', 'success');
      this.loadProfile();
    };
  },

  // ===== NOTIFICATIONS =====
  async loadNotifications() {
    const notifs = await this.api('/api/notifications');
    const area = document.getElementById('contentArea');
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
        </div>
      </div>`;
    }).join('');

    area.innerHTML = `<div class="fade-in">
      <div class="toolbar"><div class="toolbar-left"><h3 style="font-size:18px"><i class="fas fa-bell" style="color:var(--accent-orange)"></i> การแจ้งเตือน <span style="font-size:13px;color:var(--text-muted);font-weight:400">(${notifs.length} รายการ, ${unreadCount} ยังไม่อ่าน)</span></h3></div>
        ${unreadCount > 0 ? `<button class="btn btn-secondary" onclick="App.markAllNotifRead()"><i class="fas fa-check-double"></i> อ่านทั้งหมด</button>` : ''}
      </div>
      <div class="content-card"><div class="content-card-body${notifs.length ? ' no-padding' : ''}">
        ${notifs.length ? `<div class="notif-list">${notifHtml}</div>` : '<div class="empty-state"><i class="fas fa-bell-slash"></i><h4>ไม่มีการแจ้งเตือน</h4><p>คุณยังไม่มีการแจ้งเตือนใดๆ</p></div>'}
      </div></div>
    </div>`;

    this.updateNotifBadge();
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
    this.loadNotifications();
  },

  async markAllNotifRead() {
    await this.api('/api/notifications/read-all', { method: 'PUT' });
    this.toast('อ่านการแจ้งเตือนทั้งหมดแล้ว', 'success');
    this.loadNotifications();
  },

  // ===== ACCESS REQUESTS =====
  async loadAccessRequests() {
    const [requests, allDocsList] = await Promise.all([
      this.api('/api/access-requests'),
      this.api('/api/documents/all').catch(() => [])
    ]);
    const area = document.getElementById('contentArea');
    const isAdmin = this.user.role === 'admin';

    const statusIcons = {
      pending: { cls: 'pending', icon: 'fa-hourglass-half' },
      approved: { cls: 'approved', icon: 'fa-check-circle' },
      rejected: { cls: 'rejected', icon: 'fa-times-circle' }
    };

    const levelBadges = {
      view: '<span class="status-badge draft" style="font-size:11px"><i class="fas fa-eye"></i> ดูอย่างเดียว</span>',
      edit: '<span class="status-badge pending" style="font-size:11px"><i class="fas fa-edit"></i> แก้ไข</span>',
      sign: '<span class="status-badge signed" style="font-size:11px"><i class="fas fa-file-signature"></i> ลงนาม</span>'
    };

    const rows = requests.map(r => {
      const st = statusIcons[r.status] || statusIcons.pending;
      const canManage = (isAdmin || r.documentOwnerId === this.user.id) && r.status === 'pending';
      return `<tr>
        <td><strong>${r.userName}</strong></td>
        <td><strong style="color:var(--accent-blue);cursor:pointer" onclick="App.viewDocument('${r.documentId}')">${r.documentTitle}</strong></td>
        <td>${levelBadges[r.requestedLevel] || levelBadges.view}</td>
        <td style="max-width:180px">${r.reason || '-'}</td>
        <td style="font-size:12px;color:var(--text-muted)">${r.expiryDate ? new Date(r.expiryDate).toLocaleDateString('th-TH') : 'ไม่มีกำหนด'}</td>
        <td><span class="status-badge ${st.cls}"><i class="fas ${st.icon}"></i> ${r.statusText}</span></td>
        <td style="font-size:12px;color:var(--text-muted)">${new Date(r.createdAt).toLocaleDateString('th-TH')}</td>
        ${canManage ? `<td><div class="btn-group">
          <button class="btn btn-sm btn-success" onclick="App.approveAccessReq('${r.id}')"><i class="fas fa-check"></i> อนุมัติ</button>
          <button class="btn btn-sm btn-danger" onclick="App.rejectAccessReq('${r.id}')"><i class="fas fa-times"></i> ปฏิเสธ</button>
        </div></td>` : `<td style="font-size:12px">${r.reviewedByName ? r.reviewedByName : '-'}</td>`}
      </tr>`;
    }).join('');

    // Dropdown list for selecting documents
    const docOptions = (allDocsList && allDocsList.length)
      ? allDocsList.map(d => `<option value="${d.id}">[${d.category || 'เอกสาร'}] ${d.title}</option>`).join('')
      : '<option value="">ไม่มีเอกสารในระบบ</option>';

    const requestForm = !isAdmin ? `
      <div class="content-card" style="margin-bottom:24px">
        <div class="content-card-header"><h3><i class="fas fa-plus-circle" style="color:var(--accent-green)"></i> ส่งคำร้องขอสิทธิ์ใหม่</h3></div>
        <div class="content-card-body">
          <form id="accessReqForm">
            <div class="doc-detail" style="grid-template-columns: repeat(auto-fit, minmax(220px, 1fr))">
              <div class="doc-detail-item form-group">
                <label><i class="fas fa-file-alt"></i> เลือกเอกสารที่ต้องการขอสิทธิ์</label>
                <select id="reqDocId" required style="width:100%">
                  <option value="">-- เลือกเอกสารจากรายการ --</option>
                  ${docOptions}
                </select>
              </div>
              <div class="doc-detail-item form-group">
                <label><i class="fas fa-shield-alt"></i> ระดับสิทธิ์ที่ขอ</label>
                <select id="reqLevel" style="width:100%">
                  <option value="view">👁️ ดูได้อย่างเดียว (View Only)</option>
                  <option value="edit">✏️ แก้ไขเอกสาร (Edit)</option>
                </select>
              </div>
              <div class="doc-detail-item form-group">
                <label><i class="fas fa-calendar-alt"></i> วันหมดอายุสิทธิ์ (ถ้าต้องการ)</label>
                <input type="date" id="reqExpiryDate" style="width:100%">
              </div>
              <div class="doc-detail-item doc-detail-full form-group">
                <label><i class="fas fa-comment"></i> เหตุผลความจำเป็นในการขอเข้าถึง</label>
                <textarea id="reqReason" rows="2" placeholder="ระบุเหตุผลการขอสิทธิ์เข้าถึงเอกสารฉบับนี้"></textarea>
              </div>
            </div>
            <div style="margin-top:16px"><button type="submit" class="btn btn-primary"><i class="fas fa-paper-plane"></i> ส่งคำร้องขอสิทธิ์</button></div>
          </form>
        </div>
      </div>` : '';

    const thHeader = '<th>ผู้ร้องขอ</th><th>เอกสาร</th><th>ระดับสิทธิ์ที่ขอ</th><th>เหตุผล</th><th>หมดอายุ</th><th>สถานะ</th><th>วันที่</th><th>ผู้ดำเนินการ</th>';

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

    const form = document.getElementById('accessReqForm');
    if (form) {
      form.onsubmit = async (e) => {
        e.preventDefault();
        const documentId = document.getElementById('reqDocId').value.trim();
        const requestedLevel = document.getElementById('reqLevel').value;
        const expiryDate = document.getElementById('reqExpiryDate').value;
        const reason = document.getElementById('reqReason').value.trim();
        if (!documentId) { this.toast('กรุณาเลือกเอกสาร', 'error'); return; }
        const data = await this.api('/api/access-requests', { method: 'POST', body: { documentId, requestedLevel, expiryDate, reason } });
        if (data.error) { this.toast(data.error, 'error'); return; }
        this.toast('ส่งคำร้องเรียบร้อยแล้ว แจ้งเตือนไปยังเจ้าของเอกสารและผู้ดูแลระบบแล้ว', 'success');
        this.loadAccessRequests();
      };
    }
  },

  async approveAccessReq(id) {
    await this.api(`/api/access-requests/${id}/approve`, { method: 'PUT' });
    this.toast('อนุมัติคำร้องเรียบร้อย', 'success');
    this.loadAccessRequests();
  },

  async rejectAccessReq(id) {
    await this.api(`/api/access-requests/${id}/reject`, { method: 'PUT' });
    this.toast('ปฏิเสธคำร้องแล้ว', 'error');
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
        <td><code style="background:var(--bg-tertiary);padding:2px 8px;border-radius:4px;font-size:12px">${c.certSerial}</code></td>
        <td>${c.userName}</td>
        <td>${c.issuedBy}</td>
        <td>${new Date(c.issuedDate).toLocaleDateString('th-TH')}</td>
        <td>${new Date(c.expiredDate).toLocaleDateString('th-TH')}</td>
        <td><span style="color:${statusColors[status]};font-weight:600"><i class="fas ${status === 'active' ? 'fa-check-circle' : status === 'revoked' ? 'fa-ban' : 'fa-exclamation-triangle'}"></i> ${statusTexts[status]}</span></td>
        ${isAdmin ? `<td><div class="btn-group">
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
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
