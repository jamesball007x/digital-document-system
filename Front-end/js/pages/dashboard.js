// ============================
// pages/dashboard.js — Dashboard Page
// ============================

import { api } from '../core/api.js';
import { updateBadges } from '../core/nav.js';

export async function loadDashboard(App) {
  const stats = await api('/api/stats');
  const area  = document.getElementById('contentArea');
  const role  = App.user.role;

  // ─── Stat Cards ───
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

  // ─── Monthly Chart ───
  const monthNames = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  const monthlyEntries = Object.entries(stats.monthly || {});
  const maxMonthly     = Math.max(...monthlyEntries.map(([, v]) => v), 1);
  const chartBars = monthlyEntries.map(([k, v]) => {
    const mon = parseInt(k.split('-')[1]) - 1;
    const pct = Math.round(v / maxMonthly * 100);
    return `<div class="chart-bar-wrap"><div class="chart-bar" style="height:${pct}%"><span>${v}</span></div><div class="chart-bar-label">${monthNames[mon]}</div></div>`;
  }).join('');

  // ─── Category Breakdown ───
  const catHtml = Object.entries(stats.categories || {}).map(([k, v]) =>
    `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border-color)"><span style="font-size:13px">${k}</span><strong style="font-size:13px">${v}</strong></div>`
  ).join('');

  // ─── Recent Logs ───
  const logIcons = {
    login:'fa-sign-in-alt', logout:'fa-sign-out-alt', upload:'fa-upload', approve:'fa-check',
    reject:'fa-times', sign:'fa-signature', view:'fa-eye', submit:'fa-paper-plane',
    create_user:'fa-user-plus', update_user:'fa-user-edit', delete_user:'fa-user-minus', delete:'fa-trash'
  };
  const logHtml = stats.recentLogs.map(l =>
    `<div class="activity-item">
       <div class="activity-icon ${l.action}"><i class="fas ${logIcons[l.action] || 'fa-circle'}"></i></div>
       <div class="activity-content">
         <div class="activity-text"><strong>${l.userName}</strong> ${l.actionText}${l.targetName ? ` - ${l.targetName}` : ''}</div>
         <div class="activity-time">${new Date(l.timestamp).toLocaleString('th-TH')}</div>
       </div>
     </div>`
  ).join('');

  // ─── Quick Actions ───
  let quickActions = '';
  if (role === 'admin') {
    quickActions = `
      <button class="btn btn-primary"   onclick="App.navigate('users')"><i class="fas fa-user-plus"></i> จัดการผู้ใช้</button>
      <button class="btn btn-secondary" onclick="App.navigate('documents')"><i class="fas fa-folder-open"></i> เอกสารทั้งหมด</button>
      <button class="btn btn-outline"   onclick="App.navigate('access_requests')"><i class="fas fa-key"></i> คำร้องขอสิทธิ์</button>
      <button class="btn btn-outline"   onclick="App.navigate('logs')"><i class="fas fa-history"></i> ประวัติกิจกรรม</button>`;
  } else if (role === 'secretary') {
    quickActions = `
      <button class="btn btn-primary"   onclick="App.navigate('upload')"><i class="fas fa-cloud-upload-alt"></i> สร้าง/อัปโหลดเอกสารใหม่</button>
      <button class="btn btn-secondary" onclick="App.navigate('documents')"><i class="fas fa-folder-open"></i> เอกสารทั้งหมด</button>
      <button class="btn btn-outline"   onclick="App.navigate('reports')"><i class="fas fa-chart-bar"></i> ดูรายงานสรุป</button>`;
  } else if (role === 'executive') {
    quickActions = `
      <button class="btn btn-primary"   onclick="App.navigate('pending')"><i class="fas fa-signature"></i> พิจารณาอนุมัติ/ลงนามเอกสาร (${stats.pendingApproval + stats.pendingSignature})</button>
      <button class="btn btn-secondary" onclick="App.navigate('documents')"><i class="fas fa-folder-open"></i> เอกสารทั้งหมด</button>
      <button class="btn btn-outline"   onclick="App.navigate('certificates')"><i class="fas fa-certificate"></i> ใบรับรองดิจิทัล</button>`;
  } else {
    quickActions = `
      <button class="btn btn-secondary" onclick="App.navigate('documents')"><i class="fas fa-folder-open"></i> เอกสารของฉัน</button>
      <button class="btn btn-primary"   onclick="App.navigate('access_requests')"><i class="fas fa-key"></i> ขอสิทธิ์เข้าถึงเอกสาร</button>
      <button class="btn btn-outline"   onclick="App.navigate('profile')"><i class="fas fa-user-cog"></i> ข้อมูลส่วนตัว</button>`;
  }

  const welcomeBanner = `
    <div style="background:linear-gradient(135deg,var(--bg-card) 0%,rgba(59,130,246,0.08) 100%);border:1px solid var(--border-color);border-radius:12px;padding:20px;margin-bottom:24px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px;box-shadow:0 4px 12px rgba(0,0,0,0.03);">
      <div>
        <h2 style="margin:0 0 6px 0;font-size:20px;font-weight:700;color:var(--text-main)"><i class="fas fa-hand-wave" style="color:var(--accent-orange)"></i> สวัสดีคุณ ${App.user.name}</h2>
        <p style="margin:0;font-size:13px;color:var(--text-muted)">ยินดีต้อนรับสู่ระบบจัดการเอกสารดิจิทัล (DocMS) • บทบาท: <strong style="color:var(--accent-blue)">${App.user.roleName}</strong></p>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap">${quickActions}</div>
    </div>`;

  area.innerHTML = `<div class="fade-in">
    ${welcomeBanner}
    <div class="stats-grid">${cards}</div>
    <div class="two-col">
      <div class="content-card">
        <div class="content-card-header"><h3><i class="fas fa-chart-bar" style="color:var(--accent-purple)"></i> เอกสารรายเดือน</h3></div>
        <div class="content-card-body"><div class="chart-container">${chartBars || '<p style="color:var(--text-muted)">ไม่มีข้อมูล</p>'}</div></div>
      </div>
      <div class="content-card">
        <div class="content-card-header"><h3><i class="fas fa-tags" style="color:var(--accent-cyan)"></i> ตามหมวดหมู่</h3></div>
        <div class="content-card-body">${catHtml || '<p style="color:var(--text-muted)">ไม่มีข้อมูล</p>'}</div>
      </div>
    </div>
    <div class="content-card">
      <div class="content-card-header"><h3><i class="fas fa-history"></i> กิจกรรมล่าสุด ${role !== 'admin' ? '(ที่เกี่ยวข้องกับคุณ)' : ''}</h3></div>
      <div class="content-card-body"><div class="activity-list">${logHtml || '<div class="empty-state"><i class="fas fa-inbox"></i><h4>ไม่มีกิจกรรม</h4></div>'}</div></div>
    </div>
  </div>`;

  updateBadges(App);
}
