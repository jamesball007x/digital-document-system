// ============================
// pages/users.js — User Management (Admin)
// ============================

import { api, toast } from '../core/api.js';

// ─── Shared field error helpers ──────────────────────────────────────────
export function showFieldError(inputEl, message) {
  if (!inputEl) return;
  inputEl.classList.add('is-invalid');
  const fg = inputEl.closest('.form-group') || inputEl.parentElement;
  if (fg) {
    fg.classList.add('has-error');
    const oldFb = fg.querySelector('.invalid-feedback');
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
}

export function clearModalErrors() {
  document.querySelectorAll('.modal .invalid-feedback').forEach(el => el.remove());
  document.querySelectorAll('.modal .is-invalid').forEach(el => el.classList.remove('is-invalid'));
  document.querySelectorAll('.modal .has-error').forEach(el => el.classList.remove('has-error'));
}

// ─── User List ───────────────────────────────────────────────────────────
export async function loadUsers() {
  const users = await api('/api/users');
  const area  = document.getElementById('contentArea');

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
      <table class="data-table"><thead><tr><th>ชื่อ</th><th>อีเมล</th><th>บทบาท</th><th>แผนก</th><th>สถานะ</th><th>จัดการ</th></tr></thead>
      <tbody>${rows}</tbody></table>
    </div></div></div>`;
}

// ─── Add User ────────────────────────────────────────────────────────────
export function showAddUser() {
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
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="document.getElementById('modal').style.display='none'">ยกเลิก</button>
      <button class="btn btn-primary" onclick="App.addUser()"><i class="fas fa-save"></i> บันทึก</button>
    </div>`;
  modal.style.display = 'flex';
}

export async function addUser() {
  clearModalErrors();
  const userEl = document.getElementById('newUsername');
  const passEl = document.getElementById('newPassword');
  const nameEl = document.getElementById('newName');

  const username   = userEl.value.trim();
  const password   = passEl.value;
  const name       = nameEl.value.trim();
  const email      = document.getElementById('newEmail').value.trim();
  const role       = document.getElementById('newRole').value;
  const department = document.getElementById('newDept').value.trim();

  let hasError = false;
  if (!username) { showFieldError(userEl, 'กรุณากรอกชื่อผู้ใช้');   hasError = true; }
  if (!password) { showFieldError(passEl, 'กรุณากรอกรหัสผ่าน');    hasError = true; }
  if (!name)     { showFieldError(nameEl, 'กรุณากรอกชื่อ-นามสกุล'); hasError = true; }
  if (hasError) return;

  const data = await api('/api/users', { method: 'POST', body: { username, password, name, email, role, department } });
  if (data.error) {
    if (data.error.includes('ชื่อผู้ใช้')) { showFieldError(userEl, data.error); }
    else { toast(data.error, 'error'); }
    return;
  }
  document.getElementById('modal').style.display = 'none';
  toast('เพิ่มผู้ใช้เรียบร้อย', 'success');
  loadUsers();
}

// ─── Edit User ───────────────────────────────────────────────────────────
export async function editUser(id) {
  const users = await api('/api/users');
  const u     = users.find(x => x.id === id);
  if (!u) return;

  const modal = document.getElementById('modal');
  document.getElementById('modalContent').innerHTML = `
    <div class="modal-header"><h3><i class="fas fa-user-edit"></i> แก้ไขผู้ใช้</h3><button class="modal-close" onclick="document.getElementById('modal').style.display='none'"><i class="fas fa-times"></i></button></div>
    <div class="modal-body">
      <div class="form-group"><label>ชื่อ-นามสกุล</label><input type="text" id="editName" value="${u.name}"></div>
      <div class="form-group"><label>อีเมล</label><input type="email" id="editEmail" value="${u.email}"></div>
      <div class="form-group"><label>รหัสผ่านใหม่ (ระบุเมื่อต้องการเปลี่ยน)</label><div class="password-wrapper"><input type="password" id="editPassword" placeholder="เว้นว่างไว้เพื่อคงรหัสผ่านเดิม"><button type="button" class="pw-toggle" onclick="togglePw(this)" tabindex="-1"><i class="fas fa-eye"></i></button></div><p style="font-size:11px;color:var(--text-muted);margin-top:4px">รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร ประกอบด้วยตัวอักษรและตัวเลข</p></div>
      <div class="form-group"><label>บทบาท</label><select id="editRole"><option value="user" ${u.role==='user'?'selected':''}>ผู้ใช้งานทั่วไป</option><option value="secretary" ${u.role==='secretary'?'selected':''}>ธุรการ</option><option value="executive" ${u.role==='executive'?'selected':''}>ผู้บริหารระดับสูง</option><option value="admin" ${u.role==='admin'?'selected':''}>ผู้ดูแลระบบ</option></select></div>
      <div class="form-group"><label>แผนก</label><input type="text" id="editDept" value="${u.department}"></div>
      <div class="form-group"><label>สถานะ</label><select id="editStatus"><option value="active" ${u.status==='active'?'selected':''}>ใช้งาน</option><option value="inactive" ${u.status==='inactive'?'selected':''}>ระงับ</option></select></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="document.getElementById('modal').style.display='none'">ยกเลิก</button>
      <button class="btn btn-primary" onclick="App.saveUser('${id}')"><i class="fas fa-save"></i> บันทึก</button>
    </div>`;
  modal.style.display = 'flex';
}

export async function saveUser(id) {
  clearModalErrors();
  const nameEl = document.getElementById('editName');
  const name   = nameEl.value.trim();
  if (!name) { showFieldError(nameEl, 'กรุณากรอกชื่อ-นามสกุล'); return; }

  const email      = document.getElementById('editEmail').value.trim();
  const password   = document.getElementById('editPassword').value;
  const role       = document.getElementById('editRole').value;
  const department = document.getElementById('editDept').value.trim();
  const status     = document.getElementById('editStatus').value;

  const payload = { name, email, role, department, status };
  if (password) payload.password = password;

  const data = await api(`/api/users/${id}`, { method: 'PUT', body: payload });
  if (data.error) { toast(data.error, 'error'); return; }
  document.getElementById('modal').style.display = 'none';
  toast('แก้ไขผู้ใช้เรียบร้อย', 'success');
  loadUsers();
}

// ─── Delete User ─────────────────────────────────────────────────────────
export async function deleteUser(id) {
  if (!confirm('ยืนยันการลบผู้ใช้?')) return;
  await api(`/api/users/${id}`, { method: 'DELETE' });
  toast('ลบผู้ใช้เรียบร้อย', 'success');
  loadUsers();
}
