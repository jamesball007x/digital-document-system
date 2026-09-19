// ============================
// pages/system.js — System Status & Backup (Admin)
// ============================

import { api, toast } from '../core/api.js';

export async function loadSystem() {
  const backups    = await api('/api/backups');
  const area       = document.getElementById('contentArea');
  const backupList = backups.length
    ? backups.map(b =>
        `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border-color)">
           <div><i class="fas fa-archive" style="color:var(--accent-blue);margin-right:8px"></i><span style="font-size:13px">${b.name}</span></div>
           <div style="font-size:12px;color:var(--text-muted)">${new Date(b.createdAt).toLocaleString('th-TH')}</div>
         </div>`
      ).join('')
    : '<p style="color:var(--text-muted);font-size:13px">ยังไม่มีข้อมูลสำรอง</p>';

  area.innerHTML = `<div class="fade-in">
    <div class="content-card"><div class="content-card-header"><h3><i class="fas fa-server"></i> สถานะระบบ</h3></div><div class="content-card-body">
      <div class="system-grid">
        <div class="system-item"><i class="fas fa-server" style="color:var(--accent-green)"></i><div class="system-item-info"><h4><span class="status-dot online"></span>เซิร์ฟเวอร์</h4><p>ออนไลน์ • Node.js</p></div></div>
        <div class="system-item"><i class="fas fa-database" style="color:var(--accent-blue)"></i><div class="system-item-info"><h4><span class="status-dot online"></span>ฐานข้อมูล</h4><p>MySQL • ปกติ</p></div></div>
        <div class="system-item"><i class="fas fa-hdd" style="color:var(--accent-purple)"></i><div class="system-item-info"><h4><span class="status-dot online"></span>พื้นที่จัดเก็บ</h4><p>พร้อมใช้งาน</p></div></div>
        <div class="system-item"><i class="fas fa-shield-alt" style="color:var(--accent-cyan)"></i><div class="system-item-info"><h4><span class="status-dot online"></span>ความปลอดภัย</h4><p>Session + XSS Protection</p></div></div>
      </div>
    </div></div>
    <div class="content-card"><div class="content-card-header"><h3><i class="fas fa-tools"></i> การดำเนินการ</h3></div><div class="content-card-body">
      <div class="btn-group" style="flex-wrap:wrap;gap:12px">
        <button class="btn btn-primary" onclick="App.doBackup()"><i class="fas fa-download"></i> สำรองข้อมูล</button>
        <button class="btn btn-warning" onclick="App.toast('ล้างแคชเรียบร้อย','success')"><i class="fas fa-broom"></i> ล้างแคช</button>
      </div>
    </div></div>
    <div class="content-card"><div class="content-card-header"><h3><i class="fas fa-archive"></i> ประวัติการสำรองข้อมูล</h3><span style="color:var(--text-muted);font-size:13px">${backups.length} รายการ</span></div>
      <div class="content-card-body">${backupList}</div>
    </div>
  </div>`;
}

export async function doBackup(App) {
  const data = await api('/api/backup', { method: 'POST' });
  if (data.success) {
    toast('สำรองข้อมูลเรียบร้อย: ' + data.backupName, 'success');
    loadSystem();
  } else {
    toast('เกิดข้อผิดพลาด', 'error');
  }
}
