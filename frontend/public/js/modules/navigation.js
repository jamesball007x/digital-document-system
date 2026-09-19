import { api } from '../api.js';
import { state } from '../state.js';

export function buildSidebar(onNavigate) {
  const nav = document.getElementById('sidebarNav');
  if (!nav || !state.user) return;

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

  const roleMenus = menus[state.user.role] || menus.user;
  nav.innerHTML = roleMenus.map(sec =>
    `<div class="nav-section"><div class="nav-section-title">${sec.section}</div>
    ${sec.items.map(it => `<div class="nav-item${it.id === 'dashboard' ? ' active' : ''}" data-page="${it.id}">
      <i class="fas ${it.icon}"></i><span>${it.label}</span>${it.badge ? '<span class="badge" id="pendingBadge">0</span>' : ''}
    </div>`).join('')}</div>`
  ).join('');

  nav.querySelectorAll('.nav-item').forEach(item => {
    item.onclick = () => onNavigate(item.dataset.page);
  });

  const u = state.user;
  const sidebarUser = document.getElementById('sidebarUser');
  if (sidebarUser) {
    sidebarUser.innerHTML = `
      <div class="sidebar-user-avatar"><i class="fas fa-user"></i></div>
      <div class="sidebar-user-info"><div class="sidebar-user-name">${u.name}</div><div class="sidebar-user-role">${u.roleName}</div></div>`;
  }
}

export async function updateNotifBadge() {
  try {
    const data = await api('/api/notifications/unread-count');
    const count = data.count || 0;
    const badge = document.getElementById('notifBadge');
    if (badge) {
      badge.textContent = count;
      badge.style.display = count > 0 ? 'flex' : 'none';
    }
    const navBadges = document.querySelectorAll('.nav-item[data-page="notifications"] .badge');
    navBadges.forEach(b => {
      b.textContent = count;
      b.style.display = count > 0 ? 'inline-block' : 'none';
    });
  } catch (e) { }
}

export function bindAppEvents(onLogout, onNavigate) {
  const userBtn = document.getElementById('userMenuBtn');
  if (userBtn) {
    userBtn.onclick = () => {
      const dd = document.getElementById('userDropdown');
      if (dd) dd.classList.toggle('active');
    };
  }

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.user-menu')) {
      const dd = document.getElementById('userDropdown');
      if (dd) dd.classList.remove('active');
    }
  });

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.onclick = async () => {
      await api('/api/auth/logout', { method: 'POST' });
      state.user = null;
      onLogout();
    };
  }
}
