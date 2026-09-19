import { api } from '../api.js';
import { state } from '../state.js';
import { updateNotifBadge } from './navigation.js';

export async function loadDashboard() {
  const stats = await api('/api/stats');
  const area = document.getElementById('contentArea');
  if (!area || !state.user) return;
  const role = state.user.role;

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

  updateNotifBadge();
}
