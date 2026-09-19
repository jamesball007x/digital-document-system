// ============================
// core/nav.js — Sidebar, Navigation, Badges, Zoom
// ============================

import { api } from './api.js';

// ─── Sidebar Menu Config ───────────────────────────────────────────────
const MENUS = {
  admin: [
    {
      section: 'หลัก', items: [
        { id: 'dashboard',       icon: 'fa-chart-pie',     label: 'แดชบอร์ด' },
        { id: 'documents',       icon: 'fa-folder-open',   label: 'เอกสารทั้งหมด' }
      ]
    },
    {
      section: 'จัดการ', items: [
        { id: 'users',           icon: 'fa-users-cog',     label: 'จัดการผู้ใช้' },
        { id: 'certificates',    icon: 'fa-certificate',   label: 'ใบรับรองดิจิทัล' },
        { id: 'access_requests', icon: 'fa-key',           label: 'คำร้องขอสิทธิ์', badge: true },
        { id: 'logs',            icon: 'fa-history',       label: 'ประวัติการใช้งาน' },
        { id: 'notifications',   icon: 'fa-bell',          label: 'การแจ้งเตือน',   badge: true },
        { id: 'system',          icon: 'fa-server',        label: 'สถานะระบบ' }
      ]
    }
  ],
  secretary: [
    {
      section: 'หลัก', items: [
        { id: 'dashboard',  icon: 'fa-chart-pie',         label: 'แดชบอร์ด' },
        { id: 'documents',  icon: 'fa-folder-open',       label: 'เอกสารทั้งหมด' },
        { id: 'upload',     icon: 'fa-cloud-upload-alt',  label: 'สร้างเอกสาร' }
      ]
    },
    {
      section: 'รายงาน', items: [
        { id: 'reports',    icon: 'fa-chart-bar',         label: 'รายงาน' }
      ]
    }
  ],
  user: [
    {
      section: 'หลัก', items: [
        { id: 'dashboard',       icon: 'fa-chart-pie',   label: 'แดชบอร์ด' },
        { id: 'documents',       icon: 'fa-folder-open', label: 'เอกสารของฉัน' }
      ]
    },
    {
      section: 'จัดการ', items: [
        { id: 'profile',         icon: 'fa-user-cog',    label: 'ข้อมูลส่วนตัว' },
        { id: 'notifications',   icon: 'fa-bell',        label: 'การแจ้งเตือน',        badge: true },
        { id: 'access_requests', icon: 'fa-key',         label: 'ขอสิทธิ์เอกสาร' },
        { id: 'my_logs',         icon: 'fa-history',     label: 'ประวัติการดำเนินการ' }
      ]
    }
  ],
  executive: [
    {
      section: 'หลัก', items: [
        { id: 'dashboard',    icon: 'fa-chart-pie',   label: 'แดชบอร์ด' },
        { id: 'documents',    icon: 'fa-folder-open', label: 'เอกสารทั้งหมด' }
      ]
    },
    {
      section: 'อนุมัติ', items: [
        { id: 'pending',      icon: 'fa-clock',       label: 'รออนุมัติ',       badge: true },
        { id: 'certificates', icon: 'fa-certificate', label: 'ใบรับรองของฉัน' }
      ]
    }
  ]
};

const PAGE_LABELS = {
  dashboard: 'แดชบอร์ด', documents: 'เอกสาร', users: 'จัดการผู้ใช้',
  logs: 'ประวัติการใช้งาน', system: 'สถานะระบบ', upload: 'สร้างเอกสาร',
  reports: 'รายงาน', pending: 'รออนุมัติ', profile: 'ข้อมูลส่วนตัว',
  notifications: 'การแจ้งเตือน', access_requests: 'ขอสิทธิ์เอกสาร',
  my_logs: 'ประวัติการดำเนินการ', certificates: 'ใบรับรองดิจิทัล'
};

// ─── Sidebar ────────────────────────────────────────────────────────────
export function buildSidebar(App) {
  const nav      = document.getElementById('sidebarNav');
  const roleMenu = MENUS[App.user.role] || MENUS.user;

  nav.innerHTML = roleMenu.map(sec =>
    `<div class="nav-section"><div class="nav-section-title">${sec.section}</div>
    ${sec.items.map(it =>
      `<div class="nav-item${it.id === 'dashboard' ? ' active' : ''}" data-page="${it.id}">
        <i class="fas ${it.icon}"></i><span>${it.label}</span>
        ${it.badge ? '<span class="badge" style="display:none">0</span>' : ''}
      </div>`
    ).join('')}</div>`
  ).join('');

  nav.querySelectorAll('.nav-item').forEach(item => {
    item.onclick = () => navigate(item.dataset.page, App);
  });

  const u = App.user;
  document.getElementById('sidebarUser').innerHTML =
    `<div class="sidebar-user-avatar"><i class="fas fa-user"></i></div>
     <div class="sidebar-user-info">
       <div class="sidebar-user-name">${u.name}</div>
       <div class="sidebar-user-role">${u.roleName}</div>
     </div>`;

  document.getElementById('dropdownHeader').innerHTML =
    `<div class="name">${u.name}</div>
     <div class="role">${u.roleName} • ${u.department}</div>`;
}

