// ============================
// pages/logs.js — Activity Logs (Admin & User)
// ============================

import { api } from '../core/api.js';

const LOG_ICONS = {
  login: 'fa-sign-in-alt', logout: 'fa-sign-out-alt', upload: 'fa-upload',
  approve: 'fa-check', reject: 'fa-times', sign: 'fa-signature', view: 'fa-eye',
  submit: 'fa-paper-plane', create_user: 'fa-user-plus', update_user: 'fa-user-edit',
  delete_user: 'fa-user-minus', delete: 'fa-trash', download: 'fa-download',
  update_profile: 'fa-user-edit', comment: 'fa-comment'
};

// ─── All Logs (Admin) ─────────────────────────────────────────────────────
export async function loadLogs() {
  const logs = await api('/api/logs');
  const area = document.getElementById('contentArea');

  const logHtml = logs.map(l =>
    `<div class="activity-item">
       <div class="activity-icon ${l.action}"><i class="fas ${LOG_ICONS[l.action] || 'fa-circle'}"></i></div>
       <div class="activity-content">
         <div class="activity-text"><strong>${l.userName}</strong> ${l.actionText}${l.targetName ? ` - ${l.targetName}` : ''}</div>
         <div class="activity-time">${new Date(l.timestamp).toLocaleString('th-TH')} • IP: ${l.ip}</div>
       </div>
     </div>`
  ).join('');

  area.innerHTML = `<div class="fade-in"><div class="content-card">
    <div class="content-card-header"><h3><i class="fas fa-history"></i> ประวัติการใช้งานทั้งหมด</h3><span style="color:var(--text-muted);font-size:13px">${logs.length} รายการ</span></div>
    <div class="content-card-body"><div class="activity-list">${logHtml || '<div class="empty-state"><i class="fas fa-inbox"></i><h4>ไม่มีบันทึก</h4></div>'}</div></div>
  </div></div>`;
}

// ─── My Logs (User) ───────────────────────────────────────────────────────
export async function loadMyLogs() {
  const logs = await api('/api/logs/me');
  const area = document.getElementById('contentArea');

  const logHtml = logs.map(l =>
    `<div class="activity-item">
       <div class="activity-icon ${l.action}"><i class="fas ${LOG_ICONS[l.action] || 'fa-circle'}"></i></div>
       <div class="activity-content">
         <div class="activity-text"><strong>${l.actionText}</strong>${l.targetName ? ` — ${l.targetName}` : ''}</div>
         <div class="activity-time"><i class="fas fa-clock"></i> ${new Date(l.timestamp).toLocaleString('th-TH')} • IP: ${l.ip || '-'}</div>
       </div>
     </div>`
  ).join('');

  area.innerHTML = `<div class="fade-in"><div class="content-card">
    <div class="content-card-header"><h3><i class="fas fa-history" style="color:var(--accent-purple)"></i> ประวัติการดำเนินการของฉัน</h3><span style="color:var(--text-muted);font-size:13px">${logs.length} รายการ</span></div>
    <div class="content-card-body"><div class="activity-list">${logHtml || '<div class="empty-state"><i class="fas fa-inbox"></i><h4>ไม่มีประวัติ</h4><p>คุณยังไม่มีประวัติการดำเนินการใดๆ</p></div>'}</div></div>
  </div></div>`;
}