// ─── App Events ─────────────────────────────────────────────────────────
export function bindAppEvents(App) {
  document.getElementById('logoutBtn').onclick = async (e) => {
    e.preventDefault();
    await api('/api/auth/logout', { method: 'POST' });
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

  document.getElementById('sidebarToggle').onclick = () =>
    document.getElementById('sidebar').classList.toggle('collapsed');

  document.getElementById('mobileMenuBtn').onclick = () => {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('sidebarOverlay').classList.toggle('active');
  };

  document.getElementById('sidebarOverlay').onclick = () => {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('active');
  };

  document.getElementById('globalSearch').onkeydown = (e) => {
    if (e.key === 'Enter') {
      navigate('documents', App);
      App.loadDocuments(e.target.value);
    }
  };

  document.getElementById('notificationBell').onclick = () => navigate('notifications', App);

  // Zoom controls
  document.getElementById('zoomInBtn').onclick    = () => App.zoomIn();
  document.getElementById('zoomOutBtn').onclick   = () => App.zoomOut();
  document.getElementById('zoomResetBtn').onclick = () => App.resetZoom();

  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && (e.key === '=' || e.key === '+')) { e.preventDefault(); App.zoomIn(); }
    else if (e.ctrlKey && e.key === '-')               { e.preventDefault(); App.zoomOut(); }
    else if (e.ctrlKey && e.key === '0')               { e.preventDefault(); App.resetZoom(); }
  });
}

// ─── Navigate ────────────────────────────────────────────────────────────
export function navigate(page, App) {
  App.currentPage = page;
  document.querySelectorAll('.nav-item').forEach(i =>
    i.classList.toggle('active', i.dataset.page === page)
  );
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('active');
  document.getElementById('breadcrumb').innerHTML = `<span>${PAGE_LABELS[page] || page}</span>`;

  const loaders = {
    dashboard:       () => App.loadDashboard(),
    documents:       () => App.loadDocuments(),
    users:           () => App.loadUsers(),
    logs:            () => App.loadLogs(),
    system:          () => App.loadSystem(),
    upload:          () => App.loadUploadForm(),
    reports:         () => App.loadReports(),
    pending:         () => App.loadPending(),
    profile:         () => App.loadProfile(),
    notifications:   () => App.loadNotifications(),
    access_requests: () => App.loadAccessRequests(),
    my_logs:         () => App.loadMyLogs(),
    certificates:    () => App.loadCertificates()
  };
  (loaders[page] || loaders.dashboard)();
}

// ─── Badges ──────────────────────────────────────────────────────────────
export async function updateNotifBadge() {
  try {
    const data  = await api('/api/notifications/unread-count');
    const count = (data && data.count) || 0;
    const badge = document.getElementById('notifBadge');
    if (badge) {
      badge.textContent  = count;
      badge.style.display = count > 0 ? 'flex' : 'none';
    }
    document.querySelectorAll('.nav-item[data-page="notifications"] .badge').forEach(b => {
      b.textContent  = count;
      b.style.display = count > 0 ? '' : 'none';
    });
  } catch (e) { }
}

export async function updatePendingBadge() {
  try {
    const data  = await api('/api/documents/pending-count');
    const count = (data && data.count) || 0;
    document.querySelectorAll('.nav-item[data-page="pending"] .badge').forEach(b => {
      b.textContent  = count;
      b.style.display = count > 0 ? '' : 'none';
    });
  } catch (e) { }
}

export async function updateAccessReqBadge(App) {
  try {
    if (App.user && App.user.role !== 'admin') return;
    const data  = await api('/api/access-requests/pending-count');
    const count = (data && data.count) || 0;
    document.querySelectorAll('.nav-item[data-page="access_requests"] .badge').forEach(b => {
      b.textContent  = count;
      b.style.display = count > 0 ? '' : 'none';
    });
  } catch (e) { }
}

export async function updateBadges(App) {
  await Promise.all([
    updateNotifBadge(),
    updatePendingBadge(),
    updateAccessReqBadge(App)
  ]);
}

// ─── Zoom ────────────────────────────────────────────────────────────────
export function setZoom(App, level) {
  App.zoomLevel = Math.min(App.zoomMax, Math.max(App.zoomMin, level));
  const area    = document.getElementById('contentArea');
  if (area) area.style.zoom = App.zoomLevel / 100;
  const label   = document.getElementById('zoomLevel');
  if (label) label.textContent = App.zoomLevel + '%';
}
